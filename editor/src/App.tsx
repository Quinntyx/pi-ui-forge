import { useEffect, useState } from "react";
import "./forge.css";
import { MockCanvas, editors, usePickListener, type PickMessage } from "./canvas";
import {
	addCommentFromPick,
	setMode,
	setPickMode,
	setPickHover,
	highlight,
	removeComment,
	clearAllAnnotations,
	finalizePopup,
	cancelPopup,
} from "./annotate";
import { buildSendBack } from "./sendback";
import { connect, onMessage, send } from "./ws";
import { getState, setState, useSyncState, addPastedImage } from "./store";
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
					// reloading while a review is open must land in annotate, not in
					// the interact default (which hides the dock and ignores tools)
					if (msg.phase === "review" && getState().mode === "interact") setMode("annotate");
					break;
				case "set-world":
					applyWorld(msg.world);
					applyPageHashes(msg.hashes);
					break;
				case "review-start":
					// agent is now blocked waiting for the review — stop the clock
					setState({ phase: "review", reviewId: msg.reviewId, reviewNote: msg.note, workStartedAt: null });
					if (getState().mode === "interact") setMode("annotate");
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

	// keyboard: I interact, A annotate, P pick, Esc cancel
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			// Typing targets: form fields and tldraw's contenteditable text editor.
			// A text box that is being edited must swallow I/A/P — otherwise the
			// letters you type switch tools (and edit another shape at the same
			// time, because the edit was never closed).
			const target = e.target;
			const typing =
				(target instanceof HTMLElement &&
					(target.tagName === "INPUT" ||
						target.tagName === "TEXTAREA" ||
						target.tagName === "SELECT" ||
						target.isContentEditable)) ||
				[...editors.values()].some((editor) => !!editor.getEditingShape());
			if (e.key === "Escape") {
				// Consume it: tldraw's own Escape would reset the tool to select and
				// undo the tool we are about to restore.
				if (getState().popup) {
					cancelPopup();
					e.preventDefault();
					e.stopPropagation();
					return;
				}
				if (getState().pickMode) {
					setPickMode(false);
					e.preventDefault();
					e.stopPropagation();
					return;
				}
				// otherwise let tldraw see it (end editing, clear selection)
				return;
			}
			if (typing) return;
			if (e.key === "i" || e.key === "I") setMode("interact");
			if (e.key === "a" || e.key === "A") setMode("annotate");
			// pick is an annotation gesture: interact mode owns the pointer
			if ((e.key === "p" || e.key === "P") && getState().mode === "annotate") setPickMode(!getState().pickMode);
		};
		// capture: the handler has to run before tldraw's container listeners so a
		// consumed Escape never reaches them
		window.addEventListener("keydown", onKey, true);
		return () => window.removeEventListener("keydown", onKey, true);
	}, [activeEditor]);

	// While the comment popup is open its target stays lit and the inspect-hover
	// overlay is frozen (it would otherwise chase the pointer across the page
	// you are describing); both come back when the popup closes.
	const popupId = state.popup?.commentId ?? null;
	useEffect(() => {
		setPickHover(!popupId);
	}, [popupId]);

	// Reference images: keep the clipboard/drop bytes ourselves. tldraw also
	// receives these events and puts the picture on the canvas — that copy is
	// for the user's eyes; this copy is what the model gets a path to.
	useEffect(() => {
		const keep = (files: FileList | null | undefined) => {
			const { world, activeCanvas } = getState();
			// page attribution: the canvas in view (or the only one) when it has a single page
			const mock = world.mocks.find((m) => m.id === activeCanvas) ?? (world.mocks.length === 1 ? world.mocks[0] : undefined);
			const page = mock && mock.pages.length === 1 ? mock.pages[0] : null;
			for (const file of files ?? []) {
				if (!file.type.startsWith("image/")) continue;
				const reader = new FileReader();
				reader.onload = () => {
					if (typeof reader.result === "string") addPastedImage(reader.result, page);
				};
				reader.readAsDataURL(file);
			}
		};
		const onPaste = (e: ClipboardEvent) => keep(e.clipboardData?.files);
		const onDrop = (e: DragEvent) => keep(e.dataTransfer?.files);
		window.addEventListener("paste", onPaste);
		window.addEventListener("drop", onDrop);
		return () => {
			window.removeEventListener("paste", onPaste);
			window.removeEventListener("drop", onDrop);
		};
	}, []);

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
