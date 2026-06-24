import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	// Signed-in users go straight to the app; everyone else sees the landing page.
	if (locals.user) redirect(307, '/dashboard');
	return {};
};
