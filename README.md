# shanesparks.com

Source for a fully static, self-contained personal site. Architecture, values, and the
phase-by-phase roadmap live in [PLAN.md](PLAN.md).

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

## Layout

- `src/` — authored content and templates (Eleventy input)
- `vendor/` — pinned third-party runtime assets (Pyodide, Transformers.js), committed
- `models/` — quantized ONNX model weights for demos, committed (no Git LFS — GitHub Pages won't serve it)
- `scripts/` — build/deploy/vendoring scripts
- `_site/` — build output, never committed
