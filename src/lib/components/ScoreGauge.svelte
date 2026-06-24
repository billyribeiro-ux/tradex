<script lang="ts">
	import type { ScoreBreakdown } from '$lib/domain/types';

	let { breakdown }: { breakdown: ScoreBreakdown } = $props();

	const R = 52;
	const C = 2 * Math.PI * R;
	const pct = $derived(Math.max(0, Math.min(100, breakdown.score)) / 100);
	const color = $derived(
		breakdown.score >= 70
			? 'var(--color-up)'
			: breakdown.score >= 40
				? '#e0a814'
				: 'var(--color-down)'
	);
</script>

<div class="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
	<div class="relative grid shrink-0 place-items-center" style="width:140px;height:140px">
		<svg width="140" height="140" viewBox="0 0 140 140" class="-rotate-90">
			<circle cx="70" cy="70" r={R} fill="none" stroke="var(--color-surface-2)" stroke-width="12" />
			<circle
				cx="70"
				cy="70"
				r={R}
				fill="none"
				stroke={color}
				stroke-width="12"
				stroke-linecap="round"
				stroke-dasharray={C}
				stroke-dashoffset={C * (1 - pct)}
			/>
		</svg>
		<div class="absolute text-center">
			<div class="text-3xl font-bold" style="color:{color}">{breakdown.score}</div>
			<div class="label">Score</div>
		</div>
	</div>

	<div class="flex-1">
		<div class="mb-2 flex items-center justify-between">
			<h3 class="font-semibold">TradeX Score</h3>
			<span class="text-xs" style="color:var(--color-muted)">transparent · 0–100</span>
		</div>
		<div class="flex flex-col gap-1.5">
			{#each breakdown.factors as f (f.key)}
				<div class="flex items-center gap-2 text-xs">
					<span class="w-32 shrink-0" style="color:var(--color-muted)">{f.label}</span>
					<div
						class="h-1.5 flex-1 overflow-hidden rounded-full"
						style="background:var(--color-surface-2)"
					>
						<div
							class="h-full rounded-full"
							style="width:{f.normalized * 100}%;background:{color}"
						></div>
					</div>
					<span class="w-14 text-right tabular-nums" style="color:var(--color-muted)">
						{f.points.toFixed(0)}/{f.weight}
					</span>
				</div>
			{/each}
		</div>
	</div>
</div>
