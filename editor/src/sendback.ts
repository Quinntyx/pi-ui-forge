// Assembling the send-back payload: comments, drawings (viewport crops around
// tldraw shapes), the whole-canvas image (the ONLY inline image — the model
// uses it to see what pages carry markup), and per-page images saved to disk
// with paths in the payload (the model reads them when it wants detail).
//
// Image budget contract:
//   - exactly one capture per page + one whole-canvas capture per round
//   - everything downscaled to ≤1400px and JPEG-encoded by capture.ts
//   - the canvas image is inline; page renders and draw crops are paths only
//
// Performance contract: captures run in parallel with short timeouts — the
// send-back button resolving fast matters more than a perfect crop; a failed
// capture ships as null rather than blocking the round-trip.

import { captureCanvas } from "./capture";
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
	await new Promise<void>((resolve) => {
		img.onload = () => resolve();
		img.onerror = () => resolve();
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
	// crops are small; still JPEG to keep them cheap
	return canvas.toDataURL("image/jpeg", 0.72);
}

function intersectArea(
	a: { x: number; y: number; w: number; h: number },
	b: { x: number; y: number; w: number; h: number },
): number {
	const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
	const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
	return w > 0 && h > 0 ? w * h : 0;
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

function richTextToPlain(value: unknown): string {
	const out: string[] = [];
	const walk = (node: unknown): void => {
		if (!node || typeof node !== "object") return;
		const record = node as { text?: unknown; content?: unknown };
		if (typeof record.text === "string") out.push(record.text);
		if (Array.isArray(record.content)) record.content.forEach(walk);
	};
	walk(value);
	return out.join("");
}

function shapeText(shape: NonNullable<ReturnType<Editor["getShape"]>>): string | undefined {
	try {
		// 'text' and 'note' shapes both store their content in props.richText
		const richText = (shape.props as { richText?: unknown }).richText;
		const text = richTextToPlain(richText);
		return text.trim() !== "" ? text : undefined;
	} catch {
		return undefined;
	}
}

async function collectDrawings(canvasId: string): Promise<ForgeDrawing[]> {
	const editor = editors.get(canvasId);
	if (!editor) return [];
	const capture = await captureCanvas();
	const shapes = [...editor.getCurrentPageShapeIds()]
		.map((id) => editor.getShape(id))
		.filter((s): s is NonNullable<typeof s> => !!s && !isForgeShape(s));

	return Promise.all(
		shapes.map(async (shape) => {
			const bounds = editor.getShapePageBounds(shape.id);
			if (!bounds) return null;
			const rect = { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h };
			let image: string | null = null;
			if (capture) {
				try {
					image = await cropAroundBounds(capture, rect, (p) => {
						const s = editor.pageToScreen(p);
						return { x: s.x, y: s.y };
					});
				} catch {
					image = null;
				}
			}
			const text = shapeText(shape);
			const drawing: ForgeDrawing = {
				canvasId,
				page: nearestPage(editor, rect),
				bounds: rect,
				image,
			};
			if (text !== undefined) drawing.text = text;
			return drawing;
		}),
	).then((d) => d.filter((x): x is ForgeDrawing => x !== null));
}

export async function buildSendBack(reviewId: number, approved: boolean): Promise<SendBackPayload> {
	const state = getState();
	const comments = state.comments
		.filter((c) => c.text.trim() !== "")
		.map((c) => ({ text: c.text, page: c.page, selector: c.selector }));

	const drawingGroups = await Promise.all(state.world.mocks.map((m) => collectDrawings(m.id)));
	const drawings = drawingGroups.flat();

	const canvasImage = await captureCanvas();

	return {
		reviewId,
		picked: state.picked,
		description: state.description,
		comments,
		drawings: drawings.map((d) => ({
			page: d.page,
			image: d.image,
			text: d.text,
		})),
		canvasImage,
		approved,
	};
}
