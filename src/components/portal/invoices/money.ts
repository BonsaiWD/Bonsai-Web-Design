// Invoice arithmetic shared by the editor (live totals) and the server (the stored record), so
// both always agree. Amounts are whole cents; quantities have at most two decimals.

export const MAX_UNIT_CENTS = 100_000_000; // $1,000,000.00 per unit
export const MAX_QUANTITY = 10_000;
export const MAX_LINES = 50;

// Half away from zero, as Postgres round() does, so any total worked out in SQL matches
function roundHalfAway(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

export function lineAmountCents(quantity: number, unitAmountCents: number): number {
  // Quantity in hundredths is an exact integer, so the product is exact before rounding
  const hundredths = Math.round(quantity * 100);
  return roundHalfAway((hundredths * unitAmountCents) / 100);
}

export function invoiceTotalCents(lines: { quantity: number; unitAmountCents: number }[]): number {
  return lines.reduce((sum, line) => sum + lineAmountCents(line.quantity, line.unitAmountCents), 0);
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

// "1,500", "$1500.5", "-200" (a discount line) to cents, without floating-point steps
export function parseDollars(input: string): Parsed<number> {
  const text = input.trim().replace(/^\$/, '').replace(/^-\s*\$/, '-');
  if (!text) return { ok: false, error: 'Enter a price.' };
  const match = /^(-)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return { ok: false, error: 'Enter a price such as 1200 or 1,200.50.' };
  const [, minus, whole, fraction = ''] = match;
  const cents = Number(whole.replace(/,/g, '')) * 100 + Number(fraction.padEnd(2, '0'));
  if (cents > MAX_UNIT_CENTS) return { ok: false, error: 'Keep each price under $1,000,000.' };
  return { ok: true, value: minus ? -cents : cents };
}

export function parseQuantity(input: string): Parsed<number> {
  const text = input.trim();
  if (!text) return { ok: false, error: 'Enter a quantity.' };
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return { ok: false, error: 'Use a number with up to 2 decimals.' };
  const value = Number(text);
  if (value <= 0) return { ok: false, error: 'Use a quantity above 0.' };
  if (value > MAX_QUANTITY) return { ok: false, error: `Keep the quantity under ${MAX_QUANTITY.toLocaleString('en-US')}.` };
  return { ok: true, value };
}

// What the editor shows for a saved price: "1200.00", no grouping, easy to edit
export function centsToInput(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

const quantityFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export function formatQuantity(quantity: number): string {
  return quantityFormat.format(quantity);
}
