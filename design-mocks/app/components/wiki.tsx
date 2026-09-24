import "./wiki.css";

const pins = [
	{ n: 1, color: "yellow", cls: "pin-wiki-ib", selector: ".wiki-infobox", text: "Infobox image is stretched — use a 4:3 crop." },
	{ n: 2, color: "orange", cls: "pin-wiki-h2", selector: "#Behaviour", text: "Heading sits too close to the TOC block." },
	{ n: 3, color: "purple", cls: "pin-wiki-lead", selector: ".wiki-lead a", text: "Lead links must stay wiki blue, not the accent." },
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

export default function WikiMock({ variant = "plain", label }: {
	variant?: "annotate" | "work" | "plain"; label?: string;
}) {
	const review = variant !== "plain";
	return (
		<div className="frame wiki-frame" style={{ width: 760 }}>
			<div className="frame-label">{label}</div>
			<div className="wiki-body">
				<div className="wiki-sitehead">
					<span className="wiki-logo">W</span>
					<span className="wiki-search">Search wiki</span>
				</div>
				<h1 className="wiki-title">Selkirk grackle</h1>
				<div className="wiki-hatnote">Not to be confused with the <a>Pied currawong</a>.</div>
				<p className="wiki-text wiki-lead">
					The <b>Selkirk grackle</b> (<i>Gracula selkirki</i>) is a <a>passerine</a> bird in the family <a>Graulidae</a>. It is
					endemic to the <a>Selkirk archipelago</a>, where it breeds in coastal scrub and feeds mainly on <a>molluscs</a> and
					beach flies.
				</p>
				<div className="wiki-layout">
					<div className="wiki-main">
						<div className="pop-anchor">
							<div className={`wiki-toc ${variant === "annotate" ? "pop-target" : ""}`}>
								<div className="wiki-toc-title">Contents</div>
								<div><span className="toc-n">1</span><a>Description</a></div>
								<div><span className="toc-n">2</span><a>Behaviour</a></div>
								<div><span className="toc-n">3</span><a>Taxonomy</a></div>
							</div>
							{variant === "annotate" && (
								<div id="comment-pop">
									<span className="pin c-blue">4</span>
									<span className="pop-main">
										<input className="pop-input" defaultValue="TOC rows misaligned by 2px" aria-label="new comment" autoFocus />
										<div className="pop-hint"><b>⏎</b> finalize comment · <b>esc</b> cancel</div>
									</span>
								</div>
							)}
						</div>
						<h2 className="wiki-h2">Description</h2>
						<p className="wiki-text">
							Measuring 28 cm, it is smaller and darker than its mainland relatives, with a heavy black bill and a
							down-curved culmen. The plumage is sooty brown with a faint green gloss on the mantle.
						</p>
						<h2 className="wiki-h2" id="Behaviour">Behaviour</h2>
						<p className="wiki-text">
							It forages at low tide along rocky ledges, flipping kelp to expose crustaceans, and nests colonially on
							cliff ledges between August and November.
						</p>
					</div>
					<aside className="wiki-infobox">
						<div className="wiki-ib-title">Selkirk grackle</div>
						<div className="wiki-ib-img" />
						<div className="wiki-ib-cap">Adult, Selkirk Island</div>
						<div className="wiki-ib-row"><b>Family</b><span>Graulidae</span></div>
						<div className="wiki-ib-row"><b>Genus</b><span>Gracula</span></div>
						<div className="wiki-ib-row"><b>Status</b><span>Near threatened</span></div>
					</aside>
				</div>
				<div className="wiki-catbar">Categories: <a>Graulidae</a> | <a>Birds of the Selkirk Islands</a> | <a>Endemic fauna</a></div>

				{review && pins.map((p) => <Pin key={p.n} p={p} />)}
			</div>
		</div>
	);
}
