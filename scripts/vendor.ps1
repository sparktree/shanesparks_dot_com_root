# vendor.ps1 - reproducible re-vendoring of runtime assets.
# Everything the demos load at runtime comes from our own origin; this
# script is the only place third-party servers are ever contacted, and
# only at vendoring time. Versions are pinned below - bump deliberately.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\vendor.ps1

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$PYODIDE_VERSION = "314.0.2"
$NUMPY_WHEEL = "numpy-2.4.3-cp314-cp314-pyemscripten_2026_0_wasm32.whl"
$NUMPY_SHA256 = "0cad9c1b91f0082e4f959bc0e0bf5835a2efbba6ab3b1e9d1fe6e7e564cca98e"
# @huggingface/transformers is pinned exactly in package.json / package-lock.json.
$MODEL_REPO = "Xenova/all-MiniLM-L6-v2"

$root = Split-Path $PSScriptRoot -Parent
$tmp = Join-Path $env:TEMP "vendor-work"
New-Item -ItemType Directory -Force $tmp | Out-Null

# --- Pyodide core + NumPy wheel --------------------------------------
Write-Host "Vendoring Pyodide $PYODIDE_VERSION..."
$tarball = Join-Path $tmp "pyodide-core.tar.bz2"
Invoke-WebRequest "https://github.com/pyodide/pyodide/releases/download/$PYODIDE_VERSION/pyodide-core-$PYODIDE_VERSION.tar.bz2" -OutFile $tarball
tar -xjf $tarball -C $tmp
$pyDest = Join-Path $root "vendor\pyodide"
New-Item -ItemType Directory -Force $pyDest | Out-Null
foreach ($f in "pyodide.mjs","pyodide.asm.mjs","pyodide.asm.wasm","python_stdlib.zip","pyodide-lock.json") {
	Copy-Item (Join-Path $tmp "pyodide\$f") (Join-Path $pyDest $f) -Force
}
Invoke-WebRequest "https://cdn.jsdelivr.net/pyodide/v$PYODIDE_VERSION/full/$NUMPY_WHEEL" -OutFile (Join-Path $pyDest $NUMPY_WHEEL)
$hash = (Get-FileHash (Join-Path $pyDest $NUMPY_WHEEL) -Algorithm SHA256).Hash.ToLower()
if ($hash -ne $NUMPY_SHA256) { throw "NumPy wheel sha256 mismatch: $hash" }

# --- Transformers.js + ONNX Runtime WASM ------------------------------
# Source of truth is node_modules (pinned by package-lock); run npm ci first.
Write-Host "Vendoring Transformers.js from node_modules..."
$tfDest = Join-Path $root "vendor\transformers"
New-Item -ItemType Directory -Force (Join-Path $tfDest "onnx") | Out-Null
Copy-Item (Join-Path $root "node_modules\@huggingface\transformers\dist\transformers.min.js") (Join-Path $tfDest "transformers.min.js") -Force
# All four runtime variants: the browser-dependent resolution logic may
# pick any of plain / jsep / asyncify / jspi - vendor them all so no
# path ever leaves our origin.
foreach ($f in "ort-wasm-simd-threaded.mjs","ort-wasm-simd-threaded.wasm","ort-wasm-simd-threaded.jsep.mjs","ort-wasm-simd-threaded.jsep.wasm","ort-wasm-simd-threaded.asyncify.mjs","ort-wasm-simd-threaded.asyncify.wasm","ort-wasm-simd-threaded.jspi.mjs","ort-wasm-simd-threaded.jspi.wasm") {
	Copy-Item (Join-Path $root "node_modules\onnxruntime-web\dist\$f") (Join-Path $tfDest "onnx\$f") -Force
}

# --- Model weights -----------------------------------------------------
Write-Host "Vendoring $MODEL_REPO..."
$mDest = Join-Path $root "models\$($MODEL_REPO -replace '/', '\')"
New-Item -ItemType Directory -Force (Join-Path $mDest "onnx") | Out-Null
$base = "https://huggingface.co/$MODEL_REPO/resolve/main"
foreach ($f in "config.json","tokenizer.json","tokenizer_config.json","special_tokens_map.json") {
	Invoke-WebRequest "$base/$f" -OutFile (Join-Path $mDest $f)
}
Invoke-WebRequest "$base/onnx/model_quantized.onnx" -OutFile (Join-Path $mDest "onnx\model_quantized.onnx")

# --- Cloudflare per-file cap check ------------------------------------
$cap = 25MB
Get-ChildItem (Join-Path $root "vendor"), (Join-Path $root "models") -Recurse -File | ForEach-Object {
	if ($_.Length -gt $cap) { Write-Warning "$($_.FullName) is $([math]::Round($_.Length/1MB,1)) MB - exceeds the 25 MiB Cloudflare cap" }
}
Write-Host "Done."
