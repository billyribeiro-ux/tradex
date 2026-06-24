import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getSettings } from '$lib/server/services/accounts';
import { encryptSecret } from '$lib/server/crypto';
import { userSettings } from '$lib/server/db/schema';
import { COACH_MODELS, DEFAULT_MODEL } from '$lib/server/services/coach';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const base = { provider: 'anthropic', model: DEFAULT_MODEL, hasKey: false };
	if (!locals.user) return { ai: base, models: COACH_MODELS };
	const s = await getSettings(db, locals.user.id);
	return {
		ai: {
			provider: s?.aiProvider ?? 'anthropic',
			model: s?.aiModel ?? DEFAULT_MODEL,
			hasKey: !!s?.aiApiKeyEnc
		},
		models: COACH_MODELS
	};
};

export const actions: Actions = {
	saveAi: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const fd = await request.formData();
		const model = ((fd.get('model') as string) || DEFAULT_MODEL).trim();
		const apiKey = ((fd.get('apiKey') as string) ?? '').trim();

		const updates: { aiProvider: string; aiModel: string; aiApiKeyEnc?: string } = {
			aiProvider: 'anthropic',
			aiModel: model
		};
		if (apiKey) updates.aiApiKeyEnc = encryptSecret(apiKey);

		await db
			.insert(userSettings)
			.values({ userId: locals.user.id, ...updates })
			.onConflictDoUpdate({ target: userSettings.userId, set: updates });
		return { saved: true };
	},
	clearKey: async ({ locals }) => {
		if (!locals.user) return fail(401);
		await db
			.update(userSettings)
			.set({ aiApiKeyEnc: null })
			.where(eq(userSettings.userId, locals.user.id));
		return { cleared: true };
	}
};
