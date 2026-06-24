<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { signOut } from '$lib/auth-client';
	import {
		ChartLineUp,
		Table,
		CalendarBlank,
		UploadSimple,
		Wallet,
		Gear,
		SignOut,
		Plus,
		ChartBar,
		Sparkle,
		BookOpen
	} from 'phosphor-svelte';

	let { data, children } = $props();

	const nav = [
		{ href: '/dashboard', label: 'Dashboard', icon: ChartLineUp },
		{ href: '/trades', label: 'Trades', icon: Table },
		{ href: '/calendar', label: 'Calendar', icon: CalendarBlank },
		{ href: '/analytics', label: 'Analytics', icon: ChartBar },
		{ href: '/playbooks', label: 'Playbooks', icon: BookOpen },
		{ href: '/coach', label: 'AI Coach', icon: Sparkle },
		{ href: '/import', label: 'Import', icon: UploadSimple },
		{ href: '/accounts', label: 'Accounts', icon: Wallet }
	];

	const isActive = (href: string) => page.url.pathname.startsWith(href);

	async function switchAccount(e: Event) {
		const id = (e.currentTarget as HTMLSelectElement).value;
		await goto(`?account=${id}`, { invalidateAll: true });
	}

	async function logout() {
		await signOut();
		await goto('/login');
	}
</script>

<div class="grid min-h-dvh grid-cols-[15rem_1fr]">
	<aside class="flex flex-col gap-2 border-r p-4" style="background:var(--color-surface)">
		<a href="/dashboard" class="mb-4 flex items-center gap-2 px-2 text-xl font-bold">
			<span style="color:var(--color-brand)">Trade</span><span>X</span>
		</a>

		<nav class="flex flex-col gap-1">
			{#each nav as item (item.href)}
				<a
					href={item.href}
					class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
					style={isActive(item.href)
						? 'background:var(--color-surface-2);color:var(--color-text)'
						: 'color:var(--color-muted)'}
				>
					<item.icon size={18} weight={isActive(item.href) ? 'fill' : 'regular'} />
					{item.label}
				</a>
			{/each}
		</nav>

		<a href="/trades/new" class="btn btn-primary mt-2"><Plus size={16} weight="bold" /> New trade</a
		>

		<div class="mt-auto flex flex-col gap-2">
			{#if data.accounts.length > 0}
				<label class="label px-1" for="acct">Account</label>
				<select id="acct" class="input" value={data.accountId} onchange={switchAccount}>
					{#each data.accounts as a (a.id)}
						<option value={a.id}>{a.name}</option>
					{/each}
				</select>
			{/if}
			<a
				href="/settings"
				class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
				style="color:var(--color-muted)"
			>
				<Gear size={18} /> Settings
			</a>
			<button
				class="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm"
				style="color:var(--color-muted)"
				onclick={logout}
			>
				<SignOut size={18} /> Sign out
			</button>
			<div class="truncate px-3 text-xs" style="color:var(--color-muted)">{data.user.email}</div>
		</div>
	</aside>

	<main class="overflow-y-auto p-6">
		{@render children()}
	</main>
</div>
