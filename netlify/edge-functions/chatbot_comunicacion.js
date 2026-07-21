const APIkey = Deno.env.get('API_Key_CHTBOT_Plan');

const generateRespCHTBOT = async (payload, request) => {
    const idiomaNorm = String(payload?.idioma ?? "").trim().toLowerCase() === "en" ? "en" : "es";
    const idiomaLabel = idiomaNorm === "en" ? "English" : "Español";

    const contexto_plan_entre = payload?.P_ent;
    const contexto_plan_alim = payload?.P_alim;
    const userData = payload?.D_user || {};
    const consulta = payload?.consulta || "";
    const historial = payload?.historial || [];

    const prompt_restricc = `Eres el entrenador personal del usuario en la aplicación TrAIner. Adopta un tono 100% natural, humano, directo y cercano, como si estuvieras en el gimnasio guiando a tu cliente.
REGLAS OBLIGATORIAS:
1. NUNCA suenes como un bot de atención al cliente (evita introducciones genéricas y robóticas como "Hola, gracias por consultar. Soy el Entrenador IA y solo puedo..."). Ve directo al grano, responde de forma empática y natural.
2. Tu único objetivo es hablar sobre fitness, entrenamiento, rutinas, descanso y nutrición deportiva. Si el usuario pregunta de temas ajenos (política, programación, etc.), desvía la charla con humor hacia el entrenamiento.
3. Basa tus consejos en los datos físicos del usuario y en sus planes actuales, pero menciónalos orgánicamente. NO repitas sus datos en formato de lista a menos que sea estrictamente necesario.
4. Sé conciso y al grano. Usa un lenguaje motivador pero realista.
5. NO alucines ni inventes conceptos médicos.
6. Responde SIEMPRE en el idioma: ${idiomaLabel}.`;

    const prompt_consulta = `--- CONTEXTO DEL USUARIO ---
- Edad: ${userData.edad || 'Desconocida'} años
- Altura: ${userData.altura || 'Desconocida'} cm
- Peso actual: ${userData.peso || 'Desconocido'} kg
- Peso objetivo: ${userData.peso_objetivo || 'Desconocido'} kg

--- PLAN DE ENTRENAMIENTO ACTUAL ---
${contexto_plan_entre && contexto_plan_entre !== "Ninguno" ? JSON.stringify(contexto_plan_entre) : 'Ninguno'}

--- PLAN DE ALIMENTACIÓN ACTUAL ---
${contexto_plan_alim && contexto_plan_alim !== "Ninguno" ? JSON.stringify(contexto_plan_alim) : 'Ninguno'}

--- CONSULTA ACTUAL ---
${consulta}`;

    const origin = request.headers.get("origin") || "";

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
                { role: "system", content: prompt_restricc },
                ...historial,
                { role: "user", content: prompt_consulta }
            ]
        })
    });

    if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        throw new Error(`OpenRouter error: ${apiResponse.status} ${errorText}`);
    }

    const data = await apiResponse.json();
    const respuestaTexto = data.choices?.[0]?.message?.content || "";

    return {
        respuesta: respuestaTexto
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
        const result = await generateRespCHTBOT(payload, request);
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
