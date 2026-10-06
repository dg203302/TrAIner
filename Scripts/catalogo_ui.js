// Utilidades compartidas del catálogo de ejercicios (Datos/entrenamientos.json):
// búsqueda, filtros (entorno / nivel / favoritos / recientes), nombres ES-EN, badges y búsqueda por nombre.
// Expone window.PTCatalog. Lo usan plan_entreno (móvil y desktop) e indice_renovado.
(function () {
	"use strict";

	const PAGE_SIZE = 40;
	const KEYS = { favs: "pt_ej_favs", recent: "pt_ej_recent", env: "pt_ej_env", nivel: "pt_ej_nivel" };

	const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
	const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

	const read = (key, fallback) => {
		try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
	};
	const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ } };

	const isEn = () => { try { return window.UIIdioma?.getIdioma?.() === "en"; } catch { return false; } };
	const T = (es, en) => (isEn() ? en : es);

	const GRUPOS_EN = {
		"Pecho": "Chest", "Espalda": "Back", "Piernas": "Legs", "Hombros": "Shoulders", "Brazos": "Arms",
		"Tríceps": "Triceps", "Antebrazos": "Forearms", "Abdomen / core": "Abs / core", "Cardio / acondicionamiento": "Cardio / conditioning",
	};
	const NIVELES = { principiante: ["Principiante", "Beginner"], intermedio: ["Intermedio", "Intermediate"], avanzado: ["Avanzado", "Advanced"] };

	const state = {
		env: ["all", "casa", "gimnasio"].includes(read(KEYS.env, "all")) ? read(KEYS.env, "all") : "all",
		nivel: Object.keys(NIVELES).includes(read(KEYS.nivel, "all")) ? read(KEYS.nivel, "all") : "all",
		special: null, // "fav" | "recent" | null
		limit: PAGE_SIZE,
	};

	const groupLabel = (g) => T(g, GRUPOS_EN[g] ?? g);
	const displayName = (ex) => (isEn() && ex?.nombre_en ? ex.nombre_en : ex?.nombre ?? "");
	const nivelLabel = (n) => (NIVELES[n] ? T(NIVELES[n][0], NIVELES[n][1]) : "");

	// ── Índice por nombre (exacto en O(1); aproximado solo si falla) ──
	let idxSrc = null, idxMap = null, idxEntries = null;
	const buildIndex = (db) => {
		if (idxSrc === db && idxMap) return;
		idxSrc = db; idxMap = new Map(); idxEntries = [];
		for (const [grupo, lista] of Object.entries(db || {})) {
			for (const ex of lista) {
				const item = ex.grupo ? ex : Object.assign(ex, { grupo });
				const k = norm(item.nombre);
				idxMap.set(k, item);
				if (item.nombre_en) idxMap.set(norm(item.nombre_en), item);
				idxEntries.push([k, item]);
			}
		}
	};
	// Exacto; si no, la mejor coincidencia parcial (la clave más larga que contiene o está contenida).
	const lookup = (db, name) => {
		if (!name) return null;
		buildIndex(db);
		const n = norm(name);
		if (idxMap.has(n)) return idxMap.get(n);
		let best = null, bestLen = 0;
		for (const [k, item] of idxEntries) {
			if ((n.includes(k) || k.includes(n)) && k.length > bestLen) { best = item; bestLen = k.length; }
		}
		return best;
	};

	// ── Favoritos y recientes ──
	const favs = () => read(KEYS.favs, []).filter((x) => typeof x === "string");
	const recents = () => read(KEYS.recent, []).filter((x) => typeof x === "string");
	const isFav = (name) => favs().includes(name);
	const toggleFav = (name) => {
		const list = favs();
		const i = list.indexOf(name);
		if (i >= 0) list.splice(i, 1); else list.unshift(name);
		write(KEYS.favs, list.slice(0, 100));
		return i < 0;
	};
	const pushRecent = (name) => {
		write(KEYS.recent, [name, ...recents().filter((x) => x !== name)].slice(0, 12));
	};

	const setEnv = (v) => { state.env = v; write(KEYS.env, v); state.limit = PAGE_SIZE; };
	const setNivel = (v) => { state.nivel = v; write(KEYS.nivel, v); state.limit = PAGE_SIZE; };

	// Texto en el que busca el buscador: nombre ES/EN, grupo, nivel y entorno. Todos los términos deben aparecer.
	const haystack = (ex) => norm([ex.nombre, ex.nombre_en, ex.grupo, GRUPOS_EN[ex.grupo], ex.nivel, nivelLabel(ex.nivel), (ex.entorno || []).includes("casa") ? "casa home" : "gimnasio gym"].join(" "));

	// Devuelve ejercicios [{...ex, _grupo}] aplicando grupo (si no hay búsqueda ni especial), texto, entorno, nivel y favoritos/recientes.
	const filter = (db, { group, q, all } = {}) => {
		buildIndex(db);
		const terms = norm(q).split(" ").filter(Boolean);
		let pool;
		if (state.special === "fav") {
			const f = favs();
			pool = f.map((n) => idxMap.get(norm(n))).filter(Boolean);
		} else if (state.special === "recent") {
			pool = recents().map((n) => idxMap.get(norm(n))).filter(Boolean);
		} else if (terms.length || all) {
			pool = idxEntries.map(([, item]) => item);
		} else {
			pool = (db?.[group] || []).map((ex) => idxMap.get(norm(ex.nombre))).filter(Boolean);
		}
		return pool
			.filter((ex) => state.env === "all" || (Array.isArray(ex.entorno) ? ex.entorno.includes(state.env) : true))
			.filter((ex) => state.nivel === "all" || ex.nivel === state.nivel)
			.filter((ex) => !terms.length || terms.every((t) => haystack(ex).includes(t)))
			.map((ex) => ({ ...ex, _grupo: ex.grupo }));
	};

	const badgesHtml = (ex) => {
		const casa = Array.isArray(ex.entorno) && ex.entorno.includes("casa");
		const parts = [];
		parts.push(`<span class="ex-badge ex-badge-env ${casa ? "is-home" : "is-gym"}">${esc(casa ? T("Casa", "Home") : T("Gimnasio", "Gym"))}</span>`);
		if (ex.nivel && NIVELES[ex.nivel]) parts.push(`<span class="ex-badge ex-badge-lvl lvl-${esc(ex.nivel)}">${esc(nivelLabel(ex.nivel))}</span>`);
		return parts.join("");
	};

	const fallbackSvg = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';

	window.PTCatalog = {
		PAGE_SIZE, state, norm, esc, T, isEn, groupLabel, displayName, nivelLabel, lookup, filter, buildIndex,
		favs, recents, isFav, toggleFav, pushRecent, setEnv, setNivel, badgesHtml, fallbackSvg,
	};
})();
