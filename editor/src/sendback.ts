// Assembling the send-back payload: comments, drawings (viewport crops around
// tldraw shapes), whole-canvas image, per-page images.

import { captureCanvas, capturePages } from "./capture";
import { editors } from "./canvas";
import type { Editor } from "tldraw";
import { isForgeShape } from "./shapes";
import { getState } from "./store";
import type { ForgeDrawing, SendBackPayload } from "./types";

async function cropAroundBounds(
	capture: string,
	bounds: { x: number; y: number; w: number; h: number },
	pageToScreen: (p: { x: number; y: number }) => { x: number; y: number },
): Promise<string | null> {
	const img = new Image();
	await new Promise<void>((resolve, reject) => {
		img.onload = () => resolve();
		img.onerror = reject;
		img.src = capture;
	});
	const pad = 24;
	const tl = pageToScreen({ x: bounds.x - pad, y: bounds.y - pad });
	const br = pageToScreen({ x: bounds.x + bounds.w + pad, y: bounds.y + bounds.h + pad });
	const dpr = window.devicePixelRatio || 1;
	const sx = Math.max(0, Math.round(tl.x * dpr));
	const sy = Math.max(0, Math.round(tl.y * dpr));
	const sw = Math.max(1, Math.round((br.x - tl.x) * dpr));
	const sh = Math.max(1, Math.round((br.y - tl.y) * dpr));
	if (sx >= img.naturalWidth || sy >= img.naturalHeight) return null;
	const canvas = document.createElement("canvas");
	canvas.width = Math.min(sw, img.naturalWidth - sx);
	canvas.height = Math.min(sh, img.naturalHeight - sy);
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;
	ctx.drawImage(img, sx, sy, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
	return canvas.toDataURL("image/png");
}

function intersectArea(
	a: { x: number; y: number; w: number; h: number },
	b: { x: number; y: number; w: number; h: number },
): number {
	const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
	const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
	return w > 0 && h > 0 ? w * h : 0;
}

function centerDist(
	a: { x: number; y: number; w: number; h: number },
	b: { x: number; y: number; w: number; h: number },
): number {
	return Math.hypot(a.x + a.w / 2 - (b.x + b.w / 2), a.y + a.h / 2 - (b.y + b.h / 2));
}

/** Nearest frame page for a shape: most overlap, else nearest center. */
function nearestPage(editor: Editor, bounds: { x: number; y: number; w: number; h: number }): string | null {
	let best: { page: string; overlap: number; dist: number } | null = null;
	for (const id of editor.getCurrentPageShapeIds()) {
		const shape = editor.getShape(id);
		if (!shape || shape.type !== "mock-page") continue;
		const b = editor.getShapePageBounds(shape.id);
		if (!b) continue;
		const overlap = intersectArea(bounds, { x: b.x, y: b.y, w: b.w, h: b.h });
		const dist = Math.hypot(
			bounds.x + bounds.w / 2 - (b.x + b.w / 2),
			bounds.y + bounds.h / 2 - (b.y + b.h / 2),
		);
		if (!best || overlap > best.overlap || (overlap === best.overlap && dist < best.dist)) {
			best = { page: (shape.props as { page: string }).page, overlap, dist };
		}
	}
	return best?.page ?? null;
}

async function collectDrawings(canvasId: string): Promise<ForgeDrawing[]> {
	const editor = editors.get(canvasId);
	if (!editor) return [];
	const capture = await captureCanvas();
	const pageToScreen = (p: { x: number; y: number }) => {
		const s = editor.pageToScreen(p);
		return { x: s.x, y: s.y };
	};
	const drawings: ForgeDrawing[] = [];
	for (const id of editor.getCurrentPageShapeIds()) {
		const shape = editor.getShape(id);
		if (!shape || isForgeShape(shape)) continue;
		const bounds = editor.getShapePageBounds(id);
		if (!bounds) continue;
		let image: string | null = null;
		if (capture) {
			try {
				image = await cropAroundBounds(
					capture,
					{ x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h },
					pageToScreen,
				);
			} catch {
				image = null;
			}
		}
		const text = shape.type === "text" ? "text-note" : undefined;
		drawings.push({
			canvasId,
			page: nearestPage(editor, { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h }),
			bounds: { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h },
			text,
			image,
		});
	}
	return drawings;
}

export async function buildSendBack(reviewId: number, approved: boolean): Promise<SendBackPayload> {
	const state = getState();
	const comments = state.comments
		.filter((c) => c.text.trim() !== "")
		.map((c) => ({ text: c.text, page: c.page, selector: c.selector }));

	const drawings: ForgeDrawing[] = [];
	for (const mock of state.world.mocks) {
		for (const d of await collectDrawings(mock.id)) drawings.push(d);
	}

	const pageImages = await capturePages(state.picked.length ? state.picked : null);
	const canvasImage = await captureCanvas();

	return {
		reviewId,
		picked: state.picked,
		description: state.description,
		comments,
		drawings: drawings.map((d) => ({ page: d.page, image: d.image, text: d.text })),
		canvasImage,
		pageImages,
		approved,
	};
}

/** Capture clean page renders (used by the server's screenshot requests). */
export async function requestPageShots(pages: string[] | null) {
	return capturePages(pages);
}
