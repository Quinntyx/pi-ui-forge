// forge runtime — injected into every generated mock page.
// Listens for host messages: capture (DOM → PNG), pick (inspect-element), and
// highlight. No behavior otherwise; the mock app is untouched.

(function () {
	"use strict";

	var highlighted = null;
	var highlightEl = null;
	var picking = false;

	function post(msg) {
		msg.source = "forge-iframe";
		window.parent.postMessage(msg, "*");
	}

	function clearHighlight() {
		if (highlightEl) {
			highlightEl.style.outline = "";
			highlightEl.style.outlineOffset = "";
			highlightEl = null;
		}
	}

	function setHighlight(el) {
		if (highlightEl === el) return;
		clearHighlight();
		highlightEl = el;
		el.style.outline = "2px solid #ff4d6d";
		el.style.outlineOffset = "1px";
	}

	// --- pick --------------------------------------------------------------

	function buildSelector(el) {
		// nearest self-or-ancestor with an id is the anchor; steps below it
		// are (nth-child, tag, classes).
		var anchor = el;
		while (anchor && anchor !== document.documentElement) {
			if (anchor.id) break;
			anchor = anchor.parentElement;
		}
		if (!anchor || !anchor.id) {
			// no id'd ancestor: fall back to the page root anchor
			anchor = document.body.id ? document.body : document.documentElement;
			// walk from the element up to the anchor recording steps
			var stepsUp = [];
			var node = el;
			while (node && node !== anchor) {
				stepsUp.push(node);
				node = node.parentElement;
			}
			if (node !== anchor) {
				// anchor not an ancestor (odd DOM): use body
				anchor = document.body;
				stepsUp.length = 0;
				node = el;
				while (node && node !== anchor) {
					stepsUp.push(node);
					node = node.parentElement;
				}
			}
			var sel = anchor.id ? "#" + anchor.id : "html";
			for (var i = stepsUp.length - 1; i >= 0; i--) {
				sel += " > " + stepSelector(stepsUp[i]);
			}
			return el.id ? "#" + cssEscape(el.id) : sel;
		}
		// anchor found; build downward steps from anchor to el
		var path = [];
		var n = el;
		while (n && n !== anchor) {
			path.unshift(n);
			n = n.parentElement;
		}
		if (n !== anchor) return "#" + cssEscape(anchor.id);
		var selector = "#" + cssEscape(anchor.id);
		for (var j = 0; j < path.length; j++) {
			selector += " > " + stepSelector(path[j]);
		}
		return selector;
	}

	function stepSelector(el) {
		var tag = el.tagName.toLowerCase();
		var nth = 1;
		for (var s = el.previousElementSibling; s; s = s.previousElementSibling) {
			if (s.tagName === el.tagName) nth++;
		}
		var classes = Array.prototype.slice
			.call(el.classList)
			.map(function (c) {
				return "." + cssEscape(c);
			})
			.join("");
		return tag + classes + ":nth-of-type(" + nth + ")";
	}

	function cssEscape(value) {
		return (window.CSS && CSS.escape) ? CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
	}

	function pickHandler(e) {
		if (!picking) return;
		e.preventDefault();
		e.stopPropagation();
		var el = e.target;
		if (!(el instanceof Element)) return;
		var rect = el.getBoundingClientRect();
		window.parent.postMessage(
			{
				source: "forge-iframe",
				type: "forge:pick",
				page: document.body.getAttribute("data-forge-page") || window.__FORGE_PAGE__ || "",
				selector: buildSelector(el),
				rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
			},
			"*",
		);
		setHighlight(el);
	}

	document.addEventListener("click", pickHandler, true);

	window.addEventListener("message", function (event) {
		var d = event.data;
		if (!d || d.source !== "forge-host") return;

		if (d.type === "forge:capture") {
			// DOM serialization capture — does not move the user's view.
			try {
				var capture = window.htmlToImage;
				if (!capture) throw new Error("html-to-image vendor not loaded");
				capture
					.toPng(document.documentElement, {
						width: document.documentElement.scrollWidth,
						height: Math.min(document.documentElement.scrollHeight, 6000),
						backgroundColor: "#ffffff",
					})
					.then(function (dataUrl) {
						post({ type: "forge:capture-result", reqId: d.reqId, dataUrl: dataUrl });
					})
					.catch(function (err) {
						post({ type: "forge:capture-result", reqId: d.reqId, dataUrl: null, error: String(err) });
					});
			} catch (err) {
				post({ type: "forge:capture-result", reqId: d.reqId, dataUrl: null, error: String(err) });
			}
			return;
		}

		if (d.type === "forge:pick") {
			picking = !!d.on;
			document.documentElement.style.cursor = picking ? "crosshair" : "";
			if (!picking) clearHighlight();
			return;
		}

		if (d.type === "forge:highlight") {
			clearHighlight();
			if (d.on && d.selector) {
				try {
					var el = document.querySelector(d.selector);
					if (el instanceof Element) setHighlight(el);
				} catch (e) {
					/* bad selector — ignore */
				}
			}
			return;
		}
	});
})();
