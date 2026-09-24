// Global error capture: uncaught errors and promise rejections are logged to
// the console (the Electron shell relays them to the agent's tmux output), so
// tldraw's opaque "Something went wrong" screen never hides the stack.

import { consoleLogForAgent } from "./agent-log";

export function installErrorCapture(): void {
	window.addEventListener("error", (event) => {
		consoleLogForAgent("window.onerror", event.error ?? event.message);
	});
	window.addEventListener("unhandledrejection", (event) => {
		consoleLogForAgent("unhandledrejection", event.reason);
	});
}
