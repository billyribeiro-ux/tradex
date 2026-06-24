import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { bootstrapUser, listAccounts, resolveAccount } from '$lib/server/services/accounts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url, cookies }) => {
	if (!locals.user) {
		redirect(302, `/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
	}

	await bootstrapUser(db, locals.user.id);
	const accounts = await listAccounts(db, locals.user.id);
	const requested = url.searchParams.get('account') ?? cookies.get('account');
	const account = await resolveAccount(db, locals.user.id, requested);

	if (account && cookies.get('account') !== account.id) {
		cookies.set('account', account.id, { path: '/', sameSite: 'lax' });
	}

	return {
		user: { id: locals.user.id, name: locals.user.name, email: locals.user.email },
		accounts,
		accountId: account?.id ?? null
	};
};
