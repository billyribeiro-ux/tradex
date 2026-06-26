import { describe, it, expect, beforeAll } from 'vitest';
import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '$lib/server/db/schema';
import { user, tradingAccount } from '$lib/server/db/schema';
import { addManualTrade } from './trades';
import {
	applyCategorization,
	listCategorization,
	renameTag,
	deleteTag,
	renameSetup,
	deleteSetup,
	getTradeCategorization
} from './categorization';
import { toScaled } from '$lib/money';
import type { DB } from '$lib/server/db';

let db: DB;
const USER = 'user-cat';
const ACCOUNT = 'acct-cat';

async function makeTrade(symbol: string, day: number) {
	return addManualTrade(db, {
		accountId: ACCOUNT,
		symbol,
		assetClass: 'stock',
		direction: 'long',
		qty: toScaled(10),
		entryPrice: toScaled(100),
		exitPrice: toScaled(110),
		entryAt: Date.UTC(2026, 5, day, 14, 30),
		exitAt: Date.UTC(2026, 5, day, 15, 30),
		fees: 0
	});
}

beforeAll(async () => {
	const client = new PGlite();
	const pdb = drizzle(client, { schema });
	await migrate(pdb, { migrationsFolder: 'drizzle' });
	db = pdb as unknown as DB;
	await db.insert(user).values({ id: USER, name: 'Cat', email: 'cat@tradex.dev' });
	await db
		.insert(tradingAccount)
		.values({ id: ACCOUNT, userId: USER, name: 'Cat', assetClasses: ['stock'] });
});

describe('categorization management', () => {
	it('lists tags/setups/emotions with usage counts, then renames, merges and deletes', async () => {
		const t1 = await makeTrade('AAA', 1);
		const t2 = await makeTrade('BBB', 2);
		await applyCategorization(db, USER, t1, {
			setupName: 'ORB',
			emotionLabel: 'Calm',
			tagNames: ['momentum', 'gap']
		});
		await applyCategorization(db, USER, t2, {
			setupName: 'ORB',
			emotionLabel: 'FOMO',
			tagNames: ['momentum']
		});

		let cat = await listCategorization(db, USER);
		expect(cat.tags.find((t) => t.name === 'momentum')?.count).toBe(2);
		expect(cat.tags.find((t) => t.name === 'gap')?.count).toBe(1);
		expect(cat.setups.find((s) => s.name === 'ORB')?.count).toBe(2);
		expect(cat.emotions.map((e) => e.name).sort()).toEqual(['Calm', 'FOMO']);

		// rename a tag (count unchanged)
		const momentumId = cat.tags.find((t) => t.name === 'momentum')!.id;
		expect((await renameTag(db, USER, momentumId, 'momo')).ok).toBe(true);
		cat = await listCategorization(db, USER);
		expect(cat.tags.find((t) => t.name === 'momo')?.count).toBe(2);
		expect(cat.tags.find((t) => t.name === 'momentum')).toBeUndefined();

		// rename "gap" onto "momo" -> merge (gap was on t1, which already has momo)
		const gapId = cat.tags.find((t) => t.name === 'gap')!.id;
		const merged = await renameTag(db, USER, gapId, 'momo');
		expect(merged).toEqual({ ok: true, merged: true });
		cat = await listCategorization(db, USER);
		expect(cat.tags.map((t) => t.name)).toEqual(['momo']);
		expect(cat.tags[0]!.count).toBe(2); // still on t1 + t2, no double-count

		// merge setups: rename a second setup onto ORB re-points its trade
		await applyCategorization(db, USER, t2, { setupName: 'Breakout' });
		cat = await listCategorization(db, USER);
		const breakoutId = cat.setups.find((s) => s.name === 'Breakout')!.id;
		expect((await renameSetup(db, USER, breakoutId, 'ORB')).merged).toBe(true);
		cat = await listCategorization(db, USER);
		expect(cat.setups.find((s) => s.name === 'ORB')?.count).toBe(2);
		expect(cat.setups.find((s) => s.name === 'Breakout')).toBeUndefined();

		// delete a tag -> removed from trades
		await deleteTag(db, USER, cat.tags.find((t) => t.name === 'momo')!.id);
		expect((await getTradeCategorization(db, t1)).tagNames).toEqual([]);

		// delete a setup -> trades' setupId set null (FK), trade keeps its emotion
		const orbId = (await listCategorization(db, USER)).setups.find((s) => s.name === 'ORB')!.id;
		await deleteSetup(db, USER, orbId);
		const after = await getTradeCategorization(db, t1);
		expect(after.setupName).toBeNull();
		expect(after.emotionLabel).toBe('Calm');
	});

	it('refuses to touch another user’s items', async () => {
		await db.insert(user).values({ id: 'intruder', name: 'X', email: 'x@tradex.dev' });
		const t = await makeTrade('CCC', 3);
		await applyCategorization(db, USER, t, { setupName: 'Private', tagNames: ['secret'] });
		const cat = await listCategorization(db, USER);
		const secret = cat.tags.find((t) => t.name === 'secret')!;
		// intruder cannot rename or delete the owner's tag
		expect((await renameTag(db, 'intruder', secret.id, 'hacked')).ok).toBe(false);
		expect(await deleteTag(db, 'intruder', secret.id)).toBe(false);
		expect(
			(await listCategorization(db, USER)).tags.find((t) => t.name === 'secret')
		).toBeDefined();
	});
});
