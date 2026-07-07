# shanesparks.com

Source for a fully static, self-contained personal site. Architecture, values, and the
phase-by-phase roadmap live in [PLAN.md](PLAN.md). Code is MIT; writings and imagery
are all rights reserved; vendored runtimes keep their upstream licenses — see
[LICENSE.md](LICENSE.md).

## Build

Requires Node (version in [.nvmrc](.nvmrc)). Then:

```sh
npm ci          # install pinned dependencies
npm run build   # emit the deployable site to _site/
npm run serve   # local dev server with live reload
```

Runtime assets for the demos (Pyodide, Transformers.js, ONNX runtime, model
weights) are committed under `vendor/` and `models/` and served from our own
origin — the demos make zero third-party requests. To re-vendor (pinned
versions live at the top of the script):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\vendor.ps1
```

The deployed artifact is the `_site/` folder — plain HTML/CSS/JS that works on any
web server, e.g. `python -m http.server -d _site`.

## Deploy

Both hosts receive the same locally-built artifact:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
```

One-time setup: `npx wrangler login` (Cloudflare), create the GitHub repo
(name it `<username>.github.io` so Pages serves at the root) and
`git remote add origin <url>`, then enable Pages from the `gh-pages` branch.

## Resurrection path (from a bare clone on a fresh machine)

1. Install Node (version in `.nvmrc`) and run the build commands above.
2. Run `scripts\deploy.ps1` (after `npx wrangler login` and adding the
   `origin` remote).
3. Recreate DNS from `dns/zone.txt`.

**Tested 2026-07-06:** a fresh clone from GitHub built the complete site;
output verified against the canonical build by SHA-256. (The test caught and
fixed a nondeterministic sitemap ordering and stale files lingering in
`_site/` — the deploy script now cleans before building.)

## Resilience

- **The repo is the site; local is canonical.** Keep the working copy in
  your normal backup rotation.
- **Second remote (do this once):** create an empty repo on a host with
  different failure modes than GitHub (Codeberg or GitLab), then:

  ```sh
  git remote add mirror <url>
  git remote set-url --add --push origin <github-url>
  git remote set-url --add --push origin <mirror-url>
  ```

  After that, every `git push origin main` lands on both hosts.
- **Hosting mirrors:** the deployed artifact already lives on Cloudflare
  (primary) and GitHub Pages (`mirror.shanesparks.com`); flight plan in
  `dns/zone.txt`.
- **IPFS snapshot** of the non-demo pages remains an open, cheap option —
  the artifact-first architecture keeps that door open (PLAN.md Phase 6).

## Layout

- `src/` — authored content and templates (Eleventy input)
- `vendor/` — pinned third-party runtime assets (Pyodide, Transformers.js), committed
- `models/` — quantized ONNX model weights for demos, committed (no Git LFS — GitHub Pages won't serve it)
- `scripts/` — build/deploy/vendoring scripts
- `_site/` — build output, never committed
