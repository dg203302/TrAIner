const fs = require('fs');

const db = JSON.parse(fs.readFileSync('./Datos/entrenamientos.json', 'utf8'));

function generateFallbackPlan({ dias, lugar, objetivo, intensidad, ejerciciosPorDia, altura, peso, pesoObj, edad }) {
    const DIAS_CANONICOS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const DIAS_MAP = { "L": "Lunes", "M": "Martes", "X": "Miércoles", "J": "Jueves", "V": "Viernes", "S": "Sábado", "D": "Domingo" };
    const diasSeleccionadosNombres = dias.map(d => DIAS_MAP[d] || d);

    // Splits recomendados según cantidad de días
    const splitsPorCantidad = {
        1: [
            { enfoque: "Full Body / Cuerpo Completo", grupos: ["Pecho", "Espalda", "Piernas", "Hombros", "Brazos", "Abdomen / core"] }
        ],
        2: [
            { enfoque: "Torso Superior", grupos: ["Pecho", "Espalda", "Hombros", "Brazos", "Tríceps"] },
            { enfoque: "Pierna y Core", grupos: ["Piernas", "Abdomen / core", "Piernas", "Cardio / acondicionamiento"] }
        ],
        3: [
            { enfoque: "Empuje (Pecho, Hombro y Tríceps)", grupos: ["Pecho", "Hombros", "Tríceps", "Pecho"] },
            { enfoque: "Tirón (Espalda y Bíceps)", grupos: ["Espalda", "Brazos", "Espalda", "Antebrazos"] },
            { enfoque: "Pierna y Abdomen", grupos: ["Piernas", "Piernas", "Abdomen / core"] }
        ],
        4: [
            { enfoque: "Torso Fuerza (Pecho y Espalda)", grupos: ["Pecho", "Espalda", "Pecho", "Espalda"] },
            { enfoque: "Pierna y Abdomen", grupos: ["Piernas", "Piernas", "Abdomen / core"] },
            { enfoque: "Torso Hipertrofia (Hombros y Brazos)", grupos: ["Hombros", "Brazos", "Tríceps", "Hombros"] },
            { enfoque: "Pierna y Glúteos", grupos: ["Piernas", "Piernas", "Abdomen / core"] }
        ],
        5: [
            { enfoque: "Pecho y Tríceps", grupos: ["Pecho", "Tríceps", "Pecho", "Hombros"] },
            { enfoque: "Espalda y Bíceps", grupos: ["Espalda", "Brazos", "Espalda", "Antebrazos"] },
            { enfoque: "Piernas (Enfoque Cuádriceps)", grupos: ["Piernas", "Piernas", "Abdomen / core"] },
            { enfoque: "Hombros y Core", grupos: ["Hombros", "Abdomen / core", "Hombros"] },
            { enfoque: "Pierna Posterior y Brazos", grupos: ["Piernas", "Brazos", "Tríceps"] }
        ],
        6: [
            { enfoque: "Empuje A (Pecho y Tríceps)", grupos: ["Pecho", "Hombros", "Tríceps"] },
            { enfoque: "Tirón A (Espalda y Bíceps)", grupos: ["Espalda", "Brazos", "Antebrazos"] },
            { enfoque: "Pierna A (Cuádriceps)", grupos: ["Piernas", "Piernas", "Abdomen / core"] },
            { enfoque: "Empuje B (Hombro y Pecho)", grupos: ["Hombros", "Pecho", "Tríceps"] },
            { enfoque: "Tirón B (Espalda dorsal)", grupos: ["Espalda", "Brazos", "Abdomen / core"] },
            { enfoque: "Pierna B (Cadena posterior)", grupos: ["Piernas", "Piernas", "Cardio / acondicionamiento"] }
        ],
        7: [
            { enfoque: "Empuje A", grupos: ["Pecho", "Hombros", "Tríceps"] },
            { enfoque: "Tirón A", grupos: ["Espalda", "Brazos", "Antebrazos"] },
            { enfoque: "Pierna A", grupos: ["Piernas", "Piernas", "Abdomen / core"] },
            { enfoque: "Empuje B", grupos: ["Hombros", "Pecho", "Tríceps"] },
            { enfoque: "Tirón B", grupos: ["Espalda", "Brazos", "Abdomen / core"] },
            { enfoque: "Pierna B", grupos: ["Piernas", "Piernas", "Abdomen / core"] },
            { enfoque: "Acondicionamiento y Core", grupos: ["Cardio / acondicionamiento", "Abdomen / core", "Piernas"] }
        ]
    };

    const numDias = Math.min(Math.max(diasSeleccionadosNombres.length, 1), 7);
    const splitSeleccionado = splitsPorCantidad[numDias] || splitsPorCantidad[3];

    // Helper para filtrar ejercicios según entorno (casa vs gimnasio)
    const isCasa = (lugar || "").toLowerCase().includes("casa");
    const repsTarget = objetivo === "grasa" ? "12-15" : (intensidad === "alta" ? "6-10" : "8-12");
    const seriesTarget = intensidad === "alta" ? 4 : (intensidad === "baja" ? 3 : 4);
    const descansoSec = objetivo === "fuerza" ? 120 : 90;

    let diaSplitIdx = 0;
    const configuracion_semanal = DIAS_CANONICOS.map(diaNombre => {
        const estaSeleccionado = diasSeleccionadosNombres.includes(diaNombre);
        if (!estaSeleccionado) {
            return {
                dia: diaNombre,
                enfoque: "Descanso activo / Recuperación",
                ejercicios: []
            };
        }

        const diaSplit = splitSeleccionado[diaSplitIdx % splitSeleccionado.length];
        diaSplitIdx++;

        const ejerciciosDia = [];
        const gruposTarget = diaSplit.grupos;
        const usedNames = new Set();

        let gIdx = 0;
        while (ejerciciosDia.length < ejerciciosPorDia) {
            const grupoName = gruposTarget[gIdx % gruposTarget.length];
            gIdx++;

            const poolGrupo = db[grupoName] || [];
            let candidatos = poolGrupo.filter(ex => {
                if (usedNames.has(ex.nombre)) return false;
                if (isCasa) {
                    const norm = ex.nombre.toLowerCase();
                    if (norm.includes("polea") || norm.includes("maquina") || norm.includes("prensa") || norm.includes("predicador")) {
                        return false;
                    }
                }
                return true;
            });

            if (candidatos.length === 0) {
                // fallback general si se agotaron
                candidatos = poolGrupo.filter(ex => !usedNames.has(ex.nombre));
            }

            if (candidatos.length > 0) {
                const elegido = candidatos[Math.floor(Math.random() * candidatos.length)];
                usedNames.add(elegido.nombre);
                ejerciciosDia.push({
                    nombre: elegido.nombre,
                    series: seriesTarget,
                    repeticiones: repsTarget,
                    descanso_segundos: descansoSec,
                    descripcion: elegido.descripcion || "Ejecutar con rango de movimiento completo y control excéntrico.",
                    tecnica: elegido.descripcion_detallada || elegido.descripcion || "Controlar la respiración y mantener postura firme.",
                    sobrecarga: "Aumentar 1-2 repeticiones o 2.5 kg al dominar todas las series.",
                    respiracion: "Inhalar en fase excéntrica y exhalar en concéntrica.",
                    gifUrl: elegido.gifUrl || ""
                });
            } else {
                break;
            }
        }

        return {
            dia: diaNombre,
            enfoque: diaSplit.enfoque,
            ejercicios: ejerciciosDia
        };
    });

    return {
        plan_entrenamiento_hipertrofia: {
            usuario: {
                edad: Number(edad) || 25,
                estatura_cm: Number(altura) || 175,
                peso_actual_kg: Number(peso) || 70,
                peso_objetivo_kg: Number(pesoObj) || 75,
                entorno: lugar || "gimnasio",
                objetivo: objetivo || "musculo",
                intensidad: intensidad || "media",
                ejercicios_por_dia: ejerciciosPorDia
            },
            configuracion_semanal,
            progresion_sugerida: {
                metodo: "Sobrecarga progresiva inteligente",
                descripcion: "Incrementa de 1 a 2 repeticiones por serie o añade 2.5 kg en ejercicios compuestos una vez alcances el rango superior con técnica perfecta."
            }
        }
    };
}

const plan = generateFallbackPlan({
    dias: ["L", "X", "V"],
    lugar: "gimnasio",
    objetivo: "musculo",
    intensidad: "media",
    ejerciciosPorDia: 6,
    altura: "175",
    peso: "78",
    pesoObj: "82",
    edad: "26"
});

console.log("Dias con ejercicios:", plan.plan_entrenamiento_hipertrofia.configuracion_semanal.filter(d => d.ejercicios.length > 0).map(d => ({ dia: d.dia, enfoque: d.enfoque, numEjercicios: d.ejercicios.length })));
console.log("Ejercicios dia Lunes:", plan.plan_entrenamiento_hipertrofia.configuracion_semanal[0].ejercicios.map(e => e.nombre));
