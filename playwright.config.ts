import { defineConfig } from '@playwright/test';

const PORT = 4173;

// Server strategy differs by suite:
// - Default (assertion e2e): run the PRODUCTION BUILD via `vite preview`. Routes
//   are pre-compiled, so there is no per-route cold-compilation — the dominant
//   source of first-hit timeout flakiness under CI's constrained CPU.
// - Snapshots (PW_DEV_SERVER=1): run `vite dev`. The capture flow needs the
//   SEED_DEMO endpoint, and `vite preview`'s SSR runtime does not expose the
//   process env that gates it (it is a build-time snapshot); `vite dev` does.
//   Snapshots only capture (no tight redirect assertions), so compile latency is fine.
const useDevServer = process.env.PW_DEV_SERVER === '1';
const command = useDevServer
	? 'pnpm db:migrate && pnpm dev --port 4173'
	: 'pnpm db:migrate && pnpm build && pnpm preview --port 4173';

export default defineConfig({
	webServer: {
		command,
		port: PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 240_000,
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
