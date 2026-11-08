import 'server-only';
import type { PortalFeature } from '../attention';

// Stub: the projects feature fills this in (attention items and deadlines for dashboards and badges)
export const projectsFeature: PortalFeature = {
    attention: async () => [],
    deadlines: async () => [],
};
