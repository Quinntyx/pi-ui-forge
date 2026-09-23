// Capture machinery: per-page PNG via same-origin iframe DOM serialization,
// full-canvas PNG via the Electron shell's webContents.capturePage (relayed
// through the server).

import { newId } from "./store";
import { request } from "./ws";

function iframeToken(): string {
	return new URLSearchParams(location.search).get("token") ?? "";
}

// Find live iframe windows, deduped by page name.
function findIframes(pages: string[] | null): Map<string, Window> {
	const result = new Map<string, Window>();
	for (const iframe of document.querySelectorAll("iframe[data-forge-page]")) {
		const page = iframe.getAttribute("data-forge-page")!;
		if (pages && !pages.includes(page)) continue;
		if (result.has(page)) continue;
		const win = (iframe as HTMLIFrameElement).contentWindow;
		if (win) result.set(page, win);
	}
	return result;
}

function requestIframeShot(win: Window, timeoutMs = 20000): Promise<string | null> {
	return new Promise((resolve) => {
		const reqId = newId("shot");
		const timer = setTimeout(() => {
			window.removeEventListener("message", listener);
			resolve(null);
		}, timeoutMs);
		const listener = (event: MessageEvent) => {
			const data = event.data;
			if (
				!data ||
				data.source !== "forge-iframe" ||
				data.type !== "forge:capture-result" ||
				data.reqId !== reqId
			) {
				return;
			}
			clearTimeout(timer);
			window.removeEventListener("message", listener);
			resolve(data.dataUrl ?? null);
		};
		window.addEventListener("message", listener);
		win.postMessage({ source: "forge-host", type: "forge:capture", reqId }, "*");
	});
}

/** Capture full-page renders of the given pages (all when null). */
export async function capturePages(
	pages: string[] | null,
): Promise<{ page: string; image: string }[]> {
	const frames = findIframes(pages);
	const shots: { page: string; image: string }[] = [];
	for (const [page, win] of frames) {
		const image = await requestIframeShot(win);
		if (image) shots.push({ page, image });
	}
	return shots;
}

/** Capture the whole visible editor window via the Electron shell. */
export async function captureCanvas(timeoutMs = 10000): Promise<string | null> {
	const reqId = newId("cap");
	const response = await request(
		{ type: "capture-request", reqId },
		(m) => m.type === "shell-capture-result" && m.reqId === reqId,
		timeoutMs,
	);
	if (response && response.type === "shell-capture-result") return response.dataUrl;
	return null;
}
