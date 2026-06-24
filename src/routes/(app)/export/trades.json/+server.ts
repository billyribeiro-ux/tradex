import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { listTrades } from '$lib/server/services/trades';
import { resolveAccount } from '$lib/server/services/accounts';
import { fromScaled } from '$lib/money';
import type { RequestHandler } from './$types';

/** Full trade export as JSON (values de-scaled to real numbers). No lock-in. */
export const GET: RequestHandler = async ({ locals, cookies }) => {
	if (!locals.user) error(401);
	const account = await resolveAccount(db, locals.user.id, cookies.get('account'));
	if (!account) error(400, 'No account');

	const trades = await listTrades(db, account.id, { limit: 100000 });
	const out = trades.map((t) => ({
		symbol: t.symbol,
		assetClass: t.assetClass,
		direction: t.direction,
		status: t.status,
		openedAt: t.openedAt,
		closedAt: t.closedAt,
		qty: fromScaled(t.qtyOpened),
		avgEntry: fromScaled(t.avgEntry),
		avgExit: t.avgExit != null ? fromScaled(t.avgExit) : null,
		grossPnl: fromScaled(t.grossPnl),
		netPnl: fromScaled(t.netPnl),
		fees: fromScaled(t.fees),
		rMultiple: t.rMultiple != null ? fromScaled(t.rMultiple) : null
	}));

	return json(
		{ account: { name: account.name, baseCurrency: account.baseCurrency }, trades: out },
		{
			headers: {
				'content-disposition': `attachment; filename="tradex-${account.name.replace(/\W+/g, '-')}.json"`
			}
		}
	);
};
