// forge electron shell — one BrowserWindow on the editor URL, quits on close.
// Connects to the extension's WS server as the `shell` client and answers
// capture requests with full-window screenshots (webContents.capturePage).
//
// Usage: electron shell/main.js --ozone-platform-hint=auto <url> <ws-url>
// Usage: electron [flags] shell/main.js <editor-url>

const args = process.argv.slice(2); // argv[1] = shell/main.js; rest are ours
const urlArg = args.find((a) => a.startsWith("http"));

const { app, BrowserWindow } = require("electron");
const WebSocket = require("ws");

let win = null;
let ws = null;

function connect() {
	const url = new URL(urlArg);
	const wsUrl = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}/ws?token=${encodeURIComponent(
		url.searchParams.get("token") ?? "",
	)}&client=shell`;
	ws = new WebSocket(wsUrl);

	ws.on("open", () => {
		ws.send(JSON.stringify({ type: "hello" }));
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
				const image = await win.webContents.capturePage();
				ws.send(
					JSON.stringify({
						source: "forge-shell",
						type: "forge:capture-result",
						reqId: msg.reqId,
						dataUrl: image.toDataURL(),
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
		console.error(`forge shell: did-fail-load ${code} ${desc} ${url}`);
	});
	win.webContents.on("did-finish-load", () => {
		console.log(`forge shell: loaded ${urlArg}`);
	});
	win.webContents.on("console-message", (event) => {
		if (event.level === "error" || event.level === "warning") {
			console.log(`forge shell renderer[${event.level}]: ${event.message?.slice(0, 500) ?? ""}`);
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

app.whenReady().then(createWindow);
