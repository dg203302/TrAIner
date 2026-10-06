// Escribe "tecnica_en" en Datos/entrenamientos.json a partir de scripts_datos/tecnicas/*.js.
// Los ejercicios nuevos se identifican por su índice de catálogo (primer campo de scripts_datos/nuevos/*.js); los originales, por nombre.
// Uso: node scripts_datos/aplicar_tecnicas.js
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "Datos", "entrenamientos.json");
const data = JSON.parse(fs.readFileSync(FILE, "utf8"));

const nombrePorIdx = new Map();
const nuevosDir = path.join(__dirname, "nuevos");
for (const f of fs.readdirSync(nuevosDir).filter((x) => x.endsWith(".js"))) {
	for (const [idx, nombre] of require(path.join(nuevosDir, f))) nombrePorIdx.set(idx, nombre);
}

const porNombre = new Map();
const tdir = path.join(__dirname, "tecnicas");
for (const f of fs.readdirSync(tdir).filter((x) => x.endsWith(".js"))) {
	for (const [clave, en] of require(path.join(tdir, f))) {
		const nombre = typeof clave === "number" ? nombrePorIdx.get(clave) : clave;
		if (!nombre) { console.warn("índice sin nombre:", clave); continue; }
		porNombre.set(nombre, en);
	}
}

let aplicadas = 0;
const sin = [];
for (const lista of Object.values(data)) {
	for (const ex of lista) {
		const en = porNombre.get(ex.nombre);
		if (en) { ex.tecnica_en = en; aplicadas++; } else sin.push(ex.nombre);
	}
}
console.log(`tecnica_en aplicada a ${aplicadas} ejercicios; sin traducción: ${sin.length}`);
sin.forEach((n) => console.log("  -", n));
fs.writeFileSync(FILE, JSON.stringify(data, null, 4).replace(/\n/g, "\r\n"));
