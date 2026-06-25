<script lang="ts">
	import { enhance } from '$app/forms';
	import { ASSET_CLASSES, ASSET_CLASS_LABELS } from '$lib/domain/enums';
	import { formatMoney } from '$lib/money';
	import { Wallet } from 'phosphor-svelte';
	import { reveal } from '$lib/motion';

	let { data, form } = $props();
</script>

<svelte:head><title>Accounts · TradeX</title></svelte:head>

<header class="mb-5">
	<h1 class="text-2xl font-bold">Accounts</h1>
	<p class="mono mt-0.5 text-xs" style="color:var(--color-muted)">
		Track multiple brokerage or prop-firm accounts — never gated
	</p>
</header>

<div class="grid gap-3 lg:grid-cols-[1fr_22rem]">
	<div class="flex flex-col gap-3">
		{#each data.accounts as a, i (a.id)}
			<div class="panel flex items-center justify-between p-4" use:reveal={{ delay: 0.05 * i }}>
				<div class="flex items-center gap-3">
					<div
						class="grid h-10 w-10 place-items-center rounded-lg"
						style="background:var(--color-surface-2)"
					>
						<Wallet size={20} style="color:var(--color-brand)" />
					</div>
					<div>
						<div class="font-semibold">{a.name}</div>
						<div class="mono text-xs" style="color:var(--color-faint)">
							{a.broker ?? 'No broker'} · {a.baseCurrency}
							{#if a.isPropFirm}· <span style="color:var(--color-accent)">prop firm</span>{/if}
						</div>
						<div class="mt-1 flex flex-wrap gap-1">
							{#each a.assetClasses as ac (ac)}
								<span class="chip">{ASSET_CLASS_LABELS[ac]}</span>
							{/each}
						</div>
					</div>
				</div>
				<div class="text-right">
					<div class="label">Starting</div>
					<div class="mono font-semibold">{formatMoney(a.startingBalance, a.baseCurrency)}</div>
					<a href="/dashboard?account={a.id}" class="mono text-xs" style="color:var(--color-brand)"
						>Open →</a
					>
				</div>
			</div>
		{/each}
	</div>

	<form method="POST" action="?/create" use:enhance class="panel h-fit p-5">
		<h3 class="mb-3 font-semibold">New account</h3>
		<label class="label" for="name">Name</label>
		<input
			id="name"
			name="name"
			class="input mt-1 mb-3"
			placeholder="Main / TopStep 50K"
			required
		/>

		<label class="label" for="broker">Broker</label>
		<input id="broker" name="broker" class="input mt-1 mb-3" placeholder="Interactive Brokers" />

		<div class="mb-3 grid grid-cols-2 gap-3">
			<div>
				<label class="label" for="baseCurrency">Currency</label>
				<input id="baseCurrency" name="baseCurrency" class="input mt-1" value="USD" />
			</div>
			<div>
				<label class="label" for="startingBalance">Starting balance</label>
				<input
					id="startingBalance"
					name="startingBalance"
					class="input mt-1"
					type="text"
					inputmode="decimal"
					value="0"
				/>
			</div>
		</div>

		<div class="label mb-1">Asset classes</div>
		<div class="mb-3 grid grid-cols-2 gap-1">
			{#each ASSET_CLASSES as ac (ac)}
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" name="assetClasses" value={ac} checked={ac === 'stock'} />
					{ASSET_CLASS_LABELS[ac]}
				</label>
			{/each}
		</div>

		<label class="mb-3 flex items-center gap-2 text-sm">
			<input type="checkbox" name="isPropFirm" /> Prop-firm account
		</label>

		{#if form?.message}<p class="mb-2 text-sm" style="color:var(--color-down)">
				{form.message}
			</p>{/if}
		{#if form?.created}<p class="mb-2 text-sm" style="color:var(--color-up)">
				Account created ✓
			</p>{/if}
		<button type="submit" class="btn btn-primary w-full">Create account</button>
	</form>
</div>
