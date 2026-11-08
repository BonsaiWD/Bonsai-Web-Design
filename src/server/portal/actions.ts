import 'server-only';
import { z } from 'zod';

// What every portal form action returns to useActionState
export type ActionState = {
    ok: boolean;
    message: string;
    fieldErrors?: Record<string, string>;
    // On failure, what was submitted: React resets a form before every action, so controls
    // read defaultValue from here and nothing the person typed is lost
    values?: Record<string, string>;
    // Changes on every run, so a form can react to the same message twice
    at: number;
} | null;

// A problem the person can act on; its message is shown as is
export class ActionError extends Error {
    constructor(
        message: string,
        readonly fieldErrors?: Record<string, string>,
    ) {
        super(message);
        this.name = 'ActionError';
    }
}

export function done(message: string): ActionState {
    return { ok: true, message, at: Date.now() };
}

function pgError(error: unknown): { code?: string; hint?: string } | null {
    // Drizzle wraps the driver's error in `cause`
    for (let current = error, depth = 0; current && depth < 4; depth++) {
        const candidate = current as { code?: unknown; hint?: unknown; cause?: unknown };
        if (typeof candidate.code === 'string' && /^[0-9A-Z]{5}$/.test(candidate.code)) {
            return { code: candidate.code, hint: typeof candidate.hint === 'string' ? candidate.hint : undefined };
        }
        current = candidate.cause;
    }
    return null;
}

const STALE = 'Someone just changed this. Reload the page and try again.';

function submittedValues(formData: FormData | null): Record<string, string> | undefined {
    if (!formData) return undefined;
    const values: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
        if (!key.startsWith('$ACTION') && typeof value === 'string') values[key] = value;
    }
    return values;
}

// Runs an action body and turns every failure into a message the form can show
export async function runAction(formData: FormData | null, body: () => Promise<ActionState>): Promise<ActionState> {
    try {
        return await body();
    } catch (error) {
        const values = submittedValues(formData);
        // redirect() and notFound() work by throwing; let Next handle them
        if (error && typeof error === 'object' && 'digest' in error && typeof error.digest === 'string' && error.digest.startsWith('NEXT_')) {
            throw error;
        }
        if (error instanceof ActionError) {
            return { ok: false, message: error.message, fieldErrors: error.fieldErrors, values, at: Date.now() };
        }
        const pg = pgError(error);
        if (pg?.hint === 'bonsai:record_locked') {
            return { ok: false, message: 'This is part of the signed record, so it can no longer be changed or deleted.', values, at: Date.now() };
        }
        if (pg?.code === '23505' || pg?.hint === 'bonsai:bad_transition' || pg?.hint === 'bonsai:version_fixed') {
            return { ok: false, message: STALE, values, at: Date.now() };
        }
        if (pg?.code === '23503') {
            return { ok: false, message: 'Other records still point at this, so it cannot be removed.', values, at: Date.now() };
        }
        console.error('[portal action]', error);
        return { ok: false, message: 'Something went wrong on our side. Please try again.', values, at: Date.now() };
    }
}

/* ---------- Form parsing ---------- */

// FormData to a plain object: repeated names become arrays, empty strings stay as they are
function formObject(formData: FormData): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
        // React adds $ACTION_ fields for progressive enhancement
        if (key.startsWith('$ACTION')) continue;
        if (key in values) {
            const existing = values[key];
            values[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
        } else {
            values[key] = value;
        }
    }
    return values;
}

export function parseForm<S extends z.ZodType>(schema: S, formData: FormData): z.infer<S> {
    const result = schema.safeParse(formObject(formData));
    if (result.success) return result.data;
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
        const key = issue.path.join('.') || 'form';
        fieldErrors[key] ??= issue.message;
    }
    throw new ActionError('Check the highlighted fields and try again.', fieldErrors);
}

/* ---------- Field schemas shared by every form ---------- */

const trimmed = z.string().transform((value) => value.trim());

export const fields = {
    uuid: z.uuid({ error: 'This item could not be found. Reload the page.' }),
    requiredText: (label: string, max: number) =>
        trimmed.pipe(
            z
                .string()
                .min(1, { error: `Enter ${label}.` })
                .max(max, { error: `Keep ${label} under ${max} characters.` }),
        ),
    optionalText: (label: string, max: number) =>
        trimmed
            .pipe(z.string().max(max, { error: `Keep ${label} under ${max} characters.` }))
            .transform((value) => value || null),
    email: trimmed
        .transform((value) => value.toLowerCase())
        .pipe(z.email({ error: 'Enter a valid email address, such as name@company.com.' }).max(254)),
    // Links must be https: no javascript:, data: or plain http
    httpsUrl: trimmed.pipe(
        z.url({ protocol: /^https$/, error: 'Enter a full link that starts with https://' }).max(2000),
    ),
    optionalHttpsUrl: trimmed
        .pipe(
            z.union([
                z.literal(''),
                z.url({ protocol: /^https$/, error: 'Enter a full link that starts with https://' }).max(2000),
            ]),
        )
        .transform((value) => value || null),
    // <input type="date"> sends YYYY-MM-DD or an empty string
    optionalDate: trimmed
        .pipe(z.union([z.literal(''), z.iso.date({ error: 'Enter a valid date.' })]))
        .transform((value) => value || null),
    requiredDate: trimmed.pipe(z.iso.date({ error: 'Choose a date.' })),
    // Checkboxes send "on" when ticked and nothing otherwise
    checkbox: z
        .union([z.literal('on'), z.literal('true'), z.undefined()])
        .transform((value) => value !== undefined),
    file: z.instanceof(File, { error: 'Choose a file.' }),
};
