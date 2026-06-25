import Anthropic from '@anthropic-ai/sdk';
import { PGlite } from '@electric-sql/pglite';
import type { DB } from '$lib/server/db';
import { getSettings } from './accounts';
import { listTrades } from './trades';
import { decryptSecret } from '$lib/server/crypto';
import { fromScaled } from '$lib/money';
import { tzDate, tzWeekday, tzHour } from '$lib/datetime';
import { DEFAULT_MODEL } from './coach';

/**
 * Natural-language → SQL over the user's OWN trades, with the generated SQL
 * shown for trust. Safety model: we never run model SQL against the real
 * multi-tenant database. Instead we load ONLY the current account's trades into
 * a throwaway in-process PGlite database containing a single `trades` table —
 * there is no other user/account data in it, so a cross-tenant leak is
 * structurally impossible. Validation additionally blocks writes / DoS.
 */

const COLUMNS = `symbol text, asset_class text, direction text, status text,
  opened_at timestamptz, closed_at timestamptz, date text, day_of_week text, hour int,
  qty double precision, avg_entry double precision, avg_exit double precision,
  gross_pnl double precision, net_pnl double precision, fees double precision,
  r_multiple double precision, hold_minutes double precision, is_win boolean`;

const SCHEMA_DOC = `Table "trades" (one row per round-trip trade for the current account):
- symbol, asset_class (stock|future|forex|option|crypto), direction (long|short), status (open|closed)
- opened_at, closed_at (timestamptz), date (YYYY-MM-DD of open), day_of_week (Monday..Sunday), hour (0-23 of open, in the account timezone)
- qty, avg_entry, avg_exit, gross_pnl, net_pnl, fees, r_multiple, hold_minutes (real numbers)
- is_win (boolean, net_pnl > 0)
Currency values are plain numbers in the account's currency.`;

// Blocks writes, DDL, and unbounded/DoS constructs (PGlite runs in-process, so
// a runaway query — generate_series, recursive CTE, repeat() — would block the
// event loop). Any pg_* function is rejected outright.
const FORBIDDEN =
	/\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|attach|copy|vacuum|into|merge|call|do|recursive|generate_series|repeat|crosstab|setseed|random|lo_import|dblink|information_schema)\b|pg_/i;

export interface QueryResult {
	sql: string;
	columns: string[];
	rows: Record<string, unknown>[];
	rowCount: number;
}

export type CoachQueryError = {
	error: 'no-key' | 'bad-key' | 'api-error' | 'unsafe-sql';
	detail?: string;
};

/** Validate that a statement is a single read-only SELECT/CTE. */
export function validateSelect(
	raw: string
): { ok: true; sql: string } | { ok: false; reason: string } {
	let sql = raw
		.trim()
		.replace(/```sql/gi, '')
		.replace(/```/g, '')
		.trim();
	if (sql.endsWith(';')) sql = sql.slice(0, -1).trim();
	if (sql.includes(';')) return { ok: false, reason: 'Multiple statements are not allowed' };
	if (sql.includes('--') || sql.includes('/*'))
		return { ok: false, reason: 'Comments are not allowed' };
	if (!/^(select|with)\b/i.test(sql))
		return { ok: false, reason: 'Only SELECT queries are allowed' };
	if (FORBIDDEN.test(sql)) return { ok: false, reason: 'Query contains a forbidden keyword' };
	if (!/\blimit\b/i.test(sql)) sql = `${sql}\nLIMIT 200`;
	return { ok: true, sql };
}

/** Build the per-account dataset rows that seed the sandbox `trades` table. */
export async function buildTradesDataset(db: DB, accountId: string, timezone = 'UTC') {
	const trades = await listTrades(db, accountId, { limit: 5000 });
	return trades.map((t) => {
		return {
			symbol: t.symbol,
			asset_class: t.assetClass,
			direction: t.direction,
			status: t.status,
			opened_at: new Date(t.openedAt).toISOString(),
			closed_at: t.closedAt != null ? new Date(t.closedAt).toISOString() : null,
			date: tzDate(t.openedAt, timezone),
			day_of_week: tzWeekday(t.openedAt, timezone),
			hour: tzHour(t.openedAt, timezone),
			qty: fromScaled(t.qtyOpened),
			avg_entry: fromScaled(t.avgEntry),
			avg_exit: t.avgExit != null ? fromScaled(t.avgExit) : null,
			gross_pnl: fromScaled(t.grossPnl),
			net_pnl: fromScaled(t.netPnl),
			fees: fromScaled(t.fees),
			r_multiple: t.rMultiple != null ? fromScaled(t.rMultiple) : null,
			hold_minutes: t.holdMs != null ? Math.round(t.holdMs / 60000) : null,
			is_win: t.netPnl > 0
		};
	});
}

/** Run a validated SELECT against an isolated sandbox seeded with `rows`. */
export async function runIsolatedQuery(
	rows: Record<string, unknown>[],
	sql: string
): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
	const pg = new PGlite();
	try {
		await pg.exec(`CREATE TABLE trades (${COLUMNS});`);
		// Defense-in-depth: cap query runtime (the FORBIDDEN list is the primary guard).
		await pg.exec(`SET statement_timeout = '3000ms';`);
		const cols = [
			'symbol',
			'asset_class',
			'direction',
			'status',
			'opened_at',
			'closed_at',
			'date',
			'day_of_week',
			'hour',
			'qty',
			'avg_entry',
			'avg_exit',
			'gross_pnl',
			'net_pnl',
			'fees',
			'r_multiple',
			'hold_minutes',
			'is_win'
		];
		const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
		for (const r of rows) {
			await pg.query(
				`INSERT INTO trades (${cols.join(',')}) VALUES (${placeholders})`,
				cols.map((c) => (r as Record<string, unknown>)[c] ?? null)
			);
		}
		const res = await pg.query(sql);
		return {
			columns: res.fields.map((f) => f.name),
			rows: res.rows as Record<string, unknown>[]
		};
	} finally {
		await pg.close();
	}
}

/** End-to-end: NL question → Claude SQL → validate → run in sandbox. */
export async function coachQuery(
	db: DB,
	userId: string,
	account: { id: string; timezone?: string },
	question: string
): Promise<QueryResult | CoachQueryError> {
	const s = await getSettings(db, userId);
	if (!s?.aiApiKeyEnc) return { error: 'no-key' };
	const apiKey = decryptSecret(s.aiApiKeyEnc);
	if (!apiKey) return { error: 'bad-key' };

	let rawSql: string;
	try {
		const client = new Anthropic({ apiKey });
		const msg = await client.messages.create({
			model: s.aiModel || DEFAULT_MODEL,
			max_tokens: 600,
			system: `You translate a trader's question into ONE PostgreSQL read-only SELECT over this schema.\n${SCHEMA_DOC}\nRespond with ONLY the SQL — no prose, no code fences. Use only the trades table.`,
			messages: [{ role: 'user', content: question }]
		});
		rawSql = msg.content
			.map((b) => (b.type === 'text' ? b.text : ''))
			.join('')
			.trim();
	} catch (e) {
		return { error: 'api-error', detail: e instanceof Error ? e.message : String(e) };
	}

	const valid = validateSelect(rawSql);
	if (!valid.ok) return { error: 'unsafe-sql', detail: valid.reason };

	try {
		const dataset = await buildTradesDataset(db, account.id, account.timezone);
		const out = await runIsolatedQuery(dataset, valid.sql);
		return { sql: valid.sql, columns: out.columns, rows: out.rows, rowCount: out.rows.length };
	} catch (e) {
		return { error: 'unsafe-sql', detail: e instanceof Error ? e.message : 'Query failed' };
	}
}
