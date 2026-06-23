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
	if (semanal.length !== 7) return "configuracion_semanal debe tener 7 días";

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

const normalizePlanWithSelectedDays = ({ planObj, idiomaNorm, lugar, objetivo, intensidadNorm, ejerciciosPorDiaObjetivo, diasSeleccionados, ejerciciosSeleccionados, catalogFlat }) => {
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

	const isAllowedExerciseName = (name) => {
		if (!soloEjerciciosSeleccionados) return true;
		const k = normalizeKey(name);
		return k && selectedExerciseKeySet.has(k);
	};



	const normalizeExercise = (ex) => {
		if (!ex || typeof ex !== "object") return null;
		const nombre = typeof ex.nombre === "string" ? ex.nombre : String(ex.nombre ?? "").trim();
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




	const allExercises = Object.values(catalogFlat).map(e => e.nombre);

	const pickFallbackPool = () => {
		if (soloEjerciciosSeleccionados) return ejerciciosSeleccionados;
		const entornoKey = normalizeKey(lugar);
		if (entornoKey.includes("casa")) {
			return allExercises.filter((name) => {
				const k = normalizeKey(name);
				return !k.includes("polea") && !k.includes("maquina") && !k.includes("prensa") && !k.includes("barra") && !k.includes("predicador");
			});
		}
		return allExercises;
	};
	const fallbackPool = pickFallbackPool();


	const makeFallbackExercise = (nombre) => {
		const norm = normalizeKey(nombre);
		const baseEx = catalogFlat[norm] || {};
		return {
			nombre,
			series: 4,
			repeticiones: "10-12",
			descanso_segundos: 90,
		};
	};


	const semanalFixed = ALL_DIAS.map((diaCanonical) => {
		const key = canonicalDayKey(diaCanonical);
		const isSelected = selectedKeys.has(key);
		const original = byDay.get(key);
		const base = (original && typeof original === "object") ? original : { dia: diaCanonical };

		base.dia = diaCanonical;
		if (!isSelected) {
			return { dia: diaCanonical, enfoque: t("Descanso", "Rest"), ejercicios: [] };
		}

		const enfoque = (typeof base.enfoque === "string" && base.enfoque.trim()) ? base.enfoque.trim() : t("Entrenamiento", "Training");
		const ejerciciosRaw = Array.isArray(base.ejercicios) ? base.ejercicios : [];
		let ejerciciosNorm = ejerciciosRaw.map(normalizeExercise).filter(Boolean);
		if (soloEjerciciosSeleccionados) {
			ejerciciosNorm = ejerciciosNorm.filter((e) => isAllowedExerciseName(e.nombre));
		}

		if (ejerciciosNorm.length > ejerciciosPorDiaObjetivo) {
			ejerciciosNorm = ejerciciosNorm.slice(0, ejerciciosPorDiaObjetivo);
		}
		if (ejerciciosNorm.length < ejerciciosPorDiaObjetivo) {
			const existing = new Set(ejerciciosNorm.map((e) => normalizeKey(e.nombre)));

			if (soloEjerciciosSeleccionados) {
				const pool = Array.isArray(fallbackPool) ? fallbackPool : [];
				if (pool.length > 0) {
					let idx = 0;
					const guard = ejerciciosPorDiaObjetivo * 20;
					let steps = 0;
					while (ejerciciosNorm.length < ejerciciosPorDiaObjetivo && steps < guard) {
						const name = pool[idx % pool.length];
						idx++;
						steps++;
						const k = normalizeKey(name);
						if (existing.has(k) && existing.size < pool.length) continue;
						ejerciciosNorm.push(makeFallbackExercise(name));
						existing.add(k);
					}
				}
			} else {
				for (const name of fallbackPool) {
					const k = normalizeKey(name);
					if (existing.has(k)) continue;
					ejerciciosNorm.push(makeFallbackExercise(name));
					existing.add(k);
					if (ejerciciosNorm.length >= ejerciciosPorDiaObjetivo) break;
				}
			}
		}

		return { dia: diaCanonical, enfoque, ejercicios: ejerciciosNorm };
	});

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
	try {
		const catRes = await fetch(origin.replace(/\/$/, "") + "/Datos/entrenamientos.json");
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

	const entornoValue = String(lugar ?? "").toLowerCase() === "gimnasio" ? t("Gimnasio", "Gym") : t("Casa", "Home");
	const objetivoValue = String(objetivo ?? "").toLowerCase() === "grasa" ? t("grasa", "fat") : t("musculo", "muscle");
	const progresionMetodoValue = t("Sobrecarga progresiva", "Progressive overload");
	const descansoLabel = t("Descanso", "Rest");

	// Lista de ejercicios disponibles solo si NO hay preferencias (para dar contexto de selección)
	const ejerciciosContexto = ejerciciosSeleccionados.length > 0
		? `Usa SOLO estos ejercicios (repite si es necesario): ${ejerciciosSeleccionadosJson}`
		: `Ejercicios disponibles por grupo (elige según entorno/objetivo):
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
{"plan_entrenamiento_hipertrofia":{"usuario":{"edad":${Number(payload?.Edad) || 0},"estatura_cm":${Number(payload?.Altura) || 0},"peso_objetivo_kg":${Number(payload?.Peso_objetivo) || 0},"entorno":"${entornoValue}","objetivo":"${objetivoValue}","intensidad":"${intensidadNorm}","ejercicios_por_dia":${ejerciciosPorDiaObjetivo}},"configuracion_semanal":[{"dia":"${diaEjemplo}","enfoque":"<str>","ejercicios":[{"nombre":"<str>","series":4,"repeticiones":"10-12","descanso_segundos":90}]},"...6 días más..."],"progresion_sugerida":{"metodo":"${progresionMetodoValue}","descripcion":"<str>"}}}

Reglas:
- series y descanso_segundos: número. repeticiones: string.
- configuracion_semanal: exactamente 7 días.
- Días seleccionados → EXACTAMENTE ${ejerciciosPorDiaObjetivo} ejercicios, enfoque coherente.
- Días NO seleccionados → enfoque "${descansoLabel}", ejercicios [].

Días de entrenamiento: ${diasSeleccionadosJson}
Entorno: ${entornoValue} | Objetivo: ${objetivoValue} | Edad: ${payload?.Edad} | Altura: ${payload?.Altura}cm | Peso actual: ${payload?.Peso_actual}kg | Peso objetivo: ${payload?.Peso_objetivo}kg

${ejerciciosContexto}`;

	const apiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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

	if (!apiResponse.ok) {
		const errorText = await apiResponse.text();
		throw new Error(`OpenRouter error: ${apiResponse.status} ${errorText}`);
	}

	const data = await apiResponse.json();
	const planText = data.choices?.[0]?.message?.content || "";
	const jsonCandidate = extractLikelyJson(planText);

	let planObj;
	try {
		planObj = JSON.parse(jsonCandidate);
	} catch (e) {
		console.error("=== RAW AI OUTPUT ===", planText);
		console.error("=== JSON CANDIDATE ===", jsonCandidate);
		throw new Error("La IA no devolvió un JSON parseable.");
	}

	planObj = normalizePlanWithSelectedDays({
		planObj,
		idiomaNorm,
		lugar,
		objetivo,
		intensidadNorm,
		ejerciciosPorDiaObjetivo,
		diasSeleccionados,
		ejerciciosSeleccionados,
		catalogFlat
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
