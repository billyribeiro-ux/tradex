import { test, expect } from '@playwright/test';

/**
 * Happy-path smoke: an unauthenticated visitor is redirected to login, can sign
 * up, lands on the dashboard, records a trade, and sees it in the trade log.
 * Runs against the real app + an in-process PGlite database (see playwright.config).
 */
test('sign up, record a trade, and see it in the log', async ({ page }) => {
	test.slow();
	const stamp = Date.now();
	const email = `e2e-${stamp}@tradex.dev`;
	const symbol = `T${stamp % 100000}`;

	// unauthenticated → login
	await page.goto('/dashboard');
	await expect(page).toHaveURL(/\/login/);

	// Sign up. The form is client-only, so a pre-hydration click submits the
	// form natively (a harmless GET to /signup that creates no user). Retry
	// fill+submit until a hydrated click runs signUp.email and lands us in the
	// app — safe against duplicates because only the hydrated click registers.
	await page.goto('/signup');
	await expect(async () => {
		await page.fill('#name', 'E2E Tester');
		await page.fill('#email', email);
		await page.fill('input[type=password]', 'supersecret123');
		await page.click('button[type=submit]');
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 6000 });
	}).toPass({ timeout: 60000 });

	// record a closed trade
	await page.goto('/trades/new');
	await page.fill('input[name=symbol]', symbol);
	await page.selectOption('select[name=assetClass]', 'stock');
	await page.selectOption('select[name=direction]', 'long');
	await page.fill('input[name=qty]', '100');
	await page.fill('input[name=entryPrice]', '150');
	await page.fill('input[name=entryAt]', '2026-06-01T14:30');
	await page.fill('input[name=exitPrice]', '155');
	await page.fill('input[name=exitAt]', '2026-06-01T15:30');
	await page.click('button[type=submit]');

	// The new symbol shows up in the trade log. Re-navigate until it appears —
	// the submit's create+redirect commits asynchronously, so a single goto can
	// race ahead of the write.
	await expect(async () => {
		await page.goto('/trades');
		await expect(page.getByText(symbol).first()).toBeVisible({ timeout: 5000 });
	}).toPass({ timeout: 30000 });
});
