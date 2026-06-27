import { describe, it, expect, beforeAll } from 'vitest';
import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '$lib/server/db/schema';
import { user, tradingAccount } from '$lib/server/db/schema';
import {
	saveMappingTemplate,
	listMappingTemplates,
	getMappingTemplate,
	deleteMappingTemplate
} from './mapping-templates';
import { importCsv } from './import';
import { listTrades } from './trades';
import type { DB } from '$lib/server/db';

let db: DB;
const USER = 'user-tpl';
const ACCOUNT = 'acct-tpl';

beforeAll(async () => {
	const client = new PGlite();
	const pdb = drizzle(client, { schema });
	await migrate(pdb, { migrationsFolder: 'drizzle' });
	db = pdb as unknown as DB;
	await db.insert(user).values({ id: USER, name: 'T', email: 't@tradex.dev' });
	await db.insert(user).values({ id: 'intruder', name: 'I', email: 'i2@tradex.dev' });
	await db
		.insert(tradingAccount)
		.values({ id: ACCOUNT, userId: USER, name: 'T', assetClasses: ['stock'] });
});

describe('import mapping templates', () => {
	it('saves, lists, re-saves (replace by name), gets and deletes', async () => {
		const map = { symbol: 'Ticker', side: 'B/S', qty: 'Filled', price: 'Avg', executedAt: 'Time' };
		const id = await saveMappingTemplate(db, USER, {
			broker: 'Wonkybroker',
			name: 'My broker',
			columnMap: map
		});
		let list = await listMappingTemplates(db, USER);
		expect(list).toHaveLength(1);
		expect(list[0]!.columnMap).toEqual(map);

		// re-save with the same name updates instead of duplicating
		const id2 = await saveMappingTemplate(db, USER, {
			broker: 'Wonkybroker',
			name: 'My broker',
			columnMap: { ...map, fee: 'Comm' }
		});
		expect(id2).toBe(id);
		list = await listMappingTemplates(db, USER);
		expect(list).toHaveLength(1);
		expect(list[0]!.columnMap.fee).toBe('Comm');

		// the SAME name under a DIFFERENT broker is a distinct template, not a clobber
		const id3 = await saveMappingTemplate(db, USER, {
			broker: 'OtherBroker',
			name: 'My broker',
			columnMap: map
		});
		expect(id3).not.toBe(id);
		expect(await listMappingTemplates(db, USER)).toHaveLength(2);
		await deleteMappingTemplate(db, USER, id3);

		const got = await getMappingTemplate(db, USER, id);
		expect(got?.broker).toBe('Wonkybroker');

		// isolation
		expect(await getMappingTemplate(db, 'intruder', id)).toBeNull();
		expect(await deleteMappingTemplate(db, 'intruder', id)).toBe(false);

		expect(await deleteMappingTemplate(db, USER, id)).toBe(true);
		expect(await listMappingTemplates(db, USER)).toHaveLength(0);
	});

	it('imports a CSV with non-standard headers using an explicit mapping', async () => {
		// headers a template would map; auto-detect would miss "Ticker"/"B/S"
		const csv = `Ticker,B/S,Filled,Avg,Time
ZZZZ,BOT,10,100,2026-06-01T14:30:00Z
ZZZZ,SLD,10,105,2026-06-01T15:30:00Z`;
		const res = await importCsv(db, {
			accountId: ACCOUNT,
			csvText: csv,
			defaultAssetClass: 'stock',
			mapping: { symbol: 'Ticker', side: 'B/S', qty: 'Filled', price: 'Avg', executedAt: 'Time' }
		});
		expect(res.errors).toHaveLength(0);
		expect(res.importedCount).toBe(2);
		const trades = await listTrades(db, ACCOUNT, { symbol: 'ZZZZ' });
		expect(trades).toHaveLength(1);
		expect(trades[0]!.status).toBe('closed');
	});
});
