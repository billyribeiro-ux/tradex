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
			BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? 'e2e-insecure-secret-change-me'
		}
	},
	use: { baseURL: `http://localhost:${PORT}` },
	testMatch: '**/*.e2e.{ts,js}'
});
