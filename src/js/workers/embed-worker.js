/* embed-worker.js — sentence embeddings via Transformers.js in a Web
   Worker. Loads exclusively from our own origin: remote models are
   disabled, the model path and the ONNX runtime WASM binaries point at
   vendored copies. Tries WebGPU, falls back to WASM (CPU). */

import { env, pipeline } from "/vendor/transformers/transformers.min.js";

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";
env.backends.onnx.wasm.wasmPaths = "/vendor/transformers/onnx/";

const MODEL = "Xenova/all-MiniLM-L6-v2";
let extractor = null;
let device = "wasm";
const post = (type, extra) => self.postMessage({ type, ...extra });

self.onmessage = async (e) => {
	const msg = e.data;
	try {
		if (msg.type === "load") {
			post("progress", { note: "loading model (~24 MB)…" });
			try {
				extractor = await pipeline("feature-extraction", MODEL, {
					dtype: "q8",
					device: "webgpu",
				});
				device = "webgpu";
			} catch {
				extractor = await pipeline("feature-extraction", MODEL, { dtype: "q8" });
			}
			post("ready");
		} else if (msg.type === "run") {
			const sentences = msg.input
				.split("\n")
				.map((s) => s.trim())
				.filter(Boolean);
			if (sentences.length < 2) {
				post("result", { output: "Enter at least two lines to compare." });
				return;
			}
			const t0 = performance.now();
			const out = await extractor(sentences, { pooling: "mean", normalize: true });
			const ms = Math.round(performance.now() - t0);
			const v = out.tolist();
			const dim = v[0].length;
			const rows = [];
			for (let i = 0; i < sentences.length; i++)
				for (let j = i + 1; j < sentences.length; j++) {
					let dot = 0;
					for (let k = 0; k < dim; k++) dot += v[i][k] * v[j][k];
					rows.push({ i, j, sim: dot });
				}
			rows.sort((a, b) => b.sim - a.sim);
			const label = (n) =>
				sentences[n].length > 40 ? sentences[n].slice(0, 37) + "…" : sentences[n];
			const output = [
				`cosine similarity (${sentences.length} sentences, ${dim}-dim, ${device}, ${ms} ms)`,
				"",
				...rows.map((r) => `${r.sim.toFixed(3)}  "${label(r.i)}" × "${label(r.j)}"`),
			].join("\n");
			post("result", { output });
		}
	} catch (err) {
		post("error", { message: err.message });
	}
};
