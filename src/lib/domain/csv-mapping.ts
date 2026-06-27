import { toScaled } from '$lib/money';
import { naiveToUtc } from '$lib/datetime';
import { ASSET_CLASSES, type AssetClass, type Side } from './enums';

/**
 * Forgiving CSV mapping — the antidote to the industry's #1 complaint
 * ("uploads rejected on format"). We auto-detect columns by fuzzy header match,
 * normalize messy broker values (BOT/SLD, "Buy to Open", 1,234.50), and report
 * per-row errors WITHOUT discarding the whole file. All pure & unit-tested.
 */

export type FieldTarget =
	| 'symbol'
	| 'side'
	| 'qty'
	| 'price'
	| 'fee'
	| 'commission'
	| 'executedAt'
	| 'assetClass'
	| 'brokerExecId';

/** target -> source header name */
export type ColumnMap = Partial<Record<FieldTarget, string>>;

/** Ordered field metadata for the interactive column mapper UI. */
export const FIELD_TARGETS: { key: FieldTarget; label: string; required: boolean }[] = [
	{ key: 'symbol', label: 'Symbol', required: true },
	{ key: 'side', label: 'Side (buy/sell)', required: true },
	{ key: 'qty', label: 'Quantity', required: true },
	{ key: 'price', label: 'Price', required: true },
	{ key: 'executedAt', label: 'Date / time', required: true },
	{ key: 'fee', label: 'Fee', required: false },
	{ key: 'commission', label: 'Commission', required: false },
	{ key: 'assetClass', label: 'Asset class', required: false },
	{ key: 'brokerExecId', label: 'Broker exec ID', required: false }
];

export interface NormalizedExecRow {
	symbol: string;
	assetClass?: AssetClass;
	side: Side;
	/** scaled */ qty: number;
	/** scaled */ price: number;
	/** scaled */ fee: number;
	/** scaled */ commission: number;
	/** ms */ executedAt: number;
	brokerExecId?: string;
}

export interface FieldError {
	field: FieldTarget;
	value: string;
	message: string;
}

export type MapRowResult =
	| { ok: true; value: NormalizedExecRow }
	| { ok: false; errors: FieldError[] };

const SYNONYMS: Record<FieldTarget, string[]> = {
	symbol: ['symbol', 'ticker', 'instrument', 'contract', 'market', 'pair', 'underlying', 'sym'],
	side: ['side', 'action', 'bs', 'buysell', 'direction', 'transactiontype', 'ordertype'],
	qty: ['qty', 'quantity', 'shares', 'size', 'volume', 'contracts', 'units', 'filledqty', 'amount'],
	price: ['price', 'fillprice', 'avgprice', 'executionprice', 'rate', 'avgfillprice', 'tradeprice'],
	fee: ['fee', 'fees', 'exchangefee', 'regfee'],
	commission: ['commission', 'comm', 'commissions', 'brokerage'],
	executedAt: [
		'date',
		'time',
		'datetime',
		'executed',
		'executedat',
		'timestamp',
		'filltime',
		'executiontime',
		'datetimeutc',
		'tradedate',
		'transactiondate',
		'tradetime'
	],
	assetClass: ['assetclass', 'asset', 'class', 'securitytype', 'instrumenttype'],
	brokerExecId: ['execid', 'executionid', 'tradeid', 'orderid', 'transactionid', 'id', 'reference']
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Auto-detect which source header maps to each target field. */
export function detectColumns(headers: readonly string[]): ColumnMap {
	const map: ColumnMap = {};
	const used = new Set<string>();
	const normed = headers.map((h) => ({ raw: h, n: norm(h) }));

	for (const target of Object.keys(SYNONYMS) as FieldTarget[]) {
		const syns = SYNONYMS[target];
		// 1) exact normalized match, then 2) substring match — but only for
		// synonyms >= 4 chars, so a short token like 'id' can't steal "Bid"/"Mid"
		// via substring (it still matches "ID" exactly in pass 1).
		const found =
			normed.find((h) => !used.has(h.raw) && syns.includes(h.n)) ??
			normed.find(
				(h) =>
					!used.has(h.raw) &&
					syns.some((s) => s.length >= 4 && (h.n.includes(s) || s.includes(h.n)))
			);
		if (found) {
			map[target] = found.raw;
			used.add(found.raw);
		}
	}
	return map;
}

/** Map and validate a single CSV row. Never throws — returns per-field errors. */
export function mapRow(
	row: Record<string, string>,
	map: ColumnMap,
	timezone = 'UTC'
): MapRowResult {
	const errors: FieldError[] = [];
	const get = (t: FieldTarget) => (map[t] ? (row[map[t]!] ?? '').trim() : '');

	const symbol = get('symbol');
	if (!symbol) errors.push({ field: 'symbol', value: symbol, message: 'Missing symbol' });

	const sideRaw = get('side');
	const side = normalizeSide(sideRaw);
	if (!side)
		errors.push({ field: 'side', value: sideRaw, message: `Unrecognized side "${sideRaw}"` });

	const qtyRaw = get('qty');
	const qty = parseDecimal(qtyRaw);
	if (qty == null || qty <= 0)
		errors.push({ field: 'qty', value: qtyRaw, message: `Invalid quantity "${qtyRaw}"` });

	const priceRaw = get('price');
	const price = parseDecimal(priceRaw);
	if (price == null || price <= 0)
		errors.push({ field: 'price', value: priceRaw, message: `Invalid price "${priceRaw}"` });

	const executedRaw = get('executedAt');
	const executedAt = parseTimestamp(executedRaw, timezone);
	if (executedAt == null)
		errors.push({
			field: 'executedAt',
			value: executedRaw,
			message: `Unparseable date "${executedRaw}"`
		});

	const fee = parseDecimal(get('fee')) ?? 0;
	const commission = parseDecimal(get('commission')) ?? 0;
	const assetClass = normalizeAssetClass(get('assetClass'));
	const brokerExecId = get('brokerExecId') || undefined;

	if (errors.length > 0) return { ok: false, errors };

	return {
		ok: true,
		value: {
			symbol: symbol.toUpperCase(),
			assetClass,
			side: side!,
			qty: toScaled(qty!),
			price: toScaled(price!),
			fee: toScaled(Math.abs(fee)),
			commission: toScaled(Math.abs(commission)),
			executedAt: executedAt!,
			brokerExecId
		}
	};
}

export function normalizeSide(raw: string): Side | null {
	const v = raw.toLowerCase().replace(/[^a-z]/g, '');
	if (!v) return null;
	if (['buy', 'b', 'bot', 'bought', 'long', 'buytoopen', 'buytoclose', 'bto', 'btc'].includes(v))
		return 'buy';
	if (['sell', 's', 'sld', 'sold', 'short', 'selltoopen', 'selltoclose', 'sto', 'stc'].includes(v))
		return 'sell';
	return null;
}

export function normalizeAssetClass(raw: string): AssetClass | undefined {
	const v = raw.toLowerCase().replace(/[^a-z]/g, '');
	if (!v) return undefined;
	const direct = (ASSET_CLASSES as readonly string[]).find((c) => c === v || v.startsWith(c));
	if (direct) return direct as AssetClass;
	if (['equity', 'shares', 'stk', 'common'].includes(v)) return 'stock';
	if (['fut', 'futures'].includes(v)) return 'future';
	if (['fx', 'currency'].includes(v)) return 'forex';
	if (['opt', 'options'].includes(v)) return 'option';
	if (['coin', 'spot'].includes(v)) return 'crypto';
	return undefined;
}

/** Parse "1,234.50", "(1.5)" (negative), "$10" -> number. */
export function parseDecimal(raw: string): number | null {
	if (!raw) return null;
	let s = raw.trim().replace(/[$,\s]/g, '');
	let negative = false;
	if (/^\(.*\)$/.test(s)) {
		negative = true;
		s = s.slice(1, -1);
	}
	if (s.startsWith('-')) {
		negative = true;
		s = s.slice(1);
	}
	if (s === '' || !/^\d*\.?\d+$/.test(s)) return null;
	const n = Number(s);
	if (!Number.isFinite(n)) return null;
	return negative ? -n : n;
}

/**
 * Parse a date string or epoch number into UTC epoch ms.
 *
 * A naive (offset-less) datetime is interpreted in the account's `timezone`,
 * not as UTC — a NY trader importing "2026-06-24 14:30:00" means 14:30 ET
 * (18:30 UTC), not 14:30 UTC. Strings carrying an explicit offset (Z / ±HH:MM)
 * are honoured as-is. Date-only values map to UTC midnight (no wall-clock to
 * place). The ISO detection is anchored to `YYYY-MM-DD` so tz-named strings
 * like "... EDT" (which contain a 'T') aren't mis-detected as ISO.
 */
// Sane bounds for a trade timestamp; anything outside is rejected (→ row error)
// rather than silently accepted, so a stray numeric in the date column doesn't
// become a year-2255 trade.
const EPOCH_MIN = Date.UTC(2000, 0, 1);
const EPOCH_MAX = Date.UTC(2100, 0, 1);
const plausible = (ms: number) => ms >= EPOCH_MIN && ms < EPOCH_MAX;

export function parseTimestamp(raw: string, timezone = 'UTC'): number | null {
	if (!raw) return null;
	const s = raw.trim();
	// epoch seconds / ms — only when the result is a plausible trade date
	if (/^\d{10}$/.test(s)) {
		const ms = Number(s) * 1000;
		return plausible(ms) ? ms : null;
	}
	if (/^\d{13}$/.test(s)) {
		const ms = Number(s);
		return plausible(ms) ? ms : null;
	}

	// Anchored ISO-ish date or datetime with an optional offset designator.
	const m = s.match(
		/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?\s*([zZ]|[+-]\d{2}:?\d{2})?$/
	);
	if (m) {
		const y = Number(m[1]);
		const mo = Number(m[2]);
		const d = Number(m[3]);
		const h = m[4];
		if (h === undefined) return Date.UTC(y, mo - 1, d); // date only → UTC midnight
		const mi = Number(m[5] ?? 0);
		const sec = Number(m[6] ?? 0);
		const offset = m[7];
		if (offset) {
			const iso = `${m[1]}-${m[2]}-${m[3]}T${h}:${m[5] ?? '00'}:${m[6] ?? '00'}${offset}`;
			const t = Date.parse(iso);
			return Number.isNaN(t) ? null : t;
		}
		// naive wall-clock → interpret in the account timezone
		return naiveToUtc(y, mo - 1, d, Number(h), mi, sec, timezone);
	}

	// Fallback for other formats (e.g. "Jun 24 2026 14:30 EDT"): lenient parse,
	// which honours named/offset zones where the engine supports them.
	const t = Date.parse(s);
	return Number.isNaN(t) ? null : t;
}
