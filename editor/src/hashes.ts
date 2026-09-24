// Bundle-hash tracking: when the server pushes a world update, iframes whose
// page bundle hash changed are reloaded so revisions actually appear.

let lastHashes: Record<string, string> = {};

/**
 * Reload iframes for pages whose bundle hash changed. Call AFTER the world
 * shapes have been reconciled (newly created frames load fresh anyway).
 */
export function applyPageHashes(hashes: Record<string, string> | undefined): void {
	if (!hashes) return;
	for (const iframe of Array.from(document.querySelectorAll("iframe[data-forge-page]"))) {
		const page = iframe.getAttribute("data-forge-page")!;
		const next = hashes[page];
		if (!next || next === lastHashes[page]) continue;
		try {
			(iframe as HTMLIFrameElement).contentWindow?.location.reload();
		} catch {
			// not loadable yet — fresh frames pick the new bundle on first load
		}
	}
	lastHashes = { ...lastHashes, ...hashes };
}

export function currentHashes(): Record<string, string> {
	return lastHashes;
}
