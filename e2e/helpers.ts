import { expect, type Page } from '@playwright/test';

let seq = 0;
/** A process-unique email so parallel workers never collide on signup. */
export function uniqueEmail(prefix = 'e2e'): string {
	seq += 1;
	return `${prefix}-${Date.now().toString(36)}-${process.pid}-${seq}@tradex.dev`;
}

/**
 * Wait until the SvelteKit app has hydrated on the client. The root layout sets
 * `<html data-hydrated="1">` in a client-only $effect, so progressive-enhancement
 * forms (use:enhance) are guaranteed to intercept submits past this point. Without
 * it, a submit click can land mid-DOM-swap and be silently dropped.
 */
export async function waitForHydration(page: Page, timeout = 15000) {
	await page.waitForSelector('html[data-hydrated="1"]', { timeout });
}

/**
 * Sign up a fresh user and land in the app. The signup form is client-only
 * (better-auth runs in the browser), so a pre-hydration native submit is a
 * harmless no-op GET — we retry fill+submit until a hydrated click runs
 * signUp.email. Safe against duplicates: only the hydrated click creates a user.
 */
export async function signUp(page: Page, email: string, name = 'E2E Tester') {
	await page.goto('/signup');
	await waitForHydration(page);
	await expect(async () => {
		await page.fill('#name', name);
		await page.fill('#email', email);
		await page.fill('input[type=password]', 'supersecret123');
		await page.click('button[type=submit]');
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });
	}).toPass({ timeout: 60000 });
}

/** Log in an existing user. */
export async function login(page: Page, email: string, password = 'supersecret123') {
	await page.goto('/login');
	await waitForHydration(page);
	await expect(async () => {
		await page.fill('#email', email);
		await page.fill('input[type=password]', password);
		await page.click('button[type=submit]');
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });
	}).toPass({ timeout: 30000 });
}

export interface TradeInput {
	symbol: string;
	assetClass?: string;
	direction?: 'long' | 'short';
	qty?: string;
	entryPrice?: string;
	entryAt?: string;
	exitPrice?: string;
	exitAt?: string;
}

/**
 * Fill and submit the new-trade form, returning once the create+redirect has
 * landed on the trade detail page. Hydration is awaited first so use:enhance is
 * active; the submit is retried only while still on the form (the server is
 * idempotent per fill but each successful submit creates a row, so we guard on
 * the URL not having changed).
 */
export async function createTrade(page: Page, t: TradeInput): Promise<string> {
	await page.goto('/trades/new');
	await waitForHydration(page);
	await page.fill('input[name=symbol]', t.symbol);
	await page.selectOption('select[name=assetClass]', t.assetClass ?? 'stock');
	await page.selectOption('select[name=direction]', t.direction ?? 'long');
	await page.fill('input[name=qty]', t.qty ?? '100');
	await page.fill('input[name=entryPrice]', t.entryPrice ?? '150');
	await page.fill('input[name=entryAt]', t.entryAt ?? '2026-06-01T14:30');
	if (t.exitPrice !== undefined) await page.fill('input[name=exitPrice]', t.exitPrice);
	if (t.exitAt !== undefined) await page.fill('input[name=exitAt]', t.exitAt);

	await page.click('button[type=submit]');
	await page.waitForURL(/\/trades\/[0-9a-f-]{36}/, { timeout: 20000 });
	const m = page.url().match(/\/trades\/([0-9a-f-]{36})/);
	return m![1];
}
