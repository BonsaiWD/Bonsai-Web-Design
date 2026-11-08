import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins/magic-link';
import { eq } from 'drizzle-orm';
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
    if (!process.env.VERCEL) hosts.push('localhost:3000');
    return hosts;
}

async function sendSignInLink({ email, token, url }: { email: string; token: string; url: string }) {
    // disableSignUp only refuses an unknown address once its link is opened. Checking here
    // means the portal never emails anyone who is not a client, and the reply is the same either way.
    const client = await getDb().query.user.findFirst({
        columns: { id: true },
        where: eq(schema.user.email, email.toLowerCase()),
    });
    if (!client) return;

    // The email opens a confirm page instead of the one-time verify URL, so link scanners
    // that prefetch URLs (Outlook Safe Links and others) cannot use up the token
    const link = new URL('/portal/verify', url);
    link.searchParams.set('token', token);

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
        rateLimit: { storage: 'database' },
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
