// Editor chrome — port of the approved "Statusline Console" design
// (design-mocks/app/components/chrome.tsx + a.css, converged r51) bound to
// the real editor state: tldraw tools/styles, pick mode, the review loop.

import { useEffect, useRef, useState } from "react";
import {
	DefaultColorStyle,
	DefaultDashStyle,
	DefaultFillStyle,
	DefaultSizeStyle,
	type Editor,
} from "tldraw";
import { getState, setState } from "./store";
import { setPickMode } from "./annotate";
import { useSyncState } from "./useSyncState";

// ── icons & tool table (port of the design's SVG tool set) ─────────────────

const TOOLS: { id: string; tldraw: string; title: string; d: string }[] = [
	{ id: "select", tldraw: "select", title: "Select (V)", d: "M4.5 2.5v11l3-2.6 1.8 3.8 2.3-1.1-1.8-3.7h4l-9.3-7.4z" },
	{ id: "hand", tldraw: "hand", title: "Hand (H)", d: "M6 8V4.4a.9.9 0 0 1 1.8 0V8m0-2.6a.9.9 0 0 1 1.8 0V8m0-1.4a.9.9 0 0 1 1.8 0V9m0-.6a.9.9 0 0 1 1.8 0v2.4c0 2.3-1.8 4-4.2 4-2 0-3-.8-4.2-2.6L4.3 10c-.5-.7.4-1.6 1.1-1l.6.5z" },
	{ id: "draw", tldraw: "draw", title: "Draw (D)", d: "M3 13.5l1-3.2 7-7 2.2 2.2-7 7-3.2 1zM10.2 4.1l2.2 2.2" },
	{ id: "eraser", tldraw: "eraser", title: "Eraser (E)", d: "M6.5 13.5H13M4.2 11.6l4.2-4.2 3.4 3.4-2.5 2.5H6.7l-2.5-2.5.9-.9 4.4-4.4 3.4 3.4" },
	{ id: "text", tldraw: "text", title: "Text (T)", d: "M3.5 3.5h9M8 3.5v9.5M6 13h4" },
	{ id: "shapes", tldraw: "geo", title: "Shapes (R)", d: "M3 3h6.5v6.5H3zM10.5 9.5a3 3 0 1 1 0 .01" },
	{ id: "note", tldraw: "note", title: "Note (N)", d: "M3 3h10v7l-3 3H3zM10 13v-3h3" },
	{ id: "arrow", tldraw: "arrow", title: "Arrow", d: "M3 13L13 3M13 3h-4.5M13 3v4.5" },
	{ id: "line", tldraw: "line", title: "Line (L)", d: "M3.5 12.5l9-9" },
	{ id: "frame", tldraw: "frame", title: "Frame (F)", d: "M4 2v12M12 2v12M2 4h12M2 12h12" },
];

const COLOR_MAP: Record<string, string> = {
	black: "black", grey: "grey", lavender: "light-violet", violet: "violet",
	sea: "blue", sky: "light-blue", yellow: "yellow", orange: "orange",
	olive: "light-green", lime: "green", coral: "light-red", red: "red",
};
const SWATCHES = Object.keys(COLOR_MAP);

function DashIcon({ kind }: { kind: "solid" | "dashed" | "dotted" | "thin" }) {
	const base = { cx: 8.5, cy: 8.5, r: 5.2, fill: "none", stroke: "currentColor" } as const;
	if (kind === "solid")
		return <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true"><circle {...base} strokeWidth={2.2} /></svg>;
	if (kind === "dashed")
		return <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true"><circle {...base} strokeWidth={1.8} strokeDasharray="2.8 2.4" /></svg>;
	if (kind === "dotted")
		return <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true"><circle {...base} strokeWidth={1.9} strokeDasharray="0.2 3.4" strokeLinecap="round" /></svg>;
	return <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true"><circle {...base} strokeWidth={1} /></svg>;
}

function FillIcon({ kind }: { kind: "none" | "half" | "full" | "pattern" }) {
	const front = kind === "full"
		? { fill: "currentColor", stroke: "currentColor", strokeWidth: 1.3 }
		: { fill: "none", stroke: "currentColor", strokeWidth: 1.3 };
	return (
		<svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true">
			<path d="M6.5 2.2h8v8" fill="none" stroke="currentColor" strokeWidth="1.1" />
			<path d="M4.5 4.2h8v8" fill="none" stroke="currentColor" strokeWidth="1.1" />
			<rect x="2.5" y="6.2" width="8" height="8" rx="1.5" {...front} />
			{kind === "half" && <path d="M2.5 10.2h8v4h-8z" fill="currentColor" />}
			{kind === "pattern" && (
				<g fill="currentColor">
					<circle cx="4.8" cy="9" r="0.9" /><circle cx="6.9" cy="9" r="0.9" /><circle cx="9" cy="9" r="0.9" />
					<circle cx="4.8" cy="11.6" r="0.9" /><circle cx="6.9" cy="11.6" r="0.9" /><circle cx="9" cy="11.6" r="0.9" />
				</g>
			)}
		</svg>
	);
}

// ── top bar ──────────────────────────────────────────────────────────────────

export function TopBar({ onApprove }: { onApprove: () => void }) {
	const state = useSyncState();
	const interact = state.mode === "interact";
	return (
		<header id="topbar">
			<div id="mode-toggle" role="group" aria-label="mode" onClick={() => setState({ mode: "interact" })}>
				{interact ? (
					<>
						<span className="mode-key mode-key-modeI-active">I</span><span className="mode-label mode-label-active">interact</span>
						<span className="mode-sep">/</span>
						<span className="mode-key" onClick={(e) => { e.stopPropagation(); setState({ mode: "annotate" }); }}>A</span><span className="mode-label" onClick={(e) => { e.stopPropagation(); setState({ mode: "annotate" }); }}>annotate</span>
					</>
				) : (
					<>
						<span className="mode-key" onClick={(e) => { e.stopPropagation(); setState({ mode: "interact" }); }}>I</span><span className="mode-label" onClick={(e) => { e.stopPropagation(); setState({ mode: "interact" }); }}>interact</span>
						<span className="mode-sep">/</span>
						<span className="mode-key mode-key-active">A</span><span className="mode-label mode-label-active">annotate</span>
					</>
				)}
			</div>
			<div className="topbar-spring" />
			<div className="topbar-right">
				<button
					id="theme-toggle"
					title={state.theme === "light" ? "switch to dark" : "switch to light"}
					aria-label="toggle theme"
					onClick={() => setState({ theme: state.theme === "light" ? "dark" : "light" })}
				>
					<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
						{state.theme === "light" ? (
							<path d="M8 2.2v2M8 11.8v2M2.2 8h2M11.8 8h2M4.1 4.1l1.4 1.4M10.5 10.5l1.4 1.4M11.9 4.1l-1.4 1.4M5.5 10.5l-1.4 1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
						) : (
							<path d="M12.5 9.5A5.5 5.5 0 0 1 6.5 3.5a5.5 5.5 0 1 0 6 6z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
						)}
					</svg>
				</button>
				{!interact && (
					<button id="topbar-approve" onClick={onApprove}>
						approve
					</button>
				)}
			</div>
		</header>
	);
}

// ── left rail: pick panel + tool dock ─────────────────────────────────────────

export function DockStack({ editor }: { editor: Editor | null }) {
	const state = useSyncState();
	const working = state.phase !== "review";
	// while the picker is armed it IS the active tool: no tldraw tool shows active
	const activeTool = state.pickMode ? null : editor ? editor.getCurrentToolId() : null;
	return (
		<div id="dock-stack">
			<div id="pick-panel" title="pick element (P) — cancels the selected tldraw tool" aria-label="pick element">
				<button
					id="pick-btn"
					disabled={working}
					className={state.mode === "annotate" && state.pickMode ? "pick-btn-on" : ""}
					aria-label="pick element (P)"
					onClick={() => {
						const on = !getState().pickMode;
						// setPickMode (not setState) so the pick-on message reaches
						// the page runtime inside every iframe
						setPickMode(on);
						if (on && editor) editor.setCurrentTool("select");
					}}
				>
					<svg width="17" height="17" viewBox="0 0 16 16" aria-hidden="true">
						<rect x="7" y="7" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.3" />
						<path d="M2.5 1.5v9.6l2.8-2.4 1.6 3.5 2-1-1.6-3.4h3.4z" fill="currentColor" />
					</svg>
				</button>
			</div>
			<div id="tool-dock" role="toolbar" aria-label="tools" aria-disabled={working}>
				{TOOLS.map((t) => (
					<button
						key={t.id}
						disabled={working}
						className={`tool ${activeTool === t.tldraw ? "tool-active" : ""}`}
						title={t.title}
						aria-label={t.title}
						onClick={() => {
							if (!editor) return;
							editor.setCurrentTool(t.tldraw);
							if (getState().pickMode) setState({ pickMode: false });
						}}
					>
						<svg width="17" height="17" viewBox="0 0 16 16" aria-hidden="true">
							<path
								d={t.d}
								fill={t.id === "select" && activeTool === t.tldraw ? "currentColor" : "none"}
								stroke="currentColor"
								strokeWidth="1.3"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</button>
				))}
			</div>
		</div>
	);
}

// ── tldraw style panel (Everforest reskin) ────────────────────────────────────

function firstSelected(editor: Editor | null): Record<string, unknown> | null {
	if (!editor) return null;
	for (const id of editor.getSelectedShapeIds()) {
		const shape = editor.getShape(id);
		if (shape && shape.type !== "mock-page" && shape.type !== "comment-pin") {
			return shape.props as unknown as Record<string, unknown>;
		}
	}
	return null;
}

export function StylePanel({ editor }: { editor: Editor | null }) {
	const [tick, setTick] = useState(0);
	useEffect(() => {
		if (!editor) return;
		return editor.store.listen(() => setTick((t) => t + 1), { scope: "document" });
	}, [editor]);
	const props = firstSelected(editor);
	const color = (props?.color as string) ?? "orange";
	const apply = (fn: (e: Editor) => void) => {
		if (editor) fn(editor);
	};
	return (
		<div id="style-panel" aria-label="style">
			<div className="sp-colors" id="sp-color">
				{SWATCHES.map((c) => (
					<button
						key={c}
						className={`sw k-${c}${color === COLOR_MAP[c] ? " sw-on" : ""}`}
						title={c}
						aria-label={c}
						onClick={() => apply((e) => e.setStyleForSelectedShapes(DefaultColorStyle, COLOR_MAP[c] as never))}
					/>
				))}
			</div>
			<div className="sp-slider-row" id="sp-opacity" title="opacity">
				<span className="sp-slider-fill" />
				<span className="sp-slider-thumb" />
			</div>
			<div className="sp-cells" id="sp-fill">
				<button className="sp-cell" title="fill none" onClick={() => apply((e) => e.setStyleForSelectedShapes(DefaultFillStyle, "none" as never))}><FillIcon kind="none" /></button>
				<button className="sp-cell" title="fill half" onClick={() => apply((e) => e.setStyleForSelectedShapes(DefaultFillStyle, "semi" as never))}><FillIcon kind="half" /></button>
				<button className={`sp-cell${props?.fill === "solid" || !props?.fill ? " sp-cell-active" : ""}`} title="fill solid" onClick={() => apply((e) => e.setStyleForSelectedShapes(DefaultFillStyle, "solid" as never))}><FillIcon kind="full" /></button>
				<button className="sp-cell" title="fill pattern" onClick={() => apply((e) => e.setStyleForSelectedShapes(DefaultFillStyle, "pattern" as never))}><FillIcon kind="pattern" /></button>
			</div>
			<div className="sp-cells" id="sp-dash">
				<button className={`sp-cell${props?.dash === "solid" || !props?.dash ? " sp-cell-active" : ""}`} title="dash solid" onClick={() => apply((e) => e.setStyleForSelectedShapes(DefaultDashStyle, "solid" as never))}><DashIcon kind="solid" /></button>
				<button className={`sp-cell${props?.dash === "dashed" ? " sp-cell-active" : ""}`} title="dash dashed" onClick={() => apply((e) => e.setStyleForSelectedShapes(DefaultDashStyle, "dashed" as never))}><DashIcon kind="dashed" /></button>
				<button className={`sp-cell${props?.dash === "dotted" ? " sp-cell-active" : ""}`} title="dash dotted" onClick={() => apply((e) => e.setStyleForSelectedShapes(DefaultDashStyle, "dotted" as never))}><DashIcon kind="dotted" /></button>
				<button className={`sp-cell${props?.dash === "none" ? " sp-cell-active" : ""}`} title="dash thin" onClick={() => apply((e) => e.setStyleForSelectedShapes(DefaultDashStyle, "none" as never))}><DashIcon kind="thin" /></button>
			</div>
			<div className="sp-cells" id="sp-size">
				<button className={`sp-cell${props?.size === "s" ? " sp-cell-active" : ""}`} title="size S" onClick={() => apply((e) => e.setStyleForSelectedShapes(DefaultSizeStyle, "s" as never))}><span className="sp-size-s">S</span></button>
				<button className={`sp-cell${props?.size === "m" || !props?.size ? " sp-cell-active" : ""}`} title="size M" onClick={() => apply((e) => e.setStyleForSelectedShapes(DefaultSizeStyle, "m" as never))}><span className="sp-size-m">M</span></button>
				<button className={`sp-cell${props?.size === "l" ? " sp-cell-active" : ""}`} title="size L" onClick={() => apply((e) => e.setStyleForSelectedShapes(DefaultSizeStyle, "l" as never))}><span className="sp-size-l">L</span></button>
				<button className={`sp-cell${props?.size === "xl" ? " sp-cell-active" : ""}`} title="size XL" onClick={() => apply((e) => e.setStyleForSelectedShapes(DefaultSizeStyle, "xl" as never))}><span className="sp-size-xl">XL</span></button>
			</div>
		</div>
	);
}

// ── floating prompt stack: banner + prompt bar ───────────────────────────────

export function PromptStack({
	onSend,
	busy,
}: {
	onSend: () => void;
	busy: boolean;
}) {
	const state = useSyncState();
	const ref = useRef<HTMLTextAreaElement>(null);
	const proposal = state.world.mocks.length > 1 && !state.committedCanvas;
	return (
		<div id="prompt-stack">
			<div id="review-banner">
				<span className="banner-round">R{state.reviewId || 1}</span>
				<span className="banner-text">{state.reviewNote ?? "Review the mock and send it back when you are happy."}</span>
			</div>
			<div id="prompt-bar">
				{proposal && (
					<div id="design-options" role="radiogroup" aria-label="proposed designs">
						{state.world.mocks.map((m, i) => (
							<button
								key={m.id}
								className={`do-chip ${m.id === state.activeCanvas ? "do-chip-on" : ""}`}
								aria-pressed={m.id === state.activeCanvas}
								onClick={() => setState({ activeCanvas: m.id, picked: [] })}
							>
								<span className="do-idx">{i}</span>
								{m.label}
							</button>
						))}
						<span className="do-hint">
							<b>⏎</b> continue with{" "}
							{state.world.mocks.find((m) => m.id === state.activeCanvas)?.label ?? ""}
						</span>
					</div>
				)}
				<div id="prompt-input-row">
					<span className="prompt-caret">›</span>
					<textarea
						ref={ref}
						rows={1}
						className="prompt-input"
						placeholder="Describe what you want changed (⏎ to send back)…"
						value={state.description}
						onChange={(e) => {
							setState({ description: e.target.value });
							e.target.style.height = "auto";
							e.target.style.height = `${e.target.scrollHeight}px`;
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey && !busy) {
								e.preventDefault();
								if (proposal) setState({ committedCanvas: state.activeCanvas });
								else onSend();
							}
						}}
					/>
					<button
						id="send-back"
						title="send back (⏎)"
						aria-label="send back"
						disabled={busy}
						onClick={() => {
							if (proposal) setState({ committedCanvas: state.activeCanvas });
							else onSend();
						}}
					>
						⏎
					</button>
				</div>
			</div>
		</div>
	);
}

// ── agent working state ──────────────────────────────────────────────────────

export function ProgressBar() {
	const state = useSyncState();
	const [, tick] = useState(0);
	// re-render once a second so the elapsed time ticks while the agent works
	useEffect(() => {
		const t = setInterval(() => tick((n) => n + 1), 1000);
		return () => clearInterval(t);
	}, []);
	const label = state.world.mocks.find((m) => m.id === state.activeCanvas)?.label;
	const hasWorld = state.world.mocks.length > 0;
	const act = state.activity;
	const calls = act?.calls?.filter((c) => c && c !== "mock_open") ?? [];
	const main = act
		? calls.length
			? `${act.label?.trim() || act.phase} — ${calls.join(", ")}`
			: act.label?.trim() || act.phase
		: hasWorld
			? `revising ${label} — ${state.description || "applying the last review"}`
			: "the design agent is starting";
	const elapsed = act?.elapsedMs ? ` · ${Math.round(act.elapsedMs / 1000)}s` : "";
	return (
		<div id="prompt-stack">
			<div id="progress-bar">
				<div className="progress-head">
					<span className="progress-spinner" />
					<span>{main}</span>
				</div>
				<div className="progress-meta">
					{hasWorld
						? `round ${Math.max(1, state.reviewId)}${elapsed} · esc to interrupt`
						: `no pages yet${elapsed} · pages appear when the agent hands the mock over · esc to interrupt`}
				</div>
			</div>
		</div>
	);
}

// ── statusline ───────────────────────────────────────────────────────────────

export function StatusLine() {
	const state = useSyncState();
	const phase = state.phase;
	const review = phase === "review";
	const interact = !review && state.mode === "interact";
	const count = state.comments.filter((c) => c.text.trim()).length;
	return (
		<footer id="statusline">
			{review && (
				<>
					<span className="sl-seg sl-seg-accent">REVIEW</span>
					<span className="sl-seg">
						round {state.reviewId} · {state.picked.length || 1} page{state.picked.length === 1 ? "" : "s"} picked · {count} comments
					</span>
					<span className="sl-spring" />
					<span className="sl-seg sl-hint"><b>⏎</b> send back</span>
					<span className="sl-seg sl-hint"><b>esc</b> cancel pick</span>
					<span className="sl-seg sl-hint"><b>P</b> pick element</span>
				</>
			)}
			{!review && !interact && (
				<>
					<span className="sl-seg sl-seg-accent sl-seg-accent-working">WORKING</span>
					<span className="sl-seg">the design agent is revising the mock</span>
					<span className="sl-spring" />
					<span className="sl-seg sl-hint"><b>esc</b> interrupt</span>
				</>
			)}
			{interact && (
				<>
					<span className="sl-seg sl-seg-accent sl-seg-accent-view">INTERACT</span>
					<span className="sl-seg">live mock — click it</span>
					<span className="sl-spring" />
					<span className="sl-seg sl-hint"><b>A</b> annotate</span>
				</>
			)}
		</footer>
	);
}

// ── popup comment editor (anchored at the picked pin) ───────────────────────

export function CommentPop({
	screen,
	onFinalize,
	onCancel,
}: {
	screen: { x: number; y: number } | null;
	onFinalize: () => void;
	onCancel: () => void;
}) {
	const state = useSyncState();
	const comment = state.comments.find((c) => c.id === state.popup?.commentId);
	if (!screen || !comment) return null;
	return (
		<div
			id="comment-pop"
			style={{ position: "fixed", left: screen.x - 125, top: screen.y - 118, width: 250 }}
		>
			<div className="pop-main">
				<code className="pop-sel">{comment.selector ?? "(canvas)"}</code>
				<input
					className="pop-input"
					autoFocus
					placeholder="What should change here?"
					value={comment.text}
					onChange={(e) => {
						const comments = getState().comments.map((c) =>
							c.id === comment.id ? { ...c, text: e.target.value } : c,
						);
						setState({ comments });
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter") onFinalize();
						if (e.key === "Escape") onCancel();
					}}
				/>
				<div className="pop-hint">
					<b>⏎</b> finalize comment · <b>esc</b> cancel
				</div>
			</div>
		</div>
	);
}
