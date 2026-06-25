import { db } from '$lib/server/db';
import { listTrades } from '$lib/server/services/trades';
import { getAccount } from '$lib/server/services/accounts';
import { tzWeekday } from '$lib/datetime';
import type { PageServerLoad } from './$types';

export interface BreakdownRow {
	key: string;
	netPnl: number;
	trades: number;
	wins: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT: Record<string, string> = {
	Sunday: 'Sun',
	Monday: 'Mon',
	Tuesday: 'Tue',
	Wednesday: 'Wed',
	Thursday: 'Thu',
	Friday: 'Fri',
	Saturday: 'Sat'
};

function fold(rows: { key: string; netPnl: number }[]): BreakdownRow[] {
	const m = new Map<string, BreakdownRow>();
	for (const r of rows) {
		const cur = m.get(r.key) ?? { key: r.key, netPnl: 0, trades: 0, wins: 0 };
		cur.netPnl += r.netPnl;
		cur.trades += 1;
		if (r.netPnl > 0) cur.wins += 1;
		m.set(r.key, cur);
	}
	return [...m.values()];
}

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { accountId } = await parent();
	if (!accountId || !locals.user)
		return { byWeekday: [], bySymbol: [], byAsset: [], pnls: [], currency: 'USD' };
	const account = await getAccount(db, locals.user.id, accountId);
	const tz = account?.timezone ?? 'UTC';
	const closed = await listTrades(db, accountId, { status: 'closed', limit: 5000 });

	const byWeekday = fold(
		closed.map((t) => ({ key: SHORT[tzWeekday(t.openedAt, tz)] ?? '', netPnl: t.netPnl }))
	).sort((a, b) => WEEKDAYS.indexOf(a.key) - WEEKDAYS.indexOf(b.key));

	const bySymbol = fold(closed.map((t) => ({ key: t.symbol, netPnl: t.netPnl })))
		.sort((a, b) => b.netPnl - a.netPnl)
		.slice(0, 12);

	const byAsset = fold(closed.map((t) => ({ key: t.assetClass, netPnl: t.netPnl })));

	// Per-trade P&L for the distribution histogram (scaled).
	const pnls = closed.map((t) => t.netPnl);

	return { byWeekday, bySymbol, byAsset, pnls, currency: account?.baseCurrency ?? 'USD' };
};
