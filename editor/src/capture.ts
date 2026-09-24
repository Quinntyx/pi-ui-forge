// Capture machinery: per-page PNG via same-origin iframe DOM serialization,
// full-canvas PNG via the Electron shell's webContents.capturePage (relayed
// through the server).
//
// Budget rule: every capture that could reach the agent's context is
// downscaled to ≤1400px wide and re-encoded as JPEG (~100 KB), because tool
// results persist in the conversation and providers cap request size.

import { newId } from "./store";
import { request } from "./ws";

function iframeToken(): string {
	return new URLSearchParams(location.search).get("token") ?? "";
}

const MAX_WIDTH = 1400;
const JPEG_QUALITY = 0.72;

/** Re-encode a dataURL image to ≤MAX_WIDTH-wide JPEG. */
function downscaleToJpeg(dataUrl: string): Promise<string | null> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			try {
				const scale = Math.min(1, MAX_WIDTH / img.naturalWidth);
				const canvas = document.createElement("canvas");
				canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
				canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
				const ctx = canvas.getContext("2d");
				if (!ctx) return resolve(dataUrl);
				ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
				resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
			} catch {
				resolve(dataUrl);
			}
		};
		img.onerror = () => resolve(dataUrl);
		img.src = dataUrl;
	});
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

function requestIframeShot(win: Window, timeoutMs = 12000): Promise<string | null> {
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

/** Capture full-page renders of the given pages (all when null) — parallel, JPEG-compressed. */
export async function capturePages(
	pages: string[] | null,
): Promise<{ page: string; image: string }[]> {
	const frames = findIframes(pages);
	const shots = await Promise.all(
		[...frames.entries()].map(async ([page, win]) => {
			const raw = await requestIframeShot(win);
			if (!raw) return { page, image: null };
			return { page, image: await downscaleToJpeg(raw) };
		}),
	);
	return shots.filter((s): s is { page: string; image: string } => !!s.image);
}

/** Capture the whole visible editor window via the Electron shell. */
export async function captureCanvas(timeoutMs = 6000): Promise<string | null> {
	const reqId = newId("cap");
	const response = await request(
		{ type: "capture-request", reqId },
		(m) => m.type === "shell-capture-result" && m.reqId === reqId,
		timeoutMs,
	);
	if (response && response.type === "shell-capture-result") return response.dataUrl;
	return null;
}
