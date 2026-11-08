import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// A segment's not-found.tsx only renders for notFound() thrown under it; a URL no route matches
// goes to the app's root 404, outside the portal. This catches every /portal/* path that no
// route matches (a mistyped tab, /portal/projects, /portal/admin) and hands it to
// portal/not-found.tsx, inside the portal shell. Static and [projectId] routes are more
// specific, so they still win.
export const metadata: Metadata = { title: 'Page not found' };

export default function PortalUnmatched() {
  notFound();
}
