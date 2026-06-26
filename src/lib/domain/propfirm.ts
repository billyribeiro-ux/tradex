import { tzDate } from '$lib/datetime';
import type { DrawdownType } from './enums';

/**
 * Prop-firm rule evaluation — a first-class, free feature targeting the booming
 * prop cohort (FTMO/TopStep/Apex/…). Pure: scaled-integer in, structured status
 * out. Evaluates profit target, daily-loss limit, max drawdown (static or
 * trailing), minimum trading days, and the consistency rule.
 */

export interface PropFirmConfigInput {
	/** scaled, all optional */
	profitTarget?: number | null;
	dailyLossLimit?: number | null;
	maxDrawdown?: number | null;
	drawdownType?: DrawdownType | null;
	minTradingDays?: number | null;
	/** percent (0-100) */
	consistencyPct?: number | null;
}

export interface PropTrade {
	/** scaled */ netPnl: number;
	/** UTC epoch ms */ closedAt: number | null;
}

export interface RuleStatus {
	label: string;
	met: boolean;
	breached: boolean;
	/** current value and limit. Interpret per `unit`: money values are scaled. */
	value: number;
	limit: number | null;
	unit: 'money' | 'count' | 'percent';
}

export interface PropFirmStatus {
	overall: 'passed' | 'in-progress' | 'breached';
	netPnl: number; // scaled
	tradingDays: number;
	rules: RuleStatus[];
}

export function evaluatePropFirm(
	config: PropFirmConfigInput,
	trades: readonly PropTrade[],
	startingBalance = 0,
	timezone = 'UTC'
): PropFirmStatus {
	const ordered = [...trades].sort((a, b) => (a.closedAt ?? 0) - (b.closedAt ?? 0));
	const netPnl = ordered.reduce((s, t) => s + t.netPnl, 0);

	// daily P&L buckets, in the firm's local trading day
	const dayPnl = new Map<string, number>();
	for (const t of ordered) {
		const day = tzDate(t.closedAt ?? 0, timezone);
		dayPnl.set(day, (dayPnl.get(day) ?? 0) + t.netPnl);
	}
	const tradingDays = dayPnl.size;
	const worstDay = Math.min(0, ...dayPnl.values());
	const bestDay = Math.max(0, ...dayPnl.values());
	const totalProfit = [...dayPnl.values()].filter((v) => v > 0).reduce((s, v) => s + v, 0);

	// equity curve for drawdown
	let equity = startingBalance;
	let peak = startingBalance;
	let trailingMaxDD = 0; // worst peak-to-trough
	let staticMaxDD = 0; // worst start-to-trough (floored at 0)
	let staticBreach = false;
	let trailingBreach = false;
	for (const t of ordered) {
		equity += t.netPnl;
		if (equity > peak) peak = equity;
		const ddFromStart = startingBalance - equity;
		const ddFromPeak = peak - equity;
		if (ddFromPeak > trailingMaxDD) trailingMaxDD = ddFromPeak;
		if (ddFromStart > staticMaxDD) staticMaxDD = ddFromStart;
		if (config.maxDrawdown != null) {
			if (ddFromStart >= config.maxDrawdown) staticBreach = true;
			if (ddFromPeak >= config.maxDrawdown) trailingBreach = true;
		}
	}
	const trailing = config.drawdownType === 'trailing';
	// Report the drawdown that matches the breach definition in use, so value,
	// met, and breached are all derived from the same measure.
	const reportedMaxDD = trailing ? trailingMaxDD : staticMaxDD;
	const ddBreached = config.maxDrawdown != null && (trailing ? trailingBreach : staticBreach);

	const rules: RuleStatus[] = [];

	if (config.profitTarget != null) {
		rules.push({
			label: 'Profit target',
			met: netPnl >= config.profitTarget,
			breached: false,
			value: netPnl,
			limit: config.profitTarget,
			unit: 'money'
		});
	}
	if (config.dailyLossLimit != null) {
		rules.push({
			label: 'Daily loss limit',
			met: -worstDay < config.dailyLossLimit,
			breached: -worstDay >= config.dailyLossLimit,
			value: -worstDay,
			limit: config.dailyLossLimit,
			unit: 'money'
		});
	}
	if (config.maxDrawdown != null) {
		rules.push({
			label: `Max drawdown (${config.drawdownType ?? 'static'})`,
			met: !ddBreached,
			breached: ddBreached,
			value: reportedMaxDD,
			limit: config.maxDrawdown,
			unit: 'money'
		});
	}
	if (config.minTradingDays != null) {
		rules.push({
			label: 'Minimum trading days',
			met: tradingDays >= config.minTradingDays,
			breached: false,
			value: tradingDays,
			limit: config.minTradingDays,
			unit: 'count'
		});
	}
	if (config.consistencyPct != null) {
		// Until the account is net-profitable the rule can't be evaluated (no
		// profit to concentrate), so keep it visible but treat it as satisfied
		// rather than dropping it from the rule set entirely.
		const sharePct = totalProfit > 0 ? Math.round((bestDay / totalProfit) * 100) : 0;
		rules.push({
			label: `Consistency (best day ≤ ${config.consistencyPct}%)`,
			met: totalProfit <= 0 ? true : sharePct <= config.consistencyPct,
			breached: false,
			value: sharePct,
			limit: config.consistencyPct,
			unit: 'percent'
		});
	}

	const anyBreach = rules.some((r) => r.breached);
	const targetMet = config.profitTarget == null || netPnl >= config.profitTarget;
	const softMet = rules.every((r) => r.met);
	const overall: PropFirmStatus['overall'] = anyBreach
		? 'breached'
		: targetMet && softMet
			? 'passed'
			: 'in-progress';

	return { overall, netPnl, tradingDays, rules };
}
