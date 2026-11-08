import 'server-only';
import { cache } from 'react';
import { todayIso } from '@/lib/portal-format';
import { getViewer } from './access';
import { perspectiveOf, sortAttention, sortDeadlines, type FeatureContext, type PortalFeature } from './attention';
import { contractsFeature } from './features/contracts';
import { deliverablesFeature } from './features/deliverables';
import { filesFeature } from './features/files';
import { invoicesFeature } from './features/invoices';
import { messagesFeature } from './features/messages';
import { milestonesFeature } from './features/milestones';
import { projectsFeature } from './features/projects';

const FEATURES: PortalFeature[] = [
    projectsFeature,
    milestonesFeature,
    deliverablesFeature,
    contractsFeature,
    messagesFeature,
    invoicesFeature,
    filesFeature,
];

export const featureContext = cache(async (projectId?: string): Promise<FeatureContext> => {
    const viewer = await getViewer();
    return { viewer, perspective: perspectiveOf(viewer), projectId, today: todayIso() };
});

// Everything waiting on the viewer (or, for the studio, on the studio), most urgent first
export const collectAttention = cache(async (projectId?: string) => {
    const context = await featureContext(projectId);
    const lists = await Promise.all(FEATURES.map((feature) => feature.attention?.(context) ?? Promise.resolve([])));
    return sortAttention(lists.flat());
});

// Upcoming and overdue dates across the visible projects, soonest first
export const collectDeadlines = cache(async (projectId?: string) => {
    const context = await featureContext(projectId);
    const lists = await Promise.all(FEATURES.map((feature) => feature.deadlines?.(context) ?? Promise.resolve([])));
    return sortDeadlines(lists.flat());
});
