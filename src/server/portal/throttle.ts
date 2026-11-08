import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { rateLimit } from '@/db/schema';
// Types only: this module has no runtime dependency on the rest of the portal, so lib/auth.ts
// can use it for the sign-in caps
import type { Db, Tx } from './access';

/*
 * Throttles and counters kept in the rate_limit table (shared with Better Auth's per-IP limit),
 * so they hold across server instances.
 *
 * A slot allows one thing per key every `gapMs`: "at most one email about this every 10
 * minutes". Claiming is one conditional upsert, so two requests at the same moment cannot
 * both win. The row's last_request is when the slot was last claimed (pages show it as "last
 * emailed"). When the thing the slot was claimed for did not happen (the email failed or was
 * skipped), releaseRateSlot puts back what was there before, so the next try works at once
 * and "last emailed" keeps pointing at an email that really went.
 *
 * A window counter adds up amounts per key over a fixed window that starts with the first
 * count (last_request holds when it started): "50 uploads a day", "3 sign-in links in 15
 * minutes".
 */

export type RateSlot =
  | { ok: true; key: string; claimedAt: number; previousAt: number | null }
  | { ok: false; key: string; waitMinutes: number };

export async function claimRateSlot(key: string, gapMs: number, db: Db | Tx = getDb()): Promise<RateSlot> {
  const now = Date.now();
  const [previous] = await db.select({ lastRequest: rateLimit.lastRequest }).from(rateLimit).where(eq(rateLimit.key, key));
  const claimed = await db
    .insert(rateLimit)
    .values({ id: randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: { count: sql`${rateLimit.count} + 1`, lastRequest: now },
      setWhere: sql`${rateLimit.lastRequest} <= ${now - gapMs}`,
    })
    .returning({ id: rateLimit.id });
  if (claimed.length) return { ok: true, key, claimedAt: now, previousAt: previous?.lastRequest ?? null };
  const [current] = await db.select({ lastRequest: rateLimit.lastRequest }).from(rateLimit).where(eq(rateLimit.key, key));
  const last = current?.lastRequest ?? now;
  return { ok: false, key, waitMinutes: Math.max(1, Math.ceil((last + gapMs - now) / 60_000)) };
}

/*
 * For an email that goes out whatever the gap (a receipt, a reopened invoice, a replaced
 * document): the slot is taken now, so the next gap counts from this email. If it then fails,
 * releaseRateSlot forgets the slot altogether (previousAt is null), so "Email again" works at
 * once instead of waiting out the gap of the email before it.
 */
export async function forceRateSlot(key: string, db: Db | Tx = getDb()): Promise<RateSlot> {
  const now = Date.now();
  await db
    .insert(rateLimit)
    .values({ id: randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({ target: rateLimit.key, set: { count: sql`${rateLimit.count} + 1`, lastRequest: now } });
  return { ok: true, key, claimedAt: now, previousAt: null };
}

// Gives back a claim whose purpose did not happen. Only this claim is touched (a later one
// stays), a refused claim is left alone, and a failure here never fails the request.
export async function releaseRateSlot(slot: RateSlot): Promise<void> {
  if (!slot.ok) return;
  const mine = and(eq(rateLimit.key, slot.key), eq(rateLimit.lastRequest, slot.claimedAt));
  try {
    if (slot.previousAt === null) await getDb().delete(rateLimit).where(mine);
    else await getDb().update(rateLimit).set({ lastRequest: slot.previousAt, count: sql`greatest(${rateLimit.count} - 1, 1)` }).where(mine);
  } catch (error) {
    console.error('[portal throttle] release', error);
  }
}

// Forgets a slot entirely: its subject was deleted, or changed so much that the next email
// is a first one (a client's new address)
export async function clearRateSlot(key: string, db: Db | Tx = getDb()): Promise<void> {
  await db.delete(rateLimit).where(eq(rateLimit.key, key));
}

// Adds `amount` to the key's window (starting a new window once the old one has passed) and
// returns the new total and when the window started. Pass one `now` to count several
// measures as one moment.
export async function countInWindow(
  key: string,
  amount: number,
  windowMs: number,
  { db = getDb(), now = Date.now() }: { db?: Db | Tx; now?: number } = {},
): Promise<{ count: number; windowStart: number }> {
  const expired = now - windowMs;
  const result = await db.execute<{ count: number; last_request: string }>(sql`
    INSERT INTO rate_limit (id, key, count, last_request)
    VALUES (gen_random_uuid()::text, ${key}, ${amount}::int, ${now})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limit.last_request < ${expired} THEN ${amount}::int ELSE rate_limit.count + ${amount}::int END,
      last_request = CASE WHEN rate_limit.last_request < ${expired} THEN ${now} ELSE rate_limit.last_request END
    RETURNING count, last_request`);
  const row = result.rows[0];
  return { count: Number(row?.count ?? amount), windowStart: Number(row?.last_request ?? now) };
}

// Takes back what countInWindow added at `countedAt`, if that window is still the current one
export async function uncountInWindow(key: string, amount: number, countedAt: number): Promise<void> {
  await getDb().execute(
    sql`UPDATE rate_limit SET count = greatest(count - ${amount}::int, 0) WHERE key = ${key} AND last_request <= ${countedAt}`,
  );
}
