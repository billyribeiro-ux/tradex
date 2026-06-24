import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { createAccount, listAccounts } from '$lib/server/services/accounts';
import { ASSET_CLASSES, type AssetClass } from '$lib/domain/enums';
import { toScaled } from '$lib/money';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return { accounts: [] };
	return { accounts: await listAccounts(db, locals.user.id) };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const fd = await request.formData();
		const name = ((fd.get('name') as string) ?? '').trim();
		if (!name) return fail(400, { message: 'Account name is required' });

		const assetClasses = fd
			.getAll('assetClasses')
			.filter((a): a is string => typeof a === 'string')
			.filter((a) => (ASSET_CLASSES as readonly string[]).includes(a)) as AssetClass[];

		const startingBalance = Number((fd.get('startingBalance') as string) ?? '0') || 0;

		await createAccount(db, locals.user.id, {
			name,
			broker: ((fd.get('broker') as string) ?? '').trim() || null,
			assetClasses: assetClasses.length ? assetClasses : ['stock'],
			baseCurrency: ((fd.get('baseCurrency') as string) || 'USD').toUpperCase(),
			startingBalance: toScaled(startingBalance),
			isPropFirm: fd.get('isPropFirm') === 'on'
		});
		return { created: true };
	}
};
