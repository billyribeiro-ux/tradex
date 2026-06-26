import Papa from 'papaparse';
import type { DB } from '$lib/server/db';
import { importBatch } from '$lib/server/db/schema';
import { detectColumns, mapRow, type ColumnMap } from '$lib/domain/csv-mapping';
import type { AssetClass } from '$lib/domain/enums';
import { findOrCreateInstrument } from './instruments';
import { recordExecutions, type ExecutionInput } from './trades';

/** Guardrails: Papa.parse loads the whole file into memory, so cap input size
 * and row count to avoid a memory/timeout DoS from a hostile or accidental
 * giant upload. Exceeding either throws CsvTooLargeError (shown to the user). */
export const MAX_CSV_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_CSV_ROWS = 100_000;

export class CsvTooLargeError extends Error {}

function assertCsvSize(csvText: string, rowCount?: number) {
	if (csvText.length > MAX_CSV_BYTES) {
		throw new CsvTooLargeError(
			`CSV is too large (${(csvText.length / 1024 / 1024).toFixed(1)} MB; limit ${MAX_CSV_BYTES / 1024 / 1024} MB). Split it into smaller files.`
		);
	}
	if (rowCount != null && rowCount > MAX_CSV_ROWS) {
		throw new CsvTooLargeError(
			`CSV has too many rows (${rowCount.toLocaleString()}; limit ${MAX_CSV_ROWS.toLocaleString()}). Split it into smaller files.`
		);
	}
}

export interface RowError {
	row: number;
	/** Per-field failures so the UI can name the offending column, not just the message. */
	fields: { field: string; message: string }[];
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
	assertCsvSize(csvText);
	const parsed = Papa.parse<Record<string, string>>(csvText, {
		header: true,
		skipEmptyLines: true
	});
	assertCsvSize(csvText, parsed.data.length);
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
		/** Account timezone; naive CSV timestamps are interpreted in it. */
		timezone?: string;
	}
): Promise<ImportResult> {
	assertCsvSize(opts.csvText);
	const parsed = Papa.parse<Record<string, string>>(opts.csvText, {
		header: true,
		skipEmptyLines: true
	});
	assertCsvSize(opts.csvText, parsed.data.length);
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
		const mapped = mapRow(raw, mapping, opts.timezone ?? 'UTC');
		if (!mapped.ok) {
			// +2: header row + 1-indexing
			errors.push({
				row: i + 2,
				fields: mapped.errors.map((e) => ({ field: e.field, message: e.message }))
			});
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
