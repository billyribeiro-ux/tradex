import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';

// Only register OAuth providers whose credentials are configured, so local dev
// without secrets doesn't warn. (JWT/JWKS + bearer plugins are intentionally
// deferred to Phase 3 when the Rust/Axum + Tauri surfaces need stateless tokens;
// adding them now would create an unused `jwks` table.)
const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
	socialProviders.github = {
		clientId: env.GITHUB_CLIENT_ID,
		clientSecret: env.GITHUB_CLIENT_SECRET
	};
}
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
	socialProviders.google = {
		clientId: env.GOOGLE_CLIENT_ID,
		clientSecret: env.GOOGLE_CLIENT_SECRET
	};
}

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: { enabled: true },
	socialProviders,
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
