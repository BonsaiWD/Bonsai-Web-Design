// Sentences and link checks shared by the browser and the server. The server rebuilds the
// statement from the database, so what is stored is exactly what the client confirmed.

export function approvalStatement(version: number, title: string): string {
  return `I approve version ${version} of ${title}.`;
}

export function changesStatement(version: number, title: string): string {
  return `I asked for changes to version ${version} of ${title}.`;
}

export function studioApprovalStatement(version: number, title: string, clientName: string, recordedBy: string): string {
  return `${recordedBy} recorded for the studio that ${clientName} approved version ${version} of ${title} outside the portal.`;
}

function parse(value: string): URL | null {
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
}

export function linkHost(value: string): string | null {
  return parse(value)?.hostname.replace(/^www\./, '') ?? null;
}

const isFigma = (host: string) => host === 'figma.com' || host.endsWith('.figma.com');

// Advice, not a block: some links change after they are shared, so a later approval would
// not cover what the client actually saw
export function linkWarning(value: string): string | null {
  const url = parse(value);
  if (!url || url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase();
  if (host.endsWith('.vercel.app') && host.includes('-git-')) {
    return 'This looks like a branch link, which changes with every push. Use the deployment URL for this exact version.';
  }
  if (isFigma(host) && !url.searchParams.has('version-id')) {
    return 'This Figma link has no version in it, so it will show later edits too. Save a version in Figma and copy the link from its version history.';
  }
  return null;
}

// What the client is about to open, said plainly
export function linkLabel(value: string): string {
  const host = parse(value)?.hostname.toLowerCase() ?? '';
  if (host.endsWith('.vercel.app')) return 'Open the site';
  return 'Open the design';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
