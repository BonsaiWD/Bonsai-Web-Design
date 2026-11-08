'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminActor, safePortalPath, VIEW_COOKIE } from '@/server/portal/access';

// Switches an admin between the studio view and the client's view of the portal. The
// cookie only changes what pages render; actions always check the real role.
export async function setPortalView(formData: FormData) {
    await adminActor();
    const store = await cookies();
    if (formData.get('mode') === 'client') {
        store.set(VIEW_COOKIE, 'client', {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/portal',
            maxAge: 60 * 60 * 8,
        });
    } else {
        store.delete({ name: VIEW_COOKIE, path: '/portal' });
    }
    const back = safePortalPath(formData.get('back')) ?? '/portal';
    // Studio-only pages have no client version, so previewing from one starts at the dashboard
    const studioOnly = back.startsWith('/portal/admin') || /^\/portal\/projects\/[^/]+\/settings/.test(back);
    redirect(formData.get('mode') === 'client' && studioOnly ? '/portal' : back);
}
