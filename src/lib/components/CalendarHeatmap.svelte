<script lang="ts">
	import type { CalendarDay } from '$lib/server/services/analytics';
	import { formatMoney } from '$lib/money';

	let {
		days,
		weeks = 18,
		endDate,
		currency = 'USD'
	}: { days: CalendarDay[]; weeks?: number; endDate?: string; currency?: string } = $props();

	const CELL = 15;
	const GAP = 3;
	const STEP = CELL + GAP;
	const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	const byDate = $derived(new Map(days.map((d) => [d.date, d])));
	const maxAbs = $derived(Math.max(1, ...days.map((d) => Math.abs(d.netPnl))));

	const grid = $derived.by(() => {
		const last = endDate ?? days.at(-1)?.date ?? new Date().toISOString().slice(0, 10);
		const end = new Date(last + 'T00:00:00Z');
		end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));
		const start = new Date(end);
		start.setUTCDate(start.getUTCDate() - (weeks * 7 - 1));

		const cols: { date: string; day: CalendarDay | undefined; month: number }[][] = [];
		const cursor = new Date(start);
		for (let w = 0; w < weeks; w++) {
			const col: { date: string; day: CalendarDay | undefined; month: number }[] = [];
			for (let d = 0; d < 7; d++) {
				const date = cursor.toISOString().slice(0, 10);
				col.push({ date, day: byDate.get(date), month: cursor.getUTCMonth() });
				cursor.setUTCDate(cursor.getUTCDate() + 1);
			}
			cols.push(col);
		}
		return cols;
	});

	const monthLabels = $derived(
		grid.map((col, i) => {
			const mth = col[0]?.month ?? 0;
			const prev = i > 0 ? (grid[i - 1]?.[0]?.month ?? -1) : -1;
			return mth !== prev ? MON[mth] : '';
		})
	);

	function cellColor(day: CalendarDay | undefined): string {
		if (!day || day.netPnl === 0) return 'var(--color-surface-2)';
		const intensity = 0.25 + 0.75 * Math.sqrt(Math.min(1, Math.abs(day.netPnl) / maxAbs));
		const base = day.netPnl > 0 ? '31,207,131' : '246,70,93';
		return `rgba(${base},${intensity.toFixed(2)})`;
	}

	let tip = $state<{ col: number; row: number; day: CalendarDay | undefined; date: string } | null>(
		null
	);
	const best = $derived(Math.max(0, ...days.map((d) => d.netPnl)));
	const worst = $derived(Math.min(0, ...days.map((d) => d.netPnl)));
</script>

<div class="panel p-5">
	<div class="mb-3 flex items-center justify-between">
		<h3 class="font-semibold">P&L Calendar</h3>
		<span class="chip">last {weeks} weeks</span>
	</div>

	<div class="relative overflow-x-auto">
		<div class="flex" style="gap:{GAP}px">
			{#each monthLabels as label, i (i)}
				<div class="mono" style="width:{CELL}px;font-size:9px;color:var(--color-faint)">
					{label}
				</div>
			{/each}
		</div>

		<div class="mt-1 flex" style="gap:{GAP}px">
			{#each grid as col, ci (ci)}
				<div class="flex flex-col" style="gap:{GAP}px">
					{#each col as cell, ri (cell.date)}
						<div
							role="presentation"
							class="rounded-[3px] transition-transform duration-100 hover:scale-125"
							style="width:{CELL}px;height:{CELL}px;background:{cellColor(cell.day)};outline:{tip &&
							tip.col === ci &&
							tip.row === ri
								? '1px solid var(--color-text)'
								: 'none'}"
							onpointerenter={() => (tip = { col: ci, row: ri, day: cell.day, date: cell.date })}
							onpointerleave={() => (tip = null)}
						></div>
					{/each}
				</div>
			{/each}
		</div>

		{#if tip}
			<div
				class="pointer-events-none absolute z-10 rounded-lg border px-2.5 py-1.5 text-xs"
				style="left:{Math.min(tip.col * STEP + 18, weeks * STEP - 130)}px;top:{tip.row * STEP +
					18}px;background:var(--color-bg-2);border-color:var(--color-border);box-shadow:var(--shadow-pop)"
			>
				<div class="mono" style="color:var(--color-faint)">{tip.date}</div>
				{#if tip.day}
					<div
						class="mono font-semibold"
						style="color:{tip.day.netPnl >= 0 ? 'var(--color-up)' : 'var(--color-down)'}"
					>
						{formatMoney(tip.day.netPnl, currency, { signed: true })}
					</div>
					<div class="mono" style="color:var(--color-muted)">
						{tip.day.trades} trade{tip.day.trades === 1 ? '' : 's'}
					</div>
				{:else}
					<div class="mono" style="color:var(--color-faint)">no trades</div>
				{/if}
			</div>
		{/if}
	</div>

	<div class="mt-3 flex items-center gap-2 text-xs" style="color:var(--color-muted)">
		<span>Loss</span>
		<div class="h-3 w-3 rounded-[3px]" style="background:rgba(246,70,93,0.9)"></div>
		<div class="h-3 w-3 rounded-[3px]" style="background:var(--color-surface-2)"></div>
		<div class="h-3 w-3 rounded-[3px]" style="background:rgba(31,207,131,0.9)"></div>
		<span>Profit</span>
		{#if days.length}
			<span class="mono ml-auto" style="color:var(--color-faint)">
				best {formatMoney(best, currency)} · worst {formatMoney(worst, currency)}
			</span>
		{/if}
	</div>
</div>
