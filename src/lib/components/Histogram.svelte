<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import { bin, max as d3max, extent } from 'd3-array';
	import { resize } from '$lib/viz/resize';
	import { fromScaled, formatMoney } from '$lib/money';

	let {
		values,
		currency = 'USD',
		height = 220
	}: { values: number[]; currency?: string; height?: number } = $props();

	const m = { top: 12, right: 14, bottom: 28, left: 16 };
	let width = $state(640);

	const real = $derived(values.map(fromScaled));
	const iw = $derived(Math.max(10, width - m.left - m.right));
	const ih = $derived(Math.max(10, height - m.top - m.bottom));

	const ext = $derived((real.length ? extent(real) : [0, 1]) as [number, number]);
	const x = $derived(
		scaleLinear()
			.domain([Math.min(0, ext[0] ?? 0), Math.max(0, ext[1] ?? 1)])
			.nice()
			.range([0, iw])
	);
	const bins = $derived(
		bin()
			.domain(x.domain() as [number, number])
			.thresholds(Math.max(6, Math.min(28, Math.floor(iw / 34))))(real)
	);
	const ymax = $derived(d3max(bins, (b) => b.length) ?? 1);
	const y = $derived(scaleLinear().domain([0, ymax]).range([ih, 0]));
	const xticks = $derived(x.ticks(5));

	const fmtK = (n: number) => {
		const a = Math.abs(n);
		return a >= 1000 ? `${(n / 1000).toFixed(0)}k` : n.toFixed(0);
	};

	let hover = $state<number | null>(null);
	const hb = $derived(hover != null ? bins[hover] : undefined);
</script>

<div class="relative" use:resize={(w) => (width = w)} style="height:{height}px">
	{#if values.length === 0}
		<div class="absolute inset-0 grid place-items-center text-sm" style="color:var(--color-muted)">
			No closed trades yet.
		</div>
	{:else}
		<svg {width} {height} class="block">
			<g transform="translate({m.left},{m.top})">
				{#each xticks as t (t)}
					<text
						x={x(t)}
						y={ih + 16}
						text-anchor="middle"
						class="mono"
						font-size="10"
						fill="var(--color-faint)">{fmtK(t)}</text
					>
				{/each}

				{#each bins as b, i (i)}
					{@const w = Math.max(0, x(b.x1 ?? 0) - x(b.x0 ?? 0) - 2)}
					{@const mid = ((b.x0 ?? 0) + (b.x1 ?? 0)) / 2}
					<rect
						x={x(b.x0 ?? 0) + 1}
						y={y(b.length)}
						width={w}
						height={ih - y(b.length)}
						rx="1.5"
						fill={mid >= 0 ? 'var(--color-up)' : 'var(--color-down)'}
						opacity={hover == null || hover === i ? 0.85 : 0.4}
						onpointerenter={() => (hover = i)}
						onpointerleave={() => (hover = null)}
						role="presentation"
					/>
				{/each}

				<!-- zero line -->
				<line x1={x(0)} x2={x(0)} y1="0" y2={ih} stroke="var(--color-border)" stroke-width="1" />
			</g>
		</svg>

		{#if hb}
			<div
				class="pointer-events-none absolute z-10 rounded-lg border px-2.5 py-1.5 text-xs"
				style="left:{Math.min(
					width - 150,
					m.left + x(hb.x0 ?? 0) + 6
				)}px;top:6px;background:var(--color-bg-2);border-color:var(--color-border);box-shadow:var(--shadow-pop)"
			>
				<div class="mono" style="color:var(--color-faint)">
					{formatMoney(Math.round((hb.x0 ?? 0) * 1e8), currency)} … {formatMoney(
						Math.round((hb.x1 ?? 0) * 1e8),
						currency
					)}
				</div>
				<div class="mono font-semibold" style="color:var(--color-text)">
					{hb.length} trade{hb.length === 1 ? '' : 's'}
				</div>
			</div>
		{/if}
	{/if}
</div>
