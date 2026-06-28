import { toScaled, fromScaled } from '$lib/money';
import type { OptionType } from './enums';

/**
 * Pure helpers for single-leg option contracts. An option's identity is its
 * (underlying, expiry, type, strike) — NOT just the ticker — so each contract
 * must map to a distinct instrument or different strikes/expiries would
 * incorrectly net against each other in the grouping engine.
 */

export interface OptionDetails {
	underlying: string;
	type: OptionType;
	/** scaled (minor units) */
	strike: number;
	/** UTC epoch ms of the expiry date (midnight UTC) */
	expiry: number;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Parse an OCC-style option symbol into its parts, or null if it isn't one.
 * OCC = Root(1-6) + YYMMDD + C|P + strike×1000 (8 digits), e.g.
 * "AAPL  240920C00190000" / "AAPL240920C00190000" / "SPXW250117P05000000".
 */
export function parseOccSymbol(raw: string): OptionDetails | null {
	if (!raw) return null;
	const s = raw.replace(/\s+/g, '').toUpperCase();
	const m = s.match(/^([A-Z]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
	if (!m) return null;
	const [, root, yy, mm, dd, cp, strike8] = m;
	const month = Number(mm);
	const day = Number(dd);
	if (month < 1 || month > 12 || day < 1 || day > 31) return null;
	const expiry = Date.UTC(2000 + Number(yy), month - 1, day);
	const strike = toScaled(Number(strike8) / 1000);
	return { underlying: root!, type: cp === 'C' ? 'call' : 'put', strike, expiry };
}

/** Strike formatted compactly (no trailing zeros): 190, 187.5. */
export function formatStrike(strikeScaled: number): string {
	const n = fromScaled(strikeScaled);
	return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

/** Expiry as DDMMMYY, e.g. 20SEP24. */
function expiryCode(expiry: number): string {
	const d = new Date(expiry);
	const dd = String(d.getUTCDate()).padStart(2, '0');
	const yy = String(d.getUTCFullYear()).slice(-2);
	return `${dd}${MONTHS[d.getUTCMonth()]}${yy}`;
}

/**
 * Canonical, human-readable contract symbol used as the option instrument's
 * identity AND shown in the trade log, e.g. "AAPL 190C 20SEP24". Stable for a
 * given contract regardless of whether it was typed or imported from OCC.
 */
export function contractLabel(d: OptionDetails): string {
	const cp = d.type === 'call' ? 'C' : 'P';
	return `${d.underlying.toUpperCase()} ${formatStrike(d.strike)}${cp} ${expiryCode(d.expiry)}`;
}

/** Break-even underlying price (scaled): call = strike + premium, put = strike − premium. */
export function breakeven(type: OptionType, strikeScaled: number, premiumScaled: number): number {
	return type === 'call' ? strikeScaled + premiumScaled : strikeScaled - premiumScaled;
}

/** Whole days to expiry from `from` (ms). Negative once expired. */
export function daysToExpiry(expiry: number, from: number): number {
	return Math.ceil((expiry - from) / 86_400_000);
}
