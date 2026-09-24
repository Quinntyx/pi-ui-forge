// Custom tldraw shapes: mock-page (iframe frame) and comment-pin (annotation
// marker). Types live in schema-augment.ts (module augmentation).

import { BaseBoxShapeUtil, HTMLContainer, T } from "tldraw";
import type { CommentPinShape, MockPageShape } from "./schema-augment";
import type { TLShape } from "tldraw";

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
		return (
			<HTMLContainer style={{ overflow: "hidden", background: "transparent" }}>
				<div className="mock-frame-label" data-forge-label={shape.props.page}>
					{shape.props.page}
				</div>
				<iframe
					data-forge-page={shape.props.page}
					data-forge-canvas={shape.props.canvasId}
					src={`/app/${encodeURIComponent(shape.props.page)}/?token=${encodeURIComponent(token)}`}
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
		return { commentId: "", num: 1, canvasId: "m0", w: 24, h: 24 };
	}

	override component(shape: CommentPinShape) {
		return (
			<HTMLContainer style={{ pointerEvents: "all" }}>
				<div className="comment-pin">{shape.props.num}</div>
			</HTMLContainer>
		);
	}

	override getIndicatorPath(shape: CommentPinShape): Path2D {
		const path = new Path2D();
		const r = Math.min(shape.props.w, shape.props.h) / 2;
		path.arc(r, r, r, 0, Math.PI * 2);
		return path;
	}
}

/** Shapes managed by the forge (never treated as user drawings). */
export function isForgeShape(shape: TLShape): boolean {
	return shape.type === "mock-page" || shape.type === "comment-pin";
}
