/* pixelmap.js — the homepage map, v0.
   A pixel field grown from a seeded cellular automaton, rendered at grid
   resolution and upscaled so the pixels stay visible (truth to medium:
   the structure is genuinely computed, not painted). One region for now
   (Projects); REGION GEOMETRY below is the extension point when the map
   gains subsections.
   Per Shane: a dense horizontal oval — cyans primary, amber/gold
   secondary — identical in both schemes. */
(() => {
	"use strict";

	const host = document.querySelector("[data-pixel-map]");
	if (!host) return;
	const canvas = host.querySelector("canvas");
	if (!canvas) return;
	const ctx = canvas.getContext("2d");

	const W = 192; // CA grid; one cell = one rendered pixel
	const H = 96;
	canvas.width = W;
	canvas.height = H;
	host.classList.add("is-grown"); // drops the no-JS fallback pattern

	const CYAN_DEEP = "#005a78";
	const CYAN_BRIGHT = "#75d1d9";
	/* Map-local amber: the seed #AB7100 reads brown at pixel scale here,
	   so glints use it brightened ~1.35x (Shane, 2026-07-06). */
	const AMBER_GLINT = "#e69800";

	/* Deterministic PRNG (mulberry32) — the field is designed, not random:
	   the same structure grows on every visit. */
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

	/* --- REGION GEOMETRY (extension point) ------------------------------
	   Seed probability field: a dense horizontal ellipse with a soft
	   organic boundary; angular lobes and a spiral ripple leave faint
	   pores and texture in an otherwise filled body. Future subsections
	   get their own sectors / fields and colors here. */
	let grid = new Uint8Array(W * H);
	const cx = W / 2;
	const cy = H / 2;
	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++) {
			const nx = (x - cx) / (W / 2); // elliptical normalization
			const ny = (y - cy) / (H / 2);
			const r = Math.hypot(nx, ny);
			const a = Math.atan2(ny, nx);
			const edge = 1 / (1 + Math.exp((r - 0.9) / 0.035));
			const lobes = 0.14 * Math.sin(a * 3 + 1.7) * Math.sin(a * 5 - 0.4);
			const ripple = 0.12 * Math.cos(r * 14 - a * 2);
			if (rand() < edge * (0.78 + lobes + ripple)) grid[y * W + x] = 1;
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

	/* Cells: cyans are primary; sparse amber glints in dense cores are
	   secondary. Alpha is quantized — depth, not blur. Glints stay near
	   full strength so they read gold, never muddy. */
	const ALPHAS = [0.45, 0.72, 1];
	const cells = [];
	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++) {
			if (!grid[y * W + x]) continue;
			const n = neighbors(grid, x, y);
			if (n >= 6 && rand() < 0.13) {
				cells.push({ x, y, color: AMBER_GLINT, a: rand() < 0.5 ? 0.85 : 1 });
			} else {
				const color = rand() < 0.55 ? CYAN_DEEP : CYAN_BRIGHT;
				cells.push({ x, y, color, a: ALPHAS[Math.floor(rand() * 3)] });
			}
		}

	/* Pointer reaction: cells near the cursor are pushed outward and
	   spring back — the field shifts around the visitor's presence. */
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
					tx = (dx / d) * f;
					ty = (dy / d) * f;
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
