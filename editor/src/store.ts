// Tiny external store (useSyncExternalStore) for editor UI state.

import type { AgentActivity, ForgeComment, PasteImage, Phase, World } from "./types";

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
	/** live agent activity from pi-activity (label, phase, running calls) */
	activity: AgentActivity | null;
	/** reference images the user pasted or dropped, kept across review rounds */
	pasted: PasteImage[];
	/** wall-clock ms timestamp when the current working stretch began (null while the agent is blocked in review) */
	workStartedAt: number | null;
	theme: "light" | "dark";
}

/** Reference images outlive an editor reload (the canvas shapes do — they live
 *  in tldraw's IndexedDB store), so they ride along in sessionStorage.
 *  Declared above the initial state: the initializer reads it. */
const PASTED_KEY = "forge:pasted";

function loadPasted(): PasteImage[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = sessionStorage.getItem(PASTED_KEY);
		const parsed = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed) ? parsed.filter((p) => typeof p?.dataUrl === "string") : [];
	} catch {
		return [];
	}
}

function savePasted(pasted: PasteImage[]): void {
	try {
		sessionStorage.setItem(PASTED_KEY, JSON.stringify(pasted));
	} catch {
		// quota/private mode: the session still works, reloads just forget the references
	}
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
	pasted: loadPasted(),
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

/**
 * Record a pasted/dropped image from the clipboard bytes themselves.
 *
 * Deliberately not read back out of tldraw: the canvas only holds an asset id
 * whose bytes live in IndexedDB, and the model needs the exact file the user
 * pasted (asset round-trips lose it when the asset store can't load).
 */
export function addPastedImage(dataUrl: string, page: string | null): void {
	if (!dataUrl.startsWith("data:image/")) return;
	if (state.pasted.some((p) => p.dataUrl === dataUrl)) return;
	const pasted = [...state.pasted, { page, dataUrl }];
	savePasted(pasted);
	setState({ pasted });
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
