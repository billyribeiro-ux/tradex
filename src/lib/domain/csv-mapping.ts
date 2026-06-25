import { toScaled } from '$lib/money';
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
		// 1) exact normalized match, then 2) header contains a synonym (longest first)
		const found =
			normed.find((h) => !used.has(h.raw) && syns.includes(h.n)) ??
			normed.find(
				(h) => !used.has(h.raw) && syns.some((s) => h.n === s || h.n.includes(s) || s.includes(h.n))
			);
		if (found) {
			map[target] = found.raw;
			used.add(found.raw);
		}
	}
	return map;
}

/** Map and validate a single CSV row. Never throws — returns per-field errors. */
export function mapRow(row: Record<string, string>, map: ColumnMap): MapRowResult {
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
	if (price == null)
		errors.push({ field: 'price', value: priceRaw, message: `Invalid price "${priceRaw}"` });

	const executedRaw = get('executedAt');
	const executedAt = parseTimestamp(executedRaw);
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

/** Parse a date string or epoch number into UTC epoch ms. */
export function parseTimestamp(raw: string): number | null {
	if (!raw) return null;
	const s = raw.trim();
	// epoch seconds / ms
	if (/^\d{10}$/.test(s)) return Number(s) * 1000;
	if (/^\d{13}$/.test(s)) return Number(s);
	// normalize "YYYY-MM-DD HH:MM:SS" -> ISO so Date treats it consistently
	let iso = s.includes('T') ? s : s.replace(/\s+/, 'T');
	// A date-time without a timezone designator is parsed as LOCAL time by JS,
	// but this system treats every executedAt as UTC epoch ms. Append 'Z' when a
	// time component is present and no offset is given. (Date-only strings are
	// already interpreted as UTC midnight, so leave those untouched.)
	const hasTime = /T\d{2}:/.test(iso);
	const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(iso);
	if (hasTime && !hasTz) iso = `${iso}Z`;
	const t = Date.parse(iso);
	if (!Number.isNaN(t)) return t;
	const t2 = Date.parse(s);
	return Number.isNaN(t2) ? null : t2;
}
