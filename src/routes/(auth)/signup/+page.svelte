<script lang="ts">
	import { signUp } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		loading = true;
		error = '';
		const res = await signUp.email({ name, email, password });
		loading = false;
		if (res.error) error = res.error.message ?? 'Sign up failed';
		else await goto('/dashboard');
	}
</script>

<svelte:head><title>Create account · TradeX</title></svelte:head>

<div class="grid min-h-dvh place-items-center p-4">
	<div class="card w-full max-w-sm p-7">
		<h1 class="mb-1 text-2xl font-bold">
			<span style="color:var(--color-brand)">Trade</span>X
		</h1>
		<p class="mb-6 text-sm" style="color:var(--color-muted)">
			Create your free account — no card required.
		</p>

		<form class="flex flex-col gap-3" onsubmit={submit}>
			<div>
				<label class="label" for="name">Name</label>
				<input id="name" class="input mt-1" type="text" bind:value={name} required />
			</div>
			<div>
				<label class="label" for="email">Email</label>
				<input id="email" class="input mt-1" type="email" bind:value={email} required />
			</div>
			<div>
				<label class="label" for="password">Password</label>
				<input
					id="password"
					class="input mt-1"
					type="password"
					bind:value={password}
					minlength="8"
					required
				/>
			</div>
			{#if error}<p class="text-sm" style="color:var(--color-down)">{error}</p>{/if}
			<button class="btn btn-primary mt-1" type="submit" disabled={loading}>
				{loading ? 'Creating…' : 'Create account'}
			</button>
		</form>

		<p class="mt-5 text-center text-sm" style="color:var(--color-muted)">
			Already have an account? <a href="/login" style="color:var(--color-brand)">Sign in</a>
		</p>
	</div>
</div>
