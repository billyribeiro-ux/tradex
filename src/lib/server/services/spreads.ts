import { and, eq, asc } from 'drizzle-orm';
import type { DB } from '$lib/server/db';
import { instrument, multiLegGroup, optionContract, trade } from '$lib/server/db/schema';
import { addManualTrade, deleteTrade } from './trades';
import {
	classifySpread,
	spreadRisk,
	type SpreadClassification,
	type SpreadLeg,
	type SpreadRisk
} from '$lib/domain/spreads';
import type { OptionType, Side, TradeStatus } from '$lib/domain/enums';

export interface MultiLegInputLeg {
	type: OptionType;
	side: Side;
	/** scaled */ strike: number;
	/** ms */ expiry: number;
	/** scaled contracts */ qty: number;
	/** scaled premium */ entryPremium: number;
	/** scaled premium */ exitPremium?: number | null;
}

export interface MultiLegInput {
	accountId: string;
	/** the underlying ticker shared by every leg */
	underlying: string;
	legs: MultiLegInputLeg[];
	/** ms — when the structure was opened (shared by all legs) */
	entryAt: number;
	/** ms — when it was closed (applies to legs that carry an exit premium) */
	exitAt?: number | null;
	/** scaled total fees, distributed across the legs */
	fees?: number;
	name?: string | null;
	setupId?: string | null;
	emotionId?: string | null;
	playbookId?: string | null;
	confidence?: number | null;
	notes?: string | null;
}

const toSpreadLeg = (l: MultiLegInputLeg): SpreadLeg => ({
	type: l.type,
	side: l.side,
	strike: l.strike,
	expiry: l.expiry,
	qty: l.qty,
	entryPremium: l.entryPremium,
	exitPremium: l.exitPremium ?? null
});

/**
 * Record a multi-leg option structure: classify it, create one option trade per
 * leg (reusing the single-leg path so each leg gets its own contract instrument
 * and the 100× multiplier), and bind every leg to a shared multi_leg_group.
 * Wrapped in a transaction so a partially-built structure never persists.
 */
export async function createMultiLegTrade(
	db: DB,
	input: MultiLegInput
): Promise<{ groupId: string; tradeIds: string[]; strategy: string }> {
	const cls = classifySpread(input.legs.map(toSpreadLeg));
	const n = input.legs.length;
	const totalFees = input.fees ?? 0;
	// Split fees evenly across legs; the remainder lands on the first leg so the
	// per-leg fees sum back to exactly the total the user entered.
	const baseFee = Math.floor(totalFees / n);
	const feeRemainder = totalFees - baseFee * n;

	return db.transaction(async (tx) => {
		const [group] = await tx
			.insert(multiLegGroup)
			.values({ accountId: input.accountId, name: input.name ?? null, strategy: cls.label })
			.returning({ id: multiLegGroup.id });
		const groupId = group!.id;

		const tradeIds: string[] = [];
		for (let i = 0; i < input.legs.length; i++) {
			const leg = input.legs[i]!;
			const tradeId = await addManualTrade(tx, {
				accountId: input.accountId,
				symbol: input.underlying,
				assetClass: 'option',
				direction: leg.side === 'buy' ? 'long' : 'short',
				qty: leg.qty,
				entryPrice: leg.entryPremium,
				exitPrice: leg.exitPremium ?? null,
				entryAt: input.entryAt,
				exitAt: leg.exitPremium != null ? (input.exitAt ?? null) : null,
				fees: baseFee + (i === 0 ? feeRemainder : 0),
				option: { type: leg.type, strike: leg.strike, expiry: leg.expiry },
				setupId: input.setupId ?? null,
				emotionId: input.emotionId ?? null,
				playbookId: input.playbookId ?? null,
				confidence: input.confidence ?? null,
				notes: input.notes ?? null
			});
			await tx.update(trade).set({ multiLegGroupId: groupId }).where(eq(trade.id, tradeId));
			tradeIds.push(tradeId);
		}

		return { groupId, tradeIds, strategy: cls.label };
	});
}

export interface MultiLegLeg {
	trade: typeof trade.$inferSelect;
	instrument: typeof instrument.$inferSelect;
	contract: typeof optionContract.$inferSelect;
}

export interface MultiLegGroupDetail {
	group: typeof multiLegGroup.$inferSelect;
	legs: MultiLegLeg[];
	classification: SpreadClassification;
	risk: SpreadRisk;
	realized: {
		grossPnl: number;
		netPnl: number;
		fees: number;
		status: TradeStatus;
		openedAt: number;
		closedAt: number | null;
	};
}

/**
 * Load a structure for display: its legs (each with contract + instrument), the
 * re-derived classification & entry risk profile, and the realized P&L rolled up
 * across the legs. Account-scoped — returns null if the group isn't this account's.
 */
export async function getMultiLegGroup(
	db: DB,
	accountId: string,
	groupId: string
): Promise<MultiLegGroupDetail | null> {
	const [group] = await db
		.select()
		.from(multiLegGroup)
		.where(and(eq(multiLegGroup.id, groupId), eq(multiLegGroup.accountId, accountId)))
		.limit(1);
	if (!group) return null;

	const rows = await db
		.select({ trade, instrument, contract: optionContract })
		.from(trade)
		.innerJoin(instrument, eq(trade.instrumentId, instrument.id))
		.innerJoin(optionContract, eq(trade.optionContractId, optionContract.id))
		.where(and(eq(trade.multiLegGroupId, groupId), eq(trade.accountId, accountId)))
		.orderBy(asc(optionContract.expiry), asc(optionContract.strike));
	if (rows.length === 0) return null;

	const legs: MultiLegLeg[] = rows.map((r) => ({
		trade: r.trade,
		instrument: r.instrument,
		contract: r.contract
	}));

	// Reconstruct the entry legs from each leg-trade to re-derive the structure.
	const spreadLegs: SpreadLeg[] = legs.map((l) => ({
		type: l.contract.type as OptionType,
		side: l.trade.direction === 'long' ? 'buy' : 'sell',
		strike: l.contract.strike,
		expiry: l.contract.expiry,
		qty: l.trade.qtyOpened,
		entryPremium: l.trade.avgEntry,
		exitPremium: l.trade.avgExit
	}));

	const grossPnl = legs.reduce((acc, l) => acc + l.trade.grossPnl, 0);
	const netPnl = legs.reduce((acc, l) => acc + l.trade.netPnl, 0);
	const fees = legs.reduce((acc, l) => acc + l.trade.fees, 0);
	const status: TradeStatus = legs.some((l) => l.trade.status === 'open') ? 'open' : 'closed';
	const openedAt = Math.min(...legs.map((l) => l.trade.openedAt));
	const closedAt =
		status === 'closed' ? Math.max(...legs.map((l) => l.trade.closedAt ?? l.trade.openedAt)) : null;

	return {
		group,
		legs,
		classification: classifySpread(spreadLegs),
		risk: spreadRisk(spreadLegs),
		realized: { grossPnl, netPnl, fees, status, openedAt, closedAt }
	};
}

/**
 * Delete a structure as a unit: every leg trade (and the executions it owns) plus
 * the group row. Account-scoped; returns false if the group isn't this account's.
 */
export async function deleteMultiLegGroup(
	db: DB,
	accountId: string,
	groupId: string
): Promise<boolean> {
	const [group] = await db
		.select({ id: multiLegGroup.id })
		.from(multiLegGroup)
		.where(and(eq(multiLegGroup.id, groupId), eq(multiLegGroup.accountId, accountId)))
		.limit(1);
	if (!group) return false;

	const legs = await db
		.select({ id: trade.id })
		.from(trade)
		.where(and(eq(trade.multiLegGroupId, groupId), eq(trade.accountId, accountId)));
	for (const l of legs) await deleteTrade(db, accountId, l.id);
	await db.delete(multiLegGroup).where(eq(multiLegGroup.id, groupId));
	return true;
}
