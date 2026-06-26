import { and, desc, eq } from 'drizzle-orm';
import type { DB } from '$lib/server/db';
import { importMappingTemplate } from '$lib/server/db/schema';
import type { ColumnMap } from '$lib/domain/csv-mapping';
import type { AssetClass } from '$lib/domain/enums';

/**
 * Saved per-broker column mappings, so a trader who re-imports from the same
 * broker never has to re-map columns. All queries are userId-scoped.
 */

export interface MappingTemplate {
	id: string;
	broker: string;
	name: string;
	assetClass: AssetClass | null;
	columnMap: ColumnMap;
	createdAt: number;
}

export async function listMappingTemplates(db: DB, userId: string): Promise<MappingTemplate[]> {
	const rows = await db
		.select()
		.from(importMappingTemplate)
		.where(eq(importMappingTemplate.userId, userId))
		.orderBy(desc(importMappingTemplate.createdAt));
	return rows.map((r) => ({
		id: r.id,
		broker: r.broker,
		name: r.name,
		assetClass: r.assetClass,
		columnMap: r.columnMap as ColumnMap,
		createdAt: r.createdAt
	}));
}

/** Create (or replace by name) a mapping template for the user. */
export async function saveMappingTemplate(
	db: DB,
	userId: string,
	input: { broker: string; name: string; assetClass?: AssetClass | null; columnMap: ColumnMap }
): Promise<string> {
	const name = input.name.trim() || 'Untitled';
	const broker = input.broker.trim() || 'Broker';
	// replace a same-named template so re-saving updates rather than duplicates
	const [existing] = await db
		.select({ id: importMappingTemplate.id })
		.from(importMappingTemplate)
		.where(and(eq(importMappingTemplate.userId, userId), eq(importMappingTemplate.name, name)))
		.limit(1);
	if (existing) {
		await db
			.update(importMappingTemplate)
			.set({ broker, assetClass: input.assetClass ?? null, columnMap: input.columnMap })
			.where(eq(importMappingTemplate.id, existing.id));
		return existing.id;
	}
	const [created] = await db
		.insert(importMappingTemplate)
		.values({
			userId,
			broker,
			name,
			assetClass: input.assetClass ?? null,
			columnMap: input.columnMap
		})
		.returning({ id: importMappingTemplate.id });
	return created!.id;
}

export async function getMappingTemplate(
	db: DB,
	userId: string,
	id: string
): Promise<MappingTemplate | null> {
	const [r] = await db
		.select()
		.from(importMappingTemplate)
		.where(and(eq(importMappingTemplate.id, id), eq(importMappingTemplate.userId, userId)))
		.limit(1);
	if (!r) return null;
	return {
		id: r.id,
		broker: r.broker,
		name: r.name,
		assetClass: r.assetClass,
		columnMap: r.columnMap as ColumnMap,
		createdAt: r.createdAt
	};
}

export async function deleteMappingTemplate(db: DB, userId: string, id: string): Promise<boolean> {
	const res = await db
		.delete(importMappingTemplate)
		.where(and(eq(importMappingTemplate.id, id), eq(importMappingTemplate.userId, userId)))
		.returning({ id: importMappingTemplate.id });
	return res.length > 0;
}
