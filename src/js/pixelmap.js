/* pixelmap.js — the homepage map, v1: two territories.
   A dense pixel field grown from cellular automata, rendered at grid
   resolution and upscaled so the pixels stay visible (truth to medium:
   the structure is genuinely computed, not painted).

   Two territories split down the middle by a wavering, per-pixel
   dithered boundary, so their palettes bleed into each other:
     - Projects (left): deep-cyan body, rule 90 Sierpinski cascade
       falling vertically in bright cyan, amber glints.
     - Writings (right): body graded deep purple -> vermillion, rule 150
       lace flowing horizontally (time runs like lines of text) graded
       lavender -> sandstone. Palette PROVISIONAL pending Shane's hexes.
   Each new section added to the map gets its own fractal rule, palette,
   and energy. TERRITORY GEOMETRY below is the extension point. */
(() => {
	"use strict";

	const host = document.querySelector("[data-pixel-map]");
	if (!host) return;
	const canvas = host.querySelector("canvas");
	if (!canvas) return;
	const ctx = canvas.getContext("2d");

	const W = 320; // CA grid; one cell = one rendered pixel (8:3 oval)
	const H = 120;
	canvas.width = W;
	canvas.height = H;
	host.classList.add("is-grown"); // drops the no-JS fallback pattern

	/* Projects palette (site seeds) */
	const CYAN_DEEP = "#005a78";
	const CYAN_BRIGHT = "#75d1d9";
	const AMBER_BRIGHT = "#e69800"; // sixth seed

	/* Writings palette — quantized 4-step gradients, PROVISIONAL:
	   body: deep purple -> vermillion; fractal: lavender -> sandstone. */
	const W_BODY = ["#53337f", "#74385e", "#943e3d", "#b5431c"];
	const W_FRACTAL = ["#b49ce0", "#c2a2bf", "#d1a89f", "#dfae7e"];
	const W_GLINT = "#dfae7e";

	/* Quantized darkening of a palette color — full density means the
	   automaton's pattern is expressed as light vs dark tones of each
	   territory's own colors, never as empty pixels. */
	/* No tone in these territories may fall below TONE_FLOOR of its
	   color — deep hues driven lower read as gray/black, and gray
	   belongs to no current section (reserved for a possible future
	   one, per Shane). */
	const TONE_FLOOR = 0.6;
	const shadeCache = new Map();
	function shade(hex, rawF) {
		const f = Math.max(rawF, TONE_FLOOR);
		const key = hex + f;
		let c = shadeCache.get(key);
		if (!c) {
			const n = parseInt(hex.slice(1), 16);
			const ch = (v) => Math.round(v * f).toString(16).padStart(2, "0");
			c = "#" + ch(n >> 16) + ch((n >> 8) & 255) + ch(n & 255);
			shadeCache.set(key, c);
		}
		return c;
	}

	/* Deterministic PRNGs (mulberry32) — the field is designed, not
	   random: the same structure grows on every visit. */
	function mulberry32(a) {
		return function () {
			a |= 0;
			a = (a + 0x6d2b79f5) | 0;
			let t = Math.imul(a ^ (a >>> 15), 1 | a);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}
	const rand = mulberry32(0x5eed);

	/* --- Base body: dense horizontal ellipse ----------------------------- */
	let grid = new Uint8Array(W * H);
	const cx = W / 2;
	const cy = H / 2;
	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++) {
			const nx = (x - cx) / (W / 2); // elliptical normalization
			const ny = (y - cy) / (H / 2);
			const r = Math.hypot(nx, ny);
			const a = Math.atan2(ny, nx);
			const edge = 1 / (1 + Math.exp((r - 0.92) / 0.015));
			const lobes = 0.14 * Math.sin(a * 3 + 1.7) * Math.sin(a * 5 - 0.4);
			const ripple = 0.12 * Math.cos(r * 14 - a * 2);
			if (rand() < edge * (0.74 + lobes + ripple)) grid[y * W + x] = 1;
		}
	}

	/* Grow: a few generations of a clumping life-like rule
	   (survive on 3+, born on 5+ of 8 neighbors, toroidal). */
	const at = (x, y) => ((y + H) % H) * W + ((x + W) % W);
	function neighbors(g, x, y) {
		let n = 0;
		for (let j = -1; j <= 1; j++)
			for (let i = -1; i <= 1; i++) if (i || j) n += g[at(x + i, y + j)];
		return n;
	}
	for (let step = 0; step < 4; step++) {
		const next = new Uint8Array(W * H);
		for (let y = 0; y < H; y++)
			for (let x = 0; x < W; x++) {
				const n = neighbors(grid, x, y);
				next[y * W + x] = grid[y * W + x] ? (n >= 3 ? 1 : 0) : n >= 5 ? 1 : 0;
			}
		grid = next;
	}

	/* --- Fractal layers, half resolution (one cell = 2x2 pixel block) ---- */
	const FW = W / 2;
	const FH = H / 2;

	/* Projects: rule 90 — each cell is the XOR of its two diagonal
	   ancestors; a sparse initial line cascades down the field as
	   nested Sierpinski triangles. */
	const frandP = mulberry32(0xf7ac7a1);
	const fracP = new Uint8Array(FW * FH);
	// sparse seeds: separated cascades keep the nested triangles legible
	for (let x = 0; x < FW; x++) if (frandP() < 0.025) fracP[x] = 1;
	// Hard generational break every RESEED rows: the row is REPLACED with
	// a fresh sparse seeding (merely adding seeds lets the old cascade's
	// XOR structure — and its giant triangles — survive underneath). No
	// triangle can span more than one band.
	const RESEED = 16;
	for (let y = 1; y < FH; y++) {
		if (y % RESEED === 0) {
			for (let x = 0; x < FW; x++)
				fracP[y * FW + x] = frandP() < 0.06 ? 1 : 0;
			continue;
		}
		for (let x = 0; x < FW; x++)
			fracP[y * FW + x] =
				fracP[(y - 1) * FW + ((x + FW - 1) % FW)] ^
				fracP[(y - 1) * FW + ((x + 1) % FW)];
	}
	const fcolorP = new Array(FW * FH);
	for (let i = 0; i < FW * FH; i++)
		if (fracP[i]) fcolorP[i] = frandP() < 0.08 ? AMBER_BRIGHT : CYAN_BRIGHT;

	/* Writings: rule 150 — XOR of up-left, left, and down-left ancestors,
	   cascading left-to-right (bounded, denser seeds: a woven lace with
	   a different energy than rule 90's clean triangles). */
	const frandW = mulberry32(0x9a9e5);
	const fracW = new Uint8Array(FW * FH);
	for (let y = 0; y < FH; y++) if (frandW() < 0.09) fracW[y * FW] = 1;
	for (let x = 1; x < FW; x++) {
		if (x % RESEED === 0) {
			for (let y = 0; y < FH; y++)
				fracW[y * FW + x] = frandW() < 0.06 ? 1 : 0;
			continue;
		}
		for (let y = 0; y < FH; y++) {
			const a = y > 0 ? fracW[(y - 1) * FW + x - 1] : 0;
			const b = fracW[y * FW + x - 1];
			const c = y < FH - 1 ? fracW[(y + 1) * FW + x - 1] : 0;
			fracW[y * FW + x] = a ^ b ^ c;
		}
	}

	/* --- TERRITORY GEOMETRY (extension point) ----------------------------
	   A wavering vertical boundary near the middle; each pixel joins a
	   territory stochastically by its distance from the line, so the two
	   palettes bleed into each other across a dithered gradient. New
	   sections get new boundary curves, rules, and palettes here. */
	function boundaryX(y) {
		return W * 0.52 + 9 * Math.sin(y * 0.16 + 1.3) + 5 * Math.sin(y * 0.06 - 0.5);
	}

	/* --- Compose cells ---------------------------------------------------
	   FULL DENSITY: every pixel inside the ellipse is a cell — the
	   automaton's alive/dead pattern renders as light vs dark tones of
	   each territory's colors (quantized shades), never as absence.
	   Within each territory: body deep, fractal bright (the layers stay
	   color-separated so the lattice reads). Writings colors are graded
	   by distance from the boundary, quantized to 4 steps. All cells
	   are opaque, so the map is identical in both color schemes. */
	const RIM_PX = 5; // solid boundary ring thickness, in pixels
	const FRACTAL_INSET_PX = 10; // fractals stop short of the rim (no jagged edge)
	const LIGHT = [1, 0.85]; // tone steps for alive cells
	/* Dark tones stay hued and well above the page background — the
	   pattern must read as shaded territory, never as holes or gray. */
	const DARK = [0.72, 0.6]; // tone steps for dead cells
	const cells = [];
	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++) {
			const nx = (x - cx) / (W / 2);
			const ny = (y - cy) / (H / 2);
			const r = Math.hypot(nx, ny);
			if (r >= 0.95) continue;
			/* Pixel distance to the boundary along this ray — uniform rim
			   thickness despite the elliptical normalization. */
			const P = Math.hypot(x - cx, y - cy);
			const rimDist = r > 0.001 ? P * (0.95 / r - 1) : 1e9;
			const isRim = rimDist <= RIM_PX;
			const fractalOK = rimDist > FRACTAL_INSET_PX;
			const bx = boundaryX(y);
			const isWritings = rand() < 1 / (1 + Math.exp(-(x - bx) / 2));
			const fi = (y >> 1) * FW + (x >> 1);
			const alive = grid[y * W + x];
			let body;
			let fractalColor = null;
			let glint = null;
			if (isWritings) {
				const g = Math.max(0, Math.min(1, (x - bx) / (W - bx - 6)));
				const q = Math.min(3, Math.floor(g * 4));
				body = W_BODY[q];
				if (fracW[fi] && fractalOK) fractalColor = W_FRACTAL[q];
				glint = W_GLINT;
			} else {
				body = CYAN_DEEP;
				if (fracP[fi] && fractalOK) fractalColor = fcolorP[fi];
				glint = AMBER_BRIGHT;
			}
			let color;
			if (isRim) {
				color = body;
			} else if (fractalColor) {
				color = fractalColor;
			} else if (alive) {
				color =
					neighbors(grid, x, y) >= 6 && rand() < 0.05
						? glint
						: shade(body, LIGHT[Math.floor(rand() * 2)]);
			} else {
				color = shade(body, DARK[Math.floor(rand() * 2)]);
			}
			cells.push({ x, y, color });
		}

	/* Static underlay: every cell's home pixel in a deep shadow of its
	   own color. When the vortex carries cells away, what shows through
	   is the same structure in shadow — never an empty pixel. */
	const under = document.createElement("canvas");
	under.width = W;
	under.height = H;
	const uctx = under.getContext("2d");
	for (const cell of cells) {
		uctx.fillStyle = shade(cell.color, 0.8);
		uctx.fillRect(cell.x, cell.y, 1, 1);
	}

	/* Pointer reaction: the spiral as ORDER, not chaos. The pointer is
	   an organizing field — cells within its reach comb themselves onto
	   the arms of a golden spiral centered on it (phyllotaxis: order
	   crystallizing out of the noise), and the whole pattern rotates
	   slowly for as long as the pointer rests. Leave, and the order
	   melts back into the grown field.

	   Each cell's target is the small displacement that moves it onto
	   the nearest arm: the arm field is ψ = φ − ln(d)/B (a log spiral
	   whose radius grows by the golden ratio every half turn), arms are
	   the ARMS-fold level sets of ψ, and the shift is capped at CAP
	   pixels — order is a nudge, never an upheaval. First-order easing,
	   no oscillation: calm is the point.
	   (Disabled entirely under prefers-reduced-motion, as before.) */
	const PHI = (1 + Math.sqrt(5)) / 2;
	const B = (2 * Math.log(PHI)) / Math.PI; // golden growth per half turn
	const GRAD = Math.sqrt(1 + 1 / (B * B)); // |∇ψ| · d (arm-spacing factor)
	const ARMS = 5; // Fibonacci arm count
	const R = 28; // reach of the ordering field, in grid cells
	const CAP = 12; // max shift onto an arm, in pixels
	const EASE = 1.25; // crystallization rate
	const ROT = 0.7; // arm rotation at rest, radians per second

	/* The flow around the order — what makes motion feel derivational
	   rather than pinned:
	     - the field CENTER trails the cursor on a spring (it glides,
	       laps, and overshoots instead of teleporting);
	     - order MELTS in proportion to pointer speed and re-crystallizes
	       on arrival (ebb and flow);
	     - stirring spins the arms faster; rest returns them to serenity;
	     - a slow breath modulates the arm strength even in stillness. */
	const CENTER_K = 0.05; // spring pulling the field center to the cursor
	const CENTER_D = 0.82; // its damping (lower = more overshoot)
	const MELT = 0.35; // how strongly speed dissolves the order
	const SPIN = 0.25; // extra rotation per unit pointer speed
	const BREATH = 0.15; // depth of the at-rest breathing
	const TWO_PI = Math.PI * 2;
	const ox = new Float32Array(cells.length);
	const oy = new Float32Array(cells.length);
	let pointer = null;
	let prevPtr = null;
	let fx = null; // field center (lags the cursor)
	let fy = null;
	let fvx = 0;
	let fvy = 0;
	let speed = 0; // smoothed pointer speed
	let phase = 0; // accumulated arm rotation
	let lastT = 0;
	let raf = 0;

	function draw() {
		/* The shadow underlay replaces clearing: vacated pixels reveal
		   the same structure in shadow, never the page background. */
		ctx.clearRect(0, 0, W, H);
		ctx.drawImage(under, 0, 0);
		for (let i = 0; i < cells.length; i++) {
			const cell = cells[i];
			ctx.fillStyle = cell.color;
			ctx.fillRect(Math.round(cell.x + ox[i]), Math.round(cell.y + oy[i]), 1, 1);
		}
	}

	function tick() {
		const now = performance.now() / 1000;
		const dt = Math.min(now - lastT || 0.016, 0.05);
		lastT = now;

		/* Field center glides after the cursor; speed is measured and
		   smoothed; the arms spin faster when stirred. */
		if (pointer) {
			if (fx === null) {
				fx = pointer.x;
				fy = pointer.y;
			}
			fvx += (pointer.x - fx) * CENTER_K;
			fvy += (pointer.y - fy) * CENTER_K;
			fvx *= CENTER_D;
			fvy *= CENTER_D;
			fx += fvx;
			fy += fvy;
			if (prevPtr) {
				const sp = Math.hypot(pointer.x - prevPtr.x, pointer.y - prevPtr.y);
				speed += (sp - speed) * 0.25;
			}
			prevPtr = pointer;
		} else {
			speed *= 0.9;
			prevPtr = null;
		}
		phase += dt * (ROT + speed * SPIN);

		/* Order ebbs with motion and breathes at rest. */
		const melt = 1 / (1 + speed * MELT);
		const breath = 1 - BREATH / 2 + (BREATH / 2) * Math.sin(now * 0.9);
		const capE = CAP * melt * breath;

		const s = TWO_PI / ARMS;
		let settled = true;
		for (let i = 0; i < cells.length; i++) {
			let tx = 0;
			let ty = 0;
			if (pointer && fx !== null) {
				const dx = cells[i].x - fx;
				const dy = cells[i].y - fy;
				const d = Math.hypot(dx, dy);
				if (d < R && d > 2) {
					/* misalignment from the nearest (rotating) spiral arm */
					const psi = Math.atan2(dy, dx) - Math.log(d) / B + phase;
					let m = psi % s;
					if (m < 0) m += s;
					m -= s / 2;
					/* linear distance to the arm, capped; shift along ∇ψ */
					const lin = Math.max(-capE, Math.min(capE, (m * d) / GRAD));
					const ux = dx / d;
					const uy = dy / d;
					const w = 1 - d / R;
					tx = ((-(-uy - ux / B) * lin) / GRAD) * w;
					ty = ((-(ux - uy / B) * lin) / GRAD) * w;
				}
			}
			ox[i] += (tx - ox[i]) * EASE;
			oy[i] += (ty - oy[i]) * EASE;
			if (Math.abs(ox[i]) > 0.05 || Math.abs(oy[i]) > 0.05) settled = false;
		}
		draw();
		raf = pointer || !settled ? requestAnimationFrame(tick) : 0;
	}

	function toGrid(e) {
		const b = canvas.getBoundingClientRect();
		return {
			x: ((e.clientX - b.left) / b.width) * W,
			y: ((e.clientY - b.top) / b.height) * H,
		};
	}

	if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
		host.addEventListener("pointermove", (e) => {
			pointer = toGrid(e);
			if (!raf) raf = requestAnimationFrame(tick);
		});
		host.addEventListener("pointerleave", () => {
			pointer = null;
			if (!raf) raf = requestAnimationFrame(tick);
		});
	}

	draw();
})();
