import 'server-only';
import type { PortalFeature } from '../attention';

// Stub: the files feature fills this in (attention items and deadlines for dashboards and badges)
export const filesFeature: PortalFeature = {
    attention: async () => [],
    deadlines: async () => [],
};
