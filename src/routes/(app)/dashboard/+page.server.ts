import { db } from '$lib/server/db';
import { getDashboard } from '$lib/server/services/analytics';
import { getAccount } from '$lib/server/services/accounts';
import { listTrades } from '$lib/server/services/trades';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { accountId } = await parent();
	if (!accountId || !locals.user) return { account: null, dashboard: null, recent: [] };

	const account = await getAccount(db, locals.user.id, accountId);
	if (!account) return { account: null, dashboard: null, recent: [] };

	const dashboard = await getDashboard(db, {
		id: account.id,
		startingBalance: account.startingBalance,
		timezone: account.timezone
	});
	const recent = await listTrades(db, account.id, { limit: 8 });

	return { account, dashboard, recent };
};
