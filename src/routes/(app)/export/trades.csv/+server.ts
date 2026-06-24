import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { listTrades } from '$lib/server/services/trades';
import { resolveAccount } from '$lib/server/services/accounts';
import { fromScaled } from '$lib/money';
import type { RequestHandler } from './$types';

const COLUMNS = [
	'symbol',
	'assetClass',
	'direction',
	'status',
	'openedAt',
	'closedAt',
	'qty',
	'avgEntry',
	'avgExit',
	'grossPnl',
	'netPnl',
	'fees',
	'rMultiple'
] as const;

export const GET: RequestHandler = async ({ locals, cookies }) => {
	if (!locals.user) error(401);
	const account = await resolveAccount(db, locals.user.id, cookies.get('account'));
	if (!account) error(400, 'No account');

	const trades = await listTrades(db, account.id, { limit: 100000 });
	const iso = (ms: number | null) => (ms == null ? '' : new Date(ms).toISOString());

	const rows = trades.map((t) =>
		[
			t.symbol,
			t.assetClass,
			t.direction,
			t.status,
			iso(t.openedAt),
			iso(t.closedAt),
			fromScaled(t.qtyOpened),
			fromScaled(t.avgEntry),
			t.avgExit != null ? fromScaled(t.avgExit) : '',
			fromScaled(t.grossPnl),
			fromScaled(t.netPnl),
			fromScaled(t.fees),
			t.rMultiple != null ? fromScaled(t.rMultiple) : ''
		].join(',')
	);

	const csv = [COLUMNS.join(','), ...rows].join('\n');
	return new Response(csv, {
		headers: {
			'content-type': 'text/csv',
			'content-disposition': `attachment; filename="tradex-${account.name.replace(/\W+/g, '-')}.csv"`
		}
	});
};
