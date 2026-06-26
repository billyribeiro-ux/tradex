import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	listCategorization,
	renameTag,
	deleteTag,
	renameSetup,
	deleteSetup,
	renameEmotion,
	deleteEmotion
} from '$lib/server/services/categorization';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return { tags: [], setups: [], emotions: [] };
	return await listCategorization(db, locals.user.id);
};

const id = (fd: FormData) => ((fd.get('id') as string) ?? '').trim();
const name = (fd: FormData) => ((fd.get('name') as string) ?? '').trim();

export const actions: Actions = {
	renameTag: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const fd = await request.formData();
		const r = await renameTag(db, locals.user.id, id(fd), name(fd));
		return r.ok ? { ok: true, merged: r.merged } : fail(400, { message: 'Could not rename tag' });
	},
	deleteTag: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const fd = await request.formData();
		return (await deleteTag(db, locals.user.id, id(fd))) ? { ok: true } : fail(404);
	},
	renameSetup: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const fd = await request.formData();
		const r = await renameSetup(db, locals.user.id, id(fd), name(fd));
		return r.ok ? { ok: true, merged: r.merged } : fail(400, { message: 'Could not rename setup' });
	},
	deleteSetup: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const fd = await request.formData();
		return (await deleteSetup(db, locals.user.id, id(fd))) ? { ok: true } : fail(404);
	},
	renameEmotion: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const fd = await request.formData();
		const r = await renameEmotion(db, locals.user.id, id(fd), name(fd));
		return r.ok
			? { ok: true, merged: r.merged }
			: fail(400, { message: 'Could not rename emotion' });
	},
	deleteEmotion: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const fd = await request.formData();
		return (await deleteEmotion(db, locals.user.id, id(fd))) ? { ok: true } : fail(404);
	}
};
