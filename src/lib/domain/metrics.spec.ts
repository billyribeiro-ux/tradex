import { describe, it, expect } from 'vitest';
import {
	computePerformance,
	computeTradeXScore,
	computeEquityCurve,
	computeRMultiple,
	INFINITE_RATIO,
	type ClosedTradeLike
} from './metrics';
import { toScaled, fromScaled } from '$lib/money';

function t(netPnl: number, closedAt: number, fees = 0, holdMs: number | null = 60000): ClosedTradeLike {
	return { netPnl: toScaled(netPnl), fees: toScaled(fees), holdMs, closedAt };
}

describe('computePerformance', () => {
	it('returns zeroed metrics for no trades', () => {
		const m = computePerformance([]);
		expect(m.tradeCount).toBe(0);
		expect(m.netPnl).toBe(0);
		expect(m.profitFactor).toBe(0);
	});

	it('computes core metrics for a mixed set', () => {
		const m = computePerformance([
			t(100, 1000),
			t(-50, 2000),
			t(200, 3000),
			t(-25, 4000)
		]);
		expect(m.tradeCount).toBe(4);
		expect(m.winCount).toBe(2);
		expect(m.lossCount).toBe(2);
		expect(fromScaled(m.netPnl)).toBe(225);
		expect(fromScaled(m.grossProfit)).toBe(300);
		expect(fromScaled(m.grossLoss)).toBe(75);
		expect(fromScaled(m.winRate)).toBe(0.5);
		expect(fromScaled(m.profitFactor)).toBe(4); // 300/75
		expect(fromScaled(m.expectancy)).toBe(56.25); // 225/4
		expect(fromScaled(m.avgWin)).toBe(150);
		expect(fromScaled(m.avgLoss)).toBe(-37.5);
	});

	it('computes max drawdown from the equity curve', () => {
		// equity: +100, +50(dd0), -150 => peak 150 at t2, trough 0 at t3 => dd 150... let's check
		const m = computePerformance([t(100, 1000), t(50, 2000), t(-150, 3000), t(80, 4000)]);
		// equity path: 100, 150(peak), 0 (dd=150), 80 (dd=70) => maxDD 150
		expect(fromScaled(m.maxDrawdown)).toBe(150);
	});

	it('tracks win and loss streaks', () => {
		const m = computePerformance([
			t(10, 1000),
			t(10, 2000),
			t(10, 3000),
			t(-5, 4000),
			t(-5, 5000)
		]);
		expect(m.maxWinStreak).toBe(3);
		expect(m.maxLossStreak).toBe(2);
	});

	it('uses an infinite-ratio proxy when there are no losses', () => {
		const m = computePerformance([t(100, 1000), t(50, 2000)]);
		expect(m.profitFactor).toBe(INFINITE_RATIO);
		expect(m.recoveryFactor).toBe(INFINITE_RATIO); // no drawdown
	});

	it('measures consistency across days (one big day => low)', () => {
		// all profit on a single day => consistency ~0
		const oneDay = computePerformance([t(100, Date.UTC(2026, 0, 1, 10)), t(100, Date.UTC(2026, 0, 1, 14))]);
		expect(fromScaled(oneDay.consistency)).toBe(0);
		// spread evenly across two days => consistency 0.5
		const twoDays = computePerformance([
			t(100, Date.UTC(2026, 0, 1, 10)),
			t(100, Date.UTC(2026, 0, 2, 10))
		]);
		expect(fromScaled(twoDays.consistency)).toBe(0.5);
	});
});

describe('computeTradeXScore', () => {
	it('scores a flawless profile near 100', () => {
		const { score, factors } = computeTradeXScore(
			{
				winRate: toScaled(0.8),
				profitFactor: toScaled(4),
				avgWinLossRatio: toScaled(3),
				maxDrawdown: toScaled(100),
				netPnl: toScaled(5000),
				recoveryFactor: toScaled(5),
				consistency: toScaled(0.9),
				ruleAdherence: toScaled(1)
			},
			{ grossProfit: toScaled(5000) }
		);
		expect(score).toBeGreaterThan(85);
		expect(factors).toHaveLength(7);
		expect(factors.reduce((s, f) => s + f.weight, 0)).toBe(100);
	});

	it('scores a losing profile near 0', () => {
		const { score } = computeTradeXScore({
			winRate: toScaled(0.2),
			profitFactor: toScaled(0.5),
			avgWinLossRatio: toScaled(0.5),
			maxDrawdown: toScaled(1000),
			netPnl: toScaled(-500),
			recoveryFactor: toScaled(0),
			consistency: toScaled(0.1),
			ruleAdherence: toScaled(0.2)
		});
		expect(score).toBeLessThan(25);
	});

	it('exposes a transparent factor breakdown that sums to the score', () => {
		const { score, factors } = computeTradeXScore(
			{
				winRate: toScaled(0.5),
				profitFactor: toScaled(2),
				avgWinLossRatio: toScaled(2),
				maxDrawdown: toScaled(50),
				netPnl: toScaled(100),
				recoveryFactor: toScaled(1.5),
				consistency: toScaled(0.5),
				ruleAdherence: toScaled(0.8)
			},
			{ grossProfit: toScaled(200) }
		);
		const sum = Math.round(factors.reduce((s, f) => s + f.points, 0));
		expect(sum).toBe(score);
	});
});

describe('computeEquityCurve', () => {
	it('builds a cumulative curve with drawdown from a starting balance', () => {
		const curve = computeEquityCurve([t(100, 1000), t(-40, 2000), t(20, 3000)], toScaled(1000));
		expect(curve.map((p) => fromScaled(p.equity))).toEqual([1100, 1060, 1080]);
		expect(fromScaled(curve[1]!.drawdown)).toBe(40);
	});
});

describe('computeRMultiple', () => {
	it('computes R from realized P&L and initial risk', () => {
		// entry 100, stop 95 => risk 5/share * 100 shares = 500. pnl 1000 => 2R
		const r = computeRMultiple({
			netPnl: toScaled(1000),
			avgEntry: toScaled(100),
			plannedStop: toScaled(95),
			qty: toScaled(100),
			multiplier: toScaled(1)
		});
		expect(r).not.toBeNull();
		expect(fromScaled(r!.rMultiple)).toBe(2);
		expect(fromScaled(r!.riskAmount)).toBe(500);
	});

	it('returns null when no stop is set', () => {
		const r = computeRMultiple({
			netPnl: toScaled(1000),
			avgEntry: toScaled(100),
			plannedStop: null,
			qty: toScaled(100),
			multiplier: toScaled(1)
		});
		expect(r).toBeNull();
	});
});
