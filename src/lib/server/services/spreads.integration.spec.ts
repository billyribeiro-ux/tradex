import { describe, it, expect, beforeAll } from 'vitest';
import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import { user, tradingAccount, instrument, trade } from '$lib/server/db/schema';
import { createMultiLegTrade, getMultiLegGroup } from './spreads';
import { regroupInstrument } from './trades';
import { toScaled, fromScaled } from '$lib/money';
import type { DB } from '$lib/server/db';

let db: DB;
const USER = 'user-spread';
const ACCOUNT = 'acct-spread';
const EXP = Date.UTC(2026, 8, 18);

beforeAll(async () => {
	const client = new PGlite();
	const pdb = drizzle(client, { schema });
	await migrate(pdb, { migrationsFolder: 'drizzle' });
	db = pdb as unknown as DB;
	await db.insert(user).values({ id: USER, name: 'S', email: 's@tradex.dev' });
	await db
		.insert(tradingAccount)
		.values({ id: ACCOUNT, userId: USER, name: 'S', assetClasses: ['option'] });
});

describe('multi-leg spreads', () => {
	it('records a closed bull call spread with two linked, multiplier-correct legs', async () => {
		const { groupId, tradeIds, strategy } = await createMultiLegTrade(db, {
			accountId: ACCOUNT,
			underlying: 'AAPL',
			entryAt: Date.UTC(2026, 5, 10, 14, 30),
			exitAt: Date.UTC(2026, 5, 12, 15, 0),
			legs: [
				// buy 100C @ $5 → exit $8
				{
					type: 'call',
					side: 'buy',
					strike: toScaled(100),
					expiry: EXP,
					qty: toScaled(1),
					entryPremium: toScaled(5),
					exitPremium: toScaled(8)
				},
				// sell 110C @ $2 → exit $4
				{
					type: 'call',
					side: 'sell',
					strike: toScaled(110),
					expiry: EXP,
					qty: toScaled(1),
					entryPremium: toScaled(2),
					exitPremium: toScaled(4)
				}
			]
		});

		expect(strategy).toBe('Bull Call Spread');
		expect(tradeIds).toHaveLength(2);

		// both legs carry the group id
		const legTrades = await db.select().from(trade).where(eq(trade.multiLegGroupId, groupId));
		expect(legTrades).toHaveLength(2);
		for (const lt of legTrades) {
			const [inst] = await db.select().from(instrument).where(eq(instrument.id, lt.instrumentId));
			expect(inst!.assetClass).toBe('option');
			expect(fromScaled(inst!.multiplier)).toBe(100);
		}

		// realized: long leg (8−5)×100 = +$300, short leg (2−4)×100 = −$200 → +$100
		const detail = await getMultiLegGroup(db, ACCOUNT, groupId);
		expect(detail).not.toBeNull();
		expect(detail!.classification.key).toBe('vertical');
		expect(fromScaled(detail!.realized.netPnl)).toBe(100);
		expect(detail!.realized.status).toBe('closed');

		// entry risk: $300 debit, max loss $300, max profit ($10 width × 100) − $300 = $700
		expect(detail!.risk.kind).toBe('debit');
		expect(fromScaled(detail!.risk.net)).toBe(300);
		expect(fromScaled(detail!.risk.maxLoss!)).toBe(300);
		expect(fromScaled(detail!.risk.maxProfit!)).toBe(700);

		// legs are ordered by strike for display
		expect(detail!.legs.map((l) => fromScaled(l.contract.strike))).toEqual([100, 110]);
	});

	it('records a four-leg iron condor as four distinct contracts under one group', async () => {
		const { groupId, tradeIds, strategy } = await createMultiLegTrade(db, {
			accountId: ACCOUNT,
			underlying: 'SPY',
			entryAt: Date.UTC(2026, 5, 11, 14, 30),
			legs: [
				{
					type: 'put',
					side: 'buy',
					strike: toScaled(480),
					expiry: EXP,
					qty: toScaled(1),
					entryPremium: toScaled(0.5)
				},
				{
					type: 'put',
					side: 'sell',
					strike: toScaled(490),
					expiry: EXP,
					qty: toScaled(1),
					entryPremium: toScaled(1)
				},
				{
					type: 'call',
					side: 'sell',
					strike: toScaled(510),
					expiry: EXP,
					qty: toScaled(1),
					entryPremium: toScaled(1)
				},
				{
					type: 'call',
					side: 'buy',
					strike: toScaled(520),
					expiry: EXP,
					qty: toScaled(1),
					entryPremium: toScaled(0.5)
				}
			]
		});

		expect(strategy).toBe('Iron Condor');
		expect(tradeIds).toHaveLength(4);

		const detail = await getMultiLegGroup(db, ACCOUNT, groupId);
		expect(detail!.legs).toHaveLength(4);
		// four distinct option instruments
		expect(new Set(detail!.legs.map((l) => l.instrument.symbol)).size).toBe(4);
		expect(detail!.realized.status).toBe('open'); // no exits provided

		// net credit = (−1 − 1 + 0.5 + 0.5) × 100 = −$100 → max profit $100, max loss $900
		expect(detail!.risk.kind).toBe('credit');
		expect(fromScaled(detail!.risk.maxProfit!)).toBe(100);
		expect(fromScaled(detail!.risk.maxLoss!)).toBe(900);
	});

	it('isolates groups by account (no cross-account read)', async () => {
		const { groupId } = await createMultiLegTrade(db, {
			accountId: ACCOUNT,
			underlying: 'NVDA',
			entryAt: Date.UTC(2026, 5, 13, 14, 30),
			legs: [
				{
					type: 'put',
					side: 'sell',
					strike: toScaled(100),
					expiry: EXP,
					qty: toScaled(1),
					entryPremium: toScaled(3)
				},
				{
					type: 'put',
					side: 'buy',
					strike: toScaled(90),
					expiry: EXP,
					qty: toScaled(1),
					entryPremium: toScaled(1)
				}
			]
		});
		expect(await getMultiLegGroup(db, 'someone-else', groupId)).toBeNull();
	});

	it('splits fees across legs so the structure total is preserved once closed', async () => {
		const { groupId } = await createMultiLegTrade(db, {
			accountId: ACCOUNT,
			underlying: 'QQQ',
			entryAt: Date.UTC(2026, 5, 14, 14, 30),
			exitAt: Date.UTC(2026, 5, 15, 14, 30),
			fees: toScaled(3), // 3 dollars across 2 legs (entry+exit) → fully realized once closed
			legs: [
				{
					type: 'call',
					side: 'buy',
					strike: toScaled(400),
					expiry: EXP,
					qty: toScaled(1),
					entryPremium: toScaled(5),
					exitPremium: toScaled(6)
				},
				{
					type: 'call',
					side: 'sell',
					strike: toScaled(410),
					expiry: EXP,
					qty: toScaled(1),
					entryPremium: toScaled(2),
					exitPremium: toScaled(2.5)
				}
			]
		});
		const detail = await getMultiLegGroup(db, ACCOUNT, groupId);
		expect(detail!.realized.status).toBe('closed');
		expect(fromScaled(detail!.realized.fees)).toBe(3);
	});

	it("preserves a leg's group link when its instrument is re-derived (re-import)", async () => {
		const { groupId } = await createMultiLegTrade(db, {
			accountId: ACCOUNT,
			underlying: 'AMD',
			entryAt: Date.UTC(2026, 5, 16, 14, 30),
			legs: [
				{
					type: 'call',
					side: 'buy',
					strike: toScaled(150),
					expiry: EXP,
					qty: toScaled(1),
					entryPremium: toScaled(4)
				},
				{
					type: 'call',
					side: 'sell',
					strike: toScaled(160),
					expiry: EXP,
					qty: toScaled(1),
					entryPremium: toScaled(2)
				}
			]
		});
		const before = await db.select().from(trade).where(eq(trade.multiLegGroupId, groupId));
		expect(before).toHaveLength(2);

		// Re-derive each leg's instrument (what a re-import triggers). The group link
		// is not part of the recomputed columns, so it must survive the upsert.
		for (const leg of before) await regroupInstrument(db, ACCOUNT, leg.instrumentId);

		const after = await db.select().from(trade).where(eq(trade.multiLegGroupId, groupId));
		expect(after).toHaveLength(2);
		expect(await getMultiLegGroup(db, ACCOUNT, groupId)).not.toBeNull();
	});
});
