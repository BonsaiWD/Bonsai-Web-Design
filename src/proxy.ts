import { NextResponse, type NextRequest } from 'next/server';

// Passes the requested portal path to server components, so a signed-out visitor can be
// sent back to the exact page (a deliverable from an email, say) after signing in
export function proxy(request: NextRequest) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-portal-path', request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
    matcher: '/portal/:path*',
};
