import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getSharedTrade } from '$lib/server/services/sharing';
import type { PageServerLoad } from './$types';

// Public, no auth — the unguessable token is the only credential.
export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const shared = await getSharedTrade(db, params.token);
	if (!shared) error(404, 'This shared trade is unavailable or has expired.');
	setHeaders({ 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
	return { shared };
};
