/* qnlp-demo.js - page logic for /demos/quantum-embeddings/.
   Live section: drives qnlp-worker.js and renders quantum states as
   pixel strips (truth to medium: an amplitude vector IS a row of
   pixels), streams SWAP-test shots into a bitmap, and plots the
   estimate converging on the exact fidelity.
   Research section: the actual 666 SimLex noun-pair results from the
   paper, plotted with live Spearman correlations. */

const $ = (id) => document.getElementById(id);

const css = getComputedStyle(document.documentElement);
const color = (name) => css.getPropertyValue(name).trim();
let C = {};
function readColors() {
	C = {
		fg: color("--color-fg"),
		bg: color("--color-bg"),
		link: color("--color-link"),
		cyanDeep: "#005a78",
		cyanBright: "#75d1d9",
		amber: "#e69800",
		rule: color("--color-rule"),
	};
}
readColors();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
	readColors();
	drawScatter();
});

/* ===================== live pipeline ===================== */

let worker = null;
let ready = false;
let exact = null; // last "encoded" payload

const statusEl = $("q-status");
const setStatus = (t) => (statusEl.textContent = t);

$("q-load").addEventListener("click", () => {
	$("q-load").disabled = true;
	setStatus("loading...");
	ready = false;
	if (worker) worker.terminate();
	worker = new Worker("/js/workers/qnlp-worker.js", { type: "module" });
	worker.onmessage = onWorkerMessage;
	worker.onerror = (e) => {
		setStatus("error - " + (e.message || "worker failed"));
		$("q-load").disabled = false;
	};
	worker.postMessage({ type: "load", model: $("q-model").value });
});

$("q-model").addEventListener("change", () => {
	ready = false;
	$("q-run").disabled = true;
	$("q-load").hidden = false;
	$("q-load").disabled = false;
	setStatus("model changed - load it");
});

$("q-run").addEventListener("click", run);

function run() {
	if (!ready) return;
	$("q-run").disabled = true;
	setStatus("embedding...");
	resetShotViews();
	worker.postMessage({
		type: "run",
		a: $("q-word-a").value.trim() || "cat",
		b: $("q-word-b").value.trim() || "dog",
		encoding: document.querySelector("input[name=q-enc]:checked").value,
		shots: parseInt($("q-shots").value, 10),
	});
}

function onWorkerMessage(e) {
	const m = e.data;
	if (m.type === "progress") setStatus(m.note);
	else if (m.type === "ready") {
		ready = true;
		setStatus(`ready (${m.device})`);
		$("q-load").hidden = true;
		$("q-run").disabled = false;
		$("q-io").hidden = false;
	} else if (m.type === "encoded") {
		exact = m;
		drawStrip($("q-strip-a"), m.stripA);
		drawStrip($("q-strip-b"), m.stripB);
		$("q-stats").innerHTML =
			`${m.dims} dims &rarr; ${m.amps} amplitudes (padded to ${m.dim}); ` +
			`state preparation ~O(${m.amps}) gates; running on ${m.device}`;
		$("q-amps").textContent = m.amps;
		$("q-qubits").textContent = `${m.qubits} / ${m.totalQubits}`;
		$("q-cos").textContent = m.cos.toFixed(6);
		$("q-cos2").textContent = (m.cos * m.cos).toFixed(6);
		$("q-fid").textContent = m.fid.toFixed(6);
		const d = m.fid - m.cos * m.cos;
		$("q-dfid").textContent = (d >= 0 ? "+" : "") + d.toFixed(6);
		setStatus("measuring...");
	} else if (m.type === "shots") {
		paintShots(m);
		const est = 1 - (2 * m.ones) / m.n;
		const p = m.ones / m.n;
		const ci = 2 * 1.96 * Math.sqrt(Math.max(p * (1 - p), 1e-9) / m.n);
		$("q-est").textContent = `${est.toFixed(4)} ± ${ci.toFixed(4)}`;
		drawConvergence(m.n, est, ci);
	} else if (m.type === "runComplete") {
		$("q-run").disabled = false;
		setStatus(`ready - measured ${m.n} shots`);
	} else if (m.type === "error") {
		setStatus("error - " + m.message);
		$("q-run").disabled = false;
		$("q-load").disabled = false;
	}
}

/* Amplitude strip: one pixel per amplitude. Real encoding: sign as
   color (cyan +, amber -). Complex: phase as hue. Magnitude as alpha. */
function drawStrip(canvas, s) {
	const n = s.re.length;
	canvas.width = n;
	canvas.height = 1;
	const ctx = canvas.getContext("2d");
	ctx.clearRect(0, 0, n, 1);
	let max = 1e-12;
	for (let i = 0; i < n; i++)
		max = Math.max(max, Math.hypot(s.re[i], s.im[i]));
	for (let i = 0; i < n; i++) {
		const mag = Math.hypot(s.re[i], s.im[i]);
		if (mag < 1e-12) continue;
		const isComplex = Math.abs(s.im[i]) > 1e-12;
		if (isComplex) {
			const hue = ((Math.atan2(s.im[i], s.re[i]) * 180) / Math.PI + 360) % 360;
			ctx.fillStyle = `hsl(${hue} 70% 55%)`;
		} else {
			ctx.fillStyle = s.re[i] >= 0 ? C.cyanBright : C.amber;
		}
		ctx.globalAlpha = Math.min(1, 0.15 + 0.85 * (mag / max));
		ctx.fillRect(i, 0, 1, 1);
	}
	ctx.globalAlpha = 1;
}

/* Shot bitmap: every measurement is one pixel - ancilla 0 in deep
   cyan, ancilla 1 in amber. */
const shotCanvas = $("q-shotmap");
let shotCols = 100;
let shotIdx = 0;

function resetShotViews() {
	const shots = parseInt($("q-shots").value, 10);
	shotCols = 100;
	shotCanvas.width = shotCols;
	shotCanvas.height = Math.max(1, Math.ceil(shots / shotCols));
	shotCanvas.getContext("2d").clearRect(0, 0, shotCanvas.width, shotCanvas.height);
	shotIdx = 0;
	convPoints = [];
	$("q-est").textContent = "—";
	const cv = $("q-conv");
	cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
}

function paintShots(m) {
	const ctx = shotCanvas.getContext("2d");
	// distribute this batch's ones randomly within the batch pixels
	const pix = [];
	for (let i = 0; i < m.batchSize; i++) pix.push(i < m.batch ? 1 : 0);
	for (let i = pix.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[pix[i], pix[j]] = [pix[j], pix[i]];
	}
	for (const bit of pix) {
		ctx.fillStyle = bit ? C.amber : C.cyanDeep;
		ctx.globalAlpha = bit ? 1 : 0.55;
		ctx.fillRect(shotIdx % shotCols, Math.floor(shotIdx / shotCols), 1, 1);
		shotIdx++;
	}
	ctx.globalAlpha = 1;
}

/* Convergence plot: estimate (amber) closing in on exact fidelity
   (bright cyan line), with the shrinking 95% interval as a band. */
let convPoints = [];
function drawConvergence(n, est, ci) {
	convPoints.push({ n, est, ci });
	const cv = $("q-conv");
	const dpr = devicePixelRatio || 1;
	const W = (cv.width = Math.max(1, Math.round(cv.clientWidth * dpr)));
	const H = (cv.height = Math.max(1, Math.round(cv.clientHeight * dpr)));
	const ctx = cv.getContext("2d");
	ctx.clearRect(0, 0, W, H);
	ctx.lineWidth = dpr;
	const shots = parseInt($("q-shots").value, 10);
	const x = (nn) => 2 + (W - 4) * (nn / shots);
	const y = (v) => H - 2 - (H - 4) * Math.max(0, Math.min(1, v));
	// CI band
	ctx.fillStyle = C.amber;
	ctx.globalAlpha = 0.18;
	ctx.beginPath();
	convPoints.forEach((p, i) =>
		i ? ctx.lineTo(x(p.n), y(p.est + p.ci)) : ctx.moveTo(x(p.n), y(p.est + p.ci))
	);
	[...convPoints].reverse().forEach((p) => ctx.lineTo(x(p.n), y(p.est - p.ci)));
	ctx.fill();
	ctx.globalAlpha = 1;
	// exact fidelity
	if (exact) {
		ctx.strokeStyle = C.cyanBright;
		ctx.beginPath();
		ctx.moveTo(0, y(exact.fid));
		ctx.lineTo(W, y(exact.fid));
		ctx.stroke();
	}
	// estimate trace
	ctx.strokeStyle = C.amber;
	ctx.beginPath();
	convPoints.forEach((p, i) => (i ? ctx.lineTo(x(p.n), y(p.est)) : ctx.moveTo(x(p.n), y(p.est))));
	ctx.stroke();
}

/* ===================== research data ===================== */

const COMPARISONS = {
	q_real_vs_cos: {
		label: "quantum (real, 1024 shots) vs classical cosine",
		models: ["gpt_small", "voyage"],
		x: (p, m) => p.cos[m],
		y: (p, m) => p.q[`${m}_real`],
		xl: "classical cosine",
		yl: "SWAP-test estimate",
	},
	q_cint_vs_cos: {
		label: "quantum (complex interdigitated, 1000 shots) vs classical cosine",
		models: ["gpt_small", "voyage"],
		x: (p, m) => p.cos[m],
		y: (p, m) => p.q[`${m}_cint`],
		xl: "classical cosine",
		yl: "SWAP-test estimate",
	},
	cos_vs_simlex: {
		label: "classical cosine vs human judgment (SimLex-999)",
		models: ["glove", "word2vec", "fasttext", "gpt_small", "gpt_large", "voyage"],
		x: (p) => (p.simlex == null ? null : p.simlex / 10),
		y: (p, m) => p.cos[m],
		xl: "human similarity (0-10, scaled)",
		yl: "classical cosine",
	},
	q_real_vs_simlex: {
		label: "quantum (real) vs human judgment (SimLex-999)",
		models: ["gpt_small", "voyage"],
		x: (p) => (p.simlex == null ? null : p.simlex / 10),
		y: (p, m) => p.q[`${m}_real`],
		xl: "human similarity (0-10, scaled)",
		yl: "SWAP-test estimate",
	},
};

let DATA = null;
let points = [];

fetch("/data/qnlp.json")
	.then((r) => r.json())
	.then((d) => {
		DATA = d;
		$("r-n").textContent = d.meta.pairs;
		syncModels();
		drawScatter();
	});

function syncModels() {
	const comp = COMPARISONS[$("r-comp").value];
	const sel = $("r-model");
	const prev = sel.value;
	sel.innerHTML = "";
	for (const m of comp.models) {
		const o = document.createElement("option");
		o.value = m;
		o.textContent = m.replace("_", "-");
		sel.appendChild(o);
	}
	if (comp.models.includes(prev)) sel.value = prev;
}

$("r-comp").addEventListener("change", () => {
	syncModels();
	drawScatter();
});
$("r-model").addEventListener("change", drawScatter);
let resizeTimer = 0;
addEventListener("resize", () => {
	clearTimeout(resizeTimer);
	resizeTimer = setTimeout(drawScatter, 150);
});

function spearman(xs, ys) {
	const rank = (v) => {
		const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
		const r = new Array(v.length);
		let i = 0;
		while (i < idx.length) {
			let j = i;
			while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
			const avg = (i + j) / 2 + 1;
			for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
			i = j + 1;
		}
		return r;
	};
	const rx = rank(xs);
	const ry = rank(ys);
	const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
	const mx = mean(rx);
	const my = mean(ry);
	let num = 0;
	let dx = 0;
	let dy = 0;
	for (let i = 0; i < rx.length; i++) {
		num += (rx[i] - mx) * (ry[i] - my);
		dx += (rx[i] - mx) ** 2;
		dy += (ry[i] - my) ** 2;
	}
	return num / Math.sqrt(dx * dy);
}

function drawScatter() {
	if (!DATA) return;
	const comp = COMPARISONS[$("r-comp").value];
	const model = $("r-model").value;
	points = [];
	for (const p of DATA.pairs) {
		const x = comp.x(p, model);
		const y = comp.y(p, model);
		if (x != null && y != null) points.push({ x, y, w: p.w });
	}
	const rho = spearman(points.map((p) => p.x), points.map((p) => p.y));
	$("r-rho").textContent = `Spearman ρ = ${rho.toFixed(4)} (n = ${points.length})`;

	const cv = $("r-scatter");
	const dpr = devicePixelRatio || 1;
	const W = (cv.width = Math.max(1, Math.round(cv.clientWidth * dpr)));
	const H = (cv.height = W);
	const ctx = cv.getContext("2d");
	ctx.clearRect(0, 0, W, H);
	const u = dpr; // device-pixel unit
	const padL = 18 * u;
	const padR = 8 * u;
	const padT = 8 * u;
	const padB = 18 * u;
	const xs = points.map((p) => p.x);
	const ys = points.map((p) => p.y);
	const x0 = Math.min(...xs);
	const x1 = Math.max(...xs);
	const y0 = Math.min(...ys);
	const y1 = Math.max(...ys);
	const X = (v) => padL + ((W - padL - padR) * (v - x0)) / (x1 - x0 || 1);
	const Y = (v) => H - padB - ((H - padT - padB) * (v - y0)) / (y1 - y0 || 1);
	ctx.lineWidth = u;
	ctx.strokeStyle = C.rule;
	ctx.strokeRect(padL - 2 * u, padT - 2 * u, W - padL - padR + 4 * u, H - padT - padB + 4 * u);
	ctx.fillStyle = C.link;
	const s = Math.max(2, Math.round(1.6 * u));
	for (const p of points)
		ctx.fillRect(Math.round(X(p.x)) - s / 2, Math.round(Y(p.y)) - s / 2, s, s);
	ctx.fillStyle = C.fg;
	ctx.font = `${Math.round(11 * u)}px 'Departure Mono', monospace`;
	ctx.fillText(comp.xl, padL, H - 4 * u);
	ctx.save();
	ctx.translate(12 * u, H - padB);
	ctx.rotate(-Math.PI / 2);
	ctx.fillText(comp.yl, 0, 0);
	ctx.restore();
	cv.onpointermove = (e) => {
		const b = cv.getBoundingClientRect();
		const px = ((e.clientX - b.left) / b.width) * W;
		const py = ((e.clientY - b.top) / b.height) * H;
		let best = null;
		let bd = 1e9;
		for (const p of points) {
			const d = (X(p.x) - px) ** 2 + (Y(p.y) - py) ** 2;
			if (d < bd) {
				bd = d;
				best = p;
			}
		}
		if (best && bd < 400)
			$("r-pair").textContent =
				`${best.w[0]} × ${best.w[1]}: ${comp.xl} ${best.x.toFixed(3)}, ${comp.yl} ${best.y.toFixed(3)}`;
	};
}
