<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import { line, area, curveMonotoneX } from 'd3-shape';
	import { max, min } from 'd3-array';
	import { gsap } from 'gsap';
	import { resize } from '$lib/viz/resize';
	import { reduced } from '$lib/motion';
	import type { FanBand } from '$lib/domain/montecarlo';

	let { bands, height = 280 }: { bands: FanBand[]; height?: number } = $props();

	const uid = $props.id();
	const m = { top: 14, right: 16, bottom: 24, left: 58 };
	let width = $state(640);

	const iw = $derived(Math.max(10, width - m.left - m.right));
	const ih = $derived(Math.max(10, height - m.top - m.bottom));

	const x = $derived(
		scaleLinear()
			.domain([0, Math.max(1, bands.length - 1)])
			.range([0, iw])
	);
	const lo = $derived(min(bands, (d) => d.p5) ?? 0);
	const hi = $derived(max(bands, (d) => d.p95) ?? 1);
	const pad = $derived((hi - lo) * 0.06 || 1);
	const y = $derived(
		scaleLinear()
			.domain([Math.min(0, lo) - pad, Math.max(0, hi) + pad])
			.range([ih, 0])
			.nice()
	);

	const outer = $derived(
		area<FanBand>()
			.x((d) => x(d.step))
			.y0((d) => y(d.p5))
			.y1((d) => y(d.p95))
			.curve(curveMonotoneX)(bands) ?? ''
	);
	const inner = $derived(
		area<FanBand>()
			.x((d) => x(d.step))
			.y0((d) => y(d.p25))
			.y1((d) => y(d.p75))
			.curve(curveMonotoneX)(bands) ?? ''
	);
	const med = $derived(
		line<FanBand>()
			.x((d) => x(d.step))
			.y((d) => y(d.median))
			.curve(curveMonotoneX)(bands) ?? ''
	);

	const yticks = $derived(y.ticks(5));
	const fmtAxis = (n: number) => {
		const a = Math.abs(n);
		return a >= 1000 ? `${(n / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : n.toFixed(0);
	};

	let clipW = $state(0);
	let didAnim = false;
	$effect(() => {
		const target = iw;
		if (target <= 10) return;
		if (didAnim || reduced()) {
			clipW = target;
			return;
		}
		didAnim = true;
		const o = { w: 0 };
		const tw = gsap.to(o, {
			w: target,
			duration: 1.1,
			ease: 'power2.out',
			onUpdate: () => (clipW = o.w)
		});
		return () => tw.kill();
	});
</script>

<div use:resize={(w) => (width = w)} style="height:{height}px">
	{#if bands.length === 0}
		<div class="grid h-full place-items-center text-sm" style="color:var(--color-muted)">
			Not enough trades to simulate.
		</div>
	{:else}
		<svg {width} {height} class="block">
			<defs>
				<clipPath id="fan-{uid}"><rect x="0" y="-14" width={clipW} height={ih + 28} /></clipPath>
			</defs>
			<g transform="translate({m.left},{m.top})">
				{#each yticks as t (t)}
					<line
						x1="0"
						x2={iw}
						y1={y(t)}
						y2={y(t)}
						stroke="var(--color-hairline)"
						stroke-width="1"
					/>
					<text
						x="-10"
						y={y(t)}
						dy="0.32em"
						text-anchor="end"
						class="mono"
						font-size="10"
						fill="var(--color-faint)">{fmtAxis(t)}</text
					>
				{/each}
				<line
					x1="0"
					x2={iw}
					y1={y(0)}
					y2={y(0)}
					stroke="var(--color-border)"
					stroke-width="1"
					stroke-dasharray="2 3"
				/>

				<g clip-path="url(#fan-{uid})">
					<path d={outer} fill="var(--color-brand)" opacity="0.1" />
					<path d={inner} fill="var(--color-brand)" opacity="0.18" />
					<path
						d={med}
						fill="none"
						stroke="var(--color-brand)"
						stroke-width="2"
						stroke-linejoin="round"
					/>
				</g>

				<text x={iw} y="2" text-anchor="end" class="mono" font-size="9" fill="var(--color-faint)"
					>p5–p95 · p25–p75 · median</text
				>
				<text
					x={iw}
					y={ih + 16}
					text-anchor="end"
					class="mono"
					font-size="10"
					fill="var(--color-faint)">{bands.length - 1} trades →</text
				>
			</g>
		</svg>
	{/if}
</div>
