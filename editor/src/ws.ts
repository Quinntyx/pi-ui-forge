// WebSocket connection to the in-process extension server.

import { setState } from "./store";
import type { EditorToHost, HostToEditor } from "./types";

type Handler = (msg: HostToEditor) => void;

interface Pending {
	resolve: (msg: HostToEditor) => void;
	timer: number;
}

let ws: WebSocket | null = null;
let handlers: Handler[] = [];
const pending = new Map<string, Pending>();
let reconnectTimer: number | null = null;
let alive = false;

function getToken(): string {
	return new URLSearchParams(location.search).get("token") ?? "";
}

export function onMessage(handler: Handler): () => void {
	handlers.push(handler);
	return () => {
		handlers = handlers.filter((h) => h !== handler);
	};
}

export function send(msg: EditorToHost): void {
	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(msg));
	}
}

/** Send a request carrying reqId and await the matching response message. */
export function request(
	msg: EditorToHost & { reqId: string },
	match: (msg: HostToEditor) => boolean,
	timeoutMs: number,
): Promise<HostToEditor | null> {
	return new Promise((resolve) => {
		const timer = window.setTimeout(() => {
			pending.delete(msg.reqId);
			resolve(null);
		}, timeoutMs);
		pending.set(msg.reqId, {
			resolve: (response) => {
				clearTimeout(timer);
				resolve(response);
			},
			timer,
		});
		send(msg);
	});
}

export function connect(): void {
	const url = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws?token=${encodeURIComponent(getToken())}&client=editor`;
	const socket = new WebSocket(url);
	ws = socket;

	socket.onopen = () => {
		alive = true;
		setState({ connected: true });
		socket.send(JSON.stringify({ type: "hello" }));
	};

	socket.onmessage = (event) => {
		let msg: HostToEditor;
		try {
			msg = JSON.parse(event.data);
		} catch {
			return;
		}
		const p = ("reqId" in msg && pending.get((msg as { reqId: string }).reqId)) || undefined;
		if (p && msg.type !== "page-shot-request") {
			pending.delete((msg as { reqId: string }).reqId);
			p.resolve(msg);
			return;
		}
		for (const h of handlers) h(msg);
	};

	socket.onclose = () => {
		ws = null;
		setState({ connected: false });
		if (alive) {
			reconnectTimer = window.setTimeout(connect, 1500);
		}
	};

	socket.onerror = (err) => {
		console.error("[forge-editor] ws error", err);
		socket.close();
	};
}

export function stopReconnect(): void {
	if (reconnectTimer !== null) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
	alive = false;
}
