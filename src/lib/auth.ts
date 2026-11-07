import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins/magic-link';
import { eq } from 'drizzle-orm';
import { Resend } from 'resend';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { escapeHtml } from '@/lib/escapeHtml';
import { theme } from '@/styles/theme';

export const LINK_LIFETIME_MINUTES = 15;

// Exact hosts only: a wildcard such as *.vercel.app would also trust other people's sites
function allowedHosts(): string[] {
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

function signInEmail(link: string) {
    const { colors } = theme;
    const href = escapeHtml(link);
    const html = `
<div style="background:${colors.background};padding:48px 24px;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;">
    <p style="margin:0 0 32px;font-family:'Playfair Display',Georgia,serif;font-size:20px;letter-spacing:0.05em;text-transform:uppercase;color:${colors.text};">Bonsai</p>
    <h1 style="margin:0 0 16px;font-family:'Playfair Display',Georgia,serif;font-size:28px;font-weight:400;line-height:1.2;color:${colors.primary};">Sign in to your client portal</h1>
    <p style="margin:0 0 32px;font-size:16px;line-height:1.7;color:${colors.textSecondary};">Use the button below to sign in. The link works once and expires in ${LINK_LIFETIME_MINUTES} minutes.</p>
    <a href="${href}" style="display:inline-block;padding:14px 28px;background:${colors.primary};color:${colors.background};font-size:13px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;text-decoration:none;">Open the portal</a>
    <p style="margin:32px 0 0;font-size:13px;line-height:1.6;color:${colors.textSecondary};">If the button does not work, paste this address into your browser:<br><a href="${href}" style="color:${colors.primary};word-break:break-all;">${href}</a></p>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${colors.textSecondary};">If you did not ask to sign in, you can ignore this email.</p>
  </div>
</div>`;
    const text = [
        'Sign in to your Bonsai Web Design client portal:',
        link,
        '',
        `The link works once and expires in ${LINK_LIFETIME_MINUTES} minutes.`,
        'If you did not ask to sign in, you can ignore this email.',
    ].join('\n');
    return { html, text };
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

    // Read the key per request, as the contact form does
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        if (process.env.NODE_ENV !== 'production') {
            console.info(`[portal] RESEND_API_KEY is not set. Sign-in link for ${email}: ${link}`);
            return;
        }
        throw new Error('RESEND_API_KEY is not set');
    }

    const { html, text } = signInEmail(link.toString());
    const { error } = await new Resend(apiKey).emails.send({
        from: 'Bonsai Web Design <admin@bonsaiwebdesign.com>',
        to: [email],
        subject: 'Your sign-in link for the Bonsai client portal',
        html,
        text,
    });
    if (error) {
        throw new Error(`Resend could not send the sign-in link: ${error.message}`);
    }
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
