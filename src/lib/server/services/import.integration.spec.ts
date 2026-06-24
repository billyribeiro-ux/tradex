import { describe, it, expect, beforeAll } from 'vitest';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { eq } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import { user, tradingAccount, trade } from '$lib/server/db/schema';
import { importCsv } from './import';
import { listTrades } from './trades';
import { getDashboard } from './analytics';
import { fromScaled } from '$lib/money';
import type { DB } from '$lib/server/db';

/**
 * End-to-end exercise of the real server pipeline against an in-memory libSQL
 * database using the committed migrations: CSV -> map -> dedupe -> persist ->
 * group -> trades -> dashboard metrics.
 */
let db: DB;
const ACCOUNT = 'acct-1';

beforeAll(async () => {
	const client = createClient({ url: ':memory:' });
	db = drizzle(client, { schema });
	await migrate(db, { migrationsFolder: 'drizzle' });
	await db.insert(user).values({ id: 'user-1', name: 'Test', email: 'test@tradex.dev' });
	await db
		.insert(tradingAccount)
		.values({ id: ACCOUNT, userId: 'user-1', name: 'Test', assetClasses: ['stock'] });
});

const CSV = `Symbol,Side,Quantity,Price,Commission,Date
AAPL,Buy,100,150.00,1.00,2026-06-01T14:30:00Z
AAPL,Sell,100,155.00,1.00,2026-06-01T15:30:00Z
TSLA,Sell,50,250.00,1.00,2026-06-02T14:30:00Z
TSLA,Buy,50,240.00,1.00,2026-06-02T16:30:00Z
bad,row,here,xx,,nope`;

describe('CSV import → grouping → metrics (integration)', () => {
	it('imports valid rows, reports the bad one, and groups round trips', async () => {
		const res = await importCsv(db, {
			accountId: ACCOUNT,
			csvText: CSV,
			defaultAssetClass: 'stock'
		});
		expect(res.importedCount).toBe(4); // 4 valid executions
		expect(res.errors.length).toBe(1); // 1 malformed row, file still imported
		expect(res.errors[0]!.row).toBe(6);

		const trades = await listTrades(db, ACCOUNT);
		expect(trades).toHaveLength(2);

		const aapl = trades.find((t) => t.symbol === 'AAPL')!;
		expect(aapl.direction).toBe('long');
		expect(aapl.status).toBe('closed');
		expect(fromScaled(aapl.grossPnl)).toBe(500); // 100 * (155-150)
		expect(fromScaled(aapl.netPnl)).toBe(498); // minus 2.00 fees

		const tsla = trades.find((t) => t.symbol === 'TSLA')!;
		expect(tsla.direction).toBe('short');
		expect(fromScaled(tsla.grossPnl)).toBe(500); // 50 * (250-240)
	});

	it('is idempotent — re-importing the same file adds nothing', async () => {
		const res = await importCsv(db, {
			accountId: ACCOUNT,
			csvText: CSV,
			defaultAssetClass: 'stock'
		});
		expect(res.importedCount).toBe(0);
		expect(res.duplicateCount).toBe(4);
		const trades = await listTrades(db, ACCOUNT);
		expect(trades).toHaveLength(2); // still just two
	});

	it('computes dashboard metrics from the imported trades', async () => {
		const dash = await getDashboard(db, { id: ACCOUNT, startingBalance: 0 });
		expect(dash.metrics.tradeCount).toBe(2);
		expect(dash.metrics.winCount).toBe(2);
		expect(fromScaled(dash.metrics.netPnl)).toBe(996); // 498 + 498
		expect(dash.score.score).toBeGreaterThan(0);
		expect(dash.equity).toHaveLength(2);
	});

	it('regroups correctly after a correcting execution (scale + reversal)', async () => {
		// a fresh instrument with a reversal: 10 long closed, then 5 short opened
		const csv = `Symbol,Side,Quantity,Price,Date
NVDA,Buy,10,100,2026-06-03T14:00:00Z
NVDA,Sell,15,110,2026-06-03T15:00:00Z`;
		await importCsv(db, { accountId: ACCOUNT, csvText: csv, defaultAssetClass: 'stock' });
		const nvda = (await listTrades(db, ACCOUNT)).filter((t) => t.symbol === 'NVDA');
		expect(nvda).toHaveLength(2); // long closed + short opened
		const closed = nvda.find((t) => t.status === 'closed')!;
		expect(fromScaled(closed.grossPnl)).toBe(100); // 10 * (110-100)
		const open = nvda.find((t) => t.status === 'open')!;
		expect(open.direction).toBe('short');
		expect(fromScaled(open.qtyOpened)).toBe(5);
	});
});

describe('schema sanity', () => {
	it('created the expected tables via migration', async () => {
		const rows = await db
			.select({ id: tradingAccount.id })
			.from(tradingAccount)
			.where(eq(tradingAccount.id, ACCOUNT));
		expect(rows).toHaveLength(1);
		const tradeRows = await db.select({ id: trade.id }).from(trade);
		expect(tradeRows.length).toBeGreaterThan(0);
	});
});
