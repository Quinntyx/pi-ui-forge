// Bundle-hash tracking: when the server pushes a world update, the per-page
// bundle hashes land in app state. Mock-page frames embed their page's hash
// in the iframe src (`?v=<hash>`), so a changed hash changes the src and the
// iframe navigates to the freshly built bundle — revisions actually appear.
//
// (The previous DOM-walking `contentWindow.location.reload()` approach raced
// the React commit that applies the new world and never touched the src, so
// stale frames could survive a revision.)

import { useSyncExternalStore } from "react";
import { getState, setState, subscribe } from "./store";

/** Merge server-pushed bundle hashes into app state. Call together with
 * applyWorld (both setState calls batch into one React commit, so frames are
 * always created with the hash they were built with). */
export function applyPageHashes(hashes: Record<string, string> | undefined): void {
	if (!hashes) return;
	const current = getState().hashes;
	let changed = false;
	for (const [page, hash] of Object.entries(hashes)) {
		if (current[page] !== hash) {
			changed = true;
			break;
		}
	}
	if (!changed) return;
	setState({ hashes: { ...current, ...hashes } });
}

export function currentHashes(): Record<string, string> {
	return getState().hashes;
}

/** Reactive per-page bundle hash ("" when unknown). */
export function usePageHash(page: string): string {
	return useSyncExternalStore(subscribe, () => getState().hashes[page] ?? "");
}
