import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.94.1/+esm";
import { initPlanAlimentacion } from "./Alimentacion.js";

const supabaseUrl = "https://lhecmoeilmhzgxpcetto.supabase.co";
const supabaseKey = "sb_publishable_oLC8LcDLa3jR72Hpd_jJsA_eXjMlP3-";
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: false, storage: localStorage } });

const updateFixedChromeHeights = () => {
    const header = document.querySelector("header");
    const footer = document.querySelector("footer");
    const root = document.documentElement;
    if (header) root.style.setProperty("--header-fixed", `${header.offsetHeight}px`);
    if (footer) root.style.setProperty("--footer-fixed", `${footer.offsetHeight}px`);
};

const initFixedChromeObservers = () => {
    updateFixedChromeHeights();
    if ("ResizeObserver" in window) {
        const ro = new ResizeObserver(() => updateFixedChromeHeights());
        const header = document.querySelector("header");
        const footer = document.querySelector("footer");
        if (header) ro.observe(header);
        if (footer) ro.observe(footer);
    } else {
        window.addEventListener("resize", updateFixedChromeHeights, { passive: true });
    }
};

// Wake Lock (evita que la pantalla se bloquee mientras se está viendo el plan)
// Nota: requiere HTTPS y soporte del navegador (Chromium/Android suele soportarlo).
const wakeLockManager = (() => {
    /** @type {any|null} */
    let sentinel = null;
    /** @type {Set<string>} */
    const reasons = new Set();

    const supported = () => {
        try {
            return typeof navigator !== "undefined" && !!navigator.wakeLock && typeof navigator.wakeLock.request === "function";
        } catch {
            return false;
        }
    };

    const wanted = () => reasons.size > 0;

    const requestIfNeeded = async () => {
        if (!supported()) return;
        if (!wanted()) return;
        if (document.visibilityState !== "visible") return;
        if (sentinel) return;

        try {
            sentinel = await navigator.wakeLock.request("screen");
            // Si el sistema lo libera, intentamos recuperarlo cuando corresponda.
            if (sentinel && typeof sentinel.addEventListener === "function") {
                sentinel.addEventListener("release", () => {
                    sentinel = null;
                });
            }
        } catch (e) {
            // Puede fallar por falta de gesto del usuario, contexto inseguro, etc.
            sentinel = null;
        }
    };

    const releaseIfPossible = async () => {
        if (!sentinel) return;
        try {
            await sentinel.release();
        } catch {
            // ignore
        } finally {
            sentinel = null;
        }
    };

    const setReason = (reason, isActive, { tryRequest = false } = {}) => {
        const key = String(reason || "").trim() || "default";
        if (isActive) reasons.add(key);
        else reasons.delete(key);

        if (!wanted()) {
            void releaseIfPossible();
            return;
        }
        if (tryRequest) void requestIfNeeded();
    };

    // Re-adquirir al volver a primer plano.
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            void requestIfNeeded();
        } else {
            // En segundo plano liberamos para evitar errores en algunos navegadores.
            void releaseIfPossible();
        }
    });

    return {
        supported,
        setReason,
        requestIfNeeded,
        releaseIfPossible,
    };
})();

const initWakeLockForPlanViews = () => {
    const planEl = document.getElementById("Plan_ejercicio");
    if (!planEl) return;
    if (planEl.dataset.wakeLockInit === "1") return;
    planEl.dataset.wakeLockInit = "1";

    const isPlanVisible = () => {
        // Consideramos visible si no está display:none y está en layout.
        if (planEl.style.display === "none") return false;
        return !!planEl.offsetParent;
    };

    const syncPlanReason = ({ tryRequest = false } = {}) => {
        const visible = isPlanVisible();
        wakeLockManager.setReason("plan", visible, { tryRequest });
    };

    // Estado inicial
    syncPlanReason({ tryRequest: false });

    // Si cambia el display del contenedor (por generar/eliminar plan), sincronizamos.
    if ("MutationObserver" in window) {
        const mo = new MutationObserver(() => syncPlanReason({ tryRequest: false }));
        mo.observe(planEl, { attributes: true, attributeFilter: ["style", "class"] });
    }

    // Primer gesto del usuario dentro del plan: intentar adquirir.
    const tryAcquireOnGesture = () => {
        if (!isPlanVisible()) return;
        syncPlanReason({ tryRequest: true });
        void wakeLockManager.requestIfNeeded();
    };

    planEl.addEventListener("pointerdown", tryAcquireOnGesture, { passive: true });
    planEl.addEventListener("touchstart", tryAcquireOnGesture, { passive: true });
    planEl.addEventListener("wheel", tryAcquireOnGesture, { passive: true });
    planEl.addEventListener("scroll", tryAcquireOnGesture, { passive: true });
    planEl.addEventListener("keydown", tryAcquireOnGesture);
};


if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFixedChromeObservers, { once: true });
} else {
    initFixedChromeObservers();
}

const canUseBottomSheet = () => {
    try {
        return !!globalThis.PTBottomSheet && typeof globalThis.PTBottomSheet.open === "function";
    } catch {
        return false;
    }
};

const closeBottomSheetSafe = () => {
    try {
        globalThis.PTBottomSheet?.close?.();
    } catch {
        // ignore
    }
};

const openStatusSheet = async ({ title, message, html, stacked = false } = {}) => {
    const safeTitle = String(title || "");
    const safeMessage = String(message || "");
    const safeHtml = html != null ? String(html) : null;

    if (canUseBottomSheet()) {
        await globalThis.PTBottomSheet.open({
            title: safeTitle,
            ariaLabel: safeTitle,
            html:
                safeHtml ??
                `
                    <div class="pt-status">
                        <div class="pt-status-row">
                            <div class="pt-status-text">${escapeHtml(safeMessage)}</div>
                        </div>
                        <div class="pt-status-actions">
                            <button type="button" class="btn-primary" data-pt-close>${escapeHtml(tLang("Listo", "Done"))}</button>
                        </div>
                    </div>
                `,
            showClose: false,
            showHandle: true,
            allowOutsideClose: true,
            allowEscapeClose: true,
            allowDragClose: true,
            stack: !!stacked,
            didOpen: (sheet) => {
                sheet.querySelector("[data-pt-close]")?.addEventListener("click", () => closeBottomSheetSafe());
                try { globalThis.UIIdioma?.translatePage?.(sheet); } catch { }
            },
        });
        return;
    }

    // Fallback nativo (sin SweetAlert)
    try {
        const msg = [safeTitle, safeMessage].filter(Boolean).join("\n\n");
        if (msg) window.alert(msg);
    } catch {
        // ignore
    }
};

const openConfirmSheet = async ({ title, message, confirmText, cancelText } = {}) => {
    const safeTitle = String(title || tLang("Confirmar", "Confirm"));
    const safeMessage = String(message || "");
    const okText = String(confirmText || tLang("Aceptar", "OK"));

    if (!canUseBottomSheet()) {
        try {
            return window.confirm([safeTitle, safeMessage].filter(Boolean).join("\n\n"));
        } catch {
            return false;
        }
    }

    return await new Promise((resolve) => {
        let resolved = false;
        const safeResolve = (v) => {
            if (resolved) return;
            resolved = true;
            resolve(!!v);
        };

        void globalThis.PTBottomSheet.open({
            title: safeTitle,
            ariaLabel: safeTitle,
            html: `
                <div class="pt-status">
                    <div class="pt-status-row">
                        <div class="pt-status-text">${escapeHtml(safeMessage)}</div>
                    </div>
                    <div class="pt-status-actions">
                        <button type="button" class="btn-primary" data-pt-confirm>${escapeHtml(okText)}</button>
                    </div>
                </div>
            `,
            showClose: false,
            showHandle: true,
            allowOutsideClose: true,
            allowEscapeClose: true,
            allowDragClose: true,
            didOpen: (sheet) => {
                try { globalThis.UIIdioma?.translatePage?.(sheet); } catch { }
                sheet.querySelector("[data-pt-confirm]")?.addEventListener("click", () => {
                    safeResolve(true);
                    closeBottomSheetSafe();
                });
            },
            willClose: () => safeResolve(false),
        });
    });
};

const getIdiomaPreferido = () => {
    try {
        const v = globalThis.UIIdioma?.getIdioma?.();
        if (v) return String(v);
    } catch {
        // ignore
    }
    try {
        const stored = localStorage.getItem("ui_idioma");
        if (stored) return String(stored);
    } catch {
        // ignore
    }
    return "es";
};

const isEnglish = () => getIdiomaPreferido() === "en";
const tLang = (es, en) => (isEnglish() ? en : es);

const getGreetingByHour = (hour) => {
    const h = Number.isFinite(Number(hour)) ? Number(hour) : new Date().getHours();
    // Rango simple y predecible:
    // 05:00–11:59 -> día | 12:00–19:59 -> tarde | 20:00–04:59 -> noche
    const isMorning = h >= 5 && h < 12;
    const isAfternoon = h >= 12 && h < 20;

    if (isEnglish()) {
        if (isMorning) return "Good morning";
        if (isAfternoon) return "Good afternoon";
        return "Good evening";
    }

    if (isMorning) return "Buenos días";
    if (isAfternoon) return "Buenas tardes";
    return "Buenas noches";
};

const getNextGreetingChangeDelayMs = () => {
    const now = new Date();
    const h = now.getHours();
    const next = new Date(now);
    // Próximos cortes: 05:00, 12:00, 20:00
    const setTo = (hour) => {
        next.setHours(hour, 0, 5, 0); // +5s para evitar edge en cambio exacto
    };

    if (h < 5) setTo(5);
    else if (h < 12) setTo(12);
    else if (h < 20) setTo(20);
    else {
        // mañana a las 05:00
        next.setDate(next.getDate() + 1);
        setTo(5);
    }
    return Math.max(5_000, next.getTime() - now.getTime());
};

const initDynamicGreeting = () => {
    const welcomeEl = document.getElementById("welcome_msg");
    if (!welcomeEl) return;

    const sync = () => {
        welcomeEl.textContent = getGreetingByHour(new Date().getHours());
    };

    sync();
    // Re-sincronizar justo cuando cambia el rango (mañana/tarde/noche).
    window.setTimeout(function tick() {
        sync();
        window.setTimeout(tick, getNextGreetingChangeDelayMs());
    }, getNextGreetingChangeDelayMs());
};

const formatPlanLugar = (code) => {
    const v = String(code ?? "").toLowerCase();
    if (isEnglish()) {
        if (v === "casa") return "Home";
        if (v === "gimnasio") return "Gym";
        return code ?? "-";
    }
    if (v === "casa") return "Casa";
    if (v === "gimnasio") return "Gimnasio";
    return code ?? "-";
};

const formatPlanObjetivo = (code) => {
    const v = String(code ?? "").toLowerCase();
    if (isEnglish()) {
        if (v === "grasa") return "Fat loss";
        if (v === "musculo") return "Muscle gain";
        return code ?? "-";
    }
    if (v === "grasa") return "Pérdida de grasa";
    if (v === "musculo") return "Ganancia muscular";
    return code ?? "-";
};

const formatPlanIntensidad = (code) => {
    const v = String(code ?? "").toLowerCase();
    if (isEnglish()) {
        if (v === "baja") return "Low";
        if (v === "media") return "Medium";
        if (v === "alta") return "High";
        return code ?? "-";
    }
    if (v === "baja") return "Baja";
    if (v === "media") return "Media";
    if (v === "alta") return "Alta";
    return code ?? "-";
};

const stripAccents = (s) =>
    String(s ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

const normalizeExerciseKey = (name) =>
    stripAccents(name)
        .toLowerCase()
        .replace(/[_.,;:!?¡¿"'`()\[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const titleCaseEn = (s) => {
    const small = new Set(["and", "or", "with", "to", "of", "the", "a", "an", "in", "on", "at", "by"]);
    const words = String(s ?? "")
        .split(/\s+/)
        .filter(Boolean);
    return words
        .map((w, i) => {
            const low = w.toLowerCase();
            if (i !== 0 && small.has(low)) return low;
            return low.charAt(0).toUpperCase() + low.slice(1);
        })
        .join(" ");
};

const EXERCISE_NAME_MAP_ES_EN = {
    // Pierna / lower
    "sentadilla": "Squat",
    "sentadilla goblet": "Goblet Squat",
    "sentadilla frontal": "Front Squat",
    "sentadilla hack": "Hack Squat",
    "sentadilla bulgara": "Bulgarian Split Squat",
    "zancadas": "Lunges",
    "prensa de piernas": "Leg Press",
    "extension de piernas": "Leg Extension",
    "curl femoral": "Leg Curl",
    "peso muerto": "Deadlift",
    "peso muerto rumano": "Romanian Deadlift",

    // Índice (frases completas) / index (full phrases)
    // Pecho
    "press de banca plano con barra": "Barbell Bench Press",
    "press de banca inclinado con barra": "Incline Barbell Bench Press",
    "press de banca inclinado con mancuernas": "Incline Dumbbell Bench Press",
    "flexiones de brazos peso corporal": "Push-Ups (Bodyweight)",
    "aperturas con mancuernas": "Dumbbell Flyes",
    "fondos en paralelas": "Parallel Bar Dips",
    "fondos en paralelas pecho bajo triceps": "Parallel Bar Dips",
    "cruce de poleas": "Cable Crossover",

    // Espalda
    "dominadas peso corporal": "Pull-Ups (Bodyweight)",
    "jalon al pecho en polea": "Lat Pulldown",
    "remo con barra": "Barbell Row",
    "remo unilateral con mancuerna": "One-Arm Dumbbell Row",
    "remo sentado en polea": "Seated Cable Row",
    "pull over con mancuerna": "Dumbbell Pullover",
    "remo en t": "T-Bar Row",
    "hiperextensiones lumbares": "Back Extensions",

    // Piernas
    "sentadilla libre": "Back Squat",
    "zancadas estocadas": "Lunges",
    "hip thrust empuje de cadera": "Hip Thrust",
    "extension de cuadriceps en maquina": "Leg Extension Machine",
    "curl femoral tumbado o sentado": "Leg Curl (Lying or Seated)",
    "elevacion de talones": "Calf Raises",
    "peso muerto sumo con barra": "Barbell Sumo Deadlift",
    "step ups con mancuernas": "Dumbbell Step-Ups",

    // Hombros
    "press militar con barra o mancuernas": "Overhead Press (Barbell or Dumbbells)",
    "elevaciones laterales con mancuernas": "Dumbbell Lateral Raises",
    "pajaros vuelos posteriores": "Rear Delt Flyes",
    "elevaciones frontales": "Front Raises",
    "face pull salud del hombro": "Face Pull",
    "press arnold": "Arnold Press",
    "encogimientos de hombros con barra reversa": "Reverse Barbell Shrug",

    // Brazos / tríceps
    "curl de biceps con barra": "Barbell Biceps Curl",
    "curl martillo con mancuernas": "Dumbbell Hammer Curl",
    "curl predicador": "Preacher Curl",
    "press frances": "French Press (Skull Crushers)",
    "extension de triceps en polea alta": "Triceps Pushdown (High Cable)",
    "extension de triceps con mancuerna sobre la cabeza": "Overhead Dumbbell Triceps Extension",
    "patada de triceps con mancuerna": "Dumbbell Triceps Kickback",
    "fondos entre bancos": "Bench Dips",

    // Antebrazos
    "curl de muneca con barra": "Barbell Wrist Curl",
    "curl de muneca con mancuerna": "Dumbbell Wrist Curl",
    "curl invertido con barra": "Barbell Reverse Curl",
    "farmers walk caminata del granjero": "Farmer's Walk",

    // Abdomen / core
    "plancha abdominal": "Plank",
    "crunch abdominal clasico": "Crunch",
    "elevacion de piernas colgado o en suelo": "Leg Raises (Hanging or Floor)",
    "giros rusos": "Russian Twists",
    "rueda abdominal": "Ab Wheel Rollout",
    "dragon flag": "Dragon Flag",

    // Cardio
    "burpees": "Burpees",
    "saltos de tijera": "Jumping Jacks",
    "salto a la cuerda": "Jump Rope",

    // Empuje / push
    "press de banca": "Bench Press",
    "press banca": "Bench Press",
    "press inclinado": "Incline Press",
    "press militar": "Overhead Press",
    "fondos": "Dips",

    // Tirón / pull
    "dominadas": "Pull-Ups",
    "jalon al pecho": "Lat Pulldown",
    "remo": "Row",
    "remo con barra": "Barbell Row",
    "remo con mancuernas": "Dumbbell Row",

    // Brazos
    "curl de biceps": "Biceps Curl",
    "curl biceps": "Biceps Curl",
    "extension de triceps": "Triceps Extension",

    // Core
    "plancha": "Plank",
    "abdominales": "Abs",
};

const translateExerciseNameToEnglish = (nameEs) => {
    const original = String(nameEs ?? "").trim();
    if (!original) return original;

    const key = normalizeExerciseKey(original);
    if (EXERCISE_NAME_MAP_ES_EN[key]) return EXERCISE_NAME_MAP_ES_EN[key];

    // Best-effort replacements for common patterns.
    let s = stripAccents(original).toLowerCase();
    s = s.replace(/\s+/g, " ").trim();

    const replacements = [
        [/peso muerto rumano/g, "Romanian deadlift"],
        [/peso muerto/g, "deadlift"],
        [/sentadilla bulgara/g, "Bulgarian split squat"],
        [/sentadilla frontal/g, "front squat"],
        [/sentadilla goblet/g, "goblet squat"],
        [/sentadilla hack/g, "hack squat"],
        [/sentadilla/g, "squat"],
        [/prensa de piernas/g, "leg press"],
        [/extension(?:es)? de piernas/g, "leg extension"],
        [/curl femoral/g, "leg curl"],
        [/press de banca/g, "bench press"],
        [/press banca/g, "bench press"],
        [/press militar/g, "overhead press"],
        [/press inclinado/g, "incline press"],
        [/fondos/g, "dips"],
        [/dominadas?/g, "pull-ups"],
        [/jalon(?:es)?(?: al pecho)?/g, "pulldown"],
        [/remo/g, "row"],
        [/elevaciones laterales/g, "lateral raises"],
        [/curl de biceps/g, "biceps curl"],
        [/curl biceps/g, "biceps curl"],
        [/extensiones? de triceps/g, "triceps extensions"],
        [/plancha/g, "plank"],

        // Modifiers / equipment
        [/con mancuernas/g, "with dumbbells"],
        [/con barra/g, "with barbell"],
        [/en maquina/g, "machine"],
        [/en polea/g, "cable"],
        [/inclinado/g, "incline"],
        [/declinado/g, "decline"],
        [/plano/g, "flat"],
    ];

    for (const [re, rep] of replacements) {
        s = s.replace(re, rep);
    }

    s = s.replace(/\s+/g, " ").trim();
    if (!s) return original;
    return titleCaseEn(s);
};

const NETLIFY_EDGE_UNCAUGHT = "uncaught exception during edge function invocation";

const isNetlifyEdgeUncaughtInvocation = (text) =>
    String(text ?? "")
        .toLowerCase()
        .includes(NETLIFY_EDGE_UNCAUGHT);

const callEdgeFunctionJson = async (endpoint, payload) => {
    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const bodyText = await response.text().catch(() => "");
    if (!response.ok) {
        let msg = bodyText;
        try {
            const parsed = JSON.parse(bodyText);
            msg = parsed?.error || parsed?.message || msg;
        } catch {
            // ignore
        }
        const error = new Error(msg || `Request failed (${response.status})`);
        error.response = response;
        error.bodyText = bodyText;
        throw error;
    }

    try {
        return JSON.parse(bodyText);
    } catch {
        return bodyText;
    }
};

const showNetlifyHostingErrorAlert = async ({ endpoint, status, statusText, bodyText }) => {
    const safeEndpoint = String(endpoint ?? "").trim() || tLang("(desconocido)", "(unknown)");
    const safeStatus = Number.isFinite(Number(status)) ? Number(status) : "-";
    const safeStatusText = String(statusText ?? "").trim() || "";
    const safeBody = String(bodyText ?? "").trim();

    const hostingNote = isEnglish()
        ? "This is a hosting server error (<strong>Netlify</strong>). Please wait a few minutes and try again."
        : "Este es un error del servidor de hosting (<strong>Netlify</strong>). Por favor, aguardá unos minutos e intentá nuevamente cuando se restaure el servicio.";

    const sheetHtml = `
        <div class="server-error">
            <div class="server-error__hero">${escapeHtml(NETLIFY_EDGE_UNCAUGHT)}</div>
            <div class="server-error__meta">
                <div><strong>Endpoint:</strong> ${escapeHtml(safeEndpoint)}</div>
                <div><strong>HTTP:</strong> ${escapeHtml(safeStatus)}${safeStatusText ? ` (${escapeHtml(safeStatusText)})` : ""}</div>
            </div>
            ${safeBody ? `<pre class="server-error__body">${escapeHtml(safeBody.slice(0, 1200))}</pre>` : ""}
            <p class="server-error__note">${hostingNote}</p>
            <div class="pt-status-actions">
                <button type="button" class="btn-primary" data-pt-sheet-close>
                    ${escapeHtml(tLang("Entendido", "OK"))}
                </button>
            </div>
        </div>
    `;

    return await window.PTBottomSheet?.open?.({
        title: tLang("Error del servidor", "Server error"),
        subtitle: "Netlify",
        ariaLabel: tLang("Error del servidor", "Server error"),
        html: sheetHtml,
        showClose: false,
        showHandle: false,
        allowOutsideClose: false,
        allowEscapeClose: true,
        allowDragClose: false,
        didOpen: (sheet) => {
            const btn = sheet.querySelector("[data-pt-sheet-close]");
            btn?.addEventListener("click", () => window.PTBottomSheet?.close?.());
        },
    });
};

const username = localStorage.getItem("username_usuario")
const avatar = localStorage.getItem("avatar_usuario")

const EJERCICIOS_INDICE = {
    "Pecho": [
        "Press de banca plano con barra",
        "Press de banca inclinado con barra",
        "Press de banca inclinado con mancuernas",
        "Flexiones de brazos (peso corporal)",
        "Aperturas con mancuernas",
        "Fondos en paralelas (pecho bajo/tríceps)",
        "Cruce de poleas",
    ],
    "Espalda": [
        "Dominadas (peso corporal)",
        "Jalón al pecho en polea",
        "Remo con barra",
        "Remo unilateral con mancuerna",
        "Remo sentado en polea",
        "Pull-over con mancuerna",
        "Remo en T",
        "Hiperextensiones lumbares",
    ],
    "Piernas": [
        "Sentadilla libre",
        "Prensa de piernas",
        "Zancadas / estocadas",
        "Peso muerto rumano",
        "Hip thrust (empuje de cadera)",
        "Extensión de cuádriceps en máquina",
        "Curl femoral tumbado o sentado",
        "Elevación de talones",
        "Sentadilla búlgara",
        "Peso muerto sumo con barra",
        "Step-ups con mancuernas",
    ],
    "Hombros": [
        "Press militar con barra o mancuernas",
        "Elevaciones laterales con mancuernas",
        "Pájaros / vuelos posteriores",
        "Elevaciones frontales",
        "Face pull (salud del hombro)",
        "Press Arnold",
        "Encogimientos de hombros con barra reversa",
    ],
    "Brazos": [
        "Curl de bíceps con barra",
        "Curl martillo con mancuernas",
        "Curl predicador",
        "Fondos entre bancos",
    ],
    "Tríceps": [
        "Press francés",
        "Extensión de triceps en polea alta",
        "Fondos entre bancos",
        "Extensión de tríceps con mancuerna sobre la cabeza",
        "Patada de tríceps con mancuerna",
    ],
    "Antebrazos": [
        "Curl de muñeca con barra",
        "Curl de muñeca con mancuerna",
        "Curl invertido con barra",
        "Farmer's walk (caminata del granjero)",
    ],
    "Abdomen / core": [
        "Plancha abdominal",
        "Crunch abdominal clásico",
        "Elevación de piernas colgado o en suelo",
        "Giros rusos",
        "Rueda abdominal",
        "Dragon flag",
    ],
    "Cardio / acondicionamiento": [
        "Burpees",
        "Saltos de tijera",
        "Salto a la cuerda",
    ],
};

const escapeHtml = (value) => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatReps = (value) => {
    if (value == null) return "-";
    const s = String(value).trim();
    if (!s) return "-";

    // Detect ranges or single values given in seconds (segundos, s, sec)
    const secRange = s.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)[\s]*?(s|seg|segs|segundos|sec|secs)\b/i);
    if (secRange) {
        return `${secRange[1]}-${secRange[2]}S`;
    }
    const secSingle = s.match(/^(\d+(?:\.\d+)?)[\s]*?(s|seg|segs|segundos|sec|secs)\b/i);
    if (secSingle) {
        return `${secSingle[1]}S`;
    }

    // Also normalize common phrasing like '20 - 30 segundos' with spaces
    const secRange2 = s.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
    if (secRange2 && /seg|s|segundos|sec/i.test(s)) {
        return `${secRange2[1]}-${secRange2[2]}S`;
    }

    // Fallback: return as-is
    return s;
};

const renderListaEjerciciosSelectable = () => {
    const grupoLabelMapEn = {
        "Pecho": "Chest",
        "Espalda": "Back",
        "Piernas": "Legs",
        "Hombros": "Shoulders",
        "Brazos": "Arms",
        "Tríceps": "Triceps",
        "Antebrazos": "Forearms",
        "Abdomen / core": "Abs / core",
        "Cardio / acondicionamiento": "Cardio / conditioning",
    };

    const parts = [];
    for (const [grupo, items] of Object.entries(EJERCICIOS_INDICE)) {
        const grupoLabel = isEnglish() ? (grupoLabelMapEn[grupo] || grupo) : grupo;
        const checks = items
            .map((e) => {
                const original = String(e ?? "");
                const label = isEnglish() ? translateExerciseNameToEnglish(original) : original;
                // Mantener el value en español para compatibilidad con selecciones guardadas.
                const safeValue = escapeHtml(original);
                const safeLabel = escapeHtml(label);
                return `
                    <label class="swal-check">
                        <input type="checkbox" name="ejercicios" value="${safeValue}">
                        <span>${safeLabel}</span>
                    </label>
                `;
            })
            .join("");

        parts.push(`
            <details class="swal-details" data-grupo="${escapeHtml(grupo)}">
                <summary>${escapeHtml(grupoLabel)} <span class="swal-chip">${items.length}</span></summary>
                <div class="swal-checklist">
                    ${checks}
                </div>
            </details>
        `);
    }
    return parts.join("\n");
};

const DIAS_SEMANA = [
    { code: "L", label: "L", name: "lunes" },
    { code: "M", label: "M", name: "martes" },
    { code: "X", label: "X", name: "miercoles" },
    { code: "J", label: "J", name: "jueves" },
    { code: "V", label: "V", name: "viernes" },
    { code: "S", label: "S", name: "sabado" },
    { code: "D", label: "D", name: "domingo" },
];

const normalizeDiasSeleccionados = (value) => {
    if (!value) return null;
    try {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        if (!Array.isArray(parsed)) return null;
        const allowed = new Set(DIAS_SEMANA.map((d) => d.code));
        const uniq = [];
        for (const item of parsed) {
            const code = String(item ?? "").toUpperCase();
            if (allowed.has(code) && !uniq.includes(code)) uniq.push(code);
        }
        return uniq;
    } catch {
        return null;
    }
};

const renderDiasSelector = () => {
    const buttons = DIAS_SEMANA.map(
        (d) => `<button type="button" class="swal-dia-btn" data-dia="${escapeHtml(d.code)}" aria-pressed="false">${escapeHtml(d.label)}</button>`
    ).join("");
    return `
        <div class="swal-dias" role="group" aria-label="${escapeHtml(tLang("Días de entrenamiento", "Training days"))}">
            ${buttons}
        </div>
        <p class="swal-helper">${escapeHtml(tLang("Tocá para seleccionar los días en los que vas a entrenar.", "Tap to select the days you plan to train."))}</p>
    `;
};

const renderSelectorIntensidad = () => {
    return `
        <section class="swal-section" aria-label="${escapeHtml(tLang("Intensidad de entrenamiento", "Training intensity"))}">
            <h3>${escapeHtml(tLang("Intensidad", "Intensity"))}</h3>
            <div class="swal-grid">
                <div class="swal-field">
                    <p class="swal-label">${escapeHtml(tLang("Elegí la intensidad", "Choose the intensity"))}</p>
                    <label class="swal-radio"><input type="radio" name="intensidad" value="baja"><span>${escapeHtml(tLang("Intensidad baja", "Low intensity"))}</span></label>
                    <label class="swal-radio"><input type="radio" name="intensidad" value="media"><span>${escapeHtml(tLang("Intensidad media", "Medium intensity"))}</span></label>
                    <label class="swal-radio"><input type="radio" name="intensidad" value="alta"><span>${escapeHtml(tLang("Intensidad alta", "High intensity"))}</span></label>
                    <p class="swal-helper">${escapeHtml(tLang("La intensidad afecta la cantidad de ejercicios por día (baja: 4, media: 6, alta: 8).", "Intensity affects how many exercises you get per day (low: 4, medium: 6, high: 8)."))}</p>
                </div>
            </div>
        </section>
    `;
}

const openGenerarPlanModal = async (planPrevioRaw = null) => {
    const baseLugar = localStorage.getItem("plan_lugar") || "casa";
    const baseObjetivo = localStorage.getItem("plan_objetivo") || "musculo";
    const baseIntensidad = localStorage.getItem("plan_intensidad") || "media";
    const baseDias =
        normalizeDiasSeleccionados(localStorage.getItem("plan_dias")) ||
        ["L", "M", "X", "J", "V"]; // default: lunes a viernes
    const baseEjEnabled = (localStorage.getItem("plan_ejercicios_enabled") || "0") === "1";
    const baseEjSeleccionados = (() => {
        const raw = localStorage.getItem("plan_ejercicios_selected");
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
        } catch {
            return [];
        }
    })();

    const stripAccents = (text) => String(text ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const extractLikelyJson = (text) => {
        const s = String(text ?? "");
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

    const tryParseJson = (value) => {
        if (value == null) return null;
        if (typeof value === "object") return value;
        try {
            return JSON.parse(String(value));
        } catch {
            return null;
        }
    };

    const mapEntornoToLugar = (entorno) => {
        const v = stripAccents(entorno).trim().toLowerCase();
        if (!v) return null;
        if (v.includes("gim")) return "gimnasio";
        if (v.includes("casa") || v.includes("hogar")) return "casa";
        return null;
    };

    const mapObjetivoToCode = (obj) => {
        const v = stripAccents(obj).trim().toLowerCase();
        if (!v) return null;
        if (v.includes("grasa") || v.includes("perdida") || v.includes("defin")) return "grasa";
        if (v.includes("mus") || v.includes("hipert") || v.includes("ganancia")) return "musculo";
        return null;
    };

    const mapDiaToCode = (dia) => {
        const v = stripAccents(dia).trim().toLowerCase();
        if (!v) return null;
        const found = DIAS_SEMANA.find((d) => stripAccents(d.name).toLowerCase() === v);
        return found?.code ?? null;
    };

    const mapIntensidadToCode = (value) => {
        const v = stripAccents(value).trim().toLowerCase();
        if (!v) return null;
        if (v.includes("baj")) return "baja";
        if (v.includes("alt")) return "alta";
        if (v.includes("med")) return "media";
        return null;
    };

    const buildPrefillFromPlanPrevio = (raw) => {
        if (!raw) return null;
        const parsed = tryParseJson(extractLikelyJson(raw)) ?? tryParseJson(raw);
        if (!parsed || typeof parsed !== "object") return null;

        const root =
            parsed.plan_entrenamiento_hipertrofia ??
            parsed.plan_entrenamiento ??
            parsed.plan ??
            parsed;

        const usuario = (root && typeof root === "object") ? (root.usuario ?? root.user ?? null) : null;
        const entorno = usuario?.entorno;
        const objetivo = usuario?.objetivo;
        const intensidadCode = mapIntensidadToCode(usuario?.intensidad);

        const ejerciciosPorDia = Number(usuario?.ejercicios_por_dia);
        const intensidadFromN = Number.isFinite(ejerciciosPorDia)
            ? (ejerciciosPorDia <= 4 ? "baja" : (ejerciciosPorDia <= 6 ? "media" : "alta"))
            : null;

        const lugar = mapEntornoToLugar(entorno);
        const objetivoCode = mapObjetivoToCode(objetivo);

        const config = root?.configuracion_semanal;
        const diasConEjercicios = Array.isArray(config)
            ? config
                .filter((d) => Array.isArray(d?.ejercicios) && d.ejercicios.length > 0)
                .map((d) => mapDiaToCode(d?.dia))
                .filter(Boolean)
            : [];
        const dias = diasConEjercicios.length ? diasConEjercicios : null;

        const ejercicios = Array.isArray(config)
            ? Array.from(
                new Set(
                    config
                        .flatMap((d) => Array.isArray(d?.ejercicios) ? d.ejercicios : [])
                        .map((e) => String(e?.nombre ?? e?.ejercicio ?? e?.exercise ?? e?.name ?? "").trim())
                        .filter(Boolean)
                )
            )
            : null;

        return {
            lugar: lugar || null,
            objetivo: objetivoCode || null,
            intensidad: intensidadCode || intensidadFromN || null,
            dias,
            ejercicios,
        };
    };

    const prefillPlan = buildPrefillFromPlanPrevio(planPrevioRaw);
    const lastLugar = prefillPlan?.lugar || baseLugar;
    const lastObjetivo = prefillPlan?.objetivo || baseObjetivo;
    const lastDias = prefillPlan?.dias || baseDias;
    const lastEjSeleccionados = Array.isArray(prefillPlan?.ejercicios) ? prefillPlan.ejercicios : baseEjSeleccionados;
    const lastEjEnabled = Array.isArray(prefillPlan?.ejercicios) ? true : baseEjEnabled;
    const lastIntensidad = prefillPlan?.intensidad || baseIntensidad;

    const sheetHtml = `
        <div class="pt-detail pt-gen">
            <div class="pt-detail-hero pt-detail-hero-focus">
                <div class="pt-detail-hero-row">
                    <div class="pt-detail-hero-title">${escapeHtml(tLang("Configurar plan", "Configure plan"))}</div>
                    <div class="pt-gen-header-actions">
                        <button type="button" class="btn-primary pt-gen-generate" data-pt-generate>
                            ${escapeHtml(tLang("Generar", "Generate"))}
                        </button>
                    </div>
                </div>
                <div class="pt-detail-hero-sub">
                    ${escapeHtml(tLang(
        "Elegí tu contexto y prioridad. Esto nos ayuda a seleccionar ejercicios y armar una progresión coherente.",
        "Choose your context and priority. This helps us select exercises and build a coherent progression."
    ))}
                </div>
                <div class="pt-form-error" id="pt_gen_error" role="alert"></div>
            </div>

            <div class="pt-detail-body">
                <div class="pt-detail-viewport plan-detalle-viewport" role="region" aria-label="${escapeHtml(tLang("Opciones del plan", "Plan options"))}">
                    <div class="pt-detail-card">
                        <div class="pt-detail-card-inner">
                            <div class="pt-sheet-section-title">${escapeHtml(tLang("Opciones", "Options"))}</div>
                            <div class="swal-grid">
                                <div class="swal-field">
                                    <p class="swal-label">${escapeHtml(tLang("¿Dónde entrenás?", "Where do you train?"))}</p>
                                    <label class="swal-radio"><input type="radio" name="lugar" value="casa"><span>${escapeHtml(tLang("Entreno en casa", "I train at home"))}</span></label>
                                    <label class="swal-radio"><input type="radio" name="lugar" value="gimnasio"><span>${escapeHtml(tLang("Entreno en gimnasio", "I train at the gym"))}</span></label>
                                </div>
                                <div class="swal-field">
                                    <p class="swal-label">${escapeHtml(tLang("¿Qué priorizás?", "What do you prioritize?"))}</p>
                                    <label class="swal-radio"><input type="radio" name="objetivo" value="grasa"><span>${escapeHtml(tLang("Priorizar pérdida de grasa", "Prioritize fat loss"))}</span></label>
                                    <label class="swal-radio"><input type="radio" name="objetivo" value="musculo"><span>${escapeHtml(tLang("Priorizar ganancia muscular", "Prioritize muscle gain"))}</span></label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="pt-detail-card">
                        <div class="pt-detail-card-inner">
                            ${renderSelectorIntensidad()}
                        </div>
                    </div>

                    <div class="pt-detail-card">
                        <div class="pt-detail-card-inner">
                            <div class="pt-sheet-section-title">${escapeHtml(tLang("Días", "Days"))}</div>
                            <p class="swal-helper">${escapeHtml(tLang(
        "Tocá para seleccionar los días en los que vas a entrenar.",
        "Tap to select the days you plan to train."
    ))}</p>
                            ${renderDiasSelector()}
                        </div>
                    </div>

                    <div class="pt-detail-card">
                        <div class="pt-detail-card-inner">
                            <div class="pt-sheet-section-title">${escapeHtml(tLang("Ejercicios", "Exercises"))}</div>
                            <p class="swal-helper">${escapeHtml(tLang(
        "Opcional: si querés, marcá ejercicios preferidos. Si no seleccionás nada, la IA elige automáticamente.",
        "Optional: pick preferred exercises. If you don't select any, the AI will choose automatically."
    ))}</p>
                            <label class="swal-toggle">
                                <input type="checkbox" id="swal_ej_toggle">
                                <span>${escapeHtml(tLang("Quiero elegir ejercicios", "I want to choose exercises"))}</span>
                            </label>
                            <div class="swal-ejercicios">
                                ${renderListaEjerciciosSelectable()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    `;

    return new Promise((resolve) => {
        let resolved = false;
        const safeResolve = (value) => {
            if (resolved) return;
            resolved = true;
            resolve(value);
        };

        window.PTBottomSheet?.open?.({
            title: tLang("Generar Plan de Entrenamiento con IA", "Generate Training Plan with AI"),
            ariaLabel: tLang("Generar plan de entrenamiento", "Generate training plan"),
            html: sheetHtml,
            className: "",
            showClose: false,
            showHandle: true,
            allowOutsideClose: true,
            allowEscapeClose: true,
            allowDragClose: true,
            didOpen: (sheet) => {
                const root = sheet.querySelector(".pt-gen") || sheet;
                const showError = (msg) => {
                    const err = sheet.querySelector("#pt_gen_error");
                    if (!(err instanceof HTMLElement)) return;
                    err.textContent = String(msg ?? "").trim();
                    err.classList.toggle("is-show", !!err.textContent);
                    try { err.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch { }
                };

                const clearError = () => showError("");
                sheet.addEventListener("input", clearError);
                sheet.addEventListener("change", clearError);

                sheet.querySelector(`input[name="lugar"][value="${lastLugar}"]`)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
                sheet.querySelector(`input[name="objetivo"][value="${lastObjetivo}"]`)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
                sheet.querySelector(`input[name="intensidad"][value="${lastIntensidad}"]`)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

                const diasSet = new Set(lastDias);
                sheet.querySelectorAll(".swal-dia-btn")?.forEach((btn) => {
                    const code = btn.getAttribute("data-dia");
                    const isOn = diasSet.has(String(code ?? "").toUpperCase());
                    btn.classList.toggle("is-selected", isOn);
                    btn.setAttribute("aria-pressed", isOn ? "true" : "false");
                });

                sheet.querySelector(".swal-dias")?.addEventListener("click", (ev) => {
                    const target = ev.target;
                    if (!(target instanceof HTMLElement)) return;
                    const btn = target.closest(".swal-dia-btn");
                    if (!(btn instanceof HTMLButtonElement)) return;
                    const pressed = btn.getAttribute("aria-pressed") === "true";
                    const next = !pressed;
                    btn.classList.toggle("is-selected", next);
                    btn.setAttribute("aria-pressed", next ? "true" : "false");
                });

                const toggle = sheet.querySelector("#swal_ej_toggle");
                if (toggle instanceof HTMLInputElement) {
                    toggle.checked = lastEjEnabled;
                }

                const selectedSet = new Set(lastEjSeleccionados.map((x) => String(x)));
                sheet.querySelectorAll('input[name="ejercicios"]')?.forEach((el) => {
                    if (!(el instanceof HTMLInputElement)) return;
                    el.checked = selectedSet.has(el.value);
                });

                const setEjEnabled = (enabled) => {
                    root.classList.toggle("is-ej-disabled", !enabled);
                    root.querySelectorAll('input[name="ejercicios"]')?.forEach((el) => {
                        if (!(el instanceof HTMLInputElement)) return;
                        el.disabled = !enabled;
                    });
                };

                setEjEnabled(lastEjEnabled);
                toggle?.addEventListener("change", () => {
                    const enabled = toggle instanceof HTMLInputElement ? toggle.checked : false;
                    setEjEnabled(enabled);
                });

                const btnGenerate = sheet.querySelector("[data-pt-generate]");
                btnGenerate?.addEventListener("click", async () => {
                    const lugar = sheet.querySelector('input[name="lugar"]:checked')?.value;
                    const objetivo = sheet.querySelector('input[name="objetivo"]:checked')?.value;
                    const dias = Array.from(sheet.querySelectorAll('.swal-dia-btn[aria-pressed="true"]') ?? [])
                        .map((b) => String(b.getAttribute("data-dia") ?? "").toUpperCase())
                        .filter(Boolean);
                    const intensidad = sheet.querySelector('input[name="intensidad"]:checked')?.value || null;
                    const ejToggle = sheet.querySelector("#swal_ej_toggle");
                    const ejEnabled = ejToggle instanceof HTMLInputElement ? ejToggle.checked : false;
                    const ejercicios = ejEnabled
                        ? Array.from(sheet.querySelectorAll('input[name="ejercicios"]:checked') ?? [])
                            .map((el) => (el instanceof HTMLInputElement ? String(el.value) : ""))
                            .filter(Boolean)
                        : null;

                    if (!lugar || !objetivo) {
                        showError(tLang(
                            "Elegí dónde entrenás y qué priorizás",
                            "Choose where you train and what you prioritize"
                        ));
                        return;
                    }

                    if (!dias.length) {
                        showError(tLang(
                            "Seleccioná al menos un día de la semana",
                            "Select at least one day of the week"
                        ));
                        return;
                    }

                    // Persist choices
                    try {
                        localStorage.setItem("plan_lugar", String(lugar));
                        localStorage.setItem("plan_objetivo", String(objetivo));
                        localStorage.setItem("plan_dias", JSON.stringify(dias));
                        if (intensidad) localStorage.setItem("plan_intensidad", String(intensidad));
                        localStorage.setItem("plan_ejercicios_enabled", ejEnabled ? "1" : "0");
                        localStorage.setItem("plan_ejercicios_selected", JSON.stringify(Array.isArray(ejercicios) ? ejercicios : []));
                    } catch {
                        // ignore
                    }

                    // Prevent double submit
                    try {
                        if (btnGenerate instanceof HTMLButtonElement) btnGenerate.disabled = true;
                    } catch { }

                    safeResolve({ isConfirmed: true, value: { lugar, objetivo, dias, ejEnabled, ejercicios, intensidad } });
                    window.PTBottomSheet?.close?.();

                    await crearPlanEntreno(lugar, objetivo, dias, ejercicios, intensidad);
                });
            },
            willClose: () => {
                safeResolve({ isConfirmed: false, value: null });
            },
        });
    });
};
window.onload = async () => {

    await recuperar_planes();

    initDynamicGreeting();

    const userEl = document.getElementById("username");
    const avatarEl = document.getElementById("icono_usuario");
    if (userEl) userEl.textContent = username || "";
    if (avatarEl && avatar) avatarEl.src = avatar;

    const userSidebarEl = document.getElementById("username_sidebar");
    const avatarSidebarEl = document.getElementById("icono_usuario_sidebar");
    if (userSidebarEl) userSidebarEl.textContent = username || "";
    if (avatarSidebarEl && avatar) avatarSidebarEl.src = avatar;

    verificacion_plan_entrenamiento();
    await initPlanAlimentacion({
        root: document.getElementById("Alimentacion"),
        skipRecuperarPlanes: true,
        autofocus: false,
    });

    initWakeLockForPlanViews();

    initDetallePorDiaPlan();
    initPlanDiaPager();
}

function verificacion_plan_entrenamiento() {
    const desc = document.getElementById("descripcion_previa");
    const plan_entrenamiento = localStorage.getItem("plan_entreno_usuario");
    const boton_ejercicios = document.getElementById("boton_ejercicios");
    const boton_eliminar_plan_eje = document.getElementById("boton_eliminar");
    const boton_regenerar = document.getElementById("boton_regenerar");
    const planActionsPill = document.querySelector(".plan-actions-pill");
    if (plan_entrenamiento != "Ninguno" && plan_entrenamiento != null) {
        planActionsPill?.classList.add("is-pill");
        desc.style.display = "none";
        boton_ejercicios?.classList.remove("btn-primary");
        if (boton_ejercicios) {
            boton_ejercicios.removeAttribute("data-i18n-en");
            delete boton_ejercicios.dataset.i18nEs;
        }
        if (boton_regenerar) {
            boton_regenerar.style.display = "inline-block";
            boton_regenerar.onclick = () => Regen_plan();
        }
        boton_eliminar_plan_eje.style.display = "inline-block";
        const contenedor_ejercicios = document.getElementById("Plan_ejercicio");
        contenedor_ejercicios.style.display = "block";
        contenedor_ejercicios.innerHTML = mapear_plan(plan_entrenamiento)
        try { globalThis.UIIdioma?.translatePage?.(contenedor_ejercicios); } catch { }
        initPlanDiaPager();
        boton_ejercicios.innerHTML = '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0ibHVjaWRlIGx1Y2lkZS1yb3RhdGUtY3ctaWNvbiBsdWNpZGUtcm90YXRlLWN3Ij48cGF0aCBkPSJNMjEgMTJhOSA5IDAgMSAxLTktOWMyLjUyIDAgNC45MyAxIDYuNzQgMi43NEwyMSA4Ii8+PHBhdGggZD0iTTIxIDN2NWgtNSIvPjwvc3ZnPg==">';
        boton_ejercicios.classList.add("btn-icon-sm");
        boton_ejercicios.style.width = "";
        boton_ejercicios.style.height = "";
        boton_ejercicios.setAttribute("aria-label", "Refrescar plan de entrenamiento");
        boton_ejercicios.setAttribute("data-i18n-en-aria-label", "Refresh training plan");
        try { globalThis.UIIdioma?.translatePage?.(boton_ejercicios); } catch { }
        boton_ejercicios.onclick = async () => {
            await recuperar_planes();
            const title = tLang("Plan de entrenamiento actualizado", "Training plan updated");
            const message = tLang(
                "Tu plan de entrenamiento ha sido refrescado correctamente.",
                "Your training plan was refreshed successfully."
            );

            if (window.PTBottomSheet && typeof window.PTBottomSheet.open === "function") {
                try { window.PTBottomSheet.close?.(); } catch { }
                await window.PTBottomSheet.open({
                    title,
                    ariaLabel: title,
                    html: `
                        <div class="pt-status">
                            <div class="pt-status-row">
                                <div class="pt-status-text">${escapeHtml(message)}</div>
                            </div>
                            <div class="pt-status-actions">
                                <button type="button" class="btn-primary" data-pt-sheet-close>${escapeHtml(tLang("Listo", "Done"))}</button>
                            </div>
                        </div>
                    `,
                    showClose: false,
                    showHandle: true,
                    allowOutsideClose: true,
                    allowEscapeClose: true,
                    allowDragClose: true,
                    didOpen: (sheet) => {
                        sheet.querySelector("[data-pt-sheet-close]")?.addEventListener("click", () => {
                            try { window.PTBottomSheet.close?.(); } catch { }
                        });
                        try { globalThis.UIIdioma?.translatePage?.(sheet); } catch { }
                    },
                });
                return;
            }

            await openStatusSheet({ title, message });
        }
    }
    else if (plan_entrenamiento == "Ninguno" || plan_entrenamiento == null) {
        planActionsPill?.classList.remove("is-pill");
        if (desc) desc.style.display = "block";
        boton_eliminar_plan_eje.style.display = "none";
        boton_ejercicios?.classList.add("btn-primary");
        boton_ejercicios?.classList.remove("btn-icon-sm");
        if (boton_ejercicios) {
            boton_ejercicios.textContent = "Generar plan";
            boton_ejercicios.setAttribute("data-i18n-en", "Generate plan");
            boton_ejercicios.setAttribute("aria-label", "Generar plan de entrenamiento");
            boton_ejercicios.setAttribute("data-i18n-en-aria-label", "Generate training plan");
            try { globalThis.UIIdioma?.translatePage?.(boton_ejercicios); } catch { }
        }
        boton_ejercicios.style.width = "auto";
        boton_ejercicios.style.height = "auto";
        boton_ejercicios.onclick = async () => {
            await openGenerarPlanModal();
        }
    }
}
async function crearPlanEntreno(lugar, objetivo, diasSeleccionados, ejerciciosSeleccionados, intensidad = 'media') {

    const diasCodes = Array.isArray(diasSeleccionados) ? diasSeleccionados : [];
    const diasSem = diasCodes
        .map((code) => DIAS_SEMANA.find((d) => d.code === String(code ?? "").toUpperCase())?.name)
        .filter(Boolean);
    const ejerciciosPorDiaMap = { baja: 4, media: 6, alta: 8 };
    const ejerciciosPorDia = ejerciciosPorDiaMap[intensidad] ?? ejerciciosPorDiaMap.media;
    // persist user choice for next time
    try { localStorage.setItem("plan_intensidad", intensidad); } catch (e) { }

    // Modal “nuevo” (bottom-sheet) para estado de generación
    try { window.PTBottomSheet?.close?.(); } catch { }

    const loadingText = isEnglish()
        ? `Place: ${formatPlanLugar(lugar)} | Goal: ${formatPlanObjetivo(objetivo)} | Intensity: ${formatPlanIntensidad(intensidad)} | Days: ${(diasCodes || []).join(", ") || "-"}. Please wait...`
        : `Lugar: ${formatPlanLugar(lugar)} | Objetivo: ${formatPlanObjetivo(objetivo)} | Intensidad: ${formatPlanIntensidad(intensidad)} | Días: ${(diasCodes || []).join(", ") || "-"}. Por favor, esperá...`;

    window.PTBottomSheet?.open?.({
        title: tLang("Generando Plan", "Generating plan"),
        subtitle: tLang("Esto puede tardar unos segundos", "This may take a few seconds"),
        ariaLabel: tLang("Generando plan de entrenamiento", "Generating training plan"),
        html: `
            <div class="pt-status" aria-live="polite">
                <div class="pt-status-row">
                    <div class="pt-spinner" aria-hidden="true"></div>
                    <div class="pt-status-text">${escapeHtml(loadingText)}</div>
                </div>
            </div>
        `,
        showClose: false,
        showHandle: false,
        allowOutsideClose: false,
        allowEscapeClose: false,
        allowDragClose: false,
    });

    let response;
    try {
        const { plan_entreno } = await callEdgeFunctionJson("/gen_plan_entreno", {
            idioma: getIdiomaPreferido(),
            lugar,
            objetivo,
            intensidad,
            ejercicios_por_dia: ejerciciosPorDia,
            dias: diasCodes,
            dias_semana: diasSem,
            ejercicios_seleccionados: Array.isArray(ejerciciosSeleccionados) ? ejerciciosSeleccionados : null,
            Altura: localStorage.getItem("altura_usuario"),
            Peso_actual: localStorage.getItem("peso_actual_usuario"),
            Peso_objetivo: localStorage.getItem("peso_objetivo_usuario"),
            Edad: localStorage.getItem("edad_usuario"),
        });

        response = await fetch('/generar_plan_entreno', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_usuario: localStorage.getItem("id_usuario"),
                plan_entreno,
            }),
        });
    } catch (err) {
        console.log("[/generar_plan_entreno] Error:", err);
        try { window.PTBottomSheet?.close?.(); } catch { }
        window.PTBottomSheet?.open?.({
            title: tLang("Error", "Error"),
            ariaLabel: tLang("Error", "Error"),
            html: `
                <div class="pt-status">
                    <div class="pt-status-row">
                        <div class="pt-status-text">${escapeHtml(tLang(
                "No se pudo generar/guardar el plan. Revisá tu conexión y/o la API key de Gemini e intentá de nuevo.",
                "Could not generate/save the plan. Check your connection and/or Gemini API key and try again."
            ))}</div>
                    </div>
                    <div class="pt-status-actions">
                        <button type="button" class="btn-primary" data-pt-sheet-close>${escapeHtml(tLang("Entendido", "OK"))}</button>
                    </div>
                </div>
            `,
            showClose: false,
            showHandle: true,
            allowOutsideClose: true,
            allowEscapeClose: true,
            allowDragClose: true,
            didOpen: (sheet) => {
                sheet.querySelector("[data-pt-sheet-close]")?.addEventListener("click", () => window.PTBottomSheet?.close?.());
            },
        });
        return;
    }

    if (!response.ok) {
        let bodyText = "";
        try { bodyText = await response.text(); } catch { bodyText = ""; }
        console.log("[EdgeFunction:/generar_plan_entreno] Error:", {
            status: response.status,
            statusText: response.statusText,
            body: bodyText,
        });

        if (isNetlifyEdgeUncaughtInvocation(bodyText)) {
            try { window.PTBottomSheet?.close?.(); } catch { }
            await showNetlifyHostingErrorAlert({
                endpoint: "/generar_plan_entreno",
                status: response.status,
                statusText: response.statusText,
                bodyText,
            });
            return;
        }

        try { window.PTBottomSheet?.close?.(); } catch { }
        window.PTBottomSheet?.open?.({
            title: tLang("Error", "Error"),
            ariaLabel: tLang("Error", "Error"),
            html: `
                <div class="pt-status">
                    <div class="pt-status-row">
                        <div class="pt-status-text">${escapeHtml(tLang(
                "Error al generar el plan de entrenamiento. Por favor, intentá nuevamente más tarde.",
                "Failed to generate the training plan. Please try again later."
            ))}</div>
                    </div>
                    <div class="pt-status-actions">
                        <button type="button" class="btn-primary" data-pt-sheet-close>${escapeHtml(tLang("Entendido", "OK"))}</button>
                    </div>
                </div>
            `,
            showClose: false,
            showHandle: true,
            allowOutsideClose: true,
            allowEscapeClose: true,
            allowDragClose: true,
            didOpen: (sheet) => {
                sheet.querySelector("[data-pt-sheet-close]")?.addEventListener("click", () => window.PTBottomSheet?.close?.());
            },
        });
        return;
    } else {
        try {
            const { data, error } = await supabase.from("Planes").select("*").eq("ID_user", localStorage.getItem("id_usuario")).limit(1);
            if (error) { throw new Error(error.message); }
            localStorage.setItem("plan_entreno_usuario", data.length === 0 ? "Ninguno" : data[0].Plan_entreno ?? "Ninguno");
            localStorage.setItem("plan_dieta_usuario", data.length === 0 ? "Ninguno" : data[0].Plan_alimenta ?? "Ninguno");
            await recuperar_planes();
            verificacion_plan_entrenamiento();
            try { window.PTBottomSheet?.close?.(); } catch { }
            window.PTBottomSheet?.open?.({
                title: tLang("¡Plan Generado!", "Plan generated!"),
                ariaLabel: tLang("Plan generado", "Plan generated"),
                html: `
                    <div class="pt-status">
                        <div class="pt-status-row">
                            <div class="pt-status-text">${escapeHtml(tLang(
                    "Tu rutina se ha creado correctamente.",
                    "Your routine was created successfully."
                ))}</div>
                        </div>
                        <div class="pt-status-actions">
                            <button type="button" class="btn-primary" data-pt-sheet-close>${escapeHtml(tLang("Listo", "Done"))}</button>
                        </div>
                    </div>
                `,
                showClose: false,
                showHandle: true,
                allowOutsideClose: true,
                allowEscapeClose: true,
                allowDragClose: true,
                didOpen: (sheet) => {
                    sheet.querySelector("[data-pt-sheet-close]")?.addEventListener("click", () => window.PTBottomSheet?.close?.());
                },
            });
        } catch (error) {
            try { window.PTBottomSheet?.close?.(); } catch { }
            window.PTBottomSheet?.open?.({
                title: tLang("Error", "Error"),
                ariaLabel: tLang("Error", "Error"),
                html: `
                    <div class="pt-status">
                        <div class="pt-status-row">
                            <div class="pt-status-text">${escapeHtml(tLang(
                    "Error al guardar la configuración: ",
                    "Failed to save configuration: "
                ) + (error?.message ?? ""))}</div>
                        </div>
                        <div class="pt-status-actions">
                            <button type="button" class="btn-primary" data-pt-sheet-close>${escapeHtml(tLang("Entendido", "OK"))}</button>
                        </div>
                    </div>
                `,
                showClose: false,
                showHandle: true,
                allowOutsideClose: true,
                allowEscapeClose: true,
                allowDragClose: true,
                didOpen: (sheet) => {
                    sheet.querySelector("[data-pt-sheet-close]")?.addEventListener("click", () => window.PTBottomSheet?.close?.());
                },
            });
            return;
        }
    }
}

async function recuperar_planes() {
    const { user } = await supabase.auth.getUser().then(({ data: { user } }) => user);
    if (user) {
        const { datos2, error2 } = await supabase
            .from("Planes").select("Plan_entreno, Plan_alimenta").eq("ID_user", user.id).single();
        if (error2) {
            await openStatusSheet({
                title: tLang("Error", "Error"),
                message: tLang("Error al obtener los datos del usuario: ", "Failed to fetch user data: ") + error2.message,
            });
            return;
        }
        const plan_entreno = datos2.Plan_entreno;
        const plan_alimenta = datos2.Plan_alimenta;
        localStorage.setItem("plan_entreno_usuario", plan_entreno);
        localStorage.setItem("plan_dieta_usuario", plan_alimenta);
    }
}

function mapear_plan(plan_entrenamiento_json) {
    const raw = plan_entrenamiento_json;
    if (raw == null) {
        return "<div class=\"plan-vacio\" data-i18n-en=\"No plan loaded.\">No hay plan cargado.</div>";
    }

    const asString = typeof raw === "string" ? raw.trim() : JSON.stringify(raw);
    if (!asString || asString === "Ninguno") {
        return "<div class=\"plan-vacio\" data-i18n-en=\"No plan loaded.\">No hay plan cargado.</div>";
    }

    const extractLikelyJson = (text) => {
        const s = String(text ?? "");
        // strip code fences if present
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

    const tryParseJson = (text) => {
        try {
            return JSON.parse(text);
        } catch {
            return null;
        }
    };

    const normalizeExercise = (ex) => {
        if (!ex || typeof ex !== "object") return null;
        const nombre = ex.nombre ?? ex.ejercicio ?? ex.exercise ?? ex.name ?? ex.titulo ?? ex.title;
        const descripcion = ex.descripcion ?? ex.description ?? ex.detalle ?? ex.detalles ?? ex.instrucciones ?? ex.instruccion;
        const descripcion_detallada = ex.descripcion_detallada ?? ex.descripcionDetallada ?? ex.detailed_description ?? ex.detailedDescription ?? ex.detalle_detallado ?? ex.instrucciones_detalladas;
        const series = ex.series ?? ex.series_por_ejercicio ?? ex.sets ?? ex.set ?? ex.seriesTotales;
        const repeticiones = ex.repeticiones ?? ex.reps ?? ex.repetitions ?? ex.rep ?? ex.repeticion;
        if (!nombre && !series && !repeticiones) return null;

        const nombreEs = String(nombre ?? tLang("Ejercicio", "Exercise")).trim();
        const nombreEn = translateExerciseNameToEnglish(nombreEs);
        return {
            nombre: nombreEs,
            nombre_en: nombreEn,
            descripcion: descripcion ?? "",
            descripcion_detallada: descripcion_detallada ?? "",
            series: series ?? "-",
            repeticiones: repeticiones ?? "-",
        };
    };

    const diasOrden = [
        "lunes",
        "martes",
        "miércoles",
        "miercoles",
        "jueves",
        "viernes",
        "sábado",
        "sabado",
        "domingo",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ];

    const parse = () => {
        const extracted = extractLikelyJson(asString);
        const parsed = tryParseJson(extracted);
        if (parsed != null) return parsed;

        // fallback: sometimes it's JSON but with text around it
        const parsed2 = tryParseJson(asString);
        if (parsed2 != null) return parsed2;
        return null;
    };

    const parsed = parse();
    if (parsed == null) {
        return `
            <div class="plan-container">
                <div class="plan-aviso" data-i18n-en="Couldn't parse the plan as JSON. Showing text.">No pude interpretar el plan como JSON. Mostrando texto.</div>
                <pre class="plan-raw">${escapeHtml(asString)}</pre>
            </div>
        `;
    }

    const isPlainArray = Array.isArray(parsed);
    let root = isPlainArray ? { ejercicios: parsed } : parsed;

    // Soportar estructura guardada: { plan_entrenamiento_hipertrofia: { configuracion_semanal: [...] } }
    if (root && typeof root === "object") {
        root =
            root.plan_entrenamiento_hipertrofia ??
            root.plan_entrenamiento ??
            root.plan ??
            root;
    }

    // Detect common shapes
    const maybeDiasArray =
        root.configuracion_semanal ??
        root.configuracionSemanal ??
        root.dias ??
        root.semana ??
        root.plan_semanal ??
        root.planSemanal;
    const hasDiasArray = Array.isArray(maybeDiasArray);

    const weekdayKeys = Object.keys(root || {}).filter((k) => diasOrden.includes(String(k).toLowerCase()));
    const hasWeekdayObject = weekdayKeys.length > 0;

    const renderExerciseCard = (exNorm, idx, dayIdx) => {
        const nombreEs = escapeHtml(exNorm.nombre);
        const nombreEn = escapeHtml(exNorm.nombre_en ?? exNorm.nombre);
        const descripcion = escapeHtml(exNorm.descripcion || "");
        const series = escapeHtml(exNorm.series);
        const reps = escapeHtml(formatReps(exNorm.repeticiones));
        return `
            <article class="plan-card" data-idx="${idx}" data-day-idx="${escapeHtml(dayIdx)}" role="button" tabindex="0">
                <h3 class="plan-nombre" data-i18n-en="${nombreEn}">${nombreEs}</h3>
                ${descripcion ? `<p class="plan-desc">${descripcion}</p>` : ""}
                <div class="plan-meta">
                    <span class="plan-chip"><span data-i18n-en="Sets:">Series:</span> <strong>${series}</strong></span>
                    <span class="plan-chip"><span data-i18n-en="Reps:">Reps:</span> <strong>${reps}</strong></span>
                </div>
            </article>
        `;
    };

    const renderDaySection = (diaLabel, ejerciciosList, enfoque, dayIdx) => {
        const normalized = (Array.isArray(ejerciciosList) ? ejerciciosList : [])
            .map(normalizeExercise)
            .filter(Boolean);

        // No mostrar días sin ejercicios
        if (!normalized.length) return "";

        const cards = normalized.length
            ? normalized.map((ex, idx) => renderExerciseCard(ex, idx, dayIdx)).join("")
            : `<div class="plan-vacio" data-i18n-en="No exercises for this day.">No hay ejercicios para este día.</div>`;

        return `
            <section class="plan-dia">
                <div class="plan-dia-header" data-day-idx="${escapeHtml(dayIdx)}" role="button" tabindex="0" aria-label="${escapeHtml(tLang("Detalle del día", "Day detail"))} ${dayIdx + 1}">
                    <div class="plan-dia-titulos">
                        <h2 class="plan-dia-titulo">${escapeHtml(diaLabel)}</h2>
                        ${enfoque ? `<div class="plan-dia-subtitle">${escapeHtml(enfoque)}</div>` : ""}
                    </div>
                    <span class="plan-dia-chip"><span>${normalized.length}</span> <span data-i18n-en="exercises">ejercicios</span></span>
                </div>
                <div class="plan-grid">${cards}</div>
            </section>
        `;
    };

    let html = "";

    if (hasDiasArray) {
        const days = (Array.isArray(maybeDiasArray) ? maybeDiasArray : [])
            .map((d, originalIndex) => {
                const dia = d?.dia ?? d?.nombre ?? d?.day ?? tLang(`Día ${originalIndex + 1}`, `Day ${originalIndex + 1}`);
                const enfoque = d?.enfoque ?? d?.focus ?? d?.objetivo ?? d?.titulo ?? d?.title;
                const ejercicios = d?.ejercicios ?? d?.entrenamiento ?? d?.exercises ?? d?.rutina ?? d?.items ?? [];
                const normalized = (Array.isArray(ejercicios) ? ejercicios : [])
                    .map(normalizeExercise)
                    .filter(Boolean);
                return { dia, enfoque, ejercicios, normalized, originalIndex };
            })
            .filter((d) => d.normalized.length > 0);

        if (!days.length) {
            html = `<div class="plan-vacio" data-i18n-en="No days have exercises assigned.">No hay días con ejercicios asignados.</div>`;
        } else {
            html = days
                .map((d, i) => renderDaySection(d.dia, d.ejercicios, d.enfoque, i))
                .filter(Boolean)
                .join("");
        }
    } else if (hasWeekdayObject) {
        const orderedKeys = [...weekdayKeys].sort((a, b) => {
            const ia = diasOrden.indexOf(String(a).toLowerCase());
            const ib = diasOrden.indexOf(String(b).toLowerCase());
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        });

        const days = orderedKeys
            .map((k) => {
                const ejercicios = root[k];
                const normalized = (Array.isArray(ejercicios) ? ejercicios : [])
                    .map(normalizeExercise)
                    .filter(Boolean);
                return { key: k, ejercicios, normalized };
            })
            .filter((d) => d.normalized.length > 0);

        if (!days.length) {
            html = `<div class="plan-vacio" data-i18n-en="No days have exercises assigned.">No hay días con ejercicios asignados.</div>`;
        } else {
            html = days.map((d, i) => renderDaySection(d.key, d.ejercicios, null, i)).filter(Boolean).join("");
        }
    } else {
        const ejercicios = root.ejercicios ?? root.plan ?? root.entrenamiento ?? root.exercises ?? root.rutina ?? [];
        const normalized = (Array.isArray(ejercicios) ? ejercicios : [])
            .map(normalizeExercise)
            .filter(Boolean);
        const cards = normalized.length
            ? normalized.map((ex, idx) => renderExerciseCard(ex, idx, 0)).join("")
            : `<div class="plan-vacio" data-i18n-en="Couldn't find exercises in the JSON.">No pude encontrar ejercicios en el JSON.</div>`;
        html = `<div class="plan-grid">${cards}</div>`;
    }

    return `<div class="plan-container plan-snap">${html}</div>`;
}

function parsePlanDiasDetallados(planRaw) {
    if (planRaw == null) return null;
    const asString = typeof planRaw === "string" ? planRaw.trim() : JSON.stringify(planRaw);
    if (!asString || asString === "Ninguno") return null;

    const extractLikelyJsonText = (text) => {
        const s = String(text ?? "");
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

    const safeJsonParse = (text) => {
        try {
            return JSON.parse(text);
        } catch {
            return null;
        }
    };

    const parsed = safeJsonParse(extractLikelyJsonText(asString)) ?? safeJsonParse(asString);
    if (!parsed || typeof parsed !== "object") return null;

    let root = Array.isArray(parsed) ? { ejercicios: parsed } : parsed;
    if (root && typeof root === "object") {
        root = root.plan_entrenamiento_hipertrofia ?? root.plan_entrenamiento ?? root.plan ?? root;
    }

    const diasOrden = [
        "lunes",
        "martes",
        "miércoles",
        "miercoles",
        "jueves",
        "viernes",
        "sábado",
        "sabado",
        "domingo",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ];

    const normalizeExDet = (ex) => {
        if (!ex || typeof ex !== "object") return null;
        const nombre = ex.nombre ?? ex.ejercicio ?? ex.exercise ?? ex.name ?? ex.titulo ?? ex.title;
        const descripcion = ex.descripcion ?? ex.description ?? ex.detalle ?? ex.detalles ?? ex.instrucciones ?? ex.instruccion;
        const descripcion_detallada = ex.descripcion_detallada ?? ex.descripcionDetallada ?? ex.detailed_description ?? ex.detailedDescription ?? ex.detalle_detallado ?? ex.instrucciones_detalladas;
        const series = ex.series ?? ex.series_por_ejercicio ?? ex.sets ?? ex.set ?? ex.seriesTotales;
        const repeticiones = ex.repeticiones ?? ex.reps ?? ex.repetitions ?? ex.rep ?? ex.repeticion;
        const descanso_segundos = ex.descanso_segundos ?? ex.descanso ?? ex.rest ?? ex.rest_seconds ?? ex.restSeconds;
        if (!nombre && !series && !repeticiones && !descripcion) return null;

        const nombreEs = String(nombre ?? tLang("Ejercicio", "Exercise")).trim();
        const nombreEn = translateExerciseNameToEnglish(nombreEs);
        return {
            nombre: nombreEs,
            nombre_en: nombreEn,
            descripcion: String(descripcion ?? ""),
            descripcion_detallada: String(descripcion_detallada ?? ""),
            series: series ?? "-",
            repeticiones: repeticiones ?? "-",
            descanso_segundos: descanso_segundos ?? "-",
        };
    };

    const maybeDiasArray =
        root?.configuracion_semanal ??
        root?.configuracionSemanal ??
        root?.dias ??
        root?.semana ??
        root?.plan_semanal ??
        root?.planSemanal;

    if (Array.isArray(maybeDiasArray)) {
        const days = maybeDiasArray.map((d, i) => {
            const dia = d?.dia ?? d?.nombre ?? d?.day ?? tLang(`Día ${i + 1}`, `Day ${i + 1}`);
            const enfoque = d?.enfoque ?? d?.focus ?? d?.objetivo ?? d?.titulo ?? d?.title ?? "";
            const ejercicios = Array.isArray(d?.ejercicios)
                ? d.ejercicios.map(normalizeExDet).filter(Boolean)
                : [];
            return { dia, enfoque, ejercicios };
        });
        return days.filter((d) => Array.isArray(d.ejercicios) && d.ejercicios.length > 0);
    }

    const weekdayKeys = Object.keys(root || {}).filter((k) => diasOrden.includes(String(k).toLowerCase()));
    if (weekdayKeys.length > 0) {
        const orderedKeys = [...weekdayKeys].sort((a, b) => {
            const ia = diasOrden.indexOf(String(a).toLowerCase());
            const ib = diasOrden.indexOf(String(b).toLowerCase());
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        });
        const days = orderedKeys.map((k) => {
            const ejercicios = Array.isArray(root[k]) ? root[k].map(normalizeExDet).filter(Boolean) : [];
            return { dia: k, enfoque: "", ejercicios };
        });
        return days.filter((d) => Array.isArray(d.ejercicios) && d.ejercicios.length > 0);
    }

    return null;
}

function initDetallePorDiaPlan() {
    const contenedor = document.getElementById("Plan_ejercicio");
    if (!contenedor) return;
    if (contenedor.dataset.detalleDiaInit === "1") return;
    contenedor.dataset.detalleDiaInit = "1";

    const getHoraActualLocal = () => {
        const ahora = new Date();
        return {
            fecha: `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`,
            hora: `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`,
            iso: ahora.toISOString(),
        };
    };

    const guardarRegistroEntreno = async (registro) => {
        try {
            const res = await fetch('/guardar_registro_entreno', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_usuario: localStorage.getItem("id_usuario"),
                    registro_entreno: registro,
                }),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => null);
                console.warn("[/guardar_registro_entreno] respuesta no OK:", res.status, text);
            }
            return res;
        } catch (err) {
            console.log("[/guardar_registro_entreno] Error:", err);
            throw err;
        }
    };

    const openDetalleDia = async (headerEl) => {
        const dia_ent = headerEl?.querySelector(".plan-dia-titulo")?.textContent?.replace(/\s+/g, " ")?.trim()
            || headerEl?.querySelector(".plan-dia-titulos")?.textContent?.replace(/\s+/g, " ")?.trim()
            || headerEl?.textContent?.replace(/\s+/g, " ")?.trim();
        const desc_ent = headerEl?.querySelector(".plan-dia-subtitle")?.textContent?.trim() ?? "";
        const dia_Actual = getHoraActualLocal().fecha;
        const normalizarDiasCale = (value) => {
            if (Array.isArray(value)) return value;
            if (value == null) return [];
            if (typeof value === "string") {
                const text = value.trim();
                if (!text) return [];
                try {
                    const parsed = JSON.parse(text);
                    return Array.isArray(parsed) ? parsed : [];
                } catch {
                    return [];
                }
            }
            if (typeof value === "object") {
                const maybeArray = value.Dias_cale ?? value.Dias_entrenados;
                return Array.isArray(maybeArray) ? maybeArray : [];
            }
            return [];
        };

        const obtenerRegistrosPrevios = async () => {
            const fromLocalStorage = normalizarDiasCale(localStorage.getItem("Dias_cale"));
            try {
                const { data, error } = await supabase
                    .from("Planes")
                    .select("Dias_entrenados")
                    .eq("ID_user", localStorage.getItem("id_usuario"))
                    .limit(1)
                    .single();

                if (error) throw new Error(error.message);

                const fromDb = normalizarDiasCale(data?.Dias_entrenados);
                return fromDb.length ? fromDb : fromLocalStorage;
            } catch (err) {
                console.error("Error al obtener registros de entreno:", err);
                return fromLocalStorage;
            }
        };

        const registrosPrevios = await obtenerRegistrosPrevios();
        const registrosDelDia = registrosPrevios.filter((item) => item?.start === dia_Actual || item?.fecha === dia_Actual);
        const registroPrevio = registrosDelDia.length ? registrosDelDia[registrosDelDia.length - 1] : null;
        const caloriasPrevias = "";
        const tiempoPrevio = "";
        const WHEEL_ITEM_HEIGHT = 44;

        const buildSheetWheel = ({
            root,
            field,
            values,
            format,
            initialValue = "",
            includeEmpty = true,
            onChange,
            inputSelector,
        }) => {
            const wheelEl = root.querySelector(`[data-pt-wheel="${field}"]`);
            const inputEl = inputSelector
                ? root.querySelector(inputSelector)
                : root.querySelector(`[data-pt-${field}]`);
            if (!(wheelEl instanceof HTMLElement) || !(inputEl instanceof HTMLInputElement)) return;

            const normalizedValues = includeEmpty ? ["", ...values] : values.slice();
            wheelEl.innerHTML = "";
            wheelEl.dataset.index = "0";
            wheelEl.dataset.length = String(normalizedValues.length);

            const frag = document.createDocumentFragment();
            for (let i = 0; i < normalizedValues.length; i++) {
                const rawValue = normalizedValues[i];
                const item = document.createElement("div");
                item.className = "pt-wheel-item";
                item.dataset.value = String(rawValue);
                item.textContent = rawValue === ""
                    ? tLang("Seleccionar", "Select")
                    : (format ? format(rawValue) : String(rawValue));
                frag.appendChild(item);
            }
            wheelEl.appendChild(frag);

            const setActive = (index) => {
                const clamped = Math.max(0, Math.min(normalizedValues.length - 1, index));
                const nextValue = normalizedValues[clamped];
                wheelEl.dataset.index = String(clamped);
                inputEl.value = nextValue === "" ? "" : String(nextValue);
                const items = wheelEl.querySelectorAll(".pt-wheel-item");
                items.forEach((node, idx) => node.classList.toggle("is-active", idx === clamped));
                if (typeof onChange === "function") onChange(nextValue);
            };

            let scrollTimer = null;
            const onScroll = () => {
                const idx = Math.round((wheelEl.scrollTop + 0.0001) / WHEEL_ITEM_HEIGHT);
                setActive(idx);
                if (scrollTimer) window.clearTimeout(scrollTimer);
                scrollTimer = window.setTimeout(() => {
                    wheelEl.scrollTo({
                        top: Number(wheelEl.dataset.index) * WHEEL_ITEM_HEIGHT,
                        behavior: "smooth",
                    });
                }, 80);
            };

            wheelEl.addEventListener("scroll", onScroll, { passive: true });
            wheelEl.addEventListener("click", (e) => {
                const item = e.target.closest(".pt-wheel-item");
                if (!(item instanceof HTMLElement)) return;
                const items = Array.from(wheelEl.querySelectorAll(".pt-wheel-item"));
                const idx = items.indexOf(item);
                setActive(idx);
                wheelEl.scrollTo({ top: idx * WHEEL_ITEM_HEIGHT, behavior: "smooth" });
            });

            wheelEl.addEventListener("keydown", (e) => {
                if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                e.preventDefault();
                const delta = e.key === "ArrowDown" ? 1 : -1;
                const idx = Number(wheelEl.dataset.index || "0") + delta;
                setActive(idx);
                wheelEl.scrollTo({
                    top: Number(wheelEl.dataset.index) * WHEEL_ITEM_HEIGHT,
                    behavior: "smooth",
                });
            });

            const initialIndex = Math.max(0, normalizedValues.findIndex((v) => String(v) === String(initialValue)));
            setActive(initialIndex);
            wheelEl.scrollTo({ top: initialIndex * WHEEL_ITEM_HEIGHT, behavior: "auto" });
        };

        const sheetHtml = `
            <div class="pt-status pt-detalle-entreno">
                <div class="pt-status-row">
                    <div class="pt-status-text">
                        <strong>${escapeHtml(dia_ent || tLang("Día sin título", "Untitled day"))}</strong>
                        ${desc_ent ? `<div style="margin-top:6px; color: rgba(255,255,255,.72);">${escapeHtml(desc_ent)}</div>` : ""}
                    </div>
                </div>

                <div class="pt-status-row" style="margin-top: 14px;">
                    <div class="pt-status-text pt-detalle-meta">
                        <div><strong>${escapeHtml(tLang("Fecha", "Date"))}:</strong> ${escapeHtml(dia_Actual)}</div>
                        <div style="margin-top:4px;"><strong>${escapeHtml(tLang("Hora actual", "Current time"))}:</strong> ${escapeHtml(getHoraActualLocal().hora)}</div>
                    </div>
                </div>

                <div class="pt-status-row" style="margin-top: 16px; display: grid; gap: 12px;">
                    <div class="pt-wheel-group">
                        <span class="pt-detalle-label">${escapeHtml(tLang("Calorías quemadas", "Calories burned"))}</span>
                        <div class="pt-wheel-row" role="group" aria-label="${escapeHtml(tLang("Calorías quemadas", "Calories burned"))}">
                            <div class="pt-wheel" data-pt-wheel="calorias" tabindex="0" aria-label="${escapeHtml(tLang("Calorías", "Calories"))}"></div>
                        </div>
                        <input type="hidden" data-pt-calorias value="${escapeHtml(caloriasPrevias)}">
                    </div>

                    <div class="pt-wheel-group">
                        <span class="pt-detalle-label">${escapeHtml(tLang("Tiempo total de entreno", "Total workout time"))}</span>
                        <div class="pt-wheel-row pt-wheel-row--time" role="group" aria-label="${escapeHtml(tLang("Tiempo total de entreno", "Total workout time"))}">
                            <div class="pt-wheel-col">
                                <div class="pt-wheel-col-label">${escapeHtml(tLang("Horas", "Hours"))}</div>
                                <div class="pt-wheel" data-pt-wheel="tiempo_horas" tabindex="0" aria-label="${escapeHtml(tLang("Horas", "Hours"))}"></div>
                            </div>
                            <div class="pt-wheel-col">
                                <div class="pt-wheel-col-label">${escapeHtml(tLang("Minutos", "Minutes"))}</div>
                                <div class="pt-wheel" data-pt-wheel="tiempo_minutos" tabindex="0" aria-label="${escapeHtml(tLang("Minutos", "Minutes"))}"></div>
                            </div>
                        </div>
                        <input type="hidden" data-pt-tiempo_horas value="0">
                        <input type="hidden" data-pt-tiempo_minutos value="0">
                        <input type="hidden" data-pt-tiempo value="${escapeHtml(tiempoPrevio)}">
                    </div>
                </div>

                <div class="pt-status-actions" style="margin-top: 18px;">
                    <button type="button" class="btn-primary" data-pt-confirmar-entreno>${escapeHtml(tLang("Confirmar entreno", "Confirm workout"))}</button>
                </div>
            </div>
        `;

        if (!globalThis.PTBottomSheet || typeof globalThis.PTBottomSheet.open !== "function") {
            await openStatusSheet({
                title: tLang("Detalle del día", "Day detail"),
                html: `<div class="pt-status"><div class="pt-status-row"><div class="pt-status-text">${escapeHtml(dia_ent || tLang("Día sin título", "Untitled day"))}</div></div></div>`,
            });
            return;
        }

        await globalThis.PTBottomSheet.open({
            title: tLang("Registrar entreno", "Register workout"),
            subtitle: dia_ent || tLang("Detalle del día", "Day detail"),
            ariaLabel: tLang("Registrar entreno", "Register workout"),
            html: sheetHtml,
            showClose: false,
            showHandle: true,
            allowOutsideClose: true,
            allowEscapeClose: true,
            allowDragClose: true,
            didOpen: (sheet) => {
                try { globalThis.UIIdioma?.translatePage?.(sheet); } catch { }

                const caloriasEl = sheet.querySelector("[data-pt-calorias]");
                const tiempoEl = sheet.querySelector("[data-pt-tiempo]");
                const btnConfirmar = sheet.querySelector("[data-pt-confirmar-entreno]");

                if (caloriasEl instanceof HTMLInputElement && registroPrevio) {
                    caloriasEl.value = String(registroPrevio.calorias_quemadas ?? registroPrevio.caloriasQuemadas ?? "");
                }
                if (tiempoEl instanceof HTMLInputElement && registroPrevio) {
                    tiempoEl.value = String(registroPrevio.tiempo_total_min ?? registroPrevio.tiempoTotalMin ?? "");
                }

                buildSheetWheel({
                    root: sheet,
                    field: "calorias",
                    values: Array.from({ length: 1001 }, (_, i) => i * 5),
                    format: (value) => `${value} kcal`,
                    initialValue: caloriasEl?.value ?? "",
                });

                const horasEl = sheet.querySelector("[data-pt-tiempo_horas]");
                const minutosEl = sheet.querySelector("[data-pt-tiempo_minutos]");
                const totalMinInicial = Number.parseInt(String(tiempoEl?.value ?? "").trim(), 10);
                const horasIniciales = Number.isFinite(totalMinInicial) && totalMinInicial > 0
                    ? Math.floor(totalMinInicial / 60)
                    : 0;
                const minutosIniciales = Number.isFinite(totalMinInicial) && totalMinInicial > 0
                    ? (totalMinInicial % 60)
                    : 0;

                const syncTiempoTotalMin = () => {
                    const horas = Number.parseInt(String(horasEl?.value ?? "0").trim(), 10);
                    const minutos = Number.parseInt(String(minutosEl?.value ?? "0").trim(), 10);
                    const h = Number.isFinite(horas) && horas >= 0 ? horas : 0;
                    const m = Number.isFinite(minutos) && minutos >= 0 ? minutos : 0;
                    if (tiempoEl instanceof HTMLInputElement) {
                        tiempoEl.value = String((h * 60) + m);
                    }
                };

                buildSheetWheel({
                    root: sheet,
                    field: "tiempo_horas",
                    values: Array.from({ length: 13 }, (_, i) => i),
                    format: (value) => `${value} h`,
                    initialValue: String(Math.min(12, Math.max(0, horasIniciales))),
                    includeEmpty: false,
                    onChange: syncTiempoTotalMin,
                    inputSelector: "[data-pt-tiempo_horas]",
                });

                buildSheetWheel({
                    root: sheet,
                    field: "tiempo_minutos",
                    values: Array.from({ length: 60 }, (_, i) => i),
                    format: (value) => `${String(value).padStart(2, "0")} min`,
                    initialValue: String(Math.min(59, Math.max(0, minutosIniciales))),
                    includeEmpty: false,
                    onChange: syncTiempoTotalMin,
                    inputSelector: "[data-pt-tiempo_minutos]",
                });

                syncTiempoTotalMin();

                btnConfirmar?.addEventListener("click", async () => {
                    const caloriasQuemadas = Number.parseInt(String(caloriasEl?.value ?? "").trim(), 10);
                    const tiempoTotalMin = Number.parseInt(String(tiempoEl?.value ?? "").trim(), 10);

                    if (!Number.isFinite(caloriasQuemadas) || caloriasQuemadas < 0) {
                        await openStatusSheet({
                            title: tLang("Dato inválido", "Invalid data"),
                            message: tLang("Ingresá una cantidad válida de calorías quemadas.", "Enter a valid number of calories burned."),
                            stacked: true,
                        });
                        return;
                    }

                    if (!Number.isFinite(tiempoTotalMin) || tiempoTotalMin <= 0) {
                        await openStatusSheet({
                            title: tLang("Dato inválido", "Invalid data"),
                            message: tLang("Ingresá un tiempo total de entreno válido en minutos.", "Enter a valid total workout time in minutes."),
                            stacked: true,
                        });
                        return;
                    }

                    const now = getHoraActualLocal();
                    const idRegistro = (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function")
                        ? globalThis.crypto.randomUUID()
                        : `${dia_Actual}-${now.iso}-${Math.random().toString(36).slice(2, 10)}`;

                    // Registro en formato legible (para compatibilidad interna)
                    const registro = {
                        id_registro: idRegistro,
                        fecha: dia_Actual,
                        titulo_entreno: desc_ent || dia_ent || "",
                        descripcion: desc_ent || "",
                        calorias_quemadas: caloriasQuemadas,
                        tiempo_total_min: tiempoTotalMin,
                        hora_confirmacion: now.hora,
                        confirmado_en: now.iso,
                    };

                    // Transformar/insertar en el formato solicitado: Dias_cale = [{ title, start, extendedProps: { calories_burnt, status, ... } }, ...]
                    const diasArray = Array.isArray(registrosPrevios) ? registrosPrevios.slice() : [];

                    const newEntry = {
                        id_registro: registro.id_registro,
                        title: registro.titulo_entreno || registro.descripcion || `Entreno ${registro.fecha}`,
                        start: registro.fecha,
                        extendedProps: {
                            calories_burnt: Number.isFinite(caloriasQuemadas) ? caloriasQuemadas : null,
                            tiempo_total_min: Number.isFinite(tiempoTotalMin) ? tiempoTotalMin : null,
                            hora_confirmacion: registro.hora_confirmacion,
                            confirmado_en: registro.confirmado_en,
                            status: "completado",
                        },
                    };

                    // Buscar índice por id único; así varios entrenos del mismo día pueden coexistir.
                    const idx = diasArray.findIndex((d) => {
                        if (!d) return false;
                        if (d.id_registro && d.id_registro === registro.id_registro) return true;
                        if (d.id && d.id === registro.id_registro) return true;
                        return false;
                    });

                    if (idx >= 0) {
                        diasArray[idx] = newEntry;
                    } else {
                        diasArray.push(newEntry);
                    }

                    localStorage.setItem("Dias_cale", JSON.stringify(diasArray));

                    // Enviar array actualizado al edge-function / guardar
                    try {
                        const res = await guardarRegistroEntreno(diasArray);
                        if (!res || !res.ok) {
                            const txt = res ? await res.text().catch(() => null) : null;
                            console.warn("No se pudo guardar Dias_cale:", res?.status, txt);
                            await openStatusSheet({ title: tLang("Error", "Error"), message: tLang("No se pudo guardar el registro. Intenta de nuevo.", "Could not save the record. Please try again.") });
                            return;
                        }
                    } catch (err) {
                        console.error("Error al guardar Dias_cale:", err);
                        await openStatusSheet({ title: tLang("Error", "Error"), message: tLang("Error al guardar el registro.", "Error saving the record.") });
                        return;
                    }
                    try { globalThis.PTBottomSheet?.close?.(); } catch { }

                    await openStatusSheet({
                        title: tLang("Entreno registrado", "Workout registered"),
                        message: tLang(
                            `Se guardó el entreno de hoy a las ${now.hora}.`,
                            `Today's workout was saved at ${now.hora}.`
                        ),
                    });

                    try {
                        verificacion_plan_entrenamiento();
                    } catch (err) {
                        console.warn("No se pudo refrescar la vista del plan:", err);
                    }
                });
            },
        });
    };

    const openDetalle = async (cardEl) => {
        const dayIdx = Number(cardEl?.getAttribute?.("data-day-idx"));
        const exIdx = Number(cardEl?.getAttribute?.("data-idx"));
        if (!Number.isFinite(dayIdx) || !Number.isFinite(exIdx)) return;

        const planRaw = localStorage.getItem("plan_entreno_usuario");
        const dias = parsePlanDiasDetallados(planRaw);
        if (!Array.isArray(dias) || !dias[dayIdx]) return;

        const diaInfo = dias[dayIdx];
        const ejercicios = Array.isArray(diaInfo.ejercicios) ? diaInfo.ejercicios : [];
        const ex = ejercicios[exIdx];
        if (!ex) return;

        // ── Mapa estático de descripciones detalladas por ejercicio ──────────────
        const _stripKey = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
        const EJERCICIOS_DETALLE = {
            // ── PECHO ────────────────────────────────────────────────────────────
            "press de banca plano con barra": {
                es: { tecnica: "Retrae las escápulas y mantén los pies firmes en el suelo. Baja la barra hasta rozar el pecho (línea del esternón), codos a ~75° del tronco. Rango completo sin rebotar.", sobrecarga: "Sube 2,5 kg cuando completes todas las series y reps con buena técnica durante 2 sesiones consecutivas.", respiracion: "Inhala al bajar la barra; exhala con fuerza al empujar." },
                en: { tecnica: "Retract your shoulder blades and keep your feet flat on the floor. Lower the bar to your sternum with elbows at ~75° from your torso. Full range, no bouncing.", sobrecarga: "Add 2.5 kg once you complete all sets and reps with good form for 2 consecutive sessions.", respiracion: "Inhale as the bar descends; exhale forcefully as you press." },
            },
            "press de banca inclinado con mancuernas": {
                es: { tecnica: "Banco a 30-45°. Empuja las mancuernas hacia arriba y ligeramente hacia adentro. Controla la bajada 2-3 seg; no dejes que los codos caigan por debajo del plano del banco.", sobrecarga: "Sube de peso cuando puedas hacer el rango completo de reps con técnica sólida en 2 sesiones seguidas.", respiracion: "Inhala en la bajada; exhala al empujar las mancuernas." },
                en: { tecnica: "Set bench to 30-45°. Press dumbbells up and slightly inward. Control the descent for 2-3 sec; don't let elbows drop below bench level.", sobrecarga: "Increase weight when you can complete the full rep range with solid form for 2 sessions in a row.", respiracion: "Inhale on the way down; exhale as you press the dumbbells up." },
            },
            "flexiones de brazos (peso corporal)": {
                es: { tecnica: "Manos a la anchura de los hombros, cuerpo en línea recta de talones a cabeza. Baja el pecho hasta casi tocar el suelo; codos a ~45° del torso.", sobrecarga: "Aumenta las reps hasta llegar a 20; luego añade dificultad (pies elevados, chaleco con peso o pausa de 2 seg abajo).", respiracion: "Inhala al bajar; exhala al empujar." },
                en: { tecnica: "Hands shoulder-width apart, body in a straight line from heels to head. Lower your chest nearly to the floor; elbows at ~45° from your torso.", sobrecarga: "Increase reps until you hit 20; then add difficulty (elevated feet, weighted vest, or 2-sec pause at the bottom).", respiracion: "Inhale as you lower; exhale as you push up." },
            },
            "aperturas con mancuernas": {
                es: { tecnica: "Banco plano o inclinado. Baja las mancuernas en arco con codos ligeramente flexionados hasta sentir estiramiento en el pecho. No exageres el rango para proteger los hombros.", sobrecarga: "Incrementa el peso cuando completes todas las reps sin perder el arco controlado durante 2 sesiones.", respiracion: "Inhala al abrir; exhala al cerrar y contraer el pecho." },
                en: { tecnica: "Flat or inclined bench. Lower dumbbells in an arc with slightly bent elbows until you feel a chest stretch. Don't over-extend to protect your shoulders.", sobrecarga: "Increase weight when you complete all reps without losing the controlled arc for 2 sessions.", respiracion: "Inhale as you open; exhale as you close and squeeze the chest." },
            },
            "fondos en paralelas (pecho bajo/triceps)": {
                es: { tecnica: "Para priorizar pecho: inclínate ligeramente hacia adelante, codos hacia afuera. Baja hasta que los hombros queden por debajo de los codos. Sube sin bloquear los codos.", sobrecarga: "Añade peso con cinturón o mochila en cuanto superes 12 reps con buena técnica.", respiracion: "Inhala al bajar; exhala al subir." },
                en: { tecnica: "For chest focus: lean slightly forward, flare elbows out. Descend until shoulders are below elbows. Press up without locking out elbows.", sobrecarga: "Add weight with a belt or backpack once you exceed 12 reps with good form.", respiracion: "Inhale on the way down; exhale on the way up." },
            },
            "cruce de poleas": {
                es: { tecnica: "Poleas a la altura de los hombros o por encima. Lleva las manos hacia el centro y cruza ligeramente, apretando el pecho al final del movimiento. Movimiento controlado en todo momento.", sobrecarga: "Sube el peso cuando logres el tope de reps apretando bien en la contracción durante 2 sesiones.", respiracion: "Inhala en la apertura; exhala al hacer el cruce y la contracción." },
                en: { tecnica: "Set cables at shoulder height or above. Bring hands to center and slightly cross, squeezing the chest at the end of the movement. Keep control throughout.", sobrecarga: "Increase weight when you hit the top of your rep range with a strong contraction for 2 sessions.", respiracion: "Inhale as you open; exhale on the cross and squeeze." },
            },
            // ── ESPALDA ──────────────────────────────────────────────────────────
            "dominadas (peso corporal)": {
                es: { tecnica: "Agarre prono, manos a la anchura de los hombros. Inicia el movimiento retrayendo las escápulas. Sube hasta que la barbilla supere la barra; baja de forma controlada.", sobrecarga: "Añade peso con cinturón cuando hagas 10 reps limpias. Si no llegas a 5, usa banda de asistencia.", respiracion: "Exhala al subir; inhala de forma controlada al bajar." },
                en: { tecnica: "Pronated grip, hands shoulder-width apart. Initiate by retracting your scapulae. Pull until your chin clears the bar; lower in a controlled manner.", sobrecarga: "Add weight with a belt once you can do 10 clean reps. If you can't do 5, use a resistance band for assistance.", respiracion: "Exhale as you pull up; inhale in a controlled way as you lower." },
            },
            "jalon al pecho en polea": {
                es: { tecnica: "Agarre prono a la anchura de los hombros. Inclínate ligeramente hacia atrás (10-15°) y lleva la barra hasta la clavícula, apretando los dorsales. Controla la subida.", sobrecarga: "Aumenta el peso cuando completes el rango completo de reps con retracción escapular durante 2 sesiones.", respiracion: "Exhala al tirar hacia abajo; inhala al dejar subir la barra." },
                en: { tecnica: "Pronated grip at shoulder width. Lean back slightly (10-15°) and pull the bar to your collarbone, squeezing your lats. Control the return.", sobrecarga: "Increase weight when you complete the full rep range with scapular retraction for 2 sessions.", respiracion: "Exhale as you pull down; inhale as you let the bar rise." },
            },
            "remo con barra": {
                es: { tecnica: "Espalda plana, bisagra de cadera hasta ~45°. Tira la barra hacia el ombligo, codos cerca del cuerpo. Retrae y deprime las escápulas al final. No redondees la zona lumbar.", sobrecarga: "Sube 2,5-5 kg cuando completes todas las series manteniendo espalda plana durante 2 sesiones.", respiracion: "Exhala al tirar; inhala al extender los brazos." },
                en: { tecnica: "Flat back, hip hinge to ~45°. Pull the bar toward your navel, keeping elbows close. Retract and depress your scapulae at the top. Never round your lower back.", sobrecarga: "Add 2.5-5 kg when you complete all sets with a flat back for 2 sessions.", respiracion: "Exhale as you pull; inhale as you extend your arms." },
            },
            "remo unilateral con mancuerna": {
                es: { tecnica: "Apoya mano y rodilla en el banco. Espalda paralela al suelo. Tira la mancuerna hacia la cadera, rotando ligeramente el torso. Al bajar, extiende bien la escápula.", sobrecarga: "Sube el peso cuando domines el rango completo en todas las reps con rotación controlada durante 2 sesiones.", respiracion: "Exhala al tirar hacia arriba; inhala al bajar la mancuerna." },
                en: { tecnica: "Support one hand and knee on a bench. Back parallel to the floor. Pull the dumbbell toward your hip with slight torso rotation. On the way down, fully extend your scapula.", sobrecarga: "Increase weight when you master the full range across all reps with controlled rotation for 2 sessions.", respiracion: "Exhale as you pull up; inhale as you lower the dumbbell." },
            },
            "remo sentado en polea": {
                es: { tecnica: "Siéntate erguido, agarra el cable con codos cerca del cuerpo. Tira hasta que el mango toque el abdomen, apretando las escápulas. No uses la inercia del torso.", sobrecarga: "Aumenta el peso cuando logres el tope de reps sin balanceo durante 2 sesiones consecutivas.", respiracion: "Exhala al tirar el cable hacia ti; inhala al extender los brazos." },
                en: { tecnica: "Sit upright, grip the cable with elbows close to your body. Pull until the handle touches your abdomen, squeezing your scapulae. Don't use torso momentum.", sobrecarga: "Increase weight when you hit the top of your rep range without swinging for 2 consecutive sessions.", respiracion: "Exhale as you pull the cable toward you; inhale as you extend." },
            },
            "hiperextensiones lumbares": {
                es: { tecnica: "Caderas apoyadas en el banco romano. Baja el tronco hasta ~90° y sube hasta que el cuerpo quede en línea recta (no hiperextiendas). Glúteos activos al subir.", sobrecarga: "Cuando domines 15 reps con peso corporal, añade una mancuerna o disco al pecho.", respiracion: "Inhala al bajar; exhala al subir y contraer los glúteos." },
                en: { tecnica: "Hips supported on the Roman chair. Lower your torso to ~90° and rise until your body is in a straight line (don't hyper-extend). Squeeze your glutes on the way up.", sobrecarga: "Once you master 15 bodyweight reps, add a dumbbell or plate to your chest.", respiracion: "Inhale as you lower; exhale as you rise and squeeze your glutes." },
            },
            // ── PIERNAS ──────────────────────────────────────────────────────────
            "sentadilla libre": {
                es: { tecnica: "Pies a la anchura de los hombros, puntas ligeramente abiertas. Baja manteniendo el torso erguido y las rodillas alineadas con los pies. Profundidad mínima: muslos paralelos al suelo.", sobrecarga: "Sube 2,5 kg cuando completes todas las series con técnica sólida (rodillas sin colapsar) durante 2 sesiones.", respiracion: "Inhala profundamente antes de bajar (maniobra de Valsalva suave); exhala al subir." },
                en: { tecnica: "Feet shoulder-width apart, toes slightly turned out. Descend keeping your torso upright and knees tracking over your feet. Minimum depth: thighs parallel to the floor.", sobrecarga: "Add 2.5 kg when you complete all sets with solid form (no knee cave) for 2 sessions.", respiracion: "Take a deep breath before descending (gentle Valsalva); exhale as you rise." },
            },
            "prensa de piernas": {
                es: { tecnica: "Espalda y glúteos pegados al respaldo. Pies en la plataforma a la anchura de los hombros. Baja hasta que las rodillas formen ~90° sin despegar el glúteo del asiento.", sobrecarga: "Incrementa el peso cuando completes el rango de reps sin despegar los glúteos durante 2 sesiones.", respiracion: "Inhala al bajar; exhala al empujar la plataforma." },
                en: { tecnica: "Back and glutes flat against the pad. Feet on the platform shoulder-width apart. Lower until your knees reach ~90° without lifting your hips off the seat.", sobrecarga: "Add weight when you complete the full rep range without hips lifting for 2 sessions.", respiracion: "Inhale as you lower; exhale as you push the platform." },
            },
            "zancadas / estocadas": {
                es: { tecnica: "Da un paso amplio hacia adelante. La rodilla trasera casi toca el suelo; la rodilla delantera no debe sobrepasar los dedos del pie. Torso erguido durante todo el movimiento.", sobrecarga: "Añade mancuernas o barra cuando domines 12 reps por pierna con equilibrio estable durante 2 sesiones.", respiracion: "Inhala al bajar; exhala al empujar y volver a la posición inicial." },
                en: { tecnica: "Step forward with a long stride. The rear knee almost touches the floor; the front knee should not pass your toes. Keep your torso upright throughout.", sobrecarga: "Add dumbbells or a barbell once you complete 12 reps per leg with stable balance for 2 sessions.", respiracion: "Inhale as you lower; exhale as you drive back to the starting position." },
            },
            "peso muerto rumano": {
                es: { tecnica: "Rodillas ligeramente flexionadas, bisagra de cadera: baja la barra deslizándola por las piernas hasta sentir el estiramiento en isquiotibiales. Espalda neutra en todo momento.", sobrecarga: "Sube 2,5-5 kg cuando mantengas la espalda completamente neutra en todo el rango durante 2 sesiones.", respiracion: "Inhala antes de bajar (bracing); exhala al volver a la posición erguida." },
                en: { tecnica: "Knees slightly bent, hip hinge: lower the bar sliding it down your legs until you feel a hamstring stretch. Neutral spine at all times.", sobrecarga: "Add 2.5-5 kg when you maintain a completely neutral back through the full range for 2 sessions.", respiracion: "Inhale before descending (brace your core); exhale as you return to standing." },
            },
            "hip thrust (empuje de cadera)": {
                es: { tecnica: "Hombros apoyados en el banco, barra sobre el pliegue de la cadera. Empuja hasta que caderas, muslos y torso formen una línea recta. Aprieta los glúteos en el punto más alto.", sobrecarga: "Aumenta el peso cuando puedas mantener la contracción máxima 1 seg en todas las reps durante 2 sesiones.", respiracion: "Inhala al bajar; exhala y aprieta los glúteos al subir." },
                en: { tecnica: "Shoulders against the bench, bar over your hip crease. Drive until hips, thighs, and torso form a straight line. Squeeze glutes hard at the top.", sobrecarga: "Add weight once you can hold the peak contraction for 1 sec on every rep for 2 sessions.", respiracion: "Inhale as you lower; exhale and squeeze your glutes as you thrust up." },
            },
            "extension de cuadriceps en maquina": {
                es: { tecnica: "Ajusta el asiento para que la articulación de la rodilla quede alineada con el pivote de la máquina. Extiende completamente y mantén 1 seg; baja de forma controlada (2-3 seg).", sobrecarga: "Sube el peso cuando logres la contracción completa y pausa en todas las reps durante 2 sesiones.", respiracion: "Exhala al extender; inhala al bajar." },
                en: { tecnica: "Adjust the seat so your knee joint aligns with the machine pivot. Fully extend and hold 1 sec; lower in a controlled manner (2-3 sec).", sobrecarga: "Increase weight when you achieve full extension with a pause on every rep for 2 sessions.", respiracion: "Exhale as you extend; inhale as you lower." },
            },
            "curl femoral tumbado o sentado": {
                es: { tecnica: "Caderas pegadas al banco. Flexiona hasta ~120-130° (máxima contracción del femoral); extiende lentamente sin bloquear la rodilla al final.", sobrecarga: "Incrementa el peso cuando completes el rango completo sin levantar las caderas durante 2 sesiones.", respiracion: "Exhala al flexionar; inhala al extender." },
                en: { tecnica: "Hips pressed against the pad. Curl to ~120-130° (peak hamstring contraction); extend slowly without locking out your knee.", sobrecarga: "Increase weight when you complete the full range without lifting your hips for 2 sessions.", respiracion: "Exhale as you curl; inhale as you extend." },
            },
            "elevacion de talones": {
                es: { tecnica: "De pie en el borde de un escalón. Baja el talón por debajo del nivel del escalón para el estiramiento máximo; sube de puntillas lo más alto posible. Pausa arriba 1 seg.", sobrecarga: "Añade peso (mancuerna en mano o mochila) cuando superes 20 reps con pausa completa durante 2 sesiones.", respiracion: "Exhala al subir; inhala al bajar." },
                en: { tecnica: "Stand on the edge of a step. Lower your heel below step level for maximum stretch; rise as high as possible on your toes. Pause for 1 sec at top.", sobrecarga: "Add weight (dumbbell in hand or backpack) once you exceed 20 reps with a full pause for 2 sessions.", respiracion: "Exhale as you rise; inhale as you lower." },
            },
            "sentadilla bulgara": {
                es: { tecnica: "Pie trasero apoyado en el banco, pie delantero lo suficientemente adelante para que la rodilla no sobrepase los dedos. Baja de forma controlada hasta que la rodilla trasera roz el suelo.", sobrecarga: "Añade mancuernas o barra cuando domines 10 reps sólidas por pierna durante 2 sesiones consecutivas.", respiracion: "Inhala al bajar; exhala al subir empujando con el talón delantero." },
                en: { tecnica: "Rear foot elevated on a bench, front foot far enough forward so your knee doesn't pass your toes. Lower in a controlled way until your rear knee nearly touches the floor.", sobrecarga: "Add dumbbells or a barbell once you complete 10 solid reps per leg for 2 consecutive sessions.", respiracion: "Inhale as you lower; exhale as you drive up through your front heel." },
            },
            // ── HOMBROS ──────────────────────────────────────────────────────────
            "press militar con barra o mancuernas": {
                es: { tecnica: "De pie o sentado. Empuja la barra/mancuernas verticalmente por encima de la cabeza hasta que los brazos queden casi extendidos. No arquees la zona lumbar al bloquear.", sobrecarga: "Sube 2,5 kg cuando completes todas las series sin arqueo lumbar durante 2 sesiones.", respiracion: "Inhala antes del empuje; exhala al presionar hacia arriba." },
                en: { tecnica: "Standing or seated. Press the bar/dumbbells vertically overhead until your arms are nearly extended. Don't arch your lower back at lockout.", sobrecarga: "Add 2.5 kg when you complete all sets without lower back arch for 2 sessions.", respiracion: "Inhale before the press; exhale as you push overhead." },
            },
            "elevaciones laterales con mancuernas": {
                es: { tecnica: "Codos ligeramente flexionados. Sube hasta que los brazos queden paralelos al suelo (no más). Pequeña rotación externa al final: el meñique ligeramente más alto que el pulgar.", sobrecarga: "Incrementa el peso cuando puedas completar todas las reps con control total (sin trampa) durante 2 sesiones.", respiracion: "Exhala al subir; inhala al bajar de forma controlada." },
                en: { tecnica: "Elbows slightly bent. Raise until arms are parallel to the floor (no higher). Slight external rotation at the top: pinky slightly higher than thumb.", sobrecarga: "Increase weight when you can complete all reps with full control (no cheating) for 2 sessions.", respiracion: "Exhale as you raise; inhale as you lower in a controlled way." },
            },
            "pajaros / vuelos posteriores": {
                es: { tecnica: "Torso inclinado ~90°. Sube las mancuernas con codos ligeramente flexionados hasta que queden alineados con los hombros, apretando los deltoides posteriores.", sobrecarga: "Sube el peso cuando logres la alineación correcta en todas las reps durante 2 sesiones.", respiracion: "Exhala al subir; inhala al bajar." },
                en: { tecnica: "Torso bent ~90°. Raise dumbbells with slightly bent elbows until aligned with your shoulders, squeezing the rear delts.", sobrecarga: "Increase weight when you achieve correct alignment on every rep for 2 sessions.", respiracion: "Exhale as you raise; inhale as you lower." },
            },
            "elevaciones frontales": {
                es: { tecnica: "De pie, mancuernas al frente con agarre neutro o prono. Sube hasta la altura de los ojos (no más). Evita el balanceo del torso.", sobrecarga: "Incrementa el peso cuando completes todas las reps sin balanceo durante 2 sesiones consecutivas.", respiracion: "Exhala al subir; inhala al bajar de forma controlada." },
                en: { tecnica: "Standing, dumbbells in front with neutral or pronated grip. Raise to eye level (no higher). Avoid torso swinging.", sobrecarga: "Increase weight when you complete all reps without swinging for 2 consecutive sessions.", respiracion: "Exhale as you raise; inhale as you lower in a controlled manner." },
            },
            "face pull (salud del hombro)": {
                es: { tecnica: "Polea alta con cuerda. Tira hacia la cara separando la cuerda y rotando externamente los hombros. Codos por encima del agarre. Foco en deltoides posterior y manguito rotador.", sobrecarga: "Sube el peso solo cuando mantengas la rotación external completa en todas las reps durante 2 sesiones.", respiracion: "Exhala al tirar hacia la cara; inhala al extender los brazos." },
                en: { tecnica: "High cable with rope. Pull toward your face splitting the rope and rotating your shoulders externally. Elbows above the handles. Focus on rear delt and rotator cuff.", sobrecarga: "Increase weight only when you maintain full external rotation on every rep for 2 sessions.", respiracion: "Exhale as you pull toward your face; inhale as you extend your arms." },
            },
            // ── BRAZOS / BÍCEPS ──────────────────────────────────────────────────
            "curl de biceps con barra": {
                es: { tecnica: "Codos pegados a los costados. Sube la barra en arco controlado hasta la contracción máxima; baja despacio (2-3 seg). No uses la inercia del torso.", sobrecarga: "Sube 2,5 kg cuando puedas completar todas las reps sin balanceo durante 2 sesiones.", respiracion: "Exhala al subir; inhala al bajar." },
                en: { tecnica: "Keep elbows pinned to your sides. Curl in a controlled arc to peak contraction; lower slowly (2-3 sec). Don't use torso momentum.", sobrecarga: "Add 2.5 kg when you can complete all reps without swinging for 2 sessions.", respiracion: "Exhale as you curl up; inhale as you lower." },
            },
            "curl martillo con mancuernas": {
                es: { tecnica: "Agarre neutro (pulgares arriba). Codos fijos a los lados. Sube hasta la contracción y baja controlado. Trabaja braquial y braquiorradial además del bíceps.", sobrecarga: "Incrementa el peso cuando completes todas las reps con codos fijos durante 2 sesiones.", respiracion: "Exhala al subir; inhala al bajar." },
                en: { tecnica: "Neutral grip (thumbs up). Elbows fixed at your sides. Curl to peak contraction and lower in control. Targets brachialis and brachioradialis in addition to the bicep.", sobrecarga: "Increase weight when you complete all reps with fixed elbows for 2 sessions.", respiracion: "Exhale as you curl; inhale as you lower." },
            },
            "curl predicador": {
                es: { tecnica: "Brazos apoyados en el soporte inclinado. Evita el balanceo y el bloqueo completo al bajar para mantener tensión. Foco en la parte baja del bíceps.", sobrecarga: "Sube el peso cuando domines el rango completo sin balanceo durante 2 sesiones consecutivas.", respiracion: "Exhala al subir; inhala al bajar de forma controlada." },
                en: { tecnica: "Arms rested on the inclined pad. Avoid swinging and full lockout at the bottom to keep tension. Targets the lower portion of the bicep.", sobrecarga: "Increase weight when you master the full range without swinging for 2 consecutive sessions.", respiracion: "Exhale as you curl; inhale as you lower in a controlled way." },
            },
            // ── TRÍCEPS ──────────────────────────────────────────────────────────
            "press frances": {
                es: { tecnica: "Barra EZ tumbado. Codos apuntando al techo, fijos. Baja la barra hasta la frente o detrás de la cabeza (mayor estiramiento). Extiende sin bloquear completamente.", sobrecarga: "Sube 2,5 kg cuando completes todas las reps con codos fijos y sin dolor en el codo durante 2 sesiones.", respiracion: "Inhala al bajar; exhala al extender." },
                en: { tecnica: "EZ-bar lying down. Elbows pointing toward the ceiling, fixed. Lower the bar toward your forehead or behind your head (greater stretch). Extend without fully locking out.", sobrecarga: "Add 2.5 kg when you complete all reps with fixed elbows and no elbow pain for 2 sessions.", respiracion: "Inhale as you lower; exhale as you extend." },
            },
            "extension de triceps en polea alta": {
                es: { tecnica: "Cuerda o barra en polea alta. Codos fijos a los lados del cuerpo. Extiende hasta la máxima contracción del tríceps; sube de forma controlada.", sobrecarga: "Incrementa el peso cuando logres la contracción máxima en todas las reps sin mover los codos durante 2 sesiones.", respiracion: "Exhala al extender; inhala al subir." },
                en: { tecnica: "Rope or bar on high cable. Elbows fixed at your sides. Extend to maximum tricep contraction; return in a controlled way.", sobrecarga: "Add weight when you achieve peak contraction on every rep without moving your elbows for 2 sessions.", respiracion: "Exhale as you extend; inhale as you return." },
            },
            "fondos entre bancos": {
                es: { tecnica: "Manos en el banco trasero, pies en el banco delantero o en el suelo. Baja hasta que los codos formen 90°; sube sin bloquear por completo. Torso erguido para foco en tríceps.", sobrecarga: "Añade un disco sobre los muslos cuando superes 15 reps con buena técnica durante 2 sesiones.", respiracion: "Inhala al bajar; exhala al subir." },
                en: { tecnica: "Hands on the rear bench, feet on the front bench or floor. Lower until elbows reach 90°; press up without fully locking out. Upright torso for tricep focus.", sobrecarga: "Add a plate on your thighs once you exceed 15 reps with good form for 2 sessions.", respiracion: "Inhale as you lower; exhale as you press up." },
            },
            "extension de triceps con mancuerna sobre la cabeza": {
                es: { tecnica: "Siéntate o de pie. Mancuerna con ambas manos sobre la cabeza. Codos cerca de las orejas; baja la mancuerna detrás de la cabeza controlando el estiramiento del tríceps largo.", sobrecarga: "Sube el peso cuando manejes el rango completo con codos estables durante 2 sesiones.", respiracion: "Inhala al bajar; exhala al extender." },
                en: { tecnica: "Seated or standing. Hold a dumbbell with both hands overhead. Keep elbows near your ears; lower the dumbbell behind your head controlling the long head stretch.", sobrecarga: "Increase weight when you handle the full range with stable elbows for 2 sessions.", respiracion: "Inhale as you lower; exhale as you extend." },
            },
            "patada de triceps con mancuerna": {
                es: { tecnica: "Torso paralelo al suelo, codo elevado a la altura de la cadera. Extiende el antebrazo hacia atrás hasta la máxima contracción; vuelve de forma controlada. Codo fijo.", sobrecarga: "Incrementa el peso cuando logres la extensión completa y contracción máxima en todas las reps durante 2 sesiones.", respiracion: "Exhala al extender; inhala al regresar." },
                en: { tecnica: "Torso parallel to the floor, elbow raised to hip height. Extend your forearm back to peak contraction; return in a controlled way. Keep elbow fixed.", sobrecarga: "Add weight when you achieve full extension and peak contraction on every rep for 2 sessions.", respiracion: "Exhale as you extend; inhale as you return." },
            },
            // ── ANTEBRAZOS ───────────────────────────────────────────────────────
            "curl de muneca con barra": {
                es: { tecnica: "Antebrazos apoyados en el banco o muslos. Flexiona la muñeca con rango completo; baja con control. Peso ligero, altas repeticiones.", sobrecarga: "Sube el peso poco a poco (1-2 kg) cuando domines 20 reps por sesión durante 2 semanas.", respiracion: "Exhala al flexionar; inhala al bajar." },
                en: { tecnica: "Forearms resting on a bench or your thighs. Flex your wrist through the full range; lower in control. Use light weight and high reps.", sobrecarga: "Increase weight gradually (1-2 kg) once you master 20 reps per session for 2 weeks.", respiracion: "Exhale as you flex; inhale as you lower." },
            },
            "curl de muneca con mancuerna": {
                es: { tecnica: "Igual que con barra, pero permite mayor rango de movimiento individual por muñeca. Trabaja un brazo a la vez para corregir desequilibrios.", sobrecarga: "Sube el peso cuando completes 20 reps limpias con rango completo durante 2 sesiones.", respiracion: "Exhala al flexionar; inhala al extender." },
                en: { tecnica: "Same as barbell but allows a greater individual range per wrist. Work one arm at a time to address imbalances.", sobrecarga: "Increase weight when you complete 20 clean reps with full range for 2 sessions.", respiracion: "Exhale as you flex; inhale as you extend." },
            },
            "curl invertido con barra": {
                es: { tecnica: "Agarre prono (dorso de la mano arriba). Codos fijos a los lados. Trabaja extensores del antebrazo y braquiorradial. Mantén la muñeca neutra al subir.", sobrecarga: "Incrementa el peso cuando completes todas las reps con muñeca neutra y sin balanceo durante 2 sesiones.", respiracion: "Exhala al subir; inhala al bajar." },
                en: { tecnica: "Pronated grip (back of hand facing up). Elbows fixed at sides. Targets forearm extensors and brachioradialis. Keep wrist neutral at the top.", sobrecarga: "Increase weight when you complete all reps with a neutral wrist and no swinging for 2 sessions.", respiracion: "Exhale as you curl; inhale as you lower." },
            },
            "farmer's walk (caminata del granjero)": {
                es: { tecnica: "Carga pesada en ambas manos. Espalda recta, hombros hacia atrás y abajo. Camina con pasos medianos y firmes. Foco en el agarre y la estabilidad del core.", sobrecarga: "Aumenta el peso o la distancia cuando puedas mantener la técnica perfecta durante toda la distancia en 2 sesiones.", respiracion: "Respira de forma continua y controlada; no aguantes la respiración." },
                en: { tecnica: "Heavy load in both hands. Straight back, shoulders back and down. Walk with medium, firm steps. Focus on grip and core stability.", sobrecarga: "Increase weight or distance when you can maintain perfect form throughout the entire distance for 2 sessions.", respiracion: "Breathe continuously and in control; don't hold your breath." },
            },
            // ── ABDOMEN / CORE ───────────────────────────────────────────────────
            "plancha abdominal": {
                es: { tecnica: "Antebrazos y pies apoyados. Activa el core (empuja el ombligo hacia la columna). Cuerpo en línea recta; no elevar las caderas ni dejarlas caer.", sobrecarga: "Aumenta el tiempo de mantenimiento (objetivo: 60-90 seg) antes de agregar variantes con peso o movimiento.", respiracion: "Respira de forma continua y controlada; no aguantes la respiración." },
                en: { tecnica: "Resting on forearms and feet. Engage your core (draw navel toward your spine). Body in a straight line; don't raise or drop your hips.", sobrecarga: "Increase hold time (target: 60-90 sec) before adding weighted or dynamic variations.", respiracion: "Breathe continuously and in control; never hold your breath." },
            },
            "crunch abdominal clasico": {
                es: { tecnica: "Tumbado, rodillas flexionadas. Eleva solo los hombros del suelo curvando la columna (no la cadera). Aprieta el abdomen en la cima; baja de forma controlada.", sobrecarga: "Añade resistencia (disco en el pecho) cuando superes 20 reps limpias durante 2 sesiones.", respiracion: "Exhala al subir y apretar; inhala al bajar." },
                en: { tecnica: "Lying down, knees bent. Raise your shoulders off the floor by curling your spine (not your hips). Squeeze your abs at the top; lower in control.", sobrecarga: "Add resistance (plate on chest) once you exceed 20 clean reps for 2 sessions.", respiracion: "Exhale as you crunch; inhale as you lower." },
            },
            "elevacion de piernas colgado o en suelo": {
                es: { tecnica: "Colgado en barra: pelvis ligeramente retrovertida. Eleva las piernas rectas (o flexionadas) hasta la horizontal o más. Evita el balanceo.", sobrecarga: "Avanza de piernas flexionadas a rectas; luego añade tobilleras con peso cuando domines 12 reps limpias.", respiracion: "Exhala al elevar; inhala al bajar de forma controlada." },
                en: { tecnica: "Hanging from a bar: posterior pelvic tilt. Raise straight (or bent) legs to horizontal or higher. Avoid swinging.", sobrecarga: "Progress from bent legs to straight legs; then add ankle weights once you master 12 clean reps.", respiracion: "Exhale as you raise; inhale as you lower in a controlled way." },
            },
            "giros rusos": {
                es: { tecnica: "Sentado con el torso a ~45°, pies elevados (opcional). Gira el torso de lado a lado con control; no solo los brazos. Usa un disco o mancuerna para añadir resistencia.", sobrecarga: "Incrementa el peso cuando puedas hacer 20 reps por lado con rotación real del torso durante 2 sesiones.", respiracion: "Exhala en cada giro; inhala al centro." },
                en: { tecnica: "Seated with torso at ~45°, feet elevated (optional). Rotate your torso side to side in control; don't just move your arms. Use a plate or dumbbell for resistance.", sobrecarga: "Add weight when you can do 20 reps per side with real torso rotation for 2 sessions.", respiracion: "Exhale on each twist; inhale as you return to center." },
            },
            "rueda abdominal": {
                es: { tecnica: "Rodillas en el suelo. Rueda hacia adelante extendiendo la cadera y columna casi hasta el suelo; regresa activando el core sin impulso. Es un ejercicio muy exigente.", sobrecarga: "Avanza de rodillas al suelo a de pie (rueda completa) cuando domines 10 reps limpias desde rodillas.", respiracion: "Inhala al extenderte; exhala al contraer el core y volver." },
                en: { tecnica: "Knees on the floor. Roll forward extending your hips and spine nearly to the floor; return using your core without momentum. A very demanding exercise.", sobrecarga: "Progress from kneeling to standing (full rollout) once you master 10 clean kneeling reps.", respiracion: "Inhale as you extend; exhale as you contract your core and return." },
            },
            // ── CARDIO ───────────────────────────────────────────────────────────
            "burpees": {
                es: { tecnica: "De pie → flexión → plancha → flexión de pecho (opcional) → salta con los brazos arriba. Mantén el core activo durante toda la secuencia.", sobrecarga: "Aumenta el número de reps por bloque o reduce el descanso entre series; luego agrega la flexión de pecho en cada rep.", respiracion: "Exhala en el salto; inhala al volver a la posición de plancha." },
                en: { tecnica: "Standing → squat → plank → push-up (optional) → jump with arms overhead. Keep your core active throughout the sequence.", sobrecarga: "Increase reps per block or reduce rest between sets; then add a push-up to each rep.", respiracion: "Exhale on the jump; inhale as you return to plank position." },
            },
            "saltos de tijera": {
                es: { tecnica: "Pies juntos al inicio. Salta abriendo piernas y brazos simultáneamente; aterriza suave sobre la parte delantera del pie con rodillas ligeramente flexionadas.", sobrecarga: "Aumenta la velocidad, el número de reps o añade el ejercicio en circuito con descanso mínimo.", respiracion: "Respira de forma continua y rítmica; no aguantes el aire." },
                en: { tecnica: "Feet together at start. Jump spreading legs and arms simultaneously; land softly on the balls of your feet with knees slightly bent.", sobrecarga: "Increase speed, reps, or incorporate into a circuit with minimal rest.", respiracion: "Breathe continuously and rhythmically; never hold your breath." },
            },
            "salto a la cuerda": {
                es: { tecnica: "Pies juntos o alternados, rodillas ligeramente flexionadas. Muñecas rotan la cuerda (no los hombros). Aterriza en el antepié suavemente.", sobrecarga: "Aumenta la duración del intervalo o la velocidad; luego incorpora saltos dobles (double-unders).", respiracion: "Respira de forma continua y controlada al ritmo del salto." },
                en: { tecnica: "Feet together or alternating, knees slightly bent. Wrists rotate the rope (not shoulders). Land softly on the balls of your feet.", sobrecarga: "Increase interval duration or speed; then incorporate double-unders.", respiracion: "Breathe continuously and in control with the rhythm of your jumps." },
            },
        };

        const buildDetailedHtml = (nombreEjercicio) => {
            const lang = tLang("es", "en");
            const key = _stripKey(nombreEjercicio);
            const detalle = EJERCICIOS_DETALLE[key];

            let tecnica, sobrecarga, respiracion;
            if (detalle && detalle[lang]) {
                tecnica = detalle[lang].tecnica;
                sobrecarga = detalle[lang].sobrecarga;
                respiracion = detalle[lang].respiracion;
            } else {
                // Fallback genérico
                tecnica = tLang("Mantener postura neutra, rango completo y control en la fase excéntrica.", "Maintain neutral posture, full range of motion, and control the eccentric phase.");
                sobrecarga = tLang("Aumentar 2-5% de carga o 1-2 reps cuando completes el rango objetivo durante 1-2 sesiones.", "Add 2-5% weight or 1-2 reps once you hit the target range for 1-2 sessions.");
                respiracion = tLang("Inhala en la fase excéntrica; exhala en la fase concéntrica.", "Inhale on the eccentric phase; exhale on the concentric phase.");
            }

            return `
                        <ul class="plan-detailed-list pt-detail-list">
                            <li><span class="pt-detail-tag">${escapeHtml(tLang("Técnica", "Technique"))}</span><span class="pt-detail-text">${escapeHtml(tecnica)}</span></li>
                            <li><span class="pt-detail-tag">${escapeHtml(tLang("Sobrecarga", "Progression"))}</span><span class="pt-detail-text">${escapeHtml(sobrecarga)}</span></li>
                            <li><span class="pt-detail-tag">${escapeHtml(tLang("Respiración", "Breathing"))}</span><span class="pt-detail-text">${escapeHtml(respiracion)}</span></li>
                        </ul>
                    `;
        };

        const nombreEs = escapeHtml(ex.nombre);
        const nombreEn = escapeHtml(ex.nombre_en ?? ex.nombre);
        const descripcion = escapeHtml(ex.descripcion || "");
        const series = escapeHtml(ex.series);
        const reps = escapeHtml(formatReps(ex.repeticiones));
        const descanso = escapeHtml(ex.descanso_segundos);
        const detailedHtml = buildDetailedHtml(ex.nombre);

        let gifsDict = window.__gifs_cache;
        if (!gifsDict) {
            try {
                const res = await fetch("/Datos/correspondencia_gifs.json");
                if (res.ok) {
                    gifsDict = await res.json();
                    window.__gifs_cache = gifsDict;
                } else {
                    gifsDict = {};
                }
            } catch (e) {
                gifsDict = {};
            }
        }

        let gifUrl = null;
        const _normGif = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
        const searchName = _normGif(ex.nombre);

        for (const [esKey, url] of Object.entries(gifsDict)) {
            const esNorm = _normGif(esKey);
            const enNorm = _normGif(translateExerciseNameToEnglish(esKey));
            if (searchName === esNorm || searchName === enNorm) {
                gifUrl = url;
                break;
            }
        }
        if (!gifUrl) {
            for (const [esKey, url] of Object.entries(gifsDict)) {
                const esNorm = _normGif(esKey);
                const enNorm = _normGif(translateExerciseNameToEnglish(esKey));
                if (searchName.includes(esNorm) || searchName.includes(enNorm) || (esNorm.length > 5 && esNorm.includes(searchName))) {
                    gifUrl = url;
                    break;
                }
            }
        }

        const html = `
            <div class="pt-detail">
                <div class="pt-detail-hero">
                    <div class="pt-detail-hero-row" style="margin-bottom:8px;">
                        <div class="pt-detail-hero-title pt-detail-ex" data-i18n-en="${nombreEn}">${nombreEs}</div>
                    </div>
                    ${gifUrl ? `<img src="${gifUrl}" alt="${nombreEs}" style="width:100%; border-radius:12px; margin-bottom:12px; display:block; background-color:#fff;" loading="lazy" />` : ""}
                    ${descripcion ? `<div class="pt-detail-hero-sub pt-detail-desc" style="white-space:normal;margin-bottom:12px;">${descripcion}</div>` : ""}
                    <div class="plan-meta pt-detail-meta" style="flex-wrap:wrap;gap:8px;margin-bottom:4px;">
                        <span class="plan-chip">${escapeHtml(tLang("Series", "Sets"))}: <strong>${series}</strong></span>
                        <span class="plan-chip">${escapeHtml(tLang("Reps", "Reps"))}: <strong>${reps}</strong></span>
                        <span class="plan-chip plan-chip--vertical"><span class="plan-chip-label">${escapeHtml(tLang("Descanso", "Rest"))}</span><span class="plan-chip-value">${descanso}</span></span>
                    </div>
                </div>
                <div class="pt-detail-body">
                    <div class="plan-detalle-viewport pt-detail-viewport" style="overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1;padding:16px 0;">
                        ${detailedHtml}
                    </div>
                </div>
            </div>
        `;

        // Al abrir el detalle por día, intentamos evitar que la pantalla se bloquee.
        // En algunos navegadores esto requiere gesto del usuario (este click lo es).
        wakeLockManager.setReason("detalle", true, { tryRequest: true });
        void wakeLockManager.requestIfNeeded();

        let onResize = null;
        const closeText = tLang("Cerrar", "Close");

        const openWithSheet = globalThis.PTBottomSheet && typeof globalThis.PTBottomSheet.open === "function";
        if (!openWithSheet) {
            console.error("PTBottomSheet helper not loaded; cannot open plan detail modal.");
            wakeLockManager.setReason("detalle", false);
            return;
        }

        await globalThis.PTBottomSheet.open({
            title: "",
            ariaLabel: `${tLang("Detalle", "Details")}: ${nombreEs}`,
            html,
            closeText,
            didOpen: (sheet) => {
                const root = sheet instanceof HTMLElement ? sheet : document.body;
                try {
                    globalThis.UIIdioma?.translatePage?.(root);
                } catch {
                    // ignore
                }
                const run = () => fitDetalleTipografia(root);
                run();
                requestAnimationFrame(run);
                requestAnimationFrame(run);

                onResize = () => run();
                window.addEventListener("resize", onResize, { passive: true });
            },
            willClose: () => {
                wakeLockManager.setReason("detalle", false);

                if (typeof onResize === "function") {
                    window.removeEventListener("resize", onResize);
                    onResize = null;
                }
            },
        });
    };

    contenedor.addEventListener("click", async (ev) => {
        const target = ev.target;
        if (!(target instanceof HTMLElement)) return;

        const cardEl = target.closest(".plan-card");
        if (cardEl instanceof HTMLElement) {
            await openDetalle(cardEl);
            return;
        }

        const headerEl = target.closest(".plan-dia-header");
        if (headerEl instanceof HTMLElement) {
            await openDetalleDia(headerEl);
        }
    });

    contenedor.addEventListener("keydown", async (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        const target = ev.target;
        if (!(target instanceof HTMLElement)) return;

        const cardEl = target.closest(".plan-card");
        if (cardEl instanceof HTMLElement) {
            ev.preventDefault();
            await openDetalle(cardEl);
            return;
        }

        const headerEl = target.closest(".plan-dia-header");
        if (headerEl instanceof HTMLElement) {
            ev.preventDefault();
            await openDetalleDia(headerEl);
        }
    });
}

function initPlanDiaPager() {
    const scroller = document.getElementById("Plan_ejercicio");
    if (!scroller) return;

    const mqDesktop = (() => {
        try {
            return window.matchMedia ? window.matchMedia("(min-width: 1024px)") : null;
        } catch {
            return null;
        }
    })();

    const mode = mqDesktop && mqDesktop.matches ? "desktop" : "mobile";

    // Reconfigurar automáticamente al cruzar el breakpoint.
    if (mqDesktop && scroller.dataset.diaPagerMqInit !== "1") {
        scroller.dataset.diaPagerMqInit = "1";
        const onChange = () => initPlanDiaPager();
        try {
            mqDesktop.addEventListener("change", onChange);
        } catch {
            // Safari antiguo
            try { mqDesktop.addListener(onChange); } catch { }
        }
    }

    const prevMode = scroller.dataset.diaPagerMode || "";
    if (prevMode && prevMode !== mode) {
        if (typeof scroller.__diaPagerCleanup === "function") {
            try {
                scroller.__diaPagerCleanup();
            } catch {
                // ignore
            }
        }
        scroller.__diaPagerCleanup = null;
        scroller.dataset.diaPagerInit = "0";
    }

    scroller.dataset.diaPagerMode = mode;

    // En escritorio los días se muestran en horizontal por CSS.
    // No interceptamos wheel/touch para no romper el scroll nativo.
    if (mode === "desktop") {
        return;
    }

    if (scroller.dataset.diaPagerInit === "1") return;
    scroller.dataset.diaPagerInit = "1";

    const getDays = () => Array.from(scroller.querySelectorAll(".plan-container.plan-snap .plan-dia"));

    const findNearestIndex = () => {
        const days = getDays();
        if (!days.length) return 0;
        const top = scroller.scrollTop;
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < days.length; i++) {
            const dist = Math.abs((days[i]?.offsetTop ?? 0) - top);
            if (dist < bestDist) {
                bestDist = dist;
                bestIdx = i;
            }
        }
        return bestIdx;
    };

    const scrollToIndex = (index, behavior = "smooth") => {
        const days = getDays();
        if (!days.length) return;
        const clamped = Math.max(0, Math.min(days.length - 1, index));
        const target = days[clamped];
        if (!target) return;
        scroller.scrollTo({ top: target.offsetTop, behavior });
    };

    let gestureLock = false;
    const stepBy = (dir) => {
        const days = getDays();
        if (days.length <= 1) return;
        if (gestureLock) return;
        gestureLock = true;
        const current = findNearestIndex();
        scrollToIndex(current + dir, "smooth");
        window.setTimeout(() => {
            gestureLock = false;
        }, 420);
    };

    const canScrollInnerGrid = (gridEl, deltaY) => {
        if (!(gridEl instanceof HTMLElement)) return false;
        const canScroll = gridEl.scrollHeight > gridEl.clientHeight + 1;
        if (!canScroll) return false;
        if (deltaY > 0) {
            return gridEl.scrollTop < (gridEl.scrollHeight - gridEl.clientHeight - 1);
        }
        if (deltaY < 0) {
            return gridEl.scrollTop > 0;
        }
        return false;
    };

    let wheelAccum = 0;
    let wheelTimer = null;
    const WHEEL_THRESHOLD = 26;

    const onWheel = (e) => {
        const days = getDays();
        if (days.length <= 1) return;
        if (e.ctrlKey) return; // pinch zoom

        const deltaY = e.deltaY;
        const target = e.target;
        const grid = (target instanceof Element) ? target.closest(".plan-grid") : null;
        if (grid && canScrollInnerGrid(grid, deltaY)) {
            return;
        }

        e.preventDefault();
        wheelAccum += deltaY;

        if (wheelTimer) window.clearTimeout(wheelTimer);
        wheelTimer = window.setTimeout(() => {
            wheelAccum = 0;
        }, 140);

        if (Math.abs(wheelAccum) < WHEEL_THRESHOLD) return;
        const dir = wheelAccum > 0 ? 1 : -1;
        wheelAccum = 0;
        stepBy(dir);
    };

    scroller.addEventListener("wheel", onWheel, { passive: false });

    let touchStartY = 0;
    let touchStartX = 0;
    let touchArmed = false;
    let touchFromGrid = false;
    const TOUCH_THRESHOLD = 44;

    const onTouchStart = (e) => {
        const days = getDays();
        if (days.length <= 1) return;
        if (!e.touches || e.touches.length !== 1) return;

        const t = e.touches[0];
        touchStartY = t.clientY;
        touchStartX = t.clientX;
        touchArmed = true;

        const target = e.target;
        const grid = (target instanceof Element) ? target.closest(".plan-grid") : null;
        touchFromGrid = !!grid;
    };

    scroller.addEventListener("touchstart", onTouchStart, { passive: true });

    const onTouchEnd = (e) => {
        if (!touchArmed) return;
        touchArmed = false;

        const days = getDays();
        if (days.length <= 1) return;
        const t = e.changedTouches && e.changedTouches[0];
        if (!t) return;

        const dy = t.clientY - touchStartY;
        const dx = t.clientX - touchStartX;
        if (Math.abs(dy) < TOUCH_THRESHOLD) return;
        if (Math.abs(dy) < Math.abs(dx)) return;

        if (touchFromGrid) return;

        const dir = dy < 0 ? 1 : -1;
        stepBy(dir);
    };

    scroller.addEventListener("touchend", onTouchEnd, { passive: true });

    scroller.__diaPagerCleanup = () => {
        scroller.removeEventListener("wheel", onWheel);
        scroller.removeEventListener("touchstart", onTouchStart);
        scroller.removeEventListener("touchend", onTouchEnd);
        scroller.dataset.diaPagerInit = "0";
    };
}
document.getElementById("boton_eliminar")?.addEventListener("click", async () => {
    const ok = await openConfirmSheet({
        title: tLang("¿Estás seguro?", "Are you sure?"),
        message: tLang(
            "Esta acción eliminará tu plan de entrenamiento actual.",
            "This action will delete your current training plan."
        ),
        confirmText: tLang("Sí, eliminar", "Yes, delete"),
        cancelText: tLang("Cancelar", "Cancel"),
    });

    if (!ok) return;

    localStorage.setItem("plan_entreno_usuario", "Ninguno");
    await actualizar_cambios_plan_entreno();
    document.getElementById("Plan_ejercicio").innerHTML = "";
    document.getElementById("Plan_ejercicio").style.display = "none";
    document.getElementById("boton_regenerar").style.display = "none";
    verificacion_plan_entrenamiento();

    await openStatusSheet({
        title: tLang("Plan eliminado", "Plan deleted"),
        message: tLang("Tu plan de entrenamiento ha sido eliminado.", "Your training plan has been deleted."),
    });
});
async function actualizar_cambios_plan_entreno() {
    let res;
    try {
        res = await fetch('/actualizar_cambios_plan', {
            method: 'POST',
            body: JSON.stringify({ plan_entreno: localStorage.getItem("plan_entreno_usuario"), id_usuario: localStorage.getItem("id_usuario") }),
        });
    } catch (err) {
        console.log("[EdgeFunction:/actualizar_cambios_plan] Error de red:", err);
        return;
    }

    if (!res.ok) {
        let bodyText = "";
        try { bodyText = await res.text(); } catch { bodyText = ""; }
        console.log("[EdgeFunction:/actualizar_cambios_plan] Error:", {
            status: res.status,
            statusText: res.statusText,
            body: bodyText,
        });

        if (isNetlifyEdgeUncaughtInvocation(bodyText)) {
            await showNetlifyHostingErrorAlert({
                endpoint: "/actualizar_cambios_plan",
                status: res.status,
                statusText: res.statusText,
                bodyText,
            });
        }
    }
}

async function Regen_plan() {
    const plan_entreno_actual = localStorage.getItem("plan_entreno_usuario");

    const detectIntensidadFromPlan = (raw) => {
        if (raw == null) return null;
        const asString = typeof raw === "string" ? raw.trim() : JSON.stringify(raw);
        if (!asString || asString === "Ninguno") return null;

        const extractLikelyJson = (text) => {
            const s = String(text ?? "");
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

        const safeJsonParse = (text) => {
            try {
                return JSON.parse(text);
            } catch {
                return null;
            }
        };

        const stripAccents = (text) => String(text ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        const mapIntensidad = (value) => {
            const v = stripAccents(value).trim().toLowerCase();
            if (!v) return null;
            if (v.includes("baj")) return "baja";
            if (v.includes("alt")) return "alta";
            if (v.includes("med")) return "media";
            return null;
        };

        const parsed = safeJsonParse(extractLikelyJson(asString)) ?? safeJsonParse(asString);
        if (!parsed || typeof parsed !== "object") return null;

        const root = parsed?.plan_entrenamiento_hipertrofia ?? parsed?.plan_entrenamiento ?? parsed?.plan ?? parsed;
        const usuario = (root && typeof root === "object") ? (root.usuario ?? root.user ?? null) : null;
        const fromText = mapIntensidad(usuario?.intensidad);
        if (fromText) return fromText;

        const n = Number(usuario?.ejercicios_por_dia);
        if (Number.isFinite(n)) {
            if (n <= 4) return "baja";
            if (n <= 6) return "media";
            return "alta";
        }
        return null;
    };

    const intensidadDetectada =
        detectIntensidadFromPlan(plan_entreno_actual) ||
        localStorage.getItem("plan_intensidad") ||
        "media";

    const ejerciciosPorDiaMap = { baja: 4, media: 6, alta: 8 };
    const ejerciciosPorDiaDetectados = ejerciciosPorDiaMap[intensidadDetectada] ?? 6;

    const ok = await openConfirmSheet({
        title: tLang("Regenerar plan de entrenamiento", "Regenerate training plan"),
        message: isEnglish()
            ? `Your current plan will be deleted and a new one will be generated based on the previous configuration. Detected intensity: ${intensidadDetectada} (${ejerciciosPorDiaDetectados} exercises per day).`
            : `Se eliminará el plan actual y se generará uno nuevo basado en la configuración previa. Intensidad detectada: ${intensidadDetectada} (${ejerciciosPorDiaDetectados} ejercicios por día).`,
        confirmText: tLang("Sí, regenerar", "Yes, regenerate"),
        cancelText: tLang("Cancelar", "Cancel"),
    });

    if (!ok) return;

    if (plan_entreno_actual == null || plan_entreno_actual === "Ninguno") {
        await openStatusSheet({
            title: tLang("No hay plan para regenerar", "No plan to regenerate"),
            message: tLang(
                "Primero debés generar un plan de entrenamiento.",
                "You need to generate a training plan first."
            ),
        });
        return;
    }

    localStorage.setItem("plan_entreno_usuario", "Ninguno");
    await actualizar_cambios_plan_entreno();

    document.getElementById("Plan_ejercicio").innerHTML = "";
    document.getElementById("Plan_ejercicio").style.display = "none";
    verificacion_plan_entrenamiento();

    const botonRegenerar = document.getElementById("boton_regenerar");
    if (botonRegenerar) botonRegenerar.style.display = "none";
    await openGenerarPlanModal(plan_entreno_actual);
}
