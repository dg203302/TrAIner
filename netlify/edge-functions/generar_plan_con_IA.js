import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.94.1/+esm";


const supabaseUrl = "https://lhecmoeilmhzgxpcetto.supabase.co";
const supabaseKey = Deno.env.get('API_Key_Supabase');
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
};

const extractLikelyJson = (text) => {
    const s = String(text ?? "").trim();
    // Remove ```json fences if present
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

export default async function handler(request, _context){
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
    
    const { id_usuario, plan_entreno } = payload;
    if (!id_usuario) {
        return new Response(JSON.stringify({ error: "Missing id_usuario" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (!plan_entreno) {
        return new Response(JSON.stringify({ error: "Missing plan_entreno" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    let planObj;
    try {
        planObj = typeof plan_entreno === "string" ? JSON.parse(extractLikelyJson(plan_entreno)) : plan_entreno;
    } catch {
        return new Response(JSON.stringify({ error: "plan_entreno no es JSON válido" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }

    const validationError = validatePlanShape(planObj);
    if (validationError) {
        return new Response(JSON.stringify({ error: `plan_entreno inválido: ${validationError}` }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }

    const plan_entreno_to_store = JSON.stringify(planObj);

    try {
        const { data } = await supabase.from("Planes").select("*").eq("ID_user", id_usuario).single();
        if (data) {
            const { error } = await supabase.from("Planes").update({
                Plan_entreno: plan_entreno_to_store,
            }).eq("ID_user", id_usuario);
            if (error) throw new Error(error.message);
            return new Response(JSON.stringify({ plan_entreno: plan_entreno_to_store }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }
    } catch {
        // ignore; if not found, insert below
    }

    try {
        const { error2 } = await supabase.from("Planes").insert({
            Plan_entreno: plan_entreno_to_store,
            Plan_alimenta: "Proximamente",
            ID_user: id_usuario,
        });
        if (error2) throw new Error(error2.message);
        return new Response(JSON.stringify({ plan_entreno: plan_entreno_to_store }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        console.log(error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
}