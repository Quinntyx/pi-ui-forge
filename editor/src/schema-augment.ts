// tldraw custom-shape augmentation: registers the forge shape types with the
// schema so TLShape unions include them.

import type { TLBaseShape } from "tldraw";

declare module "@tldraw/tlschema" {
	interface TLGlobalShapePropsMap {
		"mock-page": {
			page: string;
			w: number;
			h: number;
			canvasId: string;
		};
		"comment-pin": {
			commentId: string;
			num: number;
			canvasId: string;
			w: number;
			h: number;
		};
	}
}

export type MockPageShape = TLBaseShape<
	"mock-page",
	{ page: string; w: number; h: number; canvasId: string }
>;

export type CommentPinShape = TLBaseShape<
	"comment-pin",
	{ commentId: string; num: number; canvasId: string; w: number; h: number }
>;
