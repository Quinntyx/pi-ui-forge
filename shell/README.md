# shell

Minimal Electron main process: one BrowserWindow loading
`http://127.0.0.1:<port>/<session>?token=...`, quits on window close
(process exit == window closed). `--ozone-platform-hint=auto` for Wayland.

Run: `npx electron shell/main.js <url>` — not implemented yet.
