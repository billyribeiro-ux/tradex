import { describe, it, expect } from 'vitest';
import { parseOccSymbol, contractLabel, breakeven, daysToExpiry, formatStrike } from './options';
import { toScaled, fromScaled } from '$lib/money';

describe('parseOccSymbol', () => {
	it('parses a padded OCC symbol', () => {
		const d = parseOccSymbol('AAPL  240920C00190000');
		expect(d).not.toBeNull();
		expect(d!.underlying).toBe('AAPL');
		expect(d!.type).toBe('call');
		expect(fromScaled(d!.strike)).toBe(190);
		expect(d!.expiry).toBe(Date.UTC(2024, 8, 20));
	});

	it('parses an unpadded symbol and a put with a fractional strike', () => {
		const d = parseOccSymbol('SPY250117P00587500');
		expect(d!.underlying).toBe('SPY');
		expect(d!.type).toBe('put');
		expect(fromScaled(d!.strike)).toBe(587.5);
		expect(d!.expiry).toBe(Date.UTC(2025, 0, 17));
	});

	it('returns null for non-option symbols', () => {
		expect(parseOccSymbol('AAPL')).toBeNull();
		expect(parseOccSymbol('AAPL 06/21')).toBeNull();
		expect(parseOccSymbol('')).toBeNull();
		expect(parseOccSymbol('AAPL241332C00190000')).toBeNull(); // month 13
	});
});

describe('contractLabel', () => {
	it('builds a stable, readable label', () => {
		const label = contractLabel({
			underlying: 'AAPL',
			type: 'call',
			strike: toScaled(190),
			expiry: Date.UTC(2024, 8, 20)
		});
		expect(label).toBe('AAPL 190C 20SEP24');
	});
	it('round-trips OCC → label deterministically', () => {
		const d = parseOccSymbol('TSLA250620P00250000')!;
		expect(contractLabel(d)).toBe('TSLA 250P 20JUN25');
	});
	it('keeps fractional strikes compact', () => {
		expect(formatStrike(toScaled(187.5))).toBe('187.5');
		expect(formatStrike(toScaled(190))).toBe('190');
	});
});

describe('breakeven', () => {
	it('call = strike + premium, put = strike − premium', () => {
		expect(fromScaled(breakeven('call', toScaled(190), toScaled(5)))).toBe(195);
		expect(fromScaled(breakeven('put', toScaled(190), toScaled(5)))).toBe(185);
	});
});

describe('daysToExpiry', () => {
	it('counts whole days and goes negative when expired', () => {
		const exp = Date.UTC(2026, 5, 30);
		expect(daysToExpiry(exp, Date.UTC(2026, 5, 20))).toBe(10);
		expect(daysToExpiry(exp, Date.UTC(2026, 6, 5))).toBeLessThan(0);
	});
});
