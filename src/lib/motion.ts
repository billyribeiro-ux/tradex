/**
 * Motion language for TradeX — GSAP-driven Svelte actions.
 *
 * Actions only run in the browser (never during SSR), and every animation is
 * gated on `prefers-reduced-motion`, falling back to the final state instantly.
 */
import { gsap } from 'gsap';
import { browser } from '$app/environment';

export function reduced(): boolean {
	return browser && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export interface CountUpOpts {
	value: number;
	format?: (n: number) => string;
	duration?: number;
	delay?: number;
}

/** Tween an element's text content from 0 → value, reformatting each frame. */
export function countUp(node: HTMLElement, opts: CountUpOpts) {
	const fmt = (n: number) => (opts.format ? opts.format(n) : String(Math.round(n)));
	let current = opts.value;
	const state = { v: 0 };

	function run(from: number, to: number) {
		if (reduced()) {
			node.textContent = fmt(to);
			return;
		}
		state.v = from;
		gsap.to(state, {
			v: to,
			duration: opts.duration ?? 1.1,
			delay: opts.delay ?? 0,
			ease: 'power2.out',
			onUpdate: () => (node.textContent = fmt(state.v))
		});
	}

	run(0, opts.value);

	return {
		update(next: CountUpOpts) {
			if (next.value !== current) {
				run(current, next.value);
				current = next.value;
			}
		},
		destroy() {
			gsap.killTweensOf(state);
		}
	};
}

export interface RevealOpts {
	delay?: number;
	y?: number;
	duration?: number;
}

/** Fade + rise an element into place on mount (staggered via `delay`). */
export function reveal(node: HTMLElement, opts: RevealOpts = {}) {
	if (reduced()) return {};
	gsap.set(node, { autoAlpha: 0, y: opts.y ?? 16 });
	const tween = gsap.to(node, {
		autoAlpha: 1,
		y: 0,
		duration: opts.duration ?? 0.6,
		delay: opts.delay ?? 0,
		ease: 'power3.out'
	});
	return {
		destroy() {
			tween.kill();
		}
	};
}

/** Reveal each direct child of a container with a stagger. */
export function revealChildren(node: HTMLElement, step = 0.06) {
	if (reduced()) return {};
	const kids = Array.from(node.children) as HTMLElement[];
	gsap.set(kids, { autoAlpha: 0, y: 16 });
	const tween = gsap.to(kids, {
		autoAlpha: 1,
		y: 0,
		duration: 0.6,
		ease: 'power3.out',
		stagger: step
	});
	return {
		destroy() {
			tween.kill();
		}
	};
}
