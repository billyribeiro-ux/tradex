<script lang="ts">
	import type { CalendarDay } from '$lib/server/services/analytics';
	import { formatMoney } from '$lib/money';

	let {
		days,
		weeks = 18,
		endDate
	}: { days: CalendarDay[]; weeks?: number; endDate?: string } = $props();

	const byDate = $derived(new Map(days.map((d) => [d.date, d])));
	const maxAbs = $derived(Math.max(1, ...days.map((d) => Math.abs(d.netPnl))));

	// Build a grid of `weeks` columns x 7 rows ending on the latest activity day.
	const grid = $derived.by(() => {
		const last = endDate ?? days.at(-1)?.date ?? new Date().toISOString().slice(0, 10);
		const end = new Date(last + 'T00:00:00Z');
		end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay())); // align to end-of-week
		const start = new Date(end);
		start.setUTCDate(start.getUTCDate() - (weeks * 7 - 1));

		const cols: { date: string; day: CalendarDay | undefined }[][] = [];
		const cursor = new Date(start);
		for (let w = 0; w < weeks; w++) {
			const col: { date: string; day: CalendarDay | undefined }[] = [];
			for (let d = 0; d < 7; d++) {
				const date = cursor.toISOString().slice(0, 10);
				col.push({ date, day: byDate.get(date) });
				cursor.setUTCDate(cursor.getUTCDate() + 1);
			}
			cols.push(col);
		}
		return cols;
	});

	function cellColor(day: CalendarDay | undefined): string {
		if (!day || day.netPnl === 0) return 'var(--color-surface-2)';
		const intensity = 0.3 + 0.7 * Math.min(1, Math.abs(day.netPnl) / maxAbs);
		const base = day.netPnl > 0 ? '22,199,132' : '234,57,67';
		return `rgba(${base},${intensity.toFixed(2)})`;
	}
</script>

<div class="card p-5">
	<div class="mb-3 flex items-center justify-between">
		<h3 class="font-semibold">P&L Calendar</h3>
		<span class="text-xs" style="color:var(--color-muted)">last {weeks} weeks</span>
	</div>
	<div class="flex gap-[3px] overflow-x-auto">
		{#each grid as col, i (i)}
			<div class="flex flex-col gap-[3px]">
				{#each col as cell (cell.date)}
					<div
						class="h-3 w-3 rounded-[3px]"
						style="background:{cellColor(cell.day)}"
						title={cell.day
							? `${cell.date}: ${formatMoney(cell.day.netPnl, 'USD', { signed: true })} · ${cell.day.trades} trade${cell.day.trades === 1 ? '' : 's'}`
							: cell.date}
					></div>
				{/each}
			</div>
		{/each}
	</div>
	<div class="mt-3 flex items-center gap-2 text-xs" style="color:var(--color-muted)">
		<span>Loss</span>
		<div class="h-3 w-3 rounded-[3px]" style="background:rgba(234,57,67,0.9)"></div>
		<div class="h-3 w-3 rounded-[3px]" style="background:var(--color-surface-2)"></div>
		<div class="h-3 w-3 rounded-[3px]" style="background:rgba(22,199,132,0.9)"></div>
		<span>Profit</span>
		{#if days.length}
			<span class="ml-auto"
				>Best day {formatMoney(Math.max(0, ...days.map((d) => d.netPnl)), 'USD')} · worst
				{formatMoney(Math.min(0, ...days.map((d) => d.netPnl)), 'USD')}</span
			>
		{/if}
	</div>
</div>
