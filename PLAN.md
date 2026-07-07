# shanesparks.com — Development & Deployment Plan

**Architecture:** fully static site, built locally, deployed via Git to managed static hosts.
**Governing values:** independence and self-reliance, censorship resilience within the static-Git framework, self-expression and digital aesthetics, in-browser NLP demos.

> **Status (2026-07-06):** Phases 0–3 and 5 complete; site live at
> shanesparks.com with the GitHub Pages hot standby at mirror.shanesparks.com.
> Phase 4 underway (flagship quantum-embeddings demo shipped). Phase 6
> complete: resurrection path tested, source mirrored to Codeberg with
> dual-push. Remaining: content placeholders (About, first essay), further
> Phase 4 demos, optional IPFS snapshot.

---

## Guiding principles

These translate your values into engineering rules. Every later decision should be checkable against them.

1. **The host is a dumb file server.** No platform-specific features (no Cloudflare Workers/Functions, no GitHub Actions that do anything a local script can't, no host-side redirects or headers the site depends on to function). The deployed artifact is a folder of files that works identically on any web server, including `python -m http.server` on your own machine. This is what makes migration — or flight from deplatforming — a one-hour job instead of a rewrite.
2. **Total asset containment.** Every font, script, stylesheet, image, WASM binary, Python wheel, and model weight lives in the repository (or a repo-adjacent store you control). Zero requests to third-party origins at runtime. This is both an independence measure and a privacy statement to your visitors.
3. **The repository is the site.** Anyone (including future you) who clones the repo can build and run the entire site offline. The build toolchain is pinned and documented.
4. **Mirrors, not migration plans.** Censorship resilience under static-Git means deploying the same artifact to multiple independent hosts *from day one*, not keeping a fallback plan in a drawer.
5. **Aesthetics are first-class.** The design system is hand-built, not a framework default. Progressive enhancement: the site is beautiful and fully readable with JavaScript disabled; JS adds the demos and flourishes.

---

## Phase 0 — Repository scaffold and toolchain

**Goal:** a repo that builds a deployable `_site/` folder locally.

- Initialize a Git repository in this directory.
- **Static site generator: Eleventy (11ty).** Rationale against alternatives:
  - Plain hand-written HTML gets painful the moment you have a shared header across 10+ pages.
  - Hugo is fine, but Eleventy's templating (Nunjucks/Liquid) is closer to plain HTML, has no opinions about site structure, and emits exactly the markup you write — nothing injected. That matters for a site where the markup *is* the aesthetic.
  - **Astro** was the serious contender (2026 comparisons generally recommend it as the modern default for content sites). Its islands architecture also ships zero JS by default. But its advantages — component frameworks, TypeScript integration, incremental builds at 5k+ pages — are things this site deliberately doesn't want, and it inserts its own compiler between you and the markup. The same comparisons still recommend Eleventy specifically for personal sites/portfolios where simplicity and full control of output are the goals. Decision: Eleventy, reaffirmed.
  - Eleventy is a **build-time-only** dependency. Its output contains zero Eleventy runtime code. The independence principle applies to the *deployed artifact*, not the workbench.
- Pin the toolchain: `package.json` with exact versions, `package-lock.json` committed, Node version recorded in `.nvmrc`. Document the two commands that matter in `README.md`: `npm install` and `npm run build`.
- Directory layout:

  ```
  shanesparks_dot_com_root/
  ├── src/                  # Eleventy input
  │   ├── _includes/        # layouts, partials
  │   ├── _data/            # site metadata (title, nav) as JSON
  │   ├── css/
  │   ├── js/               # vanilla JS only
  │   ├── fonts/            # self-hosted, subsetted woff2
  │   ├── img/
  │   ├── index.njk
  │   ├── writing/          # essays/blog (markdown)
  │   ├── projects/         # project pages
  │   └── demos/            # one folder per interactive demo
  ├── vendor/               # third-party runtime assets, committed:
  │   ├── pyodide/          # Pyodide core + selected wheels
  │   └── transformers-js/  # transformers.js bundle + ONNX runtime WASM
  ├── models/               # quantized ONNX model weights (see Phase 3)
  ├── scripts/              # build/deploy/vendor-update shell scripts
  ├── .eleventy.js
  ├── package.json
  └── PLAN.md               # this file
  ```

  `vendor/` and `models/` are passed through to `_site/` untouched. They're committed as ordinary Git blobs — **not Git LFS**, because GitHub Pages does not serve LFS objects.

**Milestone:** `npm run build` produces `_site/`, and `npx @11ty/eleventy --serve` shows a homepage locally.

---

## Phase 1 — Design system (the aesthetic foundation)

**Goal:** a small, hand-owned design language before any content exists, so every page inherits it.

- **Typography:** choose 1–2 open-license typefaces (OFL-licensed, e.g. from the Google Fonts *source repos*, not their CDN). Download the source files, subset them to the character ranges you use (`pyftsubset` from fonttools, or `glyphhanger`), convert to woff2, self-host in `src/fonts/` with `font-display: swap` and preload hints. A subsetted woff2 is typically 15–40 KB — self-hosting costs nothing.
- **One CSS file, hand-written.** No Tailwind, no Bootstrap — a framework's look is the opposite of self-expression, and utility-class HTML fights the "markup is the aesthetic" principle. Structure it as:
  - `tokens.css` — custom properties: color palette, type scale, spacing scale. Include a dark scheme via `prefers-color-scheme` from the start (retrofitting is miserable).
  - `base.css` — element defaults, vertical rhythm, prose styling.
  - `components.css` — nav, cards, footnotes, demo chrome.
- **A signature element.** Decide early what makes the site recognizably *yours* — a generative header, an unusual layout grid, hand-drawn dividers, a distinctive link style. Budget real time for this; it's a stated goal, not polish.
- Accessibility as craft: real focus styles, WCAG-AA contrast in both color schemes, `prefers-reduced-motion` respected by any animation.

**Milestone:** a style-guide page (`/styleguide/`) showing every token and component. Keep it in the deployed site — it's honest self-expression about how the site is made.

---

## Phase 2 — Content structure

**Goal:** the non-interactive site, complete.

- Pages: home, about, projects index, writing index, contact, styleguide, `/colophon/` (how the site is built — fits the self-reliance ethos and is a courtesy to like-minded readers).
- Writing pipeline: Markdown files in `src/writing/`, one layout, RSS/Atom feed generated at build time (`@11ty/eleventy-plugin-rss`). **A feed is an independence feature** — it lets readers follow you without any platform.
- Each NLP project gets a page: problem, approach, results, links to code, and — where feasible — an embedded demo (Phase 4).
- No analytics at all, or self-contained ones only: a first-party script that does nothing (respecting visitors) — or skip entirely. No third-party trackers under any circumstances, per principle 2.
- `robots.txt`, `sitemap.xml`, Open Graph tags with self-hosted preview images, a proper 404 page (both GitHub Pages and Cloudflare's static-asset serving return `404.html` automatically — one of the few host behaviors safe to rely on, since it degrades gracefully).

**Milestone:** the full site works, looks right, and is readable with JavaScript disabled.

---

## Phase 3 — Demo runtime infrastructure (the hard part)

**Goal:** a self-hosted, reusable foundation for in-browser NLP demos. This phase is where your constraints bite, so it deserves the clearest thinking.

### The honest technical picture

- **Pyodide** runs CPython in WASM. It supports **NumPy, SciPy, scikit-learn, pandas, regex, nltk (pure-Python parts)** and any pure-Python wheel. It does **not** support PyTorch, and therefore **Hugging Face `transformers` will not run under Pyodide** for any model that needs a torch backend (i.e., nearly all of it). Plan around this now rather than discovering it mid-demo.
- **Transformers.js** (`@huggingface/transformers`, v3+) is the browser-native path for neural models: it runs quantized ONNX exports of Hugging Face models via ONNX Runtime Web. Embeddings, classification, NER, small seq2seq, and small generative models all work. Since v3 it supports `device: 'webgpu'` for 3–10× speedups on supporting browsers — request WebGPU, fall back to WASM automatically (WebGPU support is broad but not universal).
- So the demo stack is **two runtimes**, chosen per demo:
  1. **Pyodide** — demos where the interesting part is *your Python code*: classical NLP, tokenization experiments, statistical methods, scikit-learn models, anything showing your actual research code.
  2. **Transformers.js** — demos where the interesting part is *a neural model's behavior*: embeddings, attention visualization, classification.

### Self-hosting the runtimes (critical for independence)

Both runtimes phone home by default. Both can be fully contained:

- **Pyodide:** by default `loadPyodide()` fetches from the jsDelivr CDN. Instead, download a Pyodide release, copy the core runtime plus *only the wheels you need* (core is ~10–20 MB; the NumPy wheel ~8 MB; don't vendor the full ~300 MB distribution) into `vendor/pyodide/`, and pass `indexURL: "/vendor/pyodide/"`. Your own Python code ships as plain `.py` files or a zip loaded at startup.
- **Transformers.js:** by default it downloads models from huggingface.co. Set `env.allowRemoteModels = false` and `env.localModelPath = "/models/"`, vendor the library bundle and the ONNX Runtime `.wasm` files (set `env.backends.onnx.wasm.wasmPaths` to your vendored path), and serve model files from your own origin.

Write a `scripts/vendor.sh` that downloads and pins these by version, so updating is deliberate and reproducible.

### Model weights: the size problem

This is the single biggest constraint on host choice and demo ambition:

| Constraint | Number |
|---|---|
| Cloudflare Workers static assets max file size | 25 MiB |
| GitHub Pages / GitHub repo max file size | 100 MB (LFS not served) |
| GitHub Pages recommended repo size | < 1 GB |
| GitHub Pages bandwidth soft cap | 100 GB/month |
| Cloudflare static-asset requests | free and unlimited |

Consequences:

- **Prefer small, quantized models.** Q8/Q4 ONNX exports of MiniLM-class embedding models are ~15–25 MB; DistilBERT-class classifiers ~30–70 MB; small T5/GPT-2 variants ~80–250 MB. Curate one or two *good* small models per demo rather than offering large ones.
- Models 25 MiB–100 MB fit on GitHub Pages but not Cloudflare. Options, in order of preference: (a) quantize harder to get under 25 MiB; (b) split weights with ONNX's external-data format so no single file exceeds the cap; (c) serve that model only from the GitHub Pages mirror. Avoid (c) where possible — mirrors should be identical (principle 4).
- **Lazy-load everything.** No runtime or model downloads until a visitor presses "Run demo." Show sizes up front ("this downloads ~40 MB") — respecting visitors' bandwidth is part of the ethos. Cache aggressively: the Cache Storage API for model files, so a returning visitor pays the download once.

### Shared demo chrome

Build once, reuse per demo: a `<demo-*>` pattern (or a small vanilla-JS module) providing the load button + size disclosure, progress bar for runtime/model download, input/output panes styled by the design system, an error state, and a "view the source of this demo" link. All demo work happens in a **Web Worker** so the UI never freezes during inference.

**Milestone:** a "hello world" of each runtime deployed locally — Pyodide computing something with NumPy, Transformers.js running a sentence-embedding similarity demo — both loading exclusively from your own origin (verify with the network tab: zero third-party requests).

---

## Phase 4 — First real demos

**Goal:** two flagship demos that showcase your NLP work.

- Pick one Pyodide-suited project (your own algorithms/classical NLP) and one Transformers.js-suited project (neural model behavior). Port, quantize, measure sizes, wire into the shared chrome.
- Each demo page includes the write-up: what it does, how it works, what's downloading and why, and a link to the underlying code. The demo *is* content, not a widget bolted onto content.
- Test on a mid-range phone and a throttled connection. WASM NLP is heavy; graceful degradation (a "your device may struggle with this" note, or a recorded GIF fallback) beats a frozen tab.

**Milestone:** two demos live in the local build, running entirely from first-party assets.

---

## Phase 5 — Deployment and DNS

**Goal:** the site live on your domain, served from two independent hosts.

### Recommended topology

**Source of truth: a Git repo (GitHub, plus a mirror remote — see Phase 6). Deploy the built `_site/` to BOTH Cloudflare (Workers Static Assets) and GitHub Pages. Point the apex domain at Cloudflare; keep GitHub Pages as a hot standby on a subdomain.**

> **Research note (July 2026):** Cloudflare Pages is in maintenance mode — Cloudflare now recommends **Workers with Static Assets** for new projects, and new features land there. For a site with no server code this changes almost nothing: an "assets-only Worker" is just a `wrangler.jsonc` declaring `assets.directory = "_site"` and a `wrangler deploy` — no Worker script, no compute, and requests to static assets are **free and unlimited** on the free plan. It stays fully within principle 1 (dumb file server); we simply never add Worker logic the site depends on.

Rationale:

- **Cloudflare as primary** because model-file demos make bandwidth the scarce resource: Cloudflare serves static assets free and uncapped, while GitHub Pages soft-caps at 100 GB/month — a few hundred visitors running a 50 MB demo could plausibly hit that.
- **GitHub Pages as live mirror** because it has different failure and deplatforming characteristics (different company, different jurisdictional pressures, different ToS). If Cloudflare drops you, you change one DNS record and you're back. This is the strongest censorship-resilience posture available without renting infrastructure — and because of principle 1 (host as dumb file server), adding a third mirror later (GitLab Pages, Codeberg Pages, or eventually your own box) is trivial.
- **Build locally, deploy the artifact** rather than letting each host run its own build. Use `wrangler deploy` for Cloudflare (direct upload of `_site/`, no Git integration — keeps Cloudflare from needing access to your repo at all) and a `gh-pages` branch push for GitHub Pages. One `scripts/deploy.sh` does both. This keeps builds on your hardware (your stated Phase-1 value) and guarantees both mirrors serve byte-identical artifacts.

### DNS configuration (at your registrar)

- Apex `shanesparks.com` → the Worker, via Cloudflare's custom-domain setting on the Worker (`*.workers.dev` remains as a free preview hostname). Note: attaching a custom domain requires the domain's DNS zone to be on Cloudflare — this is the one real coupling in the design. Accept it (their free DNS is good and moving DNS off Cloudflare later takes minutes), and record the full DNS zone in the repo (`dns/zone.txt`) so it can be recreated anywhere instantly.
- `www` → CNAME to the apex (or the Pages hostname), with a redirect to the apex.
- `mirror.shanesparks.com` (or similar) → CNAME to `<username>.github.io`, with the matching CNAME file/custom-domain setting on the GitHub Pages side, HTTPS enforced.
- Set `CAA` records while you're in there; keep registrar 2FA on — **the domain is the single genuinely irreplaceable asset in this whole architecture.** Auto-renew on, registered under an email that doesn't depend on the domain itself.
- Use absolute-path URLs (`/css/main.css`), never absolute-origin URLs (`https://shanesparks.com/...`), in all internal references — so every mirror works under its own name.

**Milestone:** `https://shanesparks.com` live from Cloudflare, byte-identical site live at the GitHub Pages mirror, `curl`-verified; zero third-party requests confirmed in production.

---

## Phase 6 — Resilience and longevity

**Goal:** make the setup durable against host failure, account loss, and your own future forgetfulness.

- **Repo mirrors:** add a second Git remote (Codeberg or GitLab) and push to both routinely (`git remote set-url --add --push`). The repo is the site; two copies of it means no single account controls your work.
- **Local is canonical:** your working copy plus routine backups of it (whatever your existing backup practice is) outrank every remote.
- **Document the resurrection path** in `README.md`: from a bare clone on a fresh machine to a live site — install Node version X, `npm ci`, `npm run build`, deploy commands, DNS records (from `dns/zone.txt`). Test it once by actually doing it.
- **Content freedom:** because everything is Markdown + standard HTML/CSS/JS, nothing about your writing or demos is trapped in a platform format. Keep it that way — resist any future plugin that stores content in a proprietary shape.
- **Revisit IPFS later, cheaply:** once the site exists as a static artifact, pinning a *snapshot* of the non-demo pages to IPFS costs almost nothing and scratches the decentralization itch — the artifact-first architecture keeps that door open. Likewise, if you ever do self-host, the deploy script grows one `rsync` line.

---

## Sequence and effort summary

| Phase | Deliverable | Rough effort |
|---|---|---|
| 0 | Repo + Eleventy building locally | an evening |
| 1 | Design system + styleguide page | 1–2 weeks of deliberate craft |
| 2 | Full non-interactive site + feed | ~1 week |
| 3 | Self-hosted Pyodide + Transformers.js foundation | 1–2 weeks (the technically hardest phase) |
| 4 | Two flagship demos | 1–2 weeks each |
| 5 | Dual deployment + DNS | a day |
| 6 | Mirrors, docs, backups | a day, then ongoing habit |

Phases 1–2 and 3 can proceed in parallel. Deploy (Phase 5) can happen as early as end of Phase 2 — shipping the content site first, then landing demos onto a live site, is the recommended path.
