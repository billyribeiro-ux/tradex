import { and, eq, gte, lte } from 'drizzle-orm';
import type { DB } from '$lib/server/db';
import { trade } from '$lib/server/db/schema';
import {
	computePerformance,
	computeTradeXScore,
	computeEquityCurve,
	type ClosedTradeLike,
	type EquityPoint
} from '$lib/domain/metrics';
import { toScaled, divScaled } from '$lib/money';
import { tzDate } from '$lib/datetime';
import type { PerformanceMetrics, ScoreBreakdown } from '$lib/domain/types';

export interface CalendarDay {
	date: string; // YYYY-MM-DD (UTC)
	/** scaled */ netPnl: number;
	trades: number;
}

export interface DashboardData {
	metrics: PerformanceMetrics;
	score: ScoreBreakdown;
	equity: EquityPoint[];
	calendar: CalendarDay[];
	openPositions: number;
}

/**
 * Aggregate everything the dashboard needs from the account's trades. Closed
 * trades feed the metrics/score/equity/calendar; open trades are counted.
 */
export async function getDashboard(
	db: DB,
	account: { id: string; startingBalance: number; timezone?: string },
	range: { from?: number; to?: number } = {}
): Promise<DashboardData> {
	const conds = [eq(trade.accountId, account.id)];
	if (range.from != null) conds.push(gte(trade.openedAt, range.from));
	if (range.to != null) conds.push(lte(trade.openedAt, range.to));

	const rows = await db
		.select({
			status: trade.status,
			netPnl: trade.netPnl,
			fees: trade.fees,
			holdMs: trade.holdMs,
			closedAt: trade.closedAt,
			playbookId: trade.playbookId,
			ruleComplianceScore: trade.ruleComplianceScore
		})
		.from(trade)
		.where(and(...conds));

	const closed = rows.filter((r) => r.status === 'closed');
	const openPositions = rows.length - closed.length;

	const closedLike: ClosedTradeLike[] = closed.map((r) => ({
		netPnl: r.netPnl,
		fees: r.fees,
		holdMs: r.holdMs,
		closedAt: r.closedAt
	}));

	const tz = account.timezone ?? 'UTC';
	const metrics = computePerformance(closedLike, tz);
	const equity = computeEquityCurve(closedLike, account.startingBalance);

	// rule adherence: share of closed trades that followed a playbook (v1 proxy)
	const adhered = closed.filter((r) => r.playbookId != null).length;
	const ruleAdherence =
		closed.length > 0 ? divScaled(toScaled(adhered), toScaled(closed.length)) : 0;

	const score = computeTradeXScore(
		{
			winRate: metrics.winRate,
			profitFactor: metrics.profitFactor,
			avgWinLossRatio: metrics.avgWinLossRatio,
			maxDrawdown: metrics.maxDrawdown,
			netPnl: metrics.netPnl,
			recoveryFactor: metrics.recoveryFactor,
			consistency: metrics.consistency,
			ruleAdherence
		},
		{ grossProfit: metrics.grossProfit }
	);

	return { metrics, score, equity, calendar: buildCalendar(closed, tz), openPositions };
}

function buildCalendar(
	closed: { closedAt: number | null; netPnl: number }[],
	tz = 'UTC'
): CalendarDay[] {
	const byDay = new Map<string, { netPnl: number; trades: number }>();
	for (const t of closed) {
		const date = tzDate(t.closedAt ?? 0, tz);
		const cur = byDay.get(date) ?? { netPnl: 0, trades: 0 };
		cur.netPnl += t.netPnl;
		cur.trades += 1;
		byDay.set(date, cur);
	}
	return [...byDay.entries()]
		.map(([date, v]) => ({ date, netPnl: v.netPnl, trades: v.trades }))
		.sort((a, b) => a.date.localeCompare(b.date));
}
