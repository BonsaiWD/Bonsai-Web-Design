import { sql } from 'drizzle-orm';
import {
    bigint,
    boolean,
    check,
    date,
    index,
    integer,
    pgEnum,
    pgTable,
    text,
    timestamp,
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

// Rate-limit counters live in the database so they hold across serverless instances
export const rateLimit = pgTable('rate_limit', {
    id: text('id').primaryKey(),
    key: text('key').notNull().unique(),
    count: integer('count').notNull(),
    lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});

/* ---------- Portal ---------- */

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
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [index('milestone_project_id_position_idx').on(t.projectId, t.position)],
);

export type ProjectStage = (typeof projectStage.enumValues)[number];
export type MilestoneStatus = (typeof milestoneStatus.enumValues)[number];
