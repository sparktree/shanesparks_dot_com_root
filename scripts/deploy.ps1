# deploy.ps1 — build locally, deploy the identical artifact to both hosts.
# The build happens on our hardware; hosts only ever receive inert files.
#
# One-time setup:
#   Cloudflare:  npx wrangler login
#   GitHub:      create the repo (recommended name: <username>.github.io so
#                Pages serves at the root — absolute paths like /css/ depend
#                on it), then: git remote add origin <url>
#                In the repo settings, set Pages to deploy from gh-pages.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

# --- Build -------------------------------------------------------------
npm run build
if ($LASTEXITCODE -ne 0) { throw "build failed" }

# --- Cloudflare Workers Static Assets ----------------------------------
Write-Host "`nDeploying to Cloudflare..."
npx wrangler deploy
if ($LASTEXITCODE -ne 0) { throw "wrangler deploy failed (run 'npx wrangler login' first?)" }

# --- GitHub Pages mirror ------------------------------------------------
# Publishes _site/ as a fresh single-commit gh-pages branch: byte-identical
# artifact, no history bloat, force-pushed each deploy.
$origin = git remote get-url origin 2>$null
if (-not $origin) {
	Write-Warning "No 'origin' remote — skipping GitHub Pages mirror."
	exit 0
}
Write-Host "`nDeploying mirror to GitHub Pages..."
$sha = (git rev-parse --short HEAD).Trim()
$tmp = Join-Path $env:TEMP "ghpages-deploy"
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory $tmp | Out-Null
Copy-Item "$root\_site\*" $tmp -Recurse
# GitHub Pages runs Jekyll unless told not to; we ship plain files.
New-Item -ItemType File (Join-Path $tmp ".nojekyll") | Out-Null
# Pin the Pages custom domain (GitHub reads this file from the branch).
Set-Content (Join-Path $tmp "CNAME") "mirror.shanesparks.com"
git -C $tmp init -b gh-pages -q
git -C $tmp add -A
git -C $tmp -c user.name="Shane Sparks" -c user.email="sparktree@users.noreply.github.com" commit -q -m "Deploy $sha"
git -C $tmp push --force $origin gh-pages
Remove-Item $tmp -Recurse -Force
Write-Host "`nDone: Cloudflare + GitHub Pages mirror deployed from commit $sha."
