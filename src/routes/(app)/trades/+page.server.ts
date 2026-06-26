import { db } from '$lib/server/db';
import { listTrades, countTrades, type TradeFilter } from '$lib/server/services/trades';
import { getAccount } from '$lib/server/services/accounts';
import { ASSET_CLASSES, type AssetClass } from '$lib/domain/enums';
import { naiveToUtc } from '$lib/datetime';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const { accountId } = await parent();
	const p = url.searchParams;
	const statusParam = p.get('status');
	const status = statusParam === 'open' || statusParam === 'closed' ? statusParam : undefined;
	const symbol = p.get('symbol')?.toUpperCase() || undefined;
	const acRaw = p.get('assetClass');
	const assetClass = (ASSET_CLASSES as readonly string[]).includes(acRaw ?? '')
		? (acRaw as AssetClass)
		: undefined;
	const date = /^\d{4}-\d{2}-\d{2}$/.test(p.get('date') ?? '') ? p.get('date')! : undefined;

	const empty = { symbol, assetClass, date };
	if (!accountId)
		return {
			trades: [],
			total: 0,
			status,
			...empty,
			page: 1,
			pageSize: PAGE_SIZE,
			pageCount: 1,
			currency: 'USD'
		};

	const account = locals.user ? await getAccount(db, locals.user.id, accountId) : null;
	const tz = account?.timezone ?? 'UTC';

	// A date drill-down is a single local calendar day in the account timezone.
	let from: number | undefined;
	let to: number | undefined;
	if (date) {
		const [y, mo, d] = date.split('-').map(Number);
		from = naiveToUtc(y!, mo! - 1, d!, 0, 0, 0, tz);
		to = naiveToUtc(y!, mo! - 1, d!, 23, 59, 59, tz);
	}

	const filter: Omit<TradeFilter, 'limit' | 'offset'> = { status, symbol, assetClass, from, to };
	const total = await countTrades(db, accountId, filter);
	const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const page = Math.min(Math.max(1, Number(p.get('page')) || 1), pageCount);
	const trades = await listTrades(db, accountId, {
		...filter,
		limit: PAGE_SIZE,
		offset: (page - 1) * PAGE_SIZE
	});
	return {
		trades,
		total,
		status,
		...empty,
		page,
		pageSize: PAGE_SIZE,
		pageCount,
		currency: account?.baseCurrency ?? 'USD'
	};
};
