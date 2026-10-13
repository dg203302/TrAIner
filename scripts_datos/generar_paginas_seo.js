// Genera las páginas públicas de ejercicios y de rutinas para buscadores, en español e inglés, más sitemap.xml y robots.txt.
// Uso: node scripts_datos/generar_paginas_seo.js   (Netlify lo corre en cada deploy; ver netlify.toml)
// Salida (no se versiona): /ejercicios/<grupo>/<ejercicio>/, /rutinas/<rutina>/, /en/exercises/..., /en/workouts/..., /sitemap.xml, /robots.txt
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
// Netlify expone la URL principal del sitio en URL; así el dominio se actualiza solo si se conecta uno propio.
const SITE = (process.env.URL || "https://aipersonaltr.netlify.app").replace(/\/+$/, "");
const PLAY_URL = "https://play.google.com/store/apps/details?id=app.netlify.aipersonaltr.twa";
const ADSENSE = "ca-pub-7232324434042202";
const RELACIONADOS = 8;

const db = JSON.parse(fs.readFileSync(path.join(ROOT, "Datos", "entrenamientos.json"), "utf8"));
const LINEAS_EN = new Map(require("./i18n/lineas_catalogo"));

const GRUPOS = {
	"Pecho": ["pecho", "Chest", "chest"],
	"Espalda": ["espalda", "Back", "back"],
	"Piernas": ["piernas", "Legs", "legs"],
	"Hombros": ["hombros", "Shoulders", "shoulders"],
	"Brazos": ["brazos", "Arms", "arms"],
	"Tríceps": ["triceps", "Triceps", "triceps"],
	"Antebrazos": ["antebrazos", "Forearms", "forearms"],
	"Abdomen / core": ["abdomen-core", "Abs / core", "abs-core"],
	"Cardio / acondicionamiento": ["cardio", "Cardio / conditioning", "cardio"],
	"Movilidad / estiramientos": ["movilidad-estiramientos", "Mobility / stretching", "mobility-stretching"],
};
const NIVELES = { principiante: ["Principiante", "Beginner"], intermedio: ["Intermedio", "Intermediate"], avanzado: ["Avanzado", "Advanced"] };
const ENTORNOS = { casa: ["En casa", "At home"], gimnasio: ["Gimnasio", "Gym"] };

const TXT = {
	es: {
		lang: "es", base: "/ejercicios/", baseRut: "/rutinas/", inicio: "Inicio", ejercicios: "Ejercicios", rutinas: "Rutinas", otroIdioma: "English",
		tituloEj: (n) => `${n}: cómo se hace, técnica y respiración | TrAIner`,
		tecnica: "Cómo se hace", sobrecarga: "Cómo progresar", respiracion: "Respiración",
		altGif: (n) => `Cómo hacer ${n}: demostración del ejercicio`,
		ctaTitulo: "Arma tu rutina con este ejercicio",
		ctaTexto: "TrAIner crea con IA tu plan de entrenamiento según tu objetivo, tu nivel y el lugar donde entrenas. Es gratis.",
		ctaWeb: "Crear mi rutina", ctaPlay: "Descargar en Google Play",
		relacionados: (g) => `Más ejercicios de ${g.toLowerCase()}`,
		tituloGrupo: (g, n) => `Ejercicios de ${g.toLowerCase()}: ${n} ejercicios con técnica | TrAIner`,
		h1Grupo: (g) => `Ejercicios de ${g.toLowerCase()}`,
		descGrupo: (g, n) => `${n} ejercicios de ${g.toLowerCase()} para gimnasio y casa, con demostración, técnica paso a paso, progresión y respiración.`,
		tituloHub: (n) => `Guía de ejercicios: ${n} ejercicios con técnica | TrAIner`,
		h1Hub: "Guía de ejercicios",
		descHub: (n) => `${n} ejercicios de gimnasio y en casa por grupo muscular, con demostración, técnica paso a paso, progresión y respiración.`,
		cuenta: (n) => `${n} ejercicios`, privacidad: "Privacidad",
		aviso: "Información general de entrenamiento. No reemplaza el consejo de un profesional de la salud.",
		lugar: { casa: "en casa", gimnasio: "de gimnasio" },
		equipo: { casa: "mancuernas y tu peso corporal", gimnasio: "barra, mancuernas, máquinas y poleas" },
		nivelRut: ["principiante", "intermedio", "intermedio o avanzado"],
		dias: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
		h1Rut: (n, lugar) => `Rutina de ${n} días ${lugar}`,
		tituloRut: (n, lugar) => `Rutina de ${n} días ${lugar}: ejercicios, series y repeticiones | TrAIner`,
		descRut: (n, lugar, total, equipo, nivel) => `Rutina de ${n} días ${lugar} con ${equipo}: ${total} ejercicios repartidos en ${n} sesiones de 45 a 60 minutos, con series, repeticiones y descansos. Nivel ${nivel}.`,
		semanaTitulo: "Cómo organizar la semana",
		semana: (dias, n) => `Entrena ${dias} y usa los demás días para descansar o hacer movilidad suave. Si no puedes esos días, cámbialos por otros, pero ${n >= 5 ? "deja al menos un día de descanso completo por semana" : "evita entrenar más de dos días seguidos"}.`,
		diaTitulo: (i, dia, enfoque) => `Día ${i} · ${dia}: ${enfoque}`,
		colEj: "Ejercicio", colSeries: "Series × reps", colDesc: "Descanso",
		progTitulo: "Cómo progresar",
		prog: "Empieza con un peso que te deje terminar todas las series con una o dos repeticiones de margen. Cuando llegues al tope del rango de repeticiones en todas las series durante dos sesiones seguidas, sube el peso lo mínimo posible. En los ejercicios con peso corporal, suma repeticiones o baja más lento antes de pasar a una variante más difícil.",
		antesTitulo: "Antes de empezar",
		antes: (url) => `Calienta de 5 a 10 minutos con movilidad articular y una o dos series livianas del primer ejercicio. Si necesitas ideas, mira los <a href="${url}">ejercicios de movilidad y estiramientos</a>. Si tienes una lesión o una condición de salud, consulta antes con un profesional.`,
		ctaRutTitulo: "Adapta esta rutina a ti",
		ctaRutTexto: "TrAIner arma con IA una rutina con tu objetivo, tus días y el equipo que tienes, y registra tu progreso. Es gratis.",
		otrasRut: "Otras rutinas",
		tituloHubRut: "Rutinas de entrenamiento en casa y de gimnasio | TrAIner",
		h1HubRut: "Rutinas de entrenamiento",
		descHubRut: "Rutinas de 2 a 6 días por semana para entrenar en casa o en el gimnasio, con ejercicios, series, repeticiones y descansos.",
		itemRut: (n, total) => `${n} días · ${total} ejercicios`,
	},
	en: {
		lang: "en", base: "/en/exercises/", baseRut: "/en/workouts/", inicio: "Home", ejercicios: "Exercises", rutinas: "Workouts", otroIdioma: "Español",
		tituloEj: (n) => `${n}: how to do it, form and breathing | TrAIner`,
		tecnica: "How to do it", sobrecarga: "How to progress", respiracion: "Breathing",
		altGif: (n) => `How to do ${n}: exercise demonstration`,
		ctaTitulo: "Build your workout with this exercise",
		ctaTexto: "TrAIner uses AI to build your workout plan around your goal, your level and where you train. It's free.",
		ctaWeb: "Create my workout", ctaPlay: "Get it on Google Play",
		relacionados: (g) => `More ${g.toLowerCase()} exercises`,
		tituloGrupo: (g, n) => `${g} exercises: ${n} exercises with proper form | TrAIner`,
		h1Grupo: (g) => `${g} exercises`,
		descGrupo: (g, n) => `${n} ${g.toLowerCase()} exercises for the gym and home, with a demo, step-by-step form, progression and breathing.`,
		tituloHub: (n) => `Exercise guide: ${n} exercises with proper form | TrAIner`,
		h1Hub: "Exercise guide",
		descHub: (n) => `${n} gym and home exercises by muscle group, with a demo, step-by-step form, progression and breathing.`,
		cuenta: (n) => `${n} exercises`, privacidad: "Privacy",
		aviso: "General training information. Not a substitute for advice from a health professional.",
		lugar: { casa: "home", gimnasio: "gym" },
		equipo: { casa: "dumbbells and your bodyweight", gimnasio: "a barbell, dumbbells, machines and cables" },
		nivelRut: ["beginner", "intermediate", "intermediate or advanced"],
		dias: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
		h1Rut: (n, lugar) => `${n}-day ${lugar} workout plan`,
		tituloRut: (n, lugar) => `${n}-day ${lugar} workout plan: exercises, sets and reps | TrAIner`,
		descRut: (n, lugar, total, equipo, nivel) => `${n}-day ${lugar} workout plan with ${equipo}: ${total} exercises across ${n} sessions of 45 to 60 minutes, with sets, reps and rest times. ${nivel[0].toUpperCase()}${nivel.slice(1)} level.`,
		semanaTitulo: "How to plan your week",
		semana: (dias, n) => `Train on ${dias} and use the other days to rest or do light mobility work. If those days don't suit you, swap them for others, but ${n >= 5 ? "keep at least one full rest day a week" : "avoid training more than two days in a row"}.`,
		diaTitulo: (i, dia, enfoque) => `Day ${i} · ${dia}: ${enfoque}`,
		colEj: "Exercise", colSeries: "Sets × reps", colDesc: "Rest",
		progTitulo: "How to progress",
		prog: "Start with a weight that lets you finish every set with one or two reps in reserve. Once you hit the top of the rep range on every set for two sessions in a row, go up by the smallest weight jump available. On bodyweight exercises, add reps or slow down the lowering phase before moving to a harder variation.",
		antesTitulo: "Before you start",
		antes: (url) => `Warm up for 5 to 10 minutes with joint mobility and one or two light sets of the first exercise. If you need ideas, see the <a href="${url}">mobility and stretching exercises</a>. If you have an injury or a health condition, check with a professional first.`,
		ctaRutTitulo: "Tailor this plan to you",
		ctaRutTexto: "TrAIner uses AI to build a plan around your goal, your days and the equipment you have, and tracks your progress. It's free.",
		otrasRut: "More workout plans",
		tituloHubRut: "Home and gym workout plans | TrAIner",
		h1HubRut: "Workout plans",
		descHubRut: "Workout plans from 2 to 6 days a week for training at home or at the gym, with exercises, sets, reps and rest times.",
		itemRut: (n, total) => `${n} days · ${total} exercises`,
	},
};

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slug = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const recortar = (s, max) => (s.length <= max ? s : s.slice(0, s.lastIndexOf(" ", max - 1)).replace(/[\s,;:.]+$/, "") + "…");

// ── Modelo: un registro por ejercicio con sus textos y URLs en los dos idiomas ──
const usados = { es: new Set(), en: new Set() };
const slugUnico = (lang, grupoSlug, nombre) => {
	const base = slug(nombre);
	let s = base;
	for (let i = 2; usados[lang].has(`${grupoSlug}/${s}`); i++) s = `${base}-${i}`;
	usados[lang].add(`${grupoSlug}/${s}`);
	return s;
};

const grupos = [];
let sinTraduccion = 0;
for (const [grupo, lista] of Object.entries(db)) {
	const [gEs, nombreEn, gEn] = GRUPOS[grupo] || [slug(grupo), grupo, slug(grupo)];
	const g = {
		es: { nombre: grupo, url: `${TXT.es.base}${gEs}/` },
		en: { nombre: nombreEn, url: `${TXT.en.base}${gEn}/` },
		ejercicios: [],
	};
	for (const ej of lista) {
		const m = String(ej.descripcion_detallada || "").match(/Sobrecarga: ([\s\S]*?)\nRespiración: ([\s\S]*)/);
		const sobrecarga = m ? m[1].trim() : "";
		const respiracion = m ? m[2].trim() : "";
		if ((sobrecarga && !LINEAS_EN.has(sobrecarga)) || (respiracion && !LINEAS_EN.has(respiracion))) sinTraduccion++;
		const nombreEjEn = ej.nombre_en || ej.nombre;
		g.ejercicios.push({
			gif: ej.gifUrl, nivel: ej.nivel, entorno: ej.entorno || [],
			es: {
				nombre: ej.nombre, tecnica: ej.descripcion_guia, sobrecarga, respiracion,
				url: `${g.es.url}${slugUnico("es", gEs, ej.nombre)}/`,
			},
			en: {
				nombre: nombreEjEn, tecnica: ej.tecnica_en || "", sobrecarga: LINEAS_EN.get(sobrecarga) || "", respiracion: LINEAS_EN.get(respiracion) || "",
				url: `${g.en.url}${slugUnico("en", gEn, nombreEjEn)}/`,
			},
		});
	}
	grupos.push(g);
}
const total = grupos.reduce((n, g) => n + g.ejercicios.length, 0);

// ── Rutinas: una por cantidad de días y lugar, armadas con ejercicios del catálogo ──
const [P, E, L, H, B, T, A, C] = ["Pecho", "Espalda", "Piernas", "Hombros", "Brazos", "Tríceps", "Antebrazos", "Abdomen / core"];
// Por día: [enfoque ES, enfoque EN, [[grupo, cantidad], ...]]. Mismas divisiones que usa el generador de la app (SPLITS_RESPALDO).
const DIVISIONES = {
	2: [
		["Torso superior", "Upper body", [[P, 2], [E, 2], [H, 1], [B, 1]]],
		["Piernas y core", "Legs and core", [[L, 4], [C, 2]]],
	],
	3: [
		["Empuje (pecho, hombros y tríceps)", "Push (chest, shoulders and triceps)", [[P, 3], [H, 2], [T, 1]]],
		["Tirón (espalda y bíceps)", "Pull (back and biceps)", [[E, 4], [B, 2]]],
		["Piernas y abdomen", "Legs and abs", [[L, 4], [C, 2]]],
	],
	4: [
		["Pecho y espalda", "Chest and back", [[P, 3], [E, 3]]],
		["Piernas y abdomen", "Legs and abs", [[L, 4], [C, 2]]],
		["Hombros y brazos", "Shoulders and arms", [[H, 2], [B, 2], [T, 2]]],
		["Piernas y glúteos", "Legs and glutes", [[L, 5], [C, 1]]],
	],
	5: [
		["Pecho y tríceps", "Chest and triceps", [[P, 4], [T, 2]]],
		["Espalda y bíceps", "Back and biceps", [[E, 4], [B, 2]]],
		["Piernas", "Legs", [[L, 5], [C, 1]]],
		["Hombros y core", "Shoulders and core", [[H, 4], [C, 2]]],
		["Piernas y brazos", "Legs and arms", [[L, 3], [B, 2], [T, 1]]],
	],
	6: [
		["Empuje A (pecho y tríceps)", "Push A (chest and triceps)", [[P, 3], [H, 1], [T, 2]]],
		["Tirón A (espalda y bíceps)", "Pull A (back and biceps)", [[E, 4], [B, 2]]],
		["Piernas A", "Legs A", [[L, 5], [C, 1]]],
		["Empuje B (hombros y pecho)", "Push B (shoulders and chest)", [[H, 3], [P, 2], [T, 1]]],
		["Tirón B (espalda y antebrazos)", "Pull B (back and forearms)", [[E, 4], [B, 1], [A, 1]]],
		["Piernas B", "Legs B", [[L, 5], [C, 1]]],
	],
};
const DIAS_SEMANA = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] };
// Orden de preferencia por grupo; el resto del grupo sigue en el orden del catálogo (primero los marcados como principales).
const PRIORIDAD = {
	gimnasio: {
		[P]: ["Press de banca plano con barra", "Press de banca inclinado con mancuernas", "Aperturas con mancuernas", "Fondos en paralelas (pecho bajo/tríceps)", "Cruce de poleas", "Press de banca plano con mancuernas"],
		[E]: ["Dominadas (peso corporal)", "Remo con barra", "Jalón al pecho en polea", "Remo sentado en polea", "Remo unilateral con mancuerna", "Hiperextensiones lumbares"],
		[L]: ["Sentadilla libre", "Peso muerto rumano", "Prensa de piernas", "Curl femoral tumbado o sentado", "Elevación de talones", "Hip thrust (empuje de cadera)", "Sentadilla búlgara", "Extensión de cuádriceps en máquina", "Zancadas / estocadas"],
		[H]: ["Press militar con barra o mancuernas", "Elevaciones laterales con mancuernas", "Face pull (salud del hombro)", "Press Arnold", "Pájaros / vuelos posteriores"],
	},
	casa: {
		[L]: ["Sentadilla goblet con mancuerna", "Zancada con peso corporal", "Puente de glúteos", "Elevación de talones", "Step-ups con mancuernas", "Sentadilla con peso corporal"],
		[H]: ["Press de hombros de pie con mancuernas", "Elevaciones laterales con mancuernas", "Pájaros / vuelos posteriores", "Press Arnold"],
	},
};
const POR_TIEMPO = /plancha|farmer/i;
// En las rutinas de casa se evitan los ejercicios cuyo nombre original pide barra, polea o máquina.
const EQUIPO_GIMNASIO = /barbell|cable|machine|lever|smith/i;

const porNombre = new Map(grupos.flatMap((g) => g.ejercicios.map((ej) => [ej.es.nombre, ej])));
const candidatos = (grupo, lugar) => {
	const g = grupos.find((x) => x.es.nombre === grupo);
	const aptos = g.ejercicios.filter((ej) => lugar === "gimnasio" || (ej.entorno.includes("casa") && !EQUIPO_GIMNASIO.test(ej.en.nombre)));
	const primero = (PRIORIDAD[lugar][grupo] || []).map((nombre) => {
		const ej = porNombre.get(nombre);
		if (!ej || !aptos.includes(ej)) throw new Error(`PRIORIDAD: "${nombre}" no está en el catálogo de ${grupo} para ${lugar}`);
		return ej;
	});
	return [...new Set([...primero, ...aptos.filter((ej) => ej.principal), ...aptos.filter((ej) => ej.nivel !== "avanzado")])];
};

const rutinas = [];
for (const lugar of ["casa", "gimnasio"]) {
	for (const n of Object.keys(DIVISIONES).map(Number)) {
		const puntero = {};
		const dias = DIVISIONES[n].map(([enfoqueEs, enfoqueEn, bloques], i) => {
			const ejercicios = [];
			for (const [grupo, cantidad] of bloques) {
				const lista = candidatos(grupo, lugar);
				for (let k = 0; k < cantidad; k++) {
					const ej = lista[(puntero[grupo] = (puntero[grupo] ?? -1) + 1) % lista.length];
					const accesorio = grupo === C || grupo === A;
					const fuerte = ejercicios.length < 2 && !accesorio;
					ejercicios.push({
						ej,
						series: POR_TIEMPO.test(ej.es.nombre) ? "3 × 30-45 s" : accesorio ? "3 × 12-15" : fuerte ? "4 × 8-10" : "3 × 10-12",
						descanso: accesorio ? "45 s" : fuerte ? "90 s" : "60 s",
					});
				}
			}
			return { dia: DIAS_SEMANA[n][i], es: enfoqueEs, en: enfoqueEn, ejercicios };
		});
		rutinas.push({
			n, lugar, dias, nivel: n <= 3 ? 0 : n === 4 ? 1 : 2,
			totalEj: dias.reduce((t, d) => t + d.ejercicios.length, 0),
			es: { url: `${TXT.es.baseRut}rutina-${n}-dias-${lugar === "casa" ? "en-casa" : "gimnasio"}/` },
			en: { url: `${TXT.en.baseRut}${n}-day-${lugar === "casa" ? "home" : "gym"}-workout/` },
		});
	}
}

// ── Plantillas ──
const otro = (lang) => (lang === "es" ? "en" : "es");

const layout = (lang, { titulo, descripcion, url, urlOtro, migas, cuerpo }) => {
	const t = TXT[lang];
	const alternos = { [lang]: url, [otro(lang)]: urlOtro };
	const jsonLd = {
		"@context": "https://schema.org", "@type": "BreadcrumbList",
		itemListElement: migas.map(([nombre, href], i) => ({ "@type": "ListItem", position: i + 1, name: nombre, item: SITE + href })),
	};
	return `<!DOCTYPE html>
<html lang="${t.lang}">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#0c0d10">
    <title>${esc(titulo)}</title>
    <meta name="description" content="${esc(descripcion)}">
    <link rel="canonical" href="${SITE}${url}">
    <link rel="alternate" hreflang="es" href="${SITE}${alternos.es}">
    <link rel="alternate" hreflang="en" href="${SITE}${alternos.en}">
    <link rel="alternate" hreflang="x-default" href="${SITE}${alternos.es}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="TrAIner">
    <meta property="og:title" content="${esc(titulo)}">
    <meta property="og:description" content="${esc(descripcion)}">
    <meta property="og:url" content="${SITE}${url}">
    <meta property="og:image" content="${SITE}/Icons/og-image.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="icon" type="image/png" href="/Icons/2.png">
    <link rel="stylesheet" href="/Styles/styles_ejercicios_seo.css">
    <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}" crossorigin="anonymous"></script>
</head>

<body>
    <header class="seo-nav">
        <a href="/" class="seo-brand"><img src="/Icons/2.png" alt="" width="32" height="32"><span class="seo-brand-name">Tr<span>AI</span>ner</span></a>
        <nav class="seo-nav-links">
            <a href="${t.base}">${t.ejercicios}</a>
            <a href="${t.baseRut}">${t.rutinas}</a>
            <a href="${urlOtro}" hreflang="${otro(lang)}" lang="${otro(lang)}">${t.otroIdioma}</a>
        </nav>
    </header>
    <main class="seo-main">
        <ol class="seo-breadcrumb">
${migas.map(([nombre, href], i) => `            <li>${i < migas.length - 1 ? `<a href="${href}">${esc(nombre)}</a>` : esc(nombre)}</li>`).join("\n")}
        </ol>
${cuerpo}
    </main>
    <footer class="seo-footer">
        <p>${t.aviso}</p>
        <p><a href="/">TrAIner</a><a href="${t.base}">${t.ejercicios}</a><a href="${t.baseRut}">${t.rutinas}</a><a href="/privacy.html">${t.privacidad}</a></p>
    </footer>
</body>

</html>
`;
};

const cta = (lang, titulo = TXT[lang].ctaTitulo, texto = TXT[lang].ctaTexto) => {
	const t = TXT[lang];
	return `        <aside class="seo-cta">
            <h2>${titulo}</h2>
            <p>${texto}</p>
            <div class="seo-cta-actions">
                <a class="seo-btn" href="/">${t.ctaWeb}</a>
                <a class="seo-btn seo-btn-ghost" href="${PLAY_URL}" rel="noopener">${t.ctaPlay}</a>
            </div>
        </aside>`;
};

const etiquetas = (lang, ej) => {
	const i = lang === "es" ? 0 : 1;
	return [NIVELES[ej.nivel]?.[i], ...ej.entorno.map((e) => ENTORNOS[e]?.[i])].filter(Boolean);
};

const itemLista = (lang, ej) =>
	`            <li><a href="${ej[lang].url}">${esc(ej[lang].nombre)}<small>${esc(etiquetas(lang, ej).join(" · "))}</small></a></li>`;

const paginaEjercicio = (lang, g, ej, idx) => {
	const t = TXT[lang], d = ej[lang];
	// Vecinos del mismo grupo (circular) para que todas las páginas reciban enlaces internos.
	const vecinos = [];
	for (let k = 1; vecinos.length < Math.min(RELACIONADOS, g.ejercicios.length - 1); k++) vecinos.push(g.ejercicios[(idx + k) % g.ejercicios.length]);
	const seccion = (titulo, texto) => (texto ? `        <section class="seo-card">\n            <h2>${titulo}</h2>\n            <p>${esc(texto)}</p>\n        </section>\n` : "");
	const cuerpo = `        <h1>${esc(d.nombre)}</h1>
        <ul class="seo-badges">
${[g[lang].nombre, ...etiquetas(lang, ej)].map((b) => `            <li>${esc(b)}</li>`).join("\n")}
        </ul>
        <img class="seo-gif" src="${esc(ej.gif)}" alt="${esc(t.altGif(d.nombre))}" width="420" height="420" loading="lazy" referrerpolicy="no-referrer">
${seccion(t.tecnica, d.tecnica)}${seccion(t.sobrecarga, d.sobrecarga)}${seccion(t.respiracion, d.respiracion)}${cta(lang)}
        <section class="seo-section">
            <h2>${esc(t.relacionados(g[lang].nombre))}</h2>
            <ul class="seo-list">
${vecinos.map((v) => itemLista(lang, v)).join("\n")}
            </ul>
        </section>`;
	return layout(lang, {
		titulo: t.tituloEj(d.nombre),
		descripcion: recortar(d.tecnica || d.nombre, 155),
		url: d.url, urlOtro: ej[otro(lang)].url,
		migas: [[t.inicio, "/"], [t.ejercicios, t.base], [g[lang].nombre, g[lang].url], [d.nombre, d.url]],
		cuerpo,
	});
};

const paginaGrupo = (lang, g) => {
	const t = TXT[lang], n = g.ejercicios.length;
	const cuerpo = `        <h1>${esc(t.h1Grupo(g[lang].nombre))}</h1>
        <p class="seo-lead">${esc(t.descGrupo(g[lang].nombre, n))}</p>
        <ul class="seo-list">
${g.ejercicios.map((ej) => itemLista(lang, ej)).join("\n")}
        </ul>
${cta(lang)}`;
	return layout(lang, {
		titulo: t.tituloGrupo(g[lang].nombre, n), descripcion: t.descGrupo(g[lang].nombre, n),
		url: g[lang].url, urlOtro: g[otro(lang)].url,
		migas: [[t.inicio, "/"], [t.ejercicios, t.base], [g[lang].nombre, g[lang].url]],
		cuerpo,
	});
};

const paginaHub = (lang) => {
	const t = TXT[lang];
	const cuerpo = `        <h1>${t.h1Hub}</h1>
        <p class="seo-lead">${esc(t.descHub(total))}</p>
        <ul class="seo-list">
${grupos.map((g) => `            <li><a href="${g[lang].url}">${esc(g[lang].nombre)}<small>${t.cuenta(g.ejercicios.length)}</small></a></li>`).join("\n")}
        </ul>
${cta(lang)}`;
	return layout(lang, {
		titulo: t.tituloHub(total), descripcion: t.descHub(total),
		url: t.base, urlOtro: TXT[otro(lang)].base,
		migas: [[t.inicio, "/"], [t.ejercicios, t.base]],
		cuerpo,
	});
};

const enumerar = (lang, items) => new Intl.ListFormat(lang, { type: "conjunction" }).format(items);
const tituloRutina = (lang, r) => TXT[lang].h1Rut(r.n, TXT[lang].lugar[r.lugar]);
const itemRutina = (lang, r) => `            <li><a href="${r[lang].url}">${esc(tituloRutina(lang, r))}<small>${TXT[lang].itemRut(r.n, r.totalEj)}</small></a></li>`;

const paginaRutina = (lang, r) => {
	const t = TXT[lang];
	const titulo = tituloRutina(lang, r);
	// En español los días van en minúscula dentro de la frase; en inglés conservan la mayúscula.
	const diasTxt = enumerar(lang, r.dias.map((d) => (lang === "es" ? t.dias[d.dia].toLowerCase() : t.dias[d.dia])));
	const descripcion = t.descRut(r.n, t.lugar[r.lugar], r.totalEj, t.equipo[r.lugar], t.nivelRut[r.nivel]);
	const movilidad = grupos.find((g) => g.es.nombre === "Movilidad / estiramientos");
	const cuerpo = `        <h1>${esc(titulo)}</h1>
        <p class="seo-lead">${esc(descripcion)}</p>
        <section class="seo-card">
            <h2>${t.semanaTitulo}</h2>
            <p>${esc(t.semana(diasTxt, r.n))}</p>
        </section>
${r.dias.map((d, i) => `        <section class="seo-section">
            <h2>${esc(t.diaTitulo(i + 1, t.dias[d.dia], d[lang]))}</h2>
            <table class="seo-table">
                <thead>
                    <tr><th>${t.colEj}</th><th>${t.colSeries}</th><th>${t.colDesc}</th></tr>
                </thead>
                <tbody>
${d.ejercicios.map((x) => `                    <tr><td><a href="${x.ej[lang].url}">${esc(x.ej[lang].nombre)}</a></td><td>${x.series}</td><td>${x.descanso}</td></tr>`).join("\n")}
                </tbody>
            </table>
        </section>`).join("\n")}
        <section class="seo-card seo-section">
            <h2>${t.progTitulo}</h2>
            <p>${esc(t.prog)}</p>
        </section>
        <section class="seo-card">
            <h2>${t.antesTitulo}</h2>
            <p>${t.antes(movilidad[lang].url)}</p>
        </section>
${cta(lang, t.ctaRutTitulo, t.ctaRutTexto)}
        <section class="seo-section">
            <h2>${t.otrasRut}</h2>
            <ul class="seo-list">
${rutinas.filter((o) => o !== r).map((o) => itemRutina(lang, o)).join("\n")}
            </ul>
        </section>`;
	return layout(lang, {
		titulo: t.tituloRut(r.n, t.lugar[r.lugar]), descripcion: recortar(descripcion, 160),
		url: r[lang].url, urlOtro: r[otro(lang)].url,
		migas: [[t.inicio, "/"], [t.rutinas, t.baseRut], [titulo, r[lang].url]],
		cuerpo,
	});
};

const paginaHubRutinas = (lang) => {
	const t = TXT[lang];
	const cuerpo = `        <h1>${t.h1HubRut}</h1>
        <p class="seo-lead">${esc(t.descHubRut)}</p>
        <ul class="seo-list">
${rutinas.map((r) => itemRutina(lang, r)).join("\n")}
        </ul>
${cta(lang, t.ctaRutTitulo, t.ctaRutTexto)}`;
	return layout(lang, {
		titulo: t.tituloHubRut, descripcion: t.descHubRut,
		url: t.baseRut, urlOtro: TXT[otro(lang)].baseRut,
		migas: [[t.inicio, "/"], [t.rutinas, t.baseRut]],
		cuerpo,
	});
};

// ── Escritura ──
const escribir = (url, html) => {
	const dir = path.join(ROOT, ...url.split("/").filter(Boolean));
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, "index.html"), html);
};

// Se regenera desde cero para que no queden páginas de ejercicios renombrados o eliminados.
fs.rmSync(path.join(ROOT, "ejercicios"), { recursive: true, force: true });
fs.rmSync(path.join(ROOT, "en", "exercises"), { recursive: true, force: true });
fs.rmSync(path.join(ROOT, "rutinas"), { recursive: true, force: true });
fs.rmSync(path.join(ROOT, "en", "workouts"), { recursive: true, force: true });

const entradas = []; // [url es, url en]
for (const lang of ["es", "en"]) {
	escribir(TXT[lang].base, paginaHub(lang));
	for (const g of grupos) {
		escribir(g[lang].url, paginaGrupo(lang, g));
		g.ejercicios.forEach((ej, i) => escribir(ej[lang].url, paginaEjercicio(lang, g, ej, i)));
	}
	escribir(TXT[lang].baseRut, paginaHubRutinas(lang));
	for (const r of rutinas) escribir(r[lang].url, paginaRutina(lang, r));
}
entradas.push([TXT.es.baseRut, TXT.en.baseRut]);
for (const r of rutinas) entradas.push([r.es.url, r.en.url]);
entradas.push([TXT.es.base, TXT.en.base]);
for (const g of grupos) {
	entradas.push([g.es.url, g.en.url]);
	for (const ej of g.ejercicios) entradas.push([ej.es.url, ej.en.url]);
}

const hoy = new Date().toISOString().slice(0, 10);
const nodoUrl = (loc, es, en) => `  <url>
    <loc>${SITE}${encodeURI(loc)}</loc>
    <lastmod>${hoy}</lastmod>
    <xhtml:link rel="alternate" hreflang="es" href="${SITE}${encodeURI(es)}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE}${encodeURI(en)}"/>
  </url>`;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${SITE}/</loc>
    <lastmod>${hoy}</lastmod>
  </url>
  <url>
    <loc>${SITE}/indice_renovado.html</loc>
    <lastmod>${hoy}</lastmod>
  </url>
${entradas.flatMap(([es, en]) => [nodoUrl(es, es, en), nodoUrl(en, es, en)]).join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`Páginas generadas: ${entradas.length * 2} (${total} ejercicios y ${rutinas.length} rutinas x 2 idiomas + índices). Sitio: ${SITE}`);
if (sinTraduccion) console.warn(`Aviso: ${sinTraduccion} ejercicios tienen sobrecarga o respiración sin traducción al inglés; esas secciones se omiten en su página en inglés.`);
