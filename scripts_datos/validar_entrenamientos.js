// Valida Datos/entrenamientos.json.
// Uso: node scripts_datos/validar_entrenamientos.js [--offline]
// Sale con código 1 si hay errores (los avisos no fallan).
const fs = require("fs");
const path = require("path");
const { NIVELES } = require("./nivel");
const FILE = path.join(__dirname, "..", "Datos", "entrenamientos.json");
const OFFLINE = process.argv.includes("--offline");
const CAMPOS = ["nombre", "gifUrl", "descripcion", "descripcion_detallada", "descripcion_guia"];
// Misma normalización que usa el front/back para indexar por nombre.
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const errores = [], avisos = [];
let data;
try { data = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { console.error("JSON inválido:", e.message); process.exit(1); }

const porNombre = new Map(), porGif = new Map(), todos = [];
for (const [grupo, lista] of Object.entries(data)) {
	if (!Array.isArray(lista)) { errores.push(`Grupo "${grupo}" no es un array`); continue; }
	for (const ex of lista) {
		const id = `${grupo} / ${ex?.nombre ?? "(sin nombre)"}`;
		for (const c of CAMPOS) if (typeof ex?.[c] !== "string" || !ex[c].trim()) errores.push(`${id}: falta o está vacío "${c}"`);
		if (!Array.isArray(ex?.entorno) || !ex.entorno.length || ex.entorno.some((e) => !["casa", "gimnasio"].includes(e))) errores.push(`${id}: "entorno" debe ser un array no vacío con "casa" y/o "gimnasio"`);
		if (typeof ex?.nombre_en !== "string" || !ex.nombre_en.trim()) errores.push(`${id}: falta "nombre_en"`);
		if (!NIVELES.includes(ex?.nivel)) errores.push(`${id}: "nivel" debe ser uno de ${NIVELES.join("/")}`);
		if (!ex?.nombre) continue;
		const k = norm(ex.nombre);
		if (porNombre.has(k)) errores.push(`${id}: nombre duplicado (también en ${porNombre.get(k)})`);
		else porNombre.set(k, grupo);
		if (ex.gifUrl) {
			if (!/^https:\/\/\S+\.gif$/i.test(ex.gifUrl)) errores.push(`${id}: gifUrl no es https://...gif (${ex.gifUrl})`);
			if (!porGif.has(ex.gifUrl)) porGif.set(ex.gifUrl, []);
			porGif.get(ex.gifUrl).push(ex.nombre);
		}
		if (ex.descripcion_detallada && !/Técnica:[\s\S]*Sobrecarga:[\s\S]*Respiración:/.test(ex.descripcion_detallada)) avisos.push(`${id}: descripcion_detallada sin formato Técnica/Sobrecarga/Respiración`);
		todos.push({ id, k, nombre: ex.nombre });
	}
}
for (const [u, n] of porGif) if (n.length > 1) avisos.push(`GIF repetido por ${n.length} ejercicios (${n.join(" | ")}): ${u}`);
// El front resuelve por coincidencia exacta y, si falla, por "includes": un nombre contenido en otro puede cruzarse.
for (const a of todos) for (const b of todos) if (a !== b && a.k.length >= 4 && b.k.includes(a.k) && a.k !== b.k) avisos.push(`"${a.nombre}" está contenido en "${b.nombre}" (riesgo en búsqueda difusa)`);

(async () => {
	if (!OFFLINE) {
		const urls = [...porGif.keys()];
		let i = 0;
		const worker = async () => {
			while (i < urls.length) {
				const u = urls[i++];
				try {
					const r = await fetch(u, { method: "HEAD", headers: { "User-Agent": "Mozilla/5.0" } });
					const t = r.headers.get("content-type") || "";
					if (!r.ok) errores.push(`GIF caído (${r.status}): ${u}`);
					else if (!/image\/gif/i.test(t)) errores.push(`GIF con content-type "${t}": ${u}`);
				} catch (e) { errores.push(`GIF inaccesible (${e.message}): ${u}`); }
			}
		};
		await Promise.all(Array.from({ length: 8 }, worker));
	}
	const total = todos.length;
	console.log(`Ejercicios: ${total} | Grupos: ${Object.keys(data).length} | URLs de GIF: ${porGif.size}${OFFLINE ? " (sin comprobar red)" : ""}`);
	avisos.forEach((a) => console.warn("AVISO  ", a));
	errores.forEach((e) => console.error("ERROR  ", e));
	console.log(errores.length ? `\n${errores.length} error(es)` : "\nOK: sin errores", `, ${avisos.length} aviso(s)`);
	process.exit(errores.length ? 1 : 0);
})();
