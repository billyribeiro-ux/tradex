<script lang="ts">
	import { signIn } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { GithubLogo } from 'phosphor-svelte';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	const redirectTo = () => page.url.searchParams.get('redirectTo') ?? '/dashboard';

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		loading = true;
		error = '';
		const res = await signIn.email({ email, password });
		loading = false;
		if (res.error) error = res.error.message ?? 'Sign in failed';
		else await goto(redirectTo());
	}

	async function github() {
		await signIn.social({ provider: 'github', callbackURL: redirectTo() });
	}
</script>

<svelte:head><title>Sign in · TradeX</title></svelte:head>

<div class="grid min-h-dvh place-items-center p-4">
	<div class="card w-full max-w-sm p-7">
		<h1 class="mb-1 text-2xl font-bold">
			<span style="color:var(--color-brand)">Trade</span>X
		</h1>
		<p class="mb-6 text-sm" style="color:var(--color-muted)">Sign in to your trading journal.</p>

		<form class="flex flex-col gap-3" onsubmit={submit}>
			<div>
				<label class="label" for="email">Email</label>
				<input id="email" class="input mt-1" type="email" bind:value={email} required />
			</div>
			<div>
				<label class="label" for="password">Password</label>
				<input id="password" class="input mt-1" type="password" bind:value={password} required />
			</div>
			{#if error}<p class="text-sm" style="color:var(--color-down)">{error}</p>{/if}
			<button class="btn btn-primary mt-1" type="submit" disabled={loading}>
				{loading ? 'Signing in…' : 'Sign in'}
			</button>
		</form>

		<button class="btn btn-ghost mt-3 w-full" onclick={github}>
			<GithubLogo size={18} /> Continue with GitHub
		</button>

		<p class="mt-5 text-center text-sm" style="color:var(--color-muted)">
			No account? <a href="/signup" style="color:var(--color-brand)">Create one</a>
		</p>
	</div>
</div>
