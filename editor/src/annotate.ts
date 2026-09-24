// Annotation plumbing: pick → comment pin, mode switching, target highlight.

import { editors, pinShapeId, type PickMessage } from "./canvas";
import { getState, newId, setState } from "./store";
import type { ForgeComment } from "./types";

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

/**
 * Turn a forwarded iframe click into a comment: compute page-space position
 * from the frame shape, drop a pin, register the comment in the store.
 */
export function addCommentFromPick(msg: PickMessage): string | null {
	const state = getState();
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
	const page = msg.page;
	const frame = [...editor.getCurrentPageShapeIds()]
		.map((id) => editor.getShape(id))
		.find((s) => !!s && s.type === "mock-page" && (s.props as { page: string }).page === page);
	if (!frame) return null;

	const commentId = newId("c");
	const pinId = pinShapeId(commentId);
	editor.createShape({
		id: pinId,
		type: "comment-pin",
		x: frame.x + msg.rect.x,
		y: frame.y + msg.rect.y,
		props: { commentId, num: getState().comments.length + 1, canvasId },
	});

	const comment: ForgeComment = {
		id: commentId,
		text: "",
		page,
		selector: msg.selector,
		canvasId,
		x: frame.x + msg.rect.x,
		y: frame.y + msg.rect.y,
	};
	setState({ comments: [...getState().comments, comment] });
	highlight(comment.page, comment.selector, true);
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
