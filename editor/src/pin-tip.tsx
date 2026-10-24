// Comment tooltip + inline editor, rendered as host chrome above the canvas.
//
// Deliberately outside tldraw: inside the pin shape's HTML container the tip
// collapsed the moment you pressed the mouse button — the CSS :hover that kept
// it open reset while tldraw handled the press, so the press landed on the
// canvas and no click ever reached the editor. Here the tooltip is plain host
// DOM: it opens on pin hover, stays open while you type, saves on ⏎/blur and
// reverts on Esc, and edits the comment in place after it was committed.

import { useEffect, useRef, useState } from "react";
import { editors } from "./canvas";
import { getState, useSyncState, type TipState } from "./store";
import { closeTip, setTipEditing, updateCommentText } from "./annotate";

export function PinTipLayer() {
	const state = useSyncState();
	const tip = state.tip;
	const pos = useScreenPos(tip);
	const ref = useRef<HTMLDivElement>(null);

	// dismiss when the pointer leaves both the pin and the tooltip — the pin is
	// only 17px, so a plain pointerleave would close it while reaching the tip
	useEffect(() => {
		if (!tip || !pos) return;
		const onMove = (e: PointerEvent) => {
			const cur = getState().tip;
			if (!cur || cur.editing) return;
			const r = ref.current?.getBoundingClientRect();
			const inTip =
				!!r &&
				e.clientX >= r.left - 2 &&
				e.clientX <= r.right + 2 &&
				e.clientY >= r.top - 2 &&
				e.clientY <= r.bottom + 2;
			const inPin = Math.abs(e.clientX - pos.x) <= 20 && Math.abs(e.clientY - pos.y) <= 20;
			if (!inTip && !inPin) closeTip();
		};
		window.addEventListener("pointermove", onMove, true);
		return () => window.removeEventListener("pointermove", onMove, true);
	}, [tip, pos?.x, pos?.y]);

	if (!tip || !pos) return null;
	const comment = state.comments.find((c) => c.id === tip.commentId);
	if (!comment) return null;

	return (
		<div id="pin-tip-layer">
			<div
				ref={ref}
				className={`pin-tip${tip.editing ? " editing" : ""}`}
				style={{ left: pos.x, top: pos.y }}
				title={tip.editing ? undefined : "click to edit"}
				onClick={() => {
					if (!tip.editing) setTipEditing(true);
				}}
			>
				{comment.selector && <code>{comment.selector}</code>}
				{tip.editing ? (
					<textarea
						className="pin-edit"
						autoFocus
						rows={2}
						defaultValue={comment.text}
						onKeyDown={(e) => {
							// keep tldraw's key handlers out of the editor
							e.stopPropagation();
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								updateCommentText(comment.id, e.currentTarget.value);
								setTipEditing(false);
							} else if (e.key === "Escape") {
								e.preventDefault();
								setTipEditing(false);
								closeTip();
							}
						}}
						onBlur={(e) => {
							// clicking away saves; Esc is the explicit revert
							updateCommentText(comment.id, e.currentTarget.value);
							setTipEditing(false);
							closeTip();
						}}
					/>
				) : (
					<span className="pin-tip-text">
						{comment.text || <em>click to add a comment</em>}
					</span>
				)}
			</div>
		</div>
	);
}

/**
 * Pin position in viewport coordinates, kept in sync with pan/zoom by ticking
 * on rAF while a tooltip is open (the camera moves without any store change).
 */
function useScreenPos(tip: TipState | null): { x: number; y: number } | null {
	const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
	const key = tip ? `${tip.canvasId}:${tip.x}:${tip.y}` : "";
	useEffect(() => {
		if (!tip) {
			setPos(null);
			return;
		}
		const editor = editors.get(tip.canvasId);
		if (!editor) {
			setPos(null);
			return;
		}
		let raf = 0;
		const tick = () => {
			const p = editor.pageToScreen({ x: tip.x, y: tip.y });
			setPos((prev) =>
				prev && Math.abs(prev.x - p.x) < 0.5 && Math.abs(prev.y - p.y) < 0.5 ? prev : { x: p.x, y: p.y },
			);
			raf = requestAnimationFrame(tick);
		};
		tick();
		return () => cancelAnimationFrame(raf);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);
	return pos;
}
