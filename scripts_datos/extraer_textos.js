// Extrae las cadenas en español visibles al usuario (HTML estático + literales de JS) para traducirlas.
// Uso: node scripts_datos/extraer_textos.js  -> scratch/textos_es.json
const fs = require("fs");
const path = require("path");
const acorn = require("../node_modules/acorn");
const ROOT = path.join(__dirname, "..");

const FILES = [
	"index.html", "indice_renovado.html", "privacy.html",
	...["calendario_renov", "chatbot", "config", "dashboard", "plan_alimentacion", "plan_entreno"].flatMap((n) => [`Templates/${n}.html`, `Templates_Pantalla_Ancha/${n}_desktop.html`]),
	"Templates/creacionCuen/datosUnuevo.html", "Templates/creacionCuen/loginGoogle.html",
	"Templates_Pantalla_Ancha/creacionCuen_desktop/datosUnuevo_desktop.html", "Templates_Pantalla_Ancha/creacionCuen_desktop/loginGoogle_desktop.html",
	"Scripts/perfil_usuario.js", "Scripts/script_calendario.js", "Scripts/Alimentacion.js", "Scripts/sele_pesos.js", "Scripts/verifi_usu_n.js",
	"Scripts/logout.js", "Scripts/login_google.js", "Scripts/ui_bottom_sheet.js", "Scripts/backToTop.js", "Scripts/ui_transparencia_apply.js", "Scripts/spa_router.js",
];

const STOP = new Set("de la el en y a los las del que con para por un una tu tus su sus al se es no lo como más mas o si ya hay tiene tienes puedes elige agrega selecciona ingresa completa guardar cancelar plan día dia días ejercicio ejercicios entreno entrenamiento alimentación comida peso altura edad perfil cuenta sesión cerrar volver aceptar nuevo nueva".split(" "));
const SPANISH_CHARS = /[áéíóúñÁÉÍÓÚÑ¿¡]/;
const isLoose = (t) => /^[A-ZÁÉÍÓÚÑ¿¡a-záéíóúñ][A-Za-zÁÉÍÓÚáéíóúÑñüÜ ,.:;!?¿¡()/&·%+-–—'"“”0-9]{2,100}$/.test(t) && !/^[a-z]+([A-Z]|_)/.test(t) && !/^[a-z][a-z-]+$/.test(t) && !/^[A-Z_]{3,}$/.test(t);
const isSpanish = (s) => {
	const t = s.trim();
	if (t.length < 2 || t.length > 600) return false;
	if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(t)) return false;
	if (/^(https?:|\/|\.|#|data:|rgba?\(|var\(|[\w-]+\.(js|css|png|svg|json|html))/.test(t)) return false;
	if (/^[\w$.\-:#\[\]="'>,~*+ ()%]+$/.test(t) && !/\s[a-záéíóúñ]+\s/i.test(" " + t + " ") && !SPANISH_CHARS.test(t) && !/^[A-ZÁÉÍÓÚ]/.test(t)) return false; // selectores / identificadores
	if (SPANISH_CHARS.test(t)) return true;
	if (LOOSE && isLoose(t)) return true;
	const words = t.toLowerCase().replace(/[^a-záéíóúñ ]/g, " ").split(/\s+/).filter(Boolean);
	return words.some((w) => STOP.has(w));
};

const dec = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&middot;/g, "·").replace(/&copy;/g, "©").replace(/\s+/g, " ").trim();

const LOOSE = process.argv.includes("--loose");
const out = new Map(); // texto -> Set(archivos)
const add = (text, file, kind) => {
	const t = dec(text);
	if (!t || !isSpanish(t)) return;
	const key = t;
	if (!out.has(key)) out.set(key, { files: new Set(), kinds: new Set() });
	out.get(key).files.add(path.basename(file));
	out.get(key).kinds.add(kind);
};

const fromHtml = (html, file, kind) => {
	const clean = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<svg[\s\S]*?<\/svg>/gi, " ");
	for (const m of clean.matchAll(/>([^<>]+)</g)) add(m[1].replace(/\$\{[^}]*\}/g, "{}"), file, kind + ":text");
	for (const m of clean.matchAll(/\b(?:placeholder|title|aria-label|alt|data-placeholder|value)\s*=\s*"([^"]+)"/g)) add(m[1], file, kind + ":attr");
};

const fromJs = (code, file) => {
	let ast;
	for (const sourceType of ["module", "script"]) {
		try { ast = acorn.parse(code, { ecmaVersion: "latest", sourceType, allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true, allowHashBang: true }); break; } catch (e) { ast = null; }
	}
	if (!ast) { console.warn("  (no se pudo parsear JS en", file + ")"); return; }
	const visit = (n) => {
		if (!n || typeof n.type !== "string") return;
		if (n.type === "Literal" && typeof n.value === "string") {
			add(n.value, file, "js");
			if (/[<>]/.test(n.value)) fromHtml(n.value, file, "js-html");
		} else if (n.type === "TemplateLiteral") {
			// Une los fragmentos estáticos con "{}" en lugar de las expresiones: sirve para detectar patrones.
			const joined = n.quasis.map((q) => q.value.cooked ?? q.value.raw).join("{}");
			if (/[<>]/.test(joined)) fromHtml(joined, file, "js-html");
			add(joined, file, "js-tpl");
			for (const q of n.quasis) add(q.value.cooked ?? q.value.raw, file, "js-tplpart");
		}
		for (const k of Object.keys(n)) {
			const v = n[k];
			if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v.type === "string") visit(v);
		}
	};
	visit(ast);
};

for (const rel of FILES) {
	const file = path.join(ROOT, rel);
	if (!fs.existsSync(file)) { console.warn("no existe", rel); continue; }
	const src = fs.readFileSync(file, "utf8");
	if (rel.endsWith(".js")) { fromJs(src, rel); continue; }
	fromHtml(src, rel, "html");
	for (const m of src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) fromJs(m[1], rel);
}

const list = [...out.entries()].map(([text, v]) => ({ es: text, files: [...v.files], kinds: [...v.kinds] })).sort((a, b) => a.es.localeCompare(b.es, "es"));
fs.mkdirSync(path.join(ROOT, "scratch"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "scratch", LOOSE ? "textos_es_loose.json" : "textos_es.json"), JSON.stringify(list, null, 1));
console.log("cadenas candidatas:", list.length);
const byKind = {};
list.forEach((x) => x.kinds.forEach((k) => (byKind[k] = (byKind[k] || 0) + 1)));
console.log(byKind);
