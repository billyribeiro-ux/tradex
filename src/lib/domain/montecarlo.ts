import { fromScaled, toScaled } from '$lib/money';

/**
 * Monte Carlo edge validation — Edgewonk's standout feature, absent from modern
 * competitors. By resampling a trader's own per-trade returns we estimate
 * whether an edge is real (vs. luck), the probability of ruin, and a realistic
 * drawdown distribution. Pure: takes scaled per-trade net P&L, returns plain
 * numbers (already de-scaled) for charts.
 */

export interface MonteCarloResult {
	runs: number;
	horizon: number;
	/** terminal P&L percentiles (plain currency units). */
	p5: number;
	p25: number;
	median: number;
	p75: number;
	p95: number;
	/** mean terminal P&L. */
	mean: number;
	/** share of simulations ending profitable (0..1). */
	probProfit: number;
	/** share of simulations whose equity ever drops below -ruinThreshold (0..1). */
	probRuin: number;
	/** median of each simulation's max drawdown (plain units, positive). */
	medianMaxDrawdown: number;
	/** worst (95th percentile) max drawdown across simulations. */
	worstDrawdown: number;
}

/**
 * Deterministic LCG so results are reproducible (no Math.random — also keeps the
 * function pure/testable). Seed defaults to a fixed value.
 */
function lcg(seed: number) {
	let s = seed >>> 0 || 1;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 0x100000000;
	};
}

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
	return sorted[idx]!;
}

/**
 * @param scaledPnls per-trade net P&L (scaled). Sampled with replacement.
 * @param opts.runs number of simulations, opts.horizon trades per simulation
 *        (defaults to the sample size), opts.ruinThreshold scaled equity drop
 *        that counts as ruin (e.g. starting balance).
 */
export function monteCarlo(
	scaledPnls: readonly number[],
	opts: { runs?: number; horizon?: number; ruinThreshold?: number; seed?: number } = {}
): MonteCarloResult {
	const pnls = scaledPnls.map(fromScaled);
	const runs = opts.runs ?? 1000;
	const horizon = opts.horizon ?? pnls.length;
	const ruin = opts.ruinThreshold != null ? fromScaled(opts.ruinThreshold) : Infinity;
	const rand = lcg(opts.seed ?? 12345);

	const empty: MonteCarloResult = {
		runs,
		horizon,
		p5: 0,
		p25: 0,
		median: 0,
		p75: 0,
		p95: 0,
		mean: 0,
		probProfit: 0,
		probRuin: 0,
		medianMaxDrawdown: 0,
		worstDrawdown: 0
	};
	if (pnls.length === 0 || horizon === 0) return empty;

	const terminals: number[] = [];
	const maxDDs: number[] = [];
	let profitable = 0;
	let ruined = 0;

	for (let r = 0; r < runs; r++) {
		let equity = 0;
		let peak = 0;
		let maxDD = 0;
		let isRuined = false;
		for (let i = 0; i < horizon; i++) {
			const pick = pnls[Math.floor(rand() * pnls.length)]!;
			equity += pick;
			if (equity > peak) peak = equity;
			const dd = peak - equity;
			if (dd > maxDD) maxDD = dd;
			if (-equity >= ruin) isRuined = true;
		}
		terminals.push(equity);
		maxDDs.push(maxDD);
		if (equity > 0) profitable++;
		if (isRuined) ruined++;
	}

	terminals.sort((a, b) => a - b);
	maxDDs.sort((a, b) => a - b);
	const mean = terminals.reduce((s, x) => s + x, 0) / runs;

	return {
		runs,
		horizon,
		p5: percentile(terminals, 5),
		p25: percentile(terminals, 25),
		median: percentile(terminals, 50),
		p75: percentile(terminals, 75),
		p95: percentile(terminals, 95),
		mean,
		probProfit: profitable / runs,
		probRuin: ruined / runs,
		medianMaxDrawdown: percentile(maxDDs, 50),
		worstDrawdown: percentile(maxDDs, 95)
	};
}

/** Convenience: express a plain-number result back as a scaled value if needed. */
export const toScaledResult = (v: number) => toScaled(v);
