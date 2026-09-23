/**
 * pi-ui-forge — tldraw-based UI mock editor, run inside a design subagent.
 *
 * Installed only in the `design-subagents` pi profile (never the main
 * profile). The extension owns everything server-side in-process:
 *
 *   - HTTP/WS server (node http + ws): serves the editor build + app bundle,
 *     relays markup packages, receives screenshot requests
 *   - Electron child: one BrowserWindow on the editor URL, quit-on-close
 *   - esbuild builds of the mock app in the subagent's cwd (mock_folder)
 *
 * Tools registered here are called by the design subagent's model; the
 * questionnaire-style loop lives in mock_review, which blocks the tool call
 * until the user sends markup, approves, or closes the window. See PLAN.md.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
	// Long-lived resources (server, electron child) per extensions.md —
	// created on first mock_open, torn down on session_shutdown.

	pi.registerTool({
		name: "mock_open",
		label: "Open mock editor",
		description:
			"Start the UI mock editor (HTTP/WS server + Electron window) for the mock app in the current working directory. Idempotent.",
		parameters: Type.Object({
			title: Type.Optional(Type.String({ description: "Window title" })),
		}),
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
			return { content: [{ type: "text", text: "mock_open is not implemented yet" }], details: {} };
		},
	});

	pi.registerTool({
		name: "mock_build",
		label: "Build mock",
		description:
			"Run the esbuild build (build.mjs) for the mock app in the current working directory and push the new pages to the open editor.",
		parameters: Type.Object({}),
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
			return { content: [{ type: "text", text: "mock_build is not implemented yet" }], details: {} };
		},
	});

	pi.registerTool({
		name: "mock_screenshot",
		label: "Screenshot mock",
		description:
			"Capture the current mock pages as images without changing the user's view; returns paths (and image content) for self-inspection before a review.",
		parameters: Type.Object({
			pages: Type.Optional(Type.Array(Type.String(), { description: "Page names; default: all" })),
		}),
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
			return { content: [{ type: "text", text: "mock_screenshot is not implemented yet" }], details: {} };
		},
	});

	pi.registerTool({
		name: "mock_review",
		label: "Ask user to review mock",
		description:
			"Hand the mock over to the user for markup. BLOCKS until the user sends annotations, approves, or closes the window. The result is the markup package (picked pages, typed description, comments with CSS selectors, draw crops under ann/).",
		parameters: Type.Object({
			note: Type.Optional(Type.String({ description: "Short note shown to the user: what changed, what to look at" })),
		}),
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
			return { content: [{ type: "text", text: "mock_review is not implemented yet" }], details: {} };
		},
	});
}
