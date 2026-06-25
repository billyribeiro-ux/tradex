<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	// Hydration beacon: runs only on the client, once the app is interactive.
	// Progressive-enhancement forms (use:enhance) only intercept submits after
	// hydration, so e2e waits for [data-hydrated] before clicking to avoid the
	// lost-click race where a submit lands mid-DOM-swap.
	$effect(() => {
		document.documentElement.dataset.hydrated = '1';
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
