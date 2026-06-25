<script lang="ts">
	import KpiCard from '$lib/components/KpiCard.svelte';
	import ScoreGauge from '$lib/components/ScoreGauge.svelte';
	import EquityChart from '$lib/components/EquityChart.svelte';
	import CalendarHeatmap from '$lib/components/CalendarHeatmap.svelte';
	import { reveal, revealChildren } from '$lib/motion';
	import { fromScaled, toScaled, formatMoney } from '$lib/money';
	import { formatDate } from '$lib/format';

	let { data } = $props();

	const m = $derived(data.dashboard?.metrics);
	const currency = $derived(data.account?.baseCurrency ?? 'USD');
	const equity = $derived(data.dashboard?.equity ?? []);

	// Real-unit sparkline series derived from the equity curve.
	const pnlSpark = $derived(equity.map((p) => fromScaled(p.equity)));
	const ddSpark = $derived.by(() => {
		let pk = -Infinity;
		return equity.map((p) => {
			pk = Math.max(pk, p.equity);
			return fromScaled(p.equity - pk);
		});
	});

	const money = (n: number) => formatMoney(toScaled(n), currency, { signed: true });
	const moneyPlain = (n: number) => formatMoney(toScaled(n), currency);
	const pct = (n: number) => `${n.toFixed(0)}%`;
	const rat = (n: number) => (n >= 9999 ? '∞' : n.toFixed(2));
	const tone = (v: number): 'up' | 'down' | 'neutral' =>
		v > 0 ? 'up' : v < 0 ? 'down' : 'neutral';
</script>

<svelte:head><title>Dashboard · TradeX</title></svelte:head>

<header class="mb-6 flex items-center justify-between">
	<div>
		<div class="flex items-center gap-3">
			<h1 class="text-2xl font-bold">Dashboard</h1>
			<span class="chip" style="color:var(--color-brand)">
				<span style="font-size:8px">●</span> LIVE
			</span>
		</div>
		<p class="mono mt-0.5 text-xs" style="color:var(--color-muted)">
			{data.account?.name ?? 'No account'}
		</p>
	</div>
	<a href="/trades/new" class="btn btn-primary">Log a trade</a>
</header>

{#if !data.dashboard || !m}
	<div class="panel p-8 text-center" style="color:var(--color-muted)">
		Create an account to get started.
	</div>
{:else if m.tradeCount === 0 && data.dashboard.openPositions === 0}
	<div class="panel p-10 text-center">
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
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4" use:revealChildren>
		<KpiCard
			label="Net P&L"
			value={fromScaled(m.netPnl)}
			format={money}
			tone={tone(m.netPnl)}
			sub="{m.tradeCount} closed trades"
			spark={pnlSpark}
		/>
		<KpiCard
			label="Win Rate"
			value={fromScaled(m.winRate) * 100}
			format={pct}
			sub="{m.winCount}W / {m.lossCount}L"
		/>
		<KpiCard
			label="Profit Factor"
			value={fromScaled(m.profitFactor)}
			format={rat}
			sub="gross {moneyPlain(fromScaled(m.grossProfit))}"
		/>
		<KpiCard
			label="Expectancy"
			value={fromScaled(m.expectancy)}
			format={money}
			tone={tone(m.expectancy)}
			sub="avg / trade"
		/>
		<KpiCard
			label="Max Drawdown"
			value={-fromScaled(m.maxDrawdown)}
			format={money}
			tone="down"
			sub="recovery {rat(fromScaled(m.recoveryFactor))}"
			spark={ddSpark}
			sparkColor="var(--color-down)"
		/>
		<KpiCard
			label="Avg Win / Loss"
			value={fromScaled(m.avgWinLossRatio)}
			format={rat}
			sub="{moneyPlain(fromScaled(m.avgWin))} / {moneyPlain(fromScaled(m.avgLoss))}"
		/>
		<KpiCard
			label="Open Positions"
			value={data.dashboard.openPositions}
			format={(n) => n.toFixed(0)}
			sub="live exposure"
		/>
		<KpiCard
			label="Consistency"
			value={fromScaled(m.consistency) * 100}
			format={pct}
			sub="streak {m.maxWinStreak}W / {m.maxLossStreak}L"
		/>
	</div>

	<div class="mt-3 grid gap-3 lg:grid-cols-[1fr_1.15fr]">
		<div use:reveal={{ delay: 0.15 }}>
			<ScoreGauge breakdown={data.dashboard.score} />
		</div>
		<div class="panel" use:reveal={{ delay: 0.2 }}>
			<div class="panel-h">
				<span class="panel-t">Equity Curve</span>
				<span class="mono text-xs" style="color:var(--color-faint)">cumulative · {currency}</span>
			</div>
			<div class="p-3">
				<EquityChart points={data.dashboard.equity} {currency} />
			</div>
		</div>
	</div>

	<div class="mt-3" use:reveal={{ delay: 0.25 }}>
		<CalendarHeatmap days={data.dashboard.calendar} {currency} />
	</div>

	<div class="panel mt-3" use:reveal={{ delay: 0.3 }}>
		<div class="panel-h">
			<span class="panel-t">Recent Trades</span>
			<a href="/trades" class="mono text-xs" style="color:var(--color-brand)">View all →</a>
		</div>
		{#if data.recent.length === 0}
			<p class="p-4 text-sm" style="color:var(--color-muted)">No trades yet.</p>
		{:else}
			<table class="dtable">
				<thead>
					<tr>
						<th>Symbol</th>
						<th>Side</th>
						<th>Status</th>
						<th>Opened</th>
						<th>Net P&L</th>
					</tr>
				</thead>
				<tbody>
					{#each data.recent as t (t.id)}
						<tr>
							<td>
								<a href="/trades/{t.id}" class="font-semibold hover:underline">{t.symbol}</a>
							</td>
							<td class="capitalize" style="color:var(--color-muted)">{t.direction}</td>
							<td>
								<span class="chip" style={t.status === 'open' ? 'color:var(--color-accent)' : ''}>
									{t.status}
								</span>
							</td>
							<td class="mono" style="color:var(--color-muted)">{formatDate(t.openedAt)}</td>
							<td
								class="mono font-semibold"
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
