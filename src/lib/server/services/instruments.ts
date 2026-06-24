import { and, eq } from 'drizzle-orm';
import type { DB } from '$lib/server/db';
import { instrument } from '$lib/server/db/schema';
import { SCALE, toScaled } from '$lib/money';
import type { AssetClass } from '$lib/domain/enums';

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
