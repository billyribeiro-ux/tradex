<script lang="ts">
	import { enhance } from '$app/forms';
	import { reveal } from '$lib/motion';
	import type { CategoryItem } from '$lib/server/services/categorization';

	let { data } = $props();

	const confirmDelete = (noun: string, name: string) => (e: SubmitEvent) => {
		if (!confirm(`Delete "${name}"? It will be removed from every trade. This cannot be undone.`))
			e.preventDefault();
	};
</script>

<svelte:head><title>Categories · TradeX</title></svelte:head>

<header class="mb-5">
	<a href="/settings" class="text-sm" style="color:var(--color-muted)">← Settings</a>
	<h1 class="mt-1 text-2xl font-bold">Tags, setups & emotions</h1>
	<p class="text-sm" style="color:var(--color-muted)">
		Rename to fix typos or merge duplicates (rename onto an existing name to merge), or delete what
		you no longer use. Changes apply across every trade.
	</p>
</header>

{#snippet section(
	title: string,
	noun: string,
	items: CategoryItem[],
	renameAction: string,
	deleteAction: string
)}
	<div class="panel" use:reveal>
		<div class="panel-h">
			<span class="panel-t">{title}</span>
			<span class="chip">{items.length}</span>
		</div>
		<div class="flex flex-col">
			{#if items.length === 0}
				<p class="p-5 text-sm" style="color:var(--color-muted)">
					No {noun} yet — they're created as you tag trades.
				</p>
			{:else}
				{#each items as it (it.id)}
					<div
						class="flex items-center gap-2 border-t px-3 py-2 first:border-t-0"
						style="border-color:var(--color-hairline)"
					>
						<form
							method="POST"
							action="?/{renameAction}"
							use:enhance
							class="flex flex-1 items-center gap-2"
						>
							<input type="hidden" name="id" value={it.id} />
							<input
								name="name"
								class="input flex-1 py-1 text-sm"
								value={it.name}
								aria-label="Name"
							/>
							<button type="submit" class="btn btn-ghost text-xs">Save</button>
						</form>
						<span class="chip shrink-0" title="trades using this">
							{it.count} trade{it.count === 1 ? '' : 's'}
						</span>
						<form
							method="POST"
							action="?/{deleteAction}"
							use:enhance
							onsubmit={confirmDelete(noun, it.name)}
						>
							<input type="hidden" name="id" value={it.id} />
							<button type="submit" class="btn btn-ghost text-xs" style="color:var(--color-down)">
								Delete
							</button>
						</form>
					</div>
				{/each}
			{/if}
		</div>
	</div>
{/snippet}

<div class="grid gap-4 lg:grid-cols-3">
	{@render section('Tags', 'tags', data.tags, 'renameTag', 'deleteTag')}
	{@render section('Setups', 'setups', data.setups, 'renameSetup', 'deleteSetup')}
	{@render section('Emotions', 'emotions', data.emotions, 'renameEmotion', 'deleteEmotion')}
</div>
