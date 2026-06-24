import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { seedDemoData } from '$lib/server/services/seed-demo';
import type { RequestHandler } from './$types';

/**
 * Dev/CI-only demo seeding. Off by default and only mounted when SEED_DEMO=1,
 * so it can never run in production. Used by the screenshot capture flow (and
 * handy for local previews): POST while authenticated to fill the signed-in
 * user's account with a realistic dataset.
 */
export const POST: RequestHandler = async ({ locals }) => {
	if (env.SEED_DEMO !== '1') error(404, 'Not found');
	if (!locals.user) error(401, 'Sign in first');

	const result = await seedDemoData(db, locals.user.id);
	return json(result);
};
