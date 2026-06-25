import { test, expect } from '@playwright/test';
import { signUp, createTrade, waitForHydration, uniqueEmail } from './helpers';

/**
 * Feature-level end-to-end coverage. Each test signs up its own isolated user
 * (fresh account via bootstrapUser) so they can run in any order. Drives the
 * real app against the production build + in-process PGlite (see playwright.config).
 */

test.describe.configure({ mode: 'parallel' });

test('trades: create, list, filter, export, then delete', async ({ page }) => {
	test.slow();
	const s = Date.now();
	const email = uniqueEmail('flow');
	const win1 = `WA${s % 100000}`;
	const win2 = `WB${s % 100000}`;
	const loss = `LC${s % 100000}`;
	await signUp(page, email);

	// two winners, one loser
	await createTrade(page, {
		symbol: win1,
		entryPrice: '100',
		exitPrice: '110',
		entryAt: '2026-06-01T14:30',
		exitAt: '2026-06-01T15:30'
	});
	await createTrade(page, {
		symbol: win2,
		entryPrice: '50',
		exitPrice: '55',
		entryAt: '2026-06-02T14:30',
		exitAt: '2026-06-02T15:30'
	});
	const lossId = await createTrade(page, {
		symbol: loss,
		entryPrice: '200',
		exitPrice: '180',
		entryAt: '2026-06-03T14:30',
		exitAt: '2026-06-03T15:30'
	});

	// trade log shows all three
	await page.goto('/trades');
	await expect(page.getByText('3 trades')).toBeVisible();
	for (const sym of [win1, win2, loss]) {
		await expect(page.getByText(sym).first()).toBeVisible();
	}

	// status filter (all are closed)
	await page.goto('/trades?status=open');
	await expect(page.getByText('No trades match this filter')).toBeVisible();

	// export reflects the data (uses the browser's auth cookies)
	const csv = await page.request.get('/export/trades.csv');
	expect(csv.ok()).toBeTruthy();
	const csvBody = await csv.text();
	expect(csvBody).toContain(win1);
	const json = await page.request.get('/export/trades.json');
	expect(json.ok()).toBeTruthy();
	const jsonBody = await json.json();
	expect(
		Array.isArray(jsonBody) ? jsonBody.length : jsonBody.trades?.length
	).toBeGreaterThanOrEqual(3);

	// delete the losing trade from its detail page
	await page.goto(`/trades/${lossId}`);
	await waitForHydration(page);
	page.on('dialog', (d) => d.accept());
	await page.click('button:has-text("Delete trade")');
	await page.waitForURL(/\/trades(\?|$)/, { timeout: 15000 });
	await expect(page.getByText('2 trades')).toBeVisible({ timeout: 10000 });
	await expect(page.getByText(loss)).toHaveCount(0);
});

test('dashboard, calendar, analytics, risk all render with data', async ({ page }) => {
	test.slow();
	const s = Date.now();
	await signUp(page, uniqueEmail('views'));
	await createTrade(page, {
		symbol: `V${s % 100000}`,
		entryPrice: '100',
		exitPrice: '120',
		entryAt: '2026-05-10T14:30',
		exitAt: '2026-05-10T15:30'
	});

	for (const [path, heading] of [
		['/dashboard', 'Dashboard'],
		['/calendar', 'Calendar'],
		['/analytics', 'Analytics'],
		['/risk', 'Risk & Validation']
	] as const) {
		const resp = await page.goto(path);
		expect(resp?.status(), `${path} status`).toBeLessThan(400);
		await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
	}
	// the dashboard surfaces the transparent score
	await page.goto('/dashboard');
	await expect(page.getByText('TradeX Score')).toBeVisible();
});

test('accounts: create a second account and delete it', async ({ page }) => {
	test.slow();
	await signUp(page, uniqueEmail('acct'));
	await page.goto('/accounts');
	await waitForHydration(page);

	// scope to the create form — the page also has a (collapsed) edit form per account.
	// Wait for the action POST, then reload for a clean server render before asserting.
	const createForm = page.locator('form[action="?/create"]');
	await createForm.locator('input[name=name]').fill('Prop Eval 50K');
	await Promise.all([
		page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/accounts'), {
			timeout: 15000
		}),
		createForm.locator('button[type=submit]').click()
	]);
	await page.goto('/accounts');
	// the new account shows as a card on the page (it also appears in the account
	// switcher <option>, so scope to the main region to avoid a strict-mode match)
	await expect(page.getByRole('main').getByText('Prop Eval 50K')).toBeVisible({ timeout: 10000 });

	// delete the newest account (listed last) via its delete form
	page.on('dialog', (d) => d.accept());
	await waitForHydration(page);
	await Promise.all([
		page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/accounts'), {
			timeout: 15000
		}),
		page.locator('form[action="?/delete"]').last().locator('button').click()
	]);
	await page.goto('/accounts');
	await expect(page.getByRole('main').getByText('Prop Eval 50K')).toHaveCount(0, {
		timeout: 10000
	});
});

test('coach: graceful no-key state, then enabled after saving a key', async ({ page }) => {
	test.slow();
	await signUp(page, uniqueEmail('coach'));

	// without a key, the coach prompts to connect — no crash
	await page.goto('/coach');
	await expect(page.getByText('Connect your Claude key')).toBeVisible();

	// settings exposes export + AI key form
	await page.goto('/settings');
	await waitForHydration(page);
	await expect(page.locator('a[href="/export/trades.csv"]')).toBeVisible();
	await page.fill('input[name=apiKey]', 'sk-ant-fake-key-for-ui-state-only');
	await page.click('button:has-text("Save")');
	await expect(page.getByText('Saved')).toBeVisible({ timeout: 10000 });

	// now the coach shows the query UI (a textarea to ask), not the connect prompt
	await page.goto('/coach');
	await expect(page.locator('textarea[name=question]')).toBeVisible();

	// clearing the key returns to the connect-prompt state
	await page.goto('/settings');
	await waitForHydration(page);
	await page.click('button:has-text("Remove key")');
	await expect(page.getByText(/Removed|cleared/i)).toBeVisible({ timeout: 10000 });
});

test('playbooks: create and delete', async ({ page }) => {
	test.slow();
	await signUp(page, uniqueEmail('pb'));
	await page.goto('/playbooks');
	await waitForHydration(page);

	await page.fill('input[name=name]', 'Opening Range Breakout');
	await page.click('button:has-text("Create playbook")');
	await expect(page.getByText('Opening Range Breakout')).toBeVisible({ timeout: 10000 });

	page.on('dialog', (d) => d.accept());
	await page.locator('form[action="?/delete"]').last().locator('button').click();
	await expect(page.getByText('Opening Range Breakout')).toHaveCount(0, { timeout: 10000 });
});
