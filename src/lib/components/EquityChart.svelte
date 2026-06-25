<script lang="ts">
	import { scaleLinear, scaleTime } from 'd3-scale';
	import { line, area, curveMonotoneX } from 'd3-shape';
	import { extent, bisector, max, min } from 'd3-array';
	import { gsap } from 'gsap';
	import { resize } from '$lib/viz/resize';
	import { reduced } from '$lib/motion';
	import { fromScaled, formatMoney } from '$lib/money';
	import type { EquityPoint } from '$lib/domain/metrics';

	let {
		points,
		height = 300,
		currency = 'USD'
	}: { points: EquityPoint[]; height?: number; currency?: string } = $props();

	const uid = $props.id();
	const m = { top: 16, right: 18, bottom: 24, left: 58 };
	let width = $state(760);

	const data = $derived(points.map((p) => ({ t: p.t, v: fromScaled(p.equity), raw: p.equity })));
	const iw = $derived(Math.max(10, width - m.left - m.right));
	const ih = $derived(Math.max(10, height - m.top - m.bottom));

	const x = $derived(
		scaleTime()
			.domain((extent(data, (d) => d.t) as [number, number]) ?? [0, 1])
			.range([0, iw])
	);
	const lo = $derived(min(data, (d) => d.v) ?? 0);
	const hi = $derived(max(data, (d) => d.v) ?? 1);
	const pad = $derived((hi - lo) * 0.08 || 1);
	const y = $derived(
		scaleLinear()
			.domain([lo - pad, hi + pad])
			.range([ih, 0])
			.nice()
	);

	const linePath = $derived(
		line<{ t: number; v: number }>()
			.x((d) => x(d.t))
			.y((d) => y(d.v))
			.curve(curveMonotoneX)(data) ?? ''
	);
	const areaPath = $derived(
		area<{ t: number; v: number }>()
			.x((d) => x(d.t))
			.y0(ih)
			.y1((d) => y(d.v))
			.curve(curveMonotoneX)(data) ?? ''
	);

	const yticks = $derived(y.ticks(5));
	const xticks = $derived(x.ticks(Math.min(6, Math.max(2, Math.floor(iw / 110)))));

	const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const fmtDay = (t: number) => {
		const d = new Date(t);
		return `${MON[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')}`;
	};
	const fmtAxis = (n: number) => {
		const a = Math.abs(n);
		if (a >= 1000) return `${(n / 1000).toFixed(a >= 10000 ? 0 : 1)}k`;
		return n.toFixed(0);
	};

	// running peak → live drawdown for the tooltip
	const peaks = $derived.by(() => {
		let pk = -Infinity;
		return data.map((d) => (pk = Math.max(pk, d.raw)));
	});

	let hover = $state<number | null>(null);
	const hp = $derived(hover != null ? data[hover] : undefined);
	const hpPeak = $derived(hover != null ? (peaks[hover] ?? 0) : 0);
	const bis = bisector((d: { t: number }) => d.t).center;
	function onMove(e: PointerEvent) {
		const r = (e.currentTarget as Element).getBoundingClientRect();
		hover = data.length ? bis(data, +x.invert(e.clientX - r.left)) : null;
	}

	// GSAP draw-in: reveal the plot left→right once.
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
			duration: 1.0,
			ease: 'power2.out',
			onUpdate: () => (clipW = o.w)
		});
		return () => tw.kill();
	});
</script>

<div class="relative" use:resize={(w) => (width = w)} style="height:{height}px">
	{#if points.length === 0}
		<div class="absolute inset-0 grid place-items-center text-sm" style="color:var(--color-muted)">
			No closed trades yet — your equity curve will appear here.
		</div>
	{:else}
		<svg {width} {height} class="block">
			<defs>
				<linearGradient id="eq-{uid}" x1="0" x2="0" y1="0" y2="1">
					<stop offset="0%" stop-color="var(--color-brand)" stop-opacity="0.28" />
					<stop offset="100%" stop-color="var(--color-brand)" stop-opacity="0" />
				</linearGradient>
				<clipPath id="eqclip-{uid}"><rect x="0" y="-20" width={clipW} height={ih + 40} /></clipPath>
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
				{#each xticks as t (+t)}
					<text
						x={x(t)}
						y={ih + 16}
						text-anchor="middle"
						class="mono"
						font-size="10"
						fill="var(--color-faint)">{fmtDay(+t)}</text
					>
				{/each}

				<g clip-path="url(#eqclip-{uid})">
					<path d={areaPath} fill="url(#eq-{uid})" />
					<path
						d={linePath}
						fill="none"
						stroke="var(--color-brand)"
						stroke-width="2"
						stroke-linejoin="round"
					/>
				</g>

				{#if hp}
					<line
						x1={x(hp.t)}
						x2={x(hp.t)}
						y1="0"
						y2={ih}
						stroke="var(--color-surface-3)"
						stroke-width="1"
						stroke-dasharray="3 3"
					/>
					<circle
						cx={x(hp.t)}
						cy={y(hp.v)}
						r="4"
						fill="var(--color-brand)"
						stroke="var(--color-bg)"
						stroke-width="2"
					/>
				{/if}

				<rect
					x="0"
					y="0"
					width={iw}
					height={ih}
					fill="transparent"
					onpointermove={onMove}
					onpointerleave={() => (hover = null)}
					role="presentation"
				/>
			</g>
		</svg>

		{#if hp}
			{@const dd = hp.raw - hpPeak}
			<div
				class="pointer-events-none absolute z-10 rounded-lg border px-3 py-2 text-xs"
				style="left:{Math.min(width - 150, m.left + x(hp.t) + 10)}px; top:{m.top +
					6}px; background:var(--color-bg-2); border-color:var(--color-border); box-shadow:var(--shadow-pop)"
			>
				<div class="mono" style="color:var(--color-faint)">{fmtDay(hp.t)}</div>
				<div class="mono mt-0.5 font-semibold" style="color:var(--color-text)">
					{formatMoney(hp.raw, currency)}
				</div>
				<div
					class="mono mt-0.5"
					style="color:{dd < 0 ? 'var(--color-down)' : 'var(--color-muted)'}"
				>
					DD {formatMoney(dd, currency, { signed: true })}
				</div>
			</div>
		{/if}
	{/if}
</div>
