<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import { line, area, curveMonotoneX } from 'd3-shape';
	import { extent } from 'd3-array';
	import { resize } from '$lib/viz/resize';

	let {
		values,
		color = 'var(--color-brand)',
		height = 40,
		fill = true,
		strokeWidth = 1.5
	}: {
		values: number[];
		color?: string;
		height?: number;
		fill?: boolean;
		strokeWidth?: number;
	} = $props();

	const uid = $props.id();
	const pad = 2;
	let width = $state(120);

	const x = $derived(
		scaleLinear()
			.domain([0, Math.max(1, values.length - 1)])
			.range([pad, width - pad])
	);
	const yd = $derived((values.length ? extent(values) : [0, 1]) as [number, number]);
	const y = $derived(
		scaleLinear()
			.domain([yd[0] ?? 0, yd[1] ?? 1])
			.range([height - pad, pad])
	);
	const linePath = $derived(
		line<number>()
			.x((_, i) => x(i))
			.y((d) => y(d))
			.curve(curveMonotoneX)(values) ?? ''
	);
	const areaPath = $derived(
		area<number>()
			.x((_, i) => x(i))
			.y0(height)
			.y1((d) => y(d))
			.curve(curveMonotoneX)(values) ?? ''
	);
</script>

<div use:resize={(w) => (width = w)} class="w-full" style="height:{height}px">
	<svg {width} {height} class="block w-full overflow-visible" role="img" aria-label="sparkline">
		<defs>
			<linearGradient id="spk-{uid}" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0%" stop-color={color} stop-opacity="0.3" />
				<stop offset="100%" stop-color={color} stop-opacity="0" />
			</linearGradient>
		</defs>
		{#if fill && values.length > 1}
			<path d={areaPath} fill="url(#spk-{uid})" />
		{/if}
		{#if values.length > 1}
			<path
				d={linePath}
				fill="none"
				stroke={color}
				stroke-width={strokeWidth}
				stroke-linejoin="round"
			/>
		{/if}
	</svg>
</div>
