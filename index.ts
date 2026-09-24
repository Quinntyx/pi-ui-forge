/**
 * pi-ui-forge — tldraw UI mock editor, run inside a design subagent.
 *
 * Installed only in the `design-subagents` pi profile (never the main
 * profile). The extension owns everything server-side in-process:
 *
 *   - HTTP server: serves the editor build (/), the mock app bundle
 *     (/app/<page>/), and the forge runtime/vendor scripts; token-gated
 *   - WebSocket hub: `editor` (the tldraw UI) and `shell` (Electron) clients
 *   - Electron child: one BrowserWindow on the editor URL, quit-on-close
 *
 * Tools (called by the design subagent's model):
 *
 *   mock_open        start server + window (idempotent)
 *   mock_build       esbuild-build the mock app; push the page world to the GUI
 *   mock_screenshot  capture current pages (no view change) for self-inspection
 *   mock_review      BLOCKING: hand over to the user; result = markup package
 *
 * All session data lives under the subagent's cwd (the mock folder). See
 * PLAN.md and skills/design-subagent.
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";

const PLUGIN_DIR = (() => {
	// jiti may resolve import.meta.url without the .ts suffix — try both the
	// file's dir and its parent, preferring whichever actually has the assets.
	let file = "";
	try {
		file = fileURLToPath(import.meta.url);
	} catch {
		file = import.meta.url;
	}
	const dir = path.dirname(file.replace(/\\.ts$/, ".ts"));
	for (const candidate of [dir, path.dirname(dir), path.dirname(path.dirname(dir))]) {
		if (
			fs.existsSync(path.join(candidate, "editor", "dist", "index.html")) &&
			fs.existsSync(path.join(candidate, "shell", "main.cjs"))
		) {
			return candidate;
		}
	}
	return dir;
})();

// --- types --------------------------------------------------------------------

interface WorldMock {
	id: string;
	label: string;
	pages: string[];
}

interface ReviewPayload {
	picked: string[];
	description: string;
	comments: { text: string; page: string | null; selector: string | null }[];
	drawings: { page: string | null; image: string | null; text?: string }[];
	canvasImage: string | null;
}

interface ReviewResult {
	approved: boolean;
	closed: boolean;
	aborted?: boolean;
	payload: ReviewPayload;
}

interface ForgeSession {
	cwd: string;
	server: http.Server;
	wss: WebSocketServer;
	port: number;
	token: string;
	clients: Map<WebSocket, "editor" | "shell">;
	world: { mocks: WorldMock[] };
	/** bundle hash per page name — editors reload iframes whose hash changed */
	pageHashes: Record<string, string>;
	phase: "idle" | "review" | "closed";
	reviewId: number;
	reviewNote: string | null;
	pendingReview: { resolve: (r: ReviewResult) => void; reviewId: number } | null;
	shotWaiters: Map<string, (shots: { page: string; image: string }[]) => void>;
	electron: ChildProcess | null;
	shotCounter: number;
	closed: boolean;
}

let session: ForgeSession | null = null;

// --- paths ----------------------------------------------------------------------

function mockFolderDir(ctx: ExtensionContext): string {
	return path.resolve(ctx.cwd ?? process.cwd());
}

function editorDistDir(): string {
	return path.join(PLUGIN_DIR, "editor", "dist");
}

function electronBin(): string | null {
	const direct = path.join(PLUGIN_DIR, "node_modules", "electron", "dist", "electron");
	return fs.existsSync(direct) ? direct : null;
}

function shellMainPath(): string {
	return path.join(PLUGIN_DIR, "shell", "main.cjs");
}

// --- static serving ---------------------------------------------------------------

function contentType(file: string): string {
	const ext = path.extname(file).toLowerCase();
	switch (ext) {
		case ".html":
			return "text/html; charset=utf-8";
		case ".js":
		case ".mjs":
			return "text/javascript; charset=utf-8";
		case ".css":
			return "text/css; charset=utf-8";
		case ".json":
			return "application/json; charset=utf-8";
		case ".svg":
			return "image/svg+xml";
		case ".png":
			return "image/png";
		case ".woff2":
			return "font/woff2";
		default:
			return "application/octet-stream";
	}
}

function serveFile(res: http.ServerResponse, file: string): void {
	try {
		const data = fs.readFileSync(file);
		res.writeHead(200, { "Content-Type": contentType(file), "Cache-Control": "no-store" });
		res.end(data);
	} catch {
		notFound(res);
	}
}

function notFound(res: http.ServerResponse): void {
	res.writeHead(404);
	res.end("not found");
}

/** Serve `rel` under `root` (path-traversal safe). */
function staticUnder(root: string, rel: string, res: http.ServerResponse): boolean {
	const target = path.resolve(root, rel);
	if (!target.startsWith(path.resolve(root) + path.sep)) return false;
	if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return false;
	serveFile(res, target);
	return true;
}

function handleHttp(req: http.IncomingMessage, res: http.ServerResponse): void {
	const s = session;
	if (!s) return notFound(res);
	const url = new URL(req.url ?? "/", "http://localhost");
	const pathname = decodeURIComponent(url.pathname);

	// token gate: editor entry + everything EXCEPT hashed static assets and
	// the mock bundle (which are localhost-only, non-sensitive artifacts)
	const tokenOk = url.searchParams.get("token") === s.token;
	if (!tokenOk && pathname !== "/" && !pathname.startsWith("/app/") && !pathname.startsWith("/__forge/") && !pathname.startsWith("/assets/")) {
		res.writeHead(401);
		res.end("bad token");
		return;
	}

	// editor build at / and /editor/*; hashed assets live at /assets/*
	if (pathname === "/" || pathname.startsWith("/editor/") || pathname.startsWith("/assets/")) {
		const rel =
			pathname === "/" ? "index.html"
			: pathname.startsWith("/assets/") ? pathname.slice(1)
			: pathname.slice("/editor/".length);
		if (!staticUnder(editorDistDir(), rel || "index.html", res)) {
			staticUnder(editorDistDir(), "index.html", res) || notFound(res);
		}
		return;
	}

	// mock app bundle: /app/<page>/ → dist/<page>/index.html; /app/... → dist/...
	if (pathname.startsWith("/app/")) {
		const rel = pathname.slice("/app/".length);
		if (rel === "" || rel.endsWith("/")) {
			const page = rel.replace(/\/$/, "");
			const file = path.join(s.cwd, "dist", page, "index.html");
			if (fs.existsSync(file)) serveFile(res, file);
			else notFound(res);
			return;
		}
		if (!staticUnder(path.join(s.cwd, "dist"), rel, res)) notFound(res);
		return;
	}

	// forge runtime + vendor scripts
	if (pathname === "/__forge/runtime.js") {
		serveFile(res, path.join(PLUGIN_DIR, "scripts", "runtime.js"));
		return;
	}
	if (pathname.startsWith("/__forge/vendor/")) {
		const vendor = pathname.slice("/__forge/vendor/".length);
		const vendorMap: Record<string, string> = {
			"html-to-image.js": path.join("html-to-image", "dist", "html-to-image.js"),
		};
		const file = vendorMap[vendor];
		if (file && staticUnder(path.join(PLUGIN_DIR, "node_modules"), file, res)) return;
		notFound(res);
		return;
	}

	notFound(res);
}

// --- WS hub --------------------------------------------------------------------------

function handleConnection(s: ForgeSession, ws: WebSocket, kind: "editor" | "shell"): void {
	s.clients.set(ws, kind);
	console.error(`[ui-forge] ${kind} client connected (total ${s.clients.size})`);
	ws.on("close", () => {
		s.clients.delete(ws);
		console.error(`[ui-forge] ${kind} client disconnected (total ${s.clients.size})`);
	});
	ws.on("message", (raw) => {
		let msg: Record<string, unknown>;
		try {
			msg = JSON.parse(String(raw));
		} catch {
			return;
		}

		if (msg.type === "hello" && kind === "editor") {
			// baseline: current world + phase (late joiners / reconnects)
			ws.send(
				JSON.stringify({
					type: "init",
					world: s.world,
					hashes: s.pageHashes,
					phase: s.phase,
					reviewId: s.reviewId,
					note: s.reviewNote,
				}),
			);
			return;
		}

		if (msg.type === "send-back" && kind === "editor") {
			const pending = s.pendingReview;
			if (pending && (msg as { reviewId: number }).reviewId === pending.reviewId) {
				s.pendingReview = null;
				s.phase = "idle";
				pending.resolve({
					approved: !!(msg as { approved?: boolean }).approved,
					closed: false,
					payload: ((msg as { payload?: object }).payload ?? {}) as ReviewPayload,
				});
				broadcastEditors(s, { type: "review-end" });
			}
			return;
		}

		if (msg.type === "capture-request" && kind === "editor") {
			// forward to the Electron shell, which owns webContents.capturePage
			const shell = shellClient(s);
			if (shell) {
				shell.send(JSON.stringify({ type: "forge:capture", reqId: (msg as { reqId: string }).reqId }));
			}
			return;
		}

		if (msg.type === "forge:capture-result" && kind === "shell") {
			// relay to editors: their pending captureCanvas() matches on reqId
			broadcastEditors(s, msg);
			return;
		}

		if (msg.type === "forge:eval" && kind === "editor") {
			// debug bridge: forward to the Electron shell for executeJavaScript
			const shell = shellClient(s);
			if (shell) {
				shell.send(
					JSON.stringify({
						type: "forge:eval",
						reqId: (msg as { reqId: string }).reqId,
						code: (msg as { code: string }).code,
					}),
				);
			}
			return;
		}

		if (msg.type === "forge:eval-result" && kind === "shell") {
			broadcastEditors(s, msg);
			return;
		}

		if (msg.type === "forge:page-shot-result" && kind === "shell") {
			const waiter = s.shotWaiters.get((msg as { reqId: string }).reqId);
			if (waiter) {
				s.shotWaiters.delete((msg as { reqId: string }).reqId);
				const dataUrl = (msg as { dataUrl?: string }).dataUrl ?? null;
				const page = (msg as { page?: string }).page ?? "unknown";
				waiter(dataUrl ? [{ page, image: dataUrl }] : []);
			}
			return;
		}

		if (msg.type === "page-shot-result" && kind === "editor") {
			const waiter = s.shotWaiters.get((msg as { reqId: string }).reqId);
			if (waiter) {
				s.shotWaiters.delete((msg as { reqId: string }).reqId);
				waiter((msg as { shots?: { page: string; image: string }[] }).shots ?? []);
			}
			return;
		}
	});
}

function broadcastEditors(s: ForgeSession, msg: Record<string, unknown>): void {
	for (const [client, kind] of s.clients) {
		if (kind === "editor" && client.readyState === WebSocket.OPEN) {
			client.send(JSON.stringify(msg));
		}
	}
}

function firstEditor(s: ForgeSession): WebSocket | null {
	for (const [client, kind] of s.clients) {
		if (kind === "editor" && client.readyState === WebSocket.OPEN) return client;
	}
	return null;
}

function shellClient(s: ForgeSession): WebSocket | null {
	for (const [client, kind] of s.clients) {
		if (kind === "shell" && client.readyState === WebSocket.OPEN) return client;
	}
	return null;
}

// --- session lifecycle -------------------------------------------------------------------

async function ensureSession(ctx: ExtensionContext): Promise<ForgeSession> {
	if (session && !session.closed) {
		// respawn the window if electron died but the server is alive
		if (!session.electron && !session.closed) spawnElectron(electronBin() ?? "electron", session);
		return session;
	}

	if (!fs.existsSync(editorDistDir())) {
		throw new Error("editor build missing — run `npm run build:editor` in the pi-ui-forge package");
	}
	const bin = electronBin();
	if (!bin) {
		throw new Error("electron binary missing — run `npm install` in the pi-ui-forge package");
	}

	const cwd = mockFolderDir(ctx);
	const token = crypto.randomBytes(16).toString("hex");

	const server = http.createServer(handleHttp);
	const wss = new WebSocketServer({ noServer: true });

	await new Promise<void>((resolve, reject) => {
		server.once("error", (error) => reject(new Error(`mock editor server failed: ${error}`)));
		server.listen(0, "127.0.0.1", () => resolve());
	});
	const port = (server.address() as { port: number }).port;

	server.on("upgrade", (req, socket, head) => {
		const url = new URL(req.url ?? "/", "http://localhost");
		if (url.searchParams.get("token") !== token) {
			socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
			socket.destroy();
			return;
		}
		const kind = url.searchParams.get("client") === "shell" ? "shell" : "editor";
		wss.handleUpgrade(req, socket, Buffer.alloc(0), (ws) => {
			handleConnection(session as ForgeSession, ws, kind);
		});
	});

	session = {
		cwd,
		server,
		wss,
		port,
		token,
		clients: new Map(),
		world: session?.world ?? { mocks: [] },
		pageHashes: session?.pageHashes ?? {},
		phase: "idle",
		reviewId: session?.reviewId ?? 0,
		reviewNote: null,
		pendingReview: null,
		shotWaiters: new Map(),
		electron: null,
		shotCounter: 0,
		closed: false,
	};

	writeForgeFiles(cwd, port, token);
	spawnElectron(bin, session);
	return session;
}

function writeForgeFiles(cwd: string, port: number, token: string): void {
	try {
		fs.writeFileSync(
			path.join(cwd, ".forge.json"),
			JSON.stringify(
				{ port, token, pluginDir: PLUGIN_DIR, editorUrl: `http://127.0.0.1:${port}/?token=${token}` },
				null,
				2,
			),
		);
		// (re)write build.mjs with the plugin path embedded
		const buildScript = fs.readFileSync(path.join(PLUGIN_DIR, "scripts", "build.mjs"), "utf8");
		fs.writeFileSync(path.join(cwd, "build.mjs"), buildScript.replace("__PLUGIN_DIR__", PLUGIN_DIR));
	} catch (error) {
		// .forge.json / build.mjs are conveniences, never fatal
		console.error("forge: failed to write session files:", error);
	}
}

function spawnElectron(bin: string, s: ForgeSession): void {
	const child = spawn(bin, ["--ozone-platform-hint=auto", shellMainPath(), editorUrl(s)], {
		stdio: ["ignore", "pipe", "pipe"],
	});
	child.stdout?.on("data", (d) => process.stdout.write(`[forge-shell] ${d}`));
	child.stderr?.on("data", (d) => process.stderr.write(`[forge-shell] ${d}`));
	s.electron = child;
	child.on("exit", () => {
		if (session !== s) return;
		s.electron = null;
		s.closed = true;
		s.phase = "closed";
		const pending = s.pendingReview;
		s.pendingReview = null;
		if (pending) {
			pending.resolve({ approved: false, closed: true, payload: emptyPayload() });
			broadcastEditors(s, { type: "session-closed" });
		}
	});
}

function editorUrl(s: ForgeSession): string {
	return `http://127.0.0.1:${s.port}/?token=${s.token}`;
}

function emptyPayload(): ReviewPayload {
	return { picked: [], description: "", comments: [], drawings: [], canvasImage: null };
}

// --- capture helpers -------------------------------------------------------------------------

/**
 * Page screenshots come from the shell's OFFSCREEN renderer (hidden window
 * loading /app/<page>/) — never from the live canvas: mock_build may add
 * pages the user hasn't been shown yet, and captures must not touch the
 * user's view. One request per page; results collected via shotWaiters.
 */
function sendPageShotRequest(
	s: ForgeSession,
	pages: string[] | null,
	timeoutMs: number,
): Promise<{ page: string; image: string }[]> {
	const shell = shellClient(s);
	if (!shell) return Promise.resolve([]);
	const pageNames = pages ?? s.world.mocks.flatMap((m) => m.pages);
	const unique = [...new Set(pageNames)];
	return Promise.all(
		unique.map(
			(page) =>
				new Promise<{ page: string; image: string } | null>((resolve) => {
					const reqId = crypto.randomBytes(6).toString("hex");
					const timer = setTimeout(() => {
						s.shotWaiters.delete(reqId);
						resolve(null);
					}, timeoutMs);
					s.shotWaiters.set(reqId, (shots) => {
						clearTimeout(timer);
						resolve(shots[0] ?? null);
					});
					shell.send(JSON.stringify({ type: "forge:page-shot", reqId, page }));
				}),
		),
	).then((results) => results.filter((x): x is { page: string; image: string } => x !== null));
}

function imageBlock(dataUrl: string): { type: "image"; data: string; mimeType: string } | null {
	const match = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(dataUrl);
	if (!match) return null;
	return { type: "image", data: match[2], mimeType: match[1] };
}

function saveImage(cwd: string, subdir: string, name: string, dataUrl: string): string | null {
	const match = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(dataUrl);
	if (!match) return null;
	const ext = match[1] === "image/jpeg" ? "jpg" : match[1] === "image/webp" ? "webp" : "png";
	const dir = path.join(cwd, subdir);
	fs.mkdirSync(dir, { recursive: true });
	const file = path.join(dir, `${name}.${ext}`);
	fs.writeFileSync(file, Buffer.from(match[2], "base64"));
	return file;
}

/**
 * Save the round's captures to disk. Nothing here goes inline to the model:
 * page renders and crops are returned as paths; the caller decides what to
 * read. Only the whole-canvas image is returned inline (it is the map of what
 * pages carry markup).
 */
function saveReviewArtifacts(
	cwd: string,
	payload: ReviewPayload,
	s: ForgeSession,
	pageShots: { page: string; image: string }[],
): { images: { canvas: string | null; pages: Record<string, string> } } {
	s.shotCounter += 1;
	const dir = `shots/r${s.shotCounter}`;
	const images: { canvas: string | null; pages: Record<string, string> } = { canvas: null, pages: {} };
	try {
		if (payload.canvasImage) {
			images.canvas = saveImage(cwd, dir, "canvas", payload.canvasImage) ?? null;
		}
		for (const shot of pageShots) {
			const file = saveImage(cwd, dir, shot.page, shot.image);
			if (file) images.pages[shot.page] = file;
		}
		let i = 0;
		for (const d of payload.drawings) {
			if (!d.image) continue;
			const file = saveImage(cwd, "ann", `r${s.shotCounter}-${d.page ?? "canvas"}-${i++}`, d.image);
			if (file) d.image = file; // replace dataURL with the path in the result JSON
		}
	} catch (error) {
		console.error("forge: failed to save review artifacts:", error);
	}
	return { images };
}

// --- build + world ------------------------------------------------------------------------------

async function runBuild(cwd: string): Promise<{ ok: boolean; tail: string }> {
	const buildScript = path.join(cwd, "build.mjs");
	if (!fs.existsSync(buildScript)) {
		throw new Error("no build.mjs in the mock folder — call mock_open first");
	}
	const proc = spawn("node", [buildScript], { cwd, stdio: ["ignore", "pipe", "pipe"] });
	const out: Buffer[] = [];
	proc.stdout?.on("data", (d) => out.push(d as Buffer));
	proc.stderr?.on("data", (d) => out.push(d as Buffer));
	const code = await new Promise<number>((resolve) => {
		proc.on("exit", (c) => resolve(c ?? 1));
		proc.on("error", () => resolve(1));
	});
	return { ok: code === 0, tail: Buffer.concat(out).toString().trim().slice(-4000) };
}

// Canvas ids are stable per-position (m0, m1, …) so labels can change freely
// across revisions without invalidating the tldraw persistence key — user
// annotations live in per-canvas IndexedDB stores keyed by this id.
function deriveWorldMock(m: { label: string; pages: string[] }, i: number): WorldMock {
	return { id: `m${i}`, label: m.label, pages: [...m.pages] };
}

// --- extension -----------------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "mock_open",
		label: "Open mock editor",
		description:
			"Start the UI mock editor (server + Electron window) for the mock app in the current working directory. Idempotent — safe to call again; respawns the window if it was closed.",
		parameters: Type.Object({
			title: Type.Optional(Type.String({ description: "Window title (informational)" })),
		}),
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			const s = await ensureSession(ctx);
			return {
				content: [
					{
						type: "text",
						text: `Mock editor open at ${editorUrl(s)} (mock folder: ${s.cwd})`,
					},
				],
				details: {},
			};
		},
	});

	pi.registerTool({
		name: "mock_build",
		label: "Build mock",
		description:
			"Build the mock app (node build.mjs, esbuild) and display the given pages. `mocks` describes the canvas layout: ONE entry with several pages = one canvas, pages as side-by-side frames (the standard later-stage view when the design has crystallized). SEVERAL single-page entries = multiple interpretations as separate canvases to pick between (use liberally early in design, sparingly later).",
		parameters: Type.Object({
			mocks: Type.Array(
				Type.Object({
					label: Type.String({ description: "Canvas/tab label, e.g. 'Option A' or 'Checkout'" }),
					pages: Type.Array(Type.String(), {
						description: "Page names from app/pages/ (e.g. 'home', 'picker')",
					}),
				}),
			),
		}),
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const build = await runBuild(mockFolderDir(ctx));
			if (!build.ok) {
				throw new Error(`mock build failed:\n${build.tail || "no output"}`);
			}
			const cwd = mockFolderDir(ctx);
			const manifest = JSON.parse(fs.readFileSync(path.join(cwd, "dist", "manifest.json"), "utf8")) as {
				pages: { name: string; hash: string }[];
			};
			const built = new Set(manifest.pages.map((p) => p.name));
			const missing = params.mocks.flatMap((m) => m.pages).filter((p) => !built.has(p));
			if (missing.length) {
				throw new Error(`pages not built (add to app/pages/ and rebuild): ${missing.join(", ")}`);
			}

			const world = { mocks: params.mocks.map(deriveWorldMock) };
			const hashes = Object.fromEntries(manifest.pages.map((p) => [p.name, p.hash]));
			const s = await ensureSession(ctx);
			s.world = world;
			s.pageHashes = { ...s.pageHashes, ...hashes };
			// NOTE: no GUI push here — the agent calls mock_build freely mid-turn
			// for self-inspection; the user's canvas only changes at mock_review.
			return {
				content: [
					{
						type: "text",
						text: `Built ${manifest.pages.length} page(s): ${manifest.pages.map((p) => p.name).join(", ")}. Displayed at next review: ${params.mocks
							.map((m) => `${m.label} → [${m.pages.join(", ")}]`)
							.join(" | ")}`,
					},
				],
				details: {},
			};
		},
	});

	pi.registerTool({
		name: "mock_screenshot",
		label: "Screenshot mock",
		description:
			"Capture mock pages as JPEG files under shots/ without changing the user's view (offscreen render — works for pages not yet on the canvas). Returns file PATHS; read them with your read tool as needed for self-inspection.",
		parameters: Type.Object({
			pages: Type.Optional(Type.Array(Type.String(), { description: "Page names; default: all pages in the last mock_build" })),
		}),
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const s = await ensureSession(ctx);
			if (s.closed || !shellClient(s)) {
				throw new Error("no editor window connected — call mock_open first");
			}
			const shots = await sendPageShotRequest(s, params.pages ?? null, 30000);
			if (!shots.length) {
				throw new Error("no screenshots captured (pages may have failed to load)");
			}
			s.shotCounter += 1;
			const dir = `shots/r${s.shotCounter}`;
			const files: string[] = [];
			for (const shot of shots) {
				const file = saveImage(s.cwd, dir, shot.page, shot.image);
				if (file) files.push(file);
			}
			// paths only — the model reads specific pages with its read tool when
			// it needs a zoomed view; inline images would accumulate in context
			return {
				content: [{ type: "text", text: `Screenshots saved (read with your read tool as needed):\n${files.join("\n")}` }],
				details: {},
			};
		},
	});

	pi.registerTool({
		name: "mock_review",
		label: "Ask user to review mock",
		description:
			"Hand the mock over to the user for markup. BLOCKS the tool call until the user sends annotations, approves the design, or closes the editor window. The result is the markup package: picked pages, typed description, text comments with CSS selectors, draw crops under ann/, and images of the full canvas plus each picked page.",
		parameters: Type.Object({
			note: Type.Optional(
				Type.String({ description: "Short note shown in the GUI: what changed, what to look at" }),
			),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const s = await ensureSession(ctx);
			if (s.closed) {
				return {
					content: [{ type: "text", text: JSON.stringify({ approved: false, closed: true }, null, 2) }],
					details: {},
				};
			}
			if (!firstEditor(s)) {
				throw new Error("no editor window connected — call mock_open first");
			}
			s.reviewId += 1;
			s.phase = "review";
			s.reviewNote = params.note ?? null;
			// the single GUI update point: pages built since the last review appear
			// on the canvas now, together with the hand-over
			broadcastEditors(s, {
				type: "set-world",
				world: s.world,
				hashes: s.pageHashes,
			});
			broadcastEditors(s, { type: "review-start", reviewId: s.reviewId, note: s.reviewNote });

			const result = await new Promise<ReviewResult>((resolve) => {
				s.pendingReview = { resolve, reviewId: s.reviewId };
				const onAbort = () => {
					if (s.pendingReview?.reviewId === s.reviewId) {
						s.pendingReview = null;
						resolve({ approved: false, closed: false, aborted: true, payload: emptyPayload() });
					}
				};
				signal?.addEventListener("abort", onAbort, { once: true });
			});
			s.phase = "idle";

			// page renders via the shell's offscreen window (picked pages, or all
			// displayed pages when the user picked none)
			const picked = result.payload.picked.length
				? result.payload.picked
				: s.world.mocks.flatMap((m) => m.pages);
			const pageShots = result.closed ? [] : await sendPageShotRequest(s, picked, 30000);
			const saved = saveReviewArtifacts(s.cwd, result.payload, s, pageShots);
			const summary = {
				approved: result.approved,
				closed: result.closed,
				picked: result.payload.picked,
				description: result.payload.description,
				comments: result.payload.comments,
				drawings: result.payload.drawings.map((d) => ({
					page: d.page,
					image: d.image,
					text: d.text,
				})),
				images: saved.images,
			};

			// Exactly one inline image per round: the whole-canvas view (downscaled
			// JPEG from the shell) showing which pages carry markup. Page renders
			// and draw crops are paths in the summary JSON; the model reads them
			// on demand with its read tool. Older rounds' images naturally age out
			// via compaction without any cache invalidation.
			const content: ({ type: "text"; text: string } | { type: "image"; data: string; mimeType: string })[] = [
				{ type: "text", text: JSON.stringify(summary, null, 2) },
			];
			{
				const push = (dataUrl: string | null | undefined) => {
					if (!dataUrl) return;
					const match = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(dataUrl);
					if (match) content.push({ type: "image", data: match[2], mimeType: match[1] });
				};
				push(result.payload.canvasImage);
			}

			return { content: content as never, details: {} };
		},
	});

	// --- provider request-size errors → targeted compaction --------------------
	//
	// Design rounds accumulate image blocks in the conversation (review canvas
	// shots, screenshot reads, pasted screenshots). Providers cap request size
	// (~5-8 MiB) and reject with 413 "Request body exceeds..." or a bodyless
	// 400. Instead of guessing a size threshold (which invalidates the prompt
	// cache too often), let the provider be the trigger: on an agent run that
	// fails with a request-size error, propose a compaction evicting the oldest
	// context (where the images live) and continue for exactly one retry.
	// Escalation: 50% → 25% → full cut; give up after three so genuine 400s
	// surface to the model instead of looping.
	const recovery = { attempts: 0, lastAt: 0 };
	const KEEP_FRACTIONS = [0.5, 0.25, 0] as const;
	const REQUEST_SIZE_ERROR = /status code 4(?:00|13)|request body exceeds/i;

	pi.on("agent_before_settle", (event) => {
		if (event.outcome === "completed") {
			recovery.attempts = 0;
			return;
		}
		if (event.outcome !== "error") return;

		const messages = event.context.contextMessages;
		const lastError = messages
			.slice()
			.reverse()
			.find((m) => (m as { stopReason?: string }).stopReason === "error") as
			| { errorMessage?: string }
			| undefined;
		if (!lastError?.errorMessage || !REQUEST_SIZE_ERROR.test(lastError.errorMessage)) return;

		const now = Date.now();
		if (now - recovery.lastAt > 120_000) recovery.attempts = 0;
		recovery.lastAt = now;
		if (recovery.attempts >= KEEP_FRACTIONS.length) return; // genuine failure — let it settle

		const keepFraction = KEEP_FRACTIONS[recovery.attempts];
		recovery.attempts += 1;
		const entries = event.context.contextEntries;
		const keepCount = Math.floor(entries.length * keepFraction);
		const firstKeptEntryId =
			keepCount > 0 ? entries[Math.max(0, entries.length - keepCount)].sourceEntry.id : null;

		console.error(
			`[ui-forge] ${lastError.errorMessage.trim()} — evicting oldest context (keeping ${keepCount}/${entries.length} entries) and retrying once`,
		);
		return {
			entries: [
				{
					type: "compaction" as const,
					summary:
						"[Older conversation evicted to fit the provider request-size limit. The authoritative design state lives in design-notes.md (the contract) and app/ in the mock folder; reference renders are under shots/. Recent context is retained below.]",
					firstKeptEntryId,
				},
			],
			continue: true,
		};
	});

	// --- live agent activity → editor progress -------------------------------
	//
	// The editor's working screen shows what the agent is doing. Every tool
	// call (the design agent's own tools included) is summarized into a short
	// label and pushed to connected editors.
	const activityLabel = (toolName: string, input: Record<string, unknown> | undefined): string => {
		const arg = input ?? {};
		const short = (v: unknown, n = 44) => (typeof v === "string" ? v.replace(/^.*[\\/]/, "").slice(0, n) : "");
		switch (toolName) {
			case "read":
				return `reading ${short(arg.path)}`;
			case "write":
				return `writing ${short(arg.path)}`;
			case "edit":
				return `editing ${short(arg.path)}`;
			case "bash":
				return `running ${short(arg.command, 56)}`;
			case "mock_build":
				return "building the mock";
			case "mock_screenshot":
				return "self-inspecting screenshots";
			case "mock_review":
				return "handing the mock over";
			case "mock_open":
				return "opening the editor";
			default:
				return `using ${toolName}`;
		}
	};
	pi.on("tool_call", (event) => {
		if (session && !session.closed) {
			broadcastEditors(session, {
				type: "activity",
				label: activityLabel(event.toolName, event.input as Record<string, unknown> | undefined),
			});
		}
	});
	pi.on("turn_start", () => {
		if (session && !session.closed) {
			broadcastEditors(session, { type: "activity", label: "thinking" });
		}
	});

	pi.on("session_shutdown", async () => {
		const s = session;
		if (!s) return;
		try {
			s.electron?.kill("SIGTERM");
		} catch {
			/* ignore */
		}
		try {
			s.wss.close();
			s.server.close();
		} catch {
			/* ignore */
		}
		s.closed = true;
		session = null;
	});
}
