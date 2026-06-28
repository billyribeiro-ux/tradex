import { and, eq } from 'drizzle-orm';
import type { DB } from '$lib/server/db';
import { instrument, optionContract } from '$lib/server/db/schema';
import { SCALE, toScaled } from '$lib/money';
import { contractLabel, type OptionDetails } from '$lib/domain/options';
import type { AssetClass } from '$lib/domain/enums';

const OPTION_MULTIPLIER = 100 * SCALE;

/** Common futures point-values so P&L is right without manual setup. */
const FUTURES_MULTIPLIERS: Record<string, number> = {
	ES: 50,
	MES: 5,
	NQ: 20,
	MNQ: 2,
	YM: 5,
	MYM: 0.5,
	RTY: 50,
	M2K: 5,
	CL: 1000,
	MCL: 100,
	GC: 100,
	MGC: 10,
	SI: 5000,
	NG: 10000,
	ZB: 1000,
	ZN: 1000
};

/** Sensible default contract multiplier for an instrument we just discovered. */
export function defaultMultiplier(symbol: string, assetClass: AssetClass): number {
	if (assetClass === 'option') return 100 * SCALE;
	if (assetClass === 'future') {
		const root = symbol.replace(/[^A-Za-z].*$/, '').toUpperCase();
		const m = FUTURES_MULTIPLIERS[root];
		if (m != null) return toScaled(m);
	}
	return SCALE; // 1.0
}

export async function findOrCreateInstrument(
	db: DB,
	p: {
		symbol: string;
		assetClass: AssetClass;
		exchange?: string | null;
		multiplier?: number;
		tickSize?: number | null;
		currency?: string;
	}
) {
	const symbol = p.symbol.toUpperCase();
	const existing = await db
		.select()
		.from(instrument)
		.where(and(eq(instrument.symbol, symbol), eq(instrument.assetClass, p.assetClass)))
		.limit(1);
	if (existing[0]) return existing[0];

	const [created] = await db
		.insert(instrument)
		.values({
			symbol,
			assetClass: p.assetClass,
			exchange: p.exchange ?? null,
			multiplier: p.multiplier ?? defaultMultiplier(symbol, p.assetClass),
			tickSize: p.tickSize ?? null,
			currency: p.currency ?? 'USD'
		})
		.returning();
	return created!;
}

/**
 * Resolve a single-leg option contract to the instrument that grouping/P&L runs
 * against. Each distinct (underlying, type, strike, expiry) is its own option
 * instrument (identity = canonical contract label, multiplier 100×) so different
 * strikes/expiries never net against each other; the structured `optionContract`
 * row (linked to the underlying instrument) backs display and analytics.
 */
export async function findOrCreateOptionContract(db: DB, d: OptionDetails) {
	const underlying = await findOrCreateInstrument(db, {
		symbol: d.underlying,
		assetClass: 'stock'
	});
	const inst = await findOrCreateInstrument(db, {
		symbol: contractLabel(d),
		assetClass: 'option',
		multiplier: OPTION_MULTIPLIER
	});
	const [existing] = await db
		.select()
		.from(optionContract)
		.where(
			and(
				eq(optionContract.underlyingInstrumentId, underlying.id),
				eq(optionContract.type, d.type),
				eq(optionContract.strike, d.strike),
				eq(optionContract.expiry, d.expiry)
			)
		)
		.limit(1);
	if (existing) return { instrument: inst, contract: existing };

	const [contract] = await db
		.insert(optionContract)
		.values({
			underlyingInstrumentId: underlying.id,
			type: d.type,
			strike: d.strike,
			expiry: d.expiry,
			multiplier: OPTION_MULTIPLIER
		})
		.returning();
	return { instrument: inst, contract: contract! };
}
