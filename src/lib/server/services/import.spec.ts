import { describe, it, expect } from 'vitest';
import { previewCsv, CsvTooLargeError, MAX_CSV_BYTES } from './import';

describe('CSV size guardrails', () => {
	it('previews a normal small CSV without throwing', () => {
		const csv = 'Symbol,Side,Qty,Price,Date\nAAPL,Buy,100,150,2026-06-24T14:30:00Z\n';
		const p = previewCsv(csv);
		expect(p.totalRows).toBe(1);
		expect(p.headers).toContain('Symbol');
	});

	it('rejects an oversized file before parsing (memory/timeout DoS guard)', () => {
		const huge = 'x'.repeat(MAX_CSV_BYTES + 1);
		expect(() => previewCsv(huge)).toThrow(CsvTooLargeError);
	});
});
