// Annotation plumbing: pick → comment pin, mode switching, target highlight.

import { editors, pinShapeId, type PickMessage } from "./canvas";
import { getState, newId, setState } from "./store";
import type { ForgeComment } from "./types";
import type { Editor } from "tldraw";

export function setMode(mode: "interact" | "annotate"): void {
	setState({ mode, pickMode: false });
	broadcastPick(false);
}

export function setPickMode(on: boolean): void {
	setState({ pickMode: on });
	broadcastPick(on);
}

function broadcastPick(on: boolean) {
	for (const iframe of document.querySelectorAll("iframe[data-forge-page]")) {
		const win = (iframe as HTMLIFrameElement).contentWindow;
		win?.postMessage({ source: "forge-host", type: "forge:pick", on }, "*");
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
 * Close the popup keeping the comment (⏎ finalize). An empty comment never
 * became real — finalize drops it entirely so nothing stale leaks into the
 * send-back payload.
 */
export function finalizePopup(): void {
	const popup = getState().popup;
	if (!popup) return;
	const comment = getState().comments.find((c) => c.id === popup.commentId);
	if (!comment || comment.text.trim() === "") {
		removeComment(popup.commentId);
	} else {
		highlight(comment.page, comment.selector, false);
	}
	setState({ popup: null });
}

/**
 * Close the popup (esc). An empty comment is discarded (it was never real);
 * a typed comment is kept — esc just dismisses the editor.
 */
export function cancelPopup(): void {
	const popup = getState().popup;
	if (!popup) return;
	const comment = getState().comments.find((c) => c.id === popup.commentId);
	if (!comment || comment.text.trim() === "") {
		removeComment(popup.commentId);
	} else {
		highlight(comment.page, comment.selector, false);
	}
	setState({ popup: null });
}

export function highlight(page: string | null, selector: string | null, on: boolean): void {
	if (!page || !selector) return;
	const iframe = document.querySelector(
		`iframe[data-forge-page="${CSS.escape(page)}"]`,
	) as HTMLIFrameElement | null;
	iframe?.contentWindow?.postMessage(
		{ source: "forge-host", type: "forge:highlight", selector, on },
		"*",
	);
}

export { newId };
