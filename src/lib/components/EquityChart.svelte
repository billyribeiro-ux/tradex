<script lang="ts">
	import { fromScaled } from '$lib/money';
	import type { EquityPoint } from '$lib/domain/metrics';
	import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';

	let { points }: { points: EquityPoint[] } = $props();

	let el: HTMLDivElement;
	let chart: IChartApi | undefined;
	let series: ISeriesApi<'Area'> | undefined;
	let ready = $state(false);

	function toSeries(pts: EquityPoint[]) {
		let prev = 0;
		return pts.map((p) => {
			let t = Math.floor(p.t / 1000);
			if (t <= prev) t = prev + 1; // lightweight-charts requires strictly ascending times
			prev = t;
			return { time: t as UTCTimestamp, value: fromScaled(p.equity) };
		});
	}

	// Create the chart once (browser only), tear it down on destroy.
	$effect(() => {
		let cancelled = false;
		import('lightweight-charts').then((lc) => {
			if (cancelled || !el) return;
			chart = lc.createChart(el, {
				autoSize: true,
				layout: {
					background: { color: 'transparent' },
					textColor: '#8a96ac',
					fontFamily: 'Inter, system-ui, sans-serif'
				},
				grid: {
					vertLines: { color: 'rgba(39,48,67,0.4)' },
					horzLines: { color: 'rgba(39,48,67,0.4)' }
				},
				rightPriceScale: { borderColor: '#273043' },
				timeScale: { borderColor: '#273043', timeVisible: true }
			});
			series = chart.addSeries(lc.AreaSeries, {
				lineColor: '#14e0a3',
				topColor: 'rgba(20,224,163,0.25)',
				bottomColor: 'rgba(20,224,163,0)',
				lineWidth: 2
			});
			ready = true;
		});
		return () => {
			cancelled = true;
			chart?.remove();
			chart = undefined;
			series = undefined;
			ready = false;
		};
	});

	// Push data whenever the points change (and the chart exists).
	$effect(() => {
		const data = toSeries(points);
		if (ready && series) {
			series.setData(data);
			chart?.timeScale().fitContent();
		}
	});
</script>

<div class="relative">
	<div bind:this={el} class="h-72 w-full"></div>
	{#if points.length === 0}
		<div class="absolute inset-0 grid place-items-center text-sm" style="color:var(--color-muted)">
			No closed trades yet — your equity curve will appear here.
		</div>
	{/if}
</div>
