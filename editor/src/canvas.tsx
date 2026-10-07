// MockCanvas: one tldraw canvas per mock (tab). Frames reconcile to the world
// state with stable shape ids per (canvas, page) so annotations survive
// rebuilds. Editors are registered in a module map for cross-cutting actions
// (picks, exports, captures).

import { useEffect, useRef } from "react";
import { CanvasErrorBoundary } from "./canvas-error-boundary";
import { Tldraw, createShapeId, track, useEditor, type Editor } from "tldraw";
import type { TLShapeId } from "tldraw";
import type { WorldMock } from "./types";
import { getState } from "./store";
import { removeComment } from "./annotate";
import { CommentPinShapeUtil, MockPageShapeUtil } from "./shapes";

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
	const width = mock.width ?? FRAME_W;
	const height = mock.height ?? FRAME_H;
	const existing = [...editor.getCurrentPageShapeIds()]
		.map((id) => editor.getShape(id))
		.filter((s): s is NonNullable<typeof s> => !!s && s.type === "mock-page");
	const byPage = new Map(existing.map((s) => [(s.props as { page: string }).page, s] as const));

	const updates: Parameters<Editor["updateShape"]>[0][] = [];
	const creations: Parameters<Editor["createShapes"]>[0] = [];
	const stale = new Set<TLShapeId>();
	const liveIds = new Set<TLShapeId>();
	let resized = false;

	mock.pages.forEach((page, i) => {
		const x = i * (width + GAP);
		const y = 0;
		const id = frameShapeId(mock.id, page);
		liveIds.add(id);
		const current = byPage.get(page);
		if (current && current.id === id) {
			const props = current.props as { w: number; h: number };
			if (current.x !== x || current.y !== y || props.w !== width || props.h !== height) {
				resized = true;
				updates.push({
					id: current.id,
					type: "mock-page" as const,
					x,
					y,
					props: { w: width, h: height },
				});
			}
		} else {
			// missing frame — or the page lives on a stale/non-canonical persisted
			// shape: drop that and (re)create under the canonical id
			if (current) stale.add(current.id);
			creations.push({
				id,
				type: "mock-page",
				x,
				y,
				props: { page, w: width, h: height, canvasId: mock.id },
			});
		}
	});
	for (const s of existing) {
		// ghosts: pages removed from the world, or duplicate/non-canonical frames
		// resurrected from tldraw's IndexedDB persistence
		if (!liveIds.has(s.id)) stale.add(s.id);
	}
	if (stale.size) editor.deleteShapes([...stale]);
	if (creations.length) editor.createShapes(creations);
	for (const u of updates) editor.updateShape(u);
	// frame the pages like the design does (centered with breathing room) —
	// also refit when the page set shrinks, or the camera keeps framing ghosts
	if (creations.length || resized || stale.size) {
		try {
			editor.zoomToFit({ animation: { duration: 0 } });
		} catch {
			/* camera fitting is cosmetic */
		}
	}
}

/**
 * True when the canvas's mock-page shapes diverge from the world: missing or
 * extra frames, duplicates, non-canonical ids, or stale props/positions.
 * Persisted shapes restore ASYNC after mount, so a one-shot sync on mount
 * races the restore — callers re-check on store changes to catch ghosts.
 */
function framesDiverged(editor: Editor, mock: WorldMock): boolean {
	const width = mock.width ?? FRAME_W;
	const height = mock.height ?? FRAME_H;
	const seen = new Set<string>();
	for (const id of editor.getCurrentPageShapeIds()) {
		const s = editor.getShape(id);
		if (!s || s.type !== "mock-page") continue;
		const props = s.props as { page: string };
		if (s.id !== frameShapeId(mock.id, props.page)) return true;
		if (seen.has(props.page)) return true;
		seen.add(props.page);
	}
	if (seen.size !== mock.pages.length) return true;
	for (let i = 0; i < mock.pages.length; i++) {
		const page = mock.pages[i];
		const s = editor.getShape(frameShapeId(mock.id, page));
		if (!s) return true;
		const props = s.props as { w: number; h: number };
		if (props.w !== width || props.h !== height || s.x !== i * (width + GAP) || s.y !== 0) {
			return true;
		}
	}
	return false;
}

/**
 * Delete comment pins whose comment no longer exists in app state — pins
 * restored from persistence after a window reload are orphans (comments are
 * memory-only) and would otherwise show stale markup from an older round.
 * Only run at reconcile points (world application), never on document
 * changes: a fresh pin exists for a beat before its comment is registered.
 */
function scrubOrphanPins(editor: Editor): void {
	const known = new Set(getState().comments.map((c) => c.id));
	const stale = [...editor.getCurrentPageShapeIds()]
		.map((id) => editor.getShape(id))
		.filter(
			(s): s is NonNullable<typeof s> =>
				!!s && s.type === "comment-pin" && !known.has((s.props as { commentId: string }).commentId),
		)
		.map((s) => s.id);
	if (stale.length) editor.deleteShapes(stale);
}

const FrameSync = track(function FrameSync({ mock }: { mock: WorldMock }) {
	const editor = useEditor();
	const lastKey = useRef("");
	useEffect(() => {
		const reconcile = () => {
			const key = `${mock.pages.join(",")}@${mock.width ?? FRAME_W}x${mock.height ?? FRAME_H}`;
			// a matching key alone would trust persisted shapes; also re-check
			// divergence so async-restored persistence ghosts get reconciled
			if (lastKey.current === key && !framesDiverged(editor, mock)) return;
			lastKey.current = key;
			syncFrames(editor, mock);
			scrubOrphanPins(editor);
		};
		reconcile();
		// persistence restores (and any other out-of-band document writes) land
		// AFTER mount via store puts — re-check when the document changes, and
		// defer the mutation out of the notification transaction
		let scheduled = false;
		const unsub = editor.store.listen(
			() => {
				if (scheduled) return;
				scheduled = true;
				queueMicrotask(() => {
					scheduled = false;
					if (framesDiverged(editor, mock)) reconcile();
				});
			},
			{ scope: "document" },
		);
		return unsub;
	}, [editor, mock]);
	return null;
});

function MockCanvasInner({ mock }: { mock: WorldMock }) {
	return (
		<CanvasErrorBoundary label={`canvas "${mock.label}"`}>
			<Tldraw
				shapeUtils={[MockPageShapeUtil, CommentPinShapeUtil]}
				persistenceKey={`forge-${mock.id}`}
				components={{
					Toolbar: null,
					StylePanel: null,
					PageMenu: null,
					NavigationPanel: null,
					DebugPanel: null,
					HelpMenu: null,
					MenuPanel: null,
					QuickActions: null,
					TopPanel: null,
				}}
				onMount={(editor) => {
					editors.set(mock.id, editor);
					try {
						editor.updateInstanceState({ isGridMode: true } as never);
					} catch {
						/* grid mode is cosmetic */
					}
					// comment deletion sweep: tldraw deletes a selected pin on
					// Backspace/Delete (or via the eraser) directly in the document —
					// drop the store comment with it so send-back never sees stale
					// entries, and removeComment renumbers the surviving pins.
					// Deferred to a microtask: runs after the triggering transaction,
					// and removeComment's own shape writes re-enter harmlessly (the
					// comment is already gone from the store by then).
					const unsubComments = editor.store.listen(
						() => {
							queueMicrotask(() => {
								for (const c of [...getState().comments]) {
									if (c.canvasId !== mock.id) continue;
									if (!editor.getShape(pinShapeId(c.id))) removeComment(c.id);
								}
							});
						},
						{ scope: "document" },
					);
					return () => {
						unsubComments();
						editors.delete(mock.id);
					};
				}}
			>
				<FrameSync mock={mock} />
			</Tldraw>
		</CanvasErrorBoundary>
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
