<script lang="ts">
	import BarBreakdown from '$lib/components/BarBreakdown.svelte';
	import Histogram from '$lib/components/Histogram.svelte';
	import KpiCard from '$lib/components/KpiCard.svelte';
	import { reveal } from '$lib/motion';
	import { fromScaled, toScaled, formatMoney } from '$lib/money';

	let { data } = $props();

	const total = $derived(data.byAsset.reduce((s, r) => s + r.netPnl, 0));
	const trades = $derived(data.byAsset.reduce((s, r) => s + r.trades, 0));
	const best = $derived(data.bySymbol[0]);
	const worst = $derived(data.bySymbol.at(-1));
	const money = (n: number) => formatMoney(toScaled(n), data.currency, { signed: true });
</script>

<svelte:head><title>Analytics · TradeX</title></svelte:head>

<header class="mb-5">
	<h1 class="text-2xl font-bold">Analytics</h1>
	<p class="mono mt-0.5 text-xs" style="color:var(--color-muted)">
		Drill into where your edge comes from
	</p>
</header>

<div class="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
	<KpiCard
		label="Total P&L"
		value={fromScaled(total)}
		format={money}
		tone={total >= 0 ? 'up' : 'down'}
	/>
	<KpiCard label="Closed Trades" value={trades} format={(n) => n.toFixed(0)} />
	<KpiCard
		label="Best Symbol"
		value={best ? fromScaled(best.netPnl) : 0}
		format={money}
		tone="up"
		sub={best?.key ?? '—'}
	/>
	<KpiCard
		label="Worst Symbol"
		value={worst ? fromScaled(worst.netPnl) : 0}
		format={money}
		tone="down"
		sub={worst?.key ?? '—'}
	/>
</div>

<div class="panel mb-3" use:reveal={{ delay: 0.05 }}>
	<div class="panel-h">
		<span class="panel-t">P&L Distribution</span>
		<span class="mono text-xs" style="color:var(--color-faint)">per closed trade</span>
	</div>
	<div class="p-3"><Histogram values={data.pnls} currency={data.currency} /></div>
</div>

<div class="grid gap-3 lg:grid-cols-2">
	<div use:reveal={{ delay: 0.1 }}>
		<BarBreakdown title="P&L by day of week" rows={data.byWeekday} currency={data.currency} />
	</div>
	<div use:reveal={{ delay: 0.15 }}>
		<BarBreakdown
			title="P&L by asset class"
			rows={data.byAsset}
			currency={data.currency}
			hrefFor={(k) => `/trades?assetClass=${encodeURIComponent(k)}`}
		/>
	</div>
	<div class="lg:col-span-2" use:reveal={{ delay: 0.2 }}>
		<BarBreakdown
			title="Top symbols by P&L"
			rows={data.bySymbol}
			currency={data.currency}
			hrefFor={(k) => `/trades?symbol=${encodeURIComponent(k)}`}
		/>
	</div>
</div>
