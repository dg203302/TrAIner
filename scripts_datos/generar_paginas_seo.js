// Genera las páginas públicas de ejercicios para buscadores, en español e inglés, más sitemap.xml y robots.txt.
// Uso: node scripts_datos/generar_paginas_seo.js   (Netlify lo corre en cada deploy; ver netlify.toml)
// Salida (no se versiona): /ejercicios/<grupo>/<ejercicio>/, /en/exercises/<group>/<exercise>/, /sitemap.xml, /robots.txt
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
		lang: "es", base: "/ejercicios/", inicio: "Inicio", ejercicios: "Ejercicios", otroIdioma: "English",
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
	},
	en: {
		lang: "en", base: "/en/exercises/", inicio: "Home", ejercicios: "Exercises", otroIdioma: "Español",
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
        <a href="/" class="seo-brand"><img src="/Icons/2.png" alt="" width="32" height="32">Tr<span>AI</span>ner</a>
        <nav class="seo-nav-links">
            <a href="${t.base}">${t.ejercicios}</a>
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
        <p><a href="/">TrAIner</a><a href="${t.base}">${t.ejercicios}</a><a href="/privacy.html">${t.privacidad}</a></p>
    </footer>
</body>

</html>
`;
};

const cta = (lang) => {
	const t = TXT[lang];
	return `        <aside class="seo-cta">
            <h2>${t.ctaTitulo}</h2>
            <p>${t.ctaTexto}</p>
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

// ── Escritura ──
const escribir = (url, html) => {
	const dir = path.join(ROOT, ...url.split("/").filter(Boolean));
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, "index.html"), html);
};

// Se regenera desde cero para que no queden páginas de ejercicios renombrados o eliminados.
fs.rmSync(path.join(ROOT, "ejercicios"), { recursive: true, force: true });
fs.rmSync(path.join(ROOT, "en", "exercises"), { recursive: true, force: true });

const entradas = []; // [url es, url en]
for (const lang of ["es", "en"]) {
	escribir(TXT[lang].base, paginaHub(lang));
	for (const g of grupos) {
		escribir(g[lang].url, paginaGrupo(lang, g));
		g.ejercicios.forEach((ej, i) => escribir(ej[lang].url, paginaEjercicio(lang, g, ej, i)));
	}
}
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

console.log(`Páginas generadas: ${entradas.length * 2} (${total} ejercicios x 2 idiomas + índices). Sitio: ${SITE}`);
if (sinTraduccion) console.warn(`Aviso: ${sinTraduccion} ejercicios tienen sobrecarga o respiración sin traducción al inglés; esas secciones se omiten en su página en inglés.`);
