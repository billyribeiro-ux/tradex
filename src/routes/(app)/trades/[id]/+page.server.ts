import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getTradeDetail, applyTradeAnnotations, deleteTrade } from '$lib/server/services/trades';
import { applyCategorization } from '$lib/server/services/categorization';
import { getAccount, resolveAccount } from '$lib/server/services/accounts';
import { listPlaybooks } from '$lib/server/services/playbooks';
import { toScaled } from '$lib/money';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, locals }) => {
	const { accountId } = await parent();
	if (!accountId || !locals.user) error(404, 'Trade not found');

	const detail = await getTradeDetail(db, accountId, params.id);
	if (!detail) error(404, 'Trade not found');

	const account = await getAccount(db, locals.user.id, accountId);
	const playbooks = await listPlaybooks(db, locals.user.id);
	return { detail, currency: account?.baseCurrency ?? 'USD', playbooks };
};

export const actions: Actions = {
	annotate: async ({ request, params, locals, cookies }) => {
		if (!locals.user) return fail(401);
		const account = await resolveAccount(db, locals.user.id, cookies.get('account'));
		if (!account) return fail(400);
		const owned = await getTradeDetail(db, account.id, params.id);
		if (!owned) return fail(404);

		const fd = await request.formData();
		const num = (k: string) => {
			const v = (fd.get(k) as string)?.trim();
			return v ? toScaled(Number(v)) : null;
		};
		const confidenceRaw = (fd.get('confidence') as string)?.trim();

		await applyTradeAnnotations(db, params.id, {
			notes: ((fd.get('notes') as string) ?? '').trim() || null,
			confidence: confidenceRaw ? Number(confidenceRaw) : null,
			plannedStop: num('plannedStop'),
			plannedTarget: num('plannedTarget'),
			playbookId: ((fd.get('playbookId') as string) ?? '').trim() || null
		});

		await applyCategorization(db, locals.user.id, params.id, {
			setupName: ((fd.get('setup') as string) ?? '').trim() || null,
			emotionLabel: ((fd.get('emotion') as string) ?? '').trim() || null,
			tagNames: ((fd.get('tags') as string) ?? '')
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean)
		});
		return { saved: true };
	},

	delete: async ({ params, locals, cookies }) => {
		if (!locals.user) return fail(401);
		const account = await resolveAccount(db, locals.user.id, cookies.get('account'));
		if (!account) return fail(400);
		const ok = await deleteTrade(db, account.id, params.id);
		if (!ok) return fail(404);
		redirect(303, '/trades');
	}
};
