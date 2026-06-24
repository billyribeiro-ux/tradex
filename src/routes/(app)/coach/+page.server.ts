import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { coachAvailable, askCoach } from '$lib/server/services/coach';
import { coachQuery } from '$lib/server/services/coach-sql';
import { resolveAccount } from '$lib/server/services/accounts';
import type { Actions, PageServerLoad } from './$types';

const ERRORS: Record<string, string> = {
	'no-key': 'Add your Anthropic API key in Settings first.',
	'bad-key': 'Your stored key could not be decrypted — re-enter it in Settings.',
	'api-error': 'The AI request failed.',
	'unsafe-sql': 'That question could not be turned into a safe query.'
};

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
			return fail(400, {
				mode: 'insights',
				question,
				message: `${ERRORS[res.error]} ${res.detail ?? ''}`.trim()
			});
		}
		return { mode: 'insights', question, answer: res.answer };
	},

	query: async ({ request, locals, cookies }) => {
		if (!locals.user) return fail(401);
		const account = await resolveAccount(db, locals.user.id, cookies.get('account'));
		if (!account) return fail(400, { message: 'No account selected' });
		const fd = await request.formData();
		const question = ((fd.get('question') as string) ?? '').trim();
		if (!question) return fail(400, { message: 'Ask a question.' });

		const res = await coachQuery(db, locals.user.id, account, question);
		if ('error' in res) {
			return fail(400, {
				mode: 'query',
				question,
				message: `${ERRORS[res.error]} ${res.detail ?? ''}`.trim()
			});
		}
		return {
			mode: 'query',
			question,
			sql: res.sql,
			columns: res.columns,
			rows: res.rows,
			rowCount: res.rowCount
		};
	}
};
