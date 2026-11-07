import { createAuthClient } from 'better-auth/client';
import { magicLinkClient } from 'better-auth/client/plugins';

// Browser-side calls to /api/auth on the current origin
export const authClient = createAuthClient({
    plugins: [magicLinkClient()],
});
