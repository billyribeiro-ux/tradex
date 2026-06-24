import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { listJournal, createJournalEntry, deleteJournalEntry } from '$lib/server/services/journal';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const today = new Date().toISOString().slice(0, 10);
	if (!locals.user) return { entries: [], today };
	return { entries: await listJournal(db, locals.user.id), today };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const fd = await request.formData();
		const date = ((fd.get('date') as string) ?? '').trim();
		const body = ((fd.get('body') as string) ?? '').trim();
		if (!date) return fail(400, { message: 'Pick a date' });
		if (!body) return fail(400, { message: 'Write something' });
		await createJournalEntry(db, locals.user.id, {
			date,
			title: ((fd.get('title') as string) ?? '').trim() || null,
			body
		});
		return { created: true };
	},
	delete: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const fd = await request.formData();
		const id = (fd.get('id') as string) ?? '';
		if (id) await deleteJournalEntry(db, locals.user.id, id);
		return { deleted: true };
	}
};
