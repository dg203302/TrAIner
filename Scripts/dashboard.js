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
            showBack: false,
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
            showBack: false,
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

let EJERCICIOS_INDICE = {};
window.ENTRENAMIENTOS_DB = {};
window.ENTRENAMIENTOS_FLAT = {};

(async () => {
    try {
        const res = await fetch("/Datos/entrenamientos.json");
        if (res.ok) {
            window.ENTRENAMIENTOS_DB = await res.json();
            for (const grupo in window.ENTRENAMIENTOS_DB) {
                EJERCICIOS_INDICE[grupo] = window.ENTRENAMIENTOS_DB[grupo].map(ex => ex.nombre);
                for (const ex of window.ENTRENAMIENTOS_DB[grupo]) {
                    const norm = String(ex.nombre || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
                    window.ENTRENAMIENTOS_FLAT[norm] = ex;
                }
            }
        }
    } catch (e) {
        console.error("Error loading entrenamientos.json", e);
    }
})();

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

const renderListaEjerciciosSelectable = (inputName = "ejercicios") => {
    if (!EJERCICIOS_INDICE) return "";
    const parts = [];

    const groupOrder = ["Pecho", "Espalda", "Piernas", "Hombros", "Brazos", "Tríceps", "Antebrazos", "Abdomen / core", "Cardio / acondicionamiento"];
    const validKeys = Object.keys(EJERCICIOS_INDICE).filter(k => groupOrder.includes(k));
    validKeys.sort((a, b) => groupOrder.indexOf(a) - groupOrder.indexOf(b));

    const translateGroup = (g) => {
        const m = { "Pecho": "Chest", "Espalda": "Back", "Piernas": "Legs", "Hombros": "Shoulders", "Brazos": "Arms", "Tríceps": "Triceps", "Antebrazos": "Forearms", "Abdomen / core": "Abs / core", "Cardio / acondicionamiento": "Cardio / conditioning" };
        return m[g] ?? g;
    };

    for (const grupo of validKeys) {
        const items = EJERCICIOS_INDICE[grupo] || [];
        if (!items.length) continue;

        const grupoLabel = tLang(grupo, translateGroup(grupo));

        const checks = items
            .map((original) => {
                const enName = translateExerciseNameToEnglish(original) || original;
                const safeValue = escapeHtml(original);
                const safeLabel = escapeHtml(tLang(original, enName));

                const _normGif = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
                const searchName = _normGif(original);

                let gifUrl = null;
                let descriptionText = "";

                if (window.ENTRENAMIENTOS_FLAT) {
                    if (window.ENTRENAMIENTOS_FLAT[searchName]) {
                        gifUrl = window.ENTRENAMIENTOS_FLAT[searchName].gifUrl;
                        descriptionText = window.ENTRENAMIENTOS_FLAT[searchName].descripcion;
                    } else {
                        for (const [key, exObj] of Object.entries(window.ENTRENAMIENTOS_FLAT)) {
                            const enNorm = _normGif(translateExerciseNameToEnglish(key));
                            if (searchName.includes(key) || searchName.includes(enNorm) || (key.length > 5 && key.includes(searchName))) {
                                gifUrl = exObj.gifUrl;
                                descriptionText = exObj.descripcion;
                                break;
                            }
                        }
                    }
                }

                const imgHtml = gifUrl
                    ? `<div style="position: absolute; top: 0; right: 0; bottom: 0; width: 70%; pointer-events: none; z-index: 0; mask-image: linear-gradient(to right, transparent 0%, black 40%); -webkit-mask-image: linear-gradient(to right, transparent 0%, black 40%); border-top-right-radius: 11px; border-bottom-right-radius: 11px; overflow: hidden;">
                           <img src="${gifUrl}" alt="" style="width: 100%; height: 100%; object-fit: cover; object-position: right center; opacity: 1;" loading="lazy">
                       </div>`
                    : "";

                let descriptionHtml = "";
                if (descriptionText) {
                    descriptionHtml = `<div style="font-size: 11.5px; color: rgba(255,255,255,0.6); line-height: 1.3; margin-top: 6px; padding-right: 40px; position: relative; z-index: 1; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">${escapeHtml(descriptionText)}</div>`;
                }

                return `
                    <label class="swal-check" style="position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: flex-start; padding: 12px 15px;">
                        ${imgHtml}
                        <div style="display: flex; align-items: center; width: 100%; position: relative; z-index: 1;">
                            <input type="checkbox" name="${escapeHtml(inputName)}" value="${safeValue}">
                            <span style="text-shadow: 0 1px 3px rgba(0,0,0,0.8); font-weight: 600;">${safeLabel}</span>
                        </div>
                        ${descriptionHtml}
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
                            <div class="pt-sheet-section-title">${escapeHtml(tLang("Tipo de Creación", "Creation Type"))}</div>
                            <div class="swal-grid">
                                <div class="swal-field">
                                    <label class="swal-radio"><input type="radio" name="tipo_plan" value="ia" checked><span>${escapeHtml(tLang("Generar con IA", "Generate with AI"))}</span></label>
                                    <label class="swal-radio"><input type="radio" name="tipo_plan" value="manual"><span>${escapeHtml(tLang("Crear manualmente", "Create manually"))}</span></label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="pt-gen-ia-container">
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
                                <p class="swal-helper">${escapeHtml(tLang("Tocá para seleccionar los días en los que vas a entrenar.", "Tap to select the days you plan to train."))}</p>
                                ${renderDiasSelector()}
                            </div>
                        </div>

                        <div class="pt-detail-card">
                            <div class="pt-detail-card-inner">
                                <div class="pt-sheet-section-title">${escapeHtml(tLang("Ejercicios", "Exercises"))}</div>
                                <p class="swal-helper">${escapeHtml(tLang("Opcional: si querés, marcá ejercicios preferidos. Si no seleccionás nada, la IA elige automáticamente.", "Optional: pick preferred exercises. If you don't select any, the AI will choose automatically."))}</p>
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

                    <div id="pt-gen-manual-container" style="display: none;">
                        <div class="pt-detail-card">
                            <div class="pt-detail-card-inner">
                                <div class="pt-sheet-section-title">${escapeHtml(tLang("Días de entrenamiento", "Training days"))}</div>
                                <p class="swal-helper">${escapeHtml(tLang("Seleccioná los días para tu plan manual.", "Select the days for your manual plan."))}</p>
                                <div class="swal-dias" id="swal-dias-manual" role="group">
                                    ${DIAS_SEMANA.map(d => `<button type="button" class="swal-dia-btn swal-dia-btn-manual" data-dia="${escapeHtml(d.code)}" data-name="${escapeHtml(d.name)}" aria-pressed="false">${escapeHtml(d.label)}</button>`).join("")}
                                </div>
                            </div>
                        </div>
                        <div id="pt-manual-days-forms"></div>
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
                    if (btn.classList.contains("swal-dia-btn-manual")) return;
                    const code = btn.getAttribute("data-dia");

                    const isOn = diasSet.has(String(code ?? "").toUpperCase());
                    btn.classList.toggle("is-selected", isOn);
                    btn.setAttribute("aria-pressed", isOn ? "true" : "false");
                });

                sheet.querySelectorAll('input[name="tipo_plan"]')?.forEach(radio => {
                    radio.addEventListener("change", (e) => {
                        const isManual = e.target.value === "manual";
                        sheet.querySelector("#pt-gen-ia-container").style.display = isManual ? "none" : "block";
                        sheet.querySelector("#pt-gen-manual-container").style.display = isManual ? "block" : "none";
                        const btn = sheet.querySelector("[data-pt-generate]");
                        if (btn) btn.textContent = isManual ? escapeHtml(tLang("Crear", "Create")) : escapeHtml(tLang("Generar", "Generate"));
                    });
                });

                const renderManualDayForm = (code, name, label) => `
                    <div class="pt-detail-card pt-manual-day-card" id="pt-manual-day-${code}">
                        <div class="pt-detail-card-inner">
                            <div class="pt-sheet-section-title" style="color: var(--my-primary, #ff073a);">${escapeHtml(label)} - ${escapeHtml(tLang("Enfoque", "Focus"))}</div>
                            <input type="text" class="swal2-input pt-manual-enfoque" data-day-code="${escapeHtml(code)}" placeholder="${escapeHtml(tLang("Ej: Pecho y Tríceps", "Ex: Chest and Triceps"))}" style="display: block; width: 100%; margin-top: 5px; height: 44px; font-size: 15px; color: #fff; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0 12px; outline: none; margin-bottom: 15px;">
                            <div class="pt-sheet-section-title">${escapeHtml(tLang("Ejercicios", "Exercises"))}</div>
                            <div class="swal-ejercicios" style="padding-bottom: 10px;">
                                ${renderListaEjerciciosSelectable(`ejercicios_${code}`)}
                            </div>
                        </div>
                    </div>
                `;

                sheet.querySelectorAll(".swal-dias")?.forEach(container => {
                    container.addEventListener("click", (ev) => {
                        const target = ev.target;
                        if (!(target instanceof HTMLElement)) return;
                        const btn = target.closest(".swal-dia-btn");
                        if (!(btn instanceof HTMLButtonElement)) return;
                        const pressed = btn.getAttribute("aria-pressed") === "true";
                        const next = !pressed;
                        btn.classList.toggle("is-selected", next);
                        btn.setAttribute("aria-pressed", next ? "true" : "false");

                        if (btn.classList.contains("swal-dia-btn-manual")) {
                            const code = btn.getAttribute("data-dia");
                            const name = btn.getAttribute("data-name");
                            const label = btn.textContent;
                            const formsContainer = sheet.querySelector("#pt-manual-days-forms");
                            if (next) {
                                formsContainer.insertAdjacentHTML("beforeend", renderManualDayForm(code, name, label));
                            } else {
                                const card = formsContainer.querySelector(`#pt-manual-day-${code}`);
                                if (card) card.remove();
                            }
                        }
                    });
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
                    const tipoPlan = sheet.querySelector('input[name="tipo_plan"]:checked')?.value || "ia";
                    if (tipoPlan === "manual") {
                        const manualDays = Array.from(sheet.querySelectorAll(".swal-dia-btn-manual[aria-pressed='true']"));
                        if (manualDays.length === 0) return showError(tLang("Seleccioná al menos un día.", "Select at least one day."));

                        const diasData = manualDays.map(btn => {
                            const code = btn.getAttribute("data-dia");
                            const name = btn.getAttribute("data-name");
                            const enfoque = sheet.querySelector(`#pt-manual-day-${code} .pt-manual-enfoque`)?.value || "";
                            const exercises = Array.from(sheet.querySelectorAll(`input[name="ejercicios_${code}"]:checked`)).map(el => el.value);
                            return { dia: name, enfoque, ejercicios: exercises };
                        });

                        safeResolve({ isConfirmed: true, isManual: true, diasData });
                        try { window.PTBottomSheet?.close?.(); } catch { }
                        return;
                    }

                    const lugar = sheet.querySelector('input[name="lugar"]:checked')?.value;
                    const objetivo = sheet.querySelector('input[name="objetivo"]:checked')?.value;

                    let dias = Array.from(sheet.querySelectorAll('.swal-dia-btn:not(.swal-dia-btn-manual)[aria-pressed="true"]') ?? [])
                        .map((el) => el.getAttribute("data-dia"))
                        .filter(Boolean);

                    const intensidad = sheet.querySelector('input[name="intensidad"]:checked')?.value;
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
                        showError(tLang("Seleccioná al menos un día de la semana", "Select at least one day of the week"));
                        return;
                    }

                    try {
                        localStorage.setItem("plan_lugar", String(lugar));
                        localStorage.setItem("plan_objetivo", String(objetivo));
                        localStorage.setItem("plan_dias", JSON.stringify(dias));
                        if (intensidad) localStorage.setItem("plan_intensidad", String(intensidad));
                        localStorage.setItem("plan_ejercicios_enabled", ejEnabled ? "1" : "0");
                        localStorage.setItem("plan_ejercicios_selected", JSON.stringify(Array.isArray(ejercicios) ? ejercicios : []));
                    } catch { }

                    try {
                        if (btnGenerate instanceof HTMLButtonElement) btnGenerate.disabled = true;
                    } catch { }

                    safeResolve({ isConfirmed: true, lugar, objetivo, dias, ejEnabled, ejercicios, intensidad });
                    window.PTBottomSheet?.close?.();
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

    document.querySelectorAll(".footer-profile-avatar").forEach(el => {
        if (avatar) el.src = avatar;
    });

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

    // Notificar al overlay de carga que todo está listo
    window.planesCargados = true;
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
            boton_regenerar.onclick = () => openConfiguracionPlan();
        }
        boton_eliminar_plan_eje.style.display = "none";
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
            verificacion_plan_entrenamiento();
            const title = tLang("Plan de entrenamiento actualizado", "Training plan updated");
            const message = tLang(
                "Tu plan de entrenamiento ha sido refrescado correctamente.",
                "Your training plan was refreshed successfully."
            );

            Swal.fire({
                toast: true,
                position: 'top',
                icon: 'success',
                title: title,
                text: message,
                showConfirmButton: false,
                timer: 2500,
                background: '#13141a',
                color: '#ffffff',
                customClass: {
                    popup: 'swal-dark-popup'
                }
            });
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
            const data = await openGenerarPlanModal();
            if (!data?.isConfirmed) return;

            if (data.isManual) {
                await crearPlanManual(data.diasData);
            } else {
                await crearPlanEntreno(data.lugar, data.objetivo, data.dias, data.ejercicios, data.intensidad);
            }
        }
    }
}

async function crearPlanManual(diasData) {
    try { window.PTBottomSheet?.close?.(); } catch { }

    window.PTBottomSheet?.open?.({
        title: tLang("Creando Plan Manual", "Creating Manual Plan"),
        subtitle: tLang("Guardando tu plan personalizado...", "Saving your custom plan..."),
        html: `
            <div class="pt-status" aria-live="polite">
                <div class="pt-status-row">
                    <div class="pt-spinner" aria-hidden="true"></div>
                    <div class="pt-status-text">${escapeHtml(tLang("Por favor, esperá...", "Please wait..."))}</div>
                </div>
            </div>
        `,
        showClose: false,
        showHandle: false,
        showBack: false,
        allowOutsideClose: false,
        allowEscapeClose: false,
        allowDragClose: false,
    });

    const plan = {
        plan_entrenamiento: {
            configuracion_semanal: diasData.map(d => ({
                dia: d.dia,
                enfoque: d.enfoque,
                ejercicios: d.ejercicios.map(eName => {
                    const searchName = String(eName ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

                    let exInfo = null;
                    if (window.ENTRENAMIENTOS_FLAT && window.ENTRENAMIENTOS_FLAT[searchName]) {
                        exInfo = window.ENTRENAMIENTOS_FLAT[searchName];
                    } else if (window.ENTRENAMIENTOS_FLAT) {
                        for (const [key, exObj] of Object.entries(window.ENTRENAMIENTOS_FLAT)) {
                            const enNorm = translateExerciseNameToEnglish(key).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                            if (searchName.includes(key) || searchName.includes(enNorm)) {
                                exInfo = exObj;
                                break;
                            }
                        }
                    }

                    return {
                        nombre: exInfo ? exInfo.nombre : eName,
                        series: exInfo?.series_recomendadas || 3,
                        repeticiones: exInfo?.repeticiones_recomendadas || "8-12",
                        descanso: exInfo?.descanso_recomendado || "60s"
                    };
                })
            }))
        }
    };

    const planStr = JSON.stringify(plan);
    localStorage.setItem("plan_entreno_usuario", planStr);

    try {
        const id_usuario = localStorage.getItem("id_usuario");
        if (id_usuario && supabase) {
            await supabase.from("Planes").update({
                Plan_entreno: planStr,
                Generado_con_ia: false
            }).eq("ID_user", id_usuario);
        }
    } catch (err) {
        console.error("Error al guardar plan manual en supabase:", err);
    }

    // Llamar a la edge function de actualizar tal cual pide el usuario
    await actualizar_cambios_plan_entreno();

    try { window.PTBottomSheet?.close?.(); } catch { }

    const br = document.getElementById("boton_regenerar");
    if (br) br.style.display = "block";
    verificacion_plan_entrenamiento();

    // Mostrar cartel de éxito
    window.PTBottomSheet?.open?.({
        title: tLang("¡Plan Creado!", "Plan created!"),
        ariaLabel: tLang("Plan creado exitosamente", "Plan created successfully"),
        html: `
            <div class="pt-status">
                <div class="pt-status-row">
                    <div class="pt-status-text">${escapeHtml(tLang(
            "Tu plan manual se ha guardado y sincronizado correctamente.",
            "Your manual plan has been saved and synchronized successfully."
        ))}</div>
                </div>
                <div class="pt-status-actions">
                    <button type="button" class="btn-primary" data-pt-sheet-close>${escapeHtml(tLang("Ver Plan", "View Plan"))}</button>
                </div>
            </div>
        `,
        showClose: false,
        showHandle: true,
        showBack: false,
        allowOutsideClose: true,
        allowEscapeClose: true,
        allowDragClose: true,
        didOpen: (sheet) => {
            sheet.querySelector("[data-pt-sheet-close]")?.addEventListener("click", () => window.PTBottomSheet?.close?.());
        },
    });
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
        showBack: false,
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
        const cleanEmptyDays = (planStr) => {
            if (!planStr) return planStr;
            try {
                const planObj = JSON.parse(planStr);
                const rootNode = planObj.plan_entrenamiento_hipertrofia || planObj.plan_entrenamiento || planObj.plan || planObj;
                if (rootNode && typeof rootNode === "object") {
                    const arr = rootNode.configuracion_semanal || rootNode.dias;
                    if (Array.isArray(arr)) {
                        const filtered = arr.filter(d => Array.isArray(d.ejercicios) && d.ejercicios.length > 0);
                        if (rootNode.configuracion_semanal) rootNode.configuracion_semanal = filtered;
                        if (rootNode.dias) rootNode.dias = filtered;
                    } else if (!Array.isArray(rootNode)) {
                        Object.keys(rootNode).forEach(k => {
                            if (Array.isArray(rootNode[k]) && rootNode[k].length === 0) {
                                delete rootNode[k];
                            }
                        });
                    }
                }
                return JSON.stringify(planObj);
            } catch (e) {
                return planStr;
            }
        };

        // Remove any empty days from the newly generated plan so they are hidden by default
        const cleanNewPlan = cleanEmptyDays(plan_entreno);

        const finalPlan = cleanNewPlan;

        response = await fetch('/generar_plan_entreno', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_usuario: localStorage.getItem("id_usuario"),
                plan_entreno: finalPlan,
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
            showBack: false,
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
            showBack: false,
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
                showBack: false,
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
                showBack: false,
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
        const { data: datos2, error: error2 } = await supabase
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

const getDaySortIndex = (dayName) => {
    if (!dayName) return 999;
    const s = String(dayName).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (s.includes("lunes") || s.includes("monday") || s === "l") return 0;
    if (s.includes("martes") || s.includes("tuesday") || s === "m") return 1;
    if (s.includes("miercoles") || s.includes("wednesday") || s === "x") return 2;
    if (s.includes("jueves") || s.includes("thursday") || s === "j") return 3;
    if (s.includes("viernes") || s.includes("friday") || s === "v") return 4;
    if (s.includes("sabado") || s.includes("saturday") || s === "s") return 5;
    if (s.includes("domingo") || s.includes("sunday") || s === "d") return 6;
    return 999;
};

const sortDiasArray = (arr) => {
    if (!Array.isArray(arr)) return [];
    return [...arr].sort((a, b) => {
        const nameA = a?.dia ?? a?.nombre ?? a?.day ?? a?.key ?? (typeof a === "string" ? a : "");
        const nameB = b?.dia ?? b?.nombre ?? b?.day ?? b?.key ?? (typeof b === "string" ? b : "");
        const ia = getDaySortIndex(nameA);
        const ib = getDaySortIndex(nameB);
        if (ia !== ib) return ia - ib;
        return (a?.originalIndex ?? a?._origIdx ?? 0) - (b?.originalIndex ?? b?._origIdx ?? 0);
    });
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
        let gifUrl = null;
        let descripcionText = exNorm.descripcion || "";

        const _normGif = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
        const searchName = _normGif(exNorm.nombre);

        if (window.ENTRENAMIENTOS_FLAT) {
            let matchedEx = window.ENTRENAMIENTOS_FLAT[searchName];
            if (!matchedEx) {
                for (const [key, exObj] of Object.entries(window.ENTRENAMIENTOS_FLAT)) {
                    const enNorm = _normGif(translateExerciseNameToEnglish(key));
                    if (searchName.includes(key) || searchName.includes(enNorm) || (key.length > 5 && key.includes(searchName))) {
                        matchedEx = exObj;
                        break;
                    }
                }
            }
            if (matchedEx) {
                gifUrl = matchedEx.gifUrl;
                if (!descripcionText) descripcionText = matchedEx.descripcion;
            }
        }
        const descripcion = escapeHtml(descripcionText);
        const series = escapeHtml(exNorm.series);
        const reps = escapeHtml(formatReps(exNorm.repeticiones));

        const imgHtml = gifUrl
            ? `<div style="position: absolute; top: 0; right: 0; bottom: 0; width: 60%; pointer-events: none; z-index: 0; mask-image: linear-gradient(to right, transparent 0%, black 50%); -webkit-mask-image: linear-gradient(to right, transparent 0%, black 50%); border-top-right-radius: 17px; border-bottom-right-radius: 17px; overflow: hidden;">
                   <img src="${gifUrl}" alt="" style="width: 100%; height: 100%; object-fit: cover; object-position: right center; opacity: 0.5; mix-blend-mode: luminosity;" loading="lazy">
               </div>`
            : "";

        return `
            <article class="plan-card" data-idx="${idx}" data-day-idx="${escapeHtml(dayIdx)}" role="button" tabindex="0" style="position: relative; overflow: hidden; padding-right: 30%;">
                ${imgHtml}
                <div style="position: relative; z-index: 1;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 8px; flex-wrap: nowrap; width: 100%;">
                        <span class="plan-chip" style="flex-shrink: 0; white-space: nowrap; padding: 4px 8px; font-size: 11.5px; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); background: rgba(0,0,0,0.4); border-color: rgba(255,255,255,0.15);"><span data-i18n-en="Sets:">Series:</span> <strong>${series}</strong></span>
                        <h3 class="plan-nombre" data-i18n-en="${nombreEn}" style="text-shadow: 0 2px 4px rgba(0,0,0,0.8); margin: 0; padding: 0; text-align: center; flex-shrink: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: clamp(12px, 3vw, 14.5px);">${nombreEs}</h3>
                        <span class="plan-chip" style="flex-shrink: 0; white-space: nowrap; padding: 4px 8px; font-size: 11.5px; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); background: rgba(0,0,0,0.4); border-color: rgba(255,255,255,0.15);"><span data-i18n-en="Reps:">Reps:</span> <strong>${reps}</strong></span>
                    </div>
                    ${descripcion ? `<p class="plan-desc" style="text-shadow: 0 1px 3px rgba(0,0,0,0.8);">${descripcion}</p>` : ""}
                </div>
            </article>
        `;
    };

    const renderDaySection = (diaLabel, ejerciciosList, enfoque, dayIdx) => {
        const normalized = (Array.isArray(ejerciciosList) ? ejerciciosList : [])
            .map(normalizeExercise)
            .filter(Boolean);

        const cards = normalized.length
            ? normalized.map((ex, idx) => renderExerciseCard(ex, idx, dayIdx)).join("")
            : `<div class="plan-vacio" data-i18n-en="No exercises for this day." style="color: rgba(255,255,255,0.6); padding: 16px; text-align: center;">No hay ejercicios para este día. Usa el botón "Editar Dia" para agregarlos.</div>`;

        return `
            <section class="plan-dia">
                <!-- Ad Block -->
                <iframe style="width: 100%; aspect-ratio: 728 / 90; max-height: 85px; border: none; overflow: hidden; margin-bottom: 12px; border-radius: 12px; background: rgba(0,0,0,0.2);" scrolling="no" srcdoc='<!DOCTYPE html><html><head><style>body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: transparent; overflow: hidden; } #scale-wrap { transform: scale(min(1, calc(100vw / 728))); transform-origin: center center; }</style></head><body><div id="scale-wrap"><script>atOptions={"key":"20fd356d9c7b90b05c268f07099b182f","format":"iframe","height":90,"width":728,"params":{}};</script><script src="https://www.highperformanceformat.com/20fd356d9c7b90b05c268f07099b182f/invoke.js"></script></div></body></html>'></iframe>
                <div class="plan-dia-header" data-day-idx="${escapeHtml(dayIdx)}">
                    <div class="plan-dia-titulos">
                        <h2 class="plan-dia-titulo">${escapeHtml(diaLabel)}</h2>
                        ${enfoque ? `<div class="plan-dia-subtitle">${escapeHtml(enfoque)}</div>` : ""}
                    </div>
                    <div class="plan-dia-actions" style="display: flex; flex-direction: row; gap: 8px; margin-left: auto;">
                        <button type="button" class="plan-dia-chip chip-registrar" aria-label="${escapeHtml(tLang("Detalle del día", "Day detail"))} ${dayIdx + 1}" style="font-size: 13.5px; font-weight: 800; padding: 8px 14px; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; cursor: pointer; touch-action: manipulation; border: none; font-family: inherit; color: inherit; appearance: none; outline: none;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            <span data-i18n-en="Register">${tLang("Registrar", "Register")}</span>
                        </button>
                        <button type="button" class="plan-dia-chip chip-editar" aria-label="${escapeHtml(tLang("Editar día", "Edit day"))} ${dayIdx + 1}" style="font-size: 13.5px; font-weight: 800; padding: 8px 14px; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; cursor: pointer; touch-action: manipulation; border: none; font-family: inherit; color: inherit; appearance: none; outline: none;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 20h9"></path>
                                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 Z"></path>
                            </svg>
                            <span data-i18n-en="Edit">${tLang("Editar", "Edit")}</span>
                        </button>
                    </div>
                </div>
                <div class="plan-grid">${cards}</div>
            </section>
        `;
    };

    let html = "";

    if (hasDiasArray) {
        const rawDays = (Array.isArray(maybeDiasArray) ? maybeDiasArray : [])
            .map((d, originalIndex) => {
                const dia = d?.dia ?? d?.nombre ?? d?.day ?? tLang(`Día ${originalIndex + 1}`, `Day ${originalIndex + 1}`);
                const enfoque = d?.enfoque ?? d?.focus ?? d?.objetivo ?? d?.titulo ?? d?.title;
                const ejercicios = d?.ejercicios ?? d?.entrenamiento ?? d?.exercises ?? d?.rutina ?? d?.items ?? [];
                const normalized = (Array.isArray(ejercicios) ? ejercicios : [])
                    .map(normalizeExercise)
                    .filter(Boolean);
                return { dia, enfoque, ejercicios, normalized, originalIndex, raw: d };
            });

        const days = sortDiasArray(rawDays);

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
            const ia = getDaySortIndex(a);
            const ib = getDaySortIndex(b);
            return ia - ib;
        });

        const days = orderedKeys
            .map((k) => {
                const ejercicios = root[k];
                const normalized = (Array.isArray(ejercicios) ? ejercicios : [])
                    .map(normalizeExercise)
                    .filter(Boolean);
                return { key: k, ejercicios, normalized };
            });

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
        const rawDays = maybeDiasArray.map((d, i) => {
            const dia = d?.dia ?? d?.nombre ?? d?.day ?? tLang(`Día ${i + 1}`, `Day ${i + 1}`);
            const enfoque = d?.enfoque ?? d?.focus ?? d?.objetivo ?? d?.titulo ?? d?.title ?? "";
            const ejercicios = Array.isArray(d?.ejercicios)
                ? d.ejercicios.map(normalizeExDet).filter(Boolean)
                : [];
            return { dia, enfoque, ejercicios, originalIndex: i, raw: d };
        });
        return sortDiasArray(rawDays);
    }

    const weekdayKeys = Object.keys(root || {}).filter((k) => diasOrden.includes(String(k).toLowerCase()) || getDaySortIndex(k) < 999);
    if (weekdayKeys.length > 0) {
        const orderedKeys = [...weekdayKeys].sort((a, b) => {
            const ia = getDaySortIndex(a);
            const ib = getDaySortIndex(b);
            return ia - ib;
        });
        const days = orderedKeys.map((k) => {
            const ejercicios = Array.isArray(root[k]) ? root[k].map(normalizeExDet).filter(Boolean) : [];
            return { dia: k, enfoque: "", ejercicios };
        });
        return days;
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

    const openDetalleDia = async (headerEl, triggerBtn = null) => {
        const dia_ent = headerEl?.querySelector(".plan-dia-titulo")?.textContent?.replace(/\s+/g, " ")?.trim()
            || headerEl?.querySelector(".plan-dia-titulos")?.textContent?.replace(/\s+/g, " ")?.trim()
            || headerEl?.textContent?.replace(/\s+/g, " ")?.trim();
        const desc_ent = headerEl?.querySelector(".plan-dia-subtitle")?.textContent?.trim() ?? "";
        const dia_Actual = getHoraActualLocal().fecha;

        const regBtn = triggerBtn || headerEl?.querySelector(".chip-registrar");
        let origBtnHtml = "";
        if (regBtn) {
            origBtnHtml = regBtn.innerHTML;
            regBtn.style.pointerEvents = "none";
            regBtn.style.opacity = "0.75";
            regBtn.innerHTML = `
                <svg style="animation: pt-spin 0.8s linear infinite;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                <span>${tLang("Cargando...", "Loading...")}</span>
            `;
        }

        const restoreRegBtn = () => {
            if (regBtn && origBtnHtml) {
                regBtn.innerHTML = origBtnHtml;
                regBtn.style.pointerEvents = "";
                regBtn.style.opacity = "";
            }
        };

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

        let registrosPrevios = [];
        try {
            registrosPrevios = await obtenerRegistrosPrevios();
        } catch (e) {
            console.error(e);
        } finally {
            restoreRegBtn();
        }

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
                
                // Immediately update visually without enforcing scroll (native snap handles that)
                setActive(idx);
                
                if (scrollTimer) window.clearTimeout(scrollTimer);
                scrollTimer = window.setTimeout(() => {
                    const targetTop = Number(wheelEl.dataset.index) * WHEEL_ITEM_HEIGHT;
                    // Only intervene if native snap didn't perfectly align it (fallback)
                    if (Math.abs(wheelEl.scrollTop - targetTop) > 2) {
                        wheelEl.scrollTo({
                            top: targetTop,
                            behavior: "smooth",
                        });
                    }
                }, 150);
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

                <div class="pt-status-row" style="margin-top: 16px; display: grid; gap: 16px;">
                    <div class="pt-wheel-group">
                        <span class="pt-detalle-label">${escapeHtml(tLang("Calorías quemadas (kcal)", "Calories burned (kcal)"))}</span>
                        <input type="number" data-pt-calorias value="${escapeHtml(caloriasPrevias)}" placeholder="0" style="width: 100%; height: 48px; margin-top: 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #fff; padding: 0 16px; font-size: 16px; outline: none; transition: 0.2s; box-sizing: border-box;">
                    </div>

                    <div class="pt-wheel-group">
                        <span class="pt-detalle-label">${escapeHtml(tLang("Tiempo de entreno", "Workout time"))}</span>
                        <div style="display: flex; gap: 12px; margin-top: 8px;">
                            <div style="flex: 1;">
                                <label style="font-size: 12px; color: rgba(255,255,255,0.5); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(tLang("Horas", "Hours"))}</label>
                                <input type="number" id="pt-tiempo-horas" placeholder="0" min="0" style="width: 100%; height: 48px; margin-top: 4px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #fff; padding: 0 16px; font-size: 16px; outline: none; transition: 0.2s; box-sizing: border-box;">
                            </div>
                            <div style="flex: 1;">
                                <label style="font-size: 12px; color: rgba(255,255,255,0.5); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(tLang("Minutos", "Minutes"))}</label>
                                <input type="number" id="pt-tiempo-minutos" placeholder="0" min="0" max="59" style="width: 100%; height: 48px; margin-top: 4px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #fff; padding: 0 16px; font-size: 16px; outline: none; transition: 0.2s; box-sizing: border-box;">
                            </div>
                        </div>
                        <input type="hidden" data-pt-tiempo value="${escapeHtml(tiempoPrevio)}">
                    </div>
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
            className: "pt-detalle-entreno-sheet",
            html: sheetHtml,
            triggerEl: headerEl,
            showClose: false,
            showHandle: true,
            allowOutsideClose: true,
            allowEscapeClose: true,
            allowDragClose: true,
            extraTopBtn: {
                html: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle;"><path d="M20 6 9 17l-5-5"/></svg><span style="vertical-align: middle;">${escapeHtml(tLang("Confirmar entreno", "Confirm workout"))}</span>`,
                onClick: async () => {
                    const sheet = document.querySelector(".pt-detalle-entreno-sheet");
                    if (!sheet) return;
                    const confirmBtn = sheet.querySelector(".pt-sheet-extra-btn");
                    const caloriasEl = sheet.querySelector("[data-pt-calorias]");
                    const tiempoEl = sheet.querySelector("[data-pt-tiempo]");

                    const caloriasQuemadas = Number.parseInt(String(caloriasEl?.value ?? "").trim(), 10);
                    const tiempoTotalMin = Number.parseFloat(String(tiempoEl?.value ?? "").trim());

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

                    let origConfirmHtml = "";
                    if (confirmBtn) {
                        origConfirmHtml = confirmBtn.innerHTML;
                        confirmBtn.style.pointerEvents = "none";
                        confirmBtn.style.opacity = "0.75";
                        confirmBtn.innerHTML = `
                            <svg style="animation: pt-spin 0.8s linear infinite; vertical-align: middle; margin-right: 4px;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                            </svg>
                            <span style="vertical-align: middle;">${escapeHtml(tLang("Guardando...", "Saving..."))}</span>
                        `;
                    }

                    const restoreConfirmBtn = () => {
                        if (confirmBtn && origConfirmHtml) {
                            confirmBtn.innerHTML = origConfirmHtml;
                            confirmBtn.style.pointerEvents = "";
                            confirmBtn.style.opacity = "";
                        }
                    };

                    const now = getHoraActualLocal();
                    const idRegistro = (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function")
                        ? globalThis.crypto.randomUUID()
                        : `${dia_Actual}-${now.iso}-${Math.random().toString(36).slice(2, 10)}`;

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

                    try {
                        const res = await guardarRegistroEntreno(diasArray);
                        if (!res || !res.ok) {
                            const txt = res ? await res.text().catch(() => null) : null;
                            console.warn("No se pudo guardar Dias_cale:", res?.status, txt);
                            restoreConfirmBtn();
                            await openStatusSheet({ title: tLang("Error", "Error"), message: tLang("No se pudo guardar el registro. Intenta de nuevo.", "Could not save the record. Please try again.") });
                            return;
                        }
                    } catch (err) {
                        console.error("Error al guardar Dias_cale:", err);
                        restoreConfirmBtn();
                        await openStatusSheet({ title: tLang("Error", "Error"), message: tLang("Error al guardar el registro.", "Error saving the record.") });
                        return;
                    }
                    try { globalThis.PTBottomSheet?.close?.(); } catch { }

                    Swal.fire({
                        toast: true,
                        position: 'top',
                        icon: 'success',
                        title: tLang("Entreno registrado", "Workout registered"),
                        text: tLang(
                            `Se guardó el entreno de hoy a las ${now.hora}.`,
                            `Today's workout was saved at ${now.hora}.`
                        ),
                        showConfirmButton: false,
                        timer: 2500,
                        background: '#13141a',
                        color: '#fff',
                        customClass: {
                            popup: 'swal-custom-dark'
                        }
                    });

                    if (typeof window.recargarCalendario === "function") {
                        window.recargarCalendario();
                    }
                    if (typeof window.actualizarDetalleDiaSeleccionado === "function") {
                        window.actualizarDetalleDiaSeleccionado();
                    }
                }
            },
            didOpen: (sheet) => {
                try { globalThis.UIIdioma?.translatePage?.(sheet); } catch { }

                const caloriasEl = sheet.querySelector("[data-pt-calorias]");
                const tiempoEl = sheet.querySelector("[data-pt-tiempo]");
                const horasEl = sheet.querySelector("#pt-tiempo-horas");
                const minutosEl = sheet.querySelector("#pt-tiempo-minutos");

                if (caloriasEl instanceof HTMLInputElement && registroPrevio) {
                    caloriasEl.value = String(registroPrevio.calorias_quemadas ?? registroPrevio.caloriasQuemadas ?? "");
                }

                const totalMinInicial = Number.parseFloat(String(registroPrevio?.tiempo_total_min ?? registroPrevio?.tiempoTotalMin ?? tiempoPrevio ?? "0").trim());
                if (Number.isFinite(totalMinInicial) && totalMinInicial > 0) {
                    if (horasEl) horasEl.value = String(Math.floor(totalMinInicial / 60));
                    if (minutosEl) minutosEl.value = String(Math.round(totalMinInicial % 60));
                } else {
                    if (horasEl) horasEl.value = "";
                    if (minutosEl) minutosEl.value = "";
                }

                if (tiempoEl instanceof HTMLInputElement) {
                    tiempoEl.value = String(totalMinInicial);
                }

                const syncTiempo = () => {
                    const h = Number.parseInt(horasEl?.value || "0", 10);
                    const m = Number.parseInt(minutosEl?.value || "0", 10);
                    const totalMin = (Number.isFinite(h) && h >= 0 ? h : 0) * 60 + (Number.isFinite(m) && m >= 0 ? m : 0);
                    if (tiempoEl instanceof HTMLInputElement) {
                        tiempoEl.value = String(totalMin);
                    }
                };

                horasEl?.addEventListener("input", syncTiempo);
                minutosEl?.addEventListener("input", syncTiempo);
            },
        });
    };

    const openEditDia = async (headerEl) => {
        const dayIdx = Number(headerEl.getAttribute("data-day-idx"));
        if (!Number.isFinite(dayIdx)) return;

        let rawPlanText = localStorage.getItem("plan_entreno_usuario") || "";
        const diasOrden = ["lunes", "martes", "miércoles", "miercoles", "jueves", "viernes", "sábado", "sabado", "domingo", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

        const extractLikelyJsonText = (text) => {
            const s = String(text ?? "");
            const unfenced = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
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

        const parsed = (() => { try { return JSON.parse(extractLikelyJsonText(rawPlanText)) } catch { return null } })() ?? (() => { try { return JSON.parse(rawPlanText) } catch { return null } })();
        if (!parsed || typeof parsed !== "object") return;

        let root = Array.isArray(parsed) ? { ejercicios: parsed } : parsed;
        let actualRoot = root.plan_entrenamiento_hipertrofia ?? root.plan_entrenamiento ?? root.plan ?? root;

        const maybeDiasArray = actualRoot?.configuracion_semanal ?? actualRoot?.configuracionSemanal ?? actualRoot?.dias ?? actualRoot?.semana ?? actualRoot?.plan_semanal ?? actualRoot?.planSemanal;

        let targetDayObj = null;
        let isArrayStructure = false;
        let objectKey = "";

        if (Array.isArray(maybeDiasArray)) {
            isArrayStructure = true;
            const sortedDays = sortDiasArray(maybeDiasArray.map((d, i) => ({ ...d, originalIndex: i })));
            if (dayIdx >= 0 && dayIdx < sortedDays.length) {
                const chosen = sortedDays[dayIdx];
                targetDayObj = maybeDiasArray[chosen.originalIndex] || chosen;
            }
        } else {
            const weekdayKeys = Object.keys(actualRoot || {}).filter((k) => diasOrden.includes(String(k).toLowerCase()) || getDaySortIndex(k) < 999);
            if (weekdayKeys.length > 0) {
                const orderedKeys = [...weekdayKeys].sort((a, b) => {
                    const ia = getDaySortIndex(a);
                    const ib = getDaySortIndex(b);
                    return ia - ib;
                });
                if (dayIdx >= 0 && dayIdx < orderedKeys.length) {
                    objectKey = orderedKeys[dayIdx];
                    targetDayObj = { dia: objectKey, ejercicios: actualRoot[objectKey] };
                }
            }
        }

        if (!targetDayObj) return;

        const currentDia = String(isArrayStructure ? (targetDayObj.dia ?? targetDayObj.nombre ?? targetDayObj.day ?? objectKey) : objectKey).toLowerCase();
        const currentEnfoque = isArrayStructure ? (targetDayObj.enfoque ?? targetDayObj.focus ?? targetDayObj.objetivo ?? targetDayObj.titulo ?? targetDayObj.title ?? "") : "";
        const currentEjercicios = Array.isArray(targetDayObj.ejercicios) ? targetDayObj.ejercicios : [];

        let exercisesHtml = "";
        currentEjercicios.forEach((ex, i) => {
            const n = ex.nombre ?? ex.ejercicio ?? ex.exercise ?? ex.name ?? ex.titulo ?? ex.title ?? "";
            exercisesHtml += `
                <div class="edit-ex-item" data-index="${i}" style="margin-bottom: 10px; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;">
                    <input type="text" class="swal2-input ex-name-input" value="${escapeHtml(n)}" placeholder="Nombre del ejercicio" style="margin-top:0; height: 36px; font-size: 14px; color: #fff;" />
                </div>
            `;
        });

        // Compute used days
        const usedDiasLower = [];
        if (isArrayStructure) {
            maybeDiasArray.forEach(d => {
                if (Array.isArray(d?.ejercicios) && d.ejercicios.length > 0) {
                    usedDiasLower.push(String(d.dia ?? d.nombre ?? d.day ?? "").toLowerCase());
                }
            });
        } else {
            const weekdayKeys = Object.keys(actualRoot || {}).filter((k) => diasOrden.includes(String(k).toLowerCase()));
            weekdayKeys.forEach(k => {
                if (Array.isArray(actualRoot[k]) && actualRoot[k].length > 0) {
                    usedDiasLower.push(String(k).toLowerCase());
                }
            });
        }

        const formatDiaStr = (str) => String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

        const diasBtnsHtml = DIAS_SEMANA.map(d => {
            const dNorm = formatDiaStr(d.name);
            const currNorm = formatDiaStr(currentDia);
            const isCurrent = dNorm === currNorm;
            const isUsed = usedDiasLower.some(u => formatDiaStr(u) === dNorm);
            const disabled = isUsed && !isCurrent ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : '';
            return `<button type="button" class="swal-dia-btn" data-dia="${escapeHtml(d.code)}" data-name="${escapeHtml(d.name)}" aria-pressed="${isCurrent}" ${disabled}>${escapeHtml(d.label)}</button>`;
        }).join("");

        const html = `
            <div class="pt-detail pt-gen">
                <div class="pt-detail-hero pt-detail-hero-focus">
                    <div class="pt-detail-hero-row">
                        <div class="pt-detail-hero-title">${escapeHtml(tLang("Editar Día", "Edit Day"))}</div>
                    </div>
                </div>

                <div class="pt-detail-body">
                    <div class="pt-detail-viewport plan-detalle-viewport" role="region" aria-label="${escapeHtml(tLang("Opciones del día", "Day options"))}">
                        <div class="pt-detail-card">
                            <div class="pt-detail-card-inner">
                                <div class="pt-sheet-section-title">${escapeHtml(tLang("Día de la semana", "Day of week"))}</div>
                                <div class="swal-dias" role="group" style="margin-top: 5px;">
                                    ${diasBtnsHtml}
                                </div>
                            </div>
                        </div>

                        ${isArrayStructure ? `
                        <div class="pt-detail-card">
                            <div class="pt-detail-card-inner">
                                <div class="pt-sheet-section-title">${escapeHtml(tLang("Nombre / Enfoque", "Name / Focus"))}</div>
                                <input id="edit-enfoque-input" type="text" class="swal2-input" value="${escapeHtml(currentEnfoque)}" style="display: block; width: 100%; margin-top: 0; height: 44px; font-size: 15px; color: #fff; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0 12px; outline: none;">
                            </div>
                        </div>
                        ` : ""}

                        <div class="pt-detail-card">
                            <div class="pt-detail-card-inner">
                                <div class="pt-sheet-section-title">${escapeHtml(tLang("Ejercicios del día", "Day's exercises"))}</div>
                                <div id="pt-edit-selected-list" style="margin-top: 10px;"></div>
                                <button type="button" id="pt-edit-add-btn" class="btn-secondary" style="width:100%; margin-top: 15px;">
                                    ${escapeHtml(tLang("+ Añadir / quitar del catálogo", "+ Add / remove from catalog"))}
                                </button>
                            </div>
                        </div>

                        <div class="pt-detail-card" id="pt-edit-catalog-card" style="display:none; margin-top: 15px;">
                            <div class="pt-detail-card-inner">
                                <div class="pt-sheet-section-title">${escapeHtml(tLang("Catálogo", "Catalog"))}</div>
                                <p class="swal-helper">${escapeHtml(tLang("Marcá los ejercicios para añadirlos al día. Desmarca para quitarlos.", "Check exercises to add them to the day. Uncheck to remove."))}</p>
                                <div class="swal-ejercicios">
                                    ${renderListaEjerciciosSelectable()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        let isConfirmed = false;
        let confirmValue = null;

        const openWithSheet = globalThis.PTBottomSheet && typeof globalThis.PTBottomSheet.open === "function";
        if (openWithSheet) {
            let localSelected = [...currentEjercicios];
            await globalThis.PTBottomSheet.open({
                title: "",
                html: html,
                className: "pt-editar-dia-plan-sheet",
                showClose: false,
                showHandle: true,
                allowOutsideClose: true,
                allowEscapeClose: true,
                allowDragClose: true,
                triggerEl: headerEl,
                extraTopBtn: {
                    html: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg><span style="vertical-align: middle;">${escapeHtml(tLang("Guardar", "Save"))}</span>`,
                    onClick: async () => {
                        const sheet = document.querySelector(".pt-editar-dia-plan-sheet");
                        if (!sheet) return;

                        const activeDiaBtn = sheet.querySelector(".swal-dia-btn[aria-pressed='true']");
                        if (!activeDiaBtn) {
                            Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: tLang('Selecciona un día de la semana', 'Select a day of the week'), showConfirmButton: false, timer: 2000 });
                            return;
                        }

                        const newDiaLower = activeDiaBtn.getAttribute("data-name");
                        const newDia = newDiaLower.charAt(0).toUpperCase() + newDiaLower.slice(1);

                        const newEnfoque = isArrayStructure ? sheet.querySelector("#edit-enfoque-input")?.value || "" : "";

                        if (localSelected.length === 0) {
                            Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: tLang('Selecciona al menos un ejercicio', 'Select at least one exercise'), showConfirmButton: false, timer: 2000 });
                            return;
                        }

                        const newEjercicios = localSelected;

                        isConfirmed = true;
                        confirmValue = { newDia, newEnfoque, newEjercicios };
                        globalThis.PTBottomSheet.close();
                    }
                },
                didOpen: (sheet) => {
                    const diaBtns = sheet.querySelectorAll(".swal-dia-btn");
                    diaBtns.forEach(btn => {
                        if (!btn.hasAttribute("disabled")) {
                            btn.addEventListener("click", () => {
                                diaBtns.forEach(b => b.setAttribute("aria-pressed", "false"));
                                btn.setAttribute("aria-pressed", "true");
                            });
                        }
                    });

                    const renderSelected = () => {
                        const listEl = sheet.querySelector("#pt-edit-selected-list");
                        if (!listEl) return;
                        listEl.innerHTML = "";
                        if (localSelected.length === 0) {
                            listEl.innerHTML = `<p style="color:rgba(255,255,255,0.5); font-size:14px;">${escapeHtml(tLang("No hay ejercicios. Añade desde el catálogo.", "No exercises. Add from catalog."))}</p>`;
                            return;
                        }

                        localSelected.forEach((ex, idx) => {
                            const name = ex.nombre ?? ex.ejercicio ?? ex.name ?? "";
                            const _normEx = String(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
                            let bgImage = "";
                            if (window.ENTRENAMIENTOS_FLAT && window.ENTRENAMIENTOS_FLAT[_normEx]) {
                                bgImage = window.ENTRENAMIENTOS_FLAT[_normEx].gifUrl;
                            }

                            const bgStyle = bgImage
                                ? `background-image: linear-gradient(to right, rgba(20,20,20,0.9) 0%, rgba(20,20,20,0.7) 50%, rgba(20,20,20,0.4) 100%), url('${bgImage}'); background-size: cover; background-position: center; border: 1px solid rgba(255,255,255,0.1);`
                                : `background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);`;

                            const el = document.createElement("div");
                            el.style.cssText = `display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-radius: 12px; margin-bottom: 10px; position: relative; overflow: hidden; ${bgStyle}`;

                            const upSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`;
                            const downSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
                            const delSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

                            el.innerHTML = `
                                <div style="flex: 1; font-size: 15px; font-weight: 600; color: #fff; padding-right: 15px; line-height: 1.3; text-shadow: 0 1px 3px rgba(0,0,0,0.8); z-index: 1;">
                                    ${escapeHtml(name)}
                                </div>
                                <div style="display: flex; gap: 8px; z-index: 1; align-items: center;">
                                    <button type="button" class="btn-move-up" data-idx="${idx}" style="background:rgba(255,255,255,0.15); backdrop-filter:blur(4px); border:none; color:#fff; cursor:pointer; width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; transition:0.2s;" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''}>${upSvg}</button>
                                    <button type="button" class="btn-move-down" data-idx="${idx}" style="background:rgba(255,255,255,0.15); backdrop-filter:blur(4px); border:none; color:#fff; cursor:pointer; width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; transition:0.2s;" ${idx === localSelected.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>${downSvg}</button>
                                    <button type="button" class="btn-delete" data-idx="${idx}" style="background:rgba(255,68,68,0.2); backdrop-filter:blur(4px); border:none; color:#ff4444; cursor:pointer; width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; transition:0.2s;">${delSvg}</button>
                                </div>
                            `;
                            listEl.appendChild(el);
                        });

                        listEl.querySelectorAll(".btn-move-up").forEach(btn => {
                            btn.addEventListener("click", (e) => {
                                const idx = Number(e.currentTarget.getAttribute("data-idx"));
                                if (idx > 0) {
                                    [localSelected[idx - 1], localSelected[idx]] = [localSelected[idx], localSelected[idx - 1]];
                                    renderSelected();
                                }
                            });
                        });
                        listEl.querySelectorAll(".btn-move-down").forEach(btn => {
                            btn.addEventListener("click", (e) => {
                                const idx = Number(e.currentTarget.getAttribute("data-idx"));
                                if (idx < localSelected.length - 1) {
                                    [localSelected[idx], localSelected[idx + 1]] = [localSelected[idx + 1], localSelected[idx]];
                                    renderSelected();
                                }
                            });
                        });
                        listEl.querySelectorAll(".btn-delete").forEach(btn => {
                            btn.addEventListener("click", (e) => {
                                const idx = Number(e.currentTarget.getAttribute("data-idx"));
                                localSelected.splice(idx, 1);
                                renderSelected();
                                syncCheckboxes();
                            });
                        });
                    };

                    const syncCheckboxes = () => {
                        const checkboxes = sheet.querySelectorAll(".swal-ejercicios input[type='checkbox']");
                        const currentExNames = localSelected.map(ex => formatDiaStr(ex.nombre ?? ex.ejercicio ?? ex.name ?? ""));
                        checkboxes.forEach(chk => {
                            const valNorm = formatDiaStr(chk.value);
                            chk.checked = currentExNames.some(n => valNorm === n || valNorm.includes(n) || n.includes(valNorm));
                        });
                    };

                    sheet.querySelector("#pt-edit-add-btn")?.addEventListener("click", () => {
                        const catCard = sheet.querySelector("#pt-edit-catalog-card");
                        if (catCard) {
                            catCard.style.display = catCard.style.display === "none" ? "block" : "none";
                            // Scroll to catalog when opened
                            if (catCard.style.display === "block") {
                                setTimeout(() => catCard.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
                            }
                        }
                    });

                    const checkboxes = sheet.querySelectorAll(".swal-ejercicios input[type='checkbox']");
                    checkboxes.forEach(chk => {
                        chk.addEventListener("change", (e) => {
                            const name = e.target.value;
                            if (e.target.checked) {
                                // Add if not already there
                                const norm = formatDiaStr(name);
                                if (!localSelected.some(ex => formatDiaStr(ex.nombre ?? ex.ejercicio ?? ex.name ?? "") === norm)) {
                                    localSelected.push({ nombre: name, series: 4, repeticiones: "10-12", descanso_segundos: 90 });
                                }
                            } else {
                                const norm = formatDiaStr(name);
                                localSelected = localSelected.filter(ex => formatDiaStr(ex.nombre ?? ex.ejercicio ?? ex.name ?? "") !== norm);
                            }
                            renderSelected();
                        });
                    });

                    renderSelected();
                    syncCheckboxes();

                    const cancelBtn = sheet.querySelector("#pt-edit-cancel-btn");
                    if (cancelBtn) {
                        cancelBtn.addEventListener("click", () => {
                            globalThis.PTBottomSheet.close();
                        });
                    }

                    const saveBtn = sheet.querySelector("#pt-edit-save-btn");
                    if (saveBtn) {
                        saveBtn.addEventListener("click", () => {
                            const activeDiaBtn = sheet.querySelector(".swal-dia-btn[aria-pressed='true']");
                            if (!activeDiaBtn) {
                                Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: tLang('Selecciona un día de la semana', 'Select a day of the week'), showConfirmButton: false, timer: 2000 });
                                return;
                            }

                            const newDiaLower = activeDiaBtn.getAttribute("data-name");
                            const newDia = newDiaLower.charAt(0).toUpperCase() + newDiaLower.slice(1);

                            const newEnfoque = isArrayStructure ? sheet.querySelector("#edit-enfoque-input")?.value || "" : "";

                            if (localSelected.length === 0) {
                                Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: tLang('Selecciona al menos un ejercicio', 'Select at least one exercise'), showConfirmButton: false, timer: 2000 });
                                return;
                            }

                            const newEjercicios = localSelected;

                            isConfirmed = true;
                            confirmValue = { newDia, newEnfoque, newEjercicios };
                            globalThis.PTBottomSheet.close();
                        });
                    }
                }
            });
        }

        if (isConfirmed && confirmValue) {
            const { newDia, newEnfoque, newEjercicios } = confirmValue;

            if (isArrayStructure) {
                targetDayObj.dia = newDia;
                if (targetDayObj.nombre !== undefined && formatDiaStr(targetDayObj.nombre) === formatDiaStr(currentDia)) {
                    targetDayObj.nombre = newDia;
                }
                if (targetDayObj.day !== undefined && formatDiaStr(targetDayObj.day) === formatDiaStr(currentDia)) {
                    targetDayObj.day = newDia;
                }
                targetDayObj.enfoque = newEnfoque;
                targetDayObj.ejercicios = newEjercicios;
            } else {
                const formatDiaStrLower = (str) => String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                const oldKeyLower = formatDiaStrLower(objectKey);
                const newKeyLower = formatDiaStrLower(newDia);

                if (oldKeyLower !== newKeyLower) {
                    actualRoot[newKeyLower] = newEjercicios;
                    delete actualRoot[objectKey];
                } else {
                    actualRoot[objectKey] = newEjercicios;
                }
            }

            const newJson = JSON.stringify(parsed, null, 2);
            localStorage.setItem("plan_entreno_usuario", newJson);

            verificacion_plan_entrenamiento();

            Swal.fire({
                toast: true,
                position: 'top',
                icon: 'success',
                title: tLang("Guardando...", "Saving..."),
                text: tLang("Actualizando el plan de entrenamiento", "Updating training plan"),
                showConfirmButton: false,
                timer: 2500,
                background: '#13141a',
                color: '#ffffff',
                customClass: { popup: 'swal-dark-popup' }
            });

            // sync async
            actualizar_cambios_plan_entreno().catch(err => console.error(err));
        }
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

        let tecnica, sobrecarga, respiracion;

        const _normGif = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
        const searchName = _normGif(ex.nombre);

        let gifUrl = null;
        let matchedEx = null;

        if (window.ENTRENAMIENTOS_FLAT) {
            matchedEx = window.ENTRENAMIENTOS_FLAT[searchName];
            if (!matchedEx) {
                for (const [key, exObj] of Object.entries(window.ENTRENAMIENTOS_FLAT)) {
                    const enNorm = _normGif(translateExerciseNameToEnglish(key));
                    if (searchName.includes(key) || searchName.includes(enNorm) || (key.length > 5 && key.includes(searchName))) {
                        matchedEx = exObj;
                        break;
                    }
                }
            }
            if (matchedEx) {
                gifUrl = matchedEx.gifUrl;

                const parts = (matchedEx.descripcion_detallada || "").split('\n');
                for (const p of parts) {
                    if (p.toLowerCase().startsWith('técnica:')) tecnica = p.substring(8).trim();
                    else if (p.toLowerCase().startsWith('tecnica:')) tecnica = p.substring(8).trim();
                    else if (p.toLowerCase().startsWith('sobrecarga:')) sobrecarga = p.substring(11).trim();
                    else if (p.toLowerCase().startsWith('respiración:')) respiracion = p.substring(12).trim();
                    else if (p.toLowerCase().startsWith('respiracion:')) respiracion = p.substring(12).trim();
                }
            }
        }

        if (!tecnica) tecnica = tLang("Mantener postura neutra, rango completo y control en la fase excéntrica.", "Maintain neutral posture, full range of motion, and control the eccentric phase.");
        if (!sobrecarga) sobrecarga = tLang("Aumentar 2-5% de carga o 1-2 reps cuando completes el rango objetivo durante 1-2 sesiones.", "Add 2-5% weight or 1-2 reps once you hit the target range for 1-2 sessions.");
        if (!respiracion) respiracion = tLang("Inhala en la fase excéntrica; exhala en la fase concéntrica.", "Inhale on the eccentric phase; exhale on the concentric phase.");

        const nombreEs = escapeHtml(ex.nombre);
        const nombreEn = escapeHtml(ex.nombre_en ?? ex.nombre);
        const descripcion = escapeHtml(matchedEx ? (matchedEx.descripcion_guia || matchedEx.descripcion) : (ex.descripcion_guia || ex.descripcion || tecnica));
        const series = escapeHtml(ex.series);
        const reps = escapeHtml(formatReps(ex.repeticiones));
        const descanso = escapeHtml(ex.descanso_segundos);

        // Helper to find muscle group category
        const getMuscleGroupOfExercise = (name) => {
            const norm = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
            const target = norm(name);
            for (const [group, list] of Object.entries(globalThis.EJERCICIOS_INDICE || {})) {
                if (Array.isArray(list)) {
                    const found = list.some(exName => norm(exName) === target || target.includes(norm(exName)) || norm(exName).includes(target));
                    if (found) return group;
                }
            }
            return null;
        };

        const translateMuscleGroupToEnglish = (g) => {
            const m = {
                "Pecho": "Chest",
                "Espalda": "Back",
                "Piernas": "Legs",
                "Hombros": "Shoulders",
                "Brazos": "Arms",
                "Triceps": "Triceps",
                "Abdomen": "Abs",
                "Cardio": "Cardio"
            };
            return m[g] ?? g;
        };

        const group = getMuscleGroupOfExercise(ex.nombre);
        const tags = [];
        if (group) {
            tags.push(tLang(group, translateMuscleGroupToEnglish(group)));
        } else {
            tags.push(tLang("Fuerza", "Strength"));
        }
        const entorno = ex.entorno ?? (() => {
            try {
                return JSON.parse(localStorage.getItem("plan_entreno_usuario"))?.plan_entrenamiento_hipertrofia?.usuario?.entorno;
            } catch {
                return null;
            }
        })() ?? "gym";
        tags.push(tLang(entorno === "gym" ? "Gimnasio" : "Casa", entorno === "gym" ? "Gym" : "Home"));

        const formattedTitle = (() => {
            const name = isEnglish() ? nombreEn : nombreEs;
            const words = name.trim().split(/\s+/);
            if (words.length <= 1) {
                return `<span class="pt-new-title-accent">${name}.</span>`;
            }
            const lastWord = words.pop();
            const remaining = words.join(" ");
            return `${remaining} <br/><span class="pt-new-title-accent">${lastWord}.</span>`;
        })();

        const activeThemeColor = localStorage.getItem("ui_background_color") || "red";

        const html = `
            <div class="pt-new-detail theme-${activeThemeColor}">
                <div id="inline-edit-panel" style="display: none; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.08); padding: 24px 20px; flex-direction: column; gap: 16px;">
                    <div style="font-size: 15px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        ${escapeHtml(tLang("Editar Ejercicio", "Edit Exercise"))}
                    </div>
                    <div style="display: flex; gap: 12px; width: 100%;">
                        <div style="flex: 1;">
                            <label style="font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(tLang("Series", "Sets"))}</label>
                            <input id="inline-edit-series" type="number" value="${escapeHtml(ex.series || '')}" style="width: 100%; height: 44px; margin-top: 6px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #fff; padding: 0 14px; font-size: 15px; outline: none; transition: 0.2s; box-sizing: border-box;">
                        </div>
                        <div style="flex: 1;">
                            <label style="font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(tLang("Reps", "Reps"))}</label>
                            <input id="inline-edit-reps" type="text" value="${escapeHtml(ex.repeticiones || '')}" style="width: 100%; height: 44px; margin-top: 6px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #fff; padding: 0 14px; font-size: 15px; outline: none; transition: 0.2s; box-sizing: border-box;">
                        </div>
                        <div style="flex: 1;">
                            <label style="font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(tLang("Descanso", "Rest"))}</label>
                            <input id="inline-edit-rest" type="number" value="${escapeHtml(ex.descanso_segundos || '')}" style="width: 100%; height: 44px; margin-top: 6px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #fff; padding: 0 14px; font-size: 15px; outline: none; transition: 0.2s; box-sizing: border-box;">
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 4px;">
                        <button id="inline-edit-cancel" type="button" style="flex: 1; padding: 12px; background: rgba(255,255,255,0.08); border: none; border-radius: 10px; color: #fff; font-weight: 600; font-size: 14px; cursor: pointer;">${escapeHtml(tLang("Cancelar", "Cancel"))}</button>
                        <button id="inline-edit-save" type="button" style="flex: 1; padding: 12px; background: var(--my-primary, #e24a4a); border: none; border-radius: 10px; color: #fff; font-weight: 600; font-size: 14px; cursor: pointer;">${escapeHtml(tLang("Guardar Cambios", "Save Changes"))}</button>
                    </div>
                </div>

                ${gifUrl ? `
                    <div class="pt-new-detail-gif-hero">
                        <img src="${gifUrl}" alt="" class="pt-new-detail-hero-img" />
                        <div class="pt-new-detail-hero-overlay"></div>
                    </div>
                ` : ""}

                <div class="pt-new-detail-content-wrapper">
                    <!-- Left Column -->
                    <div class="pt-new-detail-left-col">
                        <!-- Bento Box Grid - Horizontal Stats -->
                        <div class="pt-bento-grid-horizontal">
                            <!-- Series -->
                            <div class="pt-bento-stat">
                                <div class="pt-bento-stat-glow"></div>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pt-bento-stat-icon"><path d="m12 3-10 5 10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>
                                <span class="pt-bento-stat-val">${series}</span>
                                <span class="pt-bento-stat-label">${escapeHtml(tLang("Series", "Sets"))}</span>
                            </div>

                            <!-- Reps -->
                            <div class="pt-bento-stat">
                                <div class="pt-bento-stat-glow"></div>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pt-bento-stat-icon"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                                <span class="pt-bento-stat-val">${reps}</span>
                                <span class="pt-bento-stat-label">${escapeHtml(tLang("Reps", "Reps"))}</span>
                            </div>

                            <!-- Descanso -->
                            <div class="pt-bento-stat">
                                <div class="pt-bento-stat-glow"></div>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pt-bento-stat-icon"><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="12" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/></svg>
                                <span class="pt-bento-stat-val">${descanso}s</span>
                                <span class="pt-bento-stat-label">${escapeHtml(tLang("Descanso", "Rest"))}</span>
                            </div>
                        </div>

                        <!-- Tags Row -->
                        <div class="pt-new-tags-row">
                            ${tags.map(tag => `<span class="pt-bento-tag">${escapeHtml(tag)}</span>`).join("")}
                        </div>

                        <!-- Title & Description Section -->
                        <div class="pt-new-title-section">
                            <h1 class="pt-new-title">
                                ${formattedTitle}
                            </h1>
                            ${descripcion ? `
                                <p class="pt-new-desc">
                                    ${descripcion}
                                </p>
                            ` : ""}
                        </div>
                    </div>

                    <!-- Right Column -->
                    <div class="pt-new-detail-right-col">
                        <!-- Info Modules Section -->
                        <div class="pt-new-modules">
                            <!-- Técnica Card -->
                            <div class="pt-new-card">
                                <div class="pt-new-card-icon-wrap">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pt-new-card-icon"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" x2="17" y1="12" y2="12"/></svg>
                                </div>
                                <div class="pt-new-card-content">
                                    <h3 class="pt-new-card-title">
                                        ${escapeHtml(tLang("Puntos de Técnica", "Technique Points"))}
                                    </h3>
                                    <p class="pt-new-card-text">
                                        ${escapeHtml(tecnica)}
                                    </p>
                                </div>
                            </div>

                            <!-- Sobrecarga Card -->
                            <div class="pt-new-card">
                                <div class="pt-new-card-icon-wrap accented">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pt-new-card-icon accented"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                                </div>
                                <div class="pt-new-card-content">
                                    <h3 class="pt-new-card-title accented">
                                        ${escapeHtml(tLang("Progresión (Sobrecarga)", "Progression (Overload)"))}
                                    </h3>
                                    <p class="pt-new-card-text">
                                        ${escapeHtml(sobrecarga)}
                                    </p>
                                </div>
                            </div>

                            <!-- Respiración Card -->
                            <div class="pt-new-card">
                                <div class="pt-new-card-icon-wrap">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pt-new-card-icon"><path d="M9.59 4.59A2 2 0 1 1 11 8H2"/><path d="M12.59 19.41A2 2 0 1 0 14 16H2"/><path d="M15.73 9.73A2.5 2.5 0 1 1 18 14H2"/></svg>
                                </div>
                                <div class="pt-new-card-content">
                                    <h3 class="pt-new-card-title">
                                        ${escapeHtml(tLang("Respiración", "Breathing"))}
                                    </h3>
                                    <p class="pt-new-card-text">
                                        ${escapeHtml(respiracion)}
                                    </p>
                                </div>
                            </div>
                        </div>
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
            className: "pt-new-detail-sheet",
            html,
            closeText,
            triggerEl: cardEl,
            extraTopBtn: {
                html: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle;"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg><span style="vertical-align: middle;">${escapeHtml(tLang("Editar", "Edit"))}</span>`,
                ariaLabel: tLang("Editar Ejercicio", "Edit Exercise"),
                onClick: () => {
                    const panel = document.getElementById("inline-edit-panel");
                    if (panel) {
                        if (panel.style.display === "none") {
                            panel.style.display = "flex";
                            panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        } else {
                            panel.style.display = "none";
                        }
                    }
                }
            },
            didOpen: (sheet) => {
                const root = sheet instanceof HTMLElement ? sheet : document.body;

                const cancelBtn = root.querySelector("#inline-edit-cancel");
                if (cancelBtn) {
                    cancelBtn.addEventListener("click", () => {
                        const panel = root.querySelector("#inline-edit-panel");
                        if (panel) panel.style.display = "none";
                    });
                }

                const saveBtn = root.querySelector("#inline-edit-save");
                if (saveBtn) {
                    saveBtn.addEventListener("click", async () => {
                        const seriesVal = root.querySelector("#inline-edit-series")?.value;
                        const repsVal = root.querySelector("#inline-edit-reps")?.value;
                        const restVal = root.querySelector("#inline-edit-rest")?.value;

                        const rawPlanText = localStorage.getItem("plan_entreno_usuario") || "";
                        const extractLikelyJsonText = (text) => {
                            const s = String(text ?? "");
                            const unfenced = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
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

                        const parsed = (() => { try { return JSON.parse(extractLikelyJsonText(rawPlanText)) } catch { return null } })() ?? (() => { try { return JSON.parse(rawPlanText) } catch { return null } })();
                        if (!parsed || typeof parsed !== "object") return;

                        let planRoot = Array.isArray(parsed) ? { ejercicios: parsed } : parsed;
                        let actualRoot = planRoot.plan_entrenamiento_hipertrofia ?? planRoot.plan_entrenamiento ?? planRoot.plan ?? planRoot;
                        const maybeDiasArray = actualRoot?.configuracion_semanal ?? actualRoot?.configuracionSemanal ?? actualRoot?.dias ?? actualRoot?.semana ?? actualRoot?.plan_semanal ?? actualRoot?.planSemanal;

                        let targetList = null;

                        if (Array.isArray(maybeDiasArray)) {
                            const sortedDays = sortDiasArray(maybeDiasArray.map((d, i) => ({ ...d, originalIndex: i })));
                            let filteredIdx = 0;
                            for (let i = 0; i < sortedDays.length; i++) {
                                const d = sortedDays[i];
                                const ejerciciosList = Array.isArray(d?.ejercicios) ? d.ejercicios : [];
                                if (ejerciciosList.length > 0) {
                                    if (filteredIdx === dayIdx) {
                                        targetList = maybeDiasArray[d.originalIndex]?.ejercicios || d.ejercicios;
                                        break;
                                    }
                                    filteredIdx++;
                                }
                            }
                        } else {
                            const weekdayKeys = Object.keys(actualRoot || {}).filter((k) => diasOrden.includes(String(k).toLowerCase()) || getDaySortIndex(k) < 999);
                            const orderedKeys = [...weekdayKeys].sort((a, b) => {
                                const ia = getDaySortIndex(a);
                                const ib = getDaySortIndex(b);
                                return ia - ib;
                            });

                            let filteredIdx = 0;
                            for (const k of orderedKeys) {
                                const ejerciciosList = Array.isArray(actualRoot[k]) ? actualRoot[k] : [];
                                if (ejerciciosList.length > 0) {
                                    if (filteredIdx === dayIdx) {
                                        targetList = ejerciciosList;
                                        break;
                                    }
                                    filteredIdx++;
                                }
                            }
                        }

                        if (targetList && targetList[exIdx]) {
                            targetList[exIdx].series = seriesVal ? Number(seriesVal) : targetList[exIdx].series;
                            targetList[exIdx].repeticiones = repsVal || targetList[exIdx].repeticiones;
                            targetList[exIdx].descanso_segundos = restVal ? Number(restVal) : targetList[exIdx].descanso_segundos;

                            localStorage.setItem("plan_entreno_usuario", JSON.stringify(parsed, null, 2));

                            try { globalThis.PTBottomSheet.close(); } catch { }

                            Swal.fire({
                                toast: true,
                                position: 'top',
                                icon: 'success',
                                title: tLang("Guardando...", "Saving..."),
                                text: tLang("Actualizando el ejercicio", "Updating exercise"),
                                showConfirmButton: false,
                                timer: 2500,
                                background: '#13141a',
                                color: '#ffffff',
                                customClass: { popup: 'swal-dark-popup' }
                            });

                            try { verificacion_plan_entrenamiento(); } catch { }
                            actualizar_cambios_plan_entreno().catch(err => console.error(err));
                        }
                    });
                }

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

        const chipEditarEl = target.closest(".chip-editar");
        if (chipEditarEl instanceof HTMLElement) {
            chipEditarEl.blur();
            const headerEl = chipEditarEl.closest(".plan-dia-header");
            if (headerEl) {
                await openEditDia(headerEl);
            }
            return;
        }

        const chipRegistrarEl = target.closest(".chip-registrar");
        if (chipRegistrarEl instanceof HTMLElement) {
            chipRegistrarEl.blur();
            const headerEl = chipRegistrarEl.closest(".plan-dia-header");
            if (headerEl) {
                await openDetalleDia(headerEl, chipRegistrarEl);
            }
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

        const chipEditarEl = target.closest(".chip-editar");
        if (chipEditarEl instanceof HTMLElement) {
            ev.preventDefault();
            const headerEl = chipEditarEl.closest(".plan-dia-header");
            if (headerEl) {
                await openEditDia(headerEl);
            }
            return;
        }

        const chipRegistrarEl = target.closest(".chip-registrar");
        if (chipRegistrarEl instanceof HTMLElement) {
            ev.preventDefault();
            const headerEl = chipRegistrarEl.closest(".plan-dia-header");
            if (headerEl) {
                await openDetalleDia(headerEl, chipRegistrarEl);
            }
        }
    });
}

function initPlanDiaPager() {
    const scroller = document.getElementById("Plan_ejercicio");
    if (!scroller) return;

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
            headers: { 'Content-Type': 'application/json' },
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

const openEditarDiasModal = async () => {
    const raw = localStorage.getItem("plan_entreno_usuario");
    if (!raw || raw === "Ninguno") return;

    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { return; }

    const root = parsed?.plan_entrenamiento_hipertrofia ?? parsed?.plan_entrenamiento ?? parsed?.plan ?? parsed;
    const maybeDiasArray = root.configuracion_semanal ?? root.configuracionSemanal ?? root.dias ?? root.semana ?? root.plan_semanal ?? root.planSemanal;

    let existingDays = [];
    if (Array.isArray(maybeDiasArray)) {
        existingDays = maybeDiasArray.map(d => String(d?.dia || "").toLowerCase().trim());
    } else {
        const diasOrden = ["lunes", "martes", "miércoles", "miercoles", "jueves", "viernes", "sábado", "sabado", "domingo"];
        existingDays = Object.keys(root || {}).filter((k) => diasOrden.includes(String(k).toLowerCase()));
    }

    const allDaysEs = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const allDaysEn = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    const isDayPresent = (dayEs) => {
        const norm = dayEs.toLowerCase().replace("é", "e").replace("á", "a");
        return existingDays.some(ed => {
            const edNorm = ed.toLowerCase().replace("é", "e").replace("á", "a");
            return edNorm === norm || (edNorm === "miercoles" && norm === "miercoles");
        });
    };

    const daysHtml = allDaysEs.map((dayEs, idx) => {
        const dayEn = allDaysEn[idx];
        const present = isDayPresent(dayEs);
        return `
            <button type="button" class="pt-edit-dia-btn${present ? " is-selected" : ""}" data-day="${escapeHtml(dayEs)}" data-was-in-plan="${present ? "true" : "false"}" aria-pressed="${present ? "true" : "false"}">
                <span class="pt-edit-dia-label" data-i18n-en="${dayEn}">${escapeHtml(dayEs)}</span>
                ${present ? `<span class="pt-edit-dia-badge" data-i18n-en="(In plan)">(En el plan)</span>` : ""}
            </button>
        `;
    }).join("");

    const html = `
        <div class="pt-status" style="text-align:left;">
            <p style="font-size: 14px; color: rgba(255,255,255,0.7); margin-top:0; margin-bottom: 16px;">
                ${escapeHtml(tLang(
        "Seleccioná los días que querés incluir en tu plan. Si quitás un día, se eliminará del plan junto con sus ejercicios.",
        "Select the days you want in your plan. If you remove a day, it will be removed from the plan along with its exercises."
    ))}
            </p>
            <div class="pt-edit-dias-list">
                ${daysHtml}
            </div>

        </div>
    `;

    await globalThis.PTBottomSheet.open({
        title: tLang("Gestionar días", "Manage days"),
        html,
        showClose: true,
        didOpen: (sheet) => {
            try { globalThis.UIIdioma?.translatePage?.(sheet); } catch { }

            const syncEditDayBadge = (btn) => {
                const selected = btn.getAttribute("aria-pressed") === "true";
                const wasInPlan = btn.getAttribute("data-was-in-plan") === "true";
                let badge = btn.querySelector(".pt-edit-dia-badge");
                if (selected && wasInPlan) {
                    if (!badge) {
                        btn.insertAdjacentHTML(
                            "beforeend",
                            `<span class="pt-edit-dia-badge" data-i18n-en="(In plan)">(En el plan)</span>`
                        );
                        try { globalThis.UIIdioma?.translatePage?.(btn); } catch { }
                    }
                } else if (badge) {
                    badge.remove();
                }
            };

            sheet.querySelectorAll(".pt-edit-dia-btn").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const pressed = btn.getAttribute("aria-pressed") === "true";
                    const next = !pressed;
                    btn.classList.toggle("is-selected", next);
                    btn.setAttribute("aria-pressed", next ? "true" : "false");
                    syncEditDayBadge(btn);
                });
            });

            sheet.querySelector("#btn-save-edit-dias").onclick = async () => {
                const checkedSet = new Set(
                    Array.from(sheet.querySelectorAll('.pt-edit-dia-btn[aria-pressed="true"]'))
                        .map((el) => String(el.getAttribute("data-day") || "").toLowerCase().replace("é", "e").replace("á", "a"))
                );

                if (checkedSet.size === 0) {
                    const confirmDel = confirm(tLang("Quitaste todos los días. Esto dejará tu plan vacío. ¿Continuar?", "You removed all days. This will leave your plan empty. Continue?"));
                    if (!confirmDel) return;
                }

                if (Array.isArray(maybeDiasArray)) {
                    for (let i = maybeDiasArray.length - 1; i >= 0; i--) {
                        const dNorm = String(maybeDiasArray[i]?.dia || "").toLowerCase().replace("é", "e").replace("á", "a");
                        const checkMatch = dNorm === "miercoles" ? "miercoles" : dNorm;
                        if (!checkedSet.has(checkMatch)) {
                            maybeDiasArray.splice(i, 1);
                        }
                    }

                    const existingNorms = new Set(maybeDiasArray.map(d => String(d?.dia || "").toLowerCase().replace("é", "e").replace("á", "a")));
                    checkedSet.forEach(c => {
                        if (!existingNorms.has(c)) {
                            const properName = allDaysEs.find(dayEs => dayEs.toLowerCase().replace("é", "e").replace("á", "a") === c);
                            if (properName) maybeDiasArray.push({ dia: properName, ejercicios: [] });
                        }
                    });

                    const weekOrder = ["lunes", "martes", "miércoles", "miercoles", "jueves", "viernes", "sábado", "sabado", "domingo"];
                    maybeDiasArray.sort((a, b) => {
                        const idxA = weekOrder.indexOf(String(a.dia).toLowerCase().replace("é", "e").replace("á", "a"));
                        const idxB = weekOrder.indexOf(String(b.dia).toLowerCase().replace("é", "e").replace("á", "a"));
                        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
                    });
                } else {
                    Object.keys(root).forEach(k => {
                        const kNorm = String(k).toLowerCase().replace("é", "e").replace("á", "a");
                        const checkMatch = kNorm === "miercoles" ? "miercoles" : kNorm;
                        const weekOrder = ["lunes", "martes", "miércoles", "miercoles", "jueves", "viernes", "sábado", "sabado", "domingo"];
                        if (weekOrder.includes(checkMatch) && !checkedSet.has(checkMatch)) {
                            delete root[k];
                        }
                    });

                    const existing = new Set(Object.keys(root).map(k => String(k).toLowerCase().replace("é", "e").replace("á", "a")));
                    checkedSet.forEach(c => {
                        if (!existing.has(c)) {
                            const properName = allDaysEs.find(dayEs => dayEs.toLowerCase().replace("é", "e").replace("á", "a") === c);
                            if (properName) root[properName.toLowerCase()] = [];
                        }
                    });
                }

                localStorage.setItem("plan_entreno_usuario", JSON.stringify(parsed));

                const btn = sheet.querySelector("#btn-save-edit-dias");
                btn.disabled = true;
                btn.textContent = tLang("Guardando...", "Saving...");

                await actualizar_cambios_plan_entreno();
                verificacion_plan_entrenamiento();
                globalThis.PTBottomSheet.close();
            };
        }
    });
};

window.openChatbotSheet = async ({ triggerEl }) => {
    if (!canUseBottomSheet()) return;

    const user_name = localStorage.getItem("username_usuario") || "";

    const formatChatbotMsg = (text) => {
        let html = escapeHtml(text);
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        html = html.replace(/^[\-\*]\s+(.*)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>(?:\n<li>.*<\/li>)*)/g, '<ul style="margin: 8px 0; padding-left: 20px;">$1</ul>');
        html = html.replace(/\n/g, '<br>');
        html = html.replace(/<br><ul/g, '<ul');
        html = html.replace(/<\/ul><br>/g, '</ul>');
        html = html.replace(/<\/li><br>/g, '</li>');
        return html;
    };

    const html = `
        <div class="chatbot-container">
            <div class="chatbot-messages" id="chatbot-messages">
                <div class="chat-msg chat-msg-bot">
                    <div class="chat-bubble">
                        ${formatChatbotMsg(tLang(`¡Hola! Soy tu TrAIner.\n¿En qué te puedo ayudar hoy, ${user_name}?`, `Hello ${user_name}! I am your TrAIner.\nHow can I help you today?`))}
                    </div>
                </div>
            </div>
            <div class="chatbot-input-area">
                <textarea id="chatbot-input" placeholder="${escapeHtml(tLang("Escribe tu mensaje...", "Type your message..."))}" rows="1"></textarea>
                <button id="chatbot-send" class="btn-icon" aria-label="Enviar" data-i18n-en-aria-label="Send">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            </div>
        </div>
        <style>
            .pt-chatbot-sheet .pt-sheet {
                height: 80vh !important;
                height: 80dvh !important;
                max-height: 85vh !important;
                max-height: 85dvh !important;
                display: flex !important;
                flex-direction: column !important;
            }
            .pt-chatbot-sheet .pt-sheet-content {
                flex: 1 1 0% !important;
                min-height: 0 !important;
                overflow: hidden !important;
                display: flex !important;
                flex-direction: column !important;
                padding: 20px !important;
            }
            .pt-chatbot-sheet .pt-sheet-content > div {
                flex: 1 1 0% !important;
                min-height: 0 !important;
                height: 100% !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
            }
            .chatbot-container {
                flex: 1 1 0% !important;
                display: flex !important;
                flex-direction: column !important;
                height: 100% !important;
                min-height: 0 !important;
                margin: -20px !important;
                position: relative !important;
                overflow: hidden !important;
            }
            .chatbot-messages {
                flex: 1 1 0% !important;
                min-height: 0 !important;
                height: 100% !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                touch-action: pan-y !important;
                overscroll-behavior-y: contain !important;
                -webkit-overflow-scrolling: touch !important;
                scroll-behavior: smooth;
                padding: 20px 20px 90px 20px !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 16px !important;
            }
            @media (max-width: 767px) {
                .pt-chatbot-sheet .pt-sheet {
                    height: 85vh !important;
                    height: 85dvh !important;
                    max-height: 90vh !important;
                    max-height: 90dvh !important;
                }
            }
            .chatbot-messages::-webkit-scrollbar {
                width: 6px;
            }
            .chatbot-messages::-webkit-scrollbar-track {
                background: transparent;
            }
            .chatbot-messages::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 10px;
            }
            .chatbot-messages::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.4);
            }
            .chat-msg {
                display: flex;
                max-width: 85%;
            }
            .chat-msg-user {
                align-self: flex-end;
            }
            .chat-msg-bot {
                align-self: flex-start;
            }
            .chat-bubble {
                padding: 12px 16px;
                border-radius: 18px;
                font-size: 14.5px;
                line-height: 1.45;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                word-break: break-word;
            }
            .chat-msg-user .chat-bubble {
                background: var(--my-primary);
                color: #fff;
                border-bottom-right-radius: 4px;
            }
            .chat-msg-bot .chat-bubble {
                background: rgba(255,255,255,0.08);
                color: rgba(255,255,255,0.92);
                border-bottom-left-radius: 4px;
            }
            .chatbot-input-area {
                display: flex;
                gap: 8px;
                padding: 6px 10px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 30px;
                align-items: flex-end;
                position: absolute;
                bottom: 16px;
                left: 16px;
                right: 16px;
                z-index: 10;
                box-shadow: 0 8px 24px rgba(0,0,0,0.4);
                pointer-events: auto;
                background: transparent;
            }
            .chatbot-input-area::before {
                content: "";
                position: absolute;
                inset: 0;
                border-radius: 30px;
                background: rgba(30, 30, 35, 0.6);
                backdrop-filter: blur(24px);
                -webkit-backdrop-filter: blur(24px);
                z-index: -1;
            }
            .chatbot-input-area textarea {
                flex: 1;
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                padding: 12px 4px 12px 14px;
                color: #fff;
                font-family: inherit;
                font-size: 14.5px;
                resize: none;
                max-height: 120px;
                min-height: 44px;
                line-height: 1.4;
            }
            .chatbot-input-area textarea:focus {
                outline: none;
            }
            .chatbot-input-area button {
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: var(--my-primary);
                border: none;
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                flex-shrink: 0;
                transition: transform 0.15s, background 0.15s;
                margin-bottom: 0px;
            }
            .chatbot-input-area button:active {
                transform: scale(0.92);
            }
        </style>
    `;

    await globalThis.PTBottomSheet.open({
        title: tLang("Entrenador IA", "AI Trainer"),
        className: "pt-chatbot-sheet",
        html,
        showClose: true,
        triggerEl,
        hideAd: true,
        extraTopBtn: {
            ariaLabel: "Limpiar historial",
            html: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
            onClick: async () => {
                const ok = await new Promise((resolve) => {
                    let resolved = false;
                    const safeResolve = (v) => {
                        if (resolved) return;
                        resolved = true;
                        resolve(!!v);
                    };
                    globalThis.PTBottomSheet.open({
                        title: tLang("Limpiar Chat", "Clear Chat"),
                        html: `
                            <div class="pt-status" style="padding: 16px 0;">
                                <div style="margin-bottom: 24px; font-size: 15px; text-align: center;">${escapeHtml(tLang("¿Borrar todo el historial de conversación con la IA?", "Clear the entire AI chat history?"))}</div>
                                <div style="display: flex; gap: 12px; justify-content: center;">
                                    <button class="btn-secondary" data-cancel style="padding: 12px 24px; border-radius: 999px;">${escapeHtml(tLang("Cancelar", "Cancel"))}</button>
                                    <button class="btn-primary" data-confirm style="padding: 12px 24px; border-radius: 999px; background: var(--my-danger, #ff4444); color: #fff;">${escapeHtml(tLang("Borrar", "Clear"))}</button>
                                </div>
                            </div>
                        `,
                        stack: true,
                        showClose: false,
                        showBack: false,
                        hideAd: true,
                        didOpen: (sheet) => {
                            sheet.querySelector("[data-cancel]")?.addEventListener("click", () => {
                                safeResolve(false);
                                globalThis.PTBottomSheet.close();
                            });
                            sheet.querySelector("[data-confirm]")?.addEventListener("click", () => {
                                safeResolve(true);
                                globalThis.PTBottomSheet.close();
                            });
                        },
                        willClose: () => safeResolve(false)
                    });
                });

                if (ok) {
                    localStorage.removeItem("pt_chatbot_history");
                    window.chatbotHistory = [];
                    const msgsContainer = document.querySelector("#chatbot-messages");
                    if (msgsContainer) {
                        const un = localStorage.getItem("username_usuario") || "";
                        msgsContainer.innerHTML = `
                            <div class="chat-msg chat-msg-bot">
                                <div class="chat-bubble">
                                    ${formatChatbotMsg(tLang(`¡Historial limpio!\n¿En qué te puedo ayudar hoy, ${un}?`, `History cleared!\nHow can I help you today, ${un}?`))}
                                </div>
                            </div>
                        `;
                    }
                }
            }
        },
        didOpen: (sheet) => {
            try { globalThis.UIIdioma?.translatePage?.(sheet); } catch { }

            const textarea = sheet.querySelector("#chatbot-input");
            const sendBtn = sheet.querySelector("#chatbot-send");
            const messagesContainer = sheet.querySelector("#chatbot-messages");

            const autoResize = () => {
                textarea.style.height = 'auto';
                textarea.style.height = (textarea.scrollHeight) + 'px';
            };
            textarea.addEventListener("input", autoResize);
            textarea.addEventListener("focus", () => {
                setTimeout(() => {
                    if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }, 300);
            });

            let savedHistory = [];
            try {
                savedHistory = JSON.parse(localStorage.getItem("pt_chatbot_history")) || [];
            } catch (e) { }
            window.chatbotHistory = savedHistory;

            savedHistory.forEach(msg => {
                const msgEl = document.createElement("div");
                msgEl.className = msg.role === "user" ? "chat-msg chat-msg-user" : "chat-msg chat-msg-bot";
                msgEl.innerHTML = `<div class="chat-bubble">${formatChatbotMsg(msg.content)}</div>`;
                messagesContainer.appendChild(msgEl);
            });

            // Wait for transition to finish before calculating scroll height
            setTimeout(() => {
                if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 350);

            sendBtn.addEventListener("click", async () => {
                const text = textarea.value.trim();
                if (!text) return;

                // Add user message to UI
                const msgEl = document.createElement("div");
                msgEl.className = "chat-msg chat-msg-user";
                msgEl.innerHTML = `<div class="chat-bubble">${formatChatbotMsg(text)}</div>`;
                messagesContainer.appendChild(msgEl);

                messagesContainer.scrollTop = messagesContainer.scrollHeight;

                textarea.value = "";
                autoResize();
                textarea.disabled = true;
                sendBtn.disabled = true;

                // Add loading indicator
                const loadingEl = document.createElement("div");
                loadingEl.className = "chat-msg chat-msg-bot";
                loadingEl.innerHTML = `<div class="chat-bubble" style="color: rgba(255,255,255,0.5);">${escapeHtml(tLang("Escribiendo...", "Typing..."))}</div>`;
                messagesContainer.appendChild(loadingEl);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;

                try {
                    const payload = {
                        idioma: window.UIIdioma?.getIdioma() || "es",
                        P_ent: localStorage.getItem("plan_entreno_usuario"),
                        P_alim: localStorage.getItem("plan_dieta_usuario") || localStorage.getItem("plan_alim_usuario") || "Ninguno",
                        D_user: {
                            edad: localStorage.getItem("edad_usuario"),
                            altura: localStorage.getItem("altura_usuario"),
                            peso: localStorage.getItem("peso_usuario"),
                            peso_objetivo: localStorage.getItem("peso_objetivo_usuario"),
                        },
                        consulta: text,
                        historial: window.chatbotHistory
                    };

                    const res = await fetch("/IA_chatbot", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                    });

                    if (!res.ok) throw new Error("Error en el servidor");
                    const data = await res.json();

                    if (data.error) throw new Error(data.error);

                    // Replace loading with actual response
                    loadingEl.innerHTML = `<div class="chat-bubble">${formatChatbotMsg(data.respuesta)}</div>`;

                    // Update history
                    window.chatbotHistory.push({ role: "user", content: text });
                    window.chatbotHistory.push({ role: "assistant", content: data.respuesta });

                    try {
                        localStorage.setItem("pt_chatbot_history", JSON.stringify(window.chatbotHistory));
                    } catch (e) { }
                } catch (e) {
                    loadingEl.innerHTML = `
                        <div class="chat-bubble" style="color: var(--my-danger, #ff4c4c); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span>${escapeHtml(tLang("Error al conectar.", "Error connecting."))}</span>
                            <button class="btn-resend" style="background: rgba(255,76,76,0.15); border: 1px solid rgba(255,76,76,0.3); color: inherit; border-radius: 12px; padding: 4px 10px; font-size: 13px; cursor: pointer; font-family: inherit; transition: opacity 0.2s;">
                                ${escapeHtml(tLang("Reintentar", "Retry"))}
                            </button>
                        </div>`;
                    const resendBtn = loadingEl.querySelector('.btn-resend');
                    if (resendBtn) {
                        resendBtn.addEventListener('click', () => {
                            loadingEl.remove();
                            msgEl.remove();
                            textarea.value = text;
                            sendBtn.click();
                        });
                        resendBtn.addEventListener('mouseover', () => resendBtn.style.opacity = '0.8');
                        resendBtn.addEventListener('mouseout', () => resendBtn.style.opacity = '1');
                    }
                } finally {
                    textarea.disabled = false;
                    sendBtn.disabled = false;
                    textarea.focus();
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            });

            // Allow sending with Enter key (but Shift+Enter adds a new line)
            textarea.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendBtn.click();
                }
            });
        }
    });
};

const openConfiguracionPlan = async () => {
    const html = `
        <div class="pt-status">
            <div class="pt-status-row pt-config-opt" id="opt-editar" style="cursor:pointer; display:block; margin-top: 12px;">
                <div class="pt-status-text">
                    <strong style="color:#fff;">${escapeHtml(tLang("Editar días (Manual)", "Edit days (Manual)"))}</strong>
                    <div style="font-size: 13px; color: rgba(255,255,255,0.7); margin-top: 6px; font-weight: normal;">
                        ${escapeHtml(tLang(
        "Elegí días vacíos para agregar al plan. Luego, podrás agregarles ejercicios directamente desde el dashboard.",
        "Choose empty days to add to the plan. You can then add exercises to them directly from the dashboard."
    ))}
                    </div>
                </div>
            </div>
            <div class="pt-status-row pt-config-opt" id="opt-regenerar" style="cursor:pointer; display:block; margin-top: 12px;">
                <div class="pt-status-text">
                    <strong style="color:var(--my-danger, #ff4c4c);">${escapeHtml(tLang("Regenerar todo el plan", "Regenerate entire plan"))}</strong>
                    <div style="font-size: 13px; color: rgba(255,255,255,0.7); margin-top: 6px; font-weight: normal;">
                        ${escapeHtml(tLang("Elimina el plan actual y crea uno nuevo basado en tus preferencias.", "Deletes the current plan and creates a new one based on your preferences."))}
                    </div>
                </div>
            </div>
            <div class="pt-status-row pt-config-opt" id="opt-borrar" style="cursor:pointer; display:block; margin-top: 12px; border-color: rgba(255,76,76,0.3);">
                <div class="pt-status-text">
                    <strong style="color:var(--my-danger, #ff4c4c);">${escapeHtml(tLang("Borrar plan", "Delete plan"))}</strong>
                    <div style="font-size: 13px; color: rgba(255,255,255,0.7); margin-top: 6px; font-weight: normal;">
                        ${escapeHtml(tLang("Elimina tu plan de entrenamiento actual y lo deja vacío.", "Deletes your current training plan and leaves it empty."))}
                    </div>
                </div>
            </div>
        </div>
        <style>
            .pt-config-opt {
                padding: 14px;
                border: 1px solid rgba(255,255,255,0.05);
                border-radius: 12px;
                background: rgba(255,255,255,0.02);
                transition: background 0.2s;
            }
            .pt-config-opt:active { background: rgba(255,255,255,0.08); }
        </style>
    `;

    if (!canUseBottomSheet()) return;

    await globalThis.PTBottomSheet.open({
        title: tLang("Configuración del plan", "Plan configuration"),
        html,
        showClose: true,
        closeText: tLang("Cerrar", "Close"),
        didOpen: (sheet) => {
            try { globalThis.UIIdioma?.translatePage?.(sheet); } catch { }

            sheet.querySelector("#opt-editar").onclick = () => {
                globalThis.PTBottomSheet.close();
                openEditarDiasModal();
            };

            sheet.querySelector("#opt-regenerar").onclick = () => {
                globalThis.PTBottomSheet.close();
                Regen_plan();
            };

            sheet.querySelector("#opt-borrar").onclick = async () => {
                globalThis.PTBottomSheet.close();
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
            };
        }
    });
};

async function Regen_plan() {
    const plan_entreno_actual = localStorage.getItem("plan_entreno_usuario");

    const detectIntensidadFromPlan = (raw) => {
        if (raw == null) return null;
        const asString = typeof raw === "string" ? raw.trim() : JSON.stringify(raw);
        if (!asString || asString === "Ninguno") return null;

        const extractLikelyJson = (text) => {
            const s = String(text ?? "");
            const unfenced = s
                .replace(/^`{3}(?:json)?\s*/i, "")
                .replace(/\s*`{3}\s*$/i, "")
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

    const result = await Swal.fire({
        title: tLang("Regenerar plan de entrenamiento", "Regenerate training plan"),
        text: isEnglish()
            ? `Your current plan will be deleted and a new one will be generated based on the previous configuration. Detected intensity: ${intensidadDetectada} (${ejerciciosPorDiaDetectados} exercises per day).`
            : `Se eliminará el plan actual y se generará uno nuevo basado en la configuración previa. Intensidad detectada: ${intensidadDetectada} (${ejerciciosPorDiaDetectados} ejercicios por día).`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: tLang("Sí, regenerar", "Yes, regenerate"),
        cancelButtonText: tLang("Cancelar", "Cancel"),
        confirmButtonColor: 'var(--my-primary)',
        background: '#13141a',
        color: '#ffffff',
        customClass: {
            popup: 'swal-dark-popup'
        }
    });

    if (!result.isConfirmed) return;

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
    const data = await openGenerarPlanModal(plan_entreno_actual);

    if (!data?.isConfirmed) {
        if (botonRegenerar) botonRegenerar.style.display = "inline-block";
        return;
    }

    if (data.isManual) {
        await crearPlanManual(data.diasData);
    } else {
        await crearPlanEntreno(data.lugar, data.objetivo, data.dias, data.ejercicios, data.intensidad);
    }
}
