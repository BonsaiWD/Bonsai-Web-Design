import 'server-only';
import { headers } from 'next/headers';
import { ipAddress } from '@vercel/functions';

// Where a decision came from, for the signed record. On Vercel x-real-ip is set at the edge
// and cannot be spoofed; locally there is none, so it is stored as empty.
export async function requestMeta(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
    const requestHeaders = await headers();
    const userAgent = requestHeaders.get('user-agent');
    return {
        ipAddress: ipAddress(requestHeaders) ?? null,
        userAgent: userAgent ? userAgent.slice(0, 512) : null,
    };
}
