import { describe, it, expect, beforeAll } from 'vitest';
import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '$lib/server/db/schema';
import { user, tradingAccount, shareLink } from '$lib/server/db/schema';
import { addManualTrade } from './trades';
import { createTradeShare, getSharedTrade, listTradeShares, revokeShareLink } from './sharing';
import { toScaled } from '$lib/money';
import type { DB } from '$lib/server/db';

let db: DB;
const USER = 'user-share';
const ACCOUNT = 'acct-share';
let tradeId: string;

beforeAll(async () => {
	const client = new PGlite();
	const pdb = drizzle(client, { schema });
	await migrate(pdb, { migrationsFolder: 'drizzle' });
	db = pdb as unknown as DB;
	await db.insert(user).values({ id: USER, name: 'S', email: 's@tradex.dev' });
	await db.insert(user).values({ id: 'intruder', name: 'I', email: 'i@tradex.dev' });
	await db
		.insert(tradingAccount)
		.values({ id: ACCOUNT, userId: USER, name: 'S', assetClasses: ['stock'], baseCurrency: 'USD' });
	tradeId = await addManualTrade(db, {
		accountId: ACCOUNT,
		symbol: 'AAPL',
		assetClass: 'stock',
		direction: 'long',
		qty: toScaled(100),
		entryPrice: toScaled(100),
		exitPrice: toScaled(110),
		entryAt: Date.UTC(2026, 5, 1, 14, 30),
		exitAt: Date.UTC(2026, 5, 1, 15, 30),
		fees: 0,
		plannedStop: toScaled(95) // gives the trade a defined risk → an R-multiple
	});
});

describe('trade sharing', () => {
	it('creates a public link that resolves to the trade', async () => {
		const res = await createTradeShare(db, USER, tradeId);
		expect('token' in res).toBe(true);
		const token = (res as { token: string }).token;
		const shared = await getSharedTrade(db, token);
		expect(shared?.symbol).toBe('AAPL');
		expect(shared?.netPnl).not.toBeNull();
		expect(shared?.qty).not.toBeNull();
		expect(shared?.rMultiple).not.toBeNull();
	});

	it('honours scope: hidden size and P&L are nulled, R-multiple still shown', async () => {
		const res = await createTradeShare(db, USER, tradeId, {
			scope: { hideSize: true, hidePnl: true }
		});
		const token = (res as { token: string }).token;
		const shared = await getSharedTrade(db, token);
		expect(shared?.netPnl).toBeNull();
		expect(shared?.qty).toBeNull();
		// hidePnl must hide the whole OUTCOME, not just the dollar figure —
		// the R-multiple and exit price would otherwise reveal it.
		expect(shared?.rMultiple).toBeNull();
		expect(shared?.avgExit).toBeNull();
		expect(shared?.avgEntry).toBeGreaterThan(0); // the entry/thesis still shows
		expect(shared?.scope).toEqual({ hideSize: true, hidePnl: true });
	});

	it('keeps the outcome visible when nothing is hidden', async () => {
		const res = await createTradeShare(db, USER, tradeId);
		const shared = await getSharedTrade(db, (res as { token: string }).token);
		expect(shared?.rMultiple).not.toBeNull();
		expect(shared?.avgExit).not.toBeNull();
		expect(shared?.netPnl).not.toBeNull();
	});

	it('returns null for an expired link', async () => {
		await db.insert(shareLink).values({
			userId: USER,
			tradeId,
			token: 'expired-token-xyz',
			scope: {},
			expiresAt: Date.now() - 1000
		});
		expect(await getSharedTrade(db, 'expired-token-xyz')).toBeNull();
	});

	it('returns null for an unknown token', async () => {
		expect(await getSharedTrade(db, 'nope-not-a-real-token')).toBeNull();
	});

	it("refuses to share another user's trade", async () => {
		const res = await createTradeShare(db, 'intruder', tradeId);
		expect(res).toEqual({ error: 'not-owned' });
	});

	it('lists and revokes links (scoped to the owner)', async () => {
		const before = await listTradeShares(db, USER, tradeId);
		expect(before.length).toBeGreaterThan(0);
		// an intruder cannot revoke the owner's link
		expect(await revokeShareLink(db, 'intruder', before[0]!.id)).toBe(false);
		// the owner can
		expect(await revokeShareLink(db, USER, before[0]!.id)).toBe(true);
		const after = await listTradeShares(db, USER, tradeId);
		expect(after.length).toBe(before.length - 1);
	});
});
