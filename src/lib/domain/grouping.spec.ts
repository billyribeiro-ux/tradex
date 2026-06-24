import { describe, it, expect } from 'vitest';
import { groupExecutions } from './grouping';
import { toScaled, fromScaled, SCALE } from '$lib/money';
import type { ExecInput } from './types';

function ex(
	id: string,
	side: 'buy' | 'sell',
	qty: number,
	price: number,
	executedAt: number,
	fee = 0
): ExecInput {
	return { id, side, qty: toScaled(qty), price: toScaled(price), executedAt, fee: toScaled(fee) };
}

describe('groupExecutions — simple round trips', () => {
	it('groups a basic long round trip', () => {
		const trades = groupExecutions([ex('1', 'buy', 100, 10, 1000), ex('2', 'sell', 100, 12, 2000)]);
		expect(trades).toHaveLength(1);
		const t = trades[0]!;
		expect(t.direction).toBe('long');
		expect(t.status).toBe('closed');
		expect(fromScaled(t.avgEntry)).toBe(10);
		expect(fromScaled(t.avgExit!)).toBe(12);
		expect(fromScaled(t.grossPnl)).toBe(200); // 100 * (12-10)
		expect(fromScaled(t.netPnl)).toBe(200);
		expect(t.holdMs).toBe(1000);
		expect(t.executionIds).toEqual(['1', '2']);
	});

	it('groups a basic short round trip (profit when price falls)', () => {
		const trades = groupExecutions([ex('1', 'sell', 50, 20, 1000), ex('2', 'buy', 50, 18, 2000)]);
		expect(trades).toHaveLength(1);
		expect(trades[0]!.direction).toBe('short');
		expect(fromScaled(trades[0]!.grossPnl)).toBe(100); // 50 * (20-18)
	});

	it('subtracts fees and commissions into net P&L', () => {
		const trades = groupExecutions([
			ex('1', 'buy', 100, 10, 1000, 1.5),
			ex('2', 'sell', 100, 12, 2000, 1.5)
		]);
		expect(fromScaled(trades[0]!.grossPnl)).toBe(200);
		expect(fromScaled(trades[0]!.fees)).toBe(3);
		expect(fromScaled(trades[0]!.netPnl)).toBe(197);
	});
});

describe('groupExecutions — scale in / out', () => {
	it('averages the entry on scale-in', () => {
		const trades = groupExecutions([
			ex('1', 'buy', 100, 10, 1000),
			ex('2', 'buy', 100, 20, 1500), // avg entry now 15
			ex('3', 'sell', 200, 18, 2000)
		]);
		expect(trades).toHaveLength(1);
		expect(fromScaled(trades[0]!.avgEntry)).toBe(15);
		expect(fromScaled(trades[0]!.grossPnl)).toBe(600); // 200 * (18-15)
		expect(fromScaled(trades[0]!.qtyOpened)).toBe(200);
		expect(fromScaled(trades[0]!.qtyClosed)).toBe(200);
	});

	it('handles partial scale-out within one trade (average-cost)', () => {
		const trades = groupExecutions([
			ex('1', 'buy', 100, 10, 1000),
			ex('2', 'sell', 40, 12, 1500), // realize 40*(12-10)=80
			ex('3', 'sell', 60, 15, 2000) // realize 60*(15-10)=300
		]);
		expect(trades).toHaveLength(1);
		expect(trades[0]!.status).toBe('closed');
		expect(fromScaled(trades[0]!.grossPnl)).toBe(380);
		// weighted avg exit = (40*12 + 60*15)/100 = 13.8
		expect(fromScaled(trades[0]!.avgExit!)).toBeCloseTo(13.8, 6);
	});
});

describe('groupExecutions — reversals', () => {
	it('splits a zero-crossing fill into a closed trade plus a new opposite trade', () => {
		const trades = groupExecutions([
			ex('1', 'buy', 100, 10, 1000),
			ex('2', 'sell', 150, 12, 2000) // closes 100 long, opens 50 short
		]);
		expect(trades).toHaveLength(2);

		const long = trades[0]!;
		expect(long.direction).toBe('long');
		expect(long.status).toBe('closed');
		expect(fromScaled(long.grossPnl)).toBe(200); // 100*(12-10)

		const short = trades[1]!;
		expect(short.direction).toBe('short');
		expect(short.status).toBe('open');
		expect(fromScaled(short.qtyOpened)).toBe(50);
		expect(fromScaled(short.avgEntry)).toBe(12);
		// the reversal execution belongs to both trades
		expect(long.executionIds).toContain('2');
		expect(short.executionIds).toContain('2');
	});

	it('splits fees pro-rata across the reversal', () => {
		const trades = groupExecutions([
			ex('1', 'buy', 100, 10, 1000),
			ex('2', 'sell', 200, 12, 2000, 4) // 100 closes, 100 opens -> fee split 2/2
		]);
		expect(fromScaled(trades[0]!.fees)).toBe(2); // closing portion
		expect(fromScaled(trades[1]!.fees)).toBe(2); // opening portion
	});
});

describe('groupExecutions — open positions & edge cases', () => {
	it('leaves a partially-closed position open', () => {
		const trades = groupExecutions([ex('1', 'buy', 100, 10, 1000), ex('2', 'sell', 30, 12, 2000)]);
		expect(trades).toHaveLength(1);
		expect(trades[0]!.status).toBe('open');
		expect(fromScaled(trades[0]!.qtyRemaining)).toBe(70);
		expect(fromScaled(trades[0]!.grossPnl)).toBe(60); // realized on the 30 closed
	});

	it('sorts unordered executions by time before grouping', () => {
		const trades = groupExecutions([ex('2', 'sell', 100, 12, 2000), ex('1', 'buy', 100, 10, 1000)]);
		expect(trades).toHaveLength(1);
		expect(trades[0]!.direction).toBe('long');
		expect(fromScaled(trades[0]!.grossPnl)).toBe(200);
	});

	it('applies a futures multiplier to P&L', () => {
		// ES: 2 contracts, +4.25 points, $50/point => 2 * 4.25 * 50 = 425
		const trades = groupExecutions(
			[ex('1', 'buy', 2, 5000, 1000), ex('2', 'sell', 2, 5004.25, 2000)],
			{
				multiplier: toScaled(50)
			}
		);
		expect(fromScaled(trades[0]!.grossPnl)).toBeCloseTo(425, 6);
	});

	it('handles three independent round trips in sequence', () => {
		const trades = groupExecutions([
			ex('1', 'buy', 10, 100, 1000),
			ex('2', 'sell', 10, 101, 1100),
			ex('3', 'sell', 5, 50, 1200),
			ex('4', 'buy', 5, 49, 1300),
			ex('5', 'buy', 1, 10, 1400),
			ex('6', 'sell', 1, 9, 1500)
		]);
		expect(trades).toHaveLength(3);
		expect(fromScaled(trades[0]!.grossPnl)).toBe(10); // long +1
		expect(fromScaled(trades[1]!.grossPnl)).toBe(5); // short +1*5
		expect(fromScaled(trades[2]!.grossPnl)).toBe(-1); // long -1
	});

	it('returns an empty array for no executions', () => {
		expect(groupExecutions([])).toEqual([]);
	});

	it('keeps quantity precise for fractional crypto sizes', () => {
		const trades = groupExecutions([
			ex('1', 'buy', 0.5, 30000, 1000),
			ex('2', 'sell', 0.5, 31000, 2000)
		]);
		expect(fromScaled(trades[0]!.grossPnl)).toBe(500); // 0.5 * 1000
		expect(trades[0]!.qtyOpened).toBe(SCALE / 2);
	});
});
