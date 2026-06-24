<script lang="ts">
	import { formatMoney } from '$lib/money';
	import type { BreakdownRow } from './+page.server';

	let { data } = $props();

	function maxAbs(rows: BreakdownRow[]) {
		return Math.max(1, ...rows.map((r) => Math.abs(r.netPnl)));
	}
</script>

<svelte:head><title>Analytics · TradeX</title></svelte:head>

<header class="mb-5">
	<h1 class="text-2xl font-bold">Analytics</h1>
	<p class="text-sm" style="color:var(--color-muted)">Drill into where your edge comes from.</p>
</header>

{#snippet breakdown(title: string, rows: BreakdownRow[])}
	<div class="card p-5">
		<h3 class="mb-3 font-semibold">{title}</h3>
		{#if rows.length === 0}
			<p class="text-sm" style="color:var(--color-muted)">No data yet.</p>
		{:else}
			{@const m = maxAbs(rows)}
			<div class="flex flex-col gap-2">
				{#each rows as r (r.key)}
					<div class="flex items-center gap-3 text-sm">
						<span class="w-24 shrink-0 truncate capitalize">{r.key}</span>
						<div class="relative h-5 flex-1 rounded" style="background:var(--color-surface-2)">
							<div
								class="absolute top-0 h-full rounded"
								style="width:{(Math.abs(r.netPnl) / m) * 100}%;background:{r.netPnl >= 0
									? 'var(--color-up)'
									: 'var(--color-down)'}"
							></div>
						</div>
						<span
							class="w-24 shrink-0 text-right tabular-nums"
							style="color:{r.netPnl >= 0 ? 'var(--color-up)' : 'var(--color-down)'}"
						>
							{formatMoney(r.netPnl, data.currency, { signed: true })}
						</span>
						<span class="w-20 shrink-0 text-right text-xs" style="color:var(--color-muted)">
							{r.trades > 0 ? Math.round((r.wins / r.trades) * 100) : 0}% · {r.trades}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

<div class="grid gap-4 lg:grid-cols-2">
	{@render breakdown('P&L by day of week', data.byWeekday)}
	{@render breakdown('P&L by asset class', data.byAsset)}
	<div class="lg:col-span-2">
		{@render breakdown('Top symbols by P&L', data.bySymbol)}
	</div>
</div>
