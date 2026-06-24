/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `tradex-cache-${version}`;
// Precache the app shell (built JS/CSS) and static files (icon, manifest).
const PRECACHE = [...build, ...files];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(PRECACHE))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	const url = new URL(event.request.url);
	if (url.origin !== location.origin) return;

	// Only serve cached app-shell assets offline; never cache HTML/API (auth-sensitive).
	const isAsset = PRECACHE.includes(url.pathname) || url.pathname.startsWith('/_app/');
	if (!isAsset) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			const cached = await cache.match(event.request);
			if (cached) return cached;
			try {
				const res = await fetch(event.request);
				if (res.ok) cache.put(event.request, res.clone());
				return res;
			} catch (err) {
				if (cached) return cached;
				throw err;
			}
		})()
	);
});
