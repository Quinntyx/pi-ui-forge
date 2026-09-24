// Editor-side logging that survives to the agent's tmux output: the Electron
// shell relays renderer console.error messages over its bridge.

export function consoleLogForAgent(context: string, detail: unknown): void {
	try {
		// eslint-disable-next-line no-console
		console.error(
			`[forge-editor] ${context}: ${
				detail instanceof Error ? `${detail.name}: ${detail.message}\n${detail.stack?.slice(0, 900) ?? ""}` : String(detail)
			}`,
		);
	} catch {
		/* logging must never throw */
	}
}
