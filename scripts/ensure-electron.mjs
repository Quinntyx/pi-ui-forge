// Root postinstall guard: guarantee the Electron binary actually exists after
// `npm install`. pi installs this package via `npm install --omit=dev` inside
// the checkout (after `git clean -fdx`), so `node_modules` — including any
// previously-downloaded Electron binary — is rebuilt from scratch every
// install. Electron's own install script normally downloads the binary, but
// that step can be skipped (script allowlists) or fail silently (flaky
// download from GitHub releases, cache miss), leaving `dist/electron` absent
// while npm still exits 0. This script detects that and force-runs
// electron/install.js; if the binary still can't be produced, it exits 1 so
// the surrounding `npm install` — and therefore `pi install` — FAILS loudly
// instead of shipping a forge that can't open its editor window.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const electronDir = join(pkgRoot, "node_modules", "electron");
const binaryName = process.platform === "win32" ? "electron.exe" : "electron";
const binary = join(electronDir, "dist", binaryName);

if (existsSync(binary)) {
	process.exit(0);
}

if (!existsSync(join(electronDir, "install.js"))) {
	console.error(
		`[pi-ui-forge] FATAL: node_modules/electron is not installed (no install.js at ${electronDir}).\n` +
			"[pi-ui-forge] Run `npm install` in this package first.",
	);
	process.exit(1);
}

console.error("[pi-ui-forge] electron binary missing — running electron/install.js ...");
const result = spawnSync(process.execPath, [join(electronDir, "install.js")], {
	stdio: "inherit",
	env: {
		...process.env,
		// Never let the fallback be a no-op: the binary is missing, so a
		// "skip the download" env var would defeat the whole point.
		ELECTRON_SKIP_BINARY_DOWNLOAD: "",
	},
});

if (result.status !== 0 || !existsSync(binary)) {
	console.error(
		`[pi-ui-forge] FATAL: the Electron binary could not be produced at ${binary}.\n` +
			"[pi-ui-forge] The forge editor requires it. Check network access to\n" +
			"[pi-ui-forge] GitHub releases (or ~/.cache/electron) and re-run `pi install`.",
	);
	process.exit(result.status ?? 1);
}

console.error("[pi-ui-forge] electron binary installed OK.");
