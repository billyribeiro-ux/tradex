import { and, eq, desc, inArray, gte, lte, sql } from 'drizzle-orm';
import type { DB } from '$lib/server/db';
import { execution, instrument, trade, tradeExecution } from '$lib/server/db/schema';
import { groupExecutions } from '$lib/domain/grouping';
import { computeRMultiple } from '$lib/domain/metrics';
import { executionDedupeKey } from '$lib/domain/dedupe';
import type { ExecInput } from '$lib/domain/types';
import type { AssetClass, Direction, Side } from '$lib/domain/enums';
import { findOrCreateInstrument } from './instruments';
import { getTradeCategorization } from './categorization';

export interface ExecutionInput {
	side: Side;
	/** scaled */ qty: number;
	/** scaled */ price: number;
	/** scaled */ fee?: number;
	/** scaled */ commission?: number;
	/** ms */ executedAt: number;
	brokerExecId?: string | null;
	optionContractId?: string | null;
}

/**
 * Insert executions (idempotent via dedupe key) for one instrument, then rebuild
 * the derived trades for that instrument. Returns the number actually inserted
 * vs. skipped as duplicates.
 */
export async function recordExecutions(
	db: DB,
	accountId: string,
	instrumentId: string,
	execs: ExecutionInput[]
): Promise<{ inserted: number; duplicates: number }> {
	let inserted = 0;
	let duplicates = 0;
	for (const e of execs) {
		const dedupeHash = executionDedupeKey({
			instrumentKey: instrumentId,
			side: e.side,
			qty: e.qty,
			price: e.price,
			executedAt: e.executedAt,
			brokerExecId: e.brokerExecId
		});
		const res = await db
			.insert(execution)
			.values({
				accountId,
				instrumentId,
				optionContractId: e.optionContractId ?? null,
				side: e.side,
				qty: e.qty,
				price: e.price,
				fee: e.fee ?? 0,
				commission: e.commission ?? 0,
				executedAt: e.executedAt,
				brokerExecId: e.brokerExecId ?? null,
				dedupeHash
			})
			.onConflictDoNothing()
			.returning({ id: execution.id });
		if (res.length > 0) inserted++;
		else duplicates++;
	}
	if (inserted > 0) await regroupInstrument(db, accountId, instrumentId);
	return { inserted, duplicates };
}

const naturalKey = (openedAt: number, direction: Direction) => `${openedAt}:${direction}`;

/**
 * Re-derive trades for one (account, instrument) from its executions, upserting
 * by (openedAt, direction) so user annotations (setup, tags, notes, planned
 * levels, confidence) survive a re-import. Stale derived trades are removed.
 */
export async function regroupInstrument(
	db: DB,
	accountId: string,
	instrumentId: string
): Promise<void> {
	const [inst] = await db.select().from(instrument).where(eq(instrument.id, instrumentId)).limit(1);
	if (!inst) return;

	const rows = await db
		.select()
		.from(execution)
		.where(and(eq(execution.accountId, accountId), eq(execution.instrumentId, instrumentId)))
		.orderBy(execution.executedAt);

	const inputs: ExecInput[] = rows.map((r) => ({
		id: r.id,
		side: r.side,
		qty: r.qty,
		price: r.price,
		fee: r.fee,
		commission: r.commission,
		executedAt: r.executedAt
	}));

	const grouped = groupExecutions(inputs, { multiplier: inst.multiplier });

	const existing = await db
		.select()
		.from(trade)
		.where(and(eq(trade.accountId, accountId), eq(trade.instrumentId, instrumentId)));
	const existingByKey = new Map(existing.map((t) => [naturalKey(t.openedAt, t.direction), t]));

	const keptTradeIds: string[] = [];

	for (const g of grouped) {
		const key = naturalKey(g.openedAt, g.direction);
		const prev = existingByKey.get(key);
		const plannedStop = prev?.plannedStop ?? null;
		const r = computeRMultiple({
			netPnl: g.netPnl,
			avgEntry: g.avgEntry,
			plannedStop,
			qty: g.qtyOpened,
			multiplier: inst.multiplier
		});

		const computed = {
			status: g.status,
			openedAt: g.openedAt,
			closedAt: g.closedAt,
			qtyOpened: g.qtyOpened,
			qtyClosed: g.qtyClosed,
			avgEntry: g.avgEntry,
			avgExit: g.avgExit,
			grossPnl: g.grossPnl,
			netPnl: g.netPnl,
			fees: g.fees,
			holdMs: g.holdMs,
			rMultiple: r?.rMultiple ?? null,
			riskAmount: r?.riskAmount ?? prev?.riskAmount ?? null
		};

		let tradeId: string;
		if (prev) {
			await db.update(trade).set(computed).where(eq(trade.id, prev.id));
			tradeId = prev.id;
		} else {
			const [created] = await db
				.insert(trade)
				.values({ accountId, instrumentId, direction: g.direction, ...computed })
				.returning({ id: trade.id });
			tradeId = created!.id;
		}
		keptTradeIds.push(tradeId);

		// rebuild execution links for this trade
		await db.delete(tradeExecution).where(eq(tradeExecution.tradeId, tradeId));
		if (g.executionIds.length > 0) {
			await db
				.insert(tradeExecution)
				.values(g.executionIds.map((executionId) => ({ tradeId, executionId })))
				.onConflictDoNothing();
		}
	}

	// remove derived trades that no longer exist after regrouping
	const stale = existing.filter((t) => !keptTradeIds.includes(t.id)).map((t) => t.id);
	if (stale.length > 0) await db.delete(trade).where(inArray(trade.id, stale));
}

/** Manually record a trade (entry + optional exit) and apply annotations. */
export async function addManualTrade(
	db: DB,
	input: {
		accountId: string;
		symbol: string;
		assetClass: AssetClass;
		direction: Direction;
		qty: number; // scaled
		entryPrice: number; // scaled
		exitPrice?: number | null; // scaled
		entryAt: number; // ms
		exitAt?: number | null; // ms
		fees?: number; // scaled, total split across legs
		setupId?: string | null;
		emotionId?: string | null;
		playbookId?: string | null;
		confidence?: number | null;
		plannedStop?: number | null;
		plannedTarget?: number | null;
		notes?: string | null;
	}
): Promise<string> {
	const inst = await findOrCreateInstrument(db, {
		symbol: input.symbol,
		assetClass: input.assetClass
	});
	const entrySide: Side = input.direction === 'long' ? 'buy' : 'sell';
	const exitSide: Side = input.direction === 'long' ? 'sell' : 'buy';
	const halfFee = Math.round((input.fees ?? 0) / 2);

	const execs: ExecutionInput[] = [
		{
			side: entrySide,
			qty: input.qty,
			price: input.entryPrice,
			fee: halfFee,
			executedAt: input.entryAt
		}
	];
	if (input.exitPrice != null && input.exitAt != null) {
		execs.push({
			side: exitSide,
			qty: input.qty,
			price: input.exitPrice,
			fee: (input.fees ?? 0) - halfFee,
			executedAt: input.exitAt
		});
	}

	await recordExecutions(db, input.accountId, inst.id, execs);

	const [created] = await db
		.select()
		.from(trade)
		.where(
			and(
				eq(trade.accountId, input.accountId),
				eq(trade.instrumentId, inst.id),
				eq(trade.openedAt, input.entryAt),
				eq(trade.direction, input.direction)
			)
		)
		.limit(1);
	if (!created) throw new Error('Trade was not created');

	await applyTradeAnnotations(db, created.id, {
		setupId: input.setupId ?? null,
		emotionId: input.emotionId ?? null,
		playbookId: input.playbookId ?? null,
		confidence: input.confidence ?? null,
		plannedStop: input.plannedStop ?? null,
		plannedTarget: input.plannedTarget ?? null,
		notes: input.notes ?? null
	});
	return created.id;
}

/** Update a trade's user annotations and recompute its R-multiple. */
export async function applyTradeAnnotations(
	db: DB,
	tradeId: string,
	annotations: {
		setupId?: string | null;
		emotionId?: string | null;
		playbookId?: string | null;
		confidence?: number | null;
		plannedEntry?: number | null;
		plannedStop?: number | null;
		plannedTarget?: number | null;
		plannedQty?: number | null;
		notes?: string | null;
	}
): Promise<void> {
	await db.update(trade).set(annotations).where(eq(trade.id, tradeId));

	if (annotations.plannedStop !== undefined) {
		const [t] = await db.select().from(trade).where(eq(trade.id, tradeId)).limit(1);
		if (t) {
			const [inst] = await db
				.select()
				.from(instrument)
				.where(eq(instrument.id, t.instrumentId))
				.limit(1);
			const r = computeRMultiple({
				netPnl: t.netPnl,
				avgEntry: t.avgEntry,
				plannedStop: annotations.plannedStop ?? null,
				qty: t.qtyOpened,
				multiplier: inst?.multiplier ?? 0
			});
			await db
				.update(trade)
				.set({ rMultiple: r?.rMultiple ?? null, riskAmount: r?.riskAmount ?? t.riskAmount })
				.where(eq(trade.id, tradeId));
		}
	}
}

export interface TradeFilter {
	status?: 'open' | 'closed';
	from?: number;
	to?: number;
	limit?: number;
	offset?: number;
}

export type TradeRow = typeof trade.$inferSelect & {
	symbol: string;
	assetClass: AssetClass;
};

/** List trades for an account (newest first) joined with instrument symbol. */
export async function listTrades(
	db: DB,
	accountId: string,
	filter: TradeFilter = {}
): Promise<TradeRow[]> {
	const conds = [eq(trade.accountId, accountId)];
	if (filter.status) conds.push(eq(trade.status, filter.status));
	if (filter.from != null) conds.push(gte(trade.openedAt, filter.from));
	if (filter.to != null) conds.push(lte(trade.openedAt, filter.to));

	const rows = await db
		.select({
			trade,
			symbol: instrument.symbol,
			assetClass: instrument.assetClass
		})
		.from(trade)
		.innerJoin(instrument, eq(trade.instrumentId, instrument.id))
		.where(and(...conds))
		.orderBy(desc(trade.openedAt))
		.limit(filter.limit ?? 200)
		.offset(filter.offset ?? 0);

	return rows.map((r) => ({ ...r.trade, symbol: r.symbol, assetClass: r.assetClass }));
}

/** Count trades for an account matching the (status) filter. */
export async function countTrades(db: DB, accountId: string, status?: 'open' | 'closed') {
	const conds = [eq(trade.accountId, accountId)];
	if (status) conds.push(eq(trade.status, status));
	const [row] = await db
		.select({ n: sql<number>`count(*)` })
		.from(trade)
		.where(and(...conds));
	return row?.n ?? 0;
}

/** Full detail for a single trade: the trade, its instrument, and its fills. */
export async function getTradeDetail(db: DB, accountId: string, tradeId: string) {
	const [row] = await db
		.select({ trade, instrument })
		.from(trade)
		.innerJoin(instrument, eq(trade.instrumentId, instrument.id))
		.where(and(eq(trade.id, tradeId), eq(trade.accountId, accountId)))
		.limit(1);
	if (!row) return null;

	const fills = await db
		.select({ execution })
		.from(tradeExecution)
		.innerJoin(execution, eq(tradeExecution.executionId, execution.id))
		.where(eq(tradeExecution.tradeId, tradeId))
		.orderBy(execution.executedAt);

	const categorization = await getTradeCategorization(db, tradeId);

	return {
		trade: row.trade,
		instrument: row.instrument,
		executions: fills.map((f) => f.execution),
		categorization
	};
}
