import { attachDatabasePool } from '@vercel/functions';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

function createDb() {
    // Neon's pooled connection string; read at first use so a missing value fails the
    // request that needs it instead of the whole build
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is not set');
    }
    const pool = new Pool({ connectionString });
    // Lets Vercel close idle clients before a function instance is suspended
    attachDatabasePool(pool);
    return drizzle({ client: pool, schema });
}

let db: ReturnType<typeof createDb> | undefined;

export function getDb() {
    db ??= createDb();
    return db;
}
