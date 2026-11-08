import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins/magic-link';
import { waitUntil } from '@vercel/functions';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { sendEmail } from '@/lib/email';

export const LINK_LIFETIME_MINUTES = 15;

// Exact hosts only: a wildcard such as *.vercel.app would also trust other people's sites
export function allowedHosts(): string[] {
    const hosts = ['bonsaiwebdesign.com', 'www.bonsaiwebdesign.com'];
    // Set by Vercel per deployment, so a preview signs in on its own URL
    for (const host of [
        process.env.VERCEL_PROJECT_PRODUCTION_URL,
        process.env.VERCEL_URL,
        process.env.VERCEL_BRANCH_URL,
    ]) {
        if (host) hosts.push(host);
    }
    // Local development, on the usual port or a few beside it
    if (!process.env.VERCEL) for (let port = 3000; port <= 3010; port++) hosts.push(`localhost:${port}`);
    return hosts;
}

// Per-address caps, on top of Better Auth's per-IP limit, so nobody can flood a client's
// inbox or use up the studio's daily Resend allowance through the sign-in form
const ADDRESS_CAPS = [
    { window: 'quarter-hour', ms: 15 * 60 * 1000, max: 3 },
    { window: 'day', ms: 24 * 60 * 60 * 1000, max: 10 },
];

async function withinAddressCaps(email: string): Promise<boolean> {
    const now = Date.now();
    for (const cap of ADDRESS_CAPS) {
        // One atomic upsert per window; last_request holds when the window started
        const key = `portal:signin:${cap.window}:${email}`;
        const result = await getDb().execute<{ count: number }>(sql`
            INSERT INTO rate_limit (id, key, count, last_request)
            VALUES (gen_random_uuid()::text, ${key}, 1, ${now})
            ON CONFLICT (key) DO UPDATE SET
                count = CASE WHEN rate_limit.last_request < ${now - cap.ms} THEN 1 ELSE rate_limit.count + 1 END,
                last_request = CASE WHEN rate_limit.last_request < ${now - cap.ms} THEN ${now} ELSE rate_limit.last_request END
            RETURNING count`);
        if (Number(result.rows[0]?.count ?? 0) > cap.max) return false;
    }
    return true;
}

async function deliverSignInLink(email: string, link: URL) {
    try {
        await sendEmail({
            to: email,
            subject: 'Your sign-in link for the Bonsai client portal',
            content: {
                heading: 'Sign in to your client portal',
                paragraphs: [
                    `Use the button below to sign in. The link works once and expires in ${LINK_LIFETIME_MINUTES} minutes.`,
                ],
                action: { label: 'Open the portal', url: link.toString() },
                footnotes: ['If you did not ask to sign in, you can ignore this email.'],
            },
        });
    } catch (error) {
        console.error('[portal sign-in email]', error);
    }
}

async function sendSignInLink({ email, token, url }: { email: string; token: string; url: string }) {
    const address = email.toLowerCase();
    // disableSignUp only refuses an unknown address once its link is opened. Checking here
    // means the portal never emails anyone who is not a client, and the reply is the same either way.
    const client = await getDb().query.user.findFirst({
        columns: { id: true },
        where: eq(schema.user.email, address),
    });
    if (!client || !(await withinAddressCaps(address))) return;

    // The email opens a confirm page instead of the one-time verify URL, so link scanners
    // that prefetch URLs (Outlook Safe Links and others) cannot use up the token
    const link = new URL('/portal/verify', url);
    link.searchParams.set('token', token);
    // Where the person was heading; the verify page only accepts paths inside the portal
    const next = new URL(url).searchParams.get('callbackURL');
    if (next && next.startsWith('/portal/') && !next.startsWith('//')) link.searchParams.set('next', next);

    // Sent after the response, so a client's address answers as fast as an unknown one
    waitUntil(deliverSignInLink(address, link));
}

function createAuth() {
    return betterAuth({
        appName: 'Bonsai Web Design',
        baseURL: { allowedHosts: allowedHosts(), fallback: process.env.BETTER_AUTH_URL },
        database: drizzleAdapter(getDb(), { provider: 'pg', schema }),
        user: {
            additionalFields: {
                role: { type: 'string', defaultValue: 'client', input: false },
            },
        },
        session: {
            expiresIn: 60 * 60 * 24 * 30,
            updateAge: 60 * 60 * 24,
        },
        databaseHooks: {
            session: {
                create: {
                    // Lets the studio see whether (and when) a client last signed in
                    after: async (created) => {
                        await getDb()
                            .update(schema.user)
                            .set({ lastSignInAt: new Date() })
                            .where(eq(schema.user.id, created.userId));
                    },
                },
            },
        },
        rateLimit: { storage: 'database' },
        // The portal manages names itself; clients cannot rename themselves through the API
        disabledPaths: ['/update-user'],
        plugins: [
            magicLink({
                // Clients are added by the studio; a link never creates an account
                disableSignUp: true,
                expiresIn: LINK_LIFETIME_MINUTES * 60,
                sendMagicLink: sendSignInLink,
            }),
        ],
    });
}

let auth: ReturnType<typeof createAuth> | undefined;

// Created on first use so a missing secret or database URL fails that request, not the build
export function getAuth() {
    auth ??= createAuth();
    return auth;
}
