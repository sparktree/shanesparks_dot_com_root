/* qnlp-worker.js - the live quantum-embedding pipeline, in a Web Worker.
   Implements the method of Cavar, Parukola, Graves & Sparks (2025):
   classical embedding -> amplitude encoding (real, or complex via
   interdigitation / halves, halving the qubit count) -> SWAP test.

   The SWAP test is simulated faithfully: for states |a>,|b> the ancilla
   measures 1 with probability (1 - |<a|b>|^2)/2, so we compute the exact
   fidelity and draw real Bernoulli shots from it - exactly the statistics
   an ideal (noiseless) statevector simulator produces for this circuit.
   Loads exclusively from our own origin. */

import { env, pipeline } from "/vendor/transformers/transformers.min.js";

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";
env.backends.onnx.wasm.wasmPaths = "/vendor/transformers/onnx/";

const MODELS = {
	minilm: "Xenova/all-MiniLM-L6-v2",
	arctic: "Snowflake/snowflake-arctic-embed-xs",
};

let extractor = null;
let device = "wasm";
const post = (type, extra) => self.postMessage({ type, ...extra });

/* --- Amplitude encoding ------------------------------------------------ */

function encode(v, mode) {
	let re;
	let im;
	if (mode === "real") {
		re = Float64Array.from(v);
		im = new Float64Array(v.length);
	} else if (mode === "cint") {
		// every second dimension becomes the imaginary part (interdigitation)
		const half = Math.floor(v.length / 2);
		re = new Float64Array(half);
		im = new Float64Array(half);
		for (let i = 0; i < half; i++) {
			re[i] = v[2 * i];
			im[i] = v[2 * i + 1];
		}
	} else {
		// halves: first half real, second half imaginary
		const half = Math.floor(v.length / 2);
		re = Float64Array.from(v.slice(0, half));
		im = Float64Array.from(v.slice(half, 2 * half));
	}
	// pad to a power of two (the unit norm is preserved: pads are zero)
	const dim = 1 << Math.ceil(Math.log2(re.length));
	const reP = new Float64Array(dim);
	const imP = new Float64Array(dim);
	reP.set(re);
	imP.set(im);
	return { re: reP, im: imP, dim, amps: re.length };
}

/* Fidelity |<a|b>|^2 with <a|b> = sum(conj(a_i) * b_i) */
function fidelity(a, b) {
	let rr = 0;
	let ri = 0;
	for (let i = 0; i < a.re.length; i++) {
		rr += a.re[i] * b.re[i] + a.im[i] * b.im[i];
		ri += a.re[i] * b.im[i] - a.im[i] * b.re[i];
	}
	return rr * rr + ri * ri;
}

/* --- Protocol ----------------------------------------------------------- */

self.onmessage = async (e) => {
	const msg = e.data;
	try {
		if (msg.type === "load") {
			extractor = null;
			post("progress", { note: "loading model (~22 MB)..." });
			try {
				extractor = await pipeline("feature-extraction", MODELS[msg.model], {
					dtype: "q8",
					device: "webgpu",
				});
				device = "webgpu";
			} catch {
				extractor = await pipeline("feature-extraction", MODELS[msg.model], {
					dtype: "q8",
				});
				device = "wasm";
			}
			post("ready", { device });
		} else if (msg.type === "run") {
			const out = await extractor([msg.a, msg.b], {
				pooling: "mean",
				normalize: true,
			});
			const [va, vb] = out.tolist();
			let cos = 0;
			for (let i = 0; i < va.length; i++) cos += va[i] * vb[i];

			const qa = encode(va, msg.encoding);
			const qb = encode(vb, msg.encoding);
			const fid = fidelity(qa, qb);
			const qubits = Math.log2(qa.dim);

			post("encoded", {
				dims: va.length,
				amps: qa.amps,
				dim: qa.dim,
				qubits,
				totalQubits: 2 * qubits + 1,
				cos,
				fid,
				device,
				stripA: { re: Array.from(qa.re), im: Array.from(qa.im) },
				stripB: { re: Array.from(qb.re), im: Array.from(qb.im) },
			});

			// SWAP test: P(ancilla = 1) = (1 - fidelity)/2, sampled shot by
			// shot and streamed in batches so the estimate visibly converges.
			const p1 = (1 - fid) / 2;
			const shots = msg.shots;
			const batches = 48;
			const per = Math.ceil(shots / batches);
			let n = 0;
			let ones = 0;
			while (n < shots) {
				const take = Math.min(per, shots - n);
				let hits = 0;
				for (let i = 0; i < take; i++) if (Math.random() < p1) hits++;
				n += take;
				ones += hits;
				post("shots", { n, ones, batch: hits, batchSize: take });
				await new Promise((r) => setTimeout(r, 20));
			}
			post("runComplete", { n, ones, estimate: 1 - (2 * ones) / n });
		}
	} catch (err) {
		post("error", { message: err.message });
	}
};
