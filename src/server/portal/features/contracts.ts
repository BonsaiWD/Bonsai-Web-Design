import 'server-only';
import type { PortalFeature } from '../attention';

// Stub: the contracts feature fills this in (attention items and deadlines for dashboards and badges)
export const contractsFeature: PortalFeature = {
    attention: async () => [],
    deadlines: async () => [],
};
