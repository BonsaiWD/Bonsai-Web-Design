'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db';
import { paymentMethodSetting, type PaymentMethod } from '@/db/schema';
import { listMethods, METHOD_DETAILS, METHOD_LABELS, METHOD_ORDER } from '@/components/portal/invoices/labels';
import { plural } from '@/lib/portal-format';
import { adminActor } from '@/server/portal/access';
import { ActionError, done, runAction, type ActionState } from '@/server/portal/actions';
import { settingsVersion } from '@/server/portal/features/invoices';

const MAX_INSTRUCTIONS = 1000;

// Line breaks as LF, no trailing spaces, no blank lines at either end
function cleanInstructions(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

export async function savePaymentSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    await adminActor();

    const errors: Record<string, string> = {};
    const next: { method: PaymentMethod; enabled: boolean; instructions: string }[] = [];
    for (const method of METHOD_ORDER) {
      const enabled = formData.get(`enabled.${method}`) === 'on';
      const instructions = cleanInstructions(formData.get(`instructions.${method}`));
      const field = `instructions.${method}`;
      if (instructions.length > MAX_INSTRUCTIONS) {
        errors[field] = `Keep these under ${MAX_INSTRUCTIONS.toLocaleString('en-US')} characters.`;
      } else if (enabled && !instructions) {
        // A method shown on invoices with nothing to pay to would leave the client stuck
        errors[field] = `Add the ${METHOD_DETAILS[method].noun} before showing ${METHOD_LABELS[method]} on invoices.`;
      }
      next.push({ method, enabled, instructions });
    }
    if (Object.keys(errors).length) throw new ActionError('Check the highlighted fields and try again.', errors);
    const expected = formData.get('version');

    const changed = await getDb().transaction(async (tx) => {
      // Lock every row, then compare versions: two people saving at once queue up here
      const current = await tx
        .select({ method: paymentMethodSetting.method, enabled: paymentMethodSetting.enabled, instructions: paymentMethodSetting.instructions })
        .from(paymentMethodSetting)
        .for('update');
      const [{ version }] = await tx.select({ version: settingsVersion }).from(paymentMethodSetting);
      if (typeof expected !== 'string' || expected !== version) {
        throw new ActionError('Payment settings changed since you opened this page. Reload to see the latest, then make your change again.');
      }
      const byMethod = new Map(current.map((row) => [row.method, row]));
      let count = 0;
      for (const row of next) {
        const saved = byMethod.get(row.method);
        if (saved && saved.enabled === row.enabled && saved.instructions === row.instructions) continue;
        // The migration seeds every method; an upsert keeps the page working if one is missing
        await tx
          .insert(paymentMethodSetting)
          .values(row)
          .onConflictDoUpdate({ target: paymentMethodSetting.method, set: { enabled: row.enabled, instructions: row.instructions, updatedAt: new Date() } });
        count += 1;
      }
      return count;
    });

    // Every invoice page shows these, for every project
    if (changed > 0) revalidatePath('/portal', 'layout');
    const shown = next.filter((row) => row.enabled).map((row) => row.method);
    const summary = shown.length
      ? `Invoices show ${plural(shown.length, 'way', 'ways')} to pay: ${listMethods(shown)}.`
      : "No methods are turned on, so invoices say we'll send payment details separately.";
    return done(changed > 0 ? `Saved. ${summary}` : `Nothing had changed. ${summary}`);
  });
}
