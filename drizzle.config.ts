import { defineConfig } from 'drizzle-kit';

// drizzle-kit does not read Next's env files; `vercel env pull .env.local` writes this one
try {
    process.loadEnvFile('.env.local');
} catch {
    // No file: rely on variables already in the shell
}

export default defineConfig({
    dialect: 'postgresql',
    schema: './src/db/schema.ts',
    out: './drizzle',
    dbCredentials: {
        // Neon recommends its direct (unpooled) connection for schema migrations
        url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
    },
});
