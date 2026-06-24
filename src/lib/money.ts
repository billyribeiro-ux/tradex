/**
 * Scaled-integer money / price / quantity arithmetic.
 *
 * Every monetary value, price, quantity and multiplier is stored as an integer
 * equal to `realValue * SCALE` (8 decimal places). This avoids binary float
 * drift in storage and guarantees the future Rust backend (i64) and this
 * TypeScript code agree byte-for-byte.
 *
 * Products (qty x price x multiplier) are computed with BigInt to avoid
 * overflow, then scaled back down. Exact integer representation via JS `number`
 * holds up to ~9.0e7 of a unit (Number.MAX_SAFE_INTEGER / SCALE); far beyond any
 * realistic single price, quantity, fee or per-trade P&L. Cross-trade aggregates
 * are summed in SQL (64-bit) at query time.
 */

/** Decimal places kept for all financial integers. */
export const DECIMALS = 8;
/** 10 ** DECIMALS — the integer scale factor. */
export const SCALE = 100_000_000;
const SCALE_BIG = BigInt(SCALE);

/** A scaled integer (value * SCALE). Branded for documentation only. */
export type Scaled = number;

/**
 * Convert a real decimal value (number or string) to a scaled integer.
 * Rounds half-up on the first dropped digit. String input is parsed exactly
 * (no float involved) so e.g. "0.1" + "0.2" never drifts.
 */
export function toScaled(value: number | string): Scaled {
	const str = typeof value === 'number' ? value.toFixed(DECIMALS) : value.trim();
	return Number(parseDecimalToBig(str));
}

/** Convert a scaled integer back to a real `number`. */
export function fromScaled(scaled: Scaled): number {
	return scaled / SCALE;
}

/** Multiply two scaled values, returning a scaled value. (a*S)*(b*S)/S = a*b*S */
export function mulScaled(a: Scaled, b: Scaled): Scaled {
	return Number((BigInt(Math.round(a)) * BigInt(Math.round(b))) / SCALE_BIG);
}

/** Multiply a chain of scaled values (e.g. qty * price * multiplier). */
export function mulAll(...values: Scaled[]): Scaled {
	let acc = SCALE_BIG; // == 1.0 scaled
	for (const v of values) {
		acc = (acc * BigInt(Math.round(v))) / SCALE_BIG;
	}
	return Number(acc);
}

/** Divide two scaled values, returning a scaled value. (a*S)/(b*S)*S = a/b*S */
export function divScaled(a: Scaled, b: Scaled): Scaled {
	if (b === 0) return 0;
	return Number((BigInt(Math.round(a)) * SCALE_BIG) / BigInt(Math.round(b)));
}

/** Sum scaled values (plain integer addition). */
export function sumScaled(values: Scaled[]): Scaled {
	let acc = 0;
	for (const v of values) acc += v;
	return acc;
}

/** Absolute value of a scaled integer. */
export function absScaled(a: Scaled): Scaled {
	return Math.abs(a);
}

/** Format a scaled monetary value as a currency string. */
export function formatMoney(
	scaled: Scaled,
	currency = 'USD',
	{ signed = false, locale = 'en-US' }: { signed?: boolean; locale?: string } = {}
): string {
	const value = fromScaled(scaled);
	const formatted = new Intl.NumberFormat(locale, {
		style: 'currency',
		currency,
		maximumFractionDigits: 2
	}).format(Math.abs(value));
	const sign = value < 0 ? '-' : signed ? '+' : '';
	return `${sign}${formatted}`;
}

/** Format a scaled value as a plain decimal number (trims trailing zeros, capped at maxDp). */
export function formatNumber(scaled: Scaled, maxDp = DECIMALS, locale = 'en-US'): string {
	return new Intl.NumberFormat(locale, { maximumFractionDigits: maxDp }).format(fromScaled(scaled));
}

/** Format a scaled ratio (e.g. R-multiple, profit factor) to `dp` decimals. */
export function formatRatio(scaled: Scaled, dp = 2): string {
	return fromScaled(scaled).toFixed(dp);
}

/**
 * Parse a decimal string into a scaled BigInt, rounding half-up on the first
 * dropped fractional digit. Pure integer/string math — never touches a float.
 */
function parseDecimalToBig(input: string): bigint {
	let s = input;
	if (s === '' || s === '-' || s === '+') return 0n;
	let negative = false;
	if (s[0] === '+') s = s.slice(1);
	else if (s[0] === '-') {
		negative = true;
		s = s.slice(1);
	}
	const [intPart = '0', fracPartRaw = ''] = s.split('.');
	const fracKept = fracPartRaw.slice(0, DECIMALS).padEnd(DECIMALS, '0');
	const roundDigit = fracPartRaw.charAt(DECIMALS); // first dropped digit
	let result = BigInt(intPart || '0') * SCALE_BIG + BigInt(fracKept || '0');
	if (roundDigit && Number(roundDigit) >= 5) result += 1n;
	return negative ? -result : result;
}
