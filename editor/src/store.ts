// Tiny external store (useSyncExternalStore) for editor UI state.

import type { AgentActivity, ForgeComment, Phase, World } from "./types";

export interface PopupState {
	commentId: string;
	/** page-space position of the pin (converted to screen when rendered) */
	x: number;
	y: number;
}

export interface AppState {
	connected: boolean;
	world: World;
	activeCanvas: string | null;
	/** canvas committed by the user via the design-options strip (hides the rest) */
	committedCanvas: string | null;
	mode: "interact" | "annotate";
	pickMode: boolean;
	/** bundle hash per page name (server-pushed) — mock-page iframes embed it
	 * in their src (?v=…) so a changed hash reloads the page */
	hashes: Record<string, string>;
	phase: Phase;
	reviewId: number;
	reviewNote: string | null;
	picked: string[];
	description: string;
	comments: ForgeComment[];
	/** popup comment editor anchored at a picked element */
	popup: PopupState | null;
	/** live agent activity from pi-tool-tree (label, phase, running calls) */
	activity: AgentActivity | null;
	/** wall-clock ms timestamp when the current working stretch began (null while the agent is blocked in review) */
	workStartedAt: number | null;
	theme: "light" | "dark";
}

let state: AppState = {
	connected: false,
	world: { mocks: [] },
	activeCanvas: null,
	committedCanvas: null,
	mode: "interact",
	pickMode: false,
	hashes: {},
	phase: "idle",
	reviewId: 0,
	reviewNote: null,
	picked: [],
	description: "",
	comments: [],
	popup: null,
	activity: null,
	workStartedAt: null,
	theme: "light",
};

const listeners = new Set<() => void>();

export function getState(): AppState {
	return state;
}

export function setState(patch: Partial<AppState>): void {
	state = { ...state, ...patch };
	for (const l of listeners) l();
}

export function subscribe(l: () => void): () => void {
	listeners.add(l);
	return () => listeners.delete(l);
}

// Hook (avoids importing react here — callers wrap with useSyncExternalStore)
export { useSyncState } from "./useSyncState";

export function token(): string {
	const params = new URLSearchParams(window.location.search);
	return params.get("token") ?? "";
}

let nextId = 1;
export function newId(prefix: string): string {
	return `${prefix}-${Date.now().toString(36)}-${nextId++}`;
}
