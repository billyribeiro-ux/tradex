<script lang="ts">
	import { onMount } from 'svelte';
	import { Canvas } from '@threlte/core';
	import HeroScene from './HeroScene.svelte';

	// Mount the WebGL canvas client-only; a CSS gradient stands in during SSR
	// and on devices without WebGL, so the hero never renders blank.
	let mounted = $state(false);
	onMount(() => (mounted = true));
</script>

<div class="absolute inset-0 overflow-hidden">
	<div class="fallback"></div>
	{#if mounted}
		<div class="canvas-wrap">
			<Canvas>
				<HeroScene />
			</Canvas>
		</div>
	{/if}
</div>

<style>
	.fallback {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(60% 50% at 70% 20%, rgba(20, 224, 163, 0.16), transparent 70%),
			radial-gradient(50% 60% at 20% 10%, rgba(108, 140, 255, 0.1), transparent 70%);
	}
	.canvas-wrap {
		position: absolute;
		inset: 0;
		animation: fade 1.2s ease both;
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.canvas-wrap {
			animation: none;
		}
	}
</style>
