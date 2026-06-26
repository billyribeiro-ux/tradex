<script lang="ts">
	import { enhance } from '$app/forms';
	import { ASSET_CLASS_LABELS } from '$lib/domain/enums';
	import { UploadSimple, CheckCircle, WarningCircle } from 'phosphor-svelte';

	let { data, form } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Import · TradeX</title></svelte:head>

<header class="mb-5">
	<h1 class="text-2xl font-bold">Import trades</h1>
	<p class="mono mt-0.5 text-xs" style="color:var(--color-muted)">
		Upload a broker CSV — columns auto-detected, rows deduplicated, bad rows reported
	</p>
</header>

<div class="grid gap-3 lg:grid-cols-[1fr_1fr]">
	<form
		method="POST"
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

		<p class="mono my-3 text-center text-xs" style="color:var(--color-faint)">— or paste rows —</p>
		<textarea
			name="csv"
			rows="6"
			class="input mono text-xs"
			placeholder="Symbol,Side,Qty,Price,Date&#10;AAPL,Buy,100,150.25,2026-06-24T14:30:00Z"
		></textarea>

		<div class="mt-4">
			<label class="label" for="assetClass">Default asset class</label>
			<select id="assetClass" name="assetClass" class="input mt-1">
				{#each data.assetClasses as ac (ac)}
					<option value={ac}>{ASSET_CLASS_LABELS[ac]}</option>
				{/each}
			</select>
			<p class="mt-1 text-xs" style="color:var(--color-muted)">
				Used when the file has no asset-class column.
			</p>
		</div>

		<button type="submit" class="btn btn-primary mt-5" disabled={submitting}>
			<UploadSimple size={16} />
			{submitting ? 'Importing…' : 'Import'}
		</button>
	</form>

	<div class="panel p-6">
		<h3 class="mb-3 font-semibold">Result</h3>
		{#if form?.message}
			<p style="color:var(--color-down)">{form.message}</p>
		{:else if form?.result}
			{@const r = form.result}
			<div class="flex items-center gap-2" style="color:var(--color-up)">
				<CheckCircle size={20} weight="fill" />
				<span class="kpi-val tnum text-lg">{r.importedCount}</span>
				<span class="text-sm" style="color:var(--color-muted)">executions imported</span>
			</div>
			<div class="mt-3 grid grid-cols-3 gap-2">
				<div class="rounded-lg p-2" style="background:var(--color-bg-2)">
					<div class="label">Rows</div>
					<div class="mono font-semibold">{r.rowCount}</div>
				</div>
				<div class="rounded-lg p-2" style="background:var(--color-bg-2)">
					<div class="label">Duplicates</div>
					<div class="mono font-semibold">{r.duplicateCount}</div>
				</div>
				<div class="rounded-lg p-2" style="background:var(--color-bg-2)">
					<div class="label">Errors</div>
					<div class="mono font-semibold">{r.errors.length}</div>
				</div>
			</div>

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

			<a href="/trades" class="btn btn-ghost mt-4">View trades →</a>
		{:else}
			<p class="text-sm" style="color:var(--color-muted)">
				Import results will appear here. Re-importing the same file is safe — duplicates are
				skipped.
			</p>
		{/if}
	</div>
</div>
