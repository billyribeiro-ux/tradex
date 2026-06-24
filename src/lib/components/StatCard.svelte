<script lang="ts">
	type Tone = 'up' | 'down' | 'neutral';
	let {
		label,
		value,
		sub = '',
		tone = 'neutral'
	}: { label: string; value: string; sub?: string; tone?: Tone } = $props();

	const color = $derived(
		tone === 'up' ? 'var(--color-up)' : tone === 'down' ? 'var(--color-down)' : 'var(--color-text)'
	);
</script>

<div class="card p-4">
	<div class="label">{label}</div>
	<div class="mt-1 text-2xl font-bold" style="color:{color}">{value}</div>
	{#if sub}<div class="mt-1 text-xs" style="color:var(--color-muted)">{sub}</div>{/if}
</div>
