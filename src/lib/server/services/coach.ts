import Anthropic from '@anthropic-ai/sdk';
import type { DB } from '$lib/server/db';
import { getSettings } from './accounts';
import { getDashboard } from './analytics';
import { listTrades } from './trades';
import { decryptSecret } from '$lib/server/crypto';
import { fromScaled, formatMoney } from '$lib/money';
import { INFINITE_RATIO } from '$lib/domain/metrics';

/** Default Claude model for the coach (fast + capable); Opus for deep analysis. */
export const DEFAULT_MODEL = 'claude-sonnet-4-6';
export const COACH_MODELS = ['claude-sonnet-4-6', 'claude-opus-4-8', 'claude-haiku-4-5-20251001'];

const SYSTEM = `You are TradeX Coach, a disciplined, evidence-based trading-performance coach.
Rules:
- Ground EVERY claim in the statistics provided. Never invent numbers.
- If the sample is small (fewer than ~30 closed trades), say so and treat findings as low-confidence.
- Be specific and concise. Prefer concrete, actionable observations (sizing, timing, rule adherence,
  win/loss asymmetry) over generic advice.
- When you reference a pattern, cite the relevant stat (e.g. "your Monday win rate is 38% over 21 trades").
- You are a journal coach, not a financial advisor; do not give buy/sell recommendations.`;

export async function coachAvailable(db: DB, userId: string): Promise<boolean> {
	const s = await getSettings(db, userId);
	return !!s?.aiApiKeyEnc;
}

export async function askCoach(
	db: DB,
	userId: string,
	account: { id: string; startingBalance: number; baseCurrency: string },
	question: string
): Promise<{ answer: string } | { error: 'no-key' | 'bad-key' | 'api-error'; detail?: string }> {
	const s = await getSettings(db, userId);
	if (!s?.aiApiKeyEnc) return { error: 'no-key' };
	const apiKey = decryptSecret(s.aiApiKeyEnc);
	if (!apiKey) return { error: 'bad-key' };
	const model = s.aiModel || DEFAULT_MODEL;

	const context = await buildContext(db, account);
	try {
		const client = new Anthropic({ apiKey });
		const msg = await client.messages.create({
			model,
			max_tokens: 1024,
			system: SYSTEM,
			messages: [{ role: 'user', content: `${context}\n\nThe trader asks: ${question}` }]
		});
		const answer = msg.content
			.map((b) => (b.type === 'text' ? b.text : ''))
			.join('\n')
			.trim();
		return { answer: answer || 'No response.' };
	} catch (e) {
		return { error: 'api-error', detail: e instanceof Error ? e.message : String(e) };
	}
}

/** Build a compact, factual stats brief the model must reason from. */
async function buildContext(
	db: DB,
	account: { id: string; startingBalance: number; baseCurrency: string }
): Promise<string> {
	const cur = account.baseCurrency;
	const dash = await getDashboard(db, account);
	const m = dash.metrics;
	const ratio = (v: number) => (v === INFINITE_RATIO ? 'infinite' : fromScaled(v).toFixed(2));
	const recent = await listTrades(db, account.id, { status: 'closed', limit: 40 });

	const lines = recent.map(
		(t) =>
			`${t.symbol} ${t.direction} ${t.status} pnl=${fromScaled(t.netPnl)} ` +
			`R=${t.rMultiple != null ? fromScaled(t.rMultiple).toFixed(2) : 'n/a'} ` +
			`opened=${new Date(t.openedAt).toISOString().slice(0, 10)}`
	);

	return [
		`ACCOUNT STATS (currency ${cur}, all values already converted to ${cur}):`,
		`- Closed trades: ${m.tradeCount} (${m.winCount}W / ${m.lossCount}L), win rate ${(fromScaled(m.winRate) * 100).toFixed(1)}%`,
		`- Net P&L: ${formatMoney(m.netPnl, cur)} | Expectancy/trade: ${formatMoney(m.expectancy, cur)}`,
		`- Profit factor: ${ratio(m.profitFactor)} | Avg win/loss ratio: ${ratio(m.avgWinLossRatio)}`,
		`- Avg win ${formatMoney(m.avgWin, cur)}, avg loss ${formatMoney(m.avgLoss, cur)}`,
		`- Max drawdown ${formatMoney(m.maxDrawdown, cur)}, recovery factor ${ratio(m.recoveryFactor)}`,
		`- Consistency ${(fromScaled(m.consistency) * 100).toFixed(0)}%, longest streaks ${m.maxWinStreak}W / ${m.maxLossStreak}L`,
		`- TradeX Score: ${dash.score.score}/100`,
		`- Open positions: ${dash.openPositions}`,
		'',
		`RECENT CLOSED TRADES (newest first, up to 40):`,
		...lines
	].join('\n');
}
