import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { getAccount, resolveAccount } from '$lib/server/services/accounts';
import { listTrades } from '$lib/server/services/trades';
import { propFirmConfig } from '$lib/server/db/schema';
import { monteCarlo, monteCarloBands } from '$lib/domain/montecarlo';
import { evaluatePropFirm, type PropFirmStatus } from '$lib/domain/propfirm';
import { toScaled } from '$lib/money';
import { PROP_FIRMS, DRAWDOWN_TYPES, type PropFirm, type DrawdownType } from '$lib/domain/enums';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { accountId } = await parent();
	const blank = {
		account: null,
		mc: null,
		fan: [] as ReturnType<typeof monteCarloBands>,
		prop: null as PropFirmStatus | null,
		config: null,
		firms: PROP_FIRMS,
		drawdownTypes: DRAWDOWN_TYPES,
		tradeCount: 0
	};
	if (!accountId || !locals.user) return blank;
	const account = await getAccount(db, locals.user.id, accountId);
	if (!account) return blank;

	const trades = await listTrades(db, account.id, { status: 'closed', limit: 5000 });
	const pnls = trades.map((t) => t.netPnl);
	const horizon = Math.max(20, trades.length);
	const mc = monteCarlo(pnls, {
		runs: 1000,
		horizon,
		ruinThreshold: account.startingBalance > 0 ? account.startingBalance : undefined,
		seed: 12345
	});
	const fan = trades.length >= 2 ? monteCarloBands(pnls, { runs: 600, horizon, seed: 12345 }) : [];

	const [config] = await db
		.select()
		.from(propFirmConfig)
		.where(eq(propFirmConfig.accountId, account.id))
		.limit(1);
	const prop = config
		? evaluatePropFirm(
				config,
				trades.map((t) => ({ netPnl: t.netPnl, closedAt: t.closedAt })),
				account.startingBalance
			)
		: null;

	return {
		account: { name: account.name, baseCurrency: account.baseCurrency },
		mc,
		fan,
		prop,
		config: config ?? null,
		firms: PROP_FIRMS,
		drawdownTypes: DRAWDOWN_TYPES,
		tradeCount: trades.length
	};
};

export const actions: Actions = {
	saveConfig: async ({ request, locals, cookies }) => {
		if (!locals.user) return fail(401);
		const account = await resolveAccount(db, locals.user.id, cookies.get('account'));
		if (!account) return fail(400, { message: 'No account selected' });

		const fd = await request.formData();
		const money = (k: string) => {
			const v = (fd.get(k) as string)?.trim();
			return v ? toScaled(Number(v)) : null;
		};
		const int = (k: string) => {
			const v = (fd.get(k) as string)?.trim();
			return v ? Math.round(Number(v)) : null;
		};
		const firmRaw = fd.get('firm') as string;
		const firm = (PROP_FIRMS as readonly string[]).includes(firmRaw)
			? (firmRaw as PropFirm)
			: 'other';
		const ddRaw = fd.get('drawdownType') as string;
		const drawdownType = (DRAWDOWN_TYPES as readonly string[]).includes(ddRaw)
			? (ddRaw as DrawdownType)
			: 'static';

		const values = {
			accountId: account.id,
			firm,
			profitTarget: money('profitTarget'),
			dailyLossLimit: money('dailyLossLimit'),
			maxDrawdown: money('maxDrawdown'),
			drawdownType,
			minTradingDays: int('minTradingDays'),
			consistencyPct: int('consistencyPct')
		};
		await db
			.insert(propFirmConfig)
			.values(values)
			.onConflictDoUpdate({ target: propFirmConfig.accountId, set: values });
		return { saved: true };
	}
};
