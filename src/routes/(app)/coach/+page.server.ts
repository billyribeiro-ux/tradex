import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { coachAvailable, askCoach } from '$lib/server/services/coach';
import { resolveAccount } from '$lib/server/services/accounts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const available = locals.user ? await coachAvailable(db, locals.user.id) : false;
	return { available };
};

export const actions: Actions = {
	ask: async ({ request, locals, cookies }) => {
		if (!locals.user) return fail(401);
		const account = await resolveAccount(db, locals.user.id, cookies.get('account'));
		if (!account) return fail(400, { message: 'No account selected' });

		const fd = await request.formData();
		const question = ((fd.get('question') as string) ?? '').trim();
		if (!question) return fail(400, { message: 'Ask a question.' });

		const res = await askCoach(db, locals.user.id, account, question);
		if ('error' in res) {
			const messages: Record<string, string> = {
				'no-key': 'Add your Anthropic API key in Settings first.',
				'bad-key': 'Your stored key could not be decrypted — re-enter it in Settings.',
				'api-error': `The AI request failed: ${res.detail ?? 'unknown error'}`
			};
			return fail(400, { question, message: messages[res.error] });
		}
		return { question, answer: res.answer };
	}
};
