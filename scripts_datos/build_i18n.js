// Une scripts_datos/i18n/*.js en Scripts/i18n_en.js y mide la cobertura sobre scratch/textos_*.json.
// Uso: node scripts_datos/build_i18n.js [--missing]   (--missing lista las cadenas del código que aún no tienen traducción)
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const dir = path.join(__dirname, "i18n");
const { createTranslator, normKey } = require(path.join(ROOT, "Scripts", "ui_idioma.js"));

const pairs = [];
const seen = new Map();
const dups = [];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".js")).sort()) {
	for (const [es, en] of require(path.join(dir, f))) {
		const k = normKey(es);
		if (seen.has(k)) {
			if (seen.get(k).toLowerCase() !== en.toLowerCase()) dups.push(`${es} → "${seen.get(k)}" vs "${en}" (${f})`);
			continue;
		}
		seen.set(k, en);
		pairs.push([es.replace(/\s+/g, " ").trim(), en]);
	}
}
const body = pairs.map(([es, en]) => `\t${JSON.stringify([es, en])}`).join(",\n");
fs.writeFileSync(path.join(ROOT, "Scripts", "i18n_en.js"), `/* Diccionario ES → EN generado por scripts_datos/build_i18n.js. No editar a mano: edita scripts_datos/i18n/*.js y vuelve a generar. */\nwindow.PT_I18N_EN = [\n${body}\n];\n`);
console.log("entradas:", pairs.length, "| conflictos:", dups.length);
dups.forEach((d) => console.log("  CONFLICTO", d));

// Cobertura
const tr = createTranslator();
pairs.forEach(([es, en]) => tr.add(es, en));
const gapsFile = path.join(ROOT, "scratch", "gaps_es.json");
const candidates = fs.existsSync(gapsFile) ? [...new Set(require(gapsFile))] : [];
const IGNORE = /^(android-app|application|Content-Type|use strict|ArrowDown|ArrowUp|Escape|MacIntel|Netlify|DOMContentLoaded|ResizeObserver|Modal|Tab|Enter|HTTP|px |opacity|overlay-|pt-|slideshow|style=|T00|input\[|Endpoint|Sync |day-pill|ID_user|Dias_|Plan_|Ingreso_|YYYY|usuario@|dg15828|djsolutions|uncaught|table of|Error render|Error chatbot|Error guard|Error cargando|Error registering|Request failed|Aviso|Fallo|Llamada|Edge function|Error al (sincronizar|obtener|recuperar|subir|registrar)|Error (consultando|de red|en onConfirm|en sincronización|inesperado|generando)|No se pudo (actualizar|invocar|renderizar|cargar entrenamientos)|id, |Altura, |PTBottomSheet|Sin sesión ni|Barrio|chile|San juan|Argentina|D&J|Diego Garcia|Personal Tr|s desc|by submitting|fill out|submitting|Right to|third parties|Services|Examples|Collected|Category|Consent|Vital|Sensitive|Social Media|Legal|Business|Limited|Member|UK data|PRIVACY|Privacy|A\. Identifiers|billing|biometric|browsing|debit|Device|email|Browsing|Google)/i;
const ENGLISH = /^(Plan deleted|Plan generated|Select a goal|Selected|Show more|Siguiente|No data|Welcome|Verifying|Yes,|Gym|Home|Close|Cancel|Delete|Done|Day|Goal|Height|Intensity|Month|Performance|Progression|Recent|Rest|Status|Target|Technique|Time|Year|Details|Dashboard|Favorites?|Calories|Carbs|Fats|Proteins|Breathing|Meal|Generate|Generating|Understood|Stable|Normal|Obesity|Overweight|Underweight|Please|Saving|Syncing|Invalid|Incomplete|Authentication|Login|Server|Session|Save|Last|Longest|Lose|Maintain|Maintenance|Low|High|Medium|Lean|Gradual|Gain|Deficit|Surplus|Chart|Clear|Confirm|Connection|Current|Daily|Data|Days|December|January|Good|Weight|Weekly|Total|Today|Upcoming|years|Your|Request|Reconnecting|Anywhere|All|Active|Avg|Best|Birth|BMI|Breathing|Caloric|Centimeters|Kilograms|Macro|Meal|Monthly|Projected|Recommendations|Sync|Welcome|Fitness|Hosting|Authentication)/;
const missing = candidates.filter((c) => !IGNORE.test(c) && !ENGLISH.test(c) && tr.translate(c) === c);
console.log("candidatas:", candidates.length, "| sin traducir:", missing.length);
if (process.argv.includes("--missing")) missing.forEach((m) => console.log("  -", m));
