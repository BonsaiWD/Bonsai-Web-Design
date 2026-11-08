import 'server-only';
import type { PortalFeature } from '../attention';

// Stub: the invoices feature fills this in (attention items and deadlines for dashboards and badges)
export const invoicesFeature: PortalFeature = {
    attention: async () => [],
    deadlines: async () => [],
};
