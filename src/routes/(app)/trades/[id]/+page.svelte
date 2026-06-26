<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatMoney, formatRatio, fromScaled } from '$lib/money';
	import { formatDateTime, formatDuration } from '$lib/format';
	import TradePath from '$lib/components/TradePath.svelte';
	import { reveal } from '$lib/motion';
	import { page } from '$app/state';
	import { Trash, ShareNetwork, Copy, Check } from 'phosphor-svelte';

	let { data, form } = $props();
	const t = $derived(data.detail.trade);
	const inst = $derived(data.detail.instrument);
	const cur = $derived(data.currency);
	const stat = (n: number | null, fmt: (v: number) => string) => (n != null ? fmt(n) : '—');

	// Full share URL — page.url.origin is correct on both server and client.
	const shareUrl = (token: string) => `${page.url.origin}/share/${token}`;

	let copied = $state<string | null>(null);
	async function copy(token: string) {
		try {
			await navigator.clipboard.writeText(shareUrl(token));
			copied = token;
			setTimeout(() => (copied = copied === token ? null : copied), 1500);
		} catch {
			/* clipboard unavailable */
		}
	}
</script>

<svelte:head><title>{inst.symbol} trade · TradeX</title></svelte:head>

<div class="panel mb-3">
	<div class="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<a href="/trades" class="mono text-xs" style="color:var(--color-muted)">← Trades</a>
			<h1 class="mt-1 flex items-center gap-3 text-2xl font-bold">
				{inst.symbol}
				<span class="mono text-sm font-medium capitalize" style="color:var(--color-muted)">
					{t.direction} · {inst.assetClass}
				</span>
				<span class="chip" style={t.status === 'open' ? 'color:var(--color-accent)' : ''}>
					{t.status}
				</span>
			</h1>
		</div>
		<div class="flex flex-col items-start gap-2 sm:items-end">
			<div class="sm:text-right">
				<div class="label">Net P&L</div>
				<div
					class="kpi-val tnum"
					style="color:{t.netPnl >= 0 ? 'var(--color-up)' : 'var(--color-down)'}"
				>
					{t.status === 'open' ? '—' : formatMoney(t.netPnl, cur, { signed: true })}
				</div>
			</div>
			<div class="flex gap-2">
				<details class="relative">
					<summary class="btn btn-ghost text-xs"><ShareNetwork size={14} /> Share</summary>
					<div
						class="panel absolute right-0 z-20 mt-2 w-[min(20rem,calc(100vw-2.5rem))] p-4"
						style="box-shadow:var(--shadow-pop)"
					>
						<form method="POST" action="?/share" use:enhance class="flex flex-col gap-2 text-sm">
							<p class="text-xs" style="color:var(--color-muted)">
								Create a read-only public link to this trade.
							</p>
							<label class="flex items-center gap-2"
								><input type="checkbox" name="hideSize" /> Hide position size</label
							>
							<label class="flex items-center gap-2"
								><input type="checkbox" name="hidePnl" /> Hide dollar P&L (show R only)</label
							>
							<label class="flex items-center justify-between gap-2"
								>Expires
								<select name="expiresInDays" class="input w-32 py-1 text-xs">
									<option value="">Never</option>
									<option value="7">In 7 days</option>
									<option value="30">In 30 days</option>
								</select>
							</label>
							<button type="submit" class="btn btn-primary mt-1 text-xs">Create link</button>
						</form>
					</div>
				</details>
				<form method="POST" action="?/delete" use:enhance>
					<button
						type="submit"
						class="btn btn-ghost text-xs"
						style="color:var(--color-down)"
						onclick={(e) => {
							if (!confirm('Delete this trade and its executions? This cannot be undone.'))
								e.preventDefault();
						}}
					>
						<Trash size={14} /> Delete trade
					</button>
				</form>
			</div>
		</div>
	</div>
</div>

{#if data.shares.length || form?.shared}
	<div class="panel mb-3" use:reveal>
		<div class="panel-h"><span class="panel-t">Share links</span></div>
		<div class="flex flex-col">
			{#each data.shares as link (link.id)}
				<div
					class="flex items-center gap-2 border-t px-4 py-2 first:border-t-0"
					style="border-color:var(--color-hairline)"
				>
					<input
						class="input flex-1 py-1 font-mono text-xs"
						readonly
						value={shareUrl(link.token)}
						aria-label="Share URL"
					/>
					<button type="button" class="btn btn-ghost text-xs" onclick={() => copy(link.token)}>
						{#if copied === link.token}<Check size={14} /> Copied{:else}<Copy size={14} /> Copy{/if}
					</button>
					{#if link.scope.hideSize}<span class="chip">no size</span>{/if}
					{#if link.scope.hidePnl}<span class="chip">no $</span>{/if}
					{#if link.expiresAt}<span class="chip" title="expires"
							>exp {new Date(link.expiresAt).toISOString().slice(0, 10)}</span
						>{/if}
					<form method="POST" action="?/revokeShare" use:enhance>
						<input type="hidden" name="id" value={link.id} />
						<button type="submit" class="btn btn-ghost text-xs" style="color:var(--color-down)"
							>Revoke</button
						>
					</form>
				</div>
			{/each}
		</div>
	</div>
{/if}

<div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
	{#snippet cell(label: string, value: string)}
		<div class="panel p-3">
			<div class="label">{label}</div>
			<div class="mono mt-1 font-semibold">{value}</div>
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

<div class="panel mt-3" use:reveal={{ delay: 0.05 }}>
	<div class="panel-h">
		<span class="panel-t">Trade Path</span>
		<span class="mono text-xs" style="color:var(--color-faint)">price · entry/exit vs plan</span>
	</div>
	<div class="p-3">
		<TradePath
			executions={data.detail.executions}
			plannedStop={t.plannedStop}
			plannedTarget={t.plannedTarget}
			avgEntry={t.avgEntry}
			avgExit={t.avgExit}
			currency={cur}
		/>
	</div>
</div>

<div class="mt-3 grid gap-3 lg:grid-cols-[1.3fr_1fr]">
	<div class="panel">
		<div class="panel-h">
			<span class="panel-t">Executions · {data.detail.executions.length}</span>
		</div>
		<table class="dtable">
			<thead>
				<tr>
					<th>Time</th>
					<th>Side</th>
					<th>Qty</th>
					<th>Price</th>
					<th>Fees</th>
				</tr>
			</thead>
			<tbody>
				{#each data.detail.executions as e (e.id)}
					<tr>
						<td class="mono" style="color:var(--color-muted)">{formatDateTime(e.executedAt)}</td>
						<td
							class="mono font-semibold uppercase"
							style="color:{e.side === 'buy' ? 'var(--color-up)' : 'var(--color-down)'}"
							>{e.side}</td
						>
						<td class="mono">{fromScaled(e.qty)}</td>
						<td class="mono">{formatMoney(e.price, cur)}</td>
						<td class="mono" style="color:var(--color-muted)"
							>{formatMoney(e.fee + e.commission, cur)}</td
						>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<form method="POST" action="?/annotate" use:enhance class="panel p-5">
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
