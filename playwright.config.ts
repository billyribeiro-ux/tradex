import { defineConfig } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
	webServer: {
		command: 'pnpm db:migrate && pnpm dev --port 4173',
		port: PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000,
		env: {
			DATABASE_URL: process.env.DATABASE_URL ?? 'pglite://.pgdata',
			ORIGIN: `http://localhost:${PORT}`,
			BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? 'e2e-insecure-secret-change-me',
			// Enables the dev-only seeding endpoint for the screenshot capture flow.
			SEED_DEMO: process.env.SEED_DEMO ?? ''
		}
	},
	use: {
		baseURL: `http://localhost:${PORT}`,
		// Force software WebGL so the Threlte/3D surfaces render in headless CI.
		launchOptions: {
			args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
		}
	},
	testMatch: '**/*.e2e.{ts,js}'
});
