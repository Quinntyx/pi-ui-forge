// Smoke test harness: load the forge extension (as pi would, via jiti),
// exercise mock_open → mock_screenshot against a real editor + Electron
// window, print results, tear down. Not part of the runtime.
import { createRequire } from "node:module";

const require = createRequire("/home/zlare/.npm-global/lib/node_modules/@earendil-works/pi-coding-agent/");
const { createJiti } = require("jiti");

const jiti = createJiti(import.meta.url, { interopDefault: true });
const extension = await jiti.import("/home/zlare/docs/src/pi-ui-forge/main/index.ts");

const tools = {};
const handlers = {};
const piStub = {
	registerTool: (t) => {
		tools[t.name] = t;
	},
	registerCommand: () => {},
	on: (event, fn) => {
		handlers[event] = fn;
	},
};
extension.default(piStub);

const ctx = { cwd: "/tmp/forge-smoke" };
const noop = () => {};

const opened = await tools.mock_open.execute("t1", {}, undefined, noop, ctx);
console.log("mock_open →", opened.content[0].text);

await new Promise((r) => setTimeout(r, 8000)); // electron boot + editor connect

await tools.mock_build.execute(
	"t1b",
	{ mocks: [{ label: "Home", pages: ["home"] }] },
	undefined,
	noop,
	ctx,
).then(
	(r) => console.log("mock_build →", r.content[0].text),
	(e) => console.log("mock_build FAILED →", e.message),
);

await new Promise((r) => setTimeout(r, 4000)); // iframe load + settle

const shots = await tools.mock_screenshot.execute(
	"t2",
	{ pages: ["home"] },
	undefined,
	noop,
	ctx,
);
for (const block of shots.content) {
	if (block.type === "text") console.log("mock_screenshot →", block.text);
	else console.log("  image:", block.mimeType, `${block.data.length} chars base64`);
}

handlers.session_shutdown?.().catch?.(() => {});
process.exit(0);
