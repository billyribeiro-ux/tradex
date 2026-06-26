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

test('records setup/emotion/tags at creation and drills down by symbol', async ({ page }) => {
	test.slow();
	const s = Date.now();
	await signUp(page, uniqueEmail('meta'));
	const symA = `MA${s % 100000}`;
	const symB = `MB${s % 100000}`;

	// create with metadata captured up-front (no detour to the detail page)
	const id = await createTrade(page, {
		symbol: symA,
		entryPrice: '100',
		exitPrice: '110',
		entryAt: '2026-06-01T14:30',
		exitAt: '2026-06-01T15:30',
		setupName: 'ORB',
		emotionLabel: 'Calm',
		tags: 'momentum, gap'
	});
	await createTrade(page, {
		symbol: symB,
		entryPrice: '50',
		exitPrice: '45',
		entryAt: '2026-06-02T14:30',
		exitAt: '2026-06-02T15:30'
	});

	// the detail page reflects the metadata captured at creation (editable inputs)
	await page.goto(`/trades/${id}`);
	await expect(page.locator('input[name=setup]')).toHaveValue('ORB');
	await expect(page.locator('input[name=emotion]')).toHaveValue('Calm');
	await expect(page.locator('input[name=tags]')).toHaveValue(/momentum/);

	// drill-down: the trade log filtered to symA shows only symA
	await page.goto(`/trades?symbol=${symA}`);
	await expect(page.getByText(`Filtered: symbol ${symA}`)).toBeVisible();
	await expect(page.getByRole('link', { name: symA }).first()).toBeVisible();
	await expect(page.getByRole('link', { name: symB })).toHaveCount(0);
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

test('categories: list with usage, rename a tag, delete a setup', async ({ page }) => {
	test.slow();
	await signUp(page, uniqueEmail('cat'));
	await createTrade(page, {
		symbol: 'CATX',
		entryPrice: '100',
		exitPrice: '110',
		entryAt: '2026-06-01T14:30',
		exitAt: '2026-06-01T15:30',
		setupName: 'ScalpX',
		tags: 'breakout'
	});

	await page.goto('/categories');
	await waitForHydration(page);
	// a fresh user has exactly one setup + one tag from the trade above
	// (Svelte sets the input value as a property, so assert with toHaveValue)
	const setupInput = page.locator('form[action="?/renameSetup"] input[name=name]');
	const tagInput = page.locator('form[action="?/renameTag"] input[name=name]');
	await expect(setupInput).toHaveValue('ScalpX');
	await expect(tagInput).toHaveValue('breakout');

	// rename the tag
	await tagInput.fill('breakout2');
	await Promise.all([
		page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/categories')),
		page.locator('form[action="?/renameTag"] button[type=submit]').click()
	]);
	await page.goto('/categories');
	await expect(page.locator('form[action="?/renameTag"] input[name=name]')).toHaveValue(
		'breakout2'
	);

	// delete the setup → the setups section is empty
	page.on('dialog', (d) => d.accept());
	await Promise.all([
		page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/categories')),
		page.locator('form[action="?/deleteSetup"]').first().locator('button[type=submit]').click()
	]);
	await page.goto('/categories');
	await expect(page.locator('form[action="?/renameSetup"]')).toHaveCount(0);
});

test('share a trade as a read-only public link (P&L hidden)', async ({ page, browser }) => {
	test.slow();
	await signUp(page, uniqueEmail('share'));
	const id = await createTrade(page, {
		symbol: 'SHRX',
		entryPrice: '100',
		exitPrice: '110',
		entryAt: '2026-06-01T14:30',
		exitAt: '2026-06-01T15:30'
	});

	await page.goto(`/trades/${id}`);
	await waitForHydration(page);
	await page.click('summary:has-text("Share")');
	await page.check('input[name=hidePnl]');
	await Promise.all([
		page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/trades/')),
		page.click('button:has-text("Create link")')
	]);

	const url = await page.locator('input[aria-label="Share URL"]').first().inputValue();
	expect(url).toContain('/share/');

	// open it in a fresh anonymous context — no auth, the token is the credential
	const ctx = await browser.newContext();
	const pub = await ctx.newPage();
	await pub.goto(url);
	await expect(pub.getByText('Shared · read-only')).toBeVisible();
	await expect(pub.getByRole('heading', { name: 'SHRX' })).toBeVisible();
	await expect(pub.getByText('Net P&L')).toHaveCount(0); // hidePnl honoured
	await ctx.close();

	// revoke → the public link 404s
	await page.goto(`/trades/${id}`);
	await waitForHydration(page);
	await Promise.all([
		page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/trades/')),
		page.locator('form[action="?/revokeShare"] button[type=submit]').first().click()
	]);
	const ctx2 = await browser.newContext();
	const pub2 = await ctx2.newPage();
	const resp = await pub2.goto(url);
	expect(resp?.status()).toBe(404);
	await ctx2.close();
});

test('import: preview → map columns → import → save & reuse a template', async ({ page }) => {
	test.slow();
	await signUp(page, uniqueEmail('imp'));
	await page.goto('/import');
	await waitForHydration(page);

	await page.fill(
		'textarea[name=csv]',
		'Symbol,Side,Qty,Price,Date\nIMPX,Buy,5,100,2026-06-01T14:30:00Z\nIMPX,Sell,5,110,2026-06-01T15:30:00Z'
	);
	await page.click('button:has-text("Preview mapping")');

	// the interactive mapper appears with the columns auto-detected
	const symbolSelect = page.locator('select[name="map.symbol"]');
	await expect(symbolSelect).toBeVisible();
	await expect(symbolSelect).toHaveValue('Symbol');
	// live preview shows the mapped symbol
	await expect(page.getByRole('cell', { name: 'IMPX' }).first()).toBeVisible();

	// save the mapping as a template while importing
	await page.check('input[name=saveTemplate]');
	await page.fill('input[name=templateName]', 'My IB');
	await page.fill('input[name=broker]', 'IBKR');
	await page.click('button:has-text("Import")');

	await expect(page.getByText('executions imported')).toBeVisible({ timeout: 10000 });

	// the round trip grouped into one closed trade
	await page.goto('/trades?symbol=IMPX');
	await expect(page.getByText('1 trades')).toBeVisible();

	// the template persists for reuse
	await page.goto('/import');
	await expect(page.getByText('My IB')).toBeVisible();
});
