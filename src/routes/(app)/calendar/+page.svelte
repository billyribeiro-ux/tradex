<script lang="ts">
	import CalendarHeatmap from '$lib/components/CalendarHeatmap.svelte';
	import KpiCard from '$lib/components/KpiCard.svelte';
	import { reveal } from '$lib/motion';
	import { fromScaled, toScaled, formatMoney } from '$lib/money';

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

	const total = $derived(data.calendar.reduce((s, d) => s + d.netPnl, 0));
	const trades = $derived(data.calendar.reduce((s, d) => s + d.trades, 0));
	const greenDays = $derived(data.calendar.filter((d) => d.netPnl > 0).length);
	const activeDays = $derived(data.calendar.filter((d) => d.trades > 0).length);
	const money = (n: number) => formatMoney(toScaled(n), data.currency, { signed: true });
</script>

<svelte:head><title>Calendar · TradeX</title></svelte:head>

<header class="mb-5">
	<h1 class="text-2xl font-bold">Calendar</h1>
	<p class="mono mt-0.5 text-xs" style="color:var(--color-muted)">Daily realized P&L</p>
</header>

<div class="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
	<KpiCard
		label="Total P&L"
		value={fromScaled(total)}
		format={money}
		tone={total >= 0 ? 'up' : 'down'}
	/>
	<KpiCard label="Trades" value={trades} format={(n) => n.toFixed(0)} />
	<KpiCard label="Active Days" value={activeDays} format={(n) => n.toFixed(0)} />
	<KpiCard
		label="Green Days"
		value={activeDays ? (greenDays / activeDays) * 100 : 0}
		format={(n) => `${n.toFixed(0)}%`}
		tone="up"
		sub="{greenDays}/{activeDays} profitable"
	/>
</div>

<div use:reveal={{ delay: 0.05 }}>
	<CalendarHeatmap days={data.calendar} weeks={26} currency={data.currency} />
</div>

<div class="panel mt-3" use:reveal={{ delay: 0.1 }}>
	<div class="panel-h"><span class="panel-t">Monthly P&L</span></div>
	{#if months.length === 0}
		<p class="p-4 text-sm" style="color:var(--color-muted)">No closed trades yet.</p>
	{:else}
		<table class="dtable">
			<thead>
				<tr>
					<th>Month</th>
					<th>Trades</th>
					<th>Net P&L</th>
				</tr>
			</thead>
			<tbody>
				{#each months as [month, v] (month)}
					<tr>
						<td class="mono font-semibold">{month}</td>
						<td class="mono" style="color:var(--color-muted)">{v.trades}</td>
						<td
							class="mono font-semibold"
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
