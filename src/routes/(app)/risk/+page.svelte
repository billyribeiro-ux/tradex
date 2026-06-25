<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatMoney } from '$lib/money';
	import { ShieldCheck, Detective } from 'phosphor-svelte';
	import KpiCard from '$lib/components/KpiCard.svelte';
	import FanChart from '$lib/components/FanChart.svelte';
	import { reveal } from '$lib/motion';
	import type { RuleStatus } from '$lib/domain/propfirm';

	let { data, form } = $props();
	const cur = $derived(data.account?.baseCurrency ?? 'USD');

	const money = (n: number) =>
		new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: cur,
			maximumFractionDigits: 0
		}).format(n);
	const pct = (n: number) => `${n.toFixed(0)}%`;
	const ruleVal = (r: RuleStatus) =>
		r.unit === 'money'
			? formatMoney(r.value, cur)
			: r.unit === 'percent'
				? `${r.value}%`
				: String(r.value);
	const ruleLimit = (r: RuleStatus) =>
		r.limit == null
			? ''
			: r.unit === 'money'
				? formatMoney(r.limit, cur)
				: r.unit === 'percent'
					? `${r.limit}%`
					: String(r.limit);

	const statusColor = (s: string) =>
		s === 'passed'
			? 'var(--color-up)'
			: s === 'breached'
				? 'var(--color-down)'
				: 'var(--color-accent)';
</script>

<svelte:head><title>Risk · TradeX</title></svelte:head>

<header class="mb-5">
	<h1 class="text-2xl font-bold">Risk & Validation</h1>
	<p class="mono mt-0.5 text-xs" style="color:var(--color-muted)">
		Monte Carlo edge validation · prop-firm rule monitoring
	</p>
</header>

{#if !data.mc}
	<div class="panel p-8 text-center" style="color:var(--color-muted)">
		Create an account to begin.
	</div>
{:else}
	{#if data.tradeCount >= 2}
		<div class="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
			<KpiCard label="Prob. Profitable" value={data.mc.probProfit * 100} format={pct} tone="up" />
			<KpiCard
				label="Prob. of Ruin"
				value={data.mc.probRuin * 100}
				format={pct}
				tone={data.mc.probRuin > 0.05 ? 'down' : 'neutral'}
			/>
			<KpiCard
				label="Median Outcome"
				value={data.mc.median}
				format={money}
				tone={data.mc.median >= 0 ? 'up' : 'down'}
			/>
			<KpiCard label="Worst Drawdown" value={-data.mc.worstDrawdown} format={money} tone="down" />
		</div>
	{/if}

	<div class="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
		<!-- Monte Carlo fan -->
		<div class="panel" use:reveal={{ delay: 0.05 }}>
			<div class="panel-h">
				<span class="panel-t">
					<Detective size={13} class="mr-1 inline" /> Monte Carlo Projection
				</span>
				<span class="mono text-xs" style="color:var(--color-faint)">
					{data.tradeCount} trades · {data.mc.runs} sims
				</span>
			</div>
			<div class="p-3">
				{#if data.tradeCount < 2}
					<p class="p-6 text-center text-sm" style="color:var(--color-muted)">
						Log ~20+ closed trades for a meaningful simulation.
					</p>
				{:else}
					<FanChart bands={data.fan} />
					<div class="mt-2 grid grid-cols-3 gap-2 text-center">
						<div class="rounded-lg p-2" style="background:var(--color-bg-2)">
							<div class="label">5th pct</div>
							<div class="mono mt-0.5 font-semibold" style="color:var(--color-down)">
								{money(data.mc.p5)}
							</div>
						</div>
						<div class="rounded-lg p-2" style="background:var(--color-bg-2)">
							<div class="label">Median</div>
							<div class="mono mt-0.5 font-semibold" style="color:var(--color-text)">
								{money(data.mc.median)}
							</div>
						</div>
						<div class="rounded-lg p-2" style="background:var(--color-bg-2)">
							<div class="label">95th pct</div>
							<div class="mono mt-0.5 font-semibold" style="color:var(--color-up)">
								{money(data.mc.p95)}
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Prop firm -->
		<div class="panel" use:reveal={{ delay: 0.1 }}>
			<div class="panel-h">
				<span class="panel-t">
					<ShieldCheck size={13} class="mr-1 inline" /> Prop-Firm Monitor
				</span>
				{#if data.prop}
					<span class="chip" style="color:{statusColor(data.prop.overall)}"
						>{data.prop.overall}</span
					>
				{/if}
			</div>
			<div class="p-4">
				{#if data.prop}
					<div class="flex flex-col gap-2">
						{#each data.prop.rules as r (r.label)}
							<div
								class="flex items-center justify-between rounded-lg p-2 text-sm"
								style="background:var(--color-bg-2)"
							>
								<span class="flex items-center gap-2">
									<span
										class="h-2 w-2 rounded-full"
										style="background:{r.breached
											? 'var(--color-down)'
											: r.met
												? 'var(--color-up)'
												: 'var(--color-muted)'}"
									></span>
									{r.label}
								</span>
								<span class="mono" style="color:var(--color-muted)">
									{ruleVal(r)}{r.limit != null ? ` / ${ruleLimit(r)}` : ''}
								</span>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm" style="color:var(--color-muted)">
						Configure your firm's rules to track them live against this account.
					</p>
				{/if}

				<details class="mt-4">
					<summary class="cursor-pointer text-sm" style="color:var(--color-brand)">
						{data.config ? 'Edit rules' : 'Set up rules'}
					</summary>
					<form
						method="POST"
						action="?/saveConfig"
						use:enhance
						class="mt-3 flex flex-col gap-2 text-sm"
					>
						<div class="grid grid-cols-2 gap-2">
							<label class="flex flex-col gap-1"
								><span class="label">Firm</span>
								<select name="firm" class="input" value={data.config?.firm ?? 'other'}>
									{#each data.firms as f (f)}<option value={f}>{f}</option>{/each}
								</select>
							</label>
							<label class="flex flex-col gap-1"
								><span class="label">Drawdown type</span>
								<select
									name="drawdownType"
									class="input"
									value={data.config?.drawdownType ?? 'static'}
								>
									{#each data.drawdownTypes as d (d)}<option value={d}>{d}</option>{/each}
								</select>
							</label>
							<label class="flex flex-col gap-1"
								><span class="label">Profit target</span>
								<input
									name="profitTarget"
									class="input"
									inputmode="decimal"
									value={data.config?.profitTarget != null ? data.config.profitTarget / 1e8 : ''}
								/></label
							>
							<label class="flex flex-col gap-1"
								><span class="label">Daily loss limit</span>
								<input
									name="dailyLossLimit"
									class="input"
									inputmode="decimal"
									value={data.config?.dailyLossLimit != null
										? data.config.dailyLossLimit / 1e8
										: ''}
								/></label
							>
							<label class="flex flex-col gap-1"
								><span class="label">Max drawdown</span>
								<input
									name="maxDrawdown"
									class="input"
									inputmode="decimal"
									value={data.config?.maxDrawdown != null ? data.config.maxDrawdown / 1e8 : ''}
								/></label
							>
							<label class="flex flex-col gap-1"
								><span class="label">Min trading days</span>
								<input
									name="minTradingDays"
									class="input"
									inputmode="numeric"
									value={data.config?.minTradingDays ?? ''}
								/></label
							>
							<label class="flex flex-col gap-1"
								><span class="label">Consistency %</span>
								<input
									name="consistencyPct"
									class="input"
									inputmode="numeric"
									value={data.config?.consistencyPct ?? ''}
								/></label
							>
						</div>
						{#if form?.saved}<span style="color:var(--color-up)">Saved ✓</span>{/if}
						<button type="submit" class="btn btn-primary mt-1 w-fit">Save rules</button>
					</form>
				</details>
			</div>
		</div>
	</div>
{/if}
