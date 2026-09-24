// forge build script — lives in the mock folder (mock_folder/build.mjs).
// Written by the pi-ui-forge extension on session start with paths resolved
// against the plugin install. Builds every app/pages/<name>.tsx into
// dist/<name>/{index.html,bundle.js,bundle.css} + dist/manifest.json.
//
// Usage: node build.mjs [--pages name1,name2] (default: all pages)
// The mock app may import only `react` / `react-dom` (aliased to the plugin's
// pinned copies) and plain CSS files.

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

// Paths embedded by the extension when it wrote this file.
const PLUGIN_DIR = "__PLUGIN_DIR__";

function loadEsbuild() {
	const candidates = [join(PLUGIN_DIR, "node_modules", "esbuild"), "esbuild"];
	for (const candidate of candidates) {
		try {
			return require(candidate);
		} catch {
			// try next
		}
	}
	throw new Error(
		`esbuild not found (looked in ${candidates.join(", ")}) — call mock_open to rewrite this script`,
	);
}

const esbuild = loadEsbuild();
const pagesDir = join(here, "app", "pages");
const outDir = join(here, "dist");
if (!existsSync(pagesDir)) throw new Error("no app/pages directory in the mock folder");

const reactRoot = join(PLUGIN_DIR, "node_modules");
const alias = {
	react: join(reactRoot, "react"),
	"react/jsx-runtime": join(reactRoot, "react", "jsx-runtime.js"),
	"react/jsx-dev-runtime": join(reactRoot, "react", "jsx-dev-runtime.js"),
	"react-dom": join(reactRoot, "react-dom"),
	"react-dom/client": join(reactRoot, "react-dom", "client.js"),
};

const exts = [".tsx", ".jsx", ".ts", ".js"];
const allPages = readdirSync(pagesDir)
	.filter((f) => exts.some((e) => f.endsWith(e)))
	.map((f) => basename(f, exts.find((e) => f.endsWith(e))));

const argIndex = process.argv.indexOf("--pages");
const only = argIndex !== -1 && process.argv[argIndex + 1] ? process.argv[argIndex + 1].split(",") : null;

function pageHtml(name, hasCss) {
	return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>html, body, #root { margin: 0; min-height: 100%; }</style>
<script src="/__forge/vendor/html-to-image.js"></script>
<script src="/__forge/runtime.js"></script>
${hasCss ? `<link rel="stylesheet" href="./bundle.css" />` : ""}
</head>
<body data-forge-page="${name}">
<script>window.__FORGE_PAGE__ = ${JSON.stringify(name)};</script>
<div id="root"></div>
<script type="module" src="./bundle.js"></script>
</body>
</html>`;
}

function bootstrap(name, abs) {
	return `import { createRoot } from 'react-dom/client'
import React from 'react'
import Page from ${JSON.stringify(abs)}
createRoot(document.getElementById('root')).render(React.createElement(Page))
`;
}

const manifest = { builtAt: new Date().toISOString(), pages: [] };
mkdirSync(join(here, ".forge"), { recursive: true });

for (const name of allPages) {
	const ext = exts.find((e) => existsSync(join(pagesDir, name + e)));
	if (!ext) continue;
	if (only && !only.includes(name)) continue;

	const entry = join(here, ".forge", `entry-${name}.mjs`);
	writeFileSync(entry, bootstrap(name, join(pagesDir, name + ext)));

	mkdirSync(join(outDir, name), { recursive: true });
	await esbuild.build({
		entryPoints: [entry],
		outfile: join(outDir, name, "bundle.js"),
		bundle: true,
		format: "esm",
		target: "es2022",
		jsx: "automatic",
		jsxImportSource: "react",
		alias,
		loader: { ".svg": "dataurl", ".png": "dataurl", ".jpg": "dataurl" },
		logLevel: "warning",
		define: { "process.env.NODE_ENV": '"production"' },
	});

	writeFileSync(join(outDir, name, "index.html"), pageHtml(name, existsSync(join(outDir, name, "bundle.css"))));
	const hash = createHash("sha256")
		.update(readFileSync(join(outDir, name, "bundle.js")))
		// CSS is part of the page identity: a CSS-only rebuild must produce a new
		// hash or the editor's hot-swap reload never fires (stale-styles trap).
		.update(existsSync(join(outDir, name, "bundle.css")) ? readFileSync(join(outDir, name, "bundle.css")) : Buffer.alloc(0))
		.digest("hex")
		.slice(0, 12);
	manifest.pages.push({ name, hash });
}

writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`forge build ok: ${manifest.pages.map((p) => p.name).join(", ")} (${manifest.builtAt})`);
