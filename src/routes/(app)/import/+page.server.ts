import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { importCsv, previewCsv, CsvTooLargeError } from '$lib/server/services/import';
import {
	listMappingTemplates,
	saveMappingTemplate,
	deleteMappingTemplate
} from '$lib/server/services/mapping-templates';
import { getAccount, resolveAccount } from '$lib/server/services/accounts';
import { ASSET_CLASSES, type AssetClass } from '$lib/domain/enums';
import { FIELD_TARGETS, type ColumnMap, type FieldTarget } from '$lib/domain/csv-mapping';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { accountId } = await parent();
	const account = accountId && locals.user ? await getAccount(db, locals.user.id, accountId) : null;
	const templates = locals.user ? await listMappingTemplates(db, locals.user.id) : [];
	return { assetClasses: account?.assetClasses ?? ['stock'], templates };
};

const assetClassOf = (raw: unknown): AssetClass =>
	(ASSET_CLASSES as readonly string[]).includes(raw as string) ? (raw as AssetClass) : 'stock';

/** Read the CSV text from either an uploaded file or the paste box. */
async function readCsv(fd: FormData): Promise<string> {
	const pasted = (fd.get('csv') as string)?.trim();
	const file = fd.get('file');
	if (file instanceof File && file.size > 0) return (await file.text()).trim();
	return pasted ?? '';
}

/** Build a ColumnMap from the per-field `map.<target>` select values. */
function readMapping(fd: FormData): ColumnMap {
	const map: ColumnMap = {};
	for (const { key } of FIELD_TARGETS) {
		const v = (fd.get(`map.${key}`) as string)?.trim();
		if (v) map[key as FieldTarget] = v;
	}
	return map;
}

export const actions: Actions = {
	// Step 1 — parse + auto-detect, then show the interactive mapper.
	preview: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const fd = await request.formData();
		const csv = await readCsv(fd);
		const defaultAssetClass = assetClassOf(fd.get('assetClass'));
		if (!csv) return fail(400, { message: 'Upload a CSV file or paste rows.' });
		try {
			const preview = previewCsv(csv);
			return { stage: 'map' as const, csv, defaultAssetClass, preview };
		} catch (e) {
			if (e instanceof CsvTooLargeError) return fail(413, { message: e.message });
			throw e;
		}
	},

	// Step 2 — import using the confirmed mapping; optionally save it as a template.
	import: async ({ request, locals, cookies }) => {
		if (!locals.user) redirect(302, '/login');
		const account = await resolveAccount(db, locals.user.id, cookies.get('account'));
		if (!account) return fail(400, { message: 'No account selected' });
		const fd = await request.formData();
		const csv = await readCsv(fd);
		if (!csv) return fail(400, { message: 'Upload a CSV file or paste rows.' });
		const defaultAssetClass = assetClassOf(fd.get('assetClass'));
		const mapping = readMapping(fd);

		let templateId: string | null = null;
		if (fd.get('saveTemplate') === 'on') {
			templateId = await saveMappingTemplate(db, locals.user.id, {
				broker: (fd.get('broker') as string) ?? '',
				name: (fd.get('templateName') as string) ?? '',
				assetClass: defaultAssetClass,
				columnMap: mapping
			});
		}

		try {
			const result = await importCsv(db, {
				accountId: account.id,
				csvText: csv,
				defaultAssetClass,
				mapping,
				mappingTemplateId: templateId,
				timezone: account.timezone
			});
			return { result, savedTemplate: fd.get('saveTemplate') === 'on' };
		} catch (e) {
			if (e instanceof CsvTooLargeError) return fail(413, { message: e.message });
			throw e;
		}
	},

	deleteTemplate: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const fd = await request.formData();
		const ok = await deleteMappingTemplate(
			db,
			locals.user.id,
			((fd.get('id') as string) ?? '').trim()
		);
		return ok ? { deletedTemplate: true } : fail(404);
	}
};
