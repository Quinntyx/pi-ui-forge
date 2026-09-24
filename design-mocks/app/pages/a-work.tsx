import WikiMock from "../components/wiki";
import "./a.css";

/* state 2 — agent working: prompt bar replaced by a progress animation,
   status pill eliminated (the bar itself communicates the state) */

const pins = [
	{ n: 1, color: "yellow", selector: ".checkout-cta", text: "Filled green; outline reads disabled." },
	{ n: 2, color: "orange", selector: "#price-row", text: "Baseline the price with the title." },
	{ n: 3, color: "purple", selector: ".hero-title", text: "Flatten the shadow to match frame 2." },
];

const tools = [
	{ id: "select", active: true, title: "Select (V)", d: "M4.5 2.5v11l3-2.6 1.8 3.8 2.3-1.1-1.8-3.7h4l-9.3-7.4z" },
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

function Pin({ p, pos }: { p: typeof pins[number]; pos: string }) {
	return (
		<span className={`pin-wrap ${pos} ${pos === "pin-pos-hero" ? "tip-right" : ""}`}>
			<span className={`pin c-${p.color}`}>{p.n}</span>
			<span className="pin-tip">
				<code>{p.selector}</code>
				<span>{p.text}</span>
			</span>
		</span>
	);
}

export default function AWork() {
	return (
		<div className="app">
			<header id="topbar">
				<nav id="tabs">
					<button className="tab tab-active"><span className="tab-idx">0</span>wiki — light</button>
					<button className="tab"><span className="tab-idx">1</span>wiki — dark</button>
					<button className="tab"><span className="tab-idx">2</span>wiki — sepia</button>
				</nav>
				<div className="topbar-spring" />
				<div id="mode-toggle" role="group" aria-label="mode">
					<span className="mode-key">I</span><span className="mode-label">interact</span>
					<span className="mode-sep">/</span>
					<span className="mode-key mode-key-active">A</span><span className="mode-label mode-label-active">annotate</span>
				</div>
				<div id="pick-control" title="pick element — locked while the agent works">
					<button id="pick-btn" className="pick-btn-dim" disabled aria-label="pick element (locked)">
						<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
							<rect x="7" y="7" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.3" />
							<path d="M2.5 1.5v9.6l2.8-2.4 1.6 3.5 2-1-1.6-3.4h3.4z" fill="currentColor" />
						</svg>
					</button>
					<span className="mode-key">P</span>
				</div>
			</header>

			<main id="workspace">
				<section id="canvas-area">
					<div id="tool-dock" role="toolbar" aria-label="tools">
						{tools.map((t) => (
							<button key={t.id} className={`tool ${t.active ? "tool-active" : ""}`} title={t.title} aria-label={t.title}>
								<svg width="17" height="17" viewBox="0 0 16 16" aria-hidden="true">
									<path d={t.d} fill={t.id === "select" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
								</svg>
							</button>
						))}
					</div>

					<div id="style-panel" aria-label="style">
						<div className="sp-section" id="sp-fill">
							<span className="sp-icon"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M8 2C5.4 5.6 3.8 7.8 3.8 10a4.2 4.2 0 0 0 8.4 0C12.2 7.8 10.6 5.6 8 2z" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg></span>
							<div className="sp-grid">
								<button className="sp-cell" title="fill none"><span className="sp-glyph" style={{ width: 10, height: 10, border: "1px solid currentColor", display: "block" }} /></button>
								<button className="sp-cell" title="fill half"><span className="sp-glyph" style={{ width: 10, height: 10, border: "1px solid currentColor", background: "linear-gradient(135deg, transparent 50%, currentColor 50%)", display: "block" }} /></button>
								<button className="sp-cell" title="fill solid"><span className="sp-glyph" style={{ width: 10, height: 10, background: "currentColor", display: "block" }} /></button>
							</div>
						</div>
						<div className="sp-section" id="sp-dash">
							<span className="sp-icon"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M2 4h4M9 4h5M2 11h5M10 11h4" stroke="currentColor" strokeWidth="1.4" /></svg></span>
							<div className="sp-grid">
								<button className="sp-cell" title="solid"><span style={{ width: 12, borderTop: "2px solid currentColor", display: "block" }} /></button>
								<button className="sp-cell" title="dashed"><span style={{ width: 12, borderTop: "2px dashed currentColor", display: "block" }} /></button>
								<button className="sp-cell" title="dotted"><span style={{ width: 12, borderTop: "2px dotted currentColor", display: "block" }} /></button>
								<button className="sp-cell" title="drawn"><span style={{ width: 12, borderTop: "2px dotted currentColor", opacity: 0.6, display: "block" }} /></button>
							</div>
						</div>
						<div className="sp-section" id="sp-size">
							<span className="sp-icon"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M2 8h12M5 5L2 8l3 3M11 5l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg></span>
							<div className="sp-grid">
								<button className="sp-cell" title="S"><span className="sp-size-s">S</span></button>
								<button className="sp-cell" title="M"><span className="sp-size-m">M</span></button>
								<button className="sp-cell sp-cell-active" title="L"><span className="sp-size-l">L</span></button>
								<button className="sp-cell" title="XL"><span className="sp-size-xl">XL</span></button>
							</div>
						</div>
						<div className="sp-section" id="sp-color">
							<span className="sp-icon"><svg width="12" height="12" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M8 2.5v11a5.5 5.5 0 0 0 0-11z" fill="currentColor" /></svg></span>
							<div className="sp-grid sp-grid-2">
								{["grey", "red", "orange", "yellow", "green", "aqua", "blue", "purple"].map((c) => (
									<button key={c} className={`sp-cell ${c === "orange" ? "sp-cell-active" : ""}`} title={c}>
										<span className={`sp-swatch sw-${c}`}>{c === "orange" ? "✓" : ""}</span>
									</button>
								))}
							</div>
						</div>
					</div>

					<WikiMock review label="wiki — light · r3 → r4" />

					{/* agent working: banner + progress animation replace the prompt bar */}
					<div id="prompt-stack">
						<div id="review-banner">
							<span className="banner-round">R2</span>
							<span className="banner-text">
								Working on your markup — recropping the infobox image (<b>1</b>), rebalancing the TOC (<b>2</b>).
							</span>
						</div>
						<div id="progress-bar">
							<div className="progress-head">
								<span className="progress-spinner" />
								<span>revising wiki — light…</span>
							</div>
							<div className="progress-meta">round 2 · 1 page · started 12s ago · esc to interrupt</div>
						</div>
					</div>
				</section>
			</main>

			<footer id="statusline">
				<span className="sl-seg sl-seg-accent sl-seg-accent-working">WORKING</span>
				<span className="sl-seg">round 2 · revising 2 pages · 3 comments</span>
				<span className="sl-spring" />
				<span className="sl-seg sl-hint"><b>esc</b> interrupt</span>
			</footer>
		</div>
	);
}
