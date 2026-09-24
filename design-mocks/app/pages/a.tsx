import "./a.css";

const comments = [
	{ n: 1, color: "yellow", selector: ".checkout-cta", text: "Swap to filled green; reads disabled." },
	{ n: 2, color: "orange", selector: "#price-row", text: "Baseline-align price with the title." },
	{ n: 3, color: "purple", selector: ".hero-title", text: "Flatten the shadow to match frame 2." },
];

const picked = [
	{ name: "checkout", on: true },
	{ name: "home", on: true },
	{ name: "picker", on: false },
];

function Pin({ n, color, className = "" }: { n: number; color: string; className?: string }) {
	return <span className={`pin pin-${color} ${className}`}>{n}</span>;
}

export default function A() {
	return (
		<div className="app">
			<header id="topbar">
				<div id="app-identity">
					<span className="logo-glyph">◆</span> UI Mock Forge
				</div>
				<nav id="tabs">
					<button className="tab tab-active">Option A</button>
					<button className="tab">Checkout</button>
					<button className="tab">home</button>
				</nav>
				<div className="topbar-spring" />
				<div id="mode-toggle" role="group" aria-label="mode">
					<button className="mode-btn">Interact<span className="kbd">I</span></button>
					<button className="mode-btn mode-btn-active">Annotate<span className="kbd">A</span></button>
				</div>
				<button id="pick-toggle">
					<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
						<path d="M6 0v4M6 8v4M0 6h4M8 6h4" stroke="currentColor" strokeWidth="1.4" />
						<circle cx="6" cy="6" r="1.6" fill="currentColor" />
					</svg>
					Pick element
					<span className="kbd">P</span>
				</button>
				<div id="status-pill">
					<span className="status-dot status-dot-wait" />
					awaiting markup
				</div>
			</header>

			<div id="review-banner">
				<span className="banner-round">round 1</span>
				<span className="banner-text">
					Reworked the checkout CTA hierarchy and tightened the home hero — look at pin <b>1</b> and the price baseline in <b>2</b>.
				</span>
				<span className="banner-hint">describe changes → sidebar</span>
			</div>

			<main id="workspace">
				<section id="canvas-area">
					<div className="frame" style={{ width: 400 }}>
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
							<Pin n={1} color="yellow" className="pin-pos-cta" />
							<Pin n={2} color="orange" className="pin-pos-price" />
						</div>
					</div>

					<div className="frame frame-selected" style={{ width: 356 }}>
						<div className="frame-label">home · r3</div>
						<div className="frame-handle fh-nw" /><div className="frame-handle fh-ne" />
						<div className="frame-handle fh-sw" /><div className="frame-handle fh-se" />
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
							<Pin n={3} color="purple" className="pin-pos-hero" />
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
							<div className="state-card-body state-card-body-mono">
								<span className="state-ok">✓</span>
								<span>session closed — design approved · 3 rounds</span>
							</div>
						</div>
					</div>
				</section>

				<aside id="sidebar">
					<div className="sidebar-head">Review · round 1</div>

					<div id="describe-block">
						<label className="side-label" htmlFor="describe-input">Describe the change</label>
						<textarea id="describe-input" rows={3} defaultValue="Revised checkout CTA + hero spacing. CTA is now the only filled element on the page." />
					</div>

					<div id="picked-pages">
						<label className="side-label">Picked pages</label>
						{picked.map((p) => (
							<label className="pick-row" key={p.name}>
								<input type="checkbox" defaultChecked={p.on} />
								<span className="pick-name">{p.name}</span>
							</label>
						))}
					</div>

					<div id="comment-list">
						<label className="side-label">Comments <span className="side-count">{comments.length}</span></label>
						{comments.map((c) => (
							<div className="comment" id={`comment-${c.n}`} key={c.n}>
								<Pin n={c.n} color={c.color} />
								<div className="comment-main">
									<code className="selector-chip">{c.selector}</code>
									<input className="comment-input" defaultValue={c.text} />
								</div>
							</div>
						))}
					</div>

					<div className="sidebar-spring" />

					<div id="sidebar-actions">
						<button id="send-back" className="btn-primary">Send back <span className="kbd kbd-dark">⏎</span></button>
						<button id="approve" className="btn-secondary">Approve design</button>
					</div>
				</aside>
			</main>
		</div>
	);
}
