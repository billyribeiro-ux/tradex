/** Svelte action: report a node's content-box size via ResizeObserver. */
export function resize(node: HTMLElement, cb: (w: number, h: number) => void) {
	const ro = new ResizeObserver((entries) => {
		for (const e of entries) cb(e.contentRect.width, e.contentRect.height);
	});
	ro.observe(node);
	cb(node.clientWidth, node.clientHeight);
	return { destroy: () => ro.disconnect() };
}
