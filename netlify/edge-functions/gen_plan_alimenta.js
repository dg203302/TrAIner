const APIkey = Deno.env.get('API_Key_Gen_Plan');
const stripAccents = (s) =>
	String(s ?? "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim();

const extractLikelyJson = (text) => {
	const s = String(text ?? "");
	const unfenced = s
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```\s*$/i, "")
		.trim();

	const firstObj = unfenced.indexOf("{");
	const firstArr = unfenced.indexOf("[");
	if (firstObj === -1 && firstArr === -1) return unfenced;
	const start = firstArr === -1 ? firstObj : firstObj === -1 ? firstArr : Math.min(firstObj, firstArr);
	const lastObj = unfenced.lastIndexOf("}");
	const lastArr = unfenced.lastIndexOf("]");
	const end = Math.max(lastObj, lastArr);
	if (end <= start) return unfenced;
	return unfenced.slice(start, end + 1);
};

const safeJsonParse = (value) => {
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
};

const normalizeObjetivo = (value) => {
	const v = stripAccents(value).toLowerCase();
	if (v.includes("perd") || v.includes("grasa") || v.includes("defin")) return "perder grasa";
	if (v.includes("masa") || v.includes("mus") || v.includes("gan")) return "ganar masa muscular";
	if (v.includes("mant")) return "mantener peso";
	return "mantener peso";
};

const normalizeIntensidad = (value) => {
	const v = stripAccents(value).toLowerCase();
	if (v.includes("baj")) return "baja";
	if (v.includes("alt")) return "alta";
	if (v.includes("med")) return "media";
	return "media";
};

const mealsFromIntensidad = (intensidad) => ({ baja: 3, media: 4, alta: 5 })[intensidad] ?? 4;

const validatePlanShape = (obj) => {
	if (!obj || typeof obj !== "object") return "Root debe ser un objeto";
	const root = obj.plan_alimentacion;
	if (!root || typeof root !== "object") return "Falta plan_alimentacion";

	const usuario = root.usuario;
	if (!usuario || typeof usuario !== "object") return "Falta usuario";
	const requiredUsuario = ["edad", "estatura_cm", "peso_actual_kg", "peso_objetivo_kg", "objetivo", "intensidad"];
	for (const k of requiredUsuario) {
		if (!(k in usuario)) return `Falta usuario.${k}`;
	}

	const semanal = root.configuracion_semanal;
	if (!Array.isArray(semanal)) return "Falta configuracion_semanal (array)";
	if (semanal.length !== 7) return "configuracion_semanal debe tener 7 días";

	for (const dia of semanal) {
		if (!dia || typeof dia !== "object") return "Cada día debe ser un objeto";
		if (typeof dia.dia !== "string" || !dia.dia.trim()) return "Cada día debe tener dia (string)";
		if (typeof dia.calorias_objetivo !== "number" || Number.isNaN(dia.calorias_objetivo)) {
			return "Cada día debe tener calorias_objetivo (number)";
		}
		if (!Array.isArray(dia.comidas) || dia.comidas.length < 1) return "Cada día debe tener comidas (array)";
		for (const c of dia.comidas) {
			if (!c || typeof c !== "object") return "Cada comida debe ser un objeto";
			if (typeof c.nombre !== "string" || !c.nombre.trim()) return "Cada comida debe tener nombre (string)";
			if (typeof c.descripcion !== "string" || !c.descripcion.trim()) return "Cada comida debe tener descripcion (string)";
		}
		const macros = dia.macros_porcentaje;
		if (!macros || typeof macros !== "object") return "Cada día debe tener macros_porcentaje (object)";
		const keys = ["carbohidratos", "proteinas", "grasas"];
		for (const k of keys) {
			if (typeof macros[k] !== "number" || Number.isNaN(macros[k])) return `macros_porcentaje.${k} debe ser number`;
		}
		if (!Array.isArray(dia.recomendaciones_alimentos)) return "Cada día debe tener recomendaciones_alimentos (array)";
		if (!Array.isArray(dia.tips)) return "Cada día debe tener tips (array)";
	}

	return null;
};

const ALL_DIAS_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const ALL_DIAS_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DAY_INDEX_BY_NAME = {
	// Spanish (stripAccents)
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
	// Common abbreviations
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

const normalizePlanDays = ({ parsed, idiomaNorm, objetivoPrompt, intensidadPrompt }) => {
	if (!parsed || typeof parsed !== "object") return parsed;
	const root = parsed.plan_alimentacion;
	if (!root || typeof root !== "object") return parsed;
	const semanal = Array.isArray(root.configuracion_semanal) ? root.configuracion_semanal : null;
	if (!semanal || semanal.length !== 7) return parsed;

	const ALL_DIAS = idiomaNorm === "en" ? ALL_DIAS_EN : ALL_DIAS_ES;
	const byIdx = new Map();
	for (const d of semanal) {
		if (!d || typeof d !== "object") continue;
		const idx = getDayIndexFromName(d.dia);
		if (idx == null) continue;
		byIdx.set(idx, d);
	}

	if (byIdx.size === 7) {
		root.configuracion_semanal = ALL_DIAS.map((label, idx) => {
			const d = byIdx.get(idx);
			return { ...d, dia: label };
		});
	} else {
		root.configuracion_semanal = semanal.map((d, idx) => ({ ...d, dia: ALL_DIAS[idx] }));
	}

	root.usuario = root.usuario && typeof root.usuario === "object" ? root.usuario : {};
	root.usuario.objetivo = objetivoPrompt;
	root.usuario.intensidad = intensidadPrompt;
	return parsed;
};

const generatePlanAlimenta = async (payload, request) => {
	const idiomaNorm = String(payload?.idioma ?? "").trim().toLowerCase() === "en" ? "en" : "es";
	const t = (es, en) => (idiomaNorm === "en" ? en : es);

	const objetivoNorm = normalizeObjetivo(payload?.objetivo);
	const intensidadNorm = normalizeIntensidad(payload?.intensidad);
	const mealsPerDay = mealsFromIntensidad(intensidadNorm);

	const objetivoPrompt = (() => {
		if (objetivoNorm === "perder grasa") return t("Perder grasa", "Lose fat");
		if (objetivoNorm === "ganar masa muscular") return t("Ganar masa muscular", "Gain muscle");
		return t("Mantener peso", "Maintain weight");
	})();

	const intensidadPrompt = (() => {
		if (intensidadNorm === "baja") return t("baja", "low");
		if (intensidadNorm === "alta") return t("alta", "high");
		return t("media", "medium");
	})();

	const ALL_DIAS = idiomaNorm === "en" ? ALL_DIAS_EN : ALL_DIAS_ES;
	const schemaMeals = Array.from({ length: mealsPerDay }, () =>
		`{"nombre":"<string>","descripcion":"<string>","calorias_aprox":500}`
	).join(",");
	const schemaDays = ALL_DIAS.map(
		(d) =>
			`        {"dia":"${d}","calorias_objetivo":2000,"comidas":[${schemaMeals}],"macros_porcentaje":{"carbohidratos":40,"proteinas":30,"grasas":30},"recomendaciones_alimentos":["<string>"],"tips":["<string>"]}`
	).join(",\n");

	const Edad = payload?.Edad;
	const Altura = payload?.Altura;
	const Peso_actual = payload?.Peso_actual;
	const Peso_objetivo = payload?.Peso_objetivo;

	const prompt = idiomaNorm === "en"
		? `Return ONLY valid JSON (RFC 8259).
FORBIDDEN: extra text, markdown, code blocks, comments, trailing commas.

Generate a 7-day weekly meal plan in strict JSON.
Requirements:
- Language for ALL TEXT VALUES: English.
- Keep ALL JSON KEYS exactly as the schema (do not translate keys).
- Person data: edad=${Edad}, estatura_cm=${Altura}, peso_actual_kg=${Peso_actual}, peso_objetivo_kg=${Peso_objetivo}.
- Goal: "${objetivoPrompt}".
- Intensity: "${intensidadPrompt}". This defines meals per day: ${mealsPerDay}.
- For each weekday (use EXACTLY these names and in this order): ${ALL_DIAS.join(", ")}
  include:
  - calorias_objetivo (integer)
  - comidas: array of ${mealsPerDay} meals. Each meal: nombre, descripcion, calorias_aprox (optional integer).
  - macros_porcentaje: { carbohidratos: number, proteinas: number, grasas: number } (sum to 100).
  - recomendaciones_alimentos: array of strings
  - tips: array of strings

Return exactly this root structure:
{
  "plan_alimentacion": {
	"usuario": {
	  "edad": number,
	  "estatura_cm": number,
	  "peso_actual_kg": number,
	  "peso_objetivo_kg": number,
	  "objetivo": string,
	  "intensidad": string
	},
	"configuracion_semanal": [
${schemaDays}
	],
	"nota_general": string
  }
}
Do not add any text outside the JSON.`
		: `Devuelve UNICAMENTE un JSON válido (RFC 8259).
PROHIBIDO: texto extra, markdown, bloques de código, comentarios, comas finales.

Generá un plan de alimentación semanal (7 días) en formato JSON estricto.
Requisitos:
- Idioma de los VALORES de texto: Español.
- Mantén las CLAVES JSON exactamente como el esquema (no traduzcas claves).
- Debe estar pensado para una persona con estos datos: edad=${Edad}, estatura_cm=${Altura}, peso_actual_kg=${Peso_actual}, peso_objetivo_kg=${Peso_objetivo}.
- Objetivo del plan: "${objetivoPrompt}".
- Intensidad del plan: "${intensidadPrompt}". Esto define la cantidad de comidas por día: ${mealsPerDay}.
- Para cada día de la semana (usa EXACTAMENTE estos nombres y en este orden): ${ALL_DIAS.join(", ")}
  incluir:
  - calorias_objetivo (número entero)
  - comidas: array de ${mealsPerDay} comidas. Cada comida con: nombre, descripcion, calorias_aprox (número entero opcional).
  - macros_porcentaje: { carbohidratos: number, proteinas: number, grasas: number } (porcentajes que sumen 100).
  - recomendaciones_alimentos: array de strings
  - tips: array de strings

Devolver exactamente con esta estructura raíz:
{
  "plan_alimentacion": {
	"usuario": {
	  "edad": number,
	  "estatura_cm": number,
	  "peso_actual_kg": number,
	  "peso_objetivo_kg": number,
	  "objetivo": string,
	  "intensidad": string
	},
	"configuracion_semanal": [
${schemaDays}
	],
	"nota_general": string
  }
}
No agregues texto fuera del JSON.`;

	const origin = request?.headers?.get("origin") || request?.headers?.get("referer") || "https://aipersonaltrainer.netlify.app";
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
	const text = data.choices?.[0]?.message?.content || "";

	const extracted = extractLikelyJson(text);
	let parsed = safeJsonParse(extracted);
	
	if (!parsed) {
		console.error("=== RAW AI OUTPUT ===", text);
		console.error("=== JSON CANDIDATE ===", extracted);
		throw new Error("La IA no devolvió un JSON parseable.");
	}
	
	parsed = normalizePlanDays({ parsed, idiomaNorm, objetivoPrompt, intensidadPrompt });
	const validationError = validatePlanShape(parsed);
	if (validationError) {
		throw new Error(`Respuesta IA inválida: ${validationError}`);
	}

	return parsed;
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
		const result = await generatePlanAlimenta(payload, request);
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
