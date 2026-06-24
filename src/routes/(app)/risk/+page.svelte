<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatMoney } from '$lib/money';
	import { ShieldCheck, Detective } from 'phosphor-svelte';
	import type { RuleStatus } from '$lib/domain/propfirm';

	let { data, form } = $props();
	const cur = $derived(data.account?.baseCurrency ?? 'USD');

	const money = (n: number) =>
		new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: cur,
			maximumFractionDigits: 0
		}).format(n);
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
	<p class="text-sm" style="color:var(--color-muted)">
		Prove your edge with Monte Carlo resampling, and track prop-firm rules in real time.
	</p>
</header>

{#if !data.mc}
	<div class="card p-8 text-center" style="color:var(--color-muted)">
		Create an account to begin.
	</div>
{:else}
	<div class="grid gap-4 lg:grid-cols-2">
		<!-- Monte Carlo -->
		<div class="card p-5">
			<h3 class="mb-1 flex items-center gap-2 font-semibold">
				<Detective size={18} style="color:var(--color-brand)" /> Monte Carlo edge validation
			</h3>
			<p class="mb-4 text-xs" style="color:var(--color-muted)">
				{data.tradeCount} closed trades resampled over {data.mc.runs} simulations of {data.mc
					.horizon} trades.
			</p>
			{#if data.tradeCount < 20}
				<p class="text-sm" style="color:var(--color-muted)">
					Log ~20+ closed trades for a meaningful simulation.
				</p>
			{:else}
				<div class="grid grid-cols-2 gap-3">
					<div class="rounded-lg p-3" style="background:var(--color-surface-2)">
						<div class="label">Prob. profitable</div>
						<div class="mt-1 text-2xl font-bold" style="color:var(--color-up)">
							{(data.mc.probProfit * 100).toFixed(0)}%
						</div>
					</div>
					<div class="rounded-lg p-3" style="background:var(--color-surface-2)">
						<div class="label">Prob. of ruin</div>
						<div
							class="mt-1 text-2xl font-bold"
							style="color:{data.mc.probRuin > 0.05 ? 'var(--color-down)' : 'var(--color-text)'}"
						>
							{(data.mc.probRuin * 100).toFixed(0)}%
						</div>
					</div>
				</div>
				<table class="mt-3 w-full text-sm">
					<tbody>
						<tr
							><td class="py-1" style="color:var(--color-muted)">Median outcome</td><td
								class="py-1 text-right font-semibold tabular-nums">{money(data.mc.median)}</td
							></tr
						>
						<tr
							><td class="py-1" style="color:var(--color-muted)">5th – 95th pct</td><td
								class="py-1 text-right tabular-nums">{money(data.mc.p5)} – {money(data.mc.p95)}</td
							></tr
						>
						<tr
							><td class="py-1" style="color:var(--color-muted)">Median max drawdown</td><td
								class="py-1 text-right tabular-nums"
								style="color:var(--color-down)">{money(-data.mc.medianMaxDrawdown)}</td
							></tr
						>
						<tr
							><td class="py-1" style="color:var(--color-muted)">Worst-case drawdown (p95)</td><td
								class="py-1 text-right tabular-nums"
								style="color:var(--color-down)">{money(-data.mc.worstDrawdown)}</td
							></tr
						>
					</tbody>
				</table>
			{/if}
		</div>

		<!-- Prop firm -->
		<div class="card p-5">
			<h3 class="mb-1 flex items-center gap-2 font-semibold">
				<ShieldCheck size={18} style="color:var(--color-accent)" /> Prop-firm monitor
			</h3>
			{#if data.prop}
				<span
					class="mb-3 inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase"
					style="color:{statusColor(data.prop.overall)};background:var(--color-surface-2)"
				>
					{data.prop.overall}
				</span>
				<div class="flex flex-col gap-2">
					{#each data.prop.rules as r (r.label)}
						<div
							class="flex items-center justify-between rounded-lg p-2 text-sm"
							style="background:var(--color-surface-2)"
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
							<span class="tabular-nums" style="color:var(--color-muted)">
								{ruleVal(r)}{r.limit != null ? ` / ${ruleLimit(r)}` : ''}
							</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="mb-3 text-sm" style="color:var(--color-muted)">
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
								value={data.config?.dailyLossLimit != null ? data.config.dailyLossLimit / 1e8 : ''}
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
{/if}
