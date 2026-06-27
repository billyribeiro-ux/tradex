import { and, eq, sql } from 'drizzle-orm';
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

// ---------------------------------------------------------------------------
// Management — list with usage counts, rename (merge-on-conflict), delete.
// All queries are scoped by userId so one user can never touch another's data.
// ---------------------------------------------------------------------------

export interface CategoryItem {
	id: string;
	name: string;
	count: number;
}

/** List the user's tags, setups and emotions, each with how many trades use it. */
export async function listCategorization(
	db: DB,
	userId: string
): Promise<{ tags: CategoryItem[]; setups: CategoryItem[]; emotions: CategoryItem[] }> {
	const n = sql<number>`cast(count(${trade.id}) as int)`;
	const tagN = sql<number>`cast(count(${tradeTag.tradeId}) as int)`;

	const tags = await db
		.select({ id: tag.id, name: tag.name, count: tagN })
		.from(tag)
		.leftJoin(tradeTag, eq(tradeTag.tagId, tag.id))
		.where(eq(tag.userId, userId))
		.groupBy(tag.id, tag.name)
		.orderBy(tag.name);

	const setups = await db
		.select({ id: setup.id, name: setup.name, count: n })
		.from(setup)
		.leftJoin(trade, eq(trade.setupId, setup.id))
		.where(eq(setup.userId, userId))
		.groupBy(setup.id, setup.name)
		.orderBy(setup.name);

	const emotions = await db
		.select({ id: emotion.id, name: emotion.label, count: n })
		.from(emotion)
		.leftJoin(trade, eq(trade.emotionId, emotion.id))
		.where(eq(emotion.userId, userId))
		.groupBy(emotion.id, emotion.label)
		.orderBy(emotion.label);

	return {
		tags: tags.map((t) => ({ ...t, count: Number(t.count) })),
		setups: setups.map((s) => ({ ...s, count: Number(s.count) })),
		emotions: emotions.map((e) => ({ ...e, count: Number(e.count) }))
	};
}

export type RenameResult = { ok: boolean; merged?: boolean };

/** Rename a tag; if the target name already exists, merge into it (re-point trades). */
export async function renameTag(
	db: DB,
	userId: string,
	id: string,
	rawName: string
): Promise<RenameResult> {
	const name = rawName.trim();
	if (!name) return { ok: false };
	const [own] = await db
		.select({ id: tag.id })
		.from(tag)
		.where(and(eq(tag.id, id), eq(tag.userId, userId)))
		.limit(1);
	if (!own) return { ok: false };

	const [target] = await db
		.select({ id: tag.id })
		.from(tag)
		.where(and(eq(tag.userId, userId), eq(tag.name, name)))
		.limit(1);
	if (target && target.id !== id) {
		// Atomic merge: re-point associations then drop the source, all-or-nothing.
		await db.transaction(async (tx) => {
			const rows = await tx
				.select({ tradeId: tradeTag.tradeId })
				.from(tradeTag)
				.where(eq(tradeTag.tagId, id));
			if (rows.length) {
				await tx
					.insert(tradeTag)
					.values(rows.map((r) => ({ tradeId: r.tradeId, tagId: target.id })))
					.onConflictDoNothing();
			}
			await tx.delete(tradeTag).where(eq(tradeTag.tagId, id));
			await tx.delete(tag).where(eq(tag.id, id));
		});
		return { ok: true, merged: true };
	}
	await db
		.update(tag)
		.set({ name })
		.where(and(eq(tag.id, id), eq(tag.userId, userId)));
	return { ok: true };
}

/** Delete a tag (its trade associations cascade). */
export async function deleteTag(db: DB, userId: string, id: string): Promise<boolean> {
	const res = await db
		.delete(tag)
		.where(and(eq(tag.id, id), eq(tag.userId, userId)))
		.returning({ id: tag.id });
	return res.length > 0;
}

export async function renameSetup(
	db: DB,
	userId: string,
	id: string,
	rawName: string
): Promise<RenameResult> {
	const name = rawName.trim();
	if (!name) return { ok: false };
	const [own] = await db
		.select({ id: setup.id })
		.from(setup)
		.where(and(eq(setup.id, id), eq(setup.userId, userId)))
		.limit(1);
	if (!own) return { ok: false };
	const [target] = await db
		.select({ id: setup.id })
		.from(setup)
		.where(and(eq(setup.userId, userId), eq(setup.name, name)))
		.limit(1);
	if (target && target.id !== id) {
		await db.transaction(async (tx) => {
			await tx.update(trade).set({ setupId: target.id }).where(eq(trade.setupId, id));
			await tx.delete(setup).where(eq(setup.id, id));
		});
		return { ok: true, merged: true };
	}
	await db
		.update(setup)
		.set({ name })
		.where(and(eq(setup.id, id), eq(setup.userId, userId)));
	return { ok: true };
}

/** Delete a setup (trades referencing it have setupId set to null by the FK). */
export async function deleteSetup(db: DB, userId: string, id: string): Promise<boolean> {
	const res = await db
		.delete(setup)
		.where(and(eq(setup.id, id), eq(setup.userId, userId)))
		.returning({ id: setup.id });
	return res.length > 0;
}

export async function renameEmotion(
	db: DB,
	userId: string,
	id: string,
	rawLabel: string
): Promise<RenameResult> {
	const label = rawLabel.trim();
	if (!label) return { ok: false };
	const [own] = await db
		.select({ id: emotion.id })
		.from(emotion)
		.where(and(eq(emotion.id, id), eq(emotion.userId, userId)))
		.limit(1);
	if (!own) return { ok: false };
	const [target] = await db
		.select({ id: emotion.id })
		.from(emotion)
		.where(and(eq(emotion.userId, userId), eq(emotion.label, label)))
		.limit(1);
	if (target && target.id !== id) {
		await db.transaction(async (tx) => {
			await tx.update(trade).set({ emotionId: target.id }).where(eq(trade.emotionId, id));
			await tx.delete(emotion).where(eq(emotion.id, id));
		});
		return { ok: true, merged: true };
	}
	await db
		.update(emotion)
		.set({ label })
		.where(and(eq(emotion.id, id), eq(emotion.userId, userId)));
	return { ok: true };
}

export async function deleteEmotion(db: DB, userId: string, id: string): Promise<boolean> {
	const res = await db
		.delete(emotion)
		.where(and(eq(emotion.id, id), eq(emotion.userId, userId)))
		.returning({ id: emotion.id });
	return res.length > 0;
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
