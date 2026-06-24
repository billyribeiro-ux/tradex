import { drizzle as drizzlePostgres, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import postgres from 'postgres';
import { PGlite } from '@electric-sql/pglite';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

/**
 * Production points DATABASE_URL at Postgres (Neon) over the wire protocol.
 * Anything else (e.g. `pglite://.pgdata`) uses an in-process PGlite database, so
 * local dev and tests need no external server. The query API is identical.
 */
const isPostgres = /^postgres(ql)?:\/\//.test(env.DATABASE_URL);

export const db: PostgresJsDatabase<typeof schema> = isPostgres
	? drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }), { schema })
	: (drizzlePglite(new PGlite(env.DATABASE_URL.replace(/^pglite:\/\//, '') || '.pgdata'), {
			schema
		}) as unknown as PostgresJsDatabase<typeof schema>);

/** The Drizzle client type — the dependency the service layer is written against. */
export type DB = typeof db;
