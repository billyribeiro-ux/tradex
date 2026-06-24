/**
 * Deterministic dedupe key for an execution, enabling idempotent re-import.
 * If the broker gives a stable execution id we trust it; otherwise we derive a
 * key from the immutable fields of the fill. The unique index on
 * (account_id, dedupe_hash) turns a re-uploaded file into a no-op.
 */
export function executionDedupeKey(p: {
	instrumentKey: string;
	side: string;
	/** scaled */
	qty: number;
	/** scaled */
	price: number;
	/** ms */
	executedAt: number;
	brokerExecId?: string | null;
}): string {
	const broker = p.brokerExecId?.trim();
	if (broker) return `b:${broker}`;
	return [p.instrumentKey, p.side, p.qty, p.price, p.executedAt].join('|');
}
