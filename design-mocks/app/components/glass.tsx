import "./glass.css";

const pins = [
	{ n: 1, color: "yellow", cls: "pin-glass-hero", selector: ".glass-hero", text: "Hero image tint is too strong — reduce the overlay." },
	{ n: 2, color: "orange", cls: "pin-glass-row", selector: ".glass-row", text: "Swap hierarchy: number should lead, label under." },
	{ n: 3, color: "purple", cls: "pin-glass-nav", selector: ".glass-nav", text: "Pill nav blends into the hero — add contrast." },
];

function Pin({ p }: { p: typeof pins[number] }) {
	return (
		<span className={`pin-wrap ${p.cls}`}>
			<span className={`pin c-${p.color}`}>{p.n}</span>
			<span className="pin-tip">
				<code>{p.selector}</code>
				<span>{p.text}</span>
			</span>
		</span>
	);
}

export default function GlassMock({ variant = "plain", label }: {
	variant?: "annotate" | "work" | "plain"; label?: string;
}) {
	const review = variant !== "plain";
	return (
		<div className="frame glass-frame" style={{ width: 760 }}>
			<div className="frame-label">{label}</div>
			<div className="glass-body">
				<div className="glass-card">
					<div className="pop-anchor">
						<div className={`glass-nav ${variant === "annotate" ? "pop-target" : ""}`} style={{ borderRadius: 999 }}>
							<span className="glass-pill glass-pill-on">Discover</span>
							<span className="glass-pill">Library</span>
							<span className="glass-pill">Guides</span>
						</div>
						{variant === "annotate" && (
							<div id="comment-pop" style={{ left: 8 }}>
								<span className="pin c-blue">4</span>
								<span className="pop-main">
									<input className="pop-input" defaultValue="Active pill needs 90% opacity fill" aria-label="new comment" autoFocus />
									<div className="pop-hint"><b>⏎</b> finalize comment · <b>esc</b> cancel</div>
								</span>
							</div>
						)}
					</div>
					<div>
						<h1 className="glass-title">Selkirk Grackle</h1>
						<p className="glass-sub">Field guide · Birds of the Selkirk archipelago</p>
					</div>
					<div className="glass-hero" />
					<div className="glass-row">
						<div className="glass-tile"><b>28 cm</b><span>Wingspan</span></div>
						<div className="glass-tile"><b>4–5</b><span>Clutch size</span></div>
						<div className="glass-tile"><b>NT</b><span>Conservation</span></div>
					</div>
					<p className="glass-text">
						A <a>coastal passerine</a> that forages at low tide, flipping kelp for crustaceans. Nests colonially on
						cliff ledges between August and November.
					</p>
				</div>

				{review && pins.map((p) => <Pin key={p.n} p={p} />)}
			</div>
		</div>
	);
}
