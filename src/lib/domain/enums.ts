/**
 * Domain enumerations — the single source of truth for both the Drizzle schema
 * (`.$type<...>()`), Zod validation, and UI dropdowns. Keep these as `const`
 * arrays so we get both a runtime list and a literal union type.
 */

export const ASSET_CLASSES = [
	'stock',
	'future',
	'forex',
	'option',
	'crypto',
	'cfd',
	'index'
] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export const SIDES = ['buy', 'sell'] as const;
export type Side = (typeof SIDES)[number];

export const DIRECTIONS = ['long', 'short'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const TRADE_STATUSES = ['open', 'closed'] as const;
export type TradeStatus = (typeof TRADE_STATUSES)[number];

export const OPTION_TYPES = ['call', 'put'] as const;
export type OptionType = (typeof OPTION_TYPES)[number];

export const IMPORT_SOURCES = ['csv', 'manual', 'api'] as const;
export type ImportSource = (typeof IMPORT_SOURCES)[number];

export const PROP_FIRMS = [
	'ftmo',
	'topstep',
	'apex',
	'leeloo',
	'tradeify',
	'myfundedfx',
	'other'
] as const;
export type PropFirm = (typeof PROP_FIRMS)[number];

// 'eod' was removed: the engine only implements trailing vs. static, so offering
// it would silently behave as static. Re-add it alongside a real EOD branch.
export const DRAWDOWN_TYPES = ['trailing', 'static'] as const;
export type DrawdownType = (typeof DRAWDOWN_TYPES)[number];

export const ATTACHMENT_KINDS = ['image', 'voice', 'file'] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

/** Curated IANA timezones for the account picker — the major trading sessions.
 * Stored as the IANA id; day/weekday/hour bucketing resolves it via Intl. */
export const COMMON_TIMEZONES = [
	'UTC',
	'America/New_York',
	'America/Chicago',
	'America/Denver',
	'America/Los_Angeles',
	'America/Sao_Paulo',
	'Europe/London',
	'Europe/Berlin',
	'Europe/Moscow',
	'Asia/Dubai',
	'Asia/Kolkata',
	'Asia/Singapore',
	'Asia/Hong_Kong',
	'Asia/Tokyo',
	'Australia/Sydney'
] as const;

/** Human-readable labels for asset classes (UI). */
export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
	stock: 'Stocks',
	future: 'Futures',
	forex: 'Forex',
	option: 'Options',
	crypto: 'Crypto',
	cfd: 'CFDs',
	index: 'Indices'
};
