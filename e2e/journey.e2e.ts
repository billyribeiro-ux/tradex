import { test, expect } from '@playwright/test';

/**
 * Happy-path smoke: an unauthenticated visitor is redirected to login, can sign
 * up, lands on the dashboard, records a trade, and sees it in the trade log.
 * Runs against the real app + an in-process PGlite database (see playwright.config).
 */
test('sign up, record a trade, and see it in the log', async ({ page }) => {
	const stamp = Date.now();
	const email = `e2e-${stamp}@tradex.dev`;
	const symbol = `T${stamp % 100000}`;

	// unauthenticated → login
	await page.goto('/');
	await expect(page).toHaveURL(/\/(login|signup)/);

	// sign up
	await page.goto('/signup');
	await page.fill('#name', 'E2E Tester');
	await page.fill('#email', email);
	await page.fill('input[type=password]', 'supersecret123');
	await page.click('button[type=submit]');

	// lands in the app
	await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });

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

	// the new symbol shows up in the trade log
	await page.goto('/trades');
	await expect(page.getByText(symbol).first()).toBeVisible({ timeout: 15000 });
});
