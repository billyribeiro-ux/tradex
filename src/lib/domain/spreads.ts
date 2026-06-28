import { fromScaled } from '$lib/money';
import type { OptionType, Side } from './enums';

/**
 * Pure helpers for multi-leg option structures (verticals, straddles, condors…).
 *
 * A spread is several option legs traded as one position. Each leg is its own
 * contract (type, strike, expiry) bought or sold in some quantity. These
 * functions classify the structure and derive its entry-time risk profile
 * (net debit/credit, defined max profit / max loss) from the legs alone — they
 * never touch the database, so they are exhaustively unit-testable. Realized
 * P&L is the sum of the per-leg trades and is computed in the service layer.
 */

/** One leg of a structure. Money/strike/premium are scaled; qty is scaled contracts. */
export interface SpreadLeg {
	type: OptionType;
	side: Side;
	/** scaled */ strike: number;
	/** UTC epoch ms */ expiry: number;
	/** scaled number of contracts */ qty: number;
	/** scaled premium per share */ entryPremium: number;
	/** scaled premium per share */ exitPremium?: number | null;
}

export type SpreadKey =
	| 'single'
	| 'vertical'
	| 'straddle'
	| 'strangle'
	| 'calendar'
	| 'diagonal'
	| 'iron_condor'
	| 'iron_butterfly'
	| 'butterfly'
	| 'custom';

export interface SpreadClassification {
	key: SpreadKey;
	/** Human-readable name, e.g. "Bull Call Spread", "Iron Condor". */
	label: string;
}

/** Standard listed-option contract multiplier (100 shares per contract). */
const CONTRACT_MULTIPLIER = 100;

const isBuy = (l: SpreadLeg) => l.side === 'buy';

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/** Identify the option structure from its legs. Falls back to "Custom". */
export function classifySpread(legs: SpreadLeg[]): SpreadClassification {
	if (legs.length === 0) return { key: 'custom', label: 'Custom' };
	if (legs.length === 1) {
		const l = legs[0]!;
		return {
			key: 'single',
			label: `${isBuy(l) ? 'Long' : 'Short'} ${l.type === 'call' ? 'Call' : 'Put'}`
		};
	}
	if (legs.length === 2) return classifyTwoLeg(legs[0]!, legs[1]!);
	if (legs.length === 3) return classifyThreeLeg(legs);
	if (legs.length === 4) return classifyFourLeg(legs);
	return { key: 'custom', label: 'Custom' };
}

function classifyTwoLeg(a: SpreadLeg, b: SpreadLeg): SpreadClassification {
	const sameType = a.type === b.type;
	const sameExpiry = a.expiry === b.expiry;
	const sameSide = a.side === b.side;
	const sameStrike = a.strike === b.strike;
	const sameQty = a.qty === b.qty;

	// Vertical: same type & expiry, opposite sides, different strikes, equal qty.
	if (sameType && sameExpiry && !sameStrike && !sameSide && sameQty) {
		return { key: 'vertical', label: verticalLabel(a, b) };
	}
	// Straddle / strangle: one call + one put, same side, same expiry.
	if (!sameType && sameSide && sameExpiry) {
		const dir = isBuy(a) ? 'Long' : 'Short';
		return sameStrike
			? { key: 'straddle', label: `${dir} Straddle` }
			: { key: 'strangle', label: `${dir} Strangle` };
	}
	// Calendar: same type & strike, different expiry, opposite sides.
	if (sameType && sameStrike && !sameExpiry && !sameSide) {
		return { key: 'calendar', label: 'Calendar Spread' };
	}
	// Diagonal: same type, different strike AND expiry, opposite sides.
	if (sameType && !sameStrike && !sameExpiry && !sameSide) {
		return { key: 'diagonal', label: 'Diagonal Spread' };
	}
	return { key: 'custom', label: 'Custom' };
}

function verticalLabel(a: SpreadLeg, b: SpreadLeg): string {
	const buy = isBuy(a) ? a : b;
	const sell = isBuy(a) ? b : a;
	if (a.type === 'call') {
		// Buying the lower strike call is bullish (debit); buying the higher is bearish (credit).
		return buy.strike < sell.strike ? 'Bull Call Spread' : 'Bear Call Spread';
	}
	// Puts: buying the higher strike put is bearish (debit); buying the lower is bullish (credit).
	return buy.strike > sell.strike ? 'Bear Put Spread' : 'Bull Put Spread';
}

function classifyThreeLeg(legs: SpreadLeg[]): SpreadClassification {
	const sameType = legs.every((l) => l.type === legs[0]!.type);
	const sameExpiry = legs.every((l) => l.expiry === legs[0]!.expiry);
	if (!sameType || !sameExpiry) return { key: 'custom', label: 'Custom' };

	const [low, mid, high] = [...legs].sort((x, y) => x.strike - y.strike);
	const equallySpaced = mid!.strike - low!.strike === high!.strike - mid!.strike;
	const outerSameSide = low!.side === high!.side;
	const middleOpposite = mid!.side !== low!.side;
	// 1-2-1 ratio: the wings share a qty and the body is double.
	const lowQty = fromScaled(low!.qty);
	const ratio121 = low!.qty === high!.qty && Math.abs(fromScaled(mid!.qty) - 2 * lowQty) < 1e-9;

	if (equallySpaced && outerSameSide && middleOpposite && ratio121) {
		return {
			key: 'butterfly',
			label: `${isBuy(low!) ? 'Long' : 'Short'} ${legs[0]!.type === 'call' ? 'Call' : 'Put'} Butterfly`
		};
	}
	return { key: 'custom', label: 'Custom' };
}

function classifyFourLeg(legs: SpreadLeg[]): SpreadClassification {
	const calls = legs.filter((l) => l.type === 'call');
	const puts = legs.filter((l) => l.type === 'put');
	const sameExpiry = legs.every((l) => l.expiry === legs[0]!.expiry);
	const sameQty = legs.every((l) => l.qty === legs[0]!.qty);
	if (calls.length !== 2 || puts.length !== 2 || !sameExpiry || !sameQty) {
		return { key: 'custom', label: 'Custom' };
	}
	const callBuy = calls.find(isBuy);
	const callSell = calls.find((l) => !isBuy(l));
	const putBuy = puts.find(isBuy);
	const putSell = puts.find((l) => !isBuy(l));
	if (!callBuy || !callSell || !putBuy || !putSell) return { key: 'custom', label: 'Custom' };

	// A short straddle body (calls & puts sold at the same strike) with long wings
	// is an iron butterfly; otherwise four distinct strikes make an iron condor.
	return callSell.strike === putSell.strike
		? { key: 'iron_butterfly', label: 'Iron Butterfly' }
		: { key: 'iron_condor', label: 'Iron Condor' };
}

// ---------------------------------------------------------------------------
// Risk profile (net debit/credit, defined max profit / max loss)
// ---------------------------------------------------------------------------

export interface SpreadRisk {
	/** scaled, signed: positive = net debit paid, negative = net credit received. */
	net: number;
	kind: 'debit' | 'credit' | 'even';
	/** scaled; null = unlimited / undefined for this structure. */
	maxProfit: number | null;
	/** scaled positive magnitude; null = unlimited / undefined for this structure. */
	maxLoss: number | null;
}

/** Signed entry cash for one leg: a buy is a positive cost, a sell is negative. */
function legCashflow(leg: SpreadLeg): number {
	const value = Math.round(leg.entryPremium * fromScaled(leg.qty) * CONTRACT_MULTIPLIER);
	return isBuy(leg) ? value : -value;
}

/** Net entry cash across all legs (positive = debit paid, negative = credit received). */
export function netDebitCredit(legs: SpreadLeg[]): number {
	return legs.reduce((acc, l) => acc + legCashflow(l), 0);
}

/** Dollar value of a strike-width over `qty` contracts (scaled). */
function widthValue(strikeA: number, strikeB: number, qtyScaled: number): number {
	return Math.round(Math.abs(strikeA - strikeB) * fromScaled(qtyScaled) * CONTRACT_MULTIPLIER);
}

/**
 * Entry-time risk profile of a structure. Max profit/loss are returned only for
 * structures whose payoff is unambiguous from the entry legs (verticals,
 * iron condors/butterflies, butterflies, and the defined side of a
 * straddle/strangle); everything else returns null (caller shows "—").
 */
export function spreadRisk(legs: SpreadLeg[]): SpreadRisk {
	const net = netDebitCredit(legs);
	const kind: SpreadRisk['kind'] = net > 0 ? 'debit' : net < 0 ? 'credit' : 'even';
	const cls = classifySpread(legs);
	let maxProfit: number | null = null;
	let maxLoss: number | null = null;

	if (cls.key === 'vertical') {
		const width = widthValue(legs[0]!.strike, legs[1]!.strike, legs[0]!.qty);
		if (net >= 0) {
			maxLoss = net;
			maxProfit = width - net;
		} else {
			const credit = -net;
			maxProfit = credit;
			maxLoss = width - credit;
		}
	} else if (cls.key === 'iron_condor' || cls.key === 'iron_butterfly') {
		if (net < 0) {
			const calls = legs.filter((l) => l.type === 'call');
			const puts = legs.filter((l) => l.type === 'put');
			const width = Math.max(
				widthValue(calls[0]!.strike, calls[1]!.strike, calls[0]!.qty),
				widthValue(puts[0]!.strike, puts[1]!.strike, puts[0]!.qty)
			);
			const credit = -net;
			maxProfit = credit;
			maxLoss = width - credit;
		}
	} else if (cls.key === 'butterfly') {
		const sorted = [...legs].sort((a, b) => a.strike - b.strike);
		const width = widthValue(sorted[1]!.strike, sorted[0]!.strike, sorted[0]!.qty);
		if (net >= 0) {
			maxLoss = net;
			maxProfit = width - net;
		} else {
			const credit = -net;
			maxProfit = credit;
			maxLoss = width - credit;
		}
	} else if (cls.key === 'straddle' || cls.key === 'strangle') {
		if (net > 0) {
			maxLoss = net; // long: loss capped at the premium paid, profit unbounded
		} else {
			maxProfit = -net; // short: profit capped at the credit, loss unbounded
		}
	}

	return { net, kind, maxProfit, maxLoss };
}

// ---------------------------------------------------------------------------
// Payoff at expiry (P&L vs underlying price) + break-evens
// ---------------------------------------------------------------------------

/** Per-share intrinsic value of one leg at an underlying price (scaled). */
function intrinsic(leg: SpreadLeg, priceScaled: number): number {
	return leg.type === 'call'
		? Math.max(priceScaled - leg.strike, 0)
		: Math.max(leg.strike - priceScaled, 0);
}

/**
 * Total structure P&L at expiry for a given underlying price (scaled). Each leg
 * settles to its intrinsic value; a long leg nets that against the premium paid,
 * a short leg against the premium received, all times qty × the 100 multiplier.
 */
export function payoffAt(legs: SpreadLeg[], priceScaled: number): number {
	let total = 0;
	for (const leg of legs) {
		const perShare = intrinsic(leg, priceScaled) - leg.entryPremium;
		const value = Math.round(perShare * fromScaled(leg.qty) * CONTRACT_MULTIPLIER);
		total += isBuy(leg) ? value : -value;
	}
	return total;
}

export interface PayoffPoint {
	/** scaled underlying price */ x: number;
	/** scaled P&L at expiry */ y: number;
}

export interface PayoffCurve {
	points: PayoffPoint[];
	/** scaled underlying prices where P&L crosses zero */
	breakevens: number[];
	/** scaled [min, max] underlying price domain sampled */
	domain: [number, number];
	/** scaled P&L extremes over the sampled domain */
	minPnl: number;
	maxPnl: number;
}

/**
 * Sample the structure's expiry payoff across a price domain padded around the
 * strikes. The payoff is piecewise-linear with kinks only at the strikes, so the
 * sample set includes every strike — segments between samples are then exactly
 * linear and zero-crossings (break-evens) interpolate precisely.
 */
export function payoffCurve(legs: SpreadLeg[], steps = 96): PayoffCurve {
	const strikes = [...new Set(legs.map((l) => l.strike))].sort((a, b) => a - b);
	const lo = strikes[0] ?? 0;
	const hi = strikes[strikes.length - 1] ?? lo;
	// Pad the domain so the flat tails and break-evens are visible even for a
	// single-strike structure (straddle), where hi === lo.
	const pad = Math.max((hi - lo) * 0.6, hi * 0.15, fromScaled(1) /* $1 floor */);
	const min = Math.max(0, Math.round(lo - pad));
	const max = Math.round(hi + pad);

	const xs = new Set<number>();
	for (let i = 0; i <= steps; i++) xs.add(Math.round(min + ((max - min) * i) / steps));
	for (const k of strikes) xs.add(k);
	const sorted = [...xs].sort((a, b) => a - b);
	const points = sorted.map((x) => ({ x, y: payoffAt(legs, x) }));

	const breakevens: number[] = [];
	for (let i = 1; i < points.length; i++) {
		const p0 = points[i - 1]!;
		const p1 = points[i]!;
		if (p0.y === 0) breakevens.push(p0.x);
		else if (p0.y < 0 !== p1.y < 0) {
			// linear interpolate the zero crossing (exact: no kink between samples)
			const t = p0.y / (p0.y - p1.y);
			breakevens.push(Math.round(p0.x + t * (p1.x - p0.x)));
		}
	}
	const last = points[points.length - 1];
	if (last && last.y === 0) breakevens.push(last.x);

	// de-duplicate near-identical crossings
	const unique: number[] = [];
	for (const b of breakevens.sort((a, b) => a - b)) {
		if (unique.length === 0 || Math.abs(b - unique[unique.length - 1]!) > fromScaled(0.01)) {
			unique.push(b);
		}
	}

	const ys = points.map((p) => p.y);
	return {
		points,
		breakevens: unique,
		domain: [min, max],
		minPnl: Math.min(...ys),
		maxPnl: Math.max(...ys)
	};
}

/** Break-even underlying price(s) of a structure (scaled), low → high. */
export function breakevenPrices(legs: SpreadLeg[]): number[] {
	return payoffCurve(legs).breakevens;
}
