// Annotation plumbing: pick → comment pin, mode switching, target highlight.

import { editors, pinShapeId, type PickMessage } from "./canvas";
import { getState, newId, setState } from "./store";
import type { ForgeComment } from "./types";
import type { Editor } from "tldraw";

export function setMode(mode: "interact" | "annotate"): void {
	const prev = getState().mode;
	// disarm the picker through setPickMode so the annotation tool it borrowed
	// comes back before the mode switch records/overrides the tool
	if (getState().pickMode) setPickMode(false);
	setState({ mode, pickMode: false, tip: null });
	broadcastPick(false);
	if (mode === "interact") {
		// interact hands the keyboard and the pointer to the mock. Without this a
		// text shape you were editing keeps eating keystrokes (I/A/P included) and
		// a selected shape stays selected behind a hidden tool dock, so swap to
		// the pan tool and close whatever edit/selection the canvases had open.
		for (const editor of editors.values()) {
			const tool = editor.getCurrentToolId();
			if (tool && tool !== "hand") annotateTool = tool;
			editor.complete();
			editor.selectNone();
			editor.setCurrentTool("hand");
			editor.blur();
		}
	} else if (prev === "interact") {
		for (const editor of editors.values()) editor.setCurrentTool(annotateTool);
	}
}

export function setPickMode(on: boolean): void {
	// picking is an annotation gesture: never arm it from interact mode
	if (on && getState().mode !== "annotate") return;
	if (on && !getState().pickMode) {
		// remember the annotation tool: picking borrows the select tool for the
		// duration, and the tool has to come back when the pick is disarmed
		for (const editor of editors.values()) {
			const tool = editor.getCurrentToolId();
			if (tool && tool !== "select") pickTool = tool;
			editor.setCurrentTool("select");
		}
	} else if (!on) {
		for (const editor of editors.values()) editor.setCurrentTool(pickTool);
	}
	setState({ pickMode: on });
	broadcastPick(on);
}

/**
 * Freeze/unfreeze the inspect-hover overlay inside the pages without disarming
 * the pick. The comment popup uses this: while you are describing one element,
 * the outline stays on it instead of chasing whatever the pointer crosses, and
 * closes back to normal hovering after.
 */
export function setPickHover(on: boolean): void {
	broadcastPick(getState().pickMode, on);
}

/** tool restored when leaving interact mode (hand is interact's own tool) */
let annotateTool = "select";
/** tool restored when disarming the picker */
let pickTool = "select";

function broadcastPick(on: boolean, hover = true) {
	for (const iframe of document.querySelectorAll("iframe[data-forge-page]")) {
		const win = (iframe as HTMLIFrameElement).contentWindow;
		win?.postMessage({ source: "forge-host", type: "forge:pick", on, hover }, "*");
	}
}

/** The mock-page frame shape hosting `page` on this editor, if any. */
function findFrame(editor: Editor, page: string) {
	return (
		[...editor.getCurrentPageShapeIds()]
			.map((id) => editor.getShape(id))
			.find(
				(s) => !!s && s.type === "mock-page" && (s.props as { page: string }).page === page,
			) ?? null
	);
}

/**
 * Turn a forwarded iframe click into a comment: compute page-space position
 * from the frame shape, drop a pin, register the comment in the store.
 *
 * Click-elsewhere semantics: while the popup is open on a comment that has NO
 * typed content yet, a new pick MOVES that same comment (pin + store entry) to
 * the newly picked element instead of stacking another one — only typed text
 * makes a comment real.
 */
export function addCommentFromPick(msg: PickMessage): string | null {
	const state = getState();
	if (state.popup) {
		const pending = state.comments.find((c) => c.id === state.popup?.commentId);
		if (pending && pending.text.trim() === "") {
			return moveCommentToPick(pending.id, msg);
		}
	}
	let canvasId: string | null = null;
	for (const mock of state.world.mocks) {
		if (mock.pages.includes(msg.page)) {
			canvasId = mock.id;
			break;
		}
	}
	if (!canvasId) return null;
	const editor = editors.get(canvasId);
	if (!editor) return null;
	const frame = findFrame(editor, msg.page);
	if (!frame) return null;

	const commentId = newId("c");
	const pinId = pinShapeId(commentId);
	editor.createShape({
		id: pinId,
		type: "comment-pin",
		x: frame.x + msg.rect.x,
		y: frame.y + msg.rect.y,
		props: { commentId, num: getState().comments.length + 1, canvasId, w: 17, h: 17 },
	});

	const comment: ForgeComment = {
		id: commentId,
		text: "",
		page: msg.page,
		selector: msg.selector,
		canvasId,
		x: frame.x + msg.rect.x,
		y: frame.y + msg.rect.y,
	};
	setState({
		comments: [...getState().comments, comment],
		// the popup comment editor opens anchored at the pin
		popup: { commentId, x: frame.x + msg.rect.x, y: frame.y + msg.rect.y },
	});
	highlight(comment.page, comment.selector, true);
	return commentId;
}

/**
 * Relocate an existing (still empty) comment to a newly picked element: move
 * the pin shape, rewrite the store entry, and keep the popup anchored there.
 */
function moveCommentToPick(commentId: string, msg: PickMessage): string | null {
	const comment = getState().comments.find((c) => c.id === commentId);
	if (!comment) return null;
	let canvasId: string | null = null;
	for (const mock of getState().world.mocks) {
		if (mock.pages.includes(msg.page)) {
			canvasId = mock.id;
			break;
		}
	}
	if (!canvasId) return null;
	const editor = editors.get(canvasId);
	if (!editor) return null;
	const frame = findFrame(editor, msg.page);
	if (!frame) return null;

	const x = frame.x + msg.rect.x;
	const y = frame.y + msg.rect.y;
	const pinId = pinShapeId(commentId);
	if (editor.getShape(pinId)) {
		editor.updateShape({ id: pinId, type: "comment-pin", x, y, props: { canvasId } });
	} else {
		// the pin lives on a different canvas's editor (or was lost): drop the
		// ghost there and recreate it here so the move is never one-sided
		const old = editors.get(comment.canvasId);
		if (old && old !== editor && old.getShape(pinId)) old.deleteShape(pinId);
		editor.createShape({
			id: pinId,
			type: "comment-pin",
			x,
			y,
			props: {
				commentId,
				num: getState().comments.indexOf(comment) + 1,
				canvasId,
				w: 17,
				h: 17,
			},
		});
	}
	highlight(comment.page, comment.selector, false);
	setState({
		comments: getState().comments.map((c) =>
			c.id === commentId ? { ...c, page: msg.page, selector: msg.selector, canvasId, x, y } : c,
		),
		popup: { commentId, x, y },
	});
	highlight(msg.page, msg.selector, true);
	return commentId;
}

/** Remove a comment (pin + store entry), renumbering the remaining pins. */
export function removeComment(commentId: string): void {
	const state = getState();
	const remaining = state.comments.filter((c) => c.id !== commentId);
	for (const c of state.comments) {
		const editor = editors.get(c.canvasId);
		if (!editor) continue;
		const pinId = pinShapeId(c.id);
		if (c.id === commentId) {
			if (editor.getShape(pinId)) editor.deleteShape(pinId);
		} else {
			if (editor.getShape(pinId)) {
				editor.updateShape({
					id: pinId,
					type: "comment-pin",
					props: { num: remaining.indexOf(c) + 1 },
				});
			}
		}
	}
	setState({ comments: remaining });
}


/** Clear all annotations after a send-back: pins, drawings, notes, sidebar state. */
export function clearAllAnnotations(): void {
	for (const [canvasId, editor] of editors) {
		const ids = [...editor.getCurrentPageShapeIds()].filter((id) => {
			const shape = editor.getShape(id);
			return !!shape && shape.type !== "mock-page";
		});
		if (ids.length) editor.deleteShapes(ids);
	}
	setState({ comments: [], description: "", picked: [] });
}

/** Rewrite a comment's text in the store (inline tooltip editor / popup). */
export function updateCommentText(commentId: string, text: string): void {
	setState({
		comments: getState().comments.map((c) => (c.id === commentId ? { ...c, text } : c)),
	});
}

/**
 * Show the comment tooltip for a pin (hover, or after committing a comment).
 * Re-entering the same pin keeps its inline editor open; a different pin
 * retargets the tooltip and closes any editor.
 */
export function openTip(commentId: string, canvasId: string, x: number, y: number): void {
	const cur = getState().tip;
	if (cur && cur.commentId === commentId) {
		if (cur.x !== x || cur.y !== y || cur.canvasId !== canvasId)
			setState({ tip: { ...cur, canvasId, x, y } });
		return;
	}
	setState({ tip: { commentId, canvasId, x, y, editing: false } });
}

export function closeTip(): void {
	if (getState().tip) setState({ tip: null });
}

/** Open or close the tooltip's inline editor (text is saved by the caller). */
export function setTipEditing(editing: boolean): void {
	const cur = getState().tip;
	if (cur && cur.editing !== editing) setState({ tip: { ...cur, editing } });
}

/**
 * Close the popup keeping the comment (⏎ finalize). An empty comment never
 * became real — finalize drops it entirely so nothing stale leaks into the
 * send-back payload.
 */
export function finalizePopup(): void {
	const popup = getState().popup;
	if (!popup) return;
	const comment = getState().comments.find((c) => c.id === popup.commentId);
	// close first: highlight() keeps a popup's subject lit only while one exists
	setState({ popup: null });
	if (comment) highlight(comment.page, comment.selector, false);
	if (!comment || comment.text.trim() === "") removeComment(popup.commentId);
}

/**
 * Close the popup (esc). An empty comment is discarded (it was never real);
 * a typed comment is kept — esc just dismisses the editor.
 */
export function cancelPopup(): void {
	const popup = getState().popup;
	if (!popup) return;
	const comment = getState().comments.find((c) => c.id === popup.commentId);
	setState({ popup: null });
	if (comment) highlight(comment.page, comment.selector, false);
	if (!comment || comment.text.trim() === "") removeComment(popup.commentId);
}

export function highlight(page: string | null, selector: string | null, on: boolean): void {
	if (!page || !selector) return;
	// While the comment popup is open its target is the subject: keep that
	// outline up instead of accepting a "clear" from whatever just lost hover.
	if (!on) {
		const popup = getState().popup;
		const subject = popup && getState().comments.find((c) => c.id === popup.commentId);
		if (subject?.page && subject.selector) {
			postHighlight(subject.page, subject.selector, true);
			return;
		}
	}
	postHighlight(page, selector, on);
}

function postHighlight(page: string, selector: string, on: boolean): void {
	const iframe = document.querySelector(
		`iframe[data-forge-page="${CSS.escape(page)}"]`,
	) as HTMLIFrameElement | null;
	iframe?.contentWindow?.postMessage(
		{ source: "forge-host", type: "forge:highlight", selector, on },
		"*",
	);
}

export { newId };
