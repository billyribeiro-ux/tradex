import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = createClient({
	url: env.DATABASE_URL,
	authToken: env.DATABASE_AUTH_TOKEN // set when pointing at Turso; ignored for local files
});

export const db = drizzle(client, { schema });

/** The Drizzle client type — the dependency the service layer is written against. */
export type DB = typeof db;
