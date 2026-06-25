import { describe, it, expect } from 'vitest';
import { monteCarlo, monteCarloBands } from './montecarlo';
import { toScaled } from '$lib/money';

const scaled = (xs: number[]) => xs.map((x) => toScaled(x));

describe('monteCarlo', () => {
	it('returns zeros for no trades', () => {
		const r = monteCarlo([]);
		expect(r.median).toBe(0);
		expect(r.probProfit).toBe(0);
	});

	it('is deterministic for a fixed seed', () => {
		const pnls = scaled([10, -5, 20, -8, 15]);
		const a = monteCarlo(pnls, { runs: 300, seed: 42 });
		const b = monteCarlo(pnls, { runs: 300, seed: 42 });
		expect(a.median).toBe(b.median);
		expect(a.p95).toBe(b.p95);
		expect(a.probProfit).toBe(b.probProfit);
	});

	it('always profits when every trade is a winner', () => {
		const r = monteCarlo(scaled([10, 20, 30]), { runs: 500, horizon: 3 });
		expect(r.probProfit).toBe(1);
		expect(r.median).toBeGreaterThan(0);
		expect(r.probRuin).toBe(0);
	});

	it('detects ruin when equity breaches the threshold', () => {
		// all losers; after 3 trades equity is -30, ruin threshold 15
		const r = monteCarlo(scaled([-10]), { runs: 100, horizon: 3, ruinThreshold: toScaled(15) });
		expect(r.probRuin).toBe(1);
		expect(r.probProfit).toBe(0);
	});

	it('orders percentiles monotonically', () => {
		const r = monteCarlo(scaled([5, -3, 8, -6, 12, -4]), { runs: 400, seed: 7 });
		expect(r.p5).toBeLessThanOrEqual(r.p25);
		expect(r.p25).toBeLessThanOrEqual(r.median);
		expect(r.median).toBeLessThanOrEqual(r.p75);
		expect(r.p75).toBeLessThanOrEqual(r.p95);
	});
});

describe('monteCarloBands', () => {
	it('returns an empty fan for no trades', () => {
		expect(monteCarloBands([])).toEqual([]);
	});

	it('produces horizon+1 steps starting at zero with ordered bands', () => {
		const bands = monteCarloBands(scaled([5, -3, 8, -6, 12, -4]), {
			runs: 300,
			horizon: 10,
			seed: 11
		});
		expect(bands.length).toBe(11);
		const origin = bands[0]!;
		expect(origin.step).toBe(0);
		// every simulation starts at 0, so all percentiles collapse to 0
		expect([origin.p5, origin.p25, origin.median, origin.p75, origin.p95]).toEqual([0, 0, 0, 0, 0]);
		for (const b of bands) {
			expect(b.p5).toBeLessThanOrEqual(b.p25);
			expect(b.p25).toBeLessThanOrEqual(b.median);
			expect(b.median).toBeLessThanOrEqual(b.p75);
			expect(b.p75).toBeLessThanOrEqual(b.p95);
		}
	});

	it('is deterministic for a fixed seed', () => {
		const a = monteCarloBands(scaled([5, -3, 8]), { runs: 200, horizon: 6, seed: 42 });
		const b = monteCarloBands(scaled([5, -3, 8]), { runs: 200, horizon: 6, seed: 42 });
		expect(a).toEqual(b);
	});

	it('trends the median upward for an all-winners edge', () => {
		const bands = monteCarloBands(scaled([10]), { runs: 50, horizon: 5 });
		expect(bands.at(-1)!.median).toBeGreaterThan(bands[0]!.median);
	});
});
