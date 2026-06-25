import { describe, it, expect } from 'vitest';
import { evaluatePropFirm, type PropTrade } from './propfirm';
import { toScaled } from '$lib/money';

const day = (y: number, m: number, d: number, h = 12) => Date.UTC(y, m, d, h);
const trade = (pnl: number, at: number): PropTrade => ({ netPnl: toScaled(pnl), closedAt: at });

describe('evaluatePropFirm', () => {
	it('marks the profit target met and passes a clean account', () => {
		const s = evaluatePropFirm({ profitTarget: toScaled(1000), minTradingDays: 2 }, [
			trade(600, day(2026, 0, 1)),
			trade(700, day(2026, 0, 2))
		]);
		expect(s.tradingDays).toBe(2);
		const target = s.rules.find((r) => r.label === 'Profit target')!;
		expect(target.met).toBe(true);
		expect(s.overall).toBe('passed');
	});

	it('breaches on a daily loss over the limit', () => {
		const s = evaluatePropFirm({ dailyLossLimit: toScaled(500) }, [
			trade(-300, day(2026, 0, 1, 10)),
			trade(-400, day(2026, 0, 1, 14)) // same day -> -700 total
		]);
		const rule = s.rules.find((r) => r.label === 'Daily loss limit')!;
		expect(rule.breached).toBe(true);
		expect(s.overall).toBe('breached');
	});

	it('honors static vs trailing max drawdown', () => {
		// start 10000; equity path: 10500 (peak), then 9600 -> ddFromStart 400, ddFromPeak 900
		const trades = [trade(500, day(2026, 0, 1)), trade(-900, day(2026, 0, 2))];
		const staticS = evaluatePropFirm(
			{ maxDrawdown: toScaled(600), drawdownType: 'static' },
			trades,
			toScaled(10000)
		);
		const staticRule = staticS.rules.find((r) => r.label.startsWith('Max drawdown'))!;
		expect(staticRule.breached).toBe(false); // 400 < 600
		// value must report the STATIC measure (ddFromStart 400), not trailing 900
		expect(staticRule.value).toBe(toScaled(400));

		const trailingS = evaluatePropFirm(
			{ maxDrawdown: toScaled(600), drawdownType: 'trailing' },
			trades,
			toScaled(10000)
		);
		const trailingRule = trailingS.rules.find((r) => r.label.startsWith('Max drawdown'))!;
		expect(trailingRule.breached).toBe(true); // 900 >= 600
		expect(trailingRule.value).toBe(toScaled(900));
	});

	it('flags minimum trading days not yet met (in-progress, not breached)', () => {
		const s = evaluatePropFirm({ profitTarget: toScaled(100), minTradingDays: 5 }, [
			trade(120, day(2026, 0, 1))
		]);
		const rule = s.rules.find((r) => r.label === 'Minimum trading days')!;
		expect(rule.met).toBe(false);
		expect(rule.breached).toBe(false);
		expect(s.overall).toBe('in-progress');
	});

	it('evaluates the consistency rule by best-day share', () => {
		// best day 800 of 1000 total profit = 80% > 50% limit -> not met
		const s = evaluatePropFirm({ consistencyPct: 50 }, [
			trade(800, day(2026, 0, 1)),
			trade(200, day(2026, 0, 2))
		]);
		const rule = s.rules.find((r) => r.label.startsWith('Consistency'))!;
		expect(rule.value).toBe(80);
		expect(rule.met).toBe(false);
	});
});
