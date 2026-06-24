import { and, eq, isNotNull } from 'drizzle-orm';
import type { DB } from '$lib/server/db';
import { playbook, trade, tradingAccount, type PlaybookRules } from '$lib/server/db/schema';
import { computePerformance, type ClosedTradeLike } from '$lib/domain/metrics';
import type { PerformanceMetrics } from '$lib/domain/types';

export async function listPlaybooks(db: DB, userId: string) {
	return db.select().from(playbook).where(eq(playbook.userId, userId)).orderBy(playbook.createdAt);
}

export async function createPlaybook(
	db: DB,
	userId: string,
	input: { name: string; description?: string | null; rules?: PlaybookRules }
) {
	const [created] = await db
		.insert(playbook)
		.values({
			userId,
			name: input.name,
			description: input.description ?? null,
			rules: input.rules ?? {}
		})
		.onConflictDoNothing()
		.returning();
	return created ?? null;
}

export interface PlaybookPerformance {
	playbookId: string;
	metrics: PerformanceMetrics;
}

/** Per-playbook performance across all of the user's accounts (closed trades). */
export async function playbookPerformance(
	db: DB,
	userId: string
): Promise<Map<string, PerformanceMetrics>> {
	const rows = await db
		.select({
			playbookId: trade.playbookId,
			netPnl: trade.netPnl,
			fees: trade.fees,
			holdMs: trade.holdMs,
			closedAt: trade.closedAt
		})
		.from(trade)
		.innerJoin(tradingAccount, eq(trade.accountId, tradingAccount.id))
		.where(
			and(
				eq(tradingAccount.userId, userId),
				eq(trade.status, 'closed'),
				isNotNull(trade.playbookId)
			)
		);

	const byPlaybook = new Map<string, ClosedTradeLike[]>();
	for (const r of rows) {
		if (!r.playbookId) continue;
		const list = byPlaybook.get(r.playbookId) ?? [];
		list.push({ netPnl: r.netPnl, fees: r.fees, holdMs: r.holdMs, closedAt: r.closedAt });
		byPlaybook.set(r.playbookId, list);
	}

	const out = new Map<string, PerformanceMetrics>();
	for (const [id, list] of byPlaybook) out.set(id, computePerformance(list));
	return out;
}
