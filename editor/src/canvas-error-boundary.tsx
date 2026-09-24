// React error boundary per tldraw canvas: logs the full stack to the agent
// (via the shell bridge) and offers an in-place reload instead of tldraw's
// full-screen "reset your data" softlock.

import { Component, type ErrorInfo, type ReactNode } from "react";
import { consoleLogForAgent } from "./agent-log";

interface Props {
	children: ReactNode;
	label: string;
}

interface State {
	error: Error | null;
}

export class CanvasErrorBoundary extends Component<Props, State> {
	state: State = { error: null };

	static getDerivedStateFromError(error: Error): Partial<State> {
		return { error };
	}

	componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
		consoleLogForAgent(
			`canvas crash (${this.props.label})`,
			new Error(`${error.message}\n${info.componentStack ?? ""}`),
		);
	}

	render(): ReactNode {
		if (this.state.error) {
			return (
				<div className="forge-canvas-crash">
					<div>
						<strong>{this.props.label} hit an error</strong>
						<span>{this.state.error.message}</span>
						<button
							onClick={() => {
								this.setState({ error: null });
							}}
						>
							Retry
						</button>
						<button onClick={() => window.location.reload()}>Reload editor</button>
					</div>
				</div>
			);
		}
		return this.props.children;
	}
}
