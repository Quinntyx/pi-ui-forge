// Whole-canvas capture via the Electron shell's webContents.capturePage
// (relayed through the server). Page renders live in the shell's offscreen
// renderer — the editor never captures pages itself.
//
// Budget rule: the canvas capture is the ONLY inline image in a review round
// (downscaled ≤1400px JPEG by the shell).

import { newId } from "./store";
import { request } from "./ws";

/** Capture the whole visible editor window via the Electron shell. */
export async function captureCanvas(timeoutMs = 6000): Promise<string | null> {
	const reqId = newId("cap");
	const response = await request(
		{ type: "capture-request", reqId },
		(m) =>
			(m.type === "shell-capture-result" || m.type === "forge:capture-result") && m.reqId === reqId,
		timeoutMs,
	);
	if (
		response &&
		(response.type === "shell-capture-result" || response.type === "forge:capture-result")
	) {
		return response.dataUrl;
	}
	return null;
}
