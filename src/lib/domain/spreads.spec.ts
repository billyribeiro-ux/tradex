import { describe, it, expect } from 'vitest';
import { classifySpread, netDebitCredit, spreadRisk, type SpreadLeg } from './spreads';
import { toScaled, fromScaled } from '$lib/money';

const EXP1 = Date.UTC(2026, 8, 18); // 18 SEP 2026
const EXP2 = Date.UTC(2026, 11, 18); // 18 DEC 2026

/** Build a leg with sensible defaults; override what each test cares about. */
function leg(p: Partial<SpreadLeg> & Pick<SpreadLeg, 'type' | 'side' | 'strike'>): SpreadLeg {
	return {
		expiry: EXP1,
		qty: toScaled(1),
		entryPremium: toScaled(1),
		...p,
		strike: toScaled(p.strike as unknown as number)
	};
}

describe('classifySpread', () => {
	it('labels a bull call spread (buy lower call, sell higher call)', () => {
		const c = classifySpread([
			leg({ type: 'call', side: 'buy', strike: 100 }),
			leg({ type: 'call', side: 'sell', strike: 110 })
		]);
		expect(c.key).toBe('vertical');
		expect(c.label).toBe('Bull Call Spread');
	});

	it('labels a bear call spread (sell lower call, buy higher call)', () => {
		const c = classifySpread([
			leg({ type: 'call', side: 'sell', strike: 100 }),
			leg({ type: 'call', side: 'buy', strike: 110 })
		]);
		expect(c.label).toBe('Bear Call Spread');
	});

	it('labels a bull put spread (sell higher put, buy lower put)', () => {
		const c = classifySpread([
			leg({ type: 'put', side: 'sell', strike: 100 }),
			leg({ type: 'put', side: 'buy', strike: 90 })
		]);
		expect(c.label).toBe('Bull Put Spread');
	});

	it('labels a bear put spread (buy higher put, sell lower put)', () => {
		const c = classifySpread([
			leg({ type: 'put', side: 'buy', strike: 100 }),
			leg({ type: 'put', side: 'sell', strike: 90 })
		]);
		expect(c.label).toBe('Bear Put Spread');
	});

	it('detects a long straddle (buy call + buy put, same strike)', () => {
		const c = classifySpread([
			leg({ type: 'call', side: 'buy', strike: 100 }),
			leg({ type: 'put', side: 'buy', strike: 100 })
		]);
		expect(c.key).toBe('straddle');
		expect(c.label).toBe('Long Straddle');
	});

	it('detects a short strangle (sell OTM call + sell OTM put)', () => {
		const c = classifySpread([
			leg({ type: 'call', side: 'sell', strike: 110 }),
			leg({ type: 'put', side: 'sell', strike: 90 })
		]);
		expect(c.key).toBe('strangle');
		expect(c.label).toBe('Short Strangle');
	});

	it('detects a calendar spread (same type & strike, different expiry)', () => {
		const c = classifySpread([
			leg({ type: 'call', side: 'sell', strike: 100, expiry: EXP1 }),
			leg({ type: 'call', side: 'buy', strike: 100, expiry: EXP2 })
		]);
		expect(c.key).toBe('calendar');
	});

	it('detects a diagonal spread (different strike AND expiry)', () => {
		const c = classifySpread([
			leg({ type: 'call', side: 'sell', strike: 100, expiry: EXP1 }),
			leg({ type: 'call', side: 'buy', strike: 110, expiry: EXP2 })
		]);
		expect(c.key).toBe('diagonal');
	});

	it('detects an iron condor (four distinct strikes, 2 calls + 2 puts)', () => {
		const c = classifySpread([
			leg({ type: 'put', side: 'buy', strike: 80 }),
			leg({ type: 'put', side: 'sell', strike: 90 }),
			leg({ type: 'call', side: 'sell', strike: 110 }),
			leg({ type: 'call', side: 'buy', strike: 120 })
		]);
		expect(c.key).toBe('iron_condor');
		expect(c.label).toBe('Iron Condor');
	});

	it('detects an iron butterfly (short body at one strike, long wings)', () => {
		const c = classifySpread([
			leg({ type: 'put', side: 'buy', strike: 90 }),
			leg({ type: 'put', side: 'sell', strike: 100 }),
			leg({ type: 'call', side: 'sell', strike: 100 }),
			leg({ type: 'call', side: 'buy', strike: 110 })
		]);
		expect(c.key).toBe('iron_butterfly');
	});

	it('detects a long call butterfly (1-2-1, equally spaced)', () => {
		const c = classifySpread([
			leg({ type: 'call', side: 'buy', strike: 95, qty: toScaled(1) }),
			leg({ type: 'call', side: 'sell', strike: 100, qty: toScaled(2) }),
			leg({ type: 'call', side: 'buy', strike: 105, qty: toScaled(1) })
		]);
		expect(c.key).toBe('butterfly');
		expect(c.label).toBe('Long Call Butterfly');
	});

	it('falls back to Custom for an unbalanced ratio spread', () => {
		const c = classifySpread([
			leg({ type: 'call', side: 'buy', strike: 100, qty: toScaled(1) }),
			leg({ type: 'call', side: 'sell', strike: 110, qty: toScaled(2) })
		]);
		expect(c.key).toBe('custom');
	});

	it('labels a single leg', () => {
		expect(classifySpread([leg({ type: 'call', side: 'buy', strike: 100 })]).label).toBe(
			'Long Call'
		);
	});
});

describe('netDebitCredit', () => {
	it('is a positive debit when more is paid than received', () => {
		// buy 100C @ $5, sell 110C @ $2, 1 contract → (5 − 2) × 100 = $300 debit
		const net = netDebitCredit([
			leg({ type: 'call', side: 'buy', strike: 100, entryPremium: toScaled(5) }),
			leg({ type: 'call', side: 'sell', strike: 110, entryPremium: toScaled(2) })
		]);
		expect(fromScaled(net)).toBe(300);
	});

	it('is a negative credit when more is received than paid, and scales with qty', () => {
		// sell 100C @ $5, buy 110C @ $2, 3 contracts → (−5 + 2) × 100 × 3 = −$900 credit
		const net = netDebitCredit([
			leg({ type: 'call', side: 'sell', strike: 100, entryPremium: toScaled(5), qty: toScaled(3) }),
			leg({ type: 'call', side: 'buy', strike: 110, entryPremium: toScaled(2), qty: toScaled(3) })
		]);
		expect(fromScaled(net)).toBe(-900);
	});
});

describe('spreadRisk', () => {
	it('bull call (debit): max loss = debit, max profit = width − debit', () => {
		const r = spreadRisk([
			leg({ type: 'call', side: 'buy', strike: 100, entryPremium: toScaled(5) }),
			leg({ type: 'call', side: 'sell', strike: 110, entryPremium: toScaled(2) })
		]);
		expect(r.kind).toBe('debit');
		expect(fromScaled(r.net)).toBe(300);
		expect(fromScaled(r.maxLoss!)).toBe(300); // debit paid
		expect(fromScaled(r.maxProfit!)).toBe(700); // $10 width × 100 − $300
	});

	it('bull put (credit): max profit = credit, max loss = width − credit', () => {
		const r = spreadRisk([
			leg({ type: 'put', side: 'sell', strike: 100, entryPremium: toScaled(5) }),
			leg({ type: 'put', side: 'buy', strike: 90, entryPremium: toScaled(2) })
		]);
		expect(r.kind).toBe('credit');
		expect(fromScaled(r.maxProfit!)).toBe(300); // credit received
		expect(fromScaled(r.maxLoss!)).toBe(700); // $10 width × 100 − $300
	});

	it('iron condor (credit): profit = credit, loss = wing width − credit', () => {
		const r = spreadRisk([
			leg({ type: 'put', side: 'buy', strike: 80, entryPremium: toScaled(0.5) }),
			leg({ type: 'put', side: 'sell', strike: 90, entryPremium: toScaled(1) }),
			leg({ type: 'call', side: 'sell', strike: 110, entryPremium: toScaled(1) }),
			leg({ type: 'call', side: 'buy', strike: 120, entryPremium: toScaled(0.5) })
		]);
		// net credit = (−1 − 1 + 0.5 + 0.5) × 100 = −$100
		expect(fromScaled(r.maxProfit!)).toBe(100);
		expect(fromScaled(r.maxLoss!)).toBe(900); // $10 wing × 100 − $100
	});

	it('long straddle: max loss = debit, max profit unlimited (null)', () => {
		const r = spreadRisk([
			leg({ type: 'call', side: 'buy', strike: 100, entryPremium: toScaled(5) }),
			leg({ type: 'put', side: 'buy', strike: 100, entryPremium: toScaled(4) })
		]);
		expect(fromScaled(r.maxLoss!)).toBe(900);
		expect(r.maxProfit).toBeNull();
	});

	it('short strangle: max profit = credit, max loss undefined (null)', () => {
		const r = spreadRisk([
			leg({ type: 'call', side: 'sell', strike: 110, entryPremium: toScaled(2) }),
			leg({ type: 'put', side: 'sell', strike: 90, entryPremium: toScaled(2) })
		]);
		expect(fromScaled(r.maxProfit!)).toBe(400);
		expect(r.maxLoss).toBeNull();
	});

	it('long call butterfly (debit): max loss = debit, max profit = wing − debit', () => {
		// buy 95C @2, sell 2×100C @3, buy 105C @2 → net = (2 − 6 + 2) × 100 = −$200? recheck:
		// cashflow: +2×100 − 3×100×2 + 2×100 = 200 − 600 + 200 = −200 → that's a credit butterfly.
		// Use a debit butterfly: buy 95C @5, sell 2×100C @3, buy 105C @2.
		// +5×100 − 3×100×2 + 2×100 = 500 − 600 + 200 = +100 debit.
		const r = spreadRisk([
			leg({ type: 'call', side: 'buy', strike: 95, qty: toScaled(1), entryPremium: toScaled(5) }),
			leg({ type: 'call', side: 'sell', strike: 100, qty: toScaled(2), entryPremium: toScaled(3) }),
			leg({ type: 'call', side: 'buy', strike: 105, qty: toScaled(1), entryPremium: toScaled(2) })
		]);
		expect(r.kind).toBe('debit');
		expect(fromScaled(r.maxLoss!)).toBe(100); // debit paid
		expect(fromScaled(r.maxProfit!)).toBe(400); // $5 wing × 100 − $100
	});

	it('calendar/custom: max profit and loss are undefined (null)', () => {
		const r = spreadRisk([
			leg({ type: 'call', side: 'sell', strike: 100, expiry: EXP1 }),
			leg({ type: 'call', side: 'buy', strike: 100, expiry: EXP2 })
		]);
		expect(r.maxProfit).toBeNull();
		expect(r.maxLoss).toBeNull();
	});
});
