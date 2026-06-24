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
	<p class="text-sm" style="color:var(--color-muted)">
		Upload a broker CSV. Columns are auto-detected, rows are deduplicated, and any bad rows are
		reported — the rest still import.
	</p>
</header>

<div class="grid gap-4 lg:grid-cols-[1fr_1fr]">
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
		class="card p-6"
	>
		<label class="label" for="file">CSV file</label>
		<input id="file" name="file" type="file" accept=".csv,text/csv" class="input mt-1" />

		<p class="my-3 text-center text-xs" style="color:var(--color-muted)">— or paste rows —</p>
		<textarea
			name="csv"
			rows="6"
			class="input font-mono text-xs"
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

	<div class="card p-6">
		<h3 class="mb-3 font-semibold">Result</h3>
		{#if form?.message}
			<p style="color:var(--color-down)">{form.message}</p>
		{:else if form?.result}
			{@const r = form.result}
			<div class="flex items-center gap-2" style="color:var(--color-up)">
				<CheckCircle size={20} weight="fill" />
				<span class="text-lg font-semibold">{r.importedCount} executions imported</span>
			</div>
			<div class="mt-2 grid grid-cols-3 gap-2 text-sm">
				<div><span style="color:var(--color-muted)">Rows</span> · {r.rowCount}</div>
				<div><span style="color:var(--color-muted)">Duplicates</span> · {r.duplicateCount}</div>
				<div><span style="color:var(--color-muted)">Errors</span> · {r.errors.length}</div>
			</div>

			{#if r.errors.length > 0}
				<div class="mt-4">
					<div class="mb-2 flex items-center gap-2" style="color:#e0a814">
						<WarningCircle size={18} /> Rows needing attention
					</div>
					<div
						class="max-h-64 overflow-y-auto rounded-lg"
						style="background:var(--color-surface-2)"
					>
						<table class="w-full text-xs">
							<tbody>
								{#each r.errors as e (e.row)}
									<tr class="border-b" style="border-color:var(--color-border)">
										<td class="p-2 align-top font-mono" style="color:var(--color-muted)"
											>row {e.row}</td
										>
										<td class="p-2">{e.messages.join('; ')}</td>
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
