<script lang="ts">
	import { enhance } from '$app/forms';
	import { ASSET_CLASS_LABELS } from '$lib/domain/enums';
	import { FIELD_TARGETS, type ColumnMap } from '$lib/domain/csv-mapping';
	import { UploadSimple, CheckCircle, WarningCircle, ArrowsClockwise } from 'phosphor-svelte';

	let { data, form } = $props();
	let submitting = $state(false);

	// The mapper's working column map. It's a writable $derived seeded from the
	// server's auto-detection: it resets when a new preview arrives, and the
	// user's per-field overrides persist until then.
	let mapping = $derived<ColumnMap>({ ...((form?.preview?.mapping ?? {}) as ColumnMap) });
	let saveTemplate = $state(false);

	const headers = $derived(form?.preview?.headers ?? []);
	const sample = $derived(form?.preview?.sample ?? []);

	function applyTemplate(id: string) {
		const tpl = data.templates.find((t) => t.id === id);
		if (tpl) mapping = { ...tpl.columnMap };
	}

	// Live-preview a sample row through the current mapping.
	const cell = (row: Record<string, string>, key: keyof ColumnMap) => {
		const col = mapping[key];
		return col ? (row[col] ?? '') : '';
	};
</script>

<svelte:head><title>Import · TradeX</title></svelte:head>

<header class="mb-5">
	<h1 class="text-2xl font-bold">Import trades</h1>
	<p class="mono mt-0.5 text-xs" style="color:var(--color-muted)">
		Upload → confirm the column mapping → import. Rows deduplicate; bad rows are reported, never
		dropped silently.
	</p>
</header>

{#if form?.result}
	{@const r = form.result}
	<div class="panel max-w-xl p-6">
		<div class="flex items-center gap-2" style="color:var(--color-up)">
			<CheckCircle size={22} weight="fill" />
			<span class="kpi-val tnum text-xl">{r.importedCount}</span>
			<span class="text-sm" style="color:var(--color-muted)">executions imported</span>
		</div>
		<div class="mt-4 grid grid-cols-3 gap-2">
			{#each [['Rows', r.rowCount], ['Duplicates', r.duplicateCount], ['Errors', r.errors.length]] as [label, val] (label)}
				<div class="rounded-lg p-2" style="background:var(--color-bg-2)">
					<div class="label">{label}</div>
					<div class="mono font-semibold">{val}</div>
				</div>
			{/each}
		</div>
		{#if form.savedTemplate}
			<p class="mt-3 text-xs" style="color:var(--color-up)">Mapping saved as a template ✓</p>
		{/if}
		{#if r.errors.length > 0}
			<div class="mt-4">
				<div class="mb-2 flex items-center gap-2" style="color:var(--color-gold)">
					<WarningCircle size={18} /> Rows needing attention
				</div>
				<div class="panel max-h-64 overflow-y-auto">
					<table class="dtable">
						<tbody>
							{#each r.errors as e (e.row)}
								<tr>
									<td class="mono align-top" style="color:var(--color-faint)">row {e.row}</td>
									<td class="text-left">
										{#each e.fields as f, i (i)}
											<span
												><span class="mono" style="color:var(--color-muted)">{f.field}</span>: {f.message}{i <
												e.fields.length - 1
													? '; '
													: ''}</span
											>
										{/each}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
		<div class="mt-4 flex gap-3">
			<a href="/trades" class="btn btn-primary">View trades →</a>
			<a href="/import" class="btn btn-ghost">Import another file</a>
		</div>
	</div>
{:else if form?.stage === 'map'}
	<!-- Step 2: interactive column mapper -->
	<form
		method="POST"
		action="?/import"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
		class="grid gap-3 lg:grid-cols-[20rem_1fr]"
	>
		<input type="hidden" name="csv" value={form.csv} />

		<div class="panel h-fit p-5">
			<h3 class="mb-1 font-semibold">Map columns</h3>
			<p class="mb-3 text-xs" style="color:var(--color-muted)">
				We auto-detected these. Adjust any that look wrong.
			</p>

			{#if data.templates.length}
				<label class="label" for="tpl">Load a saved template</label>
				<select
					id="tpl"
					class="input mt-1 mb-4"
					onchange={(e) => applyTemplate(e.currentTarget.value)}
				>
					<option value="">— choose —</option>
					{#each data.templates as t (t.id)}
						<option value={t.id}>{t.name} · {t.broker}</option>
					{/each}
				</select>
			{/if}

			<div class="flex flex-col gap-2">
				{#each FIELD_TARGETS as f (f.key)}
					<label class="grid grid-cols-[7rem_1fr] items-center gap-2 text-sm">
						<span class="label">
							{f.label}{#if f.required}<span style="color:var(--color-down)"> *</span>{/if}
						</span>
						<select name="map.{f.key}" bind:value={mapping[f.key]} class="input py-1 text-xs">
							<option value="">— none —</option>
							{#each headers as h (h)}
								<option value={h}>{h}</option>
							{/each}
						</select>
					</label>
				{/each}
			</div>

			<div class="mt-4">
				<label class="label" for="assetClass">Default asset class</label>
				<select id="assetClass" name="assetClass" class="input mt-1" value={form.defaultAssetClass}>
					{#each data.assetClasses as ac (ac)}
						<option value={ac}>{ASSET_CLASS_LABELS[ac]}</option>
					{/each}
				</select>
			</div>

			<label class="mt-4 flex items-center gap-2 text-sm">
				<input type="checkbox" name="saveTemplate" bind:checked={saveTemplate} /> Save this mapping as
				a template
			</label>
			{#if saveTemplate}
				<div class="mt-2 grid grid-cols-2 gap-2">
					<input name="templateName" class="input py-1 text-xs" placeholder="Template name" />
					<input name="broker" class="input py-1 text-xs" placeholder="Broker" />
				</div>
			{/if}

			<div class="mt-5 flex gap-2">
				<button type="submit" class="btn btn-primary" disabled={submitting}>
					<UploadSimple size={16} />
					{submitting ? 'Importing…' : `Import ${form.preview.totalRows} rows`}
				</button>
				<a href="/import" class="btn btn-ghost"><ArrowsClockwise size={14} /> Start over</a>
			</div>
		</div>

		<div class="panel p-5">
			<h3 class="mb-3 font-semibold">
				Preview <span class="chip">first {sample.length} rows</span>
			</h3>
			<div class="overflow-x-auto">
				<table class="dtable">
					<thead>
						<tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Price</th><th>Date</th></tr>
					</thead>
					<tbody>
						{#each sample as row, i (i)}
							<tr>
								<td class="mono font-semibold">{cell(row, 'symbol')}</td>
								<td class="mono">{cell(row, 'side')}</td>
								<td class="mono">{cell(row, 'qty')}</td>
								<td class="mono">{cell(row, 'price')}</td>
								<td class="mono" style="color:var(--color-muted)">{cell(row, 'executedAt')}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="mt-3 text-xs" style="color:var(--color-faint)">
				Empty cells mean that field isn't mapped to a column yet.
			</p>
		</div>
	</form>
{:else}
	<!-- Step 1: upload -->
	<div class="grid gap-3 lg:grid-cols-[1fr_20rem]">
		<form
			method="POST"
			action="?/preview"
			enctype="multipart/form-data"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
			class="panel p-6"
		>
			<label class="label" for="file">CSV file</label>
			<input id="file" name="file" type="file" accept=".csv,text/csv" class="input mt-1" />

			<p class="mono my-3 text-center text-xs" style="color:var(--color-faint)">
				— or paste rows —
			</p>
			<textarea
				name="csv"
				rows="6"
				class="input mono text-xs"
				placeholder="Symbol,Side,Qty,Price,Date&#10;AAPL,Buy,100,150.25,2026-06-24T14:30:00Z"
			></textarea>

			<div class="mt-4">
				<label class="label" for="assetClass0">Default asset class</label>
				<select id="assetClass0" name="assetClass" class="input mt-1">
					{#each data.assetClasses as ac (ac)}
						<option value={ac}>{ASSET_CLASS_LABELS[ac]}</option>
					{/each}
				</select>
			</div>

			{#if form?.message}
				<p class="mt-3 text-sm" style="color:var(--color-down)">{form.message}</p>
			{/if}

			<button type="submit" class="btn btn-primary mt-5" disabled={submitting}>
				<UploadSimple size={16} />
				{submitting ? 'Reading…' : 'Preview mapping'}
			</button>
		</form>

		<div class="panel h-fit p-5">
			<h3 class="mb-2 font-semibold">Saved templates</h3>
			{#if data.templates.length === 0}
				<p class="text-xs" style="color:var(--color-muted)">
					None yet. Save a column mapping while importing and it'll appear here for next time.
				</p>
			{:else}
				<div class="flex flex-col gap-1">
					{#each data.templates as t (t.id)}
						<div class="flex items-center justify-between text-sm">
							<span
								>{t.name}
								<span class="mono text-xs" style="color:var(--color-faint)">· {t.broker}</span
								></span
							>
							<form method="POST" action="?/deleteTemplate" use:enhance>
								<input type="hidden" name="id" value={t.id} />
								<button type="submit" class="btn btn-ghost text-xs" style="color:var(--color-down)"
									>Delete</button
								>
							</form>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}
