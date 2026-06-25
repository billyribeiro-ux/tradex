import { toScaled, fromScaled, divScaled, mulScaled, SCALE } from '$lib/money';
import { tzDate } from '$lib/datetime';
import type { PerformanceMetrics, ScoreInputs, ScoreBreakdown } from './types';

/** Minimal shape needed to compute aggregate performance. */
export interface ClosedTradeLike {
	/** scaled */
	netPnl: number;
	/** scaled */
	fees: number;
	/** ms */
	holdMs: number | null;
	/** UTC epoch ms — used for ordering the equity curve and daily buckets. */
	closedAt: number | null;
}

/** "∞" proxy for profit factor / recovery factor when there are no losses. */
export const INFINITE_RATIO = toScaled(9999);

/**
 * Compute aggregate performance metrics over a set of CLOSED trades.
 * Pure: scaled-integer in, scaled-integer out. Ordering for drawdown/streaks is
 * by closedAt (ties keep input order).
 */
export function computePerformance(
	trades: readonly ClosedTradeLike[],
	timezone = 'UTC'
): PerformanceMetrics {
	const ordered = [...trades].sort((a, b) => (a.closedAt ?? 0) - (b.closedAt ?? 0));
	const empty: PerformanceMetrics = {
		tradeCount: 0,
		winCount: 0,
		lossCount: 0,
		breakevenCount: 0,
		netPnl: 0,
		grossProfit: 0,
		grossLoss: 0,
		fees: 0,
		winRate: 0,
		profitFactor: 0,
		expectancy: 0,
		avgWin: 0,
		avgLoss: 0,
		avgWinLossRatio: 0,
		largestWin: 0,
		largestLoss: 0,
		maxDrawdown: 0,
		recoveryFactor: 0,
		consistency: 0,
		maxWinStreak: 0,
		maxLossStreak: 0,
		avgHoldMs: 0
	};
	if (ordered.length === 0) return empty;

	let netPnl = 0;
	let grossProfit = 0;
	let grossLoss = 0; // positive magnitude
	let fees = 0;
	let winCount = 0;
	let lossCount = 0;
	let breakevenCount = 0;
	let largestWin = 0;
	let largestLoss = 0;
	let holdSum = 0;
	let holdCount = 0;

	// drawdown + streaks
	let equity = 0;
	let peak = 0;
	let maxDrawdown = 0;
	let winStreak = 0;
	let lossStreak = 0;
	let maxWinStreak = 0;
	let maxLossStreak = 0;

	// daily P&L buckets for consistency
	const dayPnl = new Map<string, number>();

	for (const t of ordered) {
		netPnl += t.netPnl;
		fees += t.fees;
		if (t.netPnl > 0) {
			grossProfit += t.netPnl;
			winCount++;
			if (t.netPnl > largestWin) largestWin = t.netPnl;
			winStreak++;
			lossStreak = 0;
		} else if (t.netPnl < 0) {
			grossLoss += -t.netPnl;
			lossCount++;
			if (t.netPnl < largestLoss) largestLoss = t.netPnl;
			lossStreak++;
			winStreak = 0;
		} else {
			breakevenCount++;
			winStreak = 0;
			lossStreak = 0;
		}
		if (winStreak > maxWinStreak) maxWinStreak = winStreak;
		if (lossStreak > maxLossStreak) maxLossStreak = lossStreak;

		equity += t.netPnl;
		if (equity > peak) peak = equity;
		const dd = peak - equity;
		if (dd > maxDrawdown) maxDrawdown = dd;

		if (t.holdMs != null) {
			holdSum += t.holdMs;
			holdCount++;
		}

		const day = tzDate(t.closedAt ?? 0, timezone);
		dayPnl.set(day, (dayPnl.get(day) ?? 0) + t.netPnl);
	}

	const tradeCount = ordered.length;
	const decided = winCount + lossCount; // exclude breakeven from win-rate denominator

	const winRate = decided > 0 ? divScaled(toScaled(winCount), toScaled(decided)) : 0;
	const profitFactor =
		grossLoss > 0 ? divScaled(grossProfit, grossLoss) : grossProfit > 0 ? INFINITE_RATIO : 0;
	const expectancy = divScaled(netPnl, toScaled(tradeCount));
	const avgWin = winCount > 0 ? divScaled(grossProfit, toScaled(winCount)) : 0;
	const avgLoss = lossCount > 0 ? -divScaled(grossLoss, toScaled(lossCount)) : 0;
	const avgWinLossRatio =
		lossCount > 0 && grossLoss > 0
			? divScaled(avgWin, divScaled(grossLoss, toScaled(lossCount)))
			: avgWin > 0
				? INFINITE_RATIO
				: 0;
	const recoveryFactor =
		maxDrawdown > 0 ? divScaled(netPnl, maxDrawdown) : netPnl > 0 ? INFINITE_RATIO : 0;

	// consistency: 1 - (best single day's profit / total positive day profit)
	let bestDay = 0;
	let totalDayProfit = 0;
	for (const v of dayPnl.values()) {
		if (v > 0) {
			totalDayProfit += v;
			if (v > bestDay) bestDay = v;
		}
	}
	const consistency =
		totalDayProfit > 0 ? Math.max(0, SCALE - divScaled(bestDay, totalDayProfit)) : 0;

	return {
		tradeCount,
		winCount,
		lossCount,
		breakevenCount,
		netPnl,
		grossProfit,
		grossLoss,
		fees,
		winRate,
		profitFactor,
		expectancy,
		avgWin,
		avgLoss,
		avgWinLossRatio,
		largestWin,
		largestLoss,
		maxDrawdown,
		recoveryFactor,
		consistency,
		maxWinStreak,
		maxLossStreak,
		avgHoldMs: holdCount > 0 ? Math.round(holdSum / holdCount) : 0
	};
}

// ---------------------------------------------------------------------------
// TradeX Score — transparent, published weights (sum to 100)
// ---------------------------------------------------------------------------

export const SCORE_WEIGHTS = {
	winRate: 15,
	profitFactor: 20,
	avgWinLossRatio: 15,
	maxDrawdown: 15,
	recoveryFactor: 10,
	consistency: 15,
	ruleAdherence: 10
} as const;

const SCORE_LABELS: Record<keyof typeof SCORE_WEIGHTS, string> = {
	winRate: 'Win Rate',
	profitFactor: 'Profit Factor',
	avgWinLossRatio: 'Avg Win/Loss',
	maxDrawdown: 'Drawdown Control',
	recoveryFactor: 'Recovery Factor',
	consistency: 'Consistency',
	ruleAdherence: 'Rule Adherence'
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Compute the TradeX Score (0–100) from aggregate inputs. Every factor is
 * normalized to 0..1 against published anchors, then weighted. The breakdown is
 * returned so the UI can show exactly how the score was built (no black box).
 *
 * `grossProfit` is used to normalize drawdown relative to profits earned.
 */
export function computeTradeXScore(
	inputs: ScoreInputs,
	context: { grossProfit?: number } = {}
): ScoreBreakdown {
	const winRate = fromScaled(inputs.winRate); // 0..1
	const pf = fromScaled(inputs.profitFactor);
	const awl = fromScaled(inputs.avgWinLossRatio);
	const rf = fromScaled(inputs.recoveryFactor);
	const consistency = fromScaled(inputs.consistency); // 0..1
	const adherence = fromScaled(inputs.ruleAdherence); // 0..1
	const grossProfit = fromScaled(context.grossProfit ?? 0);
	const maxDd = fromScaled(inputs.maxDrawdown);

	const normalized: Record<keyof typeof SCORE_WEIGHTS, number> = {
		winRate: clamp01(winRate),
		profitFactor: clamp01((pf - 1) / 2), // PF 1 -> 0, PF 3 -> 1
		avgWinLossRatio: clamp01((awl - 1) / 2), // 1 -> 0, 3 -> 1
		maxDrawdown: grossProfit > 0 ? clamp01(1 - maxDd / grossProfit) : maxDd === 0 ? 1 : 0,
		recoveryFactor: clamp01(rf / 3), // RF 3 -> 1
		consistency: clamp01(consistency),
		ruleAdherence: clamp01(adherence)
	};

	const factors = (Object.keys(SCORE_WEIGHTS) as (keyof typeof SCORE_WEIGHTS)[]).map((key) => {
		const weight = SCORE_WEIGHTS[key];
		const points = normalized[key] * weight;
		return { key, label: SCORE_LABELS[key], weight, normalized: normalized[key], points };
	});

	const score = Math.round(factors.reduce((s, f) => s + f.points, 0));
	return { score, factors };
}

// ---------------------------------------------------------------------------
// Equity curve + per-trade rollups (for charts and the trade detail view)
// ---------------------------------------------------------------------------

export interface EquityPoint {
	t: number; // ms
	/** scaled cumulative net P&L */
	equity: number;
	/** scaled drawdown from peak (>= 0) */
	drawdown: number;
}

/** Build a cumulative equity + drawdown curve from closed trades. */
export function computeEquityCurve(
	trades: readonly ClosedTradeLike[],
	startingBalance = 0
): EquityPoint[] {
	const ordered = [...trades].sort((a, b) => (a.closedAt ?? 0) - (b.closedAt ?? 0));
	const points: EquityPoint[] = [];
	let equity = startingBalance;
	let peak = startingBalance;
	for (const t of ordered) {
		equity += t.netPnl;
		if (equity > peak) peak = equity;
		points.push({ t: t.closedAt ?? 0, equity, drawdown: peak - equity });
	}
	return points;
}

/**
 * R-multiple = realized P&L / initial risk, where risk = |entry - stop| * qty *
 * multiplier. Returns a scaled ratio, or null if no stop/qty is known.
 */
export function computeRMultiple(args: {
	netPnl: number;
	avgEntry: number;
	plannedStop: number | null;
	qty: number;
	multiplier: number;
}): { rMultiple: number; riskAmount: number } | null {
	if (args.plannedStop == null || args.qty <= 0) return null;
	const perUnitRisk = Math.abs(args.avgEntry - args.plannedStop);
	if (perUnitRisk <= 0) return null;
	const riskAmount = mulScaled(mulScaled(perUnitRisk, args.qty), args.multiplier);
	if (riskAmount <= 0) return null;
	return { rMultiple: divScaled(args.netPnl, riskAmount), riskAmount };
}
