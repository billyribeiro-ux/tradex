<script lang="ts">
	import StatCard from '$lib/components/StatCard.svelte';
	import ScoreGauge from '$lib/components/ScoreGauge.svelte';
	import EquityChart from '$lib/components/EquityChart.svelte';
	import CalendarHeatmap from '$lib/components/CalendarHeatmap.svelte';
	import { formatMoney, formatRatio } from '$lib/money';
	import { formatDate, formatPercent } from '$lib/format';
	import { INFINITE_RATIO } from '$lib/domain/metrics';

	let { data } = $props();

	const m = $derived(data.dashboard?.metrics);
	const ratio = (v: number) => (v === INFINITE_RATIO ? '∞' : formatRatio(v));
	const tone = (v: number) => (v > 0 ? 'up' : v < 0 ? 'down' : 'neutral');
	const currency = $derived(data.account?.baseCurrency ?? 'USD');
</script>

<svelte:head><title>Dashboard · TradeX</title></svelte:head>

<header class="mb-6 flex items-center justify-between">
	<div>
		<h1 class="text-2xl font-bold">Dashboard</h1>
		<p class="text-sm" style="color:var(--color-muted)">{data.account?.name ?? 'No account'}</p>
	</div>
	<a href="/trades/new" class="btn btn-primary">Log a trade</a>
</header>

{#if !data.dashboard || !m}
	<div class="card p-8 text-center" style="color:var(--color-muted)">
		Create an account to get started.
	</div>
{:else if m.tradeCount === 0 && data.dashboard.openPositions === 0}
	<div class="card p-10 text-center">
		<h2 class="text-lg font-semibold">No trades yet</h2>
		<p class="mx-auto mt-2 max-w-md text-sm" style="color:var(--color-muted)">
			Log your first trade manually or import a CSV from your broker. TradeX groups your fills into
			round-trip trades and computes your stats automatically.
		</p>
		<div class="mt-5 flex justify-center gap-3">
			<a href="/trades/new" class="btn btn-primary">Log a trade</a>
			<a href="/import" class="btn btn-ghost">Import CSV</a>
		</div>
	</div>
{:else}
	<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
		<StatCard
			label="Net P&L"
			value={formatMoney(m.netPnl, currency, { signed: true })}
			tone={tone(m.netPnl)}
			sub="{m.tradeCount} closed trades"
		/>
		<StatCard
			label="Win Rate"
			value={formatPercent(m.winRate)}
			sub="{m.winCount}W / {m.lossCount}L"
		/>
		<StatCard
			label="Profit Factor"
			value={ratio(m.profitFactor)}
			sub="gross {formatMoney(m.grossProfit, currency)} / {formatMoney(m.grossLoss, currency)}"
		/>
		<StatCard
			label="Expectancy"
			value={formatMoney(m.expectancy, currency, { signed: true })}
			tone={tone(m.expectancy)}
			sub="avg / trade"
		/>
		<StatCard
			label="Max Drawdown"
			value={formatMoney(-m.maxDrawdown, currency)}
			tone="down"
			sub="recovery {ratio(m.recoveryFactor)}"
		/>
		<StatCard
			label="Avg Win / Loss"
			value={formatMoney(m.avgWin, currency)}
			sub="{formatMoney(m.avgLoss, currency)} avg loss"
		/>
		<StatCard
			label="Open Positions"
			value={String(data.dashboard.openPositions)}
			sub="live exposure"
		/>
		<StatCard
			label="Consistency"
			value={formatPercent(m.consistency)}
			sub="streak {m.maxWinStreak}W / {m.maxLossStreak}L"
		/>
	</div>

	<div class="mt-4 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
		<ScoreGauge breakdown={data.dashboard.score} />
		<div class="card p-5">
			<h3 class="mb-3 font-semibold">Equity Curve</h3>
			<EquityChart points={data.dashboard.equity} />
		</div>
	</div>

	<div class="mt-4">
		<CalendarHeatmap days={data.dashboard.calendar} />
	</div>

	<div class="mt-4 card overflow-hidden">
		<div class="flex items-center justify-between border-b p-4">
			<h3 class="font-semibold">Recent trades</h3>
			<a href="/trades" class="text-sm" style="color:var(--color-brand)">View all →</a>
		</div>
		{#if data.recent.length === 0}
			<p class="p-4 text-sm" style="color:var(--color-muted)">No trades yet.</p>
		{:else}
			<table class="w-full text-sm">
				<thead class="text-left" style="color:var(--color-muted)">
					<tr>
						<th class="p-3 font-medium">Symbol</th>
						<th class="p-3 font-medium">Side</th>
						<th class="p-3 font-medium">Opened</th>
						<th class="p-3 text-right font-medium">Net P&L</th>
					</tr>
				</thead>
				<tbody>
					{#each data.recent as t (t.id)}
						<tr class="border-t" style="border-color:var(--color-border)">
							<td class="p-3 font-medium">
								<a href="/trades/{t.id}" class="hover:underline">{t.symbol}</a>
							</td>
							<td class="p-3 capitalize" style="color:var(--color-muted)">{t.direction}</td>
							<td class="p-3" style="color:var(--color-muted)">{formatDate(t.openedAt)}</td>
							<td
								class="p-3 text-right font-semibold tabular-nums"
								style="color:{t.netPnl >= 0 ? 'var(--color-up)' : 'var(--color-down)'}"
							>
								{t.status === 'open' ? '—' : formatMoney(t.netPnl, currency, { signed: true })}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
{/if}
