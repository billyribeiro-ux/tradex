import { createAuthClient } from 'better-auth/svelte';

/** Browser-side Better Auth client (session store + sign in/up/out helpers). */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
