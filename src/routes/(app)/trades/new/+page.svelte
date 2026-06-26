<script lang="ts">
	import { enhance } from '$app/forms';
	import { ASSET_CLASS_LABELS } from '$lib/domain/enums';

	let { data, form } = $props();

	const errors = $derived((form?.errors ?? {}) as Record<string, string[] | undefined>);
	const values = $derived((form?.values ?? {}) as Record<string, string>);
	const err = (field: string): string | undefined => errors[field]?.[0];
	const val = (field: string, fallback = '') => values[field] ?? fallback;
</script>

<svelte:head><title>New trade · TradeX</title></svelte:head>

<header class="mb-5">
	<a href="/trades" class="text-sm" style="color:var(--color-muted)">← Trades</a>
	<h1 class="mt-1 text-2xl font-bold">Log a trade</h1>
	<p class="text-sm" style="color:var(--color-muted)">
		Enter the round trip. Leave exit empty to log an open position.
	</p>
</header>

<form method="POST" use:enhance class="card max-w-2xl p-6">
	<div class="grid grid-cols-2 gap-4">
		<div>
			<label class="label" for="symbol">Symbol</label>
			<input
				id="symbol"
				name="symbol"
				class="input mt-1"
				value={val('symbol')}
				placeholder="AAPL"
			/>
			{#if err('symbol')}<p class="mt-1 text-xs" style="color:var(--color-down)">
					{err('symbol')}
				</p>{/if}
		</div>
		<div>
			<label class="label" for="assetClass">Asset class</label>
			<select id="assetClass" name="assetClass" class="input mt-1">
				{#each data.assetClasses as ac (ac)}
					<option value={ac}>{ASSET_CLASS_LABELS[ac]}</option>
				{/each}
			</select>
		</div>
		<div>
			<label class="label" for="direction">Direction</label>
			<select id="direction" name="direction" class="input mt-1">
				<option value="long">Long</option>
				<option value="short">Short</option>
			</select>
		</div>
		<div>
			<label class="label" for="qty">Quantity</label>
			<input
				id="qty"
				name="qty"
				class="input mt-1"
				type="text"
				inputmode="decimal"
				value={val('qty')}
				placeholder="100"
			/>
			{#if err('qty')}<p class="mt-1 text-xs" style="color:var(--color-down)">{err('qty')}</p>{/if}
		</div>
	</div>

	<div class="mt-4 grid grid-cols-2 gap-4">
		<div>
			<label class="label" for="entryPrice">Entry price</label>
			<input
				id="entryPrice"
				name="entryPrice"
				class="input mt-1"
				type="text"
				inputmode="decimal"
				value={val('entryPrice')}
				placeholder="150.25"
			/>
			{#if err('entryPrice')}<p class="mt-1 text-xs" style="color:var(--color-down)">
					{err('entryPrice')}
				</p>{/if}
		</div>
		<div>
			<label class="label" for="entryAt">Entry time (UTC)</label>
			<input
				id="entryAt"
				name="entryAt"
				class="input mt-1"
				type="datetime-local"
				value={val('entryAt')}
			/>
			{#if err('entryAt')}<p class="mt-1 text-xs" style="color:var(--color-down)">
					{err('entryAt')}
				</p>{/if}
		</div>
		<div>
			<label class="label" for="exitPrice"
				>Exit price <span class="lowercase">(optional)</span></label
			>
			<input
				id="exitPrice"
				name="exitPrice"
				class="input mt-1"
				type="text"
				inputmode="decimal"
				value={val('exitPrice')}
				placeholder="158.00"
			/>
		</div>
		<div>
			<label class="label" for="exitAt">Exit time (UTC)</label>
			<input
				id="exitAt"
				name="exitAt"
				class="input mt-1"
				type="datetime-local"
				value={val('exitAt')}
			/>
		</div>
	</div>

	<div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
		<div>
			<label class="label" for="fees">Fees</label>
			<input
				id="fees"
				name="fees"
				class="input mt-1"
				type="text"
				inputmode="decimal"
				value={val('fees')}
				placeholder="0"
			/>
		</div>
		<div>
			<label class="label" for="plannedStop">Planned stop</label>
			<input
				id="plannedStop"
				name="plannedStop"
				class="input mt-1"
				type="text"
				inputmode="decimal"
				value={val('plannedStop')}
				placeholder="for R-multiple"
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
				value={val('plannedTarget')}
			/>
		</div>
	</div>

	<div class="mt-4 grid grid-cols-[8rem_1fr] gap-4">
		<div>
			<label class="label" for="confidence">Confidence (1–10)</label>
			<input
				id="confidence"
				name="confidence"
				class="input mt-1"
				type="number"
				min="1"
				max="10"
				value={val('confidence')}
			/>
		</div>
		<div>
			<label class="label" for="notes">Notes</label>
			<input
				id="notes"
				name="notes"
				class="input mt-1"
				value={val('notes')}
				placeholder="Thesis, mistakes…"
			/>
		</div>
	</div>

	<div class="mt-4 grid grid-cols-2 gap-4">
		<div>
			<label class="label" for="setupName">Setup</label>
			<input
				id="setupName"
				name="setupName"
				class="input mt-1"
				value={val('setupName')}
				placeholder="Opening range breakout"
			/>
		</div>
		<div>
			<label class="label" for="emotionLabel">Emotion</label>
			<input
				id="emotionLabel"
				name="emotionLabel"
				class="input mt-1"
				value={val('emotionLabel')}
				placeholder="Calm / FOMO / revenge"
			/>
		</div>
		<div>
			<label class="label" for="playbookId">Playbook</label>
			<select id="playbookId" name="playbookId" class="input mt-1">
				<option value="">— none —</option>
				{#each data.playbooks as p (p.id)}
					<option value={p.id} selected={val('playbookId') === p.id}>{p.name}</option>
				{/each}
			</select>
		</div>
		<div>
			<label class="label" for="tags">Tags</label>
			<input
				id="tags"
				name="tags"
				class="input mt-1"
				value={val('tags')}
				placeholder="comma, separated"
			/>
		</div>
	</div>

	{#if form?.message}<p class="mt-4 text-sm" style="color:var(--color-down)">{form.message}</p>{/if}

	<div class="mt-6 flex gap-3">
		<button type="submit" class="btn btn-primary">Save trade</button>
		<a href="/trades" class="btn btn-ghost">Cancel</a>
	</div>
</form>
