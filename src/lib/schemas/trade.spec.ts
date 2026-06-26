import { describe, it, expect } from 'vitest';
import { manualTradeSchema } from './trade';

const base = {
	symbol: 'AAPL',
	assetClass: 'stock',
	direction: 'long',
	qty: '100',
	entryPrice: '150',
	entryAt: '2026-06-01T14:30'
};

describe('manualTradeSchema exit validation', () => {
	it('accepts an open position (no exit price or time)', () => {
		expect(manualTradeSchema.safeParse(base).success).toBe(true);
	});

	it('accepts a fully-specified closed trade', () => {
		const r = manualTradeSchema.safeParse({
			...base,
			exitPrice: '155',
			exitAt: '2026-06-01T15:30'
		});
		expect(r.success).toBe(true);
	});

	it('rejects a lone exit price (would silently log an open trade)', () => {
		const r = manualTradeSchema.safeParse({ ...base, exitPrice: '155' });
		expect(r.success).toBe(false);
		if (!r.success) expect(r.error.issues.some((i) => i.path.includes('exitAt'))).toBe(true);
	});

	it('rejects a lone exit time', () => {
		const r = manualTradeSchema.safeParse({ ...base, exitAt: '2026-06-01T15:30' });
		expect(r.success).toBe(false);
		if (!r.success) expect(r.error.issues.some((i) => i.path.includes('exitPrice'))).toBe(true);
	});
});
