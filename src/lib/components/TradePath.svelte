<script lang="ts">
	import { scaleLinear, scaleTime } from 'd3-scale';
	import { line, curveLinear } from 'd3-shape';
	import { extent } from 'd3-array';
	import { resize } from '$lib/viz/resize';
	import { fromScaled, formatMoney } from '$lib/money';

	type Exec = { executedAt: number; side: 'buy' | 'sell'; price: number; qty: number };
	let {
		executions,
		plannedStop = null,
		plannedTarget = null,
		avgEntry,
		avgExit = null,
		currency = 'USD',
		height = 260
	}: {
		executions: Exec[];
		plannedStop?: number | null;
		plannedTarget?: number | null;
		avgEntry: number;
		avgExit?: number | null;
		currency?: string;
		height?: number;
	} = $props();

	const m = { top: 16, right: 70, bottom: 24, left: 56 };
	let width = $state(640);

	const pts = $derived(
		executions.map((e) => ({ t: e.executedAt, p: fromScaled(e.price), side: e.side, qty: e.qty }))
	);
	const iw = $derived(Math.max(10, width - m.left - m.right));
	const ih = $derived(Math.max(10, height - m.top - m.bottom));

	const levels = $derived(
		[plannedStop, plannedTarget, avgEntry, avgExit]
			.filter((v): v is number => v != null)
			.map(fromScaled)
	);

	const xext = $derived(extent(pts, (d) => d.t) as [number, number]);
	const x = $derived(
		scaleTime()
			.domain(xext[0] === xext[1] ? [xext[0] - 6e4, xext[1] + 6e4] : xext)
			.range([0, iw])
	);
	const lo = $derived(Math.min(...pts.map((d) => d.p), ...levels));
	const hi = $derived(Math.max(...pts.map((d) => d.p), ...levels));
	const pad = $derived((hi - lo) * 0.12 || hi * 0.02 || 1);
	const y = $derived(
		scaleLinear()
			.domain([lo - pad, hi + pad])
			.range([ih, 0])
			.nice()
	);

	const path = $derived(
		line<{ t: number; p: number }>()
			.x((d) => x(d.t))
			.y((d) => y(d.p))
			.curve(curveLinear)(pts) ?? ''
	);
	const yticks = $derived(y.ticks(5));
	const fmtP = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(2)}k` : n.toFixed(2));

	const hlines = $derived(
		[
			plannedStop != null
				? { v: fromScaled(plannedStop), c: 'var(--color-down)', label: 'stop' }
				: null,
			plannedTarget != null
				? { v: fromScaled(plannedTarget), c: 'var(--color-up)', label: 'target' }
				: null,
			avgExit != null ? { v: fromScaled(avgExit), c: 'var(--color-brand)', label: 'exit' } : null
		].filter((d): d is { v: number; c: string; label: string } => d != null)
	);
</script>

<div use:resize={(w) => (width = w)} style="height:{height}px">
	{#if pts.length === 0}
		<div class="grid h-full place-items-center text-sm" style="color:var(--color-muted)">
			No executions.
		</div>
	{:else}
		<svg {width} {height} class="block">
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
						fill="var(--color-faint)">{fmtP(t)}</text
					>
				{/each}

				<!-- planned / avg level lines -->
				{#each hlines as h (h.label)}
					<line
						x1="0"
						x2={iw}
						y1={y(h.v)}
						y2={y(h.v)}
						stroke={h.c}
						stroke-width="1"
						stroke-dasharray="4 3"
						opacity="0.8"
					/>
					<text x={iw + 6} y={y(h.v)} dy="0.32em" class="mono" font-size="9" fill={h.c}
						>{h.label}</text
					>
				{/each}

				{#if pts.length > 1}
					<path
						d={path}
						fill="none"
						stroke="var(--color-muted)"
						stroke-width="1.5"
						stroke-dasharray="2 2"
					/>
				{/if}

				{#each pts as d (d.t + '' + d.side)}
					<circle
						cx={x(d.t)}
						cy={y(d.p)}
						r="5"
						fill={d.side === 'buy' ? 'var(--color-up)' : 'var(--color-down)'}
						stroke="var(--color-bg)"
						stroke-width="2"
					>
						<title
							>{d.side.toUpperCase()}
							{fromScaled(d.qty)} @ {formatMoney(Math.round(d.p * 1e8), currency)}</title
						>
					</circle>
				{/each}
			</g>
		</svg>
	{/if}
</div>
