import { db } from '$lib/server/db';
import { getDashboard } from '$lib/server/services/analytics';
import { getAccount } from '$lib/server/services/accounts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { accountId } = await parent();
	if (!accountId || !locals.user) return { calendar: [], currency: 'USD' };
	const account = await getAccount(db, locals.user.id, accountId);
	if (!account) return { calendar: [], currency: 'USD' };
	const dashboard = await getDashboard(db, {
		id: account.id,
		startingBalance: account.startingBalance,
		timezone: account.timezone
	});
	return { calendar: dashboard.calendar, currency: account.baseCurrency };
};
