<script lang="ts">
	import { enhance } from '$app/forms';
	import { DownloadSimple, Sparkle, ShieldCheck, CheckCircle } from 'phosphor-svelte';
	let { data, form } = $props();
</script>

<svelte:head><title>Settings · TradeX</title></svelte:head>

<header class="mb-5">
	<h1 class="text-2xl font-bold">Settings</h1>
</header>

<div class="grid max-w-3xl gap-4">
	<div class="card p-5">
		<h3 class="mb-3 font-semibold">Profile</h3>
		<div class="grid grid-cols-2 gap-3 text-sm">
			<div>
				<span class="label">Name</span>
				<div class="mt-1">{data.user.name}</div>
			</div>
			<div>
				<span class="label">Email</span>
				<div class="mt-1">{data.user.email}</div>
			</div>
		</div>
	</div>

	<div class="card p-5">
		<h3 class="mb-1 font-semibold">Your data, exportable</h3>
		<p class="mb-3 text-sm" style="color:var(--color-muted)">
			No lock-in — export every trade as CSV or JSON anytime.
		</p>
		<div class="flex gap-3">
			<a href="/export/trades.csv" class="btn btn-ghost"><DownloadSimple size={16} /> Export CSV</a>
			<a href="/export/trades.json" class="btn btn-ghost"
				><DownloadSimple size={16} /> Export JSON</a
			>
		</div>
	</div>

	<div class="card p-5">
		<h3 class="mb-1 flex items-center gap-2 font-semibold">
			<Sparkle size={18} style="color:var(--color-brand)" /> AI Coach
		</h3>
		<p class="mb-3 text-sm" style="color:var(--color-muted)">
			Bring your own Claude API key. It's stored <strong>encrypted at rest</strong> and only used to analyze
			your own stats. Get a key at console.anthropic.com.
		</p>

		{#if data.ai.hasKey}
			<p class="mb-3 flex items-center gap-2 text-sm" style="color:var(--color-up)">
				<CheckCircle size={16} weight="fill" /> A key is configured. The
				<a href="/coach" style="color:var(--color-brand)">Coach</a> is ready.
			</p>
		{/if}

		<form method="POST" action="?/saveAi" use:enhance class="flex flex-col gap-3">
			<div class="grid grid-cols-[1fr_14rem] gap-3">
				<div>
					<label class="label" for="apiKey">Anthropic API key</label>
					<input
						id="apiKey"
						name="apiKey"
						type="password"
						class="input mt-1"
						placeholder={data.ai.hasKey ? '•••••••• (leave blank to keep)' : 'sk-ant-...'}
					/>
				</div>
				<div>
					<label class="label" for="model">Model</label>
					<select id="model" name="model" class="input mt-1" value={data.ai.model}>
						{#each data.models as m (m)}
							<option value={m}>{m}</option>
						{/each}
					</select>
				</div>
			</div>
			<div class="flex items-center gap-3">
				<button type="submit" class="btn btn-primary">Save</button>
				{#if data.ai.hasKey}
					<button type="submit" formaction="?/clearKey" class="btn btn-ghost">Remove key</button>
				{/if}
				{#if form?.saved}<span class="text-sm" style="color:var(--color-up)">Saved ✓</span>{/if}
				{#if form?.cleared}<span class="text-sm" style="color:var(--color-muted)">Key removed</span
					>{/if}
			</div>
		</form>
	</div>

	<div class="card p-5">
		<h3 class="mb-2 flex items-center gap-2 font-semibold">
			<ShieldCheck size={18} style="color:var(--color-accent)" /> Security
		</h3>
		<p class="text-sm" style="color:var(--color-muted)">
			Sessions are database-backed and can be revoked. Stateless JWT/JWKS + bearer tokens for the
			desktop app and Rust API arrive in Phase 3.
		</p>
	</div>
</div>
