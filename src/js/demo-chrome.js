/* demo-chrome.js — shared chrome for in-browser demos.
   One pattern for every demo: a load button that discloses the size up
   front (nothing heavy loads until the visitor asks), a trust line that
   states the truth, a progress line, input/output panes, and all work
   in a Web Worker so the page never freezes.

   Worker protocol:
     -> { type: "load" }             load runtime + model
     <- { type: "progress", note }   status updates while loading
     <- { type: "ready" }            runtime is ready
     -> { type: "run", input }       run with the textarea's contents
     <- { type: "result", output }   text to display
     <- { type: "error", message }   failure in either phase */

export function mountDemo(root) {
	const workerUrl = root.dataset.worker;
	const size = root.dataset.size;
	const defaultInput = root.querySelector("template")?.content.textContent.trim() ?? "";

	root.innerHTML = `
		<p class="demo-trust">Runs entirely in your browser — nothing is
		installed, and nothing you type leaves this page.</p>
		<div class="demo-controls">
			<button class="demo-load">Load demo (${size})</button>
			<span class="demo-status" role="status" aria-live="polite"></span>
		</div>
		<div class="demo-io" hidden>
			<label>Input
				<textarea class="demo-input" rows="8" spellcheck="false"></textarea>
			</label>
			<button class="demo-run">Run</button>
			<label>Output
				<pre class="demo-output" aria-live="polite"></pre>
			</label>
		</div>`;

	const loadBtn = root.querySelector(".demo-load");
	const runBtn = root.querySelector(".demo-run");
	const status = root.querySelector(".demo-status");
	const io = root.querySelector(".demo-io");
	const input = root.querySelector(".demo-input");
	const output = root.querySelector(".demo-output");
	input.value = defaultInput;

	let worker = null;

	loadBtn.addEventListener("click", () => {
		loadBtn.disabled = true;
		status.textContent = "loading…";
		worker = new Worker(workerUrl, { type: "module" });
		worker.onmessage = (e) => {
			const msg = e.data;
			if (msg.type === "progress") {
				status.textContent = msg.note;
			} else if (msg.type === "ready") {
				status.textContent = "ready";
				loadBtn.hidden = true;
				io.hidden = false;
			} else if (msg.type === "result") {
				output.textContent = msg.output;
				runBtn.disabled = false;
				status.textContent = "ready";
			} else if (msg.type === "error") {
				status.textContent = "error — " + msg.message;
				loadBtn.disabled = false;
				runBtn.disabled = false;
			}
		};
		worker.onerror = (e) => {
			status.textContent = "error — " + (e.message || "worker failed to start");
			loadBtn.disabled = false;
		};
		worker.postMessage({ type: "load" });
	});

	runBtn.addEventListener("click", () => {
		runBtn.disabled = true;
		status.textContent = "running…";
		output.textContent = "";
		worker.postMessage({ type: "run", input: input.value });
	});
}

for (const el of document.querySelectorAll("[data-demo]")) mountDemo(el);
