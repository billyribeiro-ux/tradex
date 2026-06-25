import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { seedDemoData } from '$lib/server/services/seed-demo';
import type { RequestHandler } from './$types';

/**
 * Dev/CI-only demo seeding. Off by default and only mounted when SEED_DEMO=1,
 * so it can never run in production. Used by the screenshot capture flow (and
 * handy for local previews): POST while authenticated to fill the signed-in
 * user's account with a realistic dataset.
 *
 * Gate on process.env (the Node runtime truth) rather than $env/dynamic/private:
 * under `vite preview` the latter is a build-time snapshot and would miss a
 * SEED_DEMO set at server-launch time. process.env reads correctly in dev,
 * preview, and the adapter-node production server alike.
 */
export const POST: RequestHandler = async ({ locals }) => {
	if (process.env.SEED_DEMO !== '1') error(404, 'Not found');
	if (!locals.user) error(401, 'Sign in first');

	const result = await seedDemoData(db, locals.user.id);
	return json(result);
};
