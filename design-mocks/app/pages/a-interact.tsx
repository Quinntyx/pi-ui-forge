import WikiMock from "../components/wiki";
import "./a.css";

/* state 3 — interact mode: browse the mock; annotation chrome hidden */

export default function AInteract() {
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
					<span className="mode-key mode-key-modeI-active">I</span><span className="mode-label mode-label-active">interact</span>
					<span className="mode-sep">/</span>
					<span className="mode-key">A</span><span className="mode-label">annotate</span>
				</div>
			</header>

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
						</div>
					</div>

					<div className="frame" style={{ width: 390 }}>
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
						</div>
					</div>
				</section>
			</main>

			<footer id="statusline">
				<span className="sl-seg sl-seg-accent sl-seg-accent-view">INTERACT</span>
				<span className="sl-seg">viewing r3 · read-only</span>
				<span className="sl-spring" />
				<span className="sl-seg sl-hint"><b>A</b> annotate</span>
			</footer>
		</div>
	);
}
