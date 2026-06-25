<script lang="ts">
	import { arc } from 'd3-shape';
	import { gsap } from 'gsap';
	import { reduced } from '$lib/motion';
	import type { ScoreBreakdown } from '$lib/domain/types';

	let { breakdown }: { breakdown: ScoreBreakdown } = $props();

	const R = 66;
	const RW = 12;
	const A0 = -0.75 * Math.PI;
	const A1 = 0.75 * Math.PI;

	const score = $derived(Math.max(0, Math.min(100, breakdown.score)));
	const color = $derived(
		score >= 70 ? 'var(--color-up)' : score >= 40 ? 'var(--color-gold)' : 'var(--color-down)'
	);

	const track = arc()({ innerRadius: R - RW, outerRadius: R, startAngle: A0, endAngle: A1 }) ?? '';

	let anim = $state(0);
	let shown = $state(false);
	$effect(() => {
		shown = true;
		const target = score;
		if (reduced()) {
			anim = target;
			return;
		}
		const o = { v: 0 };
		const tw = gsap.to(o, {
			v: target,
			duration: 1.2,
			ease: 'power2.out',
			onUpdate: () => (anim = o.v)
		});
		return () => tw.kill();
	});

	const valArc = $derived(
		arc().cornerRadius(RW)({
			innerRadius: R - RW,
			outerRadius: R,
			startAngle: A0,
			endAngle: A0 + (anim / 100) * (A1 - A0)
		}) ?? ''
	);
</script>

<div class="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
	<div class="relative grid shrink-0 place-items-center" style="width:160px;height:150px">
		<svg width="160" height="150" viewBox="-80 -78 160 160">
			<path d={track} fill="var(--color-surface-2)" />
			<path d={valArc} fill={color} />
		</svg>
		<div class="absolute flex flex-col items-center" style="top:38px">
			<div class="text-4xl font-bold tnum" style="color:{color}">{Math.round(anim)}</div>
			<div class="label mt-0.5">Score</div>
		</div>
	</div>

	<div class="flex-1">
		<div class="mb-2 flex items-center justify-between">
			<h3 class="font-semibold">TradeX Score</h3>
			<span class="chip">transparent · 0–100</span>
		</div>
		<div class="flex flex-col gap-1.5">
			{#each breakdown.factors as f, i (f.key)}
				<div class="flex items-center gap-2 text-xs">
					<span class="w-32 shrink-0" style="color:var(--color-muted)">{f.label}</span>
					<div
						class="h-1.5 flex-1 overflow-hidden rounded-full"
						style="background:var(--color-surface-2)"
					>
						<div
							class="h-full rounded-full"
							style="width:{shown
								? f.normalized * 100
								: 0}%;background:{color};transition:width 0.9s cubic-bezier(0.22,1,0.36,1) {i *
								0.05}s"
						></div>
					</div>
					<span class="mono w-14 text-right" style="color:var(--color-muted)">
						{f.points.toFixed(0)}/{f.weight}
					</span>
				</div>
			{/each}
		</div>
	</div>
</div>
