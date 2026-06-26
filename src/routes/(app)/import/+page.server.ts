import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { importCsv, CsvTooLargeError } from '$lib/server/services/import';
import { getAccount, resolveAccount } from '$lib/server/services/accounts';
import { ASSET_CLASSES, type AssetClass } from '$lib/domain/enums';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { accountId } = await parent();
	const account = accountId && locals.user ? await getAccount(db, locals.user.id, accountId) : null;
	return { assetClasses: account?.assetClasses ?? ['stock'] };
};

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		if (!locals.user) redirect(302, '/login');
		const account = await resolveAccount(db, locals.user.id, cookies.get('account'));
		if (!account) return fail(400, { message: 'No account selected' });

		const fd = await request.formData();
		const file = fd.get('file');
		const pasted = (fd.get('csv') as string)?.trim();
		const acRaw = fd.get('assetClass') as string;
		const defaultAssetClass = (ASSET_CLASSES as readonly string[]).includes(acRaw)
			? (acRaw as AssetClass)
			: 'stock';

		let csvText = pasted ?? '';
		let filename: string | undefined;
		if (file instanceof File && file.size > 0) {
			csvText = await file.text();
			filename = file.name;
		}
		if (!csvText) return fail(400, { message: 'Upload a CSV file or paste rows.' });

		try {
			const result = await importCsv(db, {
				accountId: account.id,
				csvText,
				defaultAssetClass,
				filename,
				timezone: account.timezone
			});
			return { result };
		} catch (e) {
			if (e instanceof CsvTooLargeError) return fail(413, { message: e.message });
			throw e;
		}
	}
};
