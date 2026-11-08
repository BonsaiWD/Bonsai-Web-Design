/*
 * Neon's connection strings say sslmode=require. pg 8 already treats require (and prefer and
 * verify-ca) as verify-full, a full certificate and hostname check, and warns on every cold
 * start that pg 9 will weaken them to libpq's meaning. Naming verify-full keeps today's check
 * after that upgrade and ends the warning. Strings that opt into libpq semantics
 * (uselibpqcompat=true) or set another mode are left alone.
 */
export function withVerifiedSsl(connectionString: string): string {
    if (/[?&]uselibpqcompat=true(?:&|$)/i.test(connectionString)) return connectionString;
    return connectionString.replace(/([?&])sslmode=(?:prefer|require|verify-ca)(?=&|$)/i, '$1sslmode=verify-full');
}
