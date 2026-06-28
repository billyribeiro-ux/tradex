import { describe, it, expect, beforeAll } from 'vitest';
import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import { user, tradingAccount, instrument, optionContract, trade } from '$lib/server/db/schema';
import { addManualTrade, listTrades } from './trades';
import { importCsv } from './import';
import { toScaled, fromScaled } from '$lib/money';
import type { DB } from '$lib/server/db';

let db: DB;
const USER = 'user-opt';
const ACCOUNT = 'acct-opt';

const callOpt = (strike: number) => ({
	type: 'call' as const,
	strike: toScaled(strike),
	expiry: Date.UTC(2026, 8, 18)
});

beforeAll(async () => {
	const client = new PGlite();
	const pdb = drizzle(client, { schema });
	await migrate(pdb, { migrationsFolder: 'drizzle' });
	db = pdb as unknown as DB;
	await db.insert(user).values({ id: USER, name: 'O', email: 'o@tradex.dev' });
	await db
		.insert(tradingAccount)
		.values({ id: ACCOUNT, userId: USER, name: 'O', assetClasses: ['option'] });
});

describe('single-leg options', () => {
	it('records a contract, applies the 100× multiplier, and links the contract', async () => {
		const id = await addManualTrade(db, {
			accountId: ACCOUNT,
			symbol: 'AAPL',
			assetClass: 'option',
			direction: 'long',
			qty: toScaled(2), // 2 contracts
			entryPrice: toScaled(5),
			exitPrice: toScaled(6),
			entryAt: Date.UTC(2026, 5, 10, 14, 30),
			exitAt: Date.UTC(2026, 5, 10, 15, 30),
			fees: toScaled(1.3),
			option: callOpt(190)
		});

		const [t] = await db.select().from(trade).where(eq(trade.id, id));
		// P&L = (6 − 5) × 2 contracts × 100 multiplier − $1.30 fees = $198.70
		expect(fromScaled(t!.grossPnl)).toBe(200);
		expect(fromScaled(t!.netPnl)).toBeCloseTo(198.7, 5);
		expect(t!.optionContractId).not.toBeNull();

		// instrument identity is the canonical contract label, with a 100× multiplier
		const [inst] = await db.select().from(instrument).where(eq(instrument.id, t!.instrumentId));
		expect(inst!.symbol).toBe('AAPL 190C 18SEP26');
		expect(inst!.assetClass).toBe('option');
		expect(fromScaled(inst!.multiplier)).toBe(100);

		// the structured contract is stored against the underlying
		const [oc] = await db
			.select()
			.from(optionContract)
			.where(eq(optionContract.id, t!.optionContractId!));
		expect(oc!.type).toBe('call');
		expect(fromScaled(oc!.strike)).toBe(190);
	});

	it('keeps different strikes as separate trades (no incorrect netting)', async () => {
		await addManualTrade(db, {
			accountId: ACCOUNT,
			symbol: 'TSLA',
			assetClass: 'option',
			direction: 'long',
			qty: toScaled(1),
			entryPrice: toScaled(4),
			exitPrice: toScaled(7),
			entryAt: Date.UTC(2026, 5, 11, 14, 30),
			exitAt: Date.UTC(2026, 5, 11, 15, 30),
			option: { type: 'call', strike: toScaled(250), expiry: Date.UTC(2026, 8, 18) }
		});
		await addManualTrade(db, {
			accountId: ACCOUNT,
			symbol: 'TSLA',
			assetClass: 'option',
			direction: 'long',
			qty: toScaled(1),
			entryPrice: toScaled(2),
			exitPrice: toScaled(1),
			entryAt: Date.UTC(2026, 5, 11, 14, 35),
			exitAt: Date.UTC(2026, 5, 11, 15, 35),
			option: { type: 'call', strike: toScaled(260), expiry: Date.UTC(2026, 8, 18) }
		});

		const tslas = (await listTrades(db, ACCOUNT, { limit: 50 })).filter((t) =>
			t.symbol.startsWith('TSLA')
		);
		// two DISTINCT contracts → two trades, not one merged position
		expect(tslas).toHaveLength(2);
		expect(new Set(tslas.map((t) => t.symbol)).size).toBe(2);
	});

	it('imports an OCC option symbol from CSV as a multiplier-correct contract', async () => {
		const csv = `Symbol,Side,Qty,Price,Date
AAPL240920C00190000,Buy,1,5.00,2026-06-01T14:30:00Z
AAPL240920C00190000,Sell,1,6.50,2026-06-01T15:30:00Z`;
		const res = await importCsv(db, {
			accountId: ACCOUNT,
			csvText: csv,
			defaultAssetClass: 'stock' // OCC detection overrides this to option
		});
		expect(res.errors).toHaveLength(0);
		expect(res.importedCount).toBe(2);

		const occTrade = (await listTrades(db, ACCOUNT, { limit: 50 })).find(
			(t) => t.symbol === 'AAPL 190C 20SEP24'
		);
		expect(occTrade).toBeDefined();
		expect(occTrade!.assetClass).toBe('option');
		expect(occTrade!.optionContractId).not.toBeNull();
		// (6.50 − 5.00) × 1 contract × 100 = $150
		expect(fromScaled(occTrade!.netPnl)).toBe(150);
	});
});
