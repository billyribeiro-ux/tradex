<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatMoney, fromScaled } from '$lib/money';
	import { formatDate, formatDateTime } from '$lib/format';
	import { reveal } from '$lib/motion';
	import { Trash } from 'phosphor-svelte';

	let { data } = $props();
	const d = $derived(data.detail);
	const cur = $derived(data.currency);
	// contract labels are "AAPL 190C 18SEP26" — the underlying is the first token.
	const underlying = $derived(d.legs[0]?.instrument.symbol.split(' ')[0] ?? '');
</script>

<svelte:head><title>{d.classification.label} · TradeX</title></svelte:head>

<div class="panel mb-3">
	<div class="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<a href="/trades" class="mono text-xs" style="color:var(--color-muted)">← Trades</a>
			<h1 class="mt-1 flex flex-wrap items-center gap-3 text-2xl font-bold">
				{underlying}
				<span class="text-base font-medium" style="color:var(--color-brand)"
					>{d.classification.label}</span
				>
				<span class="chip" style={d.realized.status === 'open' ? 'color:var(--color-accent)' : ''}>
					{d.realized.status}
				</span>
				<span class="chip">{d.legs.length} legs</span>
			</h1>
			<p class="mono mt-1 text-xs" style="color:var(--color-muted)">
				Opened {formatDateTime(d.realized.openedAt)}
				{#if d.realized.closedAt}· closed {formatDateTime(d.realized.closedAt)}{/if}
			</p>
		</div>
		<div class="flex flex-col items-start gap-2 sm:items-end">
			<div class="sm:text-right">
				<div class="label">Realized net P&L</div>
				<div
					class="kpi-val tnum"
					style="color:{d.realized.netPnl >= 0 ? 'var(--color-up)' : 'var(--color-down)'}"
				>
					{d.realized.status === 'open'
						? '—'
						: formatMoney(d.realized.netPnl, cur, { signed: true })}
				</div>
			</div>
			<form method="POST" action="?/delete" use:enhance>
				<button
					type="submit"
					class="btn btn-ghost text-xs"
					style="color:var(--color-down)"
					onclick={(e) => {
						if (!confirm('Delete this structure and all its legs? This cannot be undone.'))
							e.preventDefault();
					}}
				>
					<Trash size={14} /> Delete structure
				</button>
			</form>
		</div>
	</div>
</div>

<!-- Entry-time risk profile, derived from the legs -->
<div class="grid grid-cols-2 gap-3 sm:grid-cols-4" use:reveal>
	{#snippet cell(label: string, value: string, color = 'var(--color-text)')}
		<div class="panel p-3">
			<div class="label">{label}</div>
			<div class="mono mt-1 font-semibold" style="color:{color}">{value}</div>
		</div>
	{/snippet}
	{@render cell(
		d.risk.kind === 'credit' ? 'Net credit' : 'Net debit',
		formatMoney(Math.abs(d.risk.net), cur)
	)}
	{@render cell(
		'Max profit',
		d.risk.maxProfit != null ? formatMoney(d.risk.maxProfit, cur) : 'Unlimited',
		'var(--color-up)'
	)}
	{@render cell(
		'Max loss',
		d.risk.maxLoss != null ? formatMoney(d.risk.maxLoss, cur) : 'Undefined',
		'var(--color-down)'
	)}
	{@render cell('Fees', formatMoney(d.realized.fees, cur))}
</div>

<div class="panel mt-3" use:reveal={{ delay: 0.05 }}>
	<div class="panel-h">
		<span class="panel-t">Legs · {d.legs.length}</span>
		<span class="mono text-xs" style="color:var(--color-faint)">×100 contract multiplier</span>
	</div>
	<div class="overflow-x-auto">
		<table class="dtable">
			<thead>
				<tr>
					<th>Side</th>
					<th>Contract</th>
					<th class="hidden sm:table-cell">Strike</th>
					<th class="hidden sm:table-cell">Expiry</th>
					<th>Qty</th>
					<th>Entry</th>
					<th>Exit</th>
					<th>Net P&L</th>
				</tr>
			</thead>
			<tbody>
				{#each d.legs as leg (leg.trade.id)}
					<tr>
						<td
							class="mono font-semibold uppercase"
							style="color:{leg.trade.direction === 'long'
								? 'var(--color-up)'
								: 'var(--color-down)'}"
						>
							{leg.trade.direction === 'long' ? 'Buy' : 'Sell'}
						</td>
						<td class="font-semibold">
							<a
								href="/trades/{leg.trade.id}"
								class="hover:underline"
								style="color:var(--color-text)"
							>
								{leg.contract.type === 'call' ? 'Call' : 'Put'}
							</a>
						</td>
						<td class="mono hidden sm:table-cell">{formatMoney(leg.contract.strike, cur)}</td>
						<td class="mono hidden sm:table-cell" style="color:var(--color-muted)"
							>{formatDate(leg.contract.expiry)}</td
						>
						<td class="mono">{fromScaled(leg.trade.qtyOpened)}</td>
						<td class="mono">{formatMoney(leg.trade.avgEntry, cur)}</td>
						<td class="mono"
							>{leg.trade.avgExit != null ? formatMoney(leg.trade.avgExit, cur) : '—'}</td
						>
						<td
							class="mono font-semibold"
							style="color:{leg.trade.netPnl >= 0 ? 'var(--color-up)' : 'var(--color-down)'}"
						>
							{leg.trade.status === 'open'
								? '—'
								: formatMoney(leg.trade.netPnl, cur, { signed: true })}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
