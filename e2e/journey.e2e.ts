import { test, expect } from '@playwright/test';
import { signUp, createTrade } from './helpers';

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

	await signUp(page, email);

	// record a closed trade (helper waits for the create+redirect to land)
	await createTrade(page, {
		symbol,
		qty: '100',
		entryPrice: '150',
		entryAt: '2026-06-01T14:30',
		exitPrice: '155',
		exitAt: '2026-06-01T15:30'
	});

	// the new symbol shows up in the trade log
	await page.goto('/trades');
	await expect(page.getByText(symbol).first()).toBeVisible({ timeout: 15000 });
});
