import { db } from '$lib/server/db';
import { listTrades, countTrades } from '$lib/server/services/trades';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, url }) => {
	const { accountId } = await parent();
	const statusParam = url.searchParams.get('status');
	const status = statusParam === 'open' || statusParam === 'closed' ? statusParam : undefined;

	if (!accountId) return { trades: [], total: 0, status };

	const trades = await listTrades(db, accountId, { status, limit: 500 });
	const total = await countTrades(db, accountId, status);
	return { trades, total, status };
};
