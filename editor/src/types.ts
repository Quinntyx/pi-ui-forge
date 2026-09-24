// Shared types for the editor UI (kept standalone — the server side is TS in
// the extension root and must not be imported into the Vite build).

export interface WorldMock {
	id: string;
	label: string;
	pages: string[];
}

export interface World {
	mocks: WorldMock[];
}

export interface ForgeComment {
	id: string;
	text: string;
	page: string | null;
	selector: string | null;
	canvasId: string;
	// page-space position of the pin (for restore/debug only)
	x: number;
	y: number;
}

export interface ForgeDrawing {
	canvasId: string;
	page: string | null;
	bounds: { x: number; y: number; w: number; h: number };
	text?: string;
	// cropped viewport image around the drawing (viewport capture basis)
	image: string | null;
	skipped?: boolean;
}

export interface SendBackPayload {
	reviewId: number;
	picked: string[];
	description: string;
	comments: {
		text: string;
		page: string | null;
		selector: string | null;
	}[];
	drawings: {
		page: string | null;
		image: string | null;
		text?: string;
	}[];
	canvasImage: string | null;
	pageImages: { page: string; image: string }[];
	approved: boolean;
}

// --- WS messages -----------------------------------------------------------

export type HostToEditor =
	| { type: "init"; world: World; hashes: Record<string, string>; phase: Phase; reviewId: number; note: string | null }
	| { type: "set-world"; world: World; hashes: Record<string, string> }
	| { type: "review-start"; reviewId: number; note: string | null }
	| { type: "review-end" }
	| { type: "session-closed" }
	| { type: "page-shot-request"; reqId: string; pages: string[] | null }
	| { type: "pick"; on: boolean }
	| { type: "shell-capture-result" | "forge:capture-result"; reqId: string; dataUrl: string | null }
	| { type: "page-shot-result"; reqId: string; shots: { page: string; image: string }[] };

export type EditorToHost =
	| { type: "hello" }
	| { type: "send-back"; reviewId: number; approved: boolean; payload: SendBackPayload }
	| { type: "capture-request"; reqId: string }
	| { type: "page-shot-result"; reqId: string; shots: { page: string; image: string }[] };

export type Phase = "idle" | "review" | "closed";
