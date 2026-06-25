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
		BookOpen,
		ShieldCheck,
		NotePencil,
		List
	} from 'phosphor-svelte';

	let { data, children } = $props();

	// Mobile drawer state; auto-closes whenever the route changes.
	let open = $state(false);
	$effect(() => {
		void page.url.pathname;
		open = false;
	});

	const nav = [
		{ href: '/dashboard', label: 'Dashboard', icon: ChartLineUp },
		{ href: '/trades', label: 'Trades', icon: Table },
		{ href: '/calendar', label: 'Calendar', icon: CalendarBlank },
		{ href: '/analytics', label: 'Analytics', icon: ChartBar },
		{ href: '/playbooks', label: 'Playbooks', icon: BookOpen },
		{ href: '/risk', label: 'Risk', icon: ShieldCheck },
		{ href: '/journal', label: 'Journal', icon: NotePencil },
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

<div class="grid min-h-dvh md:grid-cols-[15rem_1fr]">
	<!-- Mobile top bar -->
	<header
		class="flex items-center justify-between border-b p-3 md:hidden"
		style="background:var(--color-surface)"
	>
		<button
			class="btn btn-ghost p-2"
			aria-label="Open menu"
			aria-expanded={open}
			aria-controls="app-sidebar"
			onclick={() => (open = true)}
		>
			<List size={20} />
		</button>
		<a href="/dashboard" class="text-lg font-bold">
			<span style="color:var(--color-brand)">Trade</span><span>X</span>
		</a>
		<a href="/trades/new" class="btn btn-primary p-2" aria-label="New trade">
			<Plus size={16} weight="bold" />
		</a>
	</header>

	<!-- Drawer overlay (mobile only) -->
	{#if open}
		<button
			class="fixed inset-0 z-30 md:hidden"
			style="background:rgba(0,0,0,0.55)"
			aria-label="Close menu"
			onclick={() => (open = false)}
		></button>
	{/if}

	<aside
		id="app-sidebar"
		class="fixed inset-y-0 left-0 z-40 flex w-60 flex-col gap-2 border-r p-4 transition-transform md:static md:z-auto md:w-auto md:translate-x-0 {open
			? 'translate-x-0'
			: '-translate-x-full'} md:translate-x-0"
		style="background:var(--color-surface)"
	>
		<a href="/dashboard" class="mb-4 flex items-center gap-2 px-2 text-xl font-bold">
			<span style="color:var(--color-brand)">Trade</span><span>X</span>
		</a>

		<nav class="flex flex-col gap-1">
			{#each nav as item (item.href)}
				<a
					href={item.href}
					aria-current={isActive(item.href) ? 'page' : undefined}
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

	<main class="overflow-y-auto p-4 md:p-6">
		{@render children()}
	</main>
</div>
