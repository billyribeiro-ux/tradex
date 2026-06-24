import { and, eq } from 'drizzle-orm';
import type { DB } from '$lib/server/db';
import { tradingAccount, userSettings } from '$lib/server/db/schema';
import type { AssetClass } from '$lib/domain/enums';

/** Ensure a new user has settings + at least one account; return the default account id. */
export async function bootstrapUser(db: DB, userId: string): Promise<string> {
	const settings = await db
		.select()
		.from(userSettings)
		.where(eq(userSettings.userId, userId))
		.limit(1);
	if (settings.length === 0) {
		await db.insert(userSettings).values({ userId }).onConflictDoNothing();
	}

	const accounts = await db
		.select({ id: tradingAccount.id })
		.from(tradingAccount)
		.where(eq(tradingAccount.userId, userId))
		.limit(1);
	if (accounts[0]) return accounts[0].id;

	const [created] = await db
		.insert(tradingAccount)
		.values({
			userId,
			name: 'Main Account',
			assetClasses: ['stock', 'future', 'forex', 'option', 'crypto'],
			baseCurrency: 'USD'
		})
		.returning({ id: tradingAccount.id });

	await db
		.update(userSettings)
		.set({ defaultAccountId: created!.id })
		.where(eq(userSettings.userId, userId));
	return created!.id;
}

export async function getSettings(db: DB, userId: string) {
	const [s] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
	return s ?? null;
}

export async function listAccounts(db: DB, userId: string) {
	return db
		.select()
		.from(tradingAccount)
		.where(eq(tradingAccount.userId, userId))
		.orderBy(tradingAccount.createdAt);
}

export async function getAccount(db: DB, userId: string, accountId: string) {
	const [a] = await db
		.select()
		.from(tradingAccount)
		.where(and(eq(tradingAccount.id, accountId), eq(tradingAccount.userId, userId)))
		.limit(1);
	return a ?? null;
}

/** Resolve the account to show: the requested one (if owned) or the user's default. */
export async function resolveAccount(db: DB, userId: string, requestedId?: string | null) {
	if (requestedId) {
		const a = await getAccount(db, userId, requestedId);
		if (a) return a;
	}
	const accounts = await listAccounts(db, userId);
	return accounts[0] ?? null;
}

export async function createAccount(
	db: DB,
	userId: string,
	input: {
		name: string;
		broker?: string | null;
		assetClasses: AssetClass[];
		baseCurrency: string;
		startingBalance?: number;
		timezone?: string;
		isPropFirm?: boolean;
	}
) {
	const [created] = await db
		.insert(tradingAccount)
		.values({
			userId,
			name: input.name,
			broker: input.broker ?? null,
			assetClasses: input.assetClasses,
			baseCurrency: input.baseCurrency,
			startingBalance: input.startingBalance ?? 0,
			timezone: input.timezone ?? 'UTC',
			isPropFirm: input.isPropFirm ?? false
		})
		.returning();
	return created!;
}
