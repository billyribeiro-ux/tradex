import { describe, it, expect } from 'vitest';
import {
	SCALE,
	toScaled,
	fromScaled,
	mulScaled,
	mulAll,
	divScaled,
	sumScaled,
	formatMoney,
	formatRatio
} from './money';

describe('toScaled / fromScaled', () => {
	it('scales whole numbers', () => {
		expect(toScaled(1)).toBe(SCALE);
		expect(toScaled(0)).toBe(0);
		expect(toScaled(-3)).toBe(-3 * SCALE);
	});

	it('scales decimals from numbers', () => {
		expect(toScaled(1.5)).toBe(150_000_000);
		expect(toScaled(0.00000001)).toBe(1);
		expect(toScaled(123.45)).toBe(12_345_000_000);
	});

	it('parses decimal strings exactly (no float drift)', () => {
		// the classic 0.1 + 0.2 problem stays exact under integer math
		expect(toScaled('0.1') + toScaled('0.2')).toBe(toScaled('0.3'));
		expect(toScaled('1.23456789')).toBe(123_456_789);
	});

	it('rounds half-up on the first dropped digit', () => {
		expect(toScaled('0.000000005')).toBe(1); // 9th digit rounds up
		expect(toScaled('0.000000004')).toBe(0);
	});

	it('round-trips back to the original value', () => {
		expect(fromScaled(toScaled('99.99'))).toBeCloseTo(99.99, 8);
	});
});

describe('arithmetic', () => {
	it('multiplies qty x price without overflow or drift', () => {
		const qty = toScaled(1000);
		const price = toScaled('10.25');
		// 1000 * 10.25 = 10_250
		expect(fromScaled(mulScaled(qty, price))).toBe(10_250);
	});

	it('handles a futures multiplier chain (qty x points x $50/pt)', () => {
		const qty = toScaled(2);
		const points = toScaled('4.25');
		const multiplier = toScaled(50);
		// 2 * 4.25 * 50 = 425
		expect(fromScaled(mulAll(qty, points, multiplier))).toBe(425);
	});

	it('divides scaled values to a scaled ratio', () => {
		// profit factor 1500 / 600 = 2.5
		expect(fromScaled(divScaled(toScaled(1500), toScaled(600)))).toBe(2.5);
		expect(divScaled(toScaled(1), 0)).toBe(0); // guarded divide-by-zero
	});

	it('sums scaled values', () => {
		expect(sumScaled([toScaled('1.1'), toScaled('2.2'), toScaled('-0.3')])).toBe(toScaled('3.0'));
	});
});

describe('formatting', () => {
	it('formats money with currency and optional sign', () => {
		expect(formatMoney(toScaled('1234.5'), 'USD')).toBe('$1,234.50');
		expect(formatMoney(toScaled('-1234.5'), 'USD')).toBe('-$1,234.50');
		expect(formatMoney(toScaled('1234.5'), 'USD', { signed: true })).toBe('+$1,234.50');
	});

	it('formats ratios to fixed decimals', () => {
		expect(formatRatio(toScaled('2.5'))).toBe('2.50');
		expect(formatRatio(toScaled('1.333'), 1)).toBe('1.3');
	});
});
