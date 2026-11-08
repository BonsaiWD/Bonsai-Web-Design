import 'server-only';
import { and, asc, count, eq, gt, inArray, like, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { activity, project, rateLimit, session, user, verification } from '@/db/schema';
import type { ClientOption, ClientView, StudioMemberView } from '@/components/portal/admin/types';
import { sendEmail, type EmailContent } from '@/lib/email';
import { firstName } from '@/lib/portal-format';
import type { Tx } from '../access';
import { portalOrigin } from '../notify';

export const displayName = (row: { name: string | null; email: string }) => row.name?.trim() || row.email;

/*
 * A client's own activity rows start with the name they went by ("Jane Doe approved ..."), and
 * the feeds turn that subject into "You" for the client. When their name or address changes,
 * those rows take the new one in the same transaction, so a feed never reads a client in the
 * third person beside "You", or under a name they no longer use. Signed records keep the name
 * as it was; these rows are only the timeline's wording.
 */
export async function renameActivitySubject(tx: Tx, clientId: string, from: (string | null)[], to: string): Promise<void> {
    const subjects = new Set(from.filter((name): name is string => Boolean(name) && name !== to));
    for (const old of subjects) {
        await tx
            .update(activity)
            .set({ summary: sql`${to}::text || substr(${activity.summary}, char_length(${old}::text) + 1)` })
            .where(and(eq(activity.actorId, clientId), sql`left(${activity.summary}, char_length(${old}::text) + 1) = ${`${old} `}::text`));
    }
}

/* ---------- The clients page ---------- */

export async function loadPeople(): Promise<{ clients: ClientView[]; studio: StudioMemberView[] }> {
    const db = getDb();
    const [people, projects, sessions] = await Promise.all([
        db
            .select({
                id: user.id,
                name: user.name,
                email: user.email,
                company: user.company,
                role: user.role,
                lastSignInAt: user.lastSignInAt,
                createdAt: user.createdAt,
            })
            .from(user)
            .orderBy(asc(sql`lower(coalesce(nullif(${user.name}, ''), ${user.email}))`)),
        db
            .select({ id: project.id, name: project.name, stage: project.stage, clientId: project.clientId })
            .from(project)
            .orderBy(asc(project.name)),
        db
            .select({ userId: session.userId, devices: count() })
            .from(session)
            .where(gt(session.expiresAt, sql`now()`))
            .groupBy(session.userId),
    ]);

    const clientIds = people.filter((person) => person.role === 'client').map((person) => person.id);
    const invites = clientIds.length
        ? await db
              .select({ key: rateLimit.key, lastRequest: rateLimit.lastRequest })
              .from(rateLimit)
              .where(inArray(rateLimit.key, clientIds.map(inviteKey)))
        : [];
    const invitedAt = new Map(invites.map((row) => [row.key, new Date(row.lastRequest).toISOString()]));
    const devices = new Map(sessions.map((row) => [row.userId, Number(row.devices)]));

    const clients: ClientView[] = [];
    const studio: StudioMemberView[] = [];
    for (const person of people) {
        if (person.role === 'admin') {
            studio.push({
                id: person.id,
                name: displayName(person),
                email: person.email,
                lastSignInAt: person.lastSignInAt?.toISOString() ?? null,
            });
            continue;
        }
        clients.push({
            id: person.id,
            name: person.name,
            email: person.email,
            company: person.company,
            lastSignInAt: person.lastSignInAt?.toISOString() ?? null,
            addedAt: person.createdAt.toISOString(),
            projects: projects.filter((row) => row.clientId === person.id).map(({ id, name, stage }) => ({ id, name, stage })),
            activeDevices: devices.get(person.id) ?? 0,
            lastInvitedAt: invitedAt.get(inviteKey(person.id)) ?? null,
        });
    }
    return { clients, studio };
}

// For the client pickers on the new project form and the project settings tab
export async function loadClientOptions(): Promise<ClientOption[]> {
    const rows = await getDb()
        .select({ id: user.id, name: user.name, email: user.email, company: user.company })
        .from(user)
        .where(eq(user.role, 'client'))
        .orderBy(asc(sql`lower(coalesce(nullif(${user.name}, ''), ${user.email}))`));
    return rows.map((row) => ({ id: row.id, name: displayName(row), email: row.email, company: row.company }));
}

// A client by id, for the actions: admins are managed elsewhere and never match
export async function lockClient(tx: Tx, clientId: string) {
    const [row] = await tx
        .select({ id: user.id, name: user.name, email: user.email, company: user.company })
        .from(user)
        .where(and(eq(user.id, clientId), eq(user.role, 'client')))
        .for('update');
    return row ?? null;
}

// Ends every session and pending sign-in link, so an old address or device cannot get back in
export async function endAccess(tx: Tx, clientId: string, emails: string[]): Promise<number> {
    const ended = await tx.delete(session).where(eq(session.userId, clientId)).returning({ id: session.id });
    const lower = new Set(emails.map((email) => email.toLowerCase()));
    const links = await tx
        .select({ id: verification.id, value: verification.value })
        .from(verification)
        .where(like(verification.identifier, 'magic-link:%'));
    // Better Auth stores the address in the row's JSON value; parse it here rather than in SQL,
    // so a row in another format can never make the query throw
    const mine = links
        .filter((row) => {
            try {
                const parsed = JSON.parse(row.value) as { email?: unknown };
                return typeof parsed.email === 'string' && lower.has(parsed.email.toLowerCase());
            } catch {
                return false;
            }
        })
        .map((row) => row.id);
    if (mine.length) await tx.delete(verification).where(inArray(verification.id, mine));
    return ended.length;
}

/* ---------- Invites ----------
   At most one invite per client every 10 minutes (claimRateSlot). The slot's time is also
   "last invited" on the page. */

export const INVITE_INTERVAL_MS = 10 * 60 * 1000;

export function inviteKey(clientId: string): string {
    return `portal:invite:${clientId}`;
}

export async function clientProjectNames(clientId: string): Promise<string[]> {
    const rows = await getDb()
        .select({ name: project.name })
        .from(project)
        .where(eq(project.clientId, clientId))
        .orderBy(asc(project.createdAt));
    return rows.map((row) => row.name);
}

function listNames(names: string[]): string {
    if (names.length <= 1) return names[0] ?? '';
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// 'new': a first invite. 'address_changed': an existing client's sign-in address changed, so
// the email to the new address says so rather than welcoming them to a portal they already use.
export type InviteReason = 'new' | 'address_changed';

export const EMAIL_CHANGED_KIND = 'client.email_changed';

export const emailChangedSummary = (name: string, from: string, to: string) => `${name}'s email changed from ${from} to ${to}`;

/*
 * Which invite Send invite sends: the one Change email would have sent, until they sign in
 * with the new address. Signing in proves an address (emailVerified) and a change unproves it,
 * so an unproven address is a changed one when they have signed in before, or when one of
 * their projects records the change to it. Anything else gets the first invite.
 */
export async function inviteReasonFor(client: {
    id: string;
    email: string;
    emailVerified: boolean;
    lastSignInAt: Date | null;
}): Promise<InviteReason> {
    if (client.emailVerified) return 'new';
    if (client.lastSignInAt) return 'address_changed';
    const changes = await getDb()
        .select({ summary: activity.summary })
        .from(activity)
        .innerJoin(project, eq(project.id, activity.projectId))
        .where(and(eq(project.clientId, client.id), eq(activity.kind, EMAIL_CHANGED_KIND)));
    return changes.some((row) => row.summary.endsWith(` to ${client.email}`)) ? 'address_changed' : 'new';
}

export async function inviteEmail(
    client: { name: string | null; email: string },
    projectNames: string[],
    reason: InviteReason = 'new',
): Promise<{ subject: string; content: EmailContent }> {
    const name = firstName(client.name);
    // The sign-in page with the address filled in: they ask for their link from there
    const signIn = `${await portalOrigin()}/portal/sign-in?email=${encodeURIComponent(client.email)}`;
    if (reason === 'address_changed') {
        return {
            subject: `Your sign-in address is now ${client.email}`,
            content: {
                heading: 'Your portal sign-in address has changed',
                paragraphs: [
                    name ? `Hi ${name},` : 'Hello,',
                    `We've changed the address you use for your Bonsai Web Design client portal${projectNames.length ? ` (${listNames(projectNames)})` : ''}. From now on, sign in with ${client.email}.`,
                    `${projectNames.length ? 'Your projects, messages and files are all still there. ' : ''}We email you a link each time you sign in, so there's no password to remember.`,
                ],
                action: { label: 'Sign in with this address', url: signIn },
                footnotes: ["If this isn't your address, you can ignore this email. Nothing happens until someone signs in."],
            },
        };
    }
    return {
        subject: 'Your client portal is ready',
        content: {
            heading: 'Your client portal is ready',
            paragraphs: [
                name ? `Hi ${name},` : 'Hello,',
                projectNames.length
                    ? `We've set up your client portal with Bonsai Web Design for ${listNames(projectNames)}. It's where you'll follow the project, review what we share, sign off each step and message us.`
                    : "We've set up your client portal with Bonsai Web Design. It's where you'll follow your project, review what we share, sign off each step and message us.",
                `Sign in with this email address: ${client.email}. We email you a link each time, so there's no password to remember.`,
            ],
            action: { label: 'Sign in to the portal', url: signIn },
            footnotes: ["If you weren't expecting this, you can ignore it. Nothing happens until you sign in."],
        },
    };
}

/* ---------- Email that belongs to no project ----------
   recordActivity needs a project, and an invite may come before the first one. These are the
   same rules it applies: previews only email the studio's own addresses, and with no Resend
   key the email is printed to the server log. */

function emailAllowed(to: string): boolean {
    if (!process.env.RESEND_API_KEY || process.env.VERCEL_ENV === 'production') return true;
    return to.toLowerCase().endsWith('@bonsaiwebdesign.com');
}

export async function sendStandaloneEmail(to: string, subject: string, content: EmailContent): Promise<'sent' | 'failed' | 'skipped'> {
    if (!emailAllowed(to)) {
        console.info(`[portal email] Preview: not emailing ${to} (${subject})`);
        return 'skipped';
    }
    try {
        const preview = process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production';
        await sendEmail({ to, subject: preview ? `[Preview] ${subject}` : subject, content });
        return 'sent';
    } catch (error) {
        console.error('[portal email]', error);
        return 'failed';
    }
}

// Whether the studio has anyone to make a project for yet
export async function hasAnyClient(): Promise<boolean> {
    const [row] = await getDb().select({ id: user.id }).from(user).where(eq(user.role, 'client')).limit(1);
    return Boolean(row);
}

// The client card on a project overview, for the studio
export async function loadClientContact(clientId: string) {
    const [row] = await getDb()
        .select({ id: user.id, name: user.name, email: user.email, company: user.company, lastSignInAt: user.lastSignInAt })
        .from(user)
        .where(eq(user.id, clientId));
    if (!row) return null;
    return {
        id: row.id,
        name: displayName(row),
        email: row.email,
        company: row.company,
        lastSignInAt: row.lastSignInAt?.toISOString() ?? null,
    };
}
