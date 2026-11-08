// The sections of a project, in tab order. Shared by server and client code.
export const PROJECT_TABS = [
  { key: 'overview', label: 'Overview', path: '' },
  { key: 'milestones', label: 'Milestones', path: '/milestones' },
  { key: 'deliverables', label: 'Deliverables', path: '/deliverables' },
  { key: 'contracts', label: 'Contracts', path: '/contracts' },
  { key: 'messages', label: 'Messages', path: '/messages' },
  { key: 'invoices', label: 'Invoices', path: '/invoices' },
  { key: 'files', label: 'Files', path: '/files' },
] as const;

export type ProjectTab = (typeof PROJECT_TABS)[number]['key'];

// "/portal/projects/<id>/deliverables#deliverable-<id>"
export function projectHref(projectId: string, tab: ProjectTab = 'overview', anchor?: string): string {
  const path = PROJECT_TABS.find((t) => t.key === tab)?.path ?? '';
  return `/portal/projects/${projectId}${path}${anchor ? `#${anchor}` : ''}`;
}
