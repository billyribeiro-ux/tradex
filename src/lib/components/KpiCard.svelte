<script lang="ts">
	import { countUp } from '$lib/motion';
	import Sparkline from './Sparkline.svelte';

	type Tone = 'up' | 'down' | 'neutral';
	let {
		label,
		value,
		format = (n: number) => n.toFixed(2),
		tone = 'neutral',
		sub = '',
		delta = null,
		spark = [],
		sparkColor,
		delay = 0
	}: {
		label: string;
		value: number;
		format?: (n: number) => string;
		tone?: Tone;
		sub?: string;
		delta?: string | null;
		spark?: number[];
		sparkColor?: string;
		delay?: number;
	} = $props();

	const color = $derived(
		tone === 'up' ? 'var(--color-up)' : tone === 'down' ? 'var(--color-down)' : 'var(--color-text)'
	);
	const sc = $derived(sparkColor ?? (tone === 'down' ? 'var(--color-down)' : 'var(--color-brand)'));
</script>

<div class="panel flex flex-col gap-2 p-4">
	<div class="flex items-center justify-between">
		<span class="label">{label}</span>
		{#if delta}
			<span class="delta {tone === 'down' ? 'delta-down' : 'delta-up'}">{delta}</span>
		{/if}
	</div>
	<div class="kpi-val tnum" style="color:{color}" use:countUp={{ value, format, delay }}>
		{format(value)}
	</div>
	{#if sub}<div class="text-xs" style="color:var(--color-muted)">{sub}</div>{/if}
	{#if spark.length > 1}
		<div class="mt-auto pt-1"><Sparkline values={spark} color={sc} height={32} /></div>
	{/if}
</div>
