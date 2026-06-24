import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

/**
 * Screenshot capture flow (NOT a smoke assertion suite). Runs only where
 * SEED_DEMO=1 enables the dev seeding endpoint — see the `snapshots` CI job,
 * which uploads the resulting PNGs as a build artifact. It signs up a fresh
 * user, seeds a realistic demo dataset, then captures every screen.
 *
 * Captures land in `screenshots/` (git-ignored).
 */

const OUT = 'screenshots';

// Desktop frame so the sidebar layout is shown the way users see it.
test.use({ viewport: { width: 1440, height: 900 } });

// Public marketing + auth screens, then the full authenticated app.
const PUBLIC_PAGES: [path: string, name: string][] = [
	['/', '00-landing'],
	['/login', '01-login'],
	['/signup', '02-signup']
];

const APP_PAGES: [path: string, name: string][] = [
	['/dashboard', '10-dashboard'],
	['/trades', '11-trades'],
	['/trades/new', '12-trade-new'],
	['/calendar', '13-calendar'],
	['/analytics', '14-analytics'],
	['/playbooks', '15-playbooks'],
	['/risk', '16-risk'],
	['/journal', '17-journal'],
	['/coach', '18-coach'],
	['/import', '19-import'],
	['/accounts', '20-accounts'],
	['/settings', '21-settings']
];

async function shot(page: import('@playwright/test').Page, name: string) {
	await page.waitForLoadState('networkidle').catch(() => {});
	// Settle fonts/charts before capture.
	await page.waitForTimeout(400);
	await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

test('capture screenshots of every screen', async ({ page }) => {
	test.slow();
	await mkdir(OUT, { recursive: true });

	// Public, unauthenticated screens.
	for (const [path, name] of PUBLIC_PAGES) {
		await page.goto(path);
		await shot(page, name);
	}

	// Sign up a fresh user (unique per run).
	const email = `demo-${process.env.GITHUB_RUN_ID ?? 'local'}-${process.pid}@tradex.dev`;
	await page.goto('/signup');
	await page.fill('#name', 'Demo Trader');
	await page.fill('#email', email);
	await page.fill('input[type=password]', 'supersecret123');
	await page.click('button[type=submit]');
	await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

	// Seed a realistic dataset for this user (shares the browser auth cookies).
	const res = await page.request.post('/api/dev/seed');
	expect(res.ok(), `seed endpoint failed: ${res.status()} ${await res.text()}`).toBeTruthy();
	const seeded = await res.json();
	expect(seeded.trades).toBeGreaterThan(0);

	// Capture each authenticated screen.
	for (const [path, name] of APP_PAGES) {
		await page.goto(path);
		await shot(page, name);
	}

	// A populated trade detail page: the log rows navigate on click (not anchors).
	await page.goto('/trades');
	const firstRow = page.locator('tbody tr').first();
	if (await firstRow.count()) {
		await firstRow.click();
		await page.waitForURL(/\/trades\/[0-9a-f-]{36}/, { timeout: 15_000 });
		await shot(page, '22-trade-detail');
	}
});
