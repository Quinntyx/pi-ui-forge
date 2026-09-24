import "./brutal.css";

const pins = [
	{ n: 1, color: "yellow", cls: "pin-brutal-img", selector: ".brutal-img", text: "Swap the hatch fill for a flat grey." },
	{ n: 2, color: "orange", cls: "pin-brutal-h2", selector: ".brutal-h2", text: "Heading chip too small — bump to 14px." },
	{ n: 3, color: "purple", cls: "pin-brutal-title", selector: ".brutal-title", text: "Tighten tracking to -0.03em." },
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

export default function BrutalMock({ variant = "plain", label }: {
	variant?: "annotate" | "work" | "plain"; label?: string;
}) {
	const review = variant !== "plain";
	return (
		<div className="frame brutal-frame" style={{ width: 760 }}>
			<div className="frame-label">{label}</div>
			<div className="brutal-body">
				<div className="brutal-top">
					<span>Field notes / No. 042</span>
					<span>Selkirk surveys</span>
				</div>
				<div>
					<h1 className="brutal-title">Selkirk<br />Grackle</h1>
					<p className="brutal-sub">Endemic fauna — Selkirk archipelago</p>
				</div>
				<div className="brutal-grid">
					<div className="brutal-main">
						<div className="pop-anchor">
							<div className={`brutal-h2 ${variant === "annotate" ? "pop-target" : ""}`}>Field marks</div>
							{variant === "annotate" && (
								<div id="comment-pop" style={{ left: 10 }}>
									<span className="pin c-blue">4</span>
									<span className="pop-main">
										<input className="pop-input" defaultValue="Chip border 2px reads thin at 3px scale" aria-label="new comment" autoFocus />
										<div className="pop-hint"><b>⏎</b> finalize comment · <b>esc</b> cancel</div>
									</span>
								</div>
							)}
						</div>
						<p className="brutal-text">
							28 CM BILL-TO-TAIL, HEAVY BLACK BILL, DOWN-CURVED CULMEN. PLUMAGE SOOTY BROWN, FAINT GREEN GLOSS ON
							THE MANTLE. SMALLEST OF THE ISLAND GRAULIDS.
						</p>
						<div className="brutal-h2">Behaviour</div>
						<p className="brutal-text">
							FORAGES AT LOW TIDE ALONG ROCKY LEDGES. FLIPS KELP FOR CRUSTACEANS. NESTS COLONIALLY ON CLIFF
							LEDS, AUG–NOV.
						</p>
					</div>
					<aside className="brutal-aside">
						<div className="brutal-aside-title">Index card</div>
						<div className="brutal-img" />
						<div className="brutal-aside-cap">Adult, Selkirk Island</div>
						<div className="brutal-aside-row"><span>Family</span><b>Graulidae</b></div>
						<div className="brutal-aside-row"><span>Genus</span><b>Gracula</b></div>
						<div className="brutal-aside-row"><span>Status</span><b>Near threat.</b></div>
					</aside>
				</div>
				<div className="brutal-foot"><span>Cat: Graulidae / Endemic</span><span>Rev. 3 — 04:42</span></div>

				{review && pins.map((p) => <Pin key={p.n} p={p} />)}
			</div>
		</div>
	);
}
