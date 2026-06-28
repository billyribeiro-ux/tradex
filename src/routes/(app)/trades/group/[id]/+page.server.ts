import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getMultiLegGroup, deleteMultiLegGroup } from '$lib/server/services/spreads';
import { getAccount, resolveAccount } from '$lib/server/services/accounts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, locals }) => {
	const { accountId } = await parent();
	if (!accountId || !locals.user) error(404, 'Structure not found');

	const detail = await getMultiLegGroup(db, accountId, params.id);
	if (!detail) error(404, 'Structure not found');

	const account = await getAccount(db, locals.user.id, accountId);
	return { detail, currency: account?.baseCurrency ?? 'USD' };
};

export const actions: Actions = {
	delete: async ({ params, locals, cookies }) => {
		if (!locals.user) return fail(401);
		const account = await resolveAccount(db, locals.user.id, cookies.get('account'));
		if (!account) return fail(400);
		const ok = await deleteMultiLegGroup(db, account.id, params.id);
		if (!ok) return fail(404);
		redirect(303, '/trades');
	}
};
