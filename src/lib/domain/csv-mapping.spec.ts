import { describe, it, expect } from 'vitest';
import { detectColumns, mapRow, normalizeSide, parseDecimal, parseTimestamp } from './csv-mapping';
import { fromScaled } from '$lib/money';

describe('detectColumns', () => {
	it('detects a clean header set', () => {
		const map = detectColumns(['Symbol', 'Side', 'Quantity', 'Price', 'Commission', 'Date']);
		expect(map.symbol).toBe('Symbol');
		expect(map.side).toBe('Side');
		expect(map.qty).toBe('Quantity');
		expect(map.price).toBe('Price');
		expect(map.commission).toBe('Commission');
		expect(map.executedAt).toBe('Date');
	});

	it('detects messy broker headers (thinkorswim-ish)', () => {
		const map = detectColumns(['Exec Time', 'Symbol', 'B/S', 'Filled Qty', 'Fill Price', 'Comm']);
		expect(map.executedAt).toBe('Exec Time');
		expect(map.side).toBe('B/S');
		expect(map.qty).toBe('Filled Qty');
		expect(map.price).toBe('Fill Price');
		expect(map.commission).toBe('Comm');
	});

	it('does not assign the same header to two fields', () => {
		const map = detectColumns(['Symbol', 'Qty', 'Price', 'Date']);
		const used = Object.values(map);
		expect(new Set(used).size).toBe(used.length);
	});
});

describe('normalizeSide', () => {
	it('maps many buy/sell spellings', () => {
		for (const v of ['Buy', 'B', 'BOT', 'Bought', 'Long', 'Buy to Open'])
			expect(normalizeSide(v)).toBe('buy');
		for (const v of ['Sell', 'S', 'SLD', 'Sold', 'Short', 'Sell to Close'])
			expect(normalizeSide(v)).toBe('sell');
	});
	it('returns null for nonsense', () => {
		expect(normalizeSide('xyz')).toBeNull();
	});
});

describe('parseDecimal', () => {
	it('handles thousands separators, currency, and parentheses-negatives', () => {
		expect(parseDecimal('1,234.50')).toBe(1234.5);
		expect(parseDecimal('$10')).toBe(10);
		expect(parseDecimal('(1.5)')).toBe(-1.5);
		expect(parseDecimal('-2.25')).toBe(-2.25);
	});
	it('rejects junk', () => {
		expect(parseDecimal('abc')).toBeNull();
		expect(parseDecimal('')).toBeNull();
	});
});

describe('parseTimestamp', () => {
	it('parses ISO and space-separated datetimes', () => {
		expect(parseTimestamp('2026-06-24T14:30:00Z')).toBe(Date.UTC(2026, 5, 24, 14, 30, 0));
		expect(parseTimestamp('2026-06-24 14:30:00Z')).toBe(Date.UTC(2026, 5, 24, 14, 30, 0));
	});
	it('treats a naive datetime (no tz) as UTC, not server-local', () => {
		// Broker CSVs often omit the offset; must NOT shift by the server's tz.
		expect(parseTimestamp('2026-06-24T14:30:00')).toBe(Date.UTC(2026, 5, 24, 14, 30, 0));
		expect(parseTimestamp('2026-06-24 14:30:00')).toBe(Date.UTC(2026, 5, 24, 14, 30, 0));
		expect(parseTimestamp('2026-06-24 09:00')).toBe(Date.UTC(2026, 5, 24, 9, 0, 0));
	});
	it('respects an explicit offset when present', () => {
		expect(parseTimestamp('2026-06-24T14:30:00-04:00')).toBe(Date.UTC(2026, 5, 24, 18, 30, 0));
	});
	it('interprets a naive datetime in the account timezone', () => {
		// 2026-06-24 14:30 in America/New_York (EDT, −4) == 18:30 UTC.
		expect(parseTimestamp('2026-06-24 14:30:00', 'America/New_York')).toBe(
			Date.UTC(2026, 5, 24, 18, 30, 0)
		);
		// A winter date uses EST (−5): 2026-01-15 09:00 ET == 14:00 UTC.
		expect(parseTimestamp('2026-01-15 09:00', 'America/New_York')).toBe(
			Date.UTC(2026, 0, 15, 14, 0, 0)
		);
	});
	it('does not mis-detect a tz-named string (… EDT) as naive ISO', () => {
		// "EDT" contains a 'T'; the old includes('T') check skipped normalization
		// and dropped the zone. Now it falls through to a lenient parse that keeps
		// the EDT offset (−4): 14:30 EDT == 18:30 UTC.
		expect(parseTimestamp('2026-06-24 14:30:00 EDT')).toBe(Date.UTC(2026, 5, 24, 18, 30, 0));
	});
	it('parses a date-only string as UTC midnight regardless of tz', () => {
		expect(parseTimestamp('2026-06-24')).toBe(Date.UTC(2026, 5, 24, 0, 0, 0));
		expect(parseTimestamp('2026-06-24', 'America/New_York')).toBe(Date.UTC(2026, 5, 24, 0, 0, 0));
	});
	it('parses epoch seconds and ms', () => {
		expect(parseTimestamp('1700000000')).toBe(1700000000 * 1000);
		expect(parseTimestamp('1700000000000')).toBe(1700000000000);
	});
	it('returns null for garbage', () => {
		expect(parseTimestamp('not a date')).toBeNull();
	});
});

describe('mapRow', () => {
	const map = detectColumns(['Symbol', 'Side', 'Qty', 'Price', 'Commission', 'Date']);

	it('maps a valid row to a normalized execution', () => {
		const r = mapRow(
			{
				Symbol: 'aapl',
				Side: 'Buy',
				Qty: '100',
				Price: '150.25',
				Commission: '1.00',
				Date: '2026-06-24T14:30:00Z'
			},
			map
		);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.value.symbol).toBe('AAPL');
			expect(r.value.side).toBe('buy');
			expect(fromScaled(r.value.qty)).toBe(100);
			expect(fromScaled(r.value.price)).toBe(150.25);
			expect(fromScaled(r.value.commission)).toBe(1);
			expect(r.value.executedAt).toBe(Date.UTC(2026, 5, 24, 14, 30, 0));
		}
	});

	it('collects per-field errors without throwing', () => {
		const r = mapRow({ Symbol: '', Side: 'wat', Qty: '0', Price: 'x', Date: 'nope' }, map);
		expect(r.ok).toBe(false);
		if (!r.ok) {
			const fields = r.errors.map((e) => e.field).sort();
			expect(fields).toEqual(['executedAt', 'price', 'qty', 'side', 'symbol']);
		}
	});

	it('rejects a non-positive price (0 or negative)', () => {
		for (const Price of ['0', '-5', '(10)']) {
			const r = mapRow(
				{ Symbol: 'AAPL', Side: 'Buy', Qty: '100', Price, Date: '2026-06-24T14:30:00Z' },
				map
			);
			expect(r.ok, `price ${Price}`).toBe(false);
			if (!r.ok) expect(r.errors.some((e) => e.field === 'price')).toBe(true);
		}
	});

	it('threads the account timezone into the executedAt timestamp', () => {
		const r = mapRow(
			{ Symbol: 'AAPL', Side: 'Buy', Qty: '1', Price: '10', Date: '2026-06-24 14:30:00' },
			map,
			'America/New_York'
		);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.value.executedAt).toBe(Date.UTC(2026, 5, 24, 18, 30, 0));
	});
});
