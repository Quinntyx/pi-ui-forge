/**
 * pi-ui-forge — tldraw-based UI mock forge.
 *
 * Thin extension: starts the `pi_ui_forge` sidecar server (Python), opens the
 * Electron window, and exposes agent-facing tools over a control socket.
 *
 * Mode "agent":    agent drives mock updates with mock_update; mock_wait
 *                  resolves when the user clicks "send back" (annotations come
 *                  back as the tool result) or when the window closes.
 * Mode "subagent": the editor talks to a design subagent over pi-sock through
 *                  the sidecar's bridge; the calling agent only waits for the
 *                  window to close. See PLAN.md.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
	// TODO: sidecar lifecycle (spawn `python -m pi_ui_forge serve --control <sock>`,
	// hold as long-lived resource, kill on session_shutdown).

	pi.registerTool({
		name: "mock_open",
		label: "Open UI mock",
		description:
			"Open a tldraw UI mock editor window (Electron, not the browser) with the given React mock tree mounted on the canvas.",
		promptSnippet: "Open an interactive UI mock window for the user",
		promptGuidelines: [
			"Use mock_open when the user wants to see, interact with, or annotate a UI mock; keep the tree JSON small and complete.",
		],
		parameters: Type.Object({
			mode: StringEnumLike(["agent", "subagent"]),
			tree: Type.String({ description: "Mock tree JSON (see PLAN.md format)" }),
			subagentSocket: Type.Optional(
				Type.String({ description: "pi-sock socket path of the design subagent (subagent mode)" }),
			),
			title: Type.Optional(Type.String()),
			wait: Type.Optional(
				Type.Boolean({ description: "Block until window close / send-back instead of returning immediately" }),
			),
		}),
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		async execute(_toolCallId, params, _signal, onUpdate, _ctx) {
			// TODO: talk to the sidecar control socket; stream revision events via onUpdate.
			return {
				content: [{ type: "text", text: `mock_open is not implemented yet (mode=${params.mode})` }],
				details: {},
			};
		},
	});

	pi.registerTool({
		name: "mock_update",
		label: "Update UI mock",
		description: "Replace the mock tree in an open UI mock window (agent mode).",
		parameters: Type.Object({
			session: Type.String({ description: "Session id returned by mock_open" }),
			tree: Type.String({ description: "Full replacement mock tree JSON" }),
		}),
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			return {
				content: [{ type: "text", text: `mock_update is not implemented yet (session=${params.session})` }],
				details: {},
			};
		},
	});

	pi.registerTool({
		name: "mock_wait",
		label: "Wait for UI mock feedback",
		description:
			"Block until the user clicks 'send back' (returns annotation package: text comments, bound component subtrees, annotation images on disk) or closes the window.",
		parameters: Type.Object({
			session: Type.String({ description: "Session id returned by mock_open" }),
			timeout: Type.Optional(Type.Number({ description: "Seconds before giving up (default 1800)" })),
		}),
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			return {
				content: [{ type: "text", text: `mock_wait is not implemented yet (session=${params.session})` }],
				details: {},
			};
		},
	});
}

// Small local enum helper to avoid the extra import during scaffolding.
// Replace with StringEnum from "@earendil-works/pi-ai" (Google-API compatible) later.
function StringEnumLike<const T extends readonly string[]>(values: T) {
	return {
		type: "string" as const,
		enum: values,
	};
}
