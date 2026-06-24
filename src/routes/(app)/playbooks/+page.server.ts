import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { listPlaybooks, createPlaybook, playbookPerformance } from '$lib/server/services/playbooks';
import type { Actions, PageServerLoad } from './$types';

type PerfRow = { netPnl: number; winRate: number; tradeCount: number; profitFactor: number };

export const load: PageServerLoad = async ({ locals }) => {
	const perf: Record<string, PerfRow> = {};
	if (!locals.user) return { playbooks: [], perf, currency: 'USD' };

	const playbooks = await listPlaybooks(db, locals.user.id);
	const perfMap = await playbookPerformance(db, locals.user.id);
	for (const [id, m] of perfMap) {
		perf[id] = {
			netPnl: m.netPnl,
			winRate: m.winRate,
			tradeCount: m.tradeCount,
			profitFactor: m.profitFactor
		};
	}
	return { playbooks, perf, currency: 'USD' };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const fd = await request.formData();
		const name = ((fd.get('name') as string) ?? '').trim();
		if (!name) return fail(400, { message: 'Name is required' });

		const description = ((fd.get('description') as string) ?? '').trim() || null;
		const entryRaw = ((fd.get('entryCriteria') as string) ?? '').trim();
		const maxRiskPctRaw = (fd.get('maxRiskPct') as string)?.trim();
		const minRRRaw = (fd.get('minRR') as string)?.trim();

		const created = await createPlaybook(db, locals.user.id, {
			name,
			description,
			rules: {
				entryCriteria: entryRaw
					? entryRaw
							.split('\n')
							.map((s) => s.trim())
							.filter(Boolean)
					: [],
				maxRiskPct: maxRiskPctRaw ? Number(maxRiskPctRaw) : undefined,
				minRR: minRRRaw ? Number(minRRRaw) : undefined
			}
		});
		if (!created) return fail(400, { message: 'A playbook with that name already exists' });
		return { created: true };
	}
};
