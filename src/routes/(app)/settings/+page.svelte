<script lang="ts">
	import { DownloadSimple, Sparkle, ShieldCheck } from 'phosphor-svelte';
	let { data } = $props();
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
		<h3 class="mb-2 flex items-center gap-2 font-semibold">
			<Sparkle size={18} style="color:var(--color-brand)" /> AI Coach
		</h3>
		<p class="text-sm" style="color:var(--color-muted)">
			Bring-your-own Claude API key for statistically-grounded behavioral insights and
			natural-language Q&A over your own trades. Lands in the next phase — your key will be stored
			encrypted and never leave your account.
		</p>
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
