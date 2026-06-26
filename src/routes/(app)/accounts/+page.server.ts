import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	createAccount,
	listAccounts,
	updateAccount,
	deleteAccount
} from '$lib/server/services/accounts';
import { ASSET_CLASSES, COMMON_TIMEZONES, type AssetClass } from '$lib/domain/enums';
import { toScaled } from '$lib/money';
import type { Actions, PageServerLoad } from './$types';

/** Accept a known IANA zone from the picker; fall back to UTC for anything else. */
function normalizeTimezone(raw: unknown): string {
	const v = typeof raw === 'string' ? raw.trim() : '';
	return (COMMON_TIMEZONES as readonly string[]).includes(v) ? v : 'UTC';
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return { accounts: [], timezones: COMMON_TIMEZONES };
	return { accounts: await listAccounts(db, locals.user.id), timezones: COMMON_TIMEZONES };
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
			timezone: normalizeTimezone(fd.get('timezone')),
			isPropFirm: fd.get('isPropFirm') === 'on'
		});
		return { created: true };
	},

	update: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const fd = await request.formData();
		const id = ((fd.get('id') as string) ?? '').trim();
		const name = ((fd.get('name') as string) ?? '').trim();
		if (!id || !name) return fail(400, { message: 'Account name is required' });

		const assetClasses = fd
			.getAll('assetClasses')
			.filter((a): a is string => typeof a === 'string')
			.filter((a) => (ASSET_CLASSES as readonly string[]).includes(a)) as AssetClass[];
		const startingBalance = Number((fd.get('startingBalance') as string) ?? '0') || 0;

		const ok = await updateAccount(db, locals.user.id, id, {
			name,
			broker: ((fd.get('broker') as string) ?? '').trim() || null,
			assetClasses: assetClasses.length ? assetClasses : ['stock'],
			baseCurrency: ((fd.get('baseCurrency') as string) || 'USD').toUpperCase(),
			startingBalance: toScaled(startingBalance),
			timezone: normalizeTimezone(fd.get('timezone')),
			isPropFirm: fd.get('isPropFirm') === 'on'
		});
		if (!ok) return fail(404, { message: 'Account not found' });
		return { updated: true };
	},

	delete: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const fd = await request.formData();
		const id = ((fd.get('id') as string) ?? '').trim();
		if (!id) return fail(400);
		const ok = await deleteAccount(db, locals.user.id, id);
		if (!ok) return fail(404, { message: 'Account not found' });
		return { deleted: true };
	}
};
