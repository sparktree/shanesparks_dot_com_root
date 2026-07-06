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

The deployed artifact is the `_site/` folder — plain HTML/CSS/JS that works on any
web server, e.g. `python -m http.server -d _site`.

## Resurrection path (from a bare clone on a fresh machine)

1. Install Node (version in `.nvmrc`) and run the build commands above.
2. Deploy `_site/` — see PLAN.md Phase 5 (`scripts/deploy.sh` once it exists:
   Cloudflare Workers Static Assets via `wrangler deploy`, GitHub Pages via
   `gh-pages` branch push).
3. Recreate DNS from `dns/zone.txt` (once it exists).

## Layout

- `src/` — authored content and templates (Eleventy input)
- `vendor/` — pinned third-party runtime assets (Pyodide, Transformers.js), committed
- `models/` — quantized ONNX model weights for demos, committed (no Git LFS — GitHub Pages won't serve it)
- `scripts/` — build/deploy/vendoring scripts
- `_site/` — build output, never committed
