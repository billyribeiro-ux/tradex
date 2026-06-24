import { and, desc, eq } from 'drizzle-orm';
import type { DB } from '$lib/server/db';
import { journalEntry } from '$lib/server/db/schema';

export async function listJournal(db: DB, userId: string, limit = 100) {
	return db
		.select()
		.from(journalEntry)
		.where(eq(journalEntry.userId, userId))
		.orderBy(desc(journalEntry.date), desc(journalEntry.createdAt))
		.limit(limit);
}

export async function createJournalEntry(
	db: DB,
	userId: string,
	input: { date: string; title?: string | null; body: string; accountId?: string | null }
) {
	const [created] = await db
		.insert(journalEntry)
		.values({
			userId,
			date: input.date,
			title: input.title ?? null,
			body: input.body,
			accountId: input.accountId ?? null
		})
		.returning();
	return created!;
}

export async function deleteJournalEntry(db: DB, userId: string, id: string) {
	await db
		.delete(journalEntry)
		.where(and(eq(journalEntry.id, id), eq(journalEntry.userId, userId)));
}
