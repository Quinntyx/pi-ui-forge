import "./c.css";

const comments = [
	{ n: 1, selector: ".checkout-cta", text: "Filled green; outline reads disabled." },
	{ n: 2, selector: "#price-row", text: "Baseline the price with the title." },
	{ n: 3, selector: ".hero-title", text: "Flatten the shadow to match frame 2." },
];

const picked = [
	{ name: "checkout", on: true },
	{ name: "home", on: true },
	{ name: "picker", on: false },
];

function Pin({ n, className = "" }: { n: number; className?: string }) {
	return <span className={`pin ${className}`}>{n}</span>;
}

export default function C() {
	return (
		<div className="app">
			<header id="topbar">
				<div id="app-identity">ui-mock-forge</div>
				<nav id="tabs">
					<button className="tab tab-active"><span className="tab-idx">0</span>Option A</button>
					<button className="tab"><span className="tab-idx">1</span>Checkout</button>
					<button className="tab"><span className="tab-idx">2</span>home</button>
				</nav>
				<div className="topbar-spring" />
				<div id="mode-toggle" role="group" aria-label="mode">
					<span className="mode-key">I</span><span className="mode-label">interact</span>
					<span className="mode-sep">/</span>
					<span className="mode-key mode-key-active">A</span><span className="mode-label mode-label-active">annotate</span>
				</div>
				<button id="pick-toggle">
					<svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
						<path d="M6 0v4M6 8v4M0 6h4M8 6h4" stroke="currentColor" strokeWidth="1.4" />
						<circle cx="6" cy="6" r="1.6" fill="currentColor" />
					</svg>
					pick-element <span className="mode-key">P</span>
				</button>
				<div id="status-pill"><span className="status-dot" />awaiting markup</div>
			</header>

			<div id="review-banner">
				<span className="banner-round">R1</span>
				<span className="banner-text">
					CTA hierarchy + hero spacing reworked — check pin <b>1</b>, price baseline in <b>2</b>.
				</span>
				<span className="banner-hint">comments land in sidebar →</span>
			</div>

			<main id="workspace">
				<section id="canvas-area">
					<div className="frame" style={{ width: 430 }}>
						<div className="frame-label">checkout · r3</div>
						<div className="frame-body">
							<div className="mini-topbar">
								<span className="mini-dot" /><span className="mini-dot" /><span className="mini-dot" />
								<span className="mini-crumb">checkout</span>
							</div>
							<div className="mini-title">Checkout</div>
							<div className="mini-row" id="price-row">
								<span>Order total</span>
								<span className="mini-price">$48.00</span>
							</div>
							<div className="mini-line" style={{ width: "72%" }} />
							<div className="mini-line" style={{ width: "55%" }} />
							<button className="mini-btn checkout-cta" id="checkout-cta">Complete order — $48.00</button>
							<Pin n={1} className="pin-pos-cta" />
							<Pin n={2} className="pin-pos-price" />
						</div>
					</div>

					<div className="frame frame-selected" style={{ width: 390 }}>
						<div className="frame-label">home · r3</div>
						<div className="frame-body">
							<div className="mini-topbar">
								<span className="mini-dot" /><span className="mini-dot" /><span className="mini-dot" />
								<span className="mini-crumb">home</span>
							</div>
							<div className="hero-title">Build faster.</div>
							<div className="mini-line" style={{ width: "80%" }} />
							<div className="mini-line" style={{ width: "64%" }} />
							<div className="mini-cards">
								<div className="mini-card" /><div className="mini-card" /><div className="mini-card" />
							</div>
							<Pin n={3} className="pin-pos-hero" />
						</div>
					</div>

					<div className="state-strip">
						<div className="state-card" id="empty-state-preview">
							<div className="state-card-label">empty state</div>
							<div className="state-card-body">
								<span className="state-glyph">◇</span>
								<span>Waiting for the design agent to build pages…</span>
							</div>
						</div>
						<div className="state-card" id="closed-state-preview">
							<div className="state-card-label">closed state</div>
							<div className="state-card-body">
								<span className="state-ok">✓</span>
								<span>session closed — design approved · 3 rounds</span>
							</div>
						</div>
					</div>
				</section>

				<aside id="sidebar">
					<div className="sidebar-head">review — round 1</div>

					<div id="describe-block">
						<label className="side-label" htmlFor="describe-input">describe-the-change</label>
						<textarea id="describe-input" rows={3} defaultValue="Revised checkout CTA + hero spacing. CTA is now the only filled element on the page." />
					</div>

					<div id="picked-pages">
						<label className="side-label">picked-pages</label>
						{picked.map((p) => (
							<label className="pick-row" key={p.name}>
								<input type="checkbox" defaultChecked={p.on} />
								<span className="pick-name">{p.on ? "x" : " "}&nbsp;{p.name}</span>
							</label>
						))}
					</div>

					<div id="comment-list">
						<label className="side-label">comments [{comments.length}]</label>
						{comments.map((c) => (
							<div className="comment" id={`comment-${c.n}`} key={c.n}>
								<Pin n={c.n} />
								<div className="comment-main">
									<code className="selector-chip">{c.selector}</code>
									<input className="comment-input" defaultValue={c.text} />
								</div>
							</div>
						))}
					</div>

					<div className="sidebar-spring" />

					<div id="sidebar-actions">
						<button id="send-back" className="btn-primary">send-back <kbd className="kbd">⏎</kbd></button>
						<button id="approve" className="btn-secondary">approve-design</button>
					</div>
				</aside>
			</main>

			<footer id="statusline">
				<span className="sl-seg sl-seg-accent">REVIEW</span>
				<span className="sl-seg">round 1 · 2 pages picked · 3 comments</span>
				<span className="sl-spring" />
				<span className="sl-seg sl-hint"><b>⏎</b> send back</span>
				<span className="sl-seg sl-hint"><b>esc</b> cancel pick</span>
				<span className="sl-seg sl-hint"><b>P</b> pick element</span>
				<span className="sl-seg sl-seg-dim">forge 0.1.0</span>
			</footer>
		</div>
	);
}
