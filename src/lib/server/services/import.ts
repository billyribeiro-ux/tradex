import Papa from 'papaparse';
import type { DB } from '$lib/server/db';
import { importBatch } from '$lib/server/db/schema';
import { detectColumns, mapRow, type ColumnMap } from '$lib/domain/csv-mapping';
import type { AssetClass } from '$lib/domain/enums';
import { findOrCreateInstrument } from './instruments';
import { recordExecutions, type ExecutionInput } from './trades';

export interface RowError {
	row: number;
	messages: string[];
}

export interface ImportResult {
	batchId: string;
	rowCount: number;
	importedCount: number;
	duplicateCount: number;
	errors: RowError[];
}

export interface ImportPreview {
	headers: string[];
	mapping: ColumnMap;
	totalRows: number;
	sample: Record<string, string>[];
}

/** Parse a CSV and auto-detect its columns, for the import UI to confirm. */
export function previewCsv(csvText: string): ImportPreview {
	const parsed = Papa.parse<Record<string, string>>(csvText, {
		header: true,
		skipEmptyLines: true
	});
	const headers = parsed.meta.fields ?? [];
	return {
		headers,
		mapping: detectColumns(headers),
		totalRows: parsed.data.length,
		sample: parsed.data.slice(0, 5)
	};
}

/**
 * Import executions from CSV: parse, map (auto-detect unless a mapping is
 * provided), import every valid row, dedupe idempotently, and report per-row
 * errors WITHOUT discarding the file. Valid rows are grouped into trades.
 */
export async function importCsv(
	db: DB,
	opts: {
		accountId: string;
		csvText: string;
		defaultAssetClass?: AssetClass;
		filename?: string;
		mapping?: ColumnMap;
		mappingTemplateId?: string | null;
	}
): Promise<ImportResult> {
	const parsed = Papa.parse<Record<string, string>>(opts.csvText, {
		header: true,
		skipEmptyLines: true
	});
	const headers = parsed.meta.fields ?? [];
	const mapping = opts.mapping ?? detectColumns(headers);
	const fallbackClass: AssetClass = opts.defaultAssetClass ?? 'stock';

	// group valid executions by instrument so we regroup each once
	const byInstrument = new Map<
		string,
		{ symbol: string; assetClass: AssetClass; execs: ExecutionInput[] }
	>();
	const errors: RowError[] = [];

	parsed.data.forEach((raw, i) => {
		const mapped = mapRow(raw, mapping);
		if (!mapped.ok) {
			errors.push({ row: i + 2, messages: mapped.errors.map((e) => e.message) }); // +2: header + 1-index
			return;
		}
		const v = mapped.value;
		const assetClass = v.assetClass ?? fallbackClass;
		const key = `${v.symbol}:${assetClass}`;
		const bucket = byInstrument.get(key) ?? { symbol: v.symbol, assetClass, execs: [] };
		bucket.execs.push({
			side: v.side,
			qty: v.qty,
			price: v.price,
			fee: v.fee,
			commission: v.commission,
			executedAt: v.executedAt,
			brokerExecId: v.brokerExecId ?? null
		});
		byInstrument.set(key, bucket);
	});

	let importedCount = 0;
	let duplicateCount = 0;
	for (const bucket of byInstrument.values()) {
		const inst = await findOrCreateInstrument(db, {
			symbol: bucket.symbol,
			assetClass: bucket.assetClass
		});
		const res = await recordExecutions(db, opts.accountId, inst.id, bucket.execs);
		importedCount += res.inserted;
		duplicateCount += res.duplicates;
	}

	const [batch] = await db
		.insert(importBatch)
		.values({
			accountId: opts.accountId,
			source: 'csv',
			filename: opts.filename ?? null,
			mappingTemplateId: opts.mappingTemplateId ?? null,
			rowCount: parsed.data.length,
			importedCount,
			duplicateCount,
			errorCount: errors.length
		})
		.returning({ id: importBatch.id });

	return {
		batchId: batch!.id,
		rowCount: parsed.data.length,
		importedCount,
		duplicateCount,
		errors
	};
}
