import { z } from 'zod';
import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { multiLegSchema } from '$lib/schemas/trade';
import { createMultiLegTrade } from '$lib/server/services/spreads';
import { applyCategorization } from '$lib/server/services/categorization';
import { getAccount, resolveAccount } from '$lib/server/services/accounts';
import { listPlaybooks } from '$lib/server/services/playbooks';
import { toScaled } from '$lib/money';
import { fromDatetimeLocal } from '$lib/format';
import type { Actions, PageServerLoad } from './$types';

/** A `<input type="date">` value (YYYY-MM-DD) as UTC midnight epoch ms. */
function dateToUtcMs(d: string): number {
	const [y, m, day] = d.split('-').map(Number);
	return Date.UTC(y ?? 1970, (m ?? 1) - 1, day ?? 1);
}

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { accountId } = await parent();
	const account = accountId && locals.user ? await getAccount(db, locals.user.id, accountId) : null;
	const playbooks = locals.user ? await listPlaybooks(db, locals.user.id) : [];
	return {
		supportsOptions: account?.assetClasses?.includes('option') ?? false,
		playbooks: playbooks.map((p) => ({ id: p.id, name: p.name }))
	};
};

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		if (!locals.user) redirect(302, '/login');
		const account = await resolveAccount(db, locals.user.id, cookies.get('account'));
		if (!account) return fail(400, { message: 'No account selected' });

		const fd = await request.formData();
		// Legs arrive as parallel arrays (one entry per repeated field name).
		const col = (name: string) => fd.getAll(name).map((x) => String(x));
		const types = col('legType');
		const sides = col('legSide');
		const strikes = col('legStrike');
		const expiries = col('legExpiry');
		const qtys = col('legQty');
		const entries = col('legEntry');
		const exits = col('legExit');
		const legs = types.map((type, i) => {
			const leg: Record<string, string> = {
				type,
				side: sides[i] ?? '',
				strike: strikes[i] ?? '',
				expiry: expiries[i] ?? '',
				qty: qtys[i] ?? '',
				entryPremium: entries[i] ?? ''
			};
			if (exits[i] && exits[i]!.trim() !== '') leg.exitPremium = exits[i]!;
			return leg;
		});

		const str = (k: string) => {
			const v = fd.get(k);
			return v == null || String(v).trim() === '' ? undefined : String(v);
		};
		const raw = {
			underlying: str('underlying'),
			entryAt: str('entryAt'),
			exitAt: str('exitAt'),
			fees: str('fees'),
			confidence: str('confidence'),
			notes: str('notes'),
			setupName: str('setupName'),
			emotionLabel: str('emotionLabel'),
			playbookId: str('playbookId'),
			legs
		};

		const parsed = multiLegSchema.safeParse(raw);
		if (!parsed.success) {
			const flat = z.flattenError(parsed.error);
			const firstField = Object.values(flat.fieldErrors)[0] as string[] | undefined;
			return fail(400, {
				message: flat.formErrors[0] ?? firstField?.[0] ?? 'Check the structure and try again.',
				values: { ...raw, legs: undefined } as Record<string, unknown>
			});
		}
		const v = parsed.data;

		const result = await createMultiLegTrade(db, {
			accountId: account.id,
			underlying: v.underlying,
			entryAt: fromDatetimeLocal(v.entryAt),
			exitAt: v.exitAt ? fromDatetimeLocal(v.exitAt) : null,
			fees: v.fees != null ? toScaled(v.fees) : 0,
			confidence: v.confidence ?? null,
			notes: v.notes ?? null,
			playbookId: v.playbookId || null,
			legs: v.legs.map((l) => ({
				type: l.type,
				side: l.side,
				strike: toScaled(l.strike),
				expiry: dateToUtcMs(l.expiry),
				qty: toScaled(l.qty),
				entryPremium: toScaled(l.entryPremium),
				exitPremium: l.exitPremium != null ? toScaled(l.exitPremium) : null
			}))
		});

		// Setup / emotion / tags are resolved by name (creating them if needed) and
		// applied to every leg so the structure shows up in those analytics buckets.
		if (v.setupName || v.emotionLabel) {
			for (const id of result.tradeIds) {
				await applyCategorization(db, locals.user.id, id, {
					setupName: v.setupName?.trim() || null,
					emotionLabel: v.emotionLabel?.trim() || null,
					tagNames: []
				});
			}
		}

		redirect(303, `/trades/group/${result.groupId}`);
	}
};
