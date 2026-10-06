// Descarga el listado de fitnessprogramer.com -> scratch/fp_catalogo.json
// Uso: node scripts_datos/scrape_fitnessprogramer.js
const fs = require("fs");
const BASE = "https://fitnessprogramer.com";
const UA = { "User-Agent": "Mozilla/5.0" };
const dec = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/\s+/g, " ").trim();

async function page(p) {
	const url = p === 1 ? `${BASE}/exercises/` : `${BASE}/exercises/page/${p}/`;
	for (let i = 0; i < 3; i++) {
		try { const r = await fetch(url, { headers: UA }); if (r.ok) return await r.text(); } catch {}
	}
	throw new Error("fallo página " + p);
}
function parse(html) {
	const out = [];
	for (const m of html.matchAll(/<article [^>]*class="entry"[^>]*>([\s\S]*?)<\/article>/g)) {
		const b = m[1];
		const u = b.match(/href="([^"]+\/exercise\/[^"]+)"/)?.[1];
		const img = b.match(/<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"/) || b.match(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]+)"/);
		const g = (c) => { const x = b.match(new RegExp(`exercise_meta ${c}">\\s*<label>[^<]*</label>([^<]*)`)); return x ? dec(x[1]) : ""; };
		if (!u || !img) continue;
		const isFirst = /src="/.test(img[0]) && img[0].indexOf("src=") < img[0].indexOf("alt=");
		out.push({ nombre: dec(isFirst ? img[2] : img[1]), gif: isFirst ? img[1] : img[2], url: u, equipo: g("equipment"), musculos: g("primary_muscles") });
	}
	return out;
}
(async () => {
	const first = await page(1);
	const last = Math.max(...[...first.matchAll(/\/exercises\/page\/(\d+)\//g)].map((m) => +m[1]));
	const res = parse(first);
	console.log("páginas:", last);
	for (let p = 2; p <= last; p += 6) {
		const batch = await Promise.all(Array.from({ length: Math.min(6, last - p + 1) }, (_, i) => page(p + i).then(parse)));
		batch.forEach((b) => res.push(...b));
	}
	fs.mkdirSync("scratch", { recursive: true });
	fs.writeFileSync("scratch/fp_catalogo.json", JSON.stringify(res, null, 1));
	console.log("ejercicios:", res.length, "únicos:", new Set(res.map((r) => r.url)).size);
})();
