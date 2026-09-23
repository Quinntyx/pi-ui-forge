// MockCanvas: one tldraw canvas per mock (tab). Frames reconcile to the world
// state with stable shape ids per (canvas, page) so annotations survive
// rebuilds. Editors are registered in a module map for cross-cutting actions
// (picks, exports, captures).

import { useEffect, useRef } from "react";
import { Tldraw, createShapeId, track, useEditor, type Editor } from "tldraw";
import type { WorldMock } from "./types";
import { CommentPinShapeUtil, MockPageShapeUtil } from "./shapes";
import "./canvas.css";

export const FRAME_W = 1280;
export const FRAME_H = 800;
const GAP = 96;

export const editors = new Map<string, Editor>();

export function frameShapeId(canvasId: string, page: string) {
	const safe = page.replace(/[^A-Za-z0-9_-]/g, "_");
	return createShapeId(`forge-${canvasId}-${safe}`);
}

export function pinShapeId(commentId: string) {
	return createShapeId(`forge-pin-${commentId}`);
}

export function framePosition(index: number) {
	return { x: index * (FRAME_W + GAP), y: 0 };
}

function syncFrames(editor: Editor, mock: WorldMock) {
	const existing = [...editor.getCurrentPageShapeIds()]
		.map((id) => editor.getShape(id))
		.filter((s): s is NonNullable<typeof s> => !!s && s.type === "mock-page");
	const byPage = new Map(existing.map((s) => [(s.props as { page: string }).page, s] as const));

	const updates: Parameters<Editor["updateShape"]>[0][] = [];
	const creations: Parameters<Editor["createShapes"]>[0] = [];
	const seen = new Set<string>();

	mock.pages.forEach((page, i) => {
		seen.add(page);
		const { x, y } = framePosition(i);
		const current = byPage.get(page);
		if (current) {
			if (current.x !== x || current.y !== y) {
				updates.push({ id: current.id, type: current.type, x, y });
			}
		} else {
			creations.push({
				id: frameShapeId(mock.id, page),
				type: "mock-page",
				x,
				y,
				props: { page, w: FRAME_W, h: FRAME_H, canvasId: mock.id },
			});
		}
	});
	for (const s of existing) {
		if (!seen.has((s.props as { page: string }).page)) editor.deleteShape(s.id);
	}
	if (creations.length) editor.createShapes(creations);
	if (updates.length) for (const u of updates) editor.updateShape(u);
}

const FrameSync = track(function FrameSync({ mock }: { mock: WorldMock }) {
	const editor = useEditor();
	const lastPages = useRef("");
	const key = mock.pages.join(",");
	if (lastPages.current !== key) {
		lastPages.current = key;
		syncFrames(editor, mock);
	}
	return null;
});

function MockCanvasInner({ mock }: { mock: WorldMock }) {
	return (
		<Tldraw
			shapeUtils={[MockPageShapeUtil, CommentPinShapeUtil]}
			persistenceKey={`forge-${mock.id}`}
			onMount={(editor) => {
				editors.set(mock.id, editor);
				return () => {
					editors.delete(mock.id);
				};
			}}
		>
			<FrameSync mock={mock} />
		</Tldraw>
	);
}

export function MockCanvas({ mock, active }: { mock: WorldMock; active: boolean }) {
	return (
		<div
			className="canvas-host"
			data-canvas-id={mock.id}
			style={{ position: "absolute", inset: 0, visibility: active ? "visible" : "hidden" }}
		>
			<MockCanvasInner mock={mock} />
		</div>
	);
}

/** Pick plumbing: forwarded iframe clicks become comment pins. */
export function usePickListener(onPick: (msg: PickMessage) => void) {
	useEffect(() => {
		const handler = (event: MessageEvent) => {
			const data = event.data as PickMessage;
			if (!data || data.source !== "forge-iframe" || data.type !== "forge:pick") return;
			onPick(data);
		};
		window.addEventListener("message", handler);
		return () => window.removeEventListener("message", handler);
	}, [onPick]);
}

export interface PickMessage {
	source: "forge-iframe";
	type: "forge:pick";
	page: string;
	selector: string;
	rect: { x: number; y: number; width: number; height: number };
}
