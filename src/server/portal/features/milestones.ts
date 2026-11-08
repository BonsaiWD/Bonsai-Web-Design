import 'server-only';
import type { PortalFeature } from '../attention';

// Stub: the milestones feature fills this in (attention items and deadlines for dashboards and badges)
export const milestonesFeature: PortalFeature = {
    attention: async () => [],
    deadlines: async () => [],
};
