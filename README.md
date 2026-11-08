This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Client portal

Clients sign in at `/portal` with an emailed link (no passwords). Each project has an overview, milestones with deadlines and initial sign-offs, deliverables with versioned approvals, contracts to download and sign, private messages, invoices with your payment methods, and a shared file library. The studio runs everything from the same screens: clients, new projects, project settings and payment settings live under the portal's Clients and Settings pages, and **View as client** shows any page exactly as the client sees it.

It runs on Neon Postgres through Drizzle ORM, Better Auth for sign-in, Resend for email and a private Vercel Blob store for uploaded files.

### One-time setup

1. **Database.** In Vercel, open **Storage**, create a **Neon** database on the free plan (Washington, D.C., Neon Auth off) and connect it to this project for Development, Preview and Production with no variable prefix. That adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
2. **Sign-in secret.** Add `BETTER_AUTH_SECRET` to the project's environment variables for all three environments. Generate it with `openssl rand -base64 32`.
3. **File storage.** In **Storage**, create a **Blob** store with **Private** access and connect it to the project for all three environments. That adds `BLOB_READ_WRITE_TOKEN`. Without it, everything but uploads works, and upload forms say storage is not set up.
4. **Tables.** Apply the migrations in `drizzle/` in order, either with `vercel env pull .env.local && npm run db:migrate`, or by pasting each file into the Neon console's SQL Editor followed by its bookkeeping row (see below).
5. **Admin account.** `insert into "user" (name, email, role) values ('Your name', 'you@bonsaiwebdesign.com', 'admin');` Then redeploy, because new environment variables only reach new deployments.

Applying a migration by hand: wrap the file in `BEGIN; ... COMMIT;` and add, before `COMMIT`, a row recording it so a later `npm run db:migrate` skips it:

```sql
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('<sha256 of the file>', <the file's "when" in drizzle/meta/_journal.json>);
```

`sha256sum drizzle/<file>.sql` gives the hash. The first migration also needs `create schema if not exists drizzle; create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint);` first.

### Signed records

Milestone sign-offs, deliverable approvals and change requests, and contract signatures are permanent: the database refuses to change or delete them, and each records the exact statement shown, who signed, when (from the database clock) and, for files, the file's SHA-256. The signer also gets an emailed receipt. Projects or clients with records cannot be deleted or reassigned; set the stage to On hold instead.

To remove test data, including records: `select purge_project('<project id>');` in the SQL Editor, then delete the test user if you like. Uploaded file bytes in Blob are not removed by this.

### Email

Every email comes from admin@bonsaiwebdesign.com and links to the portal page, never to an outside link. Previews share the production database, so a preview only emails bonsaiwebdesign.com addresses; a plus address such as `admin+demo@bonsaiwebdesign.com` makes a good test client. Each send is recorded on the project's activity, and a failed email is flagged on the studio dashboard.

### Local development

With no `RESEND_API_KEY` in `.env.local`, `npm run dev` prints emails (including sign-in links) to the terminal, and with no `BLOB_READ_WRITE_TOKEN`, uploads are kept in `.data/uploads`. To change the schema, edit `src/db/schema.ts`, run `npm run db:generate`, commit the new file in `drizzle/`, then run `npm run db:migrate`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
