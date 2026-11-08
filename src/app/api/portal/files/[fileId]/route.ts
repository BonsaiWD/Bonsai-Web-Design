import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { deliverableVersion, file, project } from '@/db/schema';
import { getPortalSession, isAdmin, isUuid } from '@/server/portal/access';
import { INLINE_TYPES, readStoredFile, safeFilename } from '@/server/portal/storage';

const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });

// Every download is authorised here: files live in private storage and have no public URL
export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
    const { fileId } = await params;
    const session = await getPortalSession();
    if (!session) return new Response('Sign in to download this file.', { status: 401, headers: { 'Cache-Control': 'no-store' } });
    if (!isUuid(fileId)) return notFound();

    const admin = isAdmin(session.user);
    const [row] = await getDb()
        .select({
            filename: file.filename,
            contentType: file.contentType,
            sizeBytes: file.sizeBytes,
            storageKey: file.storageKey,
            removedAt: file.removedAt,
        })
        .from(file)
        .innerJoin(project, eq(project.id, file.projectId))
        .where(
            and(
                eq(file.id, fileId),
                admin ? undefined : eq(project.clientId, session.user.id),
                // A deliverable file is the client's only while its version is: once the studio
                // withdraws that version, an old link or download stops working for them
                admin
                    ? undefined
                    : sql`(${file.purpose} <> 'deliverable' OR EXISTS (
                        SELECT 1 FROM ${deliverableVersion}
                        WHERE ${deliverableVersion.fileId} = ${file.id} AND ${deliverableVersion.status} <> 'withdrawn'
                    ))`,
            ),
        )
        .limit(1);
    // A removed file stays available to the studio, which may need it for the record
    if (!row || (row.removedAt && !admin)) return notFound();

    const stream = await readStoredFile(row.storageKey);
    if (!stream) return notFound();

    const inline = new URL(request.url).searchParams.get('inline') === '1' && INLINE_TYPES.has(row.contentType);
    const name = safeFilename(row.filename);
    return new Response(stream, {
        headers: {
            'Content-Type': row.contentType,
            'Content-Length': String(row.sizeBytes),
            'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'private, no-store',
            // No scripts or outside requests either way. Downloads are sandboxed too; a previewed
            // PDF is not, because Chrome refuses to render PDFs in a sandbox (images and PDFs
            // are the only inline types, and neither can run script in this origin).
            'Content-Security-Policy': `default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'${inline ? '' : '; sandbox'}`,
        },
    });
}
