import { eq } from 'drizzle-orm';
import type { DB } from '$lib/server/db';
import { tradingAccount, propFirmConfig } from '$lib/server/db/schema';
import { toScaled } from '$lib/money';
import { bootstrapUser } from './accounts';
import { addManualTrade, countTrades } from './trades';
import { applyCategorization } from './categorization';
import { createPlaybook } from './playbooks';
import { createJournalEntry } from './journal';
import type { AssetClass, Direction } from '$lib/domain/enums';

/**
 * Deterministic demo dataset used for screenshots / live previews. It drives the
 * *real* service layer (grouping, categorization, playbooks, journal) rather than
 * hand-inserting rows, so the seed stays correct as the domain evolves. Strictly
 * a dev/CI affordance — only reachable through the SEED_DEMO-gated endpoint.
 */

// Small seeded PRNG so the same dataset is produced on every run (stable diffs,
// stable screenshots) without depending on wall-clock or Math.random ordering.
function mulberry32(seed: number): () => number {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const SYMBOLS: { symbol: string; assetClass: AssetClass; price: number; qty: [number, number] }[] =
	[
		{ symbol: 'AAPL', assetClass: 'stock', price: 191, qty: [50, 250] },
		{ symbol: 'MSFT', assetClass: 'stock', price: 421, qty: [20, 120] },
		{ symbol: 'NVDA', assetClass: 'stock', price: 124, qty: [60, 320] },
		{ symbol: 'TSLA', assetClass: 'stock', price: 248, qty: [30, 160] },
		{ symbol: 'SPY', assetClass: 'stock', price: 532, qty: [20, 100] },
		{ symbol: 'AMD', assetClass: 'stock', price: 162, qty: [40, 200] },
		{ symbol: 'ES', assetClass: 'future', price: 5320, qty: [1, 3] },
		{ symbol: 'BTC', assetClass: 'crypto', price: 64200, qty: [0.1, 0.8] }
	];

const SETUPS = [
	'Breakout',
	'Pullback',
	'Trend Continuation',
	'Reversal',
	'Gap-and-Go',
	'Range Fade'
];
const EMOTIONS = ['Disciplined', 'Confident', 'Patient', 'FOMO', 'Anxious', 'Revenge'];
const TAGS = ['A+', 'news', 'earnings', 'scalp', 'swing', 'overtraded', 'partial', 'runner'];
const NOTES = [
	'Took the trade at the retest of the breakout level. Sized in line with plan.',
	'Entry a touch early — should have waited for confirmation. Managed out fine.',
	'Trimmed half into strength, let the runner work. Trailed under the 9 EMA.',
	'Cut it the moment the thesis broke. No averaging down.',
	'Chased the move after the open. Note to self: wait for the pullback.',
	'Clean A+ setup, full conviction, held to target.',
	'Choppy tape — should have stayed flat. Small loss, fine.',
	'Scaled out at the prior day high, banked it.'
];

const PLAYBOOKS = [
	{
		name: 'Momentum Breakout',
		description: 'Trade continuation out of tight consolidation on rising relative volume.',
		rules: {
			entryCriteria: [
				'Price breaks a multi-day range on >1.5× average volume',
				'Above rising 9/20 EMA',
				'Market (SPY) in uptrend'
			],
			exitRules: ['Trail under 9 EMA', 'Take 1/2 at +1R, runner to structure'],
			maxRiskPct: 1,
			minRR: 2
		}
	},
	{
		name: 'Mean Reversion',
		description: 'Fade exhaustion into prior-day levels when the move is overextended.',
		rules: {
			entryCriteria: [
				'2+ std-dev extension from VWAP',
				'Into a prior-day high/low',
				'Momentum divergence'
			],
			exitRules: ['Target VWAP', 'Hard stop beyond the level'],
			maxRiskPct: 0.75,
			minRR: 1.5
		}
	}
];

function businessDays(startISO: string, endISO: string): string[] {
	const out: string[] = [];
	let t = Date.parse(`${startISO}T00:00:00Z`);
	const end = Date.parse(`${endISO}T00:00:00Z`);
	while (t <= end) {
		const dow = new Date(t).getUTCDay();
		if (dow !== 0 && dow !== 6) out.push(new Date(t).toISOString().slice(0, 10));
		t += 86_400_000;
	}
	return out;
}

export interface SeedResult {
	accountId: string;
	trades: number;
	playbooks: number;
	journal: number;
	alreadySeeded: boolean;
}

export async function seedDemoData(db: DB, userId: string): Promise<SeedResult> {
	const accountId = await bootstrapUser(db, userId);

	// Idempotent: never double-seed an account that already has trades.
	const existing = Number(await countTrades(db, accountId));
	if (existing > 0) {
		return { accountId, trades: existing, playbooks: 0, journal: 0, alreadySeeded: true };
	}

	// Dress the bootstrapped account up as a funded prop evaluation.
	await db
		.update(tradingAccount)
		.set({
			name: 'Demo — Swing & Momentum',
			broker: 'Demo Broker',
			startingBalance: toScaled(50_000),
			isPropFirm: true,
			assetClasses: ['stock', 'future', 'crypto']
		})
		.where(eq(tradingAccount.id, accountId));

	await db
		.insert(propFirmConfig)
		.values({
			accountId,
			firm: 'apex',
			profitTarget: toScaled(3000),
			dailyLossLimit: toScaled(1100),
			maxDrawdown: toScaled(2500),
			drawdownType: 'trailing',
			minTradingDays: 7,
			consistencyPct: 30
		})
		.onConflictDoNothing();

	const playbooks = [];
	for (const p of PLAYBOOKS) {
		const created = await createPlaybook(db, userId, p);
		if (created) playbooks.push(created);
	}

	const rng = mulberry32(0xc0ffee);
	const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;
	const between = (lo: number, hi: number) => lo + rng() * (hi - lo);
	const round2 = (n: number) => Math.round(n * 100) / 100;

	const days = businessDays('2026-03-02', '2026-06-19');
	const TARGET = 36;
	let made = 0;

	// `addManualTrade` re-derives trades from each instrument's net position, so two
	// overlapping fills in the same symbol collapse into one trade. Keeping at most
	// one trade per symbol per day — and closing it intraday — guarantees every
	// symbol's positions are disjoint in time, so each call yields its own trade.
	for (const day of days) {
		if (made >= TARGET) break;
		const todays = rng() < 0.5 ? (rng() < 0.35 ? 2 : 1) : 0;
		const usedToday = new Set<string>();
		for (let k = 0; k < todays && made < TARGET; k++) {
			let sym = pick(SYMBOLS);
			for (let tries = 0; usedToday.has(sym.symbol) && tries < 6; tries++) sym = pick(SYMBOLS);
			if (usedToday.has(sym.symbol)) continue;
			usedToday.add(sym.symbol);

			const direction: Direction = rng() < 0.62 ? 'long' : 'short';
			const win = rng() < 0.57;
			const qty = round2(between(sym.qty[0], sym.qty[1]));
			const entry = round2(sym.price * (1 + between(-0.04, 0.04)));
			const stopPct = between(0.012, 0.03);
			const winPct = stopPct * between(1.4, 3.2);
			const lossPct = stopPct * between(0.5, 1.05);
			const movePct = win ? winPct : -lossPct;
			const dir = direction === 'long' ? 1 : -1;
			const exit = round2(entry * (1 + dir * movePct));
			const plannedStop = round2(entry * (1 - dir * stopPct));
			const plannedTarget = round2(entry * (1 + dir * stopPct * 2));

			// Open mid-morning, close the same day so positions never span days.
			const hh = String(9 + Math.floor(rng() * 4)).padStart(2, '0');
			const mm = String(Math.floor(rng() * 60)).padStart(2, '0');
			const entryAt = Date.parse(`${day}T${hh}:${mm}:00Z`);
			const exitAt = entryAt + Math.floor(between(20, 240)) * 60_000;
			const fees = round2(qty * 0.01 + 1);

			const tradeId = await addManualTrade(db, {
				accountId,
				symbol: sym.symbol,
				assetClass: sym.assetClass,
				direction,
				qty: toScaled(qty),
				entryPrice: toScaled(entry),
				exitPrice: toScaled(exit),
				entryAt,
				exitAt,
				fees: toScaled(fees),
				plannedStop: toScaled(plannedStop),
				plannedTarget: toScaled(plannedTarget),
				confidence: 1 + Math.floor(rng() * 5),
				playbookId: playbooks.length ? pick(playbooks).id : null,
				notes: pick(NOTES)
			});

			const tagCount = 1 + Math.floor(rng() * 2);
			const tagNames = Array.from({ length: tagCount }, () => pick(TAGS));
			await applyCategorization(db, userId, tradeId, {
				setupName: pick(SETUPS),
				emotionLabel: pick(EMOTIONS),
				tagNames
			});
			made++;
		}
	}

	// Leave one position open so the dashboard shows open exposure, not just history.
	const openSym = SYMBOLS[2]!;
	await addManualTrade(db, {
		accountId,
		symbol: openSym.symbol,
		assetClass: openSym.assetClass,
		direction: 'long',
		qty: toScaled(150),
		entryPrice: toScaled(openSym.price),
		exitPrice: null,
		entryAt: Date.parse('2026-06-22T14:05:00Z'),
		exitAt: null,
		fees: toScaled(2),
		plannedStop: toScaled(round2(openSym.price * 0.97)),
		plannedTarget: toScaled(round2(openSym.price * 1.06)),
		confidence: 4,
		notes: 'Starter position into the breakout — adding on confirmation above the high.'
	});

	const journal = [
		{
			date: '2026-04-03',
			title: 'Weekly review',
			body: 'Best week came from sticking to the Momentum Breakout playbook. Worst trades were all FOMO entries after the open — flagged and tagged. Goal next week: no entries in the first 15 minutes.'
		},
		{
			date: '2026-05-12',
			title: 'Drawdown notes',
			body: 'Three reds in a row mid-month. Reviewed and they were all counter-trend fades in a strong tape. Mean Reversion only works at extension into a level — cut the impulsive ones.'
		},
		{
			date: '2026-06-15',
			title: 'What is working',
			body: 'Trailing under the 9 EMA is keeping me in the runners. Expectancy is up since I started taking half off at +1R. Keep the size consistent.'
		}
	];
	for (const j of journal) {
		await createJournalEntry(db, userId, { ...j, accountId });
	}

	const total = Number(await countTrades(db, accountId));
	return {
		accountId,
		trades: total,
		playbooks: playbooks.length,
		journal: journal.length,
		alreadySeeded: false
	};
}
