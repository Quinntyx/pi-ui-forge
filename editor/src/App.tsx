import { useEffect, useState } from "react";
import "./forge.css";
import { MockCanvas, editors, usePickListener, type PickMessage } from "./canvas";
import {
	addCommentFromPick,
	setMode,
	setPickMode,
	highlight,
	removeComment,
	clearAllAnnotations,
	finalizePopup,
	cancelPopup,
} from "./annotate";
import { buildSendBack } from "./sendback";
import { connect, onMessage, send } from "./ws";
import { getState, setState, useSyncState } from "./store";
import { applyPageHashes } from "./hashes";
import { CommentPop, DockStack, ProgressBar, PromptStack, StatusLine, StylePanel, TopBar } from "./chrome";
import type { World } from "./types";
import type { Editor } from "tldraw";

export default function App() {
	const state = useSyncState();
	const [busy, setBusy] = useState(false);
	const [, force] = useState(0);

	// wire server messages → app state
	useEffect(() => {
		const off = onMessage((msg) => {
			switch (msg.type) {
				case "init":
					applyWorld(msg.world);
					applyPageHashes(msg.hashes);
					// joining mid-working-stretch: start the elapsed clock now (the
					// true start is unknowable client-side; review blocks it at null)
					setState({
						phase: msg.phase,
						reviewId: msg.reviewId,
						reviewNote: msg.note,
						workStartedAt: msg.phase === "review" ? null : Date.now(),
					});
					break;
				case "set-world":
					applyWorld(msg.world);
					applyPageHashes(msg.hashes);
					break;
				case "review-start":
					// agent is now blocked waiting for the review — stop the clock
					setState({ phase: "review", reviewId: msg.reviewId, reviewNote: msg.note, workStartedAt: null });
					if (getState().mode === "interact") setState({ mode: "annotate" });
					break;
				case "activity":
					setState({ activity: msg.activity ?? null });
					break;
				case "review-end":
					// the agent resumed after a send-back — restart the clock at 0
					setState({ phase: "idle", workStartedAt: Date.now() });
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

	// keep the popup positioned when the camera moves
	const activeEditor = state.activeCanvas ? (editors.get(state.activeCanvas) ?? null) : null;
	useEffect(() => {
		if (!activeEditor) return;
		return activeEditor.store.listen(() => force((n) => n + 1), { scope: "document" });
	}, [activeEditor]);

	const handlePick = (msg: PickMessage) => {
		try {
			if (addCommentFromPick(msg) === null) {
				console.error("[forge-editor] pick dropped: no matching frame/editor", msg);
			}
		} catch (error) {
			console.error("[forge-editor] pick handler failed", msg, error);
		}
	};
	usePickListener(handlePick);

	// keyboard: I interact, A annotate, P pick, Enter send/commit, Esc cancel
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
			if (e.key === "Escape") {
				if (getState().popup) cancelPopup();
				else if (getState().pickMode) setPickMode(false);
				return;
			}
			if (typing) return;
			if (e.key === "i" || e.key === "I") setMode("interact");
			if (e.key === "a" || e.key === "A") setMode("annotate");
			if (e.key === "p" || e.key === "P") {
				const on = !getState().pickMode;
				setPickMode(on);
				if (on && activeEditor) activeEditor.setCurrentTool("select");
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [activeEditor]);

	const doSend = async () => {
		setBusy(true);
		try {
			const payload = await buildSendBack(getState().reviewId, false);
			send({ type: "send-back", reviewId: getState().reviewId, approved: false, payload });
			clearAllAnnotations();
		} finally {
			setBusy(false);
		}
	};

	const doApprove = async () => {
		setBusy(true);
		try {
			const payload = await buildSendBack(getState().reviewId, true);
			send({ type: "send-back", reviewId: getState().reviewId, approved: true, payload });
			clearAllAnnotations();
		} finally {
			setBusy(false);
		}
	};

	const review = state.phase === "review";
	// interact is a real user mode (works even mid-review): it must hand the
	// pointer to the mock iframes
	const interact = state.mode === "interact";
	const reviewChrome = review && !interact;
	const working = !review && !interact;
	const visibleMocks = state.committedCanvas
		? state.world.mocks.filter((m) => m.id === state.committedCanvas)
		: state.world.mocks;
	const popupScreen = popupScreenCoords(state.popup?.x ?? 0, state.popup?.y ?? 0, activeEditor);

	return (
		<div
			className={`forge-root ${state.theme === "light" ? "light" : ""} ${interact ? "forge-interact" : ""} ${
				state.pickMode ? "forge-picking" : ""
			}`}
		>
			<TopBar onApprove={review ? doApprove : () => {}} />

			<main id="workspace">
				<section id="canvas-area">
					{visibleMocks.map((m) => (
						<MockCanvas key={m.id} mock={m} active={m.id === state.activeCanvas} />
					))}
					{!interact && state.phase !== "closed" && <DockStack editor={activeEditor} />}
					{!interact && state.phase !== "closed" && <StylePanel editor={activeEditor} />}

					{reviewChrome && <PromptStack onSend={doSend} busy={busy} />}
					{working && <ProgressBar />}
					{state.phase === "closed" && (
						<div className="forge-empty">session closed — you can close this window</div>
					)}
				</section>
			</main>

			<StatusLine />

			<CommentPop screen={popupScreen} onFinalize={finalizePopup} onCancel={cancelPopup} />
		</div>
	);
}

function popupScreenCoords(
	x: number,
	y: number,
	editor: Editor | null,
): { x: number; y: number } | null {
	if (!editor) return null;
	const p = editor.pageToScreen({ x, y });
	return { x: p.x, y: p.y };
}

function applyWorld(world: World) {
	const state = getState();
	const stillValid = world.mocks.some((m) => m.id === state.activeCanvas);
	setState({
		world,
		activeCanvas: stillValid ? state.activeCanvas : (world.mocks[0]?.id ?? null),
		// a fresh world (new proposal turn) resets any previous commit — keeping
		// it would pin the window to the previously committed option canvas and
		// hide the rest of the revised world
		committedCanvas: null,
	});
}

export { highlight, removeComment };
