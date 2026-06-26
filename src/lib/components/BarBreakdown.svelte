<script lang="ts">
	import { onMount } from 'svelte';
	import { formatMoney } from '$lib/money';

	type Row = { key: string; netPnl: number; trades: number; wins: number };
	let {
		title,
		rows,
		currency = 'USD',
		hrefFor
	}: {
		title: string;
		rows: Row[];
		currency?: string;
		/** When provided, each row links to the filtered trade log (drill-down). */
		hrefFor?: (key: string) => string;
	} = $props();

	// Flip after mount so the CSS width transition animates the bars in.
	let shown = $state(false);
	onMount(() => (shown = true));
	const maxAbs = $derived(Math.max(1, ...rows.map((r) => Math.abs(r.netPnl))));
	const frac = (v: number) => (Math.abs(v) / maxAbs) * 50;
</script>

<div class="panel">
	<div class="panel-h"><span class="panel-t">{title}</span></div>
	<div class="p-4">
		{#if rows.length === 0}
			<p class="text-sm" style="color:var(--color-muted)">No data yet.</p>
		{:else}
			<div class="flex flex-col gap-2">
				{#each rows as r, i (r.key)}
					{@const up = r.netPnl >= 0}
					<svelte:element
						this={hrefFor ? 'a' : 'div'}
						href={hrefFor ? hrefFor(r.key) : undefined}
						class="flex items-center gap-3 text-sm {hrefFor
							? 'rounded transition-opacity hover:opacity-70'
							: ''}"
						title={hrefFor ? `View ${r.key} trades` : undefined}
					>
						<span class="mono w-20 shrink-0 truncate" style="color:var(--color-text)">{r.key}</span>
						<!-- diverging bar around a center zero line -->
						<div class="relative h-5 flex-1 rounded" style="background:var(--color-bg-2)">
							<div
								class="absolute top-0 bottom-0"
								style="left:50%;width:1px;background:var(--color-border)"
							></div>
							<div
								class="absolute top-0 h-full rounded"
								style="{up ? 'left:50%' : 'right:50%'};width:{shown
									? frac(r.netPnl)
									: 0}%;background:{up
									? 'var(--color-up)'
									: 'var(--color-down)'};transition:width 0.8s cubic-bezier(0.22,1,0.36,1) {i *
									0.03}s"
							></div>
						</div>
						<span
							class="mono w-24 shrink-0 text-right"
							style="color:{up ? 'var(--color-up)' : 'var(--color-down)'}"
						>
							{formatMoney(r.netPnl, currency, { signed: true })}
						</span>
						<span class="mono w-16 shrink-0 text-right text-xs" style="color:var(--color-faint)">
							{r.trades > 0 ? Math.round((r.wins / r.trades) * 100) : 0}% · {r.trades}
						</span>
					</svelte:element>
				{/each}
			</div>
		{/if}
	</div>
</div>
