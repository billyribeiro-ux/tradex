<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatMoney, formatRatio, fromScaled } from '$lib/money';
	import { formatDateTime, formatDuration } from '$lib/format';

	let { data, form } = $props();
	const t = $derived(data.detail.trade);
	const inst = $derived(data.detail.instrument);
	const cur = $derived(data.currency);
	const stat = (n: number | null, fmt: (v: number) => string) => (n != null ? fmt(n) : '—');
</script>

<svelte:head><title>{inst.symbol} trade · TradeX</title></svelte:head>

<header class="mb-5 flex items-start justify-between">
	<div>
		<a href="/trades" class="text-sm" style="color:var(--color-muted)">← Trades</a>
		<h1 class="mt-1 flex items-center gap-3 text-2xl font-bold">
			{inst.symbol}
			<span class="text-sm font-medium capitalize" style="color:var(--color-muted)">
				{t.direction} · {inst.assetClass}
			</span>
			<span
				class="rounded-full px-2 py-0.5 text-xs"
				style={t.status === 'open'
					? 'background:rgba(108,140,255,0.15);color:var(--color-accent)'
					: 'background:var(--color-surface-2);color:var(--color-muted)'}>{t.status}</span
			>
		</h1>
	</div>
	<div class="text-right">
		<div class="label">Net P&L</div>
		<div
			class="text-3xl font-bold"
			style="color:{t.netPnl >= 0 ? 'var(--color-up)' : 'var(--color-down)'}"
		>
			{t.status === 'open' ? '—' : formatMoney(t.netPnl, cur, { signed: true })}
		</div>
	</div>
</header>

<div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
	{#snippet cell(label: string, value: string)}
		<div class="card p-3">
			<div class="label">{label}</div>
			<div class="mt-1 font-semibold tabular-nums">{value}</div>
		</div>
	{/snippet}
	{@render cell('Avg Entry', formatMoney(t.avgEntry, cur))}
	{@render cell(
		'Avg Exit',
		stat(t.avgExit, (v) => formatMoney(v, cur))
	)}
	{@render cell('Quantity', String(fromScaled(t.qtyOpened)))}
	{@render cell('Hold', formatDuration(t.holdMs))}
	{@render cell('Fees', formatMoney(t.fees, cur))}
	{@render cell(
		'R Multiple',
		stat(t.rMultiple, (v) => `${formatRatio(v)}R`)
	)}
	{@render cell('Gross P&L', formatMoney(t.grossPnl, cur, { signed: true }))}
	{@render cell(
		'Risk',
		stat(t.riskAmount, (v) => formatMoney(v, cur))
	)}
	{@render cell('Confidence', t.confidence != null ? `${t.confidence}/10` : '—')}
	{@render cell(
		'Planned Stop',
		stat(t.plannedStop, (v) => formatMoney(v, cur))
	)}
	{@render cell(
		'Planned Target',
		stat(t.plannedTarget, (v) => formatMoney(v, cur))
	)}
	{@render cell('Opened', formatDateTime(t.openedAt))}
</div>

<div class="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
	<div class="card overflow-hidden">
		<h3 class="border-b p-4 font-semibold" style="border-color:var(--color-border)">
			Executions ({data.detail.executions.length})
		</h3>
		<table class="w-full text-sm">
			<thead class="text-left" style="color:var(--color-muted)">
				<tr>
					<th class="p-3 font-medium">Time</th>
					<th class="p-3 font-medium">Side</th>
					<th class="p-3 text-right font-medium">Qty</th>
					<th class="p-3 text-right font-medium">Price</th>
					<th class="p-3 text-right font-medium">Fees</th>
				</tr>
			</thead>
			<tbody>
				{#each data.detail.executions as e (e.id)}
					<tr class="border-t" style="border-color:var(--color-border)">
						<td class="p-3" style="color:var(--color-muted)">{formatDateTime(e.executedAt)}</td>
						<td
							class="p-3 font-medium uppercase"
							style="color:{e.side === 'buy' ? 'var(--color-up)' : 'var(--color-down)'}"
							>{e.side}</td
						>
						<td class="p-3 text-right tabular-nums">{fromScaled(e.qty)}</td>
						<td class="p-3 text-right tabular-nums">{formatMoney(e.price, cur)}</td>
						<td class="p-3 text-right tabular-nums" style="color:var(--color-muted)">
							{formatMoney(e.fee + e.commission, cur)}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<form method="POST" action="?/annotate" use:enhance class="card p-5">
		<h3 class="mb-3 font-semibold">Journal & plan</h3>
		<label class="label" for="notes">Notes</label>
		<textarea id="notes" name="notes" rows="4" class="input mt-1" value={t.notes ?? ''}></textarea>

		<div class="mt-3 grid grid-cols-2 gap-3">
			<div>
				<label class="label" for="setup">Setup</label>
				<input
					id="setup"
					name="setup"
					class="input mt-1"
					value={data.detail.categorization.setupName ?? ''}
					placeholder="e.g. Breakout"
				/>
			</div>
			<div>
				<label class="label" for="emotion">Emotion</label>
				<input
					id="emotion"
					name="emotion"
					class="input mt-1"
					value={data.detail.categorization.emotionLabel ?? ''}
					placeholder="e.g. Confident"
				/>
			</div>
		</div>
		<div class="mt-3">
			<label class="label" for="tags">Tags (comma-separated)</label>
			<input
				id="tags"
				name="tags"
				class="input mt-1"
				value={data.detail.categorization.tagNames.join(', ')}
				placeholder="momentum, news, A+"
			/>
		</div>

		<div class="mt-3 grid grid-cols-2 gap-3">
			<div>
				<label class="label" for="plannedStop">Planned stop</label>
				<input
					id="plannedStop"
					name="plannedStop"
					class="input mt-1"
					type="text"
					inputmode="decimal"
					value={t.plannedStop != null ? fromScaled(t.plannedStop) : ''}
				/>
			</div>
			<div>
				<label class="label" for="plannedTarget">Planned target</label>
				<input
					id="plannedTarget"
					name="plannedTarget"
					class="input mt-1"
					type="text"
					inputmode="decimal"
					value={t.plannedTarget != null ? fromScaled(t.plannedTarget) : ''}
				/>
			</div>
		</div>
		<div class="mt-3 grid grid-cols-2 gap-3">
			<div>
				<label class="label" for="confidence">Confidence (1–10)</label>
				<input
					id="confidence"
					name="confidence"
					class="input mt-1"
					type="number"
					min="1"
					max="10"
					value={t.confidence ?? ''}
				/>
			</div>
			<div>
				<label class="label" for="playbookId">Playbook</label>
				<select id="playbookId" name="playbookId" class="input mt-1" value={t.playbookId ?? ''}>
					<option value="">— none —</option>
					{#each data.playbooks as p (p.id)}
						<option value={p.id}>{p.name}</option>
					{/each}
				</select>
			</div>
		</div>
		{#if data.playbooks.length === 0}
			<p class="mt-2 text-xs" style="color:var(--color-muted)">
				Create strategies on the <a href="/playbooks" style="color:var(--color-brand)">Playbooks</a>
				page to track rule adherence.
			</p>
		{/if}

		{#if form?.saved}<p class="mt-3 text-sm" style="color:var(--color-up)">Saved ✓</p>{/if}
		<p class="mt-2 text-xs" style="color:var(--color-muted)">
			Setting a planned stop recomputes this trade's R-multiple.
		</p>
		<button type="submit" class="btn btn-primary mt-3">Save</button>
	</form>
</div>
