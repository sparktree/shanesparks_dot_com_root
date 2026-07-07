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

	const W = 256; // CA grid; one cell = one rendered pixel (8:3 oval)
	const H = 96;
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
			if (rand() < edge * (0.68 + lobes + ripple)) grid[y * W + x] = 1;
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
	for (let x = 0; x < FW; x++) if (frandP() < 0.05) fracP[x] = 1;
	for (let y = 1; y < FH; y++)
		for (let x = 0; x < FW; x++)
			fracP[y * FW + x] =
				fracP[(y - 1) * FW + ((x + FW - 1) % FW)] ^
				fracP[(y - 1) * FW + ((x + 1) % FW)];
	const fcolorP = new Array(FW * FH);
	for (let i = 0; i < FW * FH; i++)
		if (fracP[i]) fcolorP[i] = frandP() < 0.08 ? AMBER_BRIGHT : CYAN_BRIGHT;

	/* Writings: rule 150 — XOR of up-left, left, and down-left ancestors,
	   cascading left-to-right (bounded, denser seeds: a woven lace with
	   a different energy than rule 90's clean triangles). */
	const frandW = mulberry32(0x9a9e5);
	const fracW = new Uint8Array(FW * FH);
	for (let y = 0; y < FH; y++) if (frandW() < 0.14) fracW[y * FW] = 1;
	for (let x = 1; x < FW; x++)
		for (let y = 0; y < FH; y++) {
			const a = y > 0 ? fracW[(y - 1) * FW + x - 1] : 0;
			const b = fracW[y * FW + x - 1];
			const c = y < FH - 1 ? fracW[(y + 1) * FW + x - 1] : 0;
			fracW[y * FW + x] = a ^ b ^ c;
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
	   Within each territory: body deep, fractal bright (the layers stay
	   color-separated so the lattice reads). Writings colors are graded
	   by distance from the boundary, quantized to 4 steps. Alpha floors
	   high so no region reads dull. */
	const BASE_ALPHAS = [0.65, 0.85, 1];
	const RIM_PX = 4; // solid boundary ring thickness, in pixels
	const FRACTAL_INSET_PX = 8; // fractals stop short of the rim (no jagged edge)
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
			if (isWritings) {
				const g = Math.max(0, Math.min(1, (x - bx) / (W - bx - 6)));
				const q = Math.min(3, Math.floor(g * 4));
				if (isRim) {
					cells.push({ x, y, color: W_BODY[q], a: rand() < 0.5 ? 0.85 : 1 });
				} else if (fracW[fi] && fractalOK) {
					cells.push({ x, y, color: W_FRACTAL[q], a: 1 });
				} else if (grid[y * W + x]) {
					const n = neighbors(grid, x, y);
					if (n >= 6 && rand() < 0.13) {
						cells.push({ x, y, color: W_GLINT, a: rand() < 0.5 ? 0.85 : 1 });
					} else {
						cells.push({ x, y, color: W_BODY[q], a: BASE_ALPHAS[Math.floor(rand() * 3)] });
					}
				}
			} else {
				if (isRim) {
					cells.push({ x, y, color: CYAN_DEEP, a: rand() < 0.5 ? 0.85 : 1 });
				} else if (fracP[fi] && fractalOK) {
					cells.push({ x, y, color: fcolorP[fi], a: 1 });
				} else if (grid[y * W + x]) {
					const n = neighbors(grid, x, y);
					if (n >= 6 && rand() < 0.13) {
						cells.push({ x, y, color: AMBER_BRIGHT, a: rand() < 0.5 ? 0.85 : 1 });
					} else {
						cells.push({ x, y, color: CYAN_DEEP, a: BASE_ALPHAS[Math.floor(rand() * 3)] });
					}
				}
			}
		}

	/* Pointer reaction: cells near the cursor flow along the streamlines
	   of a golden (Fibonacci) spiral centered on it, and spring back.
	   A log spiral with growth φ per quarter turn has pitch
	   b = ln(φ)/(π/2); its tangent sits atan(b) from the tangential
	   direction, so displacement = the outward radial rotated by
	   (90° − atan(b)) ≈ 73° — mostly swirl, slightly outward. */
	const PHI = (1 + Math.sqrt(5)) / 2;
	const SPIRAL_ROT = Math.PI / 2 - Math.atan(Math.log(PHI) / (Math.PI / 2));
	const COS_S = Math.cos(SPIRAL_ROT);
	const SIN_S = Math.sin(SPIRAL_ROT);
	const ox = new Float32Array(cells.length);
	const oy = new Float32Array(cells.length);
	let pointer = null;
	let raf = 0;

	function draw() {
		ctx.clearRect(0, 0, W, H);
		for (let i = 0; i < cells.length; i++) {
			const cell = cells[i];
			ctx.globalAlpha = cell.a;
			ctx.fillStyle = cell.color;
			ctx.fillRect(Math.round(cell.x + ox[i]), Math.round(cell.y + oy[i]), 1, 1);
		}
		ctx.globalAlpha = 1;
	}

	function tick() {
		const R = 18; // influence radius, in grid cells
		let settled = true;
		for (let i = 0; i < cells.length; i++) {
			let tx = 0;
			let ty = 0;
			if (pointer) {
				const dx = cells[i].x - pointer.x;
				const dy = cells[i].y - pointer.y;
				const d = Math.hypot(dx, dy);
				if (d < R && d > 0.001) {
					const f = (1 - d / R) * 4;
					const ux = dx / d;
					const uy = dy / d;
					tx = (ux * COS_S - uy * SIN_S) * f;
					ty = (ux * SIN_S + uy * COS_S) * f;
				}
			}
			ox[i] += (tx - ox[i]) * 0.18;
			oy[i] += (ty - oy[i]) * 0.18;
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
