import { sql } from 'drizzle-orm';
import {
    bigint,
    boolean,
    check,
    date,
    index,
    integer,
    numeric,
    pgEnum,
    pgSequence,
    pgTable,
    primaryKey,
    text,
    timestamp,
    unique,
    uniqueIndex,
    uuid,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
    timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date());

/* ---------- Better Auth ----------
   Property names are the field names Better Auth expects. The database defaults on
   `user` let you add a client by hand in the Neon console with only a name and email. */

export const userRole = pgEnum('user_role', ['client', 'admin']);

export const user = pgTable(
    'user',
    {
        id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
        name: text('name').notNull().default(''),
        email: text('email').notNull().unique(),
        emailVerified: boolean('email_verified').notNull().default(false),
        image: text('image'),
        role: userRole('role').notNull().default('client'),
        // The client's business, shown to the studio beside their name
        company: text('company'),
        // Set on every sign-in, so the studio can see whether an invite was ever used
        lastSignInAt: timestamp('last_sign_in_at', { withTimezone: true }),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    // Better Auth looks addresses up in lowercase, so a mixed-case row could never sign in
    (t) => [check('user_email_lowercase', sql`${t.email} = lower(${t.email})`)],
);

export const session = pgTable(
    'session',
    {
        id: text('id').primaryKey(),
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        token: text('token').notNull().unique(),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
        ipAddress: text('ip_address'),
        userAgent: text('user_agent'),
        userId: text('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
    },
    (t) => [index('session_user_id_idx').on(t.userId)],
);

export const account = pgTable(
    'account',
    {
        id: text('id').primaryKey(),
        accountId: text('account_id').notNull(),
        providerId: text('provider_id').notNull(),
        userId: text('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        accessToken: text('access_token'),
        refreshToken: text('refresh_token'),
        idToken: text('id_token'),
        accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
        refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
        scope: text('scope'),
        password: text('password'),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [index('account_user_id_idx').on(t.userId)],
);

export const verification = pgTable(
    'verification',
    {
        id: text('id').primaryKey(),
        identifier: text('identifier').notNull(),
        value: text('value').notNull(),
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [index('verification_identifier_idx').on(t.identifier)],
);

// Rate-limit counters live in the database so they hold across serverless instances.
// The portal adds its own keys here too (prefixed "portal:") for per-address email caps.
export const rateLimit = pgTable('rate_limit', {
    id: text('id').primaryKey(),
    key: text('key').notNull().unique(),
    count: integer('count').notNull(),
    lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});

/* ---------- Projects and milestones ---------- */

export const projectStage = pgEnum('project_stage', [
    'discovery',
    'design',
    'development',
    'review',
    'launched',
    'on_hold',
]);

export const milestoneStatus = pgEnum('milestone_status', [
    'upcoming',
    'in_progress',
    'waiting_on_client',
    'done',
]);

// Who made a recorded decision: the client in the portal, or the studio on the client's
// word given elsewhere (an email, a call)
export const decisionSource = pgEnum('decision_source', ['client', 'studio']);

export const project = pgTable(
    'project',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        // Restrict: deleting a client must not silently delete their project history
        clientId: text('client_id')
            .notNull()
            .references(() => user.id, { onDelete: 'restrict' }),
        name: text('name').notNull(),
        summary: text('summary'),
        stage: projectStage('stage').notNull().default('discovery'),
        targetLaunch: date('target_launch', { mode: 'string' }),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [index('project_client_id_idx').on(t.clientId)],
);

export const milestone = pgTable(
    'milestone',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        projectId: uuid('project_id')
            .notNull()
            .references(() => project.id, { onDelete: 'cascade' }),
        title: text('title').notNull(),
        description: text('description'),
        status: milestoneStatus('status').notNull().default('upcoming'),
        dueDate: date('due_date', { mode: 'string' }),
        // Milestones are listed in ascending position order
        position: integer('position').notNull().default(0),
        // The studio has asked the client to initial this milestone off
        requiresSignoff: boolean('requires_signoff').notNull().default(false),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [index('milestone_project_id_position_idx').on(t.projectId, t.position)],
);

// A client's initials on a milestone. Rows are a record: the database refuses to change
// or delete them (see the guard trigger in the migration).
export const milestoneSignoff = pgTable(
    'milestone_signoff',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        milestoneId: uuid('milestone_id')
            .notNull()
            .unique()
            .references(() => milestone.id, { onDelete: 'restrict' }),
        projectId: uuid('project_id')
            .notNull()
            .references(() => project.id, { onDelete: 'restrict' }),
        source: decisionSource('source').notNull(),
        signerId: text('signer_id')
            .notNull()
            .references(() => user.id, { onDelete: 'restrict' }),
        signerEmail: text('signer_email').notNull(),
        // The initials the client typed; empty when the studio recorded it
        initials: text('initials'),
        // The exact sentence the client confirmed, with the milestone title at that moment
        statement: text('statement').notNull(),
        note: text('note'),
        ipAddress: text('ip_address'),
        userAgent: text('user_agent'),
        signedAt: timestamp('signed_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        index('milestone_signoff_project_id_idx').on(t.projectId),
        check(
            'milestone_signoff_evidence',
            sql`(${t.source} = 'client' AND ${t.initials} IS NOT NULL) OR (${t.source} = 'studio' AND ${t.note} IS NOT NULL)`,
        ),
    ],
);

/* ---------- Files ---------- */

export const filePurpose = pgEnum('file_purpose', ['deliverable', 'contract', 'invoice', 'project_file']);

// Uploaded files live in private storage (Vercel Blob); this row is how the portal finds,
// authorises and verifies them. sha256 pins the exact bytes a signature or approval covered.
export const file = pgTable(
    'file',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        projectId: uuid('project_id')
            .notNull()
            .references(() => project.id, { onDelete: 'cascade' }),
        purpose: filePurpose('purpose').notNull(),
        uploadedBy: text('uploaded_by')
            .notNull()
            .references(() => user.id, { onDelete: 'restrict' }),
        filename: text('filename').notNull(),
        contentType: text('content_type').notNull(),
        sizeBytes: integer('size_bytes').notNull(),
        sha256: text('sha256').notNull(),
        storageKey: text('storage_key').notNull().unique(),
        // Files in the shared Files section can be hidden from it without losing the bytes
        // a record points at
        removedAt: timestamp('removed_at', { withTimezone: true }),
        createdAt: createdAt(),
    },
    (t) => [index('file_project_id_idx').on(t.projectId)],
);

/* ---------- Deliverables ---------- */

export const versionStatus = pgEnum('version_status', [
    'in_review',
    'approved',
    'changes_requested',
    'delivered',
    'superseded',
    // Taken back by the studio before any decision (a wrong link, shared too early)
    'withdrawn',
]);

export const deliverable = pgTable(
    'deliverable',
    {
        // Generated by the share form, so a double submit inserts nothing new
        id: uuid('id').primaryKey().defaultRandom(),
        projectId: uuid('project_id')
            .notNull()
            .references(() => project.id, { onDelete: 'cascade' }),
        // Approving every deliverable linked to a milestone marks it done
        milestoneId: uuid('milestone_id').references(() => milestone.id, { onDelete: 'set null' }),
        title: text('title').notNull(),
        description: text('description'),
        // The highest version number handed out; sharing bumps it under a row lock
        latestVersion: integer('latest_version').notNull().default(0),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [index('deliverable_project_id_idx').on(t.projectId)],
);

export const deliverableVersion = pgTable(
    'deliverable_version',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        deliverableId: uuid('deliverable_id')
            .notNull()
            .references(() => deliverable.id, { onDelete: 'cascade' }),
        version: integer('version').notNull(),
        // Copied at share time, so a later rename does not change what was approved
        titleSnapshot: text('title_snapshot').notNull(),
        // A link to this exact version, an uploaded file, or both
        linkUrl: text('link_url'),
        fileId: uuid('file_id').references(() => file.id),
        note: text('note'),
        needsApproval: boolean('needs_approval').notNull(),
        status: versionStatus('status').notNull(),
        reviewBy: date('review_by', { mode: 'string' }),
        sharedBy: text('shared_by')
            .notNull()
            .references(() => user.id, { onDelete: 'restrict' }),
        sharedAt: timestamp('shared_at', { withTimezone: true }).notNull().defaultNow(),
        // Set by the guard trigger from the database clock when a decision lands
        decidedAt: timestamp('decided_at', { withTimezone: true }),
        decidedBy: text('decided_by').references(() => user.id, { onDelete: 'restrict' }),
        decisionSource: decisionSource('decision_source'),
        signedName: text('signed_name'),
        signerEmail: text('signer_email'),
        statement: text('statement'),
        decisionNote: text('decision_note'),
        ipAddress: text('ip_address'),
        userAgent: text('user_agent'),
    },
    (t) => [
        unique('deliverable_version_number_unique').on(t.deliverableId, t.version),
        // At most one version of a deliverable is in review: in review means latest
        uniqueIndex('deliverable_version_one_in_review')
            .on(t.deliverableId)
            .where(sql`${t.status} = 'in_review'`),
        check('deliverable_version_has_content', sql`${t.linkUrl} IS NOT NULL OR ${t.fileId} IS NOT NULL`),
        check(
            'deliverable_version_decision_shape',
            sql`(${t.status} IN ('approved', 'changes_requested')) = (${t.decidedAt} IS NOT NULL AND ${t.decidedBy} IS NOT NULL AND ${t.decisionSource} IS NOT NULL AND ${t.signerEmail} IS NOT NULL AND ${t.statement} IS NOT NULL)`,
        ),
        check(
            'deliverable_version_decision_evidence',
            sql`${t.status} NOT IN ('approved', 'changes_requested') OR (${t.decisionSource} = 'client' AND (${t.status} = 'changes_requested' OR ${t.signedName} IS NOT NULL)) OR (${t.decisionSource} = 'studio' AND ${t.decisionNote} IS NOT NULL)`,
        ),
        check(
            'deliverable_version_changes_have_note',
            sql`${t.status} <> 'changes_requested' OR ${t.decisionNote} IS NOT NULL`,
        ),
    ],
);

/* ---------- Contracts ---------- */

export const documentFileLabel = pgEnum('document_file_label', [
    'original',
    'client_signed',
    'countersigned',
    'other',
]);

export const contract = pgTable(
    'contract',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        projectId: uuid('project_id')
            .notNull()
            .references(() => project.id, { onDelete: 'cascade' }),
        title: text('title').notNull(),
        description: text('description'),
        // Whether the client is asked to sign; reference documents need no signature
        requiresSignature: boolean('requires_signature').notNull().default(true),
        createdBy: text('created_by')
            .notNull()
            .references(() => user.id, { onDelete: 'restrict' }),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [index('contract_project_id_idx').on(t.projectId)],
);

export const contractFile = pgTable(
    'contract_file',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        contractId: uuid('contract_id')
            .notNull()
            .references(() => contract.id, { onDelete: 'cascade' }),
        fileId: uuid('file_id')
            .notNull()
            .references(() => file.id),
        label: documentFileLabel('label').notNull(),
        uploadedBy: text('uploaded_by')
            .notNull()
            .references(() => user.id, { onDelete: 'restrict' }),
        createdAt: createdAt(),
    },
    (t) => [index('contract_file_contract_id_idx').on(t.contractId)],
);

// The client's acceptance of a contract, pinned to the exact file and its sha256. A record:
// the database refuses to change or delete it.
export const contractSignature = pgTable(
    'contract_signature',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        contractId: uuid('contract_id')
            .notNull()
            .unique()
            .references(() => contract.id, { onDelete: 'restrict' }),
        projectId: uuid('project_id')
            .notNull()
            .references(() => project.id, { onDelete: 'restrict' }),
        fileId: uuid('file_id')
            .notNull()
            .references(() => file.id),
        fileSha256: text('file_sha256').notNull(),
        source: decisionSource('source').notNull(),
        signerId: text('signer_id')
            .notNull()
            .references(() => user.id, { onDelete: 'restrict' }),
        signerEmail: text('signer_email').notNull(),
        // The full name the client typed; empty when the studio recorded a signature made elsewhere
        signedName: text('signed_name'),
        statement: text('statement').notNull(),
        note: text('note'),
        ipAddress: text('ip_address'),
        userAgent: text('user_agent'),
        signedAt: timestamp('signed_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        check(
            'contract_signature_evidence',
            sql`(${t.source} = 'client' AND ${t.signedName} IS NOT NULL) OR (${t.source} = 'studio' AND ${t.note} IS NOT NULL)`,
        ),
    ],
);

/* ---------- Messages ---------- */

export const message = pgTable(
    'message',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        projectId: uuid('project_id')
            .notNull()
            .references(() => project.id, { onDelete: 'cascade' }),
        authorId: text('author_id')
            .notNull()
            .references(() => user.id, { onDelete: 'restrict' }),
        body: text('body').notNull(),
        // Internal notes are for the studio only and never reach the client
        internal: boolean('internal').notNull().default(false),
        createdAt: createdAt(),
    },
    (t) => [index('message_project_id_created_at_idx').on(t.projectId, t.createdAt)],
);

// When each person last read a project's messages, for unread counts
export const projectReadState = pgTable(
    'project_read_state',
    {
        userId: text('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        projectId: uuid('project_id')
            .notNull()
            .references(() => project.id, { onDelete: 'cascade' }),
        messagesReadAt: timestamp('messages_read_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [primaryKey({ columns: [t.userId, t.projectId] })],
);

/* ---------- Invoices ---------- */

export const paymentMethod = pgEnum('payment_method', ['bitcoin', 'monero', 'litecoin', 'zelle', 'ach', 'venmo']);

export const invoiceStatus = pgEnum('invoice_status', ['draft', 'sent', 'payment_reported', 'paid', 'void']);

// Invoice numbers count up across all projects: BWD-0001, BWD-0002, ...
export const invoiceNumberSeq = pgSequence('invoice_number_seq', { startWith: 1 });

export const invoice = pgTable(
    'invoice',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        projectId: uuid('project_id')
            .notNull()
            .references(() => project.id, { onDelete: 'restrict' }),
        number: text('number')
            .notNull()
            .unique()
            .default(sql`'BWD-' || lpad(nextval('invoice_number_seq')::text, 4, '0')`),
        title: text('title').notNull(),
        status: invoiceStatus('status').notNull().default('draft'),
        issuedOn: date('issued_on', { mode: 'string' }),
        dueOn: date('due_on', { mode: 'string' }),
        notes: text('notes'),
        // What the client said they sent, before the studio confirms it arrived
        reportedMethod: paymentMethod('reported_method'),
        reportedReference: text('reported_reference'),
        reportedAt: timestamp('reported_at', { withTimezone: true }),
        paidOn: date('paid_on', { mode: 'string' }),
        paidMethod: paymentMethod('paid_method'),
        paidReference: text('paid_reference'),
        createdBy: text('created_by')
            .notNull()
            .references(() => user.id, { onDelete: 'restrict' }),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [
        index('invoice_project_id_idx').on(t.projectId),
        check('invoice_sent_has_dates', sql`${t.status} = 'draft' OR (${t.issuedOn} IS NOT NULL AND ${t.dueOn} IS NOT NULL)`),
        check('invoice_paid_has_details', sql`${t.status} <> 'paid' OR (${t.paidOn} IS NOT NULL AND ${t.paidMethod} IS NOT NULL)`),
    ],
);

export const invoiceItem = pgTable(
    'invoice_item',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        invoiceId: uuid('invoice_id')
            .notNull()
            .references(() => invoice.id, { onDelete: 'cascade' }),
        description: text('description').notNull(),
        quantity: numeric('quantity', { precision: 10, scale: 2, mode: 'number' }).notNull().default(1),
        // Whole cents, so totals never pick up floating-point drift
        unitAmountCents: integer('unit_amount_cents').notNull(),
        position: integer('position').notNull().default(0),
    },
    (t) => [
        index('invoice_item_invoice_id_idx').on(t.invoiceId),
        check('invoice_item_quantity_positive', sql`${t.quantity} > 0`),
    ],
);

// How clients can pay, edited on the studio's settings page and shown on every sent invoice
export const paymentMethodSetting = pgTable('payment_method_setting', {
    method: paymentMethod('method').primaryKey(),
    enabled: boolean('enabled').notNull().default(false),
    // Wallet address, Zelle email or phone, bank details, Venmo handle
    instructions: text('instructions').notNull().default(''),
    updatedAt: updatedAt(),
});

/* ---------- Activity ---------- */

export const activityVisibility = pgEnum('activity_visibility', ['everyone', 'studio']);
export const emailStatus = pgEnum('email_status', ['sent', 'failed', 'skipped']);

// What happened on a project, newest first: the project timeline, the studio's feed, and
// the place a failed notification email shows up instead of vanishing
export const activity = pgTable(
    'activity',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        projectId: uuid('project_id')
            .notNull()
            .references(() => project.id, { onDelete: 'cascade' }),
        actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
        kind: text('kind').notNull(),
        summary: text('summary').notNull(),
        // A path inside the project, such as "deliverables", for linking to the item
        target: text('target'),
        visibility: activityVisibility('visibility').notNull().default('everyone'),
        emailTo: text('email_to'),
        emailStatus: emailStatus('email_status'),
        createdAt: createdAt(),
    },
    (t) => [index('activity_project_id_created_at_idx').on(t.projectId, t.createdAt)],
);

export type ProjectStage = (typeof projectStage.enumValues)[number];
export type MilestoneStatus = (typeof milestoneStatus.enumValues)[number];
export type VersionStatus = (typeof versionStatus.enumValues)[number];
export type InvoiceStatus = (typeof invoiceStatus.enumValues)[number];
export type PaymentMethod = (typeof paymentMethod.enumValues)[number];
export type FilePurpose = (typeof filePurpose.enumValues)[number];
export type ContractFileLabel = (typeof documentFileLabel.enumValues)[number];
