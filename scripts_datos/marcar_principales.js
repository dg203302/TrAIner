// Marca con "principal": true los ejercicios básicos (los clásicos de cada grupo). El generador de planes siempre incluye
// al menos uno por grupo principal del día, para que no se pierdan entre las ~300 opciones del catálogo.
// Uso: node scripts_datos/marcar_principales.js
const fs = require("fs");
const path = require("path");
const FILE = path.join(__dirname, "..", "Datos", "entrenamientos.json");
const data = JSON.parse(fs.readFileSync(FILE, "utf8"));

// Los ejercicios originales del catálogo, salvo los muy avanzados o poco generales.
const originales = require("./tecnicas/originales.js").map(([n]) => n);
const EXCLUIR = new Set(["Dragon flag", "Rueda abdominal", "Encogimientos de hombros con barra reversa"]);
// Básicos que se suman: clásicos de gimnasio y alternativas sólidas para entrenar en casa.
const EXTRAS = [
	"Press de banca plano con mancuernas", "Dominadas supinas (chin-up)", "Peso muerto convencional",
	"Sentadilla con peso corporal", "Sentadilla goblet con mancuerna", "Zancada con peso corporal", "Puente de glúteos",
	"Flexiones inclinadas (manos elevadas)", "Remo invertido en mesa", "Press de hombros de pie con mancuernas",
	"Curl de bíceps con mancuernas", "Jalón con agarre en V (triángulo)",
];
const principales = new Set([...originales.filter((n) => !EXCLUIR.has(n)), ...EXTRAS]);

let marcados = 0;
const faltan = new Set(principales);
for (const lista of Object.values(data)) {
	for (const ex of lista) {
		if (principales.has(ex.nombre)) { ex.principal = true; marcados++; faltan.delete(ex.nombre); } else delete ex.principal;
	}
}
fs.writeFileSync(FILE, JSON.stringify(data, null, 4).replace(/\n/g, "\r\n"));
console.log("principales marcados:", marcados);
if (faltan.size) console.log("nombres que no existen en el catálogo:", [...faltan]);
for (const [g, l] of Object.entries(data)) console.log(" ", g.padEnd(28), l.filter((e) => e.principal).map((e) => (e.entorno.includes("casa") ? "🏠" : "🏋") + e.nombre).join(" · "));
