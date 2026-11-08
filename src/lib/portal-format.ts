// Formatting shared by server and client components. Date-only values (due dates, launch
// dates) are calendar days and are formatted in UTC so every viewer sees the same day.

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const shortDayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const utcMomentFormat = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
});

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(isoDate: string): Date {
    return new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
}

// Today's calendar day in UTC, as YYYY-MM-DD; computed on the server and passed down
export function todayIso(now = new Date()): string {
    return now.toISOString().slice(0, 10);
}

// "2027-03-04" -> "Mar 4, 2027"
export function formatDate(isoDate: string): string {
    return dayFormat.format(utcDay(isoDate));
}

// "2027-03-04" -> "Mar 4"
export function formatShortDate(isoDate: string): string {
    return shortDayFormat.format(utcDay(isoDate));
}

// For calendar chips: { day: "4", month: "Mar" }
export function dateParts(isoDate: string): { day: string; month: string } {
    const date = utcDay(isoDate);
    return { day: String(date.getUTCDate()), month: monthFormat.format(date) };
}

export function daysBetween(fromIso: string, toIso: string): number {
    return Math.round((utcDay(toIso).getTime() - utcDay(fromIso).getTime()) / DAY_MS);
}

export type DueTone = 'overdue' | 'soon' | 'later';

// How a deadline reads relative to today: "Due today", "Due in 3 days", "2 days overdue"
export function dueInfo(isoDate: string, today: string): { label: string; tone: DueTone } {
    const days = daysBetween(today, isoDate);
    if (days < 0) return { label: `${-days} ${-days === 1 ? 'day' : 'days'} overdue`, tone: 'overdue' };
    if (days === 0) return { label: 'Due today', tone: 'soon' };
    if (days === 1) return { label: 'Due tomorrow', tone: 'soon' };
    if (days <= 7) return { label: `Due in ${days} days`, tone: 'soon' };
    return { label: `Due ${formatDate(isoDate)}`, tone: 'later' };
}

// A moment for emails and receipts, which have no viewer time zone: "Nov 8, 2026, 4:59 AM UTC"
export function formatUtcMoment(value: Date | string): string {
    return utcMomentFormat.format(typeof value === 'string' ? new Date(value) : value);
}

// Whole cents to "$1,500.00"
export function formatMoney(cents: number): string {
    return money.format(cents / 100);
}

// "Jane Doe" -> "JD"; falls back to the email's first letter
export function initials(nameOrEmail: string): string {
    const words = nameOrEmail.trim().split(/[\s@._-]+/).filter(Boolean);
    if (words.length === 0) return '?';
    if (nameOrEmail.includes('@') && !nameOrEmail.includes(' ')) return words[0][0].toUpperCase();
    return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}

export function plural(count: number, one: string, many = `${one}s`): string {
    return `${count} ${count === 1 ? one : many}`;
}

export function firstName(name: string | null | undefined): string | null {
    return name?.trim().split(/\s+/)[0] || null;
}
