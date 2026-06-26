import { z } from 'zod';
import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { manualTradeSchema } from '$lib/schemas/trade';
import { addManualTrade } from '$lib/server/services/trades';
import { applyCategorization } from '$lib/server/services/categorization';
import { getAccount, resolveAccount } from '$lib/server/services/accounts';
import { listPlaybooks } from '$lib/server/services/playbooks';
import { toScaled } from '$lib/money';
import { fromDatetimeLocal } from '$lib/format';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { accountId } = await parent();
	const account = accountId && locals.user ? await getAccount(db, locals.user.id, accountId) : null;
	const playbooks = locals.user ? await listPlaybooks(db, locals.user.id) : [];
	return {
		assetClasses: account?.assetClasses ?? ['stock'],
		playbooks: playbooks.map((p) => ({ id: p.id, name: p.name }))
	};
};

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		if (!locals.user) redirect(302, '/login');
		const account = await resolveAccount(db, locals.user.id, cookies.get('account'));
		if (!account) return fail(400, { message: 'No account selected' });

		const fd = await request.formData();
		const raw = Object.fromEntries(fd);
		// blank optional fields -> undefined so coercion/validation behaves
		for (const k of Object.keys(raw)) if (raw[k] === '') delete raw[k];

		const parsed = manualTradeSchema.safeParse(raw);
		if (!parsed.success) {
			return fail(400, {
				errors: z.flattenError(parsed.error).fieldErrors,
				values: raw
			});
		}
		const v = parsed.data;

		const id = await addManualTrade(db, {
			accountId: account.id,
			symbol: v.symbol,
			assetClass: v.assetClass,
			direction: v.direction,
			qty: toScaled(v.qty),
			entryPrice: toScaled(v.entryPrice),
			exitPrice: v.exitPrice != null ? toScaled(v.exitPrice) : null,
			entryAt: fromDatetimeLocal(v.entryAt),
			exitAt: v.exitAt ? fromDatetimeLocal(v.exitAt) : null,
			fees: v.fees != null ? toScaled(v.fees) : 0,
			plannedStop: v.plannedStop != null ? toScaled(v.plannedStop) : null,
			plannedTarget: v.plannedTarget != null ? toScaled(v.plannedTarget) : null,
			confidence: v.confidence ?? null,
			playbookId: v.playbookId || null,
			notes: v.notes ?? null
		});

		// Capture setup/emotion/tags at the moment of logging (don't make the
		// trader open the detail page to record their intent).
		if (v.setupName || v.emotionLabel || v.tags) {
			await applyCategorization(db, locals.user.id, id, {
				setupName: v.setupName?.trim() || null,
				emotionLabel: v.emotionLabel?.trim() || null,
				tagNames: (v.tags ?? '')
					.split(',')
					.map((t) => t.trim())
					.filter(Boolean)
			});
		}

		redirect(303, `/trades/${id}`);
	}
};
