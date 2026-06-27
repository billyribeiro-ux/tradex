import { randomBytes } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import type { DB } from '$lib/server/db';
import { shareLink, trade, tradingAccount, instrument } from '$lib/server/db/schema';
import { getTradeCategorization } from './categorization';

/**
 * Read-only trade sharing. A share link is an unguessable token that grants
 * anonymous read access to ONE trade, optionally hiding position size and/or
 * dollar P&L (so a mentor can review the decision without seeing account size).
 * The token is the only credential — the public view never requires auth, and
 * never exposes anything beyond the single shared trade.
 */

export interface ShareScope {
	hideSize?: boolean;
	hidePnl?: boolean;
}

function newToken(): string {
	return randomBytes(18).toString('base64url'); // 24 url-safe chars
}

/** Confirm the trade belongs to one of the user's accounts. */
async function ownsTrade(db: DB, userId: string, tradeId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: trade.id })
		.from(trade)
		.innerJoin(tradingAccount, eq(trade.accountId, tradingAccount.id))
		.where(and(eq(trade.id, tradeId), eq(tradingAccount.userId, userId)))
		.limit(1);
	return !!row;
}

/** Create (or return an existing identical) share link for a trade. */
export async function createTradeShare(
	db: DB,
	userId: string,
	tradeId: string,
	opts: { scope?: ShareScope; expiresInDays?: number | null } = {}
): Promise<{ token: string } | { error: 'not-owned' }> {
	if (!(await ownsTrade(db, userId, tradeId))) return { error: 'not-owned' };
	const token = newToken();
	const expiresAt =
		opts.expiresInDays && opts.expiresInDays > 0
			? Date.now() + opts.expiresInDays * 86_400_000
			: null;
	await db.insert(shareLink).values({
		userId,
		tradeId,
		token,
		scope: opts.scope ?? {},
		expiresAt
	});
	return { token };
}

export interface SharedTrade {
	symbol: string;
	assetClass: string;
	direction: string;
	status: string;
	openedAt: number;
	closedAt: number | null;
	holdMs: number | null;
	currency: string;
	rMultiple: number | null;
	avgEntry: number;
	avgExit: number | null;
	/** null when the owner hid position size */
	qty: number | null;
	/** null when the owner hid dollar P&L */
	netPnl: number | null;
	notes: string | null;
	setupName: string | null;
	emotionLabel: string | null;
	tagNames: string[];
	scope: ShareScope;
}

/** Resolve a public share token to a scoped, read-only trade view (or null). */
export async function getSharedTrade(db: DB, token: string): Promise<SharedTrade | null> {
	const [row] = await db
		.select({ link: shareLink, trade, instrument, currency: tradingAccount.baseCurrency })
		.from(shareLink)
		.innerJoin(trade, eq(shareLink.tradeId, trade.id))
		.innerJoin(instrument, eq(trade.instrumentId, instrument.id))
		.innerJoin(tradingAccount, eq(trade.accountId, tradingAccount.id))
		.where(eq(shareLink.token, token))
		.limit(1);
	if (!row) return null;
	if (row.link.expiresAt != null && row.link.expiresAt < Date.now()) return null; // expired

	const scope: ShareScope = row.link.scope ?? {};
	const hidePnl = !!scope.hidePnl;
	const cat = await getTradeCategorization(db, row.trade.id);
	return {
		symbol: row.instrument.symbol,
		assetClass: row.instrument.assetClass,
		direction: row.trade.direction,
		status: row.trade.status,
		openedAt: row.trade.openedAt,
		closedAt: row.trade.closedAt,
		holdMs: row.trade.holdMs,
		currency: row.currency,
		avgEntry: row.trade.avgEntry,
		// hidePnl hides the OUTCOME, not just the headline dollar figure: the
		// R-multiple is the normalised P&L and the exit price reveals it too, so
		// both are withheld alongside netPnl (the entry/thesis still shows).
		rMultiple: hidePnl ? null : row.trade.rMultiple,
		avgExit: hidePnl ? null : row.trade.avgExit,
		netPnl: hidePnl ? null : row.trade.netPnl,
		qty: scope.hideSize ? null : row.trade.qtyOpened,
		notes: row.trade.notes,
		setupName: cat.setupName,
		emotionLabel: cat.emotionLabel,
		tagNames: cat.tagNames,
		scope
	};
}

export interface ShareLinkRow {
	id: string;
	token: string;
	scope: ShareScope;
	expiresAt: number | null;
	createdAt: number;
}

/** List a user's active share links for a given trade. */
export async function listTradeShares(
	db: DB,
	userId: string,
	tradeId: string
): Promise<ShareLinkRow[]> {
	const rows = await db
		.select({
			id: shareLink.id,
			token: shareLink.token,
			scope: shareLink.scope,
			expiresAt: shareLink.expiresAt,
			createdAt: shareLink.createdAt
		})
		.from(shareLink)
		.where(and(eq(shareLink.userId, userId), eq(shareLink.tradeId, tradeId)))
		.orderBy(desc(shareLink.createdAt));
	return rows.map((r) => ({ ...r, scope: r.scope ?? {} }));
}

/** Revoke (delete) a share link owned by the user. */
export async function revokeShareLink(db: DB, userId: string, id: string): Promise<boolean> {
	const res = await db
		.delete(shareLink)
		.where(and(eq(shareLink.id, id), eq(shareLink.userId, userId)))
		.returning({ id: shareLink.id });
	return res.length > 0;
}
