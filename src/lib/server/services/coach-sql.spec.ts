import { describe, it, expect } from 'vitest';
import { validateSelect, runIsolatedQuery } from './coach-sql';

describe('validateSelect', () => {
	it('accepts a SELECT and appends a LIMIT', () => {
		const r = validateSelect('SELECT symbol, net_pnl FROM trades');
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.sql.toLowerCase()).toContain('limit');
	});

	it('strips code fences and accepts CTEs', () => {
		expect(validateSelect('```sql\nSELECT * FROM trades\n```').ok).toBe(true);
		expect(validateSelect('WITH x AS (SELECT * FROM trades) SELECT * FROM x').ok).toBe(true);
	});

	it('rejects writes, DDL, multiple statements, and comments', () => {
		expect(validateSelect('DELETE FROM trades').ok).toBe(false);
		expect(validateSelect('UPDATE trades SET net_pnl = 0').ok).toBe(false);
		expect(validateSelect('SELECT 1; DROP TABLE trades').ok).toBe(false);
		expect(validateSelect('SELECT * FROM trades -- comment').ok).toBe(false);
		expect(validateSelect('SELECT * INTO other FROM trades').ok).toBe(false);
	});

	it('does not double a present LIMIT', () => {
		const r = validateSelect('SELECT * FROM trades LIMIT 5');
		expect(r.ok).toBe(true);
		if (r.ok) expect((r.sql.match(/limit/gi) ?? []).length).toBe(1);
	});
});

describe('runIsolatedQuery (sandbox)', () => {
	const rows = [
		{ symbol: 'AAPL', net_pnl: 100, day_of_week: 'Monday', hour: 10, is_win: true },
		{ symbol: 'AAPL', net_pnl: -40, day_of_week: 'Monday', hour: 14, is_win: false },
		{ symbol: 'TSLA', net_pnl: 250, day_of_week: 'Tuesday', hour: 11, is_win: true }
	];

	// Each case boots a fresh in-process PGlite (WASM) instance; under full-suite
	// parallel load that cold start can exceed the 5s default, so allow 30s.
	it('aggregates net P&L by weekday inside the isolated db', async () => {
		const v = validateSelect(
			'SELECT day_of_week, sum(net_pnl) AS pnl FROM trades GROUP BY day_of_week ORDER BY pnl DESC'
		);
		expect(v.ok).toBe(true);
		if (!v.ok) return;
		const out = await runIsolatedQuery(rows, v.sql);
		expect(out.columns).toEqual(['day_of_week', 'pnl']);
		expect(out.rows[0]).toMatchObject({ day_of_week: 'Tuesday', pnl: 250 });
		const monday = out.rows.find((r) => r.day_of_week === 'Monday');
		expect(Number(monday?.pnl)).toBe(60); // 100 - 40
	}, 30000);

	it('supports filtering (e.g. mornings)', async () => {
		const v = validateSelect('SELECT count(*) AS n FROM trades WHERE hour < 12');
		expect(v.ok).toBe(true);
		if (!v.ok) return;
		const out = await runIsolatedQuery(rows, v.sql);
		expect(Number(out.rows[0]?.n)).toBe(2);
	}, 30000);
});
