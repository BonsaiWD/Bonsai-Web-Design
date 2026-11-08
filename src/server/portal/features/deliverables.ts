import 'server-only';
import type { PortalFeature } from '../attention';

// Stub: the deliverables feature fills this in (attention items and deadlines for dashboards and badges)
export const deliverablesFeature: PortalFeature = {
    attention: async () => [],
    deadlines: async () => [],
};
