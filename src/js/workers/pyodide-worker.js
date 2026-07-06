/* pyodide-worker.js — Python (CPython on WASM) in a Web Worker.
   Loads exclusively from our own origin: indexURL points at the
   vendored Pyodide, and NumPy resolves to the vendored wheel via the
   vendored lockfile. No third-party requests, ever. */

import { loadPyodide } from "/vendor/pyodide/pyodide.mjs";

let pyodide = null;
const post = (type, extra) => self.postMessage({ type, ...extra });

self.onmessage = async (e) => {
	const msg = e.data;
	try {
		if (msg.type === "load") {
			post("progress", { note: "loading Python runtime (~13 MB)…" });
			pyodide = await loadPyodide({ indexURL: "/vendor/pyodide/" });
			post("progress", { note: "loading NumPy (~3 MB)…" });
			await pyodide.loadPackage("numpy");
			post("ready");
		} else if (msg.type === "run") {
			const lines = [];
			pyodide.setStdout({ batched: (s) => lines.push(s) });
			pyodide.setStderr({ batched: (s) => lines.push(s) });
			const value = await pyodide.runPythonAsync(msg.input);
			if (value !== undefined) lines.push(String(value));
			post("result", { output: lines.join("\n") || "(no output)" });
		}
	} catch (err) {
		post("error", { message: err.message });
	}
};
