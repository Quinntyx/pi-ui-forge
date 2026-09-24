import { useState } from "react";
import "../pages/a.css";
import WikiMock from "./wiki";
import GlassMock from "./glass";
import BrutalMock from "./brutal";

export type Design = "wiki" | "glass" | "brutal";
export type State = "annotate" | "work" | "interact";

const designs = [
	{ id: "wiki", name: "encyclopedia" },
	{ id: "glass", name: "liquid glass" },
	{ id: "brutal", name: "brutalist" },
];

const tools = [
	{ id: "select", active: false, title: "Select (V)", d: "M4.5 2.5v11l3-2.6 1.8 3.8 2.3-1.1-1.8-3.7h4l-9.3-7.4z" },
	{ id: "hand", active: false, title: "Hand (H)", d: "M6 8V4.4a.9.9 0 0 1 1.8 0V8m0-2.6a.9.9 0 0 1 1.8 0V8m0-1.4a.9.9 0 0 1 1.8 0V9m0-.6a.9.9 0 0 1 1.8 0v2.4c0 2.3-1.8 4-4.2 4-2 0-3-.8-4.2-2.6L4.3 10c-.5-.7.4-1.6 1.1-1l.6.5z" },
	{ id: "draw", active: false, title: "Draw (D)", d: "M3 13.5l1-3.2 7-7 2.2 2.2-7 7-3.2 1zM10.2 4.1l2.2 2.2" },
	{ id: "eraser", active: false, title: "Eraser (E)", d: "M6.5 13.5H13M4.2 11.6l4.2-4.2 3.4 3.4-2.5 2.5H6.7l-2.5-2.5.9-.9 4.4-4.4 3.4 3.4" },
	{ id: "text", active: false, title: "Text (T)", d: "M3.5 3.5h9M8 3.5v9.5M6 13h4" },
	{ id: "shapes", active: false, title: "Shapes (R)", d: "M3 3h6.5v6.5H3zM10.5 9.5a3 3 0 1 1 0 .01" },
	{ id: "note", active: false, title: "Note (N)", d: "M3 3h10v7l-3 3H3zM10 13v-3h3" },
	{ id: "arrow", active: false, title: "Arrow", d: "M3 13L13 3M13 3h-4.5M13 3v4.5" },
	{ id: "line", active: false, title: "Line (L)", d: "M3.5 12.5l9-9" },
	{ id: "frame", active: false, title: "Frame (F)", d: "M4 2v12M12 2v12M2 4h12M2 12h12" },
];

// tldraw-exact 2×5 palette, reskinned to Everforest
const tldColors = [
	{ id: "bone", v: "#d3c6aa" },
	{ id: "grey", v: "#859289" },
	{ id: "ink", v: "#272e33" },
	{ id: "purple", v: "#d699b6" },
	{ id: "red", v: "#e67e80" },
	{ id: "orange", v: "#e69875" },
	{ id: "yellow", v: "#dbbc7f" },
	{ id: "green", v: "#a7c080" },
	{ id: "aqua", v: "#83c092" },
	{ id: "blue", v: "#7fbbb3" },
];

export default function Chrome({ design, state }: { design: Design; state: State }) {
	const [light, setLight] = useState(false);
	const annotate = state === "annotate";
	const interact = state === "interact";
	const Mock = design === "wiki" ? WikiMock : design === "glass" ? GlassMock : BrutalMock;
	const mockVariant = annotate ? "annotate" : state === "work" ? "work" : "plain";
	const dname = designs.find((d) => d.id === design)?.name ?? design;
	const label = state === "work" ? `${dname} · r3 → r4` : `${dname} · r3`;

	return (
		<div className={`app ${light ? "light" : ""}`}>
			<header id="topbar">
				<nav id="tabs">
					{designs.map((d, i) => (
						<button key={d.id} className={`tab ${d.id === design ? "tab-active" : ""}`}>
							<span className="tab-idx">{i}</span>{d.name}
						</button>
					))}
				</nav>
				<div className="topbar-spring" />
				<button id="theme-toggle" title={light ? "switch to dark" : "switch to light"} aria-label="toggle theme" onClick={() => setLight(!light)}>
					<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
						{light ? (
							<path d="M8 2.2v2M8 11.8v2M2.2 8h2M11.8 8h2M4.1 4.1l1.4 1.4M10.5 10.5l1.4 1.4M11.9 4.1l-1.4 1.4M5.5 10.5l-1.4 1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
						) : (
							<path d="M12.5 9.5A5.5 5.5 0 0 1 6.5 3.5a5.5 5.5 0 1 0 6 6z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
						)}
					</svg>
				</button>
				{interact ? (
					<div id="mode-toggle" role="group" aria-label="mode">
						<span className="mode-key mode-key-modeI-active">I</span><span className="mode-label mode-label-active">interact</span>
						<span className="mode-sep">/</span>
						<span className="mode-key">A</span><span className="mode-label">annotate</span>
					</div>
				) : (
					<>
						<div id="mode-toggle" role="group" aria-label="mode">
							<span className="mode-key">I</span><span className="mode-label">interact</span>
							<span className="mode-sep">/</span>
							<span className="mode-key mode-key-active">A</span><span className="mode-label mode-label-active">annotate</span>
						</div>
						{annotate && <button id="topbar-approve">approve</button>}
					</>
				)}
			</header>

			<main id="workspace">
				<section id="canvas-area">
					<div id="canvas-scroll">
						<div className="canvas-content">
							<Mock variant={mockVariant} label={label} />
						</div>
					</div>

					{!interact && (
						<>
							<div id="dock-stack">
								<div id="pick-panel" title="pick element (P) — cancels the selected tldraw tool" aria-label="pick element">
									<button id="pick-btn" className={annotate ? "pick-btn-on" : state === "work" ? "pick-btn-dim" : ""} disabled={state === "work"} aria-label="pick element (P)">
										<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
											<rect x="7" y="7" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.3" />
											<path d="M2.5 1.5v9.6l2.8-2.4 1.6 3.5 2-1-1.6-3.4h3.4z" fill="currentColor" />
										</svg>
									</button>
									<span className="mode-key">P</span>
								</div>
								<div id="tool-dock" role="toolbar" aria-label="tools">
								{tools.map((t) => (
									<button key={t.id} className={`tool ${t.active ? "tool-active" : ""}`} title={t.title} aria-label={t.title}>
										<svg width="17" height="17" viewBox="0 0 16 16" aria-hidden="true">
											<path d={t.d} fill={t.id === "select" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
										</svg>
									</button>
								))}
								</div>
							</div>

							<div id="style-panel" aria-label="style">
								<div className="sp-colors" id="sp-color">
									{tldColors.map((c) => (
										<button key={c.id} className={`sw ${c.id === "orange" ? "sw-on" : ""}`} title={c.id} style={{ background: c.v }} aria-label={c.id} />
									))}
								</div>
								<div className="sp-slider-row" id="sp-opacity" title="opacity">
									<span className="sp-slider-fill" />
									<span className="sp-slider-thumb" />
								</div>
								<div className="sp-cells" id="sp-dash">
									<button className="sp-cell sp-cell-active" title="dash solid"><span className="d-solid" /></button>
									<button className="sp-cell" title="dash dashed"><span className="d-dashed" /></button>
									<button className="sp-cell" title="dash dotted"><span className="d-dotted" /></button>
									<button className="sp-cell" title="dash mixed"><span className="d-mixed" /></button>
								</div>
								<div className="sp-cells" id="sp-fill">
									<button className="sp-cell" title="fill none"><span className="g-none" /></button>
									<button className="sp-cell" title="fill half"><span className="g-half" /></button>
									<button className="sp-cell" title="fill solid"><span className="g-full" /></button>
									<button className="sp-cell sp-cell-active" title="fill pattern"><span className="g-hatch" /></button>
								</div>
								<div className="sp-cells" id="sp-size">
									<button className="sp-cell" title="size S"><span className="sp-size-s">S</span></button>
									<button className="sp-cell" title="size M"><span className="sp-size-m">M</span></button>
									<button className="sp-cell sp-cell-active" title="size L"><span className="sp-size-l">L</span></button>
									<button className="sp-cell" title="size XL"><span className="sp-size-xl">XL</span></button>
								</div>
							</div>
						</>
					)}

					{annotate && (
						<div id="prompt-stack">
							<div id="review-banner">
								<span className="banner-round">R1</span>
								<span className="banner-text">
									First pass on this design — check the image crop (<b>1</b>) and heading spacing (<b>2</b>).
								</span>
							</div>
							<div id="prompt-bar">
								<div id="prompt-input-row">
									<span className="prompt-caret">›</span>
									<input
										className="prompt-input"
										defaultValue="Switched the mock to a light theme; image crop is 4:3 now."
										aria-label="describe the change"
									/>
									<button id="send-back" title="send back (⏎)" aria-label="send back">⏎</button>
								</div>
							</div>
						</div>
					)}

					{state === "work" && (
						<div id="prompt-stack">
							<div id="review-banner">
								<span className="banner-round">R2</span>
								<span className="banner-text">
									Working on your markup — recropping the image (<b>1</b>), rebalancing the heading (<b>2</b>).
								</span>
							</div>
							<div id="progress-bar">
								<div className="progress-head">
									<span className="progress-spinner" />
									<span>revising {designs.find((d) => d.id === design)?.name}…</span>
								</div>
								<div className="progress-meta">round 2 · 1 page · started 12s ago · esc to interrupt</div>
							</div>
						</div>
					)}
				</section>
			</main>

			<footer id="statusline">
				{annotate && (
					<>
						<span className="sl-seg sl-seg-accent">REVIEW</span>
						<span className="sl-seg">round 1 · 1 page picked · 4 comments</span>
						<span className="sl-spring" />
						<span className="sl-seg sl-hint"><b>⏎</b> send back</span>
						<span className="sl-seg sl-hint"><b>esc</b> cancel pick</span>
						<span className="sl-seg sl-hint"><b>P</b> pick element</span>
					</>
				)}
				{state === "work" && (
					<>
						<span className="sl-seg sl-seg-accent sl-seg-accent-working">WORKING</span>
						<span className="sl-seg">round 2 · revising 1 page · 4 comments</span>
						<span className="sl-spring" />
						<span className="sl-seg sl-hint"><b>esc</b> interrupt</span>
					</>
				)}
				{interact && (
					<>
						<span className="sl-seg sl-seg-accent sl-seg-accent-view">INTERACT</span>
						<span className="sl-seg">viewing r3 · read-only</span>
						<span className="sl-spring" />
						<span className="sl-seg sl-hint"><b>A</b> annotate</span>
					</>
				)}
			</footer>
		</div>
	);
}
