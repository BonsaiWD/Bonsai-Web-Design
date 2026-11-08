import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { get, put } from '@vercel/blob';
import { getDb } from '@/db';
import { file, type FilePurpose } from '@/db/schema';
import { ActionError } from './actions';

// Vercel functions accept request bodies up to 4.5 MB; leave room for the rest of the form
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

// Documents and images a studio and its clients exchange. Anything else is refused, and
// every download is served as an attachment, so a file can never run in the portal's origin.
const ALLOWED_TYPES: Record<string, string[]> = {
    'application/pdf': ['pdf'],
    'image/png': ['png'],
    'image/jpeg': ['jpg', 'jpeg'],
    'image/webp': ['webp'],
    'image/gif': ['gif'],
    'application/zip': ['zip'],
    'application/x-zip-compressed': ['zip'],
    'text/plain': ['txt'],
    'text/csv': ['csv'],
    'application/msword': ['doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
    'application/vnd.ms-excel': ['xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
};

export const ACCEPTED_EXTENSIONS = [...new Set(Object.values(ALLOWED_TYPES).flat())].map((ext) => `.${ext}`).join(',');

// Types a browser may show inline (the download route adds a sandboxing CSP)
export const INLINE_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']);

const LOCAL_ROOT = path.join(process.cwd(), '.data', 'uploads');

// A connected Blob store gives the project either a read-write token or, on newer
// connections, a store id that the SDK pairs with Vercel's OIDC token; accept both
export function blobConfigured(): boolean {
    return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function storageMode(): 'blob' | 'local' {
    if (blobConfigured()) return 'blob';
    if (process.env.NODE_ENV !== 'production') return 'local';
    throw new ActionError('File uploads are not set up yet. Connect a Vercel Blob store to the project, then try again.');
}

// A filename safe for storage keys and Content-Disposition, keeping its extension
export function safeFilename(name: string): string {
    const base = path.basename(name).normalize('NFKD').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-');
    return (base.replace(/^[.-]+/, '') || 'file').slice(-120);
}

function checkFile(upload: File): { contentType: string; extension: string } {
    if (!upload || upload.size === 0) throw new ActionError('Choose a file to upload.', { file: 'Choose a file to upload.' });
    if (upload.size > MAX_UPLOAD_BYTES) {
        const message = 'Files can be up to 4 MB. For larger files, share a link instead.';
        throw new ActionError(message, { file: message });
    }
    const extension = path.extname(upload.name).slice(1).toLowerCase();
    const contentType = upload.type || 'application/octet-stream';
    const allowed = ALLOWED_TYPES[contentType];
    if (!allowed || !allowed.includes(extension)) {
        const message = 'That file type is not accepted. Use PDF, an image, a Word, Excel or PowerPoint file, a text file or a ZIP.';
        throw new ActionError(message, { file: message });
    }
    return { contentType, extension };
}

/**
 * Stores an uploaded file privately and records it. Returns the file row; its sha256 pins the
 * exact bytes for any signature or approval that refers to it.
 */
export async function storeUpload(options: {
    projectId: string;
    purpose: FilePurpose;
    uploadedBy: string;
    upload: File;
}) {
    const { contentType } = checkFile(options.upload);
    const mode = storageMode();
    const bytes = Buffer.from(await options.upload.arrayBuffer());
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const filename = safeFilename(options.upload.name);
    const storageKey = `projects/${options.projectId}/${randomUUID()}/${filename}`;

    if (mode === 'blob') {
        await put(storageKey, bytes, { access: 'private', contentType, addRandomSuffix: false });
    } else {
        const target = path.join(LOCAL_ROOT, storageKey);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, bytes, { flag: 'wx' });
    }

    const [row] = await getDb()
        .insert(file)
        .values({
            projectId: options.projectId,
            purpose: options.purpose,
            uploadedBy: options.uploadedBy,
            filename: options.upload.name.slice(0, 200),
            contentType,
            sizeBytes: bytes.length,
            sha256,
            storageKey,
        })
        .returning();
    return row;
}

// The stored bytes as a web stream, for the download route
export async function readStoredFile(storageKey: string): Promise<ReadableStream<Uint8Array> | null> {
    if (blobConfigured()) {
        const result = await get(storageKey, { access: 'private' });
        return (result?.stream as ReadableStream<Uint8Array> | undefined) ?? null;
    }
    if (process.env.NODE_ENV === 'production') return null;
    const target = path.join(LOCAL_ROOT, storageKey);
    // Keys are generated by storeUpload, but never follow one outside the uploads folder
    if (!target.startsWith(LOCAL_ROOT + path.sep)) return null;
    try {
        await stat(target);
    } catch {
        return null;
    }
    return Readable.toWeb(createReadStream(target)) as ReadableStream<Uint8Array>;
}
