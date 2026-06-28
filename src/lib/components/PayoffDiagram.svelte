<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import { line, curveLinear } from 'd3-shape';
	import { resize } from '$lib/viz/resize';
	import { fromScaled } from '$lib/money';
	import type { PayoffCurve } from '$lib/domain/spreads';

	let {
		curve,
		strikes = [],
		currency = 'USD',
		height = 280
	}: {
		curve: PayoffCurve;
		/** scaled strike prices to tick on the x-axis */
		strikes?: number[];
		currency?: string;
		height?: number;
	} = $props();

	const m = { top: 16, right: 18, bottom: 30, left: 60 };
	let width = $state(640);

	const iw = $derived(Math.max(10, width - m.left - m.right));
	const ih = $derived(Math.max(10, height - m.top - m.bottom));

	// Work in real dollars (scaled → number) so axes read naturally.
	const pts = $derived(curve.points.map((p) => ({ x: fromScaled(p.x), y: fromScaled(p.y) })));
	const strikesR = $derived([...new Set(strikes.map(fromScaled))]);
	const beR = $derived(curve.breakevens.map(fromScaled));

	const x = $derived(
		scaleLinear()
			.domain([fromScaled(curve.domain[0]), fromScaled(curve.domain[1])])
			.range([0, iw])
	);
	const yLo = $derived(Math.min(fromScaled(curve.minPnl), 0));
	const yHi = $derived(Math.max(fromScaled(curve.maxPnl), 0));
	const yPad = $derived((yHi - yLo) * 0.12 || 1);
	const y = $derived(
		scaleLinear()
			.domain([yLo - yPad, yHi + yPad])
			.range([ih, 0])
			.nice()
	);

	const zeroY = $derived(y(0));
	const path = $derived(
		line<{ x: number; y: number }>()
			.x((d) => x(d.x))
			.y((d) => y(d.y))
			.curve(curveLinear)(pts) ?? ''
	);

	// One filled quad per segment, green above the zero line, red below. Break-evens
	// are sample points, so each segment sits wholly in profit or loss territory.
	const segs = $derived(
		pts.slice(1).map((p1, i) => {
			const p0 = pts[i]!;
			const profit = p0.y + p1.y >= 0;
			return {
				profit,
				d: `M${x(p0.x)},${zeroY} L${x(p0.x)},${y(p0.y)} L${x(p1.x)},${y(p1.y)} L${x(p1.x)},${zeroY} Z`
			};
		})
	);

	const yticks = $derived(y.ticks(5));
	const fmt = (n: number) =>
		Math.abs(n) >= 1000
			? `${n < 0 ? '-' : ''}$${(Math.abs(n) / 1000).toFixed(1)}k`
			: `$${n.toFixed(0)}`;
	const fmtPrice = (n: number) =>
		Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(0);
</script>

<div use:resize={(w) => (width = w)} style="height:{height}px">
	<svg {width} {height} class="block" role="img" aria-label="Payoff at expiry">
		<g transform="translate({m.left},{m.top})">
			<!-- y grid + $ P&L ticks -->
			{#each yticks as t (t)}
				<line x1="0" x2={iw} y1={y(t)} y2={y(t)} stroke="var(--color-hairline)" stroke-width="1" />
				<text
					x="-10"
					y={y(t)}
					dy="0.32em"
					text-anchor="end"
					class="mono"
					font-size="10"
					fill="var(--color-faint)">{fmt(t)}</text
				>
			{/each}

			<!-- profit / loss shading -->
			{#each segs as s, i (i)}
				<path
					d={s.d}
					fill={s.profit ? 'var(--color-up)' : 'var(--color-down)'}
					opacity="0.13"
					stroke="none"
				/>
			{/each}

			<!-- zero P&L baseline -->
			<line x1="0" x2={iw} y1={zeroY} y2={zeroY} stroke="var(--color-muted)" stroke-width="1.25" />

			<!-- strike ticks -->
			{#each strikesR as k (k)}
				<line
					x1={x(k)}
					x2={x(k)}
					y1="0"
					y2={ih}
					stroke="var(--color-hairline)"
					stroke-width="1"
					stroke-dasharray="2 3"
				/>
				<text
					x={x(k)}
					y={ih + 12}
					text-anchor="middle"
					class="mono"
					font-size="9"
					fill="var(--color-faint)">{fmtPrice(k)}</text
				>
			{/each}

			<!-- break-even markers -->
			{#each beR as be (be)}
				<line
					x1={x(be)}
					x2={x(be)}
					y1="0"
					y2={ih}
					stroke="var(--color-brand)"
					stroke-width="1"
					stroke-dasharray="4 3"
					opacity="0.9"
				/>
				<text
					x={x(be)}
					y="2"
					dy="0.7em"
					text-anchor="middle"
					class="mono"
					font-size="9"
					fill="var(--color-brand)">BE {fmtPrice(be)}</text
				>
			{/each}

			<!-- payoff line -->
			<path d={path} fill="none" stroke="var(--color-text)" stroke-width="2" />
		</g>
	</svg>
</div>
<p class="mt-1 text-center text-xs" style="color:var(--color-faint)">
	P&amp;L at expiry ({currency}) vs underlying price · BE = break-even
</p>
