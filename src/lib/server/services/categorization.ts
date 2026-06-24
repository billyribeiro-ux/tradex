import { and, eq } from 'drizzle-orm';
import type { DB } from '$lib/server/db';
import { tag, setup, emotion, trade, tradeTag } from '$lib/server/db/schema';

/**
 * Find-or-create helpers for user-scoped categorization entities. Tags, setups
 * and emotions are created on demand from free-text on the trade detail, so the
 * user never has to pre-manage them. Unique indexes make this race-safe.
 */
async function findOrCreateTag(db: DB, userId: string, name: string): Promise<string> {
	const [existing] = await db
		.select({ id: tag.id })
		.from(tag)
		.where(and(eq(tag.userId, userId), eq(tag.name, name)))
		.limit(1);
	if (existing) return existing.id;
	const [created] = await db
		.insert(tag)
		.values({ userId, name })
		.onConflictDoNothing()
		.returning({ id: tag.id });
	if (created) return created.id;
	const [again] = await db
		.select({ id: tag.id })
		.from(tag)
		.where(and(eq(tag.userId, userId), eq(tag.name, name)))
		.limit(1);
	return again!.id;
}

async function findOrCreateSetup(db: DB, userId: string, name: string): Promise<string> {
	const [existing] = await db
		.select({ id: setup.id })
		.from(setup)
		.where(and(eq(setup.userId, userId), eq(setup.name, name)))
		.limit(1);
	if (existing) return existing.id;
	const [created] = await db
		.insert(setup)
		.values({ userId, name })
		.onConflictDoNothing()
		.returning({ id: setup.id });
	if (created) return created.id;
	const [again] = await db
		.select({ id: setup.id })
		.from(setup)
		.where(and(eq(setup.userId, userId), eq(setup.name, name)))
		.limit(1);
	return again!.id;
}

async function findOrCreateEmotion(db: DB, userId: string, label: string): Promise<string> {
	const [existing] = await db
		.select({ id: emotion.id })
		.from(emotion)
		.where(and(eq(emotion.userId, userId), eq(emotion.label, label)))
		.limit(1);
	if (existing) return existing.id;
	const [created] = await db
		.insert(emotion)
		.values({ userId, label })
		.onConflictDoNothing()
		.returning({ id: emotion.id });
	if (created) return created.id;
	const [again] = await db
		.select({ id: emotion.id })
		.from(emotion)
		.where(and(eq(emotion.userId, userId), eq(emotion.label, label)))
		.limit(1);
	return again!.id;
}

/** Apply free-text setup / emotion / tags to a trade (creating any new ones). */
export async function applyCategorization(
	db: DB,
	userId: string,
	tradeId: string,
	input: { setupName?: string | null; emotionLabel?: string | null; tagNames?: string[] }
): Promise<void> {
	const patch: { setupId?: string | null; emotionId?: string | null } = {};
	if (input.setupName !== undefined) {
		patch.setupId = input.setupName ? await findOrCreateSetup(db, userId, input.setupName) : null;
	}
	if (input.emotionLabel !== undefined) {
		patch.emotionId = input.emotionLabel
			? await findOrCreateEmotion(db, userId, input.emotionLabel)
			: null;
	}
	if (Object.keys(patch).length > 0) {
		await db.update(trade).set(patch).where(eq(trade.id, tradeId));
	}

	if (input.tagNames !== undefined) {
		await db.delete(tradeTag).where(eq(tradeTag.tradeId, tradeId));
		const unique = [...new Set(input.tagNames.map((t) => t.trim()).filter(Boolean))];
		if (unique.length > 0) {
			const ids = await Promise.all(unique.map((n) => findOrCreateTag(db, userId, n)));
			await db
				.insert(tradeTag)
				.values(ids.map((tagId) => ({ tradeId, tagId })))
				.onConflictDoNothing();
		}
	}
}

/** Read a trade's current categorization for prefilling the editor. */
export async function getTradeCategorization(
	db: DB,
	tradeId: string
): Promise<{ setupName: string | null; emotionLabel: string | null; tagNames: string[] }> {
	const [row] = await db
		.select({ setupId: trade.setupId, emotionId: trade.emotionId })
		.from(trade)
		.where(eq(trade.id, tradeId))
		.limit(1);
	if (!row) return { setupName: null, emotionLabel: null, tagNames: [] };

	let setupName: string | null = null;
	if (row.setupId) {
		const [s] = await db
			.select({ name: setup.name })
			.from(setup)
			.where(eq(setup.id, row.setupId))
			.limit(1);
		setupName = s?.name ?? null;
	}
	let emotionLabel: string | null = null;
	if (row.emotionId) {
		const [e] = await db
			.select({ label: emotion.label })
			.from(emotion)
			.where(eq(emotion.id, row.emotionId))
			.limit(1);
		emotionLabel = e?.label ?? null;
	}
	const tagRows = await db
		.select({ name: tag.name })
		.from(tradeTag)
		.innerJoin(tag, eq(tradeTag.tagId, tag.id))
		.where(eq(tradeTag.tradeId, tradeId));

	return { setupName, emotionLabel, tagNames: tagRows.map((t) => t.name) };
}
