// Fusiona scripts_datos/nuevos/*.js en Datos/entrenamientos.json.
// Cada entrada: [índice en scratch/fp_catalogo.json, nombre ES, grupo, técnica, código]
//   código = sobrecarga (L carga, B corporal, I isométrico, R cardio, X banda) + respiración (p c t s k i r)
// Es idempotente: salta ejercicios cuyo nombre o GIF ya existan.
// Uso: node scripts_datos/agregar_ejercicios.js [--dry]
const fs = require("fs");
const path = require("path");
const nivelDe = require("./nivel");
const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "Datos", "entrenamientos.json");
const DRY = process.argv.includes("--dry");
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const SOBRECARGA = {
	L: "Sube la carga cuando completes todas las series y reps con buena técnica durante 2 sesiones consecutivas.",
	B: "Añade repeticiones o ralentiza la bajada (3 seg); cuando superes 15 reps limpias, pasa a una variante más difícil o añade lastre.",
	I: "Aumenta el tiempo bajo tensión (de 20 a 60 segundos) antes de pasar a una variante más difícil.",
	R: "Aumenta duración, velocidad o intensidad un 5-10% por semana, manteniendo la técnica y la respiración controladas.",
	X: "Usa una banda más gruesa o aumenta la tensión alejándote del anclaje cuando completes todas las reps con buena técnica durante 2 sesiones.",
};
const RESPIRACION = {
	p: "Inhala al bajar; exhala al empujar.",
	t: "Inhala al estirar los brazos; exhala al tirar.",
	c: "Inhala al bajar; exhala al subir.",
	s: "Inhala al bajar; exhala con fuerza al subir.",
	k: "Exhala al contraer el abdomen; inhala al volver.",
	i: "Respira de forma lenta y continua, sin contener el aire.",
	r: "Mantén una respiración rítmica y constante, inhalando por la nariz y exhalando por la boca.",
};

// Casa = se puede hacer sin máquinas, poleas ni barra (peso corporal, mancuernas, kettlebell, banda; sin banco).
function entornoDesde(equipo) {
	const p = equipo.split(",").map((s) => s.trim());
	const sinMaterial = p.includes("NO EQUIPMENT");
	const caseros = sinMaterial || p.includes("Dumbbells") || p.includes("Kettlebell") || p.includes("Resistance Band");
	const soloGym = p.includes("Machine") || p.includes("Cable") || p.includes("Barbell") || (p.includes("Bench") && !sinMaterial);
	return caseros && !soloGym ? ["casa", "gimnasio"] : ["gimnasio"];
}

// Ejercicios originales que se pueden hacer en casa.
const ORIGINALES_CASA = new Set([
	"Flexiones de brazos (peso corporal)", "Remo unilateral con mancuerna", "Pull-over con mancuerna", "Zancadas / estocadas",
	"Elevación de talones", "Sentadilla búlgara", "Step-ups con mancuernas", "Hip thrust (empuje de cadera)",
	"Elevaciones laterales con mancuernas", "Pájaros / vuelos posteriores", "Elevaciones frontales", "Press Arnold",
	"Curl martillo con mancuernas", "Extensión de tríceps con mancuerna sobre la cabeza", "Patada de tríceps con mancuerna",
	"Fondos entre bancos", "Curl de muñeca con mancuerna", "Farmer's walk (caminata del granjero)", "Plancha abdominal",
	"Crunch abdominal clásico", "Elevación de piernas colgado o en suelo", "Giros rusos", "Burpees", "Saltos de tijera", "Salto a la cuerda",
]);

const catalogo = JSON.parse(fs.readFileSync(path.join(ROOT, "scratch", "fp_catalogo.json"), "utf8"));
const data = JSON.parse(fs.readFileSync(FILE, "utf8"));

for (const lista of Object.values(data)) for (const ex of lista) if (!ex.entorno) ex.entorno = ORIGINALES_CASA.has(ex.nombre) ? ["casa", "gimnasio"] : ["gimnasio"];

const NOMBRES_EN_MANUAL = { "Remo en T": "T-Bar Row" };
// Backfill: nombre_en (nombre original del catálogo, por GIF) y nivel (heurística) para todo ejercicio que no lo tenga.
const porGif = new Map(catalogo.map((c) => [c.gif, c]));
for (const lista of Object.values(data)) for (const ex of lista) {
	if (!ex.nombre_en) ex.nombre_en = porGif.get(ex.gifUrl)?.nombre || NOMBRES_EN_MANUAL[ex.nombre] || "";
	if (!ex.nivel) ex.nivel = nivelDe(ex.nombre, ex.nombre_en);
}

const nombres = new Set(), gifs = new Set();
for (const lista of Object.values(data)) for (const ex of lista) { nombres.add(norm(ex.nombre)); gifs.add(ex.gifUrl); }

const dir = path.join(__dirname, "nuevos");
const entradas = fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort().flatMap((f) => require(path.join(dir, f)));
let agregados = 0;
const saltados = [];
for (const [idx, nombre, grupo, tecnica, codigo] of entradas) {
	const src = catalogo[idx];
	if (!src) { saltados.push(`${nombre}: índice ${idx} inexistente`); continue; }
	if (!data[grupo]) { saltados.push(`${nombre}: grupo desconocido "${grupo}"`); continue; }
	if (!/\.gif$/i.test(src.gif)) { saltados.push(`${nombre}: sin GIF`); continue; }
	if (nombres.has(norm(nombre))) { saltados.push(`${nombre}: nombre ya existe`); continue; }
	if (gifs.has(src.gif)) { saltados.push(`${nombre}: GIF ya usado (${src.gif.split("/").pop()})`); continue; }
	if (!SOBRECARGA[codigo[0]] || !RESPIRACION[codigo[1]]) { saltados.push(`${nombre}: código "${codigo}" inválido`); continue; }
	data[grupo].push({
		nombre,
		gifUrl: src.gif,
		descripcion: tecnica.length > 100 ? tecnica.slice(0, 100) + "..." : tecnica,
		descripcion_detallada: `Técnica: ${tecnica}\nSobrecarga: ${SOBRECARGA[codigo[0]]}\nRespiración: ${RESPIRACION[codigo[1]]}`,
		descripcion_guia: tecnica,
		entorno: entornoDesde(src.equipo),
		nombre_en: src.nombre,
		nivel: nivelDe(nombre, src.nombre),
	});
	nombres.add(norm(nombre)); gifs.add(src.gif); agregados++;
}
console.log(`Agregados: ${agregados} | Saltados: ${saltados.length}`);
saltados.filter((s) => !s.endsWith("nombre ya existe")).forEach((s) => console.log("  -", s));
const total = Object.values(data).reduce((n, l) => n + l.length, 0);
const casa = Object.values(data).flat().filter((e) => e.entorno.includes("casa")).length;
console.log(`Total: ${total} | aptos casa: ${casa} | solo gimnasio: ${total - casa}`);
for (const [g, l] of Object.entries(data)) console.log(`  ${g}: ${l.length}`);
if (!DRY) fs.writeFileSync(FILE, JSON.stringify(data, null, 4).replace(/\n/g, "\r\n"));
else console.log("(dry run, sin escribir)");
