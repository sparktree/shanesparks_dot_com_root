// audit_site.mjs - integrity audit of the built site in _site/.
// 1. Every internal link, script, stylesheet, image, and worker path in
//    the HTML/JS must resolve to a real file.
// 2. Zero third-party RESOURCE loads: no script/link/img/fetch/import
//    may reference another origin (plain anchors to other sites are
//    allowed - linking out is not loading in).
// Run: node scripts/audit_site.mjs   (exits 1 on any finding)
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "_site");
const findings = [];

function* walk(dir) {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) yield* walk(p);
		else yield p;
	}
}

const exists = (url) => {
	const clean = url.split(/[?#]/)[0];
	const p = join(root, clean);
	return (
		existsSync(p) ||
		existsSync(join(p, "index.html")) ||
		(clean.endsWith("/") && existsSync(join(p, "index.html")))
	);
};

const RESOURCE_ATTR = /<(?:script|link|img|source|iframe|audio|video|embed)\b[^>]*?(?:src|href)=["']([^"']+)["']/gi;
const ANCHOR = /<a\b[^>]*?href=["']([^"']+)["']/gi;
const JS_URL = /(?:fetch\(|new Worker\(|import\s+[^"']*from\s+|importScripts\()\s*["']([^"']+)["']/g;
const ABS_URL = /https?:\/\/[a-z0-9.-]+/gi;

const OWN_HOSTS = ["shanesparks.com", "www.shanesparks.com", "mirror.shanesparks.com"];

for (const file of walk(root)) {
	const rel = file.slice(root.length + 1).replaceAll("\\", "/");
	if (file.endsWith(".html")) {
		const html = readFileSync(file, "utf8");
		for (const [, url] of html.matchAll(RESOURCE_ATTR)) {
			if (/^(data:|mailto:)/.test(url)) continue;
			if (/^https?:/.test(url)) {
				const host = new URL(url).hostname;
				if (!OWN_HOSTS.includes(host))
					findings.push(`${rel}: THIRD-PARTY RESOURCE ${url}`);
			} else if (url.startsWith("/") && !exists(url)) {
				findings.push(`${rel}: broken resource ${url}`);
			}
		}
		for (const [, url] of html.matchAll(ANCHOR)) {
			if (/^(https?:|mailto:|#)/.test(url)) continue; // external links allowed
			if (url.startsWith("/") && !exists(url))
				findings.push(`${rel}: broken link ${url}`);
		}
	} else if (file.endsWith(".js") || file.endsWith(".mjs")) {
		// Only audit our authored code; vendored bundles contain URL
		// constants that our runtime config disables (checked separately).
		if (rel.startsWith("vendor/")) continue;
		const js = readFileSync(file, "utf8");
		for (const [, url] of js.matchAll(JS_URL)) {
			if (/^https?:/.test(url)) findings.push(`${rel}: JS loads ${url}`);
			else if (url.startsWith("/") && !exists(url))
				findings.push(`${rel}: JS references missing ${url}`);
		}
		for (const [m] of js.matchAll(ABS_URL))
			if (!OWN_HOSTS.includes(new URL(m).hostname))
				findings.push(`${rel}: absolute URL in JS ${m}`);
	}
}

if (findings.length) {
	for (const f of findings) console.error("AUDIT: " + f);
	process.exit(1);
}
console.log("audit clean: all internal references resolve; no third-party resource loads in authored code");
