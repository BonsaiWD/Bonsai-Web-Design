import 'server-only';
import { headers } from 'next/headers';
import { getDb } from '@/db';
import { activity } from '@/db/schema';
import { allowedHosts } from '@/lib/auth';
import { sendEmail, STUDIO_EMAIL, type EmailContent } from '@/lib/email';
import { isFlaggedEmailKind } from './kinds';

export { STUDIO_EMAIL };

// Who the studio is to a client: they deal with the studio, so a studio member with no name is
// shown as the studio, never by their address
export const STUDIO_NAME = 'Bonsai Web Design';

const PRODUCTION_ORIGIN = 'https://bonsaiwebdesign.com';

/**
 * The address links in emails point at. Production always uses the real domain, never the
 * request host, so an admin browsing a deployment URL cannot send clients to a frozen build.
 * Elsewhere (previews, local) links follow the host the admin is on.
 */
export async function portalOrigin(): Promise<string> {
    if (process.env.VERCEL_ENV === 'production') {
        return process.env.BETTER_AUTH_URL?.replace(/\/$/, '') || PRODUCTION_ORIGIN;
    }
    const requestHeaders = await headers();
    const host = requestHeaders.get('host');
    if (host && allowedHosts().includes(host)) {
        const local = host.startsWith('localhost');
        return `${local ? 'http' : 'https'}://${host}`;
    }
    return PRODUCTION_ORIGIN;
}

// Previews share the production database, so they only ever email the studio's own
// addresses. Locally, with no Resend key, emails are printed instead of sent.
function emailAllowed(to: string): boolean {
    if (!process.env.RESEND_API_KEY || process.env.VERCEL_ENV === 'production') return true;
    return to.toLowerCase().endsWith('@bonsaiwebdesign.com');
}

interface ActivityInput {
    projectId: string;
    actorId: string | null;
    kind: string;
    summary: string;
    // A tab inside the project, such as "deliverables"
    target?: string;
    visibility?: 'everyone' | 'studio';
    email?: { to: string; subject: string; content: EmailContent; replyTo?: string };
}

/**
 * Records what happened and sends its email. Call after the change has committed: the email
 * can fail without undoing anything, and the failure is kept on the activity row, where the
 * studio's dashboard shows it.
 */
export async function recordActivity(input: ActivityInput): Promise<{ emailStatus: 'sent' | 'failed' | 'skipped' | null }> {
    let emailStatus: 'sent' | 'failed' | 'skipped' | null = null;
    if (input.email) {
        const { to, subject, content, replyTo } = input.email;
        if (!emailAllowed(to)) {
            emailStatus = 'skipped';
            console.info(`[portal email] Preview: not emailing ${to} (${subject})`);
        } else {
            try {
                const preview = process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production';
                await sendEmail({ to, subject: preview ? `[Preview] ${subject}` : subject, content, replyTo });
                emailStatus = 'sent';
            } catch (error) {
                emailStatus = 'failed';
                console.error('[portal email]', error);
            }
        }
    }
    try {
        await getDb()
            .insert(activity)
            .values({
                projectId: input.projectId,
                actorId: input.actorId,
                kind: input.kind,
                summary: input.summary,
                target: input.target ?? null,
                visibility: input.visibility ?? 'everyone',
                emailTo: input.email?.to ?? null,
                emailStatus,
            });
    } catch (error) {
        // The change itself already succeeded; losing a timeline entry must not fail the request
        console.error('[portal activity]', error);
    }
    return { emailStatus };
}

// Emails to the studio name the project in one pattern, since a client can have several:
// "Jane Doe approved Homepage design, version 2 · Juniper Studio website"
export function studioSubject(event: string, projectName: string): string {
    return `${event} · ${projectName}`;
}

/*
 * Text with no column of its own (an uploader's note, why a signed copy was sent back) travels
 * at the end of its activity summary: "<summary>. Note: <text>". `after` anchors the search
 * to what the summary says first, in case that (a filename) contains the marker itself.
 */
export function summaryWithText(summary: string, label: 'Note' | 'Reason', text: string | null): string {
    return text ? `${summary}. ${label}: ${text}` : summary;
}

export function textFromSummary(summary: string, label: 'Note' | 'Reason', after = ''): string | null {
    const marker = `${after}. ${label}: `;
    const at = summary.indexOf(marker);
    return at >= 0 ? summary.slice(at + marker.length) || null : null;
}

// Appended to a success message when the email part failed. `kind` is the activity kind the
// email was recorded with: only kinds the dashboard flags promise that it is flagged there.
export function emailNote(status: 'sent' | 'failed' | 'skipped' | null, who: string, kind: string): string {
    if (status === 'failed') {
        return isFlaggedEmailKind(kind) ? ` The email to ${who} could not be sent; it is flagged on your dashboard.` : ` The email to ${who} could not be sent.`;
    }
    if (status === 'skipped') return ` (Preview: no email was sent to ${who}.)`;
    return '';
}
