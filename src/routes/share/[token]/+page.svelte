<script lang="ts">
	import { formatMoney, formatRatio, fromScaled } from '$lib/money';
	import { formatDate, formatDuration } from '$lib/format';
	import { reveal } from '$lib/motion';

	let { data } = $props();
	const s = $derived(data.shared);
	const isUp = $derived((s.netPnl ?? 0) >= 0);
</script>

<svelte:head>
	<title>{s.symbol} {s.direction} · Shared trade · TradeX</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 px-4 py-10">
	<header class="flex items-center justify-between">
		<a href="/" class="flex items-center gap-2 text-lg font-bold">
			<span style="color:var(--color-brand)">▲</span> TradeX
		</a>
		<span class="chip">Shared · read-only</span>
	</header>

	<div class="panel p-6" use:reveal>
		<div class="flex items-start justify-between">
			<div>
				<div class="flex items-center gap-2">
					<h1 class="text-2xl font-bold">{s.symbol}</h1>
					<span class="chip capitalize">{s.direction}</span>
					<span
						class="chip capitalize"
						style={s.status === 'open' ? 'color:var(--color-accent)' : ''}>{s.status}</span
					>
				</div>
				<p class="mono mt-1 text-xs" style="color:var(--color-muted)">
					{s.assetClass} · opened {formatDate(s.openedAt)}
					{#if s.closedAt}· held {formatDuration(s.holdMs)}{/if}
				</p>
			</div>
			{#if s.netPnl != null}
				<div class="text-right">
					<div class="label">Net P&L</div>
					<div
						class="kpi-val text-2xl font-bold"
						style="color:{isUp ? 'var(--color-up)' : 'var(--color-down)'}"
					>
						{formatMoney(s.netPnl, s.currency, { signed: true })}
					</div>
				</div>
			{:else if s.rMultiple != null}
				<div class="text-right">
					<div class="label">Result</div>
					<div
						class="kpi-val text-2xl font-bold"
						style="color:{s.rMultiple >= 0 ? 'var(--color-up)' : 'var(--color-down)'}"
					>
						{formatRatio(s.rMultiple)}R
					</div>
				</div>
			{:else}
				<span class="chip" title="the owner kept the result private">Result hidden</span>
			{/if}
		</div>

		<div class="dtable mt-5 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
			<div>
				<div class="label">Entry</div>
				<div class="mono">{formatMoney(s.avgEntry, s.currency)}</div>
			</div>
			<div>
				<div class="label">Exit</div>
				<div class="mono">{s.avgExit != null ? formatMoney(s.avgExit, s.currency) : '—'}</div>
			</div>
			<div>
				<div class="label">R-multiple</div>
				<div class="mono">{s.rMultiple != null ? `${formatRatio(s.rMultiple)}R` : '—'}</div>
			</div>
			{#if s.qty != null}
				<div>
					<div class="label">Quantity</div>
					<div class="mono">{fromScaled(s.qty)}</div>
				</div>
			{/if}
		</div>

		{#if s.setupName || s.emotionLabel || s.tagNames.length}
			<div class="mt-5 flex flex-wrap items-center gap-2">
				{#if s.setupName}<span class="chip">Setup · {s.setupName}</span>{/if}
				{#if s.emotionLabel}<span class="chip">Felt · {s.emotionLabel}</span>{/if}
				{#each s.tagNames as t (t)}<span class="chip">#{t}</span>{/each}
			</div>
		{/if}

		{#if s.notes}
			<div class="mt-5">
				<div class="label mb-1">Notes</div>
				<p class="text-sm whitespace-pre-wrap" style="color:var(--color-text)">{s.notes}</p>
			</div>
		{/if}
	</div>

	<footer class="mt-auto text-center text-xs" style="color:var(--color-faint)">
		Shared via <a href="/" style="color:var(--color-brand)">TradeX</a> — the transparent trading journal.
		Numbers the owner chose to keep private are hidden.
	</footer>
</main>
