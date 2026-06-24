<script lang="ts">
	import { formatMoney, formatRatio, fromScaled } from '$lib/money';
	import { formatDate, formatDuration } from '$lib/format';

	let { data } = $props();

	const filters = [
		{ key: '', label: 'All' },
		{ key: 'closed', label: 'Closed' },
		{ key: 'open', label: 'Open' }
	];
</script>

<svelte:head><title>Trades · TradeX</title></svelte:head>

<header class="mb-5 flex items-center justify-between">
	<div>
		<h1 class="text-2xl font-bold">Trades</h1>
		<p class="text-sm" style="color:var(--color-muted)">{data.total} trades</p>
	</div>
	<a href="/trades/new" class="btn btn-primary">New trade</a>
</header>

<div class="mb-4 flex gap-2">
	{#each filters as f (f.key)}
		<a
			href={f.key ? `?status=${f.key}` : '?'}
			class="btn btn-ghost"
			style={(data.status ?? '') === f.key
				? 'border-color:var(--color-brand);color:var(--color-brand)'
				: ''}
		>
			{f.label}
		</a>
	{/each}
</div>

{#if data.trades.length === 0}
	<div class="card p-10 text-center" style="color:var(--color-muted)">
		No trades match this filter. <a href="/trades/new" style="color:var(--color-brand)">Log one</a>
		or <a href="/import" style="color:var(--color-brand)">import a CSV</a>.
	</div>
{:else}
	<div class="card overflow-x-auto">
		<table class="w-full text-sm">
			<thead class="text-left" style="color:var(--color-muted)">
				<tr class="border-b" style="border-color:var(--color-border)">
					<th class="p-3 font-medium">Symbol</th>
					<th class="p-3 font-medium">Side</th>
					<th class="p-3 font-medium">Status</th>
					<th class="p-3 font-medium">Opened</th>
					<th class="p-3 text-right font-medium">Qty</th>
					<th class="p-3 text-right font-medium">Entry</th>
					<th class="p-3 text-right font-medium">Exit</th>
					<th class="p-3 text-right font-medium">Hold</th>
					<th class="p-3 text-right font-medium">R</th>
					<th class="p-3 text-right font-medium">Net P&L</th>
				</tr>
			</thead>
			<tbody>
				{#each data.trades as t (t.id)}
					<tr
						class="cursor-pointer border-b transition-colors hover:bg-[var(--color-surface-2)]"
						style="border-color:var(--color-border)"
						onclick={() => (window.location.href = `/trades/${t.id}`)}
					>
						<td class="p-3 font-semibold">{t.symbol}</td>
						<td class="p-3 capitalize" style="color:var(--color-muted)">{t.direction}</td>
						<td class="p-3">
							<span
								class="rounded-full px-2 py-0.5 text-xs"
								style={t.status === 'open'
									? 'background:rgba(108,140,255,0.15);color:var(--color-accent)'
									: 'background:var(--color-surface-2);color:var(--color-muted)'}
							>
								{t.status}
							</span>
						</td>
						<td class="p-3" style="color:var(--color-muted)">{formatDate(t.openedAt)}</td>
						<td class="p-3 text-right tabular-nums">{fromScaled(t.qtyOpened)}</td>
						<td class="p-3 text-right tabular-nums">{formatMoney(t.avgEntry, 'USD')}</td>
						<td class="p-3 text-right tabular-nums">
							{t.avgExit != null ? formatMoney(t.avgExit, 'USD') : '—'}
						</td>
						<td class="p-3 text-right tabular-nums" style="color:var(--color-muted)">
							{formatDuration(t.holdMs)}
						</td>
						<td class="p-3 text-right tabular-nums" style="color:var(--color-muted)">
							{t.rMultiple != null ? `${formatRatio(t.rMultiple)}R` : '—'}
						</td>
						<td
							class="p-3 text-right font-semibold tabular-nums"
							style="color:{t.netPnl >= 0 ? 'var(--color-up)' : 'var(--color-down)'}"
						>
							{t.status === 'open' ? '—' : formatMoney(t.netPnl, 'USD', { signed: true })}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
