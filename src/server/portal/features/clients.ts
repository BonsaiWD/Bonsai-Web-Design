import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, count, eq, gt, inArray, like, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { project, rateLimit, session, user, verification } from '@/db/schema';
import type { ClientOption, ClientView, StudioMemberView } from '@/components/portal/admin/types';
import { sendEmail, type EmailContent } from '@/lib/email';
import { firstName } from '@/lib/portal-format';
import { portalOrigin } from '../notify';

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export const displayName = (row: { name: string | null; email: string }) => row.name?.trim() || row.email;

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
   At most one invite per client every 10 minutes, claimed with one conditional upsert so two
   clicks at once cannot both send. The row's time is also "last invited" on the page. */

export const INVITE_INTERVAL_MS = 10 * 60 * 1000;

export function inviteKey(clientId: string): string {
    return `portal:invite:${clientId}`;
}

export async function claimInviteSlot(clientId: string): Promise<{ ok: true } | { ok: false; waitMinutes: number }> {
    const db = getDb();
    const key = inviteKey(clientId);
    const now = Date.now();
    const claimed = await db
        .insert(rateLimit)
        .values({ id: randomUUID(), key, count: 1, lastRequest: now })
        .onConflictDoUpdate({
            target: rateLimit.key,
            set: { count: sql`${rateLimit.count} + 1`, lastRequest: now },
            setWhere: sql`${rateLimit.lastRequest} <= ${now - INVITE_INTERVAL_MS}`,
        })
        .returning({ id: rateLimit.id });
    if (claimed.length) return { ok: true };
    const [row] = await db.select({ lastRequest: rateLimit.lastRequest }).from(rateLimit).where(eq(rateLimit.key, key));
    const last = row?.lastRequest ?? now;
    return { ok: false, waitMinutes: Math.max(1, Math.ceil((last + INVITE_INTERVAL_MS - now) / 60_000)) };
}

// An invite that did not go out should neither block the next try nor read as sent
export async function releaseInviteSlot(clientId: string): Promise<void> {
    await getDb().delete(rateLimit).where(eq(rateLimit.key, inviteKey(clientId)));
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

export async function inviteEmail(client: { name: string | null; email: string }, projectNames: string[]): Promise<{ subject: string; content: EmailContent }> {
    const name = firstName(client.name);
    const signIn = `${await portalOrigin()}/portal/sign-in?email=${encodeURIComponent(client.email)}`;
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
