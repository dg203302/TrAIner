const APIkey = Deno.env.get('API_Key_Gen_Plan');

const normalizeKey = (s) =>
	String(s ?? "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();





const extractLikelyJson = (text) => {
	const s = String(text ?? "").trim();
	const unfenced = s
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```\s*$/i, "")
		.trim();

	const firstObj = unfenced.indexOf("{");
	const firstArr = unfenced.indexOf("[");
	if (firstObj === -1 && firstArr === -1) return unfenced;
	const start = firstArr === -1 ? firstObj : (firstObj === -1 ? firstArr : Math.min(firstObj, firstArr));
	const lastObj = unfenced.lastIndexOf("}");
	const lastArr = unfenced.lastIndexOf("]");
	const end = Math.max(lastObj, lastArr);
	if (end <= start) return unfenced;
	return unfenced.slice(start, end + 1);
};

const validatePlanShape = (obj) => {
	if (!obj || typeof obj !== "object") return "Root debe ser un objeto";
	const root = obj.plan_entrenamiento_hipertrofia;
	if (!root || typeof root !== "object") return "Falta plan_entrenamiento_hipertrofia";

	const usuario = root.usuario;
	if (!usuario || typeof usuario !== "object") return "Falta usuario";
	const requiredUsuario = ["edad", "estatura_cm", "peso_objetivo_kg", "entorno", "objetivo"];
	for (const k of requiredUsuario) {
		if (!(k in usuario)) return `Falta usuario.${k}`;
	}

	const semanal = root.configuracion_semanal;
	if (!Array.isArray(semanal)) return "Falta configuracion_semanal (array)";
	if (semanal.length < 1 || semanal.length > 7) return "configuracion_semanal debe tener entre 1 y 7 días";

	for (const dia of semanal) {
		if (!dia || typeof dia !== "object") return "Cada día debe ser un objeto";
		if (typeof dia.dia !== "string" || !dia.dia.trim()) return "Cada día debe tener dia (string)";
		if (typeof dia.enfoque !== "string") return "Cada día debe tener enfoque (string)";
		if (!Array.isArray(dia.ejercicios)) return "Cada día debe tener ejercicios (array)";
		for (const ex of dia.ejercicios) {
			if (!ex || typeof ex !== "object") return "Cada ejercicio debe ser un objeto";
			if (typeof ex.nombre !== "string" || !ex.nombre.trim()) return "Cada ejercicio debe tener nombre (string)";
			if (typeof ex.series !== "number" || Number.isNaN(ex.series)) return "Cada ejercicio debe tener series (number)";
			if (typeof ex.repeticiones !== "string" || !ex.repeticiones.trim()) return "Cada ejercicio debe tener repeticiones (string)";
			if (typeof ex.descanso_segundos !== "number" || Number.isNaN(ex.descanso_segundos)) {
				return "Cada ejercicio debe tener descanso_segundos (number)";
			}
		}
	}

	const prog = root.progresion_sugerida;
	if (!prog || typeof prog !== "object") return "Falta progresion_sugerida";
	if (typeof prog.metodo !== "string") return "progresion_sugerida.metodo debe ser string";
	if (typeof prog.descripcion !== "string") return "progresion_sugerida.descripcion debe ser string";

	return null;
};

const stripAccents = (s) =>
	String(s ?? "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim();

const normalizeIntensidad = (value) => {
	const v = stripAccents(value).toLowerCase();
	if (v.includes("baj")) return "baja";
	if (v.includes("alt")) return "alta";
	if (v.includes("med")) return "media";
	return "media";
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const ALL_DIAS_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const ALL_DIAS_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DAY_INDEX_BY_CODE = { L: 0, M: 1, X: 2, J: 3, V: 4, S: 5, D: 6 };
const DAY_INDEX_BY_NAME = {
	// Spanish (sin tildes)
	lunes: 0,
	martes: 1,
	miercoles: 2,
	jueves: 3,
	viernes: 4,
	sabado: 5,
	domingo: 6,
	// English
	monday: 0,
	tuesday: 1,
	wednesday: 2,
	thursday: 3,
	friday: 4,
	saturday: 5,
	sunday: 6,
	// Abbreviations
	mon: 0,
	tue: 1,
	tues: 1,
	wed: 2,
	thu: 3,
	thur: 3,
	thurs: 3,
	fri: 4,
	sat: 5,
	sun: 6,
};

const getDayIndexFromName = (value) => {
	const key = stripAccents(value)
		.toLowerCase()
		.replace(/[^a-z\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (!key) return null;
	return Object.prototype.hasOwnProperty.call(DAY_INDEX_BY_NAME, key) ? DAY_INDEX_BY_NAME[key] : null;
};

const normalizeSelectedDays = ({ dias, dias_semana, idiomaNorm }) => {
	const ALL_DIAS = idiomaNorm === "en" ? ALL_DIAS_EN : ALL_DIAS_ES;
	const selectedIdx = new Set();

	if (Array.isArray(dias)) {
		for (const item of dias) {
			const code = String(item ?? "").toUpperCase();
			const idx = Object.prototype.hasOwnProperty.call(DAY_INDEX_BY_CODE, code) ? DAY_INDEX_BY_CODE[code] : null;
			if (idx != null) selectedIdx.add(idx);
		}
	}

	if (Array.isArray(dias_semana)) {
		for (const item of dias_semana) {
			const idx = getDayIndexFromName(item);
			if (idx != null) selectedIdx.add(idx);
		}
	}

	if (selectedIdx.size === 0) {
		for (let i = 0; i < 7; i++) selectedIdx.add(i);
	}

	return Array.from(selectedIdx)
		.sort((a, b) => a - b)
		.map((idx) => ALL_DIAS[idx]);
};

const canonicalDayKey = (dayLabel) => {
	const idx = getDayIndexFromName(dayLabel);
	if (idx != null) return ALL_DIAS_EN[idx].toLowerCase();
	return stripAccents(dayLabel).toLowerCase();
};

// Palabras que delatan equipamiento de gimnasio (solo se usan si un ejercicio no trae el campo "entorno").
const GYM_WORDS = /polea|maquina|prensa|barra|predicador|cable|smith|contractora|pec deck|hack|banco|dominadas|jalon|remo en t|rueda abdominal|hexagonal/;

const GRUPOS_BASE = ["Pecho", "Espalda", "Piernas", "Hombros", "Brazos", "Abdomen / core"];

// Grupos del catálogo que corresponden al enfoque de un día (en español o inglés).
const gruposParaEnfoque = (enfoque) => {
	const n = normalizeKey(enfoque);
	const g = [];
	const add = (...names) => names.forEach((x) => { if (!g.includes(x)) g.push(x); });
	if (/cuerpo completo|full body|general/.test(n)) return [...GRUPOS_BASE];
	if (/pecho|chest|empuje|push|torso|upper/.test(n)) add("Pecho");
	if (/espalda|back|dorsal|tiron|pull|torso|upper/.test(n)) add("Espalda");
	if (/hombro|shoulder|empuje|push|torso|upper/.test(n)) add("Hombros");
	if (/biceps|brazo|arm|tiron|pull|torso|upper/.test(n)) add("Brazos");
	if (/triceps|empuje|push|torso|upper/.test(n)) add("Tríceps");
	if (/antebrazo|forearm/.test(n)) add("Antebrazos");
	if (/pierna|leg|gluteo|glute|cuadricep|quad|femoral|hamstring|posterior/.test(n)) add("Piernas");
	if (/abdomen|abs|core|abdominal/.test(n)) add("Abdomen / core");
	if (/cardio|acondicionamiento|conditioning|hiit/.test(n)) add("Cardio / acondicionamiento");
	return g.length ? g : [...GRUPOS_BASE];
};

// Divisiones de respaldo según cantidad de días (se usan si la IA no responde).
const SPLITS_RESPALDO = {
	1: [["Cuerpo Completo", "Full Body"]],
	2: [["Torso Superior", "Upper Body"], ["Pierna y Core", "Legs and Core"]],
	3: [["Empuje (Pecho, Hombro y Tríceps)", "Push (Chest, Shoulders and Triceps)"], ["Tirón (Espalda y Bíceps)", "Pull (Back and Biceps)"], ["Pierna y Abdomen", "Legs and Abs"]],
	4: [["Torso Fuerza (Pecho y Espalda)", "Upper Strength (Chest and Back)"], ["Pierna y Abdomen", "Legs and Abs"], ["Torso Hipertrofia (Hombros y Brazos)", "Upper Hypertrophy (Shoulders and Arms)"], ["Pierna y Glúteos", "Legs and Glutes"]],
	5: [["Pecho y Tríceps", "Chest and Triceps"], ["Espalda y Bíceps", "Back and Biceps"], ["Piernas (Enfoque Cuádriceps)", "Legs (Quad Focus)"], ["Hombros y Core", "Shoulders and Core"], ["Pierna Posterior y Brazos", "Hamstrings and Arms"]],
	6: [["Empuje A (Pecho y Tríceps)", "Push A (Chest and Triceps)"], ["Tirón A (Espalda y Bíceps)", "Pull A (Back and Biceps)"], ["Pierna A (Cuádriceps)", "Legs A (Quads)"], ["Empuje B (Hombro y Pecho)", "Push B (Shoulders and Chest)"], ["Tirón B (Espalda dorsal)", "Pull B (Lats)"], ["Pierna B (Cadena posterior)", "Legs B (Posterior Chain)"]],
	7: [["Empuje A", "Push A"], ["Tirón A", "Pull A"], ["Pierna A", "Legs A"], ["Empuje B", "Push B"], ["Tirón B", "Pull B"], ["Pierna B", "Legs B"], ["Acondicionamiento y Core", "Conditioning and Core"]],
};

const normalizePlanWithSelectedDays = ({ planObj, idiomaNorm, esCasa, objetivo, intensidadNorm, ejerciciosPorDiaObjetivo, diasSeleccionados, ejerciciosSeleccionados, catalogFlat, catalogGroups }) => {
	if (!planObj || typeof planObj !== "object") return planObj;
	const root = planObj.plan_entrenamiento_hipertrofia;
	if (!root || typeof root !== "object") return planObj;

	const t = (es, en) => (idiomaNorm === "en" ? en : es);
	const ALL_DIAS = idiomaNorm === "en" ? ALL_DIAS_EN : ALL_DIAS_ES;

	root.usuario = (root.usuario && typeof root.usuario === "object") ? root.usuario : {};
	root.usuario.intensidad = intensidadNorm;
	root.usuario.ejercicios_por_dia = ejerciciosPorDiaObjetivo;

	const semanalRaw = root.configuracion_semanal;
	const semanalArr = Array.isArray(semanalRaw) ? semanalRaw : [];

	const byDay = new Map();
	for (const item of semanalArr) {
		if (!item || typeof item !== "object") continue;
		const key = canonicalDayKey(item.dia);
		if (key) byDay.set(key, item);
	}

	const selectedKeys = new Set(diasSeleccionados.map(canonicalDayKey));
	const selectedExerciseKeySet = new Set(ejerciciosSeleccionados.map((e) => normalizeKey(e)));
	const soloEjerciciosSeleccionados = ejerciciosSeleccionados.length > 0;
	const hayCatalogo = Object.keys(catalogFlat).length > 0;

	const isAllowedExerciseName = (name) => {
		if (!soloEjerciciosSeleccionados) return true;
		const k = normalizeKey(name);
		return k && selectedExerciseKeySet.has(k);
	};

	// ¿El ejercicio se puede hacer en el entorno elegido? En casa solo se admiten los marcados como aptos.
	const isAllowedForEnv = (name) => {
		if (!esCasa) return true;
		const key = normalizeKey(name);
		const entry = catalogFlat[key];
		if (entry) return Array.isArray(entry.entorno) ? entry.entorno.includes("casa") : !GYM_WORDS.test(key);
		// Fuera del catálogo: si hay catálogo, se descarta (la IA lo inventó); si no, se decide por palabras clave.
		return hayCatalogo ? false : !GYM_WORDS.test(key);
	};

	const normalizeExercise = (ex) => {
		if (!ex || typeof ex !== "object") return null;
		// La IA puede devolver la marca "★" de la lista de básicos pegada al nombre.
		const nombre = (typeof ex.nombre === "string" ? ex.nombre : String(ex.nombre ?? "")).replace(/\s*★\s*$/, "").trim();
		if (!nombre) return null;

		const norm = normalizeKey(nombre);
		const baseEx = catalogFlat[norm] || {};

		const seriesNum = Number(ex.series);
		const descansoNum = Number(ex.descanso_segundos);
		const repeticiones = (typeof ex.repeticiones === "string" && ex.repeticiones.trim())
			? ex.repeticiones.trim()
			: String(ex.repeticiones ?? ex.reps ?? "10-12").trim() || "10-12";

		return {
			nombre: baseEx.nombre || nombre,
			series: Number.isFinite(seriesNum) ? seriesNum : 4,
			repeticiones,
			descanso_segundos: Number.isFinite(descansoNum) ? descansoNum : 90,
		};
	};

	const makeFallbackExercise = (nombre) => ({
		nombre,
		series: intensidadNorm === "baja" ? 3 : 4,
		repeticiones: objetivo === "grasa" ? "12-15" : (intensidadNorm === "alta" ? "6-10" : "8-12"),
		descanso_segundos: 90,
	});

	// Ejercicios del catálogo por grupo, ya filtrados por entorno.
	const porGrupo = {};
	if (catalogGroups && Object.keys(catalogGroups).length > 0) {
		for (const [g, lista] of Object.entries(catalogGroups)) porGrupo[g] = lista.map((e) => e.nombre);
	} else {
		for (const ex of Object.values(catalogFlat)) if (ex?.grupo && ex?.nombre) (porGrupo[ex.grupo] = porGrupo[ex.grupo] || []).push(ex.nombre);
	}
	for (const g of Object.keys(porGrupo)) porGrupo[g] = porGrupo[g].filter(isAllowedForEnv);

	const usoGlobal = new Map(); // nombre -> veces usado en la semana (para variar entre días)
	const usar = (nombre) => usoGlobal.set(normalizeKey(nombre), (usoGlobal.get(normalizeKey(nombre)) || 0) + 1);
	const uso = (nombre) => usoGlobal.get(normalizeKey(nombre)) || 0;

	// Ejercicios básicos (los clásicos de cada grupo): el plan siempre incluye al menos uno por grupo principal del día.
	const principalSet = new Set(Object.values(catalogFlat).filter((e) => e?.principal && e?.nombre).map((e) => normalizeKey(e.nombre)));
	const grupoDeNombre = new Map();
	for (const [g, lista] of Object.entries(porGrupo)) for (const n of lista) grupoDeNombre.set(normalizeKey(n), g);
	const esBasico = (nombre) => principalSet.has(normalizeKey(nombre));

	const asegurarBasicos = (lista, grupos) => {
		if (!principalSet.size) return;
		const existentes = new Set(lista.map((e) => normalizeKey(e.nombre)));
		const nuevos = [];
		for (const grupo of grupos.slice(0, 3)) {
			const yaHay = lista.concat(nuevos).some((e) => esBasico(e.nombre) && grupoDeNombre.get(normalizeKey(e.nombre)) === grupo);
			if (yaHay) continue;
			let cands = (porGrupo[grupo] || []).filter((n) => esBasico(n) && !existentes.has(normalizeKey(n)));
			// En gimnasio se prefieren los clásicos de gimnasio (barra, polea, máquina) a los que también sirven en casa.
			if (!esCasa) {
				const soloGym = cands.filter((n) => !(catalogFlat[normalizeKey(n)]?.entorno || []).includes("casa"));
				if (soloGym.length) cands = soloGym;
			}
			if (!cands.length) continue;
			let mejor = cands[0];
			for (const n of cands) if (uso(n) < uso(mejor)) mejor = n;
			nuevos.push(makeFallbackExercise(mejor));
			existentes.add(normalizeKey(mejor));
			usar(mejor);
		}
		lista.unshift(...nuevos);
		// Los básicos van primero (compuestos al comienzo del día); el orden entre ellos se conserva.
		lista.sort((a, b) => Number(esBasico(b.nombre)) - Number(esBasico(a.nombre)));
		while (lista.length > ejerciciosPorDiaObjetivo) lista.pop();
	};

	// Elige el ejercicio menos repetido de los grupos del día, rotando entre grupos.
	const completarDia = (lista, grupos, diaIdx) => {
		const existentes = new Set(lista.map((e) => normalizeKey(e.nombre)));
		const grupoValidos = grupos.filter((g) => (porGrupo[g] || []).length > 0);
		const orden = grupoValidos.length ? grupoValidos : Object.keys(porGrupo).filter((g) => porGrupo[g].length > 0);
		if (!orden.length) return;
		let g = diaIdx % orden.length;
		let guard = ejerciciosPorDiaObjetivo * orden.length * 4 + 20;
		while (lista.length < ejerciciosPorDiaObjetivo && guard-- > 0) {
			const grupo = orden[g % orden.length];
			g++;
			const candidatos = (porGrupo[grupo] || []).filter((n) => !existentes.has(normalizeKey(n)));
			if (!candidatos.length) continue;
			let mejor = candidatos[0];
			for (const n of candidatos) if ((usoGlobal.get(normalizeKey(n)) || 0) < (usoGlobal.get(normalizeKey(mejor)) || 0)) mejor = n;
			lista.push(makeFallbackExercise(mejor));
			existentes.add(normalizeKey(mejor));
			usar(mejor);
		}
	};

	// Solo los días elegidos: los demás no aparecen en el plan.
	const semanalFixed = [];
	let diaIdx = 0;
	for (const diaCanonical of ALL_DIAS) {
		const key = canonicalDayKey(diaCanonical);
		if (!selectedKeys.has(key)) continue;

		const original = byDay.get(key);
		const base = (original && typeof original === "object") ? original : { dia: diaCanonical };
		let enfoque = (typeof base.enfoque === "string" && base.enfoque.trim()) ? base.enfoque.trim() : t("Entrenamiento", "Training");
		// Un día elegido para entrenar nunca es de descanso: si la IA lo rotuló así, se usa un enfoque de la división de respaldo.
		if (/descanso|\brest\b|recuper|libre|\boff\b/.test(normalizeKey(enfoque))) {
			const split = SPLITS_RESPALDO[Math.min(Math.max(diasSeleccionados.length, 1), 7)];
			enfoque = split[diaIdx % split.length][idiomaNorm === "en" ? 1 : 0];
		}

		let ejerciciosNorm = (Array.isArray(base.ejercicios) ? base.ejercicios : []).map(normalizeExercise).filter(Boolean);
		if (soloEjerciciosSeleccionados) ejerciciosNorm = ejerciciosNorm.filter((e) => isAllowedExerciseName(e.nombre));
		ejerciciosNorm = ejerciciosNorm.filter((e) => isAllowedForEnv(e.nombre));
		// Sin repetidos dentro del día.
		const vistos = new Set();
		ejerciciosNorm = ejerciciosNorm.filter((e) => { const k = normalizeKey(e.nombre); if (vistos.has(k)) return false; vistos.add(k); return true; });

		if (ejerciciosNorm.length > ejerciciosPorDiaObjetivo) ejerciciosNorm = ejerciciosNorm.slice(0, ejerciciosPorDiaObjetivo);
		ejerciciosNorm.forEach((e) => usar(e.nombre));
		if (!soloEjerciciosSeleccionados) asegurarBasicos(ejerciciosNorm, gruposParaEnfoque(enfoque));

		if (ejerciciosNorm.length < ejerciciosPorDiaObjetivo) {
			if (soloEjerciciosSeleccionados) {
				const pool = ejerciciosSeleccionados.filter(isAllowedForEnv);
				const existentes = new Set(ejerciciosNorm.map((e) => normalizeKey(e.nombre)));
				for (const name of pool) {
					if (ejerciciosNorm.length >= ejerciciosPorDiaObjetivo) break;
					if (existentes.has(normalizeKey(name))) continue;
					ejerciciosNorm.push(makeFallbackExercise(name));
					existentes.add(normalizeKey(name));
				}
			} else {
				completarDia(ejerciciosNorm, gruposParaEnfoque(enfoque), diaIdx);
			}
		}

		semanalFixed.push({ dia: diaCanonical, enfoque, ejercicios: ejerciciosNorm });
		diaIdx++;
	}

	root.configuracion_semanal = semanalFixed;
	planObj.plan_entrenamiento_hipertrofia = root;
	return planObj;
};

const generatePlanEntreno = async (payload, request) => {

	const idiomaNorm = String(payload?.idioma ?? "").trim().toLowerCase() === "en" ? "en" : "es";
	const idiomaLabel = idiomaNorm === "en" ? "English" : "Español";
	const t = (es, en) => (idiomaNorm === "en" ? en : es);

	const lugar = payload?.lugar;
	const objetivo = payload?.objetivo;
	const intensidadNorm = normalizeIntensidad(payload?.intensidad);

	const ejerciciosPorDiaFromPayload = Number(payload?.ejercicios_por_dia);
	const ejerciciosPorDiaFromInt = ({ baja: 4, media: 6, alta: 8 })[intensidadNorm] ?? 6;
	const ejerciciosPorDiaObjetivo = Number.isFinite(ejerciciosPorDiaFromPayload)
		? clamp(Math.round(ejerciciosPorDiaFromPayload), 1, 12)
		: ejerciciosPorDiaFromInt;

	const diasSeleccionados = normalizeSelectedDays({ dias: payload?.dias, dias_semana: payload?.dias_semana, idiomaNorm });
	const diasSeleccionadosJson = JSON.stringify(diasSeleccionados);


	const origin = request?.headers?.get("origin") || request?.headers?.get("referer") || "https://aipersonaltrainer.netlify.app";
	let catalogGroups = {};
	let catalogFlat = {};

	if (payload?.catalog && typeof payload.catalog === "object") {
		for (const [name, ex] of Object.entries(payload.catalog)) {
			catalogFlat[normalizeKey(name)] = ex;
		}
	} else if (!origin.includes("localhost") && !origin.includes("127.0.0.1")) {
		try {
			const catCtrl = new AbortController();
			const catTimer = setTimeout(() => catCtrl.abort(), 2000);
			const catRes = await fetch(origin.replace(/\/$/, "") + "/Datos/entrenamientos.json", { signal: catCtrl.signal });
			clearTimeout(catTimer);
			if (catRes.ok) {
				catalogGroups = await catRes.json();
				for (const group of Object.values(catalogGroups)) {
					for (const ex of group) {
						catalogFlat[normalizeKey(ex.nombre)] = ex;
					}
				}
			}
		} catch (e) {
			console.warn("Failed to fetch catalog", e);
		}
	}

	const normalizeSelectedExercises = (value) => {
		if (!Array.isArray(value)) return [];
		const out = [];
		const seen = new Set();
		for (const item of value) {
			const key = normalizeKey(item);
			if (!key) continue;
			const canonical = catalogFlat[key] ? catalogFlat[key].nombre : null;
			if (!canonical) continue;
			if (seen.has(canonical)) continue;
			seen.add(canonical);
			out.push(canonical);
			if (out.length >= 40) break;
		}
		return out;
	};

	const ejerciciosSeleccionados = normalizeSelectedExercises(payload?.ejercicios_seleccionados);
	const ejerciciosSeleccionadosJson = JSON.stringify(ejerciciosSeleccionados);

	const isAllowedExerciseName = (name) => {
		if (ejerciciosSeleccionados.length === 0) return !!catalogFlat[normalizeKey(name)];
		return ejerciciosSeleccionados.some(e => normalizeKey(e) === normalizeKey(name));
	};


	const ALL_DIAS = idiomaNorm === "en" ? ALL_DIAS_EN : ALL_DIAS_ES;
	const diaEjemplo = ALL_DIAS[0];

	const lugarKey = normalizeKey(lugar);
	const esCasa = !(lugarKey === "gimnasio" || lugarKey === "gym");
	const entornoValue = esCasa ? t("Casa", "Home") : t("Gimnasio", "Gym");
	const objetivoValue = String(objetivo ?? "").toLowerCase() === "grasa" ? t("grasa", "fat") : t("musculo", "muscle");
	const progresionMetodoValue = t("Sobrecarga progresiva", "Progressive overload");
	const descansoLabel = t("Descanso", "Rest");

	// Catálogo por grupo (filtrado por entorno) construido desde entrenamientos.json; null si no hay catálogo.
	const catalogoDinamico = (() => {
		const porGrupo = {};
		if (Object.keys(catalogGroups).length > 0) {
			for (const [g, lista] of Object.entries(catalogGroups)) porGrupo[g] = lista;
		} else {
			for (const ex of Object.values(catalogFlat)) if (ex?.grupo) (porGrupo[ex.grupo] = porGrupo[ex.grupo] || []).push(ex);
		}
		const lineas = [];
		for (const [g, lista] of Object.entries(porGrupo)) {
			const nombres = lista
				.filter((ex) => !esCasa || !Array.isArray(ex.entorno) || ex.entorno.includes("casa"))
				.map((ex) => (ex.principal ? `${ex.nombre} ★` : ex.nombre));
			if (nombres.length) lineas.push(`${g}: ${nombres.join(", ")}.`);
		}
		return lineas.length ? `Ejercicios disponibles por grupo (elige según entorno/objetivo):\n${lineas.join("\n")}` : null;
	})();

	// Lista de ejercicios disponibles solo si NO hay preferencias (para dar contexto de selección)
	const ejerciciosContexto = ejerciciosSeleccionados.length > 0
		? `Usa SOLO estos ejercicios (repite si es necesario): ${ejerciciosSeleccionadosJson}`
		: catalogoDinamico || `Ejercicios disponibles por grupo (elige según entorno/objetivo):
Pecho: Press de banca plano con barra, Press de banca inclinado con barra, Press de banca inclinado con mancuernas, Flexiones de brazos (peso corporal), Aperturas con mancuernas, Fondos en paralelas (pecho bajo/tríceps), Cruce de poleas.
Espalda: Dominadas (peso corporal), Jalón al pecho en polea, Remo con barra, Remo unilateral con mancuerna, Remo sentado en polea, Pull-over con mancuerna, Remo en T, Hiperextensiones lumbares.
Piernas: Sentadilla libre, Prensa de piernas, Zancadas / estocadas, Peso muerto rumano, Hip thrust (empuje de cadera), Extensión de cuádriceps en máquina, Curl femoral tumbado o sentado, Elevación de talones, Sentadilla búlgara, Peso muerto sumo con barra, Step-ups con mancuernas.
Hombros: Press militar con barra o mancuernas, Elevaciones laterales con mancuernas, Pájaros / vuelos posteriores, Elevaciones frontales, Face pull (salud del hombro), Press Arnold, Encogimientos de hombros con barra reversa.
Brazos: Curl de bíceps con barra, Curl martillo con mancuernas, Curl predicador, Fondos entre bancos.
Tríceps: Press francés, Extensión de triceps en polea alta, Fondos entre bancos, Extensión de tríceps con mancuerna sobre la cabeza, Patada de tríceps con mancuerna.
Antebrazos: Curl de muñeca con barra, Curl de muñeca con mancuerna, Curl invertido con barra, Farmer's walk (caminata del granjero).
Abdomen: Plancha abdominal, Crunch abdominal clásico, Elevación de piernas colgado o en suelo, Giros rusos, Rueda abdominal, Dragon flag.
Cardio: Burpees, Saltos de tijera, Salto a la cuerda.`;

	const prompt = `JSON válido (RFC 8259) únicamente. Sin texto extra, markdown ni comentarios.

Idioma valores: ${idiomaLabel}. Claves JSON: sin traducir.
Nombres de ejercicios: USA EXACTAMENTE los nombres literales de la lista proporcionada, NO cambies plurales ni alteres palabras (ej. usa "mancuernas", nunca "mancuerno").
Días: ${idiomaNorm === "en" ? "Monday–Sunday" : "Lunes–Domingo"}.

Esquema exacto:
{"plan_entrenamiento_hipertrofia":{"usuario":{"edad":${Number(payload?.Edad) || 0},"estatura_cm":${Number(payload?.Altura) || 0},"peso_objetivo_kg":${Number(payload?.Peso_objetivo) || 0},"entorno":"${entornoValue}","objetivo":"${objetivoValue}","intensidad":"${intensidadNorm}","ejercicios_por_dia":${ejerciciosPorDiaObjetivo}},"configuracion_semanal":[{"dia":"${diaEjemplo}","enfoque":"<str>","ejercicios":[{"nombre":"<str>","series":4,"repeticiones":"10-12","descanso_segundos":90}]},"...resto de los días de entrenamiento..."],"progresion_sugerida":{"metodo":"${progresionMetodoValue}","descripcion":"<str>"}}}

Reglas:
- series y descanso_segundos: número. repeticiones: string.
- configuracion_semanal: EXACTAMENTE ${diasSeleccionados.length} días, solo los de "Días de entrenamiento". NO incluyas días de descanso ni otros días.
- Cada día → EXACTAMENTE ${ejerciciosPorDiaObjetivo} ejercicios, enfoque coherente, empezando por los ejercicios básicos/compuestos del grupo del día (marcados con ★ en la lista) y sin repetir ejercicios entre días salvo que sea necesario.
- ${esCasa ? "Entorno CASA: usa SOLO ejercicios de la lista (ya son aptos para entrenar en casa, sin máquinas, poleas ni barras). No inventes ejercicios." : "Entorno GIMNASIO: puedes usar máquinas, poleas y barras. Usa solo ejercicios de la lista."}

Días de entrenamiento: ${diasSeleccionadosJson}
Entorno: ${entornoValue} | Objetivo: ${objetivoValue} | Edad: ${payload?.Edad} | Altura: ${payload?.Altura}cm | Peso actual: ${payload?.Peso_actual}kg | Peso objetivo: ${payload?.Peso_objetivo}kg

${ejerciciosContexto}`;

	let planObj = null;
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 7500);

		const apiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
			signal: controller.signal,
			method: "POST",
			headers: {
				"Authorization": `Bearer ${APIkey}`,
				"HTTP-Referer": origin,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				model: "openrouter/free",
				messages: [
					{ role: "system", content: "You are an API that ONLY returns valid JSON. No markdown, no conversational text." },
					{ role: "user", content: prompt }
				]
			})
		});
		clearTimeout(timeoutId);

		if (apiResponse.ok) {
			const data = await apiResponse.json();
			const planText = data.choices?.[0]?.message?.content || "";
			const jsonCandidate = extractLikelyJson(planText);
			planObj = JSON.parse(jsonCandidate);
		} else {
			console.warn("OpenRouter returned status:", apiResponse.status);
		}
	} catch (e) {
		console.warn("OpenRouter error or timeout, generating algorithmic routine:", e?.message || e);
	}

	if (!planObj || !planObj.plan_entrenamiento_hipertrofia) {
		const split = SPLITS_RESPALDO[Math.min(Math.max(diasSeleccionados.length, 1), 7)];
		const semanalBase = diasSeleccionados.map((diaNombre, idx) => ({
			dia: diaNombre,
			enfoque: split[idx % split.length][idiomaNorm === "en" ? 1 : 0],
			ejercicios: []
		}));

		planObj = {
			plan_entrenamiento_hipertrofia: {
				usuario: {
					edad: Number(payload?.Edad) || 25,
					estatura_cm: Number(payload?.Altura) || 175,
					peso_objetivo_kg: Number(payload?.Peso_objetivo) || 75,
					entorno: entornoValue,
					objetivo: objetivoValue,
					intensidad: intensidadNorm,
					ejercicios_por_dia: ejerciciosPorDiaObjetivo
				},
				configuracion_semanal: semanalBase,
				progresion_sugerida: {
					metodo: progresionMetodoValue,
					descripcion: "Aumentar 1-2 repeticiones o 2.5 kg al dominar el rango objetivo con técnica perfecta."
				}
			}
		};
	}

	planObj = normalizePlanWithSelectedDays({
		planObj,
		idiomaNorm,
		esCasa,
		objetivo,
		intensidadNorm,
		ejerciciosPorDiaObjetivo,
		diasSeleccionados,
		ejerciciosSeleccionados,
		catalogFlat,
		catalogGroups
	});

	const validationError = validatePlanShape(planObj);
	if (validationError) throw new Error(`JSON inválido: ${validationError}`);

	return {
		planObj,
		plan_entreno: JSON.stringify(planObj),
		meta: {
			idioma: idiomaNorm,
			intensidad: intensidadNorm,
			ejercicios_por_dia: ejerciciosPorDiaObjetivo,
			dias: diasSeleccionados,
			ejercicios_seleccionados: ejerciciosSeleccionados,
		},
	};
};

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "content-type",
};

export default async function handler(request, _context) {
	if (request.method === "OPTIONS") {
		return new Response(null, { status: 204, headers: corsHeaders });
	}

	if (request.method !== "POST") {
		return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
			status: 405,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}

	let payload;
	try {
		payload = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
			status: 400,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}

	try {
		const result = await generatePlanEntreno(payload, request);
		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error(error);
		return new Response(JSON.stringify({ error: error?.message || String(error) }), {
			status: 500,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
}
