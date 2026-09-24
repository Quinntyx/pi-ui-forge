// forge electron shell — one BrowserWindow on the editor URL, quits on close.
// Connects to the extension's WS server as the `shell` client and answers
// capture requests with full-window screenshots (webContents.capturePage).
//
// Usage: electron [flags] shell/main.cjs <editor-url>

// Orphaned windows outlive the extension that spawned them; any write to the
// dead stdio pipe must not crash the window (the extension spawns with stdio
// piped for diagnostics).
const safeLog = (...args) => {
	try {
		// eslint-disable-next-line no-console
		console.log(...args);
	} catch {
		/* EPIPE etc. — the parent is gone; logging is best-effort */
	}
};
process.on("uncaughtException", (err) => {
	if (String(err).includes("EPIPE")) return; // dead stdio pipe: ignore
	try { console.error("forge shell: uncaught", err); } catch {}
});

const args = process.argv.slice(2); // argv[1] = shell/main.cjs; rest are ours
const urlArg = args.find((a) => a.startsWith("http"));

const { app, BrowserWindow } = require("electron");
const WebSocket = require("ws");

let win = null;
let ws = null;

function connect() {
	if (!urlArg) {
		safeLog("forge shell: no editor URL argument, capture bridge disabled");
		return;
	}
	const url = new URL(urlArg);
	const wsUrl = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}/ws?token=${encodeURIComponent(
		url.searchParams.get("token") ?? "",
	)}&client=shell`;
	ws = new WebSocket(wsUrl);

	ws.on("open", () => {
		safeLog("forge shell: control bridge connected");
		ws.send(JSON.stringify({ type: "hello" }));
	});

	ws.on("error", (err) => {
		safeLog(`forge shell: control bridge error ${err}`);
	});

	ws.on("message", async (raw) => {
		let msg;
		try {
			msg = JSON.parse(raw.toString());
		} catch {
			return;
		}
		if (msg.type === "forge:capture" && win) {
			try {
				// Whole-canvas captures are returned inline to the agent's model, so
				// they are downscaled + JPEG to keep context small.
				const raw = await win.webContents.capturePage();
				const maxW = 1400;
				const scaled = raw.getSize().width > maxW ? raw.resize({ width: maxW }) : raw;
				safeLog(`forge shell: captured ${scaled.getSize().width}x${scaled.getSize().height} jpeg`);
				ws.send(
					JSON.stringify({
						source: "forge-shell",
						type: "forge:capture-result",
						reqId: msg.reqId,
						dataUrl: `data:image/jpeg;base64,${scaled.toJPEG(72).toString("base64")}`,
					}),
				);
			} catch (err) {
				ws.send(
					JSON.stringify({
						source: "forge-shell",
						type: "forge:capture-result",
						reqId: msg.reqId,
						dataUrl: null,
						error: String(err),
					}),
				);
			}
		}
	});

	ws.on("close", () => {
		// the server went away (session ended) — exit so the window doesn't linger
		setTimeout(() => {
			if (win && !win.isDestroyed()) app.quit();
		}, 3000);
	});
}

function createWindow() {
	win = new BrowserWindow({
		width: 1680,
		height: 1024,
		title: "UI Mock Forge",
		autoHideMenuBar: true,
		backgroundColor: "#1c1e26",
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
		},
	});
	win.loadURL(urlArg);
	win.webContents.on("did-fail-load", (_e, code, desc, url) => {
		safeLog(`forge shell: did-fail-load ${code} ${desc} ${url}`);
	});
	win.webContents.on("did-finish-load", () => {
		safeLog(`forge shell: loaded ${urlArg}`);
	});
	win.webContents.on("console-message", (event) => {
		if (event.level === "error" || event.level === "warning") {
			safeLog(`forge shell renderer[${event.level}]: ${event.message?.slice(0, 500) ?? ""}`);
		}
	});
	win.on("closed", () => {
		win = null;
		app.quit();
	});
}

app.on("window-all-closed", () => {
	app.quit();
});

app.whenReady().then(() => {
	createWindow();
	connect();
});
