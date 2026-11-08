import 'server-only';
import type { PortalFeature } from '../attention';

// Stub: the messages feature fills this in (attention items and deadlines for dashboards and badges)
export const messagesFeature: PortalFeature = {
    attention: async () => [],
    deadlines: async () => [],
};
