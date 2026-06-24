import { mulScaled, divScaled, SCALE } from '$lib/money';
import type { ExecInput, GroupOptions, GroupedTrade } from './types';

/**
 * Group a chronological sequence of raw executions for a SINGLE instrument
 * (and option contract, if any) into round-trip trades.
 *
 * Handles the cases every journal lives or dies on:
 *  - scale-in  (add to an open position; average-cost basis)
 *  - scale-out (partial exits; realized P&L against the running avg entry)
 *  - reversals (a fill that crosses through zero closes the current trade and
 *    opens a new one in the opposite direction with the remainder)
 *  - fees & commissions (summed per trade; split pro-rata on reversal fills)
 *  - positions that never close (status = 'open')
 *
 * This function is pure: scaled-integer in, scaled-integer out, no I/O.
 */
export function groupExecutions(
	executions: readonly ExecInput[],
	options: GroupOptions = {}
): GroupedTrade[] {
	const multiplier = options.multiplier ?? SCALE;
	const sorted = [...executions].sort((a, b) => a.executedAt - b.executedAt || cmpId(a.id, b.id));

	const trades: GroupedTrade[] = [];
	let open: OpenState | null = null;

	for (const ex of sorted) {
		const signed = ex.side === 'buy' ? ex.qty : -ex.qty;
		const fee = (ex.fee ?? 0) + (ex.commission ?? 0);

		if (open === null) {
			open = startTrade(ex, signed, fee);
			continue;
		}

		const sameDirection = Math.sign(signed) === open.sign;
		if (sameDirection) {
			// scale-in: update average-cost entry
			addToEntry(open, ex, fee);
			continue;
		}

		// opposite direction: reduce the open position (an exit)
		const closingQty = Math.min(ex.qty, open.openQty);
		const closingFeePortion = ex.qty > 0 ? mulScaled(fee, divScaled(closingQty, ex.qty)) : fee;
		reducePosition(open, closingQty, ex.price, closingFeePortion, multiplier, ex);

		if (open.openQty <= 0) {
			// position fully closed (and possibly reversed)
			const reversedQty = ex.qty - closingQty;
			finalizeClosed(open, ex.executedAt);
			trades.push(open.trade);

			if (reversedQty > 0) {
				// remainder opens a new trade in the opposite direction
				const openingFeePortion = fee - closingFeePortion;
				open = startTrade(
					{ ...ex, qty: reversedQty },
					Math.sign(signed) * reversedQty,
					openingFeePortion
				);
			} else {
				open = null;
			}
		}
	}

	if (open !== null) {
		finalizeOpen(open);
		trades.push(open.trade);
	}

	return trades;
}

// ---------------------------------------------------------------------------

interface OpenState {
	sign: 1 | -1;
	/** scaled — quantity currently open. */
	openQty: number;
	/** scaled — running average-cost entry price. */
	avgEntry: number;
	/** scaled — accumulators for finalization. */
	exitNotional: number;
	totalExitQty: number;
	trade: GroupedTrade;
}

function startTrade(ex: ExecInput, signed: number, fee: number): OpenState {
	const sign = signed >= 0 ? 1 : -1;
	const trade: GroupedTrade = {
		direction: sign === 1 ? 'long' : 'short',
		status: 'open',
		openedAt: ex.executedAt,
		closedAt: null,
		qtyOpened: ex.qty,
		qtyClosed: 0,
		qtyRemaining: ex.qty,
		avgEntry: ex.price,
		avgExit: null,
		grossPnl: 0,
		fees: fee,
		netPnl: 0,
		holdMs: null,
		executionIds: [ex.id]
	};
	return { sign, openQty: ex.qty, avgEntry: ex.price, exitNotional: 0, totalExitQty: 0, trade };
}

function addToEntry(state: OpenState, ex: ExecInput, fee: number): void {
	// new avg = (avgEntry*openQty + price*qty) / (openQty + qty)
	const numerator = mulScaled(state.avgEntry, state.openQty) + mulScaled(ex.price, ex.qty);
	const newOpenQty = state.openQty + ex.qty;
	state.avgEntry = divScaled(numerator, newOpenQty);
	state.openQty = newOpenQty;
	state.trade.avgEntry = state.avgEntry;
	state.trade.qtyOpened += ex.qty;
	state.trade.qtyRemaining += ex.qty;
	state.trade.fees += fee;
	pushExec(state.trade, ex.id);
}

function reducePosition(
	state: OpenState,
	closingQty: number,
	price: number,
	fee: number,
	multiplier: number,
	ex: ExecInput
): void {
	// realized = closingQty * (price - avgEntry) * sign * multiplier
	const priceDiff = price - state.avgEntry;
	const perUnit = mulScaled(closingQty, priceDiff);
	const realized = mulScaled(perUnit, multiplier) * state.sign;
	state.trade.grossPnl += realized;
	state.trade.fees += fee;
	state.trade.qtyClosed += closingQty;
	state.trade.qtyRemaining -= closingQty;
	state.openQty -= closingQty;
	state.exitNotional += mulScaled(closingQty, price);
	state.totalExitQty += closingQty;
	pushExec(state.trade, ex.id);
}

function finalizeClosed(state: OpenState, closedAt: number): void {
	state.trade.status = 'closed';
	state.trade.closedAt = closedAt;
	state.trade.holdMs = closedAt - state.trade.openedAt;
	state.trade.avgExit =
		state.totalExitQty > 0 ? divScaled(state.exitNotional, state.totalExitQty) : null;
	state.trade.qtyRemaining = 0;
	state.trade.netPnl = state.trade.grossPnl - state.trade.fees;
}

function finalizeOpen(state: OpenState): void {
	// partially or wholly open: realized P&L only on the closed portion
	state.trade.avgExit =
		state.totalExitQty > 0 ? divScaled(state.exitNotional, state.totalExitQty) : null;
	state.trade.netPnl = state.trade.grossPnl - state.trade.fees;
}

function pushExec(trade: GroupedTrade, id: string): void {
	if (!trade.executionIds.includes(id)) trade.executionIds.push(id);
}

function cmpId(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}
