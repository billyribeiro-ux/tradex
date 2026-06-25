<script lang="ts">
	import { formatMoney, formatRatio, fromScaled } from '$lib/money';
	import { formatDate, formatDuration } from '$lib/format';
	import { reveal } from '$lib/motion';

	let { data } = $props();

	const filters = [
		{ key: '', label: 'All' },
		{ key: 'closed', label: 'Closed' },
		{ key: 'open', label: 'Open' }
	];

	// Build a page link that preserves the active status filter.
	const pageHref = (p: number) => {
		const u = new URLSearchParams();
		if (data.status) u.set('status', data.status);
		if (p > 1) u.set('page', String(p));
		const s = u.toString();
		return s ? `?${s}` : '?';
	};
	const from = $derived((data.page - 1) * data.pageSize + 1);
	const to = $derived(Math.min(data.page * data.pageSize, data.total));
</script>

<svelte:head><title>Trades · TradeX</title></svelte:head>

<header class="mb-5 flex items-center justify-between">
	<div>
		<h1 class="text-2xl font-bold">Trades</h1>
		<p class="mono mt-0.5 text-xs" style="color:var(--color-muted)">{data.total} trades</p>
	</div>
	<a href="/trades/new" class="btn btn-primary">New trade</a>
</header>

<div class="mb-3 flex gap-2">
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
	<div class="panel p-10 text-center" style="color:var(--color-muted)">
		No trades match this filter. <a href="/trades/new" style="color:var(--color-brand)">Log one</a>
		or <a href="/import" style="color:var(--color-brand)">import a CSV</a>.
	</div>
{:else}
	<div class="panel overflow-x-auto" use:reveal={{ delay: 0.05 }}>
		<table class="dtable">
			<thead>
				<tr>
					<th>Symbol</th>
					<th>Side</th>
					<th>Status</th>
					<th>Opened</th>
					<th>Qty</th>
					<th>Entry</th>
					<th>Exit</th>
					<th>Hold</th>
					<th>R</th>
					<th>Net P&L</th>
				</tr>
			</thead>
			<tbody>
				{#each data.trades as t (t.id)}
					<tr>
						<td class="font-semibold">
							<a href="/trades/{t.id}" class="hover:underline" style="color:var(--color-text)"
								>{t.symbol}</a
							>
						</td>
						<td class="capitalize" style="color:var(--color-muted)">{t.direction}</td>
						<td>
							<span class="chip" style={t.status === 'open' ? 'color:var(--color-accent)' : ''}>
								{t.status}
							</span>
						</td>
						<td class="mono" style="color:var(--color-muted)">{formatDate(t.openedAt)}</td>
						<td class="mono">{fromScaled(t.qtyOpened)}</td>
						<td class="mono">{formatMoney(t.avgEntry, 'USD')}</td>
						<td class="mono">{t.avgExit != null ? formatMoney(t.avgExit, 'USD') : '—'}</td>
						<td class="mono" style="color:var(--color-muted)">{formatDuration(t.holdMs)}</td>
						<td class="mono" style="color:var(--color-muted)">
							{t.rMultiple != null ? `${formatRatio(t.rMultiple)}R` : '—'}
						</td>
						<td
							class="mono font-semibold"
							style="color:{t.netPnl >= 0 ? 'var(--color-up)' : 'var(--color-down)'}"
						>
							{t.status === 'open' ? '—' : formatMoney(t.netPnl, 'USD', { signed: true })}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="mt-3 flex items-center justify-between text-xs" style="color:var(--color-muted)">
		<span class="mono">Showing {from}–{to} of {data.total}</span>
		{#if data.pageCount > 1}
			<div class="flex items-center gap-2">
				{#if data.page > 1}
					<a href={pageHref(data.page - 1)} class="btn btn-ghost text-xs">← Prev</a>
				{:else}
					<span class="btn btn-ghost text-xs opacity-40">← Prev</span>
				{/if}
				<span class="mono">Page {data.page} / {data.pageCount}</span>
				{#if data.page < data.pageCount}
					<a href={pageHref(data.page + 1)} class="btn btn-ghost text-xs">Next →</a>
				{:else}
					<span class="btn btn-ghost text-xs opacity-40">Next →</span>
				{/if}
			</div>
		{/if}
	</div>
{/if}
