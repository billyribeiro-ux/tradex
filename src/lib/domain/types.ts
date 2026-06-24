import type { Direction, TradeStatus, Side } from './enums';

/**
 * Framework-agnostic domain types. All numeric money/price/quantity values are
 * scaled integers (see $lib/money). These types are the contract between the
 * pure engines (grouping, metrics, score) and their callers — the SvelteKit
 * server today, the Rust/Axum backend tomorrow.
 */

/** A raw fill — the input to the grouping engine. */
export interface ExecInput {
	id: string;
	side: Side;
	/** scaled */
	qty: number;
	/** scaled */
	price: number;
	/** scaled */
	fee?: number;
	/** scaled */
	commission?: number;
	/** UTC epoch ms */
	executedAt: number;
}

/** Options that affect how executions are grouped into a trade. */
export interface GroupOptions {
	/** instrument contract size / point value, scaled (default 1.0). */
	multiplier?: number;
}

/** A round-trip trade derived from a sequence of executions. */
export interface GroupedTrade {
	direction: Direction;
	status: TradeStatus;
	openedAt: number;
	closedAt: number | null;
	/** scaled — total quantity that entered the position over the trade. */
	qtyOpened: number;
	/** scaled — total quantity that exited. */
	qtyClosed: number;
	/** scaled — quantity still open (qtyOpened - qtyClosed). */
	qtyRemaining: number;
	/** scaled — weighted average entry price. */
	avgEntry: number;
	/** scaled — weighted average exit price (null while fully open). */
	avgExit: number | null;
	/** scaled — realized gross P&L (before fees), in the instrument currency. */
	grossPnl: number;
	/** scaled — fees + commissions across every execution in the trade. */
	fees: number;
	/** scaled — grossPnl - fees. */
	netPnl: number;
	/** ms held (closedAt - openedAt), null while open. */
	holdMs: number | null;
	/** executions that make up this trade (a reversal fill belongs to two). */
	executionIds: string[];
}

/** Aggregate performance metrics over a set of closed trades. */
export interface PerformanceMetrics {
	tradeCount: number;
	winCount: number;
	lossCount: number;
	breakevenCount: number;
	/** scaled — sum of net P&L. */
	netPnl: number;
	grossProfit: number;
	grossLoss: number;
	/** scaled — total fees. */
	fees: number;
	/** scaled ratio 0..1 */
	winRate: number;
	/** scaled ratio (gross profit / gross loss). */
	profitFactor: number;
	/** scaled — average net P&L per trade (expectancy). */
	expectancy: number;
	/** scaled — average winning trade. */
	avgWin: number;
	/** scaled — average losing trade (negative). */
	avgLoss: number;
	/** scaled ratio (avgWin / |avgLoss|). */
	avgWinLossRatio: number;
	/** scaled — largest single win / loss. */
	largestWin: number;
	largestLoss: number;
	/** scaled — maximum peak-to-trough drawdown of the cumulative equity curve. */
	maxDrawdown: number;
	/** scaled ratio (netPnl / maxDrawdown). */
	recoveryFactor: number;
	/** scaled ratio 0..1 — 1 - (largest single-day P&L share of total profit). */
	consistency: number;
	/** longest consecutive winning / losing streaks. */
	maxWinStreak: number;
	maxLossStreak: number;
	/** scaled — average hold time in ms (as a scaled integer of ms). */
	avgHoldMs: number;
}

/** Inputs the TradeX Score is computed from (all scaled ratios unless noted). */
export interface ScoreInputs {
	winRate: number;
	profitFactor: number;
	avgWinLossRatio: number;
	maxDrawdown: number;
	netPnl: number;
	recoveryFactor: number;
	consistency: number;
	/** scaled ratio 0..1 — share of trades that followed their playbook/risk rules. */
	ruleAdherence: number;
}

/** Breakdown of how each weighted factor contributed to the TradeX Score. */
export interface ScoreBreakdown {
	score: number; // 0..100 (plain number, not scaled)
	factors: { key: string; label: string; weight: number; normalized: number; points: number }[];
}
