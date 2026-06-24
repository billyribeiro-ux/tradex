// Applies committed Drizzle migrations to the configured database.
// Local dev uses in-process PGlite; production uses Postgres (Neon).
// Run with: node --env-file-if-exists=.env scripts/migrate.mjs

const url = process.env.DATABASE_URL ?? 'pglite://.pgdata';
const isPostgres = /^postgres(ql)?:\/\//.test(url);

if (isPostgres) {
	const postgres = (await import('postgres')).default;
	const { drizzle } = await import('drizzle-orm/postgres-js');
	const { migrate } = await import('drizzle-orm/postgres-js/migrator');
	const sql = postgres(url, { max: 1 });
	await migrate(drizzle(sql), { migrationsFolder: 'drizzle' });
	await sql.end();
} else {
	const { PGlite } = await import('@electric-sql/pglite');
	const { drizzle } = await import('drizzle-orm/pglite');
	const { migrate } = await import('drizzle-orm/pglite/migrator');
	const dir = url.replace(/^pglite:\/\//, '') || '.pgdata';
	const client = new PGlite(dir);
	await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
	await client.close();
}
console.log(`Migrations applied to ${url}`);
