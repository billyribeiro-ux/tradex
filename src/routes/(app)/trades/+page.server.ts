import { db } from '$lib/server/db';
import { listTrades, countTrades } from '$lib/server/services/trades';
import { getAccount } from '$lib/server/services/accounts';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const { accountId } = await parent();
	const statusParam = url.searchParams.get('status');
	const status = statusParam === 'open' || statusParam === 'closed' ? statusParam : undefined;

	if (!accountId)
		return {
			trades: [],
			total: 0,
			status,
			page: 1,
			pageSize: PAGE_SIZE,
			pageCount: 1,
			currency: 'USD'
		};

	const account = locals.user ? await getAccount(db, locals.user.id, accountId) : null;
	const total = await countTrades(db, accountId, status);
	const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const page = Math.min(Math.max(1, Number(url.searchParams.get('page')) || 1), pageCount);
	const trades = await listTrades(db, accountId, {
		status,
		limit: PAGE_SIZE,
		offset: (page - 1) * PAGE_SIZE
	});
	return {
		trades,
		total,
		status,
		page,
		pageSize: PAGE_SIZE,
		pageCount,
		currency: account?.baseCurrency ?? 'USD'
	};
};
