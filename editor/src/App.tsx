import { useEffect, useState } from "react";
import "./app.css";
import { MockCanvas, usePickListener, type PickMessage } from "./canvas";
import { addCommentFromPick, setMode, setPickMode, highlight, removeComment } from "./annotate";
import { buildSendBack } from "./sendback";
import { connect, onMessage, send } from "./ws";
import { getState, setState, useSyncState } from "./store";
import { applyPageHashes } from "./hashes";
import type { World } from "./types";

export default function App() {
	const state = useSyncState();

	// wire server messages → app state
	useEffect(() => {
		const off = onMessage((msg) => {
			switch (msg.type) {
				case "init":
					applyWorld(msg.world);
					applyPageHashes(msg.hashes);
					setState({ phase: msg.phase, reviewId: msg.reviewId, reviewNote: msg.note });
					break;
				case "set-world":
					applyWorld(msg.world);
					applyPageHashes(msg.hashes);
					break;
				case "review-start":
					setState({ phase: "review", reviewId: msg.reviewId, reviewNote: msg.note });
					setMode("annotate");
					break;
				case "review-end":
					setState({ phase: "idle" });
					setMode("interact");
					break;
				case "session-closed":
					setState({ phase: "closed" });
					break;
				default:
					break;
			}
		});
		connect();
		return () => {
			off();
		};
	}, []);

	const handlePick = (msg: PickMessage) => {
		addCommentFromPick(msg);
	};

	usePickListener(handlePick);

	const active = state.world.mocks.find((m) => m.id === state.activeCanvas) ?? null;

	return (
		<div
			className={`forge-root ${state.mode === "interact" ? "forge-interact" : ""} ${
				state.pickMode ? "forge-picking" : ""
			}`}
		>
			<header className="forge-topbar">
				<div className="forge-title">UI Mock Forge</div>
				<nav className="forge-tabs">
					{state.world.mocks.map((m) => (
						<button
							key={m.id}
							className={`forge-tab ${m.id === state.activeCanvas ? "active" : ""}`}
							onClick={() => setState({ activeCanvas: m.id, picked: [] })}
						>
							{m.label}
						</button>
					))}
				</nav>
				<div className="forge-modes">
					<button
						className={state.mode === "interact" ? "active" : ""}
						onClick={() => setMode("interact")}
					>
						Interact
					</button>
					<button
						className={state.mode === "annotate" ? "active" : ""}
						onClick={() => setMode("annotate")}
					>
						Annotate
					</button>
					{state.mode === "annotate" && (
						<button
							className={state.pickMode ? "picking" : ""}
							onClick={() => setPickMode(!state.pickMode)}
						>
							{state.pickMode ? "Picking…" : "Pick element"}
						</button>
					)}
				</div>
				<div className="forge-status">
					<span className={`dot ${state.connected ? "on" : "off"}`} />
					{state.phase === "review" && <span className="phase">review round {state.reviewId}</span>}
					{state.phase === "idle" && <span className="phase">awaiting markup</span>}
					{state.phase === "closed" && <span className="phase">session closed</span>}
				</div>
			</header>

			{state.phase === "review" && (
				<div className="forge-banner">{state.reviewNote ?? "The agent is waiting for your markup."}</div>
			)}

			{state.phase === "closed" && (
				<div className="forge-banner closed">Session closed — you can close this window.</div>
			)}

			<main className="forge-main">
				{state.world.mocks.map((m) => (
					<MockCanvas key={m.id} mock={m} active={m.id === state.activeCanvas} />
				))}
				{state.world.mocks.length === 0 && (
					<div className="forge-empty">
						Waiting for the design agent to build pages…
						<span>It writes React into the mock folder and calls mock_build.</span>
					</div>
				)}
			</main>

			{state.phase === "review" && active && <ReviewSidebar canvasId={active.id} />}
		</div>
	);
}

function applyWorld(world: World) {
	const state = getState();
	const stillValid = world.mocks.some((m) => m.id === state.activeCanvas);
	setState({
		world,
		activeCanvas: stillValid ? state.activeCanvas : (world.mocks[0]?.id ?? null),
	});
}

function ReviewSidebar({ canvasId }: { canvasId: string }) {
	const state = useSyncState();
	const [busy, setBusy] = useState(false);
	const mock = state.world.mocks.find((m) => m.id === canvasId)!;
	if (!mock) return null;

	const doSend = async (approved: boolean) => {
		setBusy(true);
		try {
			const payload = await buildSendBack(state.reviewId, approved);
			send({ type: "send-back", reviewId: state.reviewId, approved, payload });
		} finally {
			setBusy(false);
		}
	};

	return (
		<aside className="forge-sidebar">
			<h3>Describe the change</h3>
			<textarea
				className="desc"
				placeholder="Describe what you want changed (the agent reads this first)…"
				value={state.description}
				onChange={(e) => setState({ description: e.target.value })}
			/>

			<h3>Picked pages</h3>
			<div className="forge-pages">
				{mock.pages.map((page) => (
					<label key={page}>
						<input
							type="checkbox"
							checked={state.picked.includes(page)}
							onChange={(e) => {
								const picked = e.target.checked
									? [...state.picked, page]
									: state.picked.filter((p) => p !== page);
								setState({ picked });
							}}
						/>
						{page}
					</label>
				))}
			</div>

			<h3>Comments ({state.comments.length})</h3>
			<ul className="forge-comments">
				{state.comments.map((c, i) => (
					<li key={c.id}>
						<div className="c-head">
							<span className="num">{i + 1}</span>
							<code title={c.selector ?? ""}>{c.selector ?? "(none)"}</code>
							<button title="Remove" onClick={() => removeComment(c.id)}>
								×
							</button>
						</div>
						<textarea
							placeholder="What's wrong here?"
							value={c.text}
							onFocus={() => highlight(c.page, c.selector, true)}
							onBlur={() => highlight(c.page, c.selector, false)}
							onChange={(e) => {
								const comments = state.comments.map((x) =>
									x.id === c.id ? { ...x, text: e.target.value } : x,
								);
								setState({ comments });
							}}
						/>
					</li>
				))}
				{state.comments.length === 0 && (
					<li className="hint">Use “Pick element” in annotate mode to tag specific elements.</li>
				)}
			</ul>

			<div className="forge-sidebar-actions">
				<button className="primary" disabled={busy} onClick={() => doSend(false)}>
					{busy ? "Sending…" : "Send back"}
				</button>
				<button className="approve" disabled={busy} onClick={() => doSend(true)}>
					Approve design
				</button>
			</div>
		</aside>
	);
}
