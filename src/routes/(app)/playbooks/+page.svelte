<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatMoney, formatRatio, fromScaled } from '$lib/money';
	import { BookOpen } from 'phosphor-svelte';

	let { data, form } = $props();
	const cur = $derived(data.currency);
</script>

<svelte:head><title>Playbooks · TradeX</title></svelte:head>

<header class="mb-5">
	<h1 class="text-2xl font-bold">Playbooks</h1>
	<p class="text-sm" style="color:var(--color-muted)">
		Define your strategies and rules, tag trades to them, and see which actually make money.
	</p>
</header>

<div class="grid gap-4 lg:grid-cols-[1fr_22rem]">
	<div class="flex flex-col gap-3">
		{#if data.playbooks.length === 0}
			<div class="card p-8 text-center" style="color:var(--color-muted)">
				No playbooks yet. Create your first strategy on the right.
			</div>
		{/if}
		{#each data.playbooks as p (p.id)}
			{@const perf = data.perf[p.id]}
			<div class="card p-4">
				<div class="flex items-start justify-between">
					<div class="flex items-center gap-3">
						<div
							class="grid h-10 w-10 place-items-center rounded-lg"
							style="background:var(--color-surface-2)"
						>
							<BookOpen size={20} style="color:var(--color-brand)" />
						</div>
						<div>
							<div class="font-semibold">{p.name}</div>
							{#if p.description}
								<div class="text-xs" style="color:var(--color-muted)">{p.description}</div>
							{/if}
						</div>
					</div>
					{#if perf}
						<div class="text-right">
							<div
								class="text-lg font-bold tabular-nums"
								style="color:{perf.netPnl >= 0 ? 'var(--color-up)' : 'var(--color-down)'}"
							>
								{formatMoney(perf.netPnl, cur, { signed: true })}
							</div>
							<div class="text-xs" style="color:var(--color-muted)">
								{(fromScaled(perf.winRate) * 100).toFixed(0)}% win · PF {formatRatio(
									perf.profitFactor
								)} ·
								{perf.tradeCount} trades
							</div>
						</div>
					{:else}
						<div class="text-xs" style="color:var(--color-muted)">no trades yet</div>
					{/if}
				</div>
				{#if p.rules?.entryCriteria?.length || p.rules?.maxRiskPct || p.rules?.minRR}
					<div class="mt-3 flex flex-wrap gap-1 text-[11px]">
						{#each p.rules?.entryCriteria ?? [] as c (c)}
							<span
								class="rounded px-1.5 py-0.5"
								style="background:var(--color-surface-2);color:var(--color-muted)">{c}</span
							>
						{/each}
						{#if p.rules?.maxRiskPct}
							<span class="rounded px-1.5 py-0.5" style="background:var(--color-surface-2)"
								>max risk {p.rules.maxRiskPct}%</span
							>
						{/if}
						{#if p.rules?.minRR}
							<span class="rounded px-1.5 py-0.5" style="background:var(--color-surface-2)"
								>min {p.rules.minRR}R</span
							>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<form method="POST" action="?/create" use:enhance class="card h-fit p-5">
		<h3 class="mb-3 font-semibold">New playbook</h3>
		<label class="label" for="name">Name</label>
		<input
			id="name"
			name="name"
			class="input mt-1 mb-3"
			placeholder="Opening range breakout"
			required
		/>

		<label class="label" for="description">Description</label>
		<input id="description" name="description" class="input mt-1 mb-3" placeholder="What & when" />

		<label class="label" for="entryCriteria">Entry criteria (one per line)</label>
		<textarea
			id="entryCriteria"
			name="entryCriteria"
			rows="3"
			class="input mt-1 mb-3"
			placeholder="One rule per line: Gap > 2%, Volume > avg, Above VWAP…"></textarea>

		<div class="mb-3 grid grid-cols-2 gap-3">
			<div>
				<label class="label" for="maxRiskPct">Max risk %</label>
				<input
					id="maxRiskPct"
					name="maxRiskPct"
					class="input mt-1"
					type="text"
					inputmode="decimal"
					placeholder="1"
				/>
			</div>
			<div>
				<label class="label" for="minRR">Min R:R</label>
				<input
					id="minRR"
					name="minRR"
					class="input mt-1"
					type="text"
					inputmode="decimal"
					placeholder="2"
				/>
			</div>
		</div>

		{#if form?.message}<p class="mb-2 text-sm" style="color:var(--color-down)">
				{form.message}
			</p>{/if}
		{#if form?.created}<p class="mb-2 text-sm" style="color:var(--color-up)">
				Playbook created ✓
			</p>{/if}
		<button type="submit" class="btn btn-primary w-full">Create playbook</button>
	</form>
</div>
