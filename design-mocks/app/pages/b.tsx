import "./b.css";

const comments = [
	{ n: 1, color: "c1", selector: ".checkout-cta", text: "Make this the only filled element." },
	{ n: 2, color: "c2", selector: "#price-row", text: "Give the price a little more room." },
	{ n: 3, color: "c3", selector: ".hero-title", text: "Round corners to match card radius." },
];

const picked = [
	{ name: "checkout", on: true },
	{ name: "home", on: true },
	{ name: "picker", on: false },
];

function Pin({ n, color, className = "" }: { n: number; color: string; className?: string }) {
	return <span className={`pin pin-${color} ${className}`}>{n}</span>;
}

export default function B() {
	return (
		<div className="app">
			<header id="topbar">
				<div id="app-identity">
					<span className="logo-badge">◆</span> UI Mock Forge
				</div>
				<nav id="tabs" className="pill-tabs">
					<button className="tab tab-active">Option A</button>
					<button className="tab">Checkout</button>
					<button className="tab">home</button>
				</nav>
				<div className="topbar-spring" />
				<div id="mode-toggle" role="group" aria-label="mode">
					<span className="mode-thumb" />
					<button className="mode-btn">Interact</button>
					<button className="mode-btn mode-btn-active">Annotate</button>
				</div>
				<button id="pick-toggle" className="pick-armed">
					<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
						<path d="M6 0v4M6 8v4M0 6h4M8 6h4" stroke="currentColor" strokeWidth="1.4" />
						<circle cx="6" cy="6" r="1.6" fill="currentColor" />
					</svg>
					Pick element
					<kbd className="kbd">P</kbd>
				</button>
				<div id="status-pill">
					<span className="status-dot" />
					awaiting markup
				</div>
			</header>

			<main id="workspace">
				<section id="canvas-area">
					<div id="review-banner" className="floating-banner">
						<span className="banner-round">round 1</span>
						<span className="banner-text">
							Reworked the checkout CTA hierarchy and tightened the home hero — look at pin <b>1</b> and the price baseline in <b>2</b>.
						</span>
					</div>

					<div className="frames-row">
						<div className="frame" style={{ width: 410 }}>
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
								<Pin n={1} color="c1" className="pin-pos-cta" />
								<Pin n={2} color="c2" className="pin-pos-price" />
							</div>
						</div>

						<div className="frame frame-selected" style={{ width: 370 }}>
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
								<Pin n={3} color="c3" className="pin-pos-hero" />
							</div>
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
					<div className="sidebar-head">
						Review · round 1
						<span className="sidebar-hint">esc to exit pick · ⏎ to send back</span>
					</div>

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
						<button id="send-back" className="btn-primary">Send back <kbd className="kbd kbd-ondark">⏎</kbd></button>
						<button id="approve" className="btn-secondary">Approve design</button>
					</div>
				</aside>
			</main>
		</div>
	);
}
