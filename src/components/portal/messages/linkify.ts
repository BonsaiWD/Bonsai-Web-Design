// Splits a message into text and https links. Nothing in a message is ever rendered as HTML:
// links are found in the plain text and rendered as React elements, and only addresses that
// parse as https URLs with a real host become links.

export type Segment = { kind: 'text'; text: string } | { kind: 'link'; text: string; href: string };

const URL_PATTERN = /https:\/\/[^\s<>"'`]+/gi;
const TRAILING = /[.,;:!?'"*_~]+$/;
const PAIRS = [
  ['(', ')'],
  ['[', ']'],
  ['{', '}'],
] as const;

const occurrences = (text: string, char: string) => text.split(char).length - 1;

// "(see https://example.com/a)." keeps the link's own brackets but not the sentence's
function trimUrl(raw: string): string {
  let url = raw;
  for (;;) {
    const before = url;
    url = url.replace(TRAILING, '');
    for (const [open, close] of PAIRS) {
      while (url.endsWith(close) && occurrences(url, close) > occurrences(url, open)) url = url.slice(0, -1);
    }
    if (url === before) return url;
  }
}

function safeHref(candidate: string): string | null {
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' || !parsed.hostname.includes('.') || parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function linkify(text: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  const push = (value: string) => {
    if (!value) return;
    const last = segments[segments.length - 1];
    if (last?.kind === 'text') last.text += value;
    else segments.push({ kind: 'text', text: value });
  };
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const url = trimUrl(match[0]);
    const href = safeHref(url);
    push(text.slice(cursor, start));
    if (href) segments.push({ kind: 'link', text: url, href });
    else push(url);
    cursor = start + url.length;
  }
  push(text.slice(cursor));
  return segments;
}
