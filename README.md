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

Clients sign in at `/portal` with an emailed link (no passwords) and see their projects, stage and milestones. It runs on Neon Postgres through Drizzle ORM, with Better Auth for sign-in and Resend for the emails.

### One-time setup

1. In Vercel, open the project's **Storage** tab, create a **Neon** database on the free plan (Washington, D.C. region, Neon Auth off: the portal has its own sign-in) and connect it to this project for Development, Preview and Production with no variable prefix. That adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
2. Add `BETTER_AUTH_SECRET` to the project's environment variables (all three environments). Generate a value with `openssl rand -base64 32`.
3. Pull the variables and create the tables:
   ```bash
   vercel env pull .env.local
   npm run db:migrate
   ```
   Or, with no local setup, paste `drizzle/0000_init_portal.sql` into the Neon console's SQL Editor and run it, then record it as applied so a later `npm run db:migrate` skips it instead of failing:
   ```sql
   create schema if not exists drizzle;
   create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint);
   insert into drizzle.__drizzle_migrations (hash, created_at)
     values ('2342745be1c1c9ffde533f0daa952135452e766319183618945faff6ce5787e9', 1794094917133);
   ```
4. Add yourself as an admin (below), redeploy (new variables only reach new deployments), and sign in at `/portal`. Admins see every client's projects.

If the Neon integration creates a database branch for each preview deployment, those branches copy production, so migrate production first.

### Adding clients, projects and milestones

Until the portal has its own admin screens, add rows in the Neon console (Tables or SQL Editor). Emails must be lowercase; the database rejects anything else.

```sql
-- You, as an admin
insert into "user" (name, email, role) values ('Your name', 'you@bonsaiwebdesign.com', 'admin');

-- A client and their project
insert into "user" (name, email) values ('Jane Doe', 'jane@example.com');
insert into project (client_id, name, summary, stage, target_launch)
  select id, 'Website redesign', 'A five-page site with online booking.', 'design', '2027-03-01'
  from "user" where email = 'jane@example.com';

-- Milestones, listed in position order
insert into milestone (project_id, title, status, due_date, position)
  select id, 'Design direction', 'in_progress', '2026-12-01', 1
  from project where name = 'Website redesign';
```

- Project `stage`: `discovery`, `design`, `development`, `review`, `launched`, `on_hold`
- Milestone `status`: `upcoming`, `in_progress`, `waiting_on_client` (shown to the client as "Waiting on you"), `done`

Only addresses already in the `user` table are sent a link; anyone else sees the same "check your email" reply and nothing is sent.

### Local development

With no `RESEND_API_KEY` in `.env.local`, `npm run dev` prints sign-in links to the terminal instead of emailing them. To change the schema, edit `src/db/schema.ts`, run `npm run db:generate`, commit the new file in `drizzle/`, then run `npm run db:migrate`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
