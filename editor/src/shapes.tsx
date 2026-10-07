// Custom tldraw shapes: mock-page (iframe frame) and comment-pin (annotation
// marker). Types live in schema-augment.ts (module augmentation).

import { BaseBoxShapeUtil, HTMLContainer, T } from "tldraw";
import { useState } from "react";
import type { CommentPinShape, MockPageShape } from "./schema-augment";
import type { TLShape } from "tldraw";
import type { ForgeComment } from "./types";
import { useSyncState } from "./store";
import { updateCommentText } from "./annotate";
import { usePageHash } from "./hashes";

const mockPageProps = {
	page: T.string,
	w: T.number,
	h: T.number,
	canvasId: T.string,
};

export class MockPageShapeUtil extends BaseBoxShapeUtil<MockPageShape> {
	static override type = "mock-page" as const;
	static override props = mockPageProps;

	override getDefaultProps(): MockPageShape["props"] {
		return { page: "home", w: 1280, h: 800, canvasId: "m0" };
	}

	override component(shape: MockPageShape) {
		const token = new URLSearchParams(location.search).get("token") ?? "";
		// the bundle hash in the src is the reload mechanism: when a revision
		// changes the hash, the src changes and the iframe loads the new bundle
		const hash = usePageHash(shape.props.page);
		const src = `/app/${encodeURIComponent(shape.props.page)}/?token=${encodeURIComponent(token)}${
			hash ? `&v=${encodeURIComponent(hash)}` : ""
		}`;
		return (
			<HTMLContainer style={{ overflow: "hidden", background: "transparent" }}>
				<div className="mock-frame-label" data-forge-label={shape.props.page}>
					{shape.props.page}
				</div>
				<iframe
					data-forge-page={shape.props.page}
					data-forge-canvas={shape.props.canvasId}
					src={src}
					className="mock-frame-iframe"
					style={{ width: "100%", height: "100%", border: "0", background: "#fff" }}
				/>
			</HTMLContainer>
		);
	}

	override getIndicatorPath(shape: MockPageShape): Path2D {
		const path = new Path2D();
		path.rect(0, 0, shape.props.w, shape.props.h);
		return path;
	}
}

const commentPinProps = {
	commentId: T.string,
	num: T.number,
	canvasId: T.string,
	w: T.number,
	h: T.number,
};

export class CommentPinShapeUtil extends BaseBoxShapeUtil<CommentPinShape> {
	static override type = "comment-pin" as const;
	static override props = commentPinProps;

	override getDefaultProps(): CommentPinShape["props"] {
		return { commentId: "", num: 1, canvasId: "m0", w: 17, h: 17 };
	}

	override component(shape: CommentPinShape) {
		// subscribe to the app store so tooltip text follows store edits live
		const state = useSyncState();
		const comment = state.comments.find((c) => c.id === shape.props.commentId);
		const color = PIN_COLORS[(shape.props.num - 1 + PIN_COLORS.length) % PIN_COLORS.length];
		return (
			<HTMLContainer style={{ pointerEvents: "all" }}>
				<div className="pin-wrap">
					<div className={`pin c-${color}`} style={{ width: 17, height: 17 }}>
						{shape.props.num}
					</div>
					{comment && (comment.selector || comment.text) && <PinTip comment={comment} />}
				</div>
			</HTMLContainer>
		);
	}

	override getIndicatorPath(shape: CommentPinShape): Path2D {
		// the pin renders as a square — the selection indicator must match
		const path = new Path2D();
		path.rect(0, 0, shape.props.w, shape.props.h);
		return path;
	}
}

/**
 * Hover tooltip on a pin: selector + comment text. Clicking it opens an
 * inline editor (textarea) in place — Enter (or blur) saves, Escape reverts.
 * Edits go through updateCommentText so the store — and the send-back
 * payload — always carry the current text.
 */
function PinTip({ comment }: { comment: ForgeComment }) {
	const [editing, setEditing] = useState(false);
	if (editing) {
		return (
			<div
				className="pin-tip editing"
				onMouseDown={(e) => e.stopPropagation()}
				onClick={(e) => e.stopPropagation()}
			>
				{comment.selector && <code>{comment.selector}</code>}
				<textarea
					className="pin-edit"
					autoFocus
					defaultValue={comment.text}
					onKeyDown={(e) => {
						// keep tldraw's key handlers out of the editor
						e.stopPropagation();
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							updateCommentText(comment.id, e.currentTarget.value);
							setEditing(false);
						} else if (e.key === "Escape") {
							e.preventDefault();
							setEditing(false);
						}
					}}
					onBlur={(e) => {
						// clicking away counts as a save; Escape is the explicit revert
						updateCommentText(comment.id, e.currentTarget.value);
						setEditing(false);
					}}
				/>
			</div>
		);
	}
	return (
		<div
			className="pin-tip"
			title="click to edit"
			onMouseDown={(e) => e.stopPropagation()}
			onClick={() => setEditing(true)}
		>
			{comment.selector && <code>{comment.selector}</code>}
			{comment.text && <span className="pin-tip-text">{comment.text}</span>}
		</div>
	);
}

/** Pin accent colors, mirroring the design (yellow/orange/purple/...). */
const PIN_COLORS = ["yellow", "orange", "purple", "red", "aqua", "green"];

/** Shapes managed by the forge (never treated as user drawings). */
export function isForgeShape(shape: TLShape): boolean {
	return shape.type === "mock-page" || shape.type === "comment-pin";
}
