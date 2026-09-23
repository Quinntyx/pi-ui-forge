// Tiny external store (useSyncExternalStore) for editor UI state.

import type { ForgeComment, Phase, World } from "./types";

export interface AppState {
	connected: boolean;
	world: World;
	activeCanvas: string | null;
	mode: "interact" | "annotate";
	pickMode: boolean;
	phase: Phase;
	reviewId: number;
	reviewNote: string | null;
	picked: string[];
	description: string;
	comments: ForgeComment[];
}

let state: AppState = {
	connected: false,
	world: { mocks: [] },
	activeCanvas: null,
	mode: "interact",
	pickMode: false,
	phase: "idle",
	reviewId: 0,
	reviewNote: null,
	picked: [],
	description: "",
	comments: [],
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
