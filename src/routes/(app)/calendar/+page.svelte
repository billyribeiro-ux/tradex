<script lang="ts">
	import CalendarHeatmap from '$lib/components/CalendarHeatmap.svelte';
	import { formatMoney } from '$lib/money';

	let { data } = $props();

	// month rollups (newest first)
	const months = $derived.by(() => {
		const m = new Map<string, { netPnl: number; trades: number }>();
		for (const d of data.calendar) {
			const key = d.date.slice(0, 7);
			const cur = m.get(key) ?? { netPnl: 0, trades: 0 };
			cur.netPnl += d.netPnl;
			cur.trades += d.trades;
			m.set(key, cur);
		}
		return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
	});
</script>

<svelte:head><title>Calendar · TradeX</title></svelte:head>

<header class="mb-5">
	<h1 class="text-2xl font-bold">Calendar</h1>
	<p class="text-sm" style="color:var(--color-muted)">Daily realized P&L.</p>
</header>

<CalendarHeatmap days={data.calendar} weeks={26} />

<div class="mt-4 card overflow-hidden">
	<h3 class="border-b p-4 font-semibold" style="border-color:var(--color-border)">Monthly P&L</h3>
	{#if months.length === 0}
		<p class="p-4 text-sm" style="color:var(--color-muted)">No closed trades yet.</p>
	{:else}
		<table class="w-full text-sm">
			<tbody>
				{#each months as [month, v] (month)}
					<tr class="border-t" style="border-color:var(--color-border)">
						<td class="p-3 font-medium">{month}</td>
						<td class="p-3 text-right" style="color:var(--color-muted)">{v.trades} trades</td>
						<td
							class="p-3 text-right font-semibold tabular-nums"
							style="color:{v.netPnl >= 0 ? 'var(--color-up)' : 'var(--color-down)'}"
						>
							{formatMoney(v.netPnl, data.currency, { signed: true })}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
