import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.94.1/+esm";

const supabaseUrl = "https://lhecmoeilmhzgxpcetto.supabase.co";
const supabaseKey = "sb_publishable_oLC8LcDLa3jR72Hpd_jJsA_eXjMlP3-";
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: false, storage: localStorage },
});

const sweetalert = window.swal;

const username = localStorage.getItem("username_usuario");
const avatar = localStorage.getItem("avatar_usuario");

const isEnglish = () => (globalThis.UIIdioma?.getIdioma?.() || "es") === "en";
const tLang = (es, en) => (isEnglish() ? en : es);

const NETLIFY_EDGE_UNCAUGHT = "uncaught exception during edge function invocation";

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

const closeModalSafe = () => {
    try {
        globalThis.PTBottomSheet?.close?.();
        return;
    } catch {
        // ignore
    }
    try {
        sweetalert?.close?.();
    } catch {
        // ignore
    }
};

const openStatusSheet = async ({
    title,
    html,
    ariaLabel,
    showClose = false,
    showHandle = true,
    allowOutsideClose = true,
    allowEscapeClose = true,
    allowDragClose = true,
    closeText = tLang("Cerrar", "Close"),
    didOpen,
    willClose,
    triggerEl = null,
} = {}) => {
    if (canUseBottomSheet()) {
        await globalThis.PTBottomSheet.open({
            title: title || "",
            ariaLabel: ariaLabel || title || "",
            html: html || "",
            closeText,
            showClose,
            showHandle,
            showBack: false,
            allowOutsideClose,
            allowEscapeClose,
            allowDragClose,
            didOpen,
            willClose,
            triggerEl,
        });
        return;
    }

    // Sin PTBottomSheet: fallback nativo (evita SweetAlert)
    try {
        const strip = (s) => String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        const msg = [strip(title), strip(html)].filter(Boolean).join("\n\n");
        if (msg) window.alert(msg);
    } catch {
        // ignore
    }
};

const showBlockingLoading = ({ title, text } = {}) => {
    const safeTitle = String(title || tLang("Generando", "Generating"));
    const safeText = String(text || tLang("Por favor, esperá...", "Please wait..."));

    if (canUseBottomSheet()) {
        void globalThis.PTBottomSheet.open({
            title: safeTitle,
            ariaLabel: safeTitle,
            html: `
                <div class="pt-status">
                    <div class="pt-status-row">
                        <div class="pt-spinner" aria-hidden="true"></div>
                        <div class="pt-status-text">${escapeHtml(safeText)}</div>
                    </div>
                </div>
            `,
            showClose: false,
            showHandle: false,
            showBack: false,
            allowOutsideClose: false,
            allowEscapeClose: false,
            allowDragClose: false,
            didOpen: (sheet) => {
                try {
                    globalThis.UIIdioma?.translatePage?.(sheet);
                } catch {
                    // ignore
                }
            },
        });
        return () => closeBottomSheetSafe();
    }

    // Sin PTBottomSheet: no bloquear con SweetAlert (fallback no-op)
    return () => {
        // no-op
    };
};

const openConfirmSheet = ({ title, message, confirmText, triggerEl = null } = {}) => {
    const safeTitle = String(title || tLang("Confirmar", "Confirm"));
    const safeMessage = String(message || "");
    const safeConfirm = String(confirmText || tLang("Aceptar", "OK"));

    if (!canUseBottomSheet()) {
        // Fallback nativo: evita SweetAlert
        try {
            return Promise.resolve(window.confirm([safeTitle, safeMessage].filter(Boolean).join("\n\n")));
        } catch {
            return Promise.resolve(false);
        }
    }

	return new Promise((resolve) => {
        let resolved = false;
        const safeResolve = (v) => {
            if (resolved) return;
            resolved = true;
            resolve(!!v);
        };

        void globalThis.PTBottomSheet.open({
            title: safeTitle,
            ariaLabel: safeTitle,
            triggerEl,
            html: `
                <div class="pt-status">
                    <div class="pt-status-row">
                        <div class="pt-status-text">${escapeHtml(safeMessage)}</div>
                    </div>
                    <div class="pt-status-actions">
                        <button type="button" class="btn-primary" data-pt-confirm>
                            ${escapeHtml(safeConfirm)}
                        </button>
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
                try {
                    globalThis.UIIdioma?.translatePage?.(sheet);
                } catch {
                    // ignore
                }

                sheet.querySelector("[data-pt-confirm]")?.addEventListener("click", () => {
                    safeResolve(true);
                    closeModalSafe();
                });
            },
            willClose: () => safeResolve(false),
        });
    });
};

const isPlanAlimentacionVacio = (value) => {
    const v = String(value ?? "").trim();
    if (!v) return true;
    const lower = v.toLowerCase();
    return lower === "ninguno" || lower === "proximamente";
};

const escapeHtml = (value) =>
    String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

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
        : "Este es un error del servidor de hosting (<strong>Netlify</strong>). Por favor, aguardá unos minutos e intentá nuevamente.";

    const html = `
        <div class="server-error">
            <div class="server-error__hero">${escapeHtml(NETLIFY_EDGE_UNCAUGHT)}</div>
            <div class="server-error__meta">
                <div><strong>Endpoint:</strong> ${escapeHtml(safeEndpoint)}</div>
                <div><strong>HTTP:</strong> ${escapeHtml(safeStatus)}${safeStatusText ? ` (${escapeHtml(safeStatusText)})` : ""}</div>
            </div>
            ${safeBody ? `<pre class="server-error__body">${escapeHtml(safeBody.slice(0, 1200))}</pre>` : ""}
            <p class="server-error__note">${hostingNote}</p>
        </div>
    `;

    await openStatusSheet({
        title: tLang("Error del servidor", "Server error"),
        ariaLabel: tLang("Error del servidor", "Server error"),
        html: `
            ${html}
            <div class="pt-status-actions">
                <button type="button" class="btn-primary" data-pt-close>${escapeHtml(tLang("Entendido", "OK"))}</button>
            </div>
        `,
        showClose: false,
        showHandle: true,
        allowOutsideClose: true,
        allowEscapeClose: true,
        allowDragClose: true,
        didOpen: (sheet) => {
            try {
                globalThis.UIIdioma?.translatePage?.(sheet);
            } catch {
                // ignore
            }

            sheet.querySelector("[data-pt-close]")?.addEventListener("click", () => closeModalSafe());
        },
    });
};

// Mantener alturas de header/footer para layout fijo (CSS usa --header-fixed/--footer-fixed)
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

const prefersReducedMotion = () => {
    try {
        return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
        return false;
    }
};

const getFixedHeaderOffset = () => {
    const header = document.querySelector("header");
    const headerH = header ? header.offsetHeight : 0;
    return Math.max(0, headerH + 12);
};

const scrollToWithFixedHeader = (el, { behavior = "auto" } = {}) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const top = rect.top + window.scrollY - getFixedHeaderOffset();
    window.scrollTo({ top: Math.max(0, top), behavior });
};

const focusPlanAlimentacionContainer = (planEl, { behavior = "auto" } = {}) => {
    const section = document.getElementById("Alimentacion");
    const visiblePlan = planEl && planEl.style.display !== "none";
    const target = visiblePlan ? planEl : (section || planEl);
    if (!target) return;
    scrollToWithFixedHeader(target, { behavior });
    if (typeof target.focus === "function") target.focus({ preventScroll: true });
};

const autofocusPlanAlimentacionOncePerSession = (planEl) => {
    const behavior = prefersReducedMotion() ? "auto" : "smooth";
    try {
        const key = "autofocus_plan_aliment_done";
        if (sessionStorage.getItem(key) === "1") return;
        sessionStorage.setItem(key, "1");
        focusPlanAlimentacionContainer(planEl, { behavior });
    } catch {
        focusPlanAlimentacionContainer(planEl, { behavior });
    }
};

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

const DIAS_ORDEN = [
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

const normalizeDayLabel = (value, fallback = tLang("Día", "Day")) => {
    const s = String(value ?? "").trim();
    if (!s) return fallback;
    // Capitalizar primera letra
    return s.charAt(0).toUpperCase() + s.slice(1);
};

const normalizeMacros = (macros) => {
    if (!macros || typeof macros !== "object") return null;
    const c = macros.carbohidratos ?? macros.carbos ?? macros.carbs;
    const p = macros.proteinas ?? macros.proteínas ?? macros.protein;
    const g = macros.grasas ?? macros.fats ?? macros.grasa;
    const toNum = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };
    const out = {
        carbohidratos: toNum(c),
        proteinas: toNum(p),
        grasas: toNum(g),
    };
    if (out.carbohidratos == null && out.proteinas == null && out.grasas == null) return null;
    return out;
};

const normalizeMeals = (comidas) => {
    if (!Array.isArray(comidas)) return [];
    const out = [];
    const defaultMealName = tLang("Comida", "Meal");
    for (const c of comidas) {
        if (!c || typeof c !== "object") continue;
        const nombre = c.nombre ?? c.name ?? c.titulo ?? c.title;
        const descripcion = c.descripcion ?? c.description ?? c.detalle ?? c.detalles;
        const calorias_aprox = c.calorias_aprox ?? c.calorias ?? c.kcal;
        if (!nombre && !descripcion) continue;
        out.push({
            nombre: String(nombre ?? defaultMealName).trim() || defaultMealName,
            descripcion: String(descripcion ?? "").trim() || "-",
            calorias_aprox: Number.isFinite(Number(calorias_aprox)) ? Number(calorias_aprox) : null,
        });
    }
    return out;
};

const parsePlanDiasDetalladosAliment = (planRaw) => {
    if (planRaw == null) return null;
    const asString = typeof planRaw === "string" ? planRaw.trim() : JSON.stringify(planRaw);
    if (isPlanAlimentacionVacio(asString)) return null;

    const extracted = extractLikelyJson(asString);
    const parsed = tryParseJson(extracted) ?? tryParseJson(asString);
    if (!parsed || typeof parsed !== "object") return null;

    const root = parsed.plan_alimentacion ?? parsed.planAlimentacion ?? parsed;

    const maybeDiasArray =
        root.configuracion_semanal ??
        root.configuracionSemanal ??
        root.dias ??
        root.semana ??
        root.plan_semanal ??
        root.planSemanal;

    if (Array.isArray(maybeDiasArray)) {
        return maybeDiasArray
            .map((d) => {
                if (!d || typeof d !== "object") return null;
                return {
                    dia: normalizeDayLabel(d.dia ?? d.day ?? d.nombre_dia ?? d.nombreDia, tLang("Día", "Day")),
                    calorias_objetivo: Number.isFinite(Number(d.calorias_objetivo ?? d.caloriasObjetivo ?? d.calorias ?? d.kcal))
                        ? Number(d.calorias_objetivo ?? d.caloriasObjetivo ?? d.calorias ?? d.kcal)
                        : null,
                    comidas: normalizeMeals(d.comidas ?? d.meals),
                    macros: normalizeMacros(d.macros_porcentaje ?? d.macrosPorcentaje ?? d.macros),
                    recomendaciones: Array.isArray(d.recomendaciones_alimentos ?? d.recomendaciones ?? d.foods)
                        ? (d.recomendaciones_alimentos ?? d.recomendaciones ?? d.foods).map((x) => String(x)).filter(Boolean)
                        : [],
                    tips: Array.isArray(d.tips ?? d.consejos)
                        ? (d.tips ?? d.consejos).map((x) => String(x)).filter(Boolean)
                        : [],
                };
            })
            .filter(Boolean);
    }

    // Alternativa: objeto con keys de días
    const weekdayKeys = Object.keys(root || {}).filter((k) => DIAS_ORDEN.includes(String(k).toLowerCase()));
    if (weekdayKeys.length > 0) {
        const ordered = [...weekdayKeys].sort((a, b) => DIAS_ORDEN.indexOf(a.toLowerCase()) - DIAS_ORDEN.indexOf(b.toLowerCase()));
        return ordered
            .map((k) => {
                const d = root[k];
                if (!d || typeof d !== "object") return null;
                return {
                    dia: normalizeDayLabel(k),
                    calorias_objetivo: Number.isFinite(Number(d.calorias_objetivo ?? d.calorias ?? d.kcal))
                        ? Number(d.calorias_objetivo ?? d.calorias ?? d.kcal)
                        : null,
                    comidas: normalizeMeals(d.comidas ?? d.meals),
                    macros: normalizeMacros(d.macros_porcentaje ?? d.macros),
                    recomendaciones: Array.isArray(d.recomendaciones_alimentos ?? d.recomendaciones)
                        ? (d.recomendaciones_alimentos ?? d.recomendaciones).map((x) => String(x)).filter(Boolean)
                        : [],
                    tips: Array.isArray(d.tips ?? d.consejos)
                        ? (d.tips ?? d.consejos).map((x) => String(x)).filter(Boolean)
                        : [],
                };
            })
            .filter(Boolean);
    }

    return null;
};

const renderMealCard = (meal, idx, dayIdx) => {
    const kcal = meal.calorias_aprox != null ? `${Math.round(meal.calorias_aprox)} kcal` : null;
    return `
        <article class="plan-card" data-idx="${idx}" data-day-idx="${escapeHtml(dayIdx)}" role="button" tabindex="0">
            <h3 class="plan-nombre">${escapeHtml(meal.nombre)}</h3>
            <p class="plan-desc">${escapeHtml(meal.descripcion)}</p>
            ${kcal ? `<div class="plan-meta"><span class="plan-chip"><strong>${escapeHtml(kcal)}</strong></span></div>` : ""}
        </article>
    `;
};

const renderDaySection = (dia, dayIdx) => {
    const kcal = dia.calorias_objetivo != null ? `${Math.round(dia.calorias_objetivo)} kcal` : "-";
    const comidasCount = dia.comidas?.length ?? 0;
    const subtitleEs = `${kcal} · ${comidasCount} comida${comidasCount === 1 ? "" : "s"}`;
    const subtitleEn = `${kcal} · ${comidasCount} meal${comidasCount === 1 ? "" : "s"}`;
    const meals = dia.comidas || [];
    const mealsHtml =
        meals.map((meal, idx) => renderMealCard(meal, idx, dayIdx)).join("\n") ||
        `<div class="plan-aviso" data-i18n-en="No meals defined.">No hay comidas definidas.</div>`;

    return `
        <section class="plan-dia" data-day-index="${dayIdx}">
            <header class="plan-dia-header" data-day-idx="${escapeHtml(dayIdx)}" role="button" tabindex="0" aria-label="${escapeHtml(tLang("Detalle del día", "Day detail"))} ${dayIdx + 1}">
                <div class="plan-dia-titulos">
                    <h2 class="plan-dia-titulo">${escapeHtml(dia.dia)}</h2>
                    <div class="plan-dia-subtitle">${escapeHtml(dia.calorias_objetivo ?? 0)} kcal · ${meals.length} ${escapeHtml(tLang("comida(s)", "meal(s)"))}</div>
                </div>
            </header>
            <div class="plan-grid">${mealsHtml}</div>
        </section>
    `;
};

const mapear_plan_alimentacion = (planRaw) => {
    if (planRaw == null) return `<div class="plan-vacio" data-i18n-en="No plan loaded.">No hay plan cargado.</div>`;
    const asString = typeof planRaw === "string" ? planRaw.trim() : JSON.stringify(planRaw);
    if (isPlanAlimentacionVacio(asString)) return `<div class="plan-vacio" data-i18n-en="No plan loaded.">No hay plan cargado.</div>`;

    const dias = parsePlanDiasDetalladosAliment(planRaw);
    if (!dias || dias.length === 0) {
        return `
            <div class="plan-aviso" data-i18n-en="Could not parse the plan as structured JSON. Showing raw content:">No se pudo interpretar el plan como JSON estructurado. Mostrando contenido crudo:</div>
            <pre class="plan-raw">${escapeHtml(String(planRaw).slice(0, 9000))}</pre>
        `;
    }

    const html = dias.map((d, idx) => renderDaySection(d, idx)).join("\n");
    return `<div class="plan-container plan-snap">${html}</div>`;
};

const initDetallePorDiaPlanAliment = (contenedor) => {
    if (!contenedor) return;
    if (contenedor.dataset.detalleDiaInit === "1") return;
    contenedor.dataset.detalleDiaInit = "1";

    const openDetalleDia = async (headerEl) => {
        const dayIdx = Number(headerEl.getAttribute("data-day-idx"));
        if (!Number.isFinite(dayIdx)) return;

        const planRaw = localStorage.getItem("plan_dieta_usuario");
        const dias = parsePlanDiasDetalladosAliment(planRaw);
        const diaInfo = dias[dayIdx];
        if (!diaInfo) return;

        const macros = diaInfo.macros || {};
        const recoms = Array.isArray(diaInfo.recomendaciones) ? diaInfo.recomendaciones : [];
        const tips = Array.isArray(diaInfo.tips) ? diaInfo.tips : [];

        const html = `
            <div class="pt-detail">
                <div class="pt-detail-hero">
                    <div class="pt-detail-hero-title">${escapeHtml(diaInfo.dia)}</div>
                    <div class="pt-detail-hero-sub">${escapeHtml(tLang("Resumen del día y recomendaciones", "Day summary and recommendations"))}</div>
                </div>

                <div class="pt-detail-viewport" style="overflow-x:hidden;">
                    <div class="pt-detail-diet-layout" style="padding:16px;">
                        <div class="pt-detail-diet-col1">
                            <section style="margin-bottom:20px;">
                                <h3 class="pt-sheet-section-title">${escapeHtml(tLang("Objetivo Diario", "Daily Goal"))}</h3>
                                <div class="pt-sheet-item">
                                    <div class="pt-sheet-item-left">
                                        <div class="pt-sheet-item-title">${escapeHtml(tLang("Calorías Totales", "Total Calories"))}</div>
                                        <div class="pt-sheet-item-sub">${escapeHtml(tLang("Meta para hoy", "Goal for today"))}</div>
                                    </div>
                                    <div class="pt-sheet-item-right">${escapeHtml(diaInfo.calorias_objetivo)} kcal</div>
                                </div>
                            </section>

                            ${(macros.carbohidratos || macros.proteinas || macros.grasas) ? `
                            <section style="margin-bottom:20px;">
                                <h3 class="pt-sheet-section-title">${escapeHtml(tLang("Distribución de Macros", "Macro Distribution"))}</h3>
                                <div class="pt-sheet-list">
                                    <div class="pt-sheet-item">
                                        <div class="pt-sheet-item-title">${escapeHtml(tLang("Carbohidratos", "Carbs"))}</div>
                                        <div class="pt-sheet-item-right">${macros.carbohidratos}%</div>
                                    </div>
                                    <div class="pt-sheet-item">
                                        <div class="pt-sheet-item-title">${escapeHtml(tLang("Proteínas", "Proteins"))}</div>
                                        <div class="pt-sheet-item-right">${macros.proteinas}%</div>
                                    </div>
                                    <div class="pt-sheet-item">
                                        <div class="pt-sheet-item-title">${escapeHtml(tLang("Grasas", "Fats"))}</div>
                                        <div class="pt-sheet-item-right">${macros.grasas}%</div>
                                    </div>
                                </div>
                            </section>
                            ` : ""}
                        </div>

                        <div class="pt-detail-diet-col2">
                            ${recoms.length ? `
                            <section style="margin-bottom:20px;">
                                <h3 class="pt-sheet-section-title">${escapeHtml(tLang("Recomendaciones", "Recommendations"))}</h3>
                                <ul class="pt-detail-list">
                                    ${recoms.map(r => `
                                        <li>
                                            <span class="pt-detail-tag">${escapeHtml(tLang("Tip", "Tip"))}</span>
                                            <div class="pt-detail-text">${escapeHtml(r)}</div>
                                        </li>
                                    `).join("")}
                                </ul>
                            </section>
                            ` : ""}

                            ${tips.length ? `
                            <section>
                                <h3 class="pt-sheet-section-title">${escapeHtml(tLang("Tips del Día", "Daily Tips"))}</h3>
                                <ul class="pt-detail-list">
                                    ${tips.map(t => `
                                        <li>
                                            <span class="pt-detail-tag" style="background:rgba(182, 168, 255, 0.15); border-color:rgba(182, 168, 255, 0.3); color:#B6A8FF;">IDE</span>
                                            <div class="pt-detail-text">${escapeHtml(t)}</div>
                                        </li>
                                    `).join("")}
                                </ul>
                            </section>
                            ` : ""}
                        </div>
                    </div>
                </div>
            </div>
        `;

        await globalThis.PTBottomSheet.open({
            title: "",
            ariaLabel: `${tLang("Detalle del día", "Day detail")}: ${diaInfo.dia}`,
            className: "pt-diet-day-detail-sheet",
            html,
            closeText: tLang("Cerrar", "Close"),
            triggerEl: headerEl,
            didOpen: (sheet) => {
                try { globalThis.UIIdioma?.translatePage?.(sheet); } catch {}
            },
        });
    };

    const openDetalle = async (cardEl) => {
        const dayIdx = Number(cardEl?.getAttribute?.("data-day-idx"));
        const mealIdx = Number(cardEl?.getAttribute?.("data-idx"));
        if (!Number.isFinite(dayIdx) || !Number.isFinite(mealIdx)) return;

        const planRaw = localStorage.getItem("plan_dieta_usuario");
        const dias = parsePlanDiasDetalladosAliment(planRaw);
        if (!Array.isArray(dias) || !dias[dayIdx]) return;

        const diaInfo = dias[dayIdx];
        const comidas = Array.isArray(diaInfo.comidas) ? diaInfo.comidas : [];
        const meal = comidas[mealIdx];
        if (!meal) return;

        const kcal = meal.calorias_aprox != null ? `${Math.round(meal.calorias_aprox)} kcal` : "-";

        const html = `
            <div class="pt-detail">
                <div class="pt-detail-hero">
                    <div class="pt-detail-hero-row" style="margin-bottom:8px;">
                        <div class="pt-detail-hero-title pt-detail-ex">${escapeHtml(meal.nombre)}</div>
                    </div>
                    ${meal.descripcion ? `<div class="pt-detail-hero-sub pt-detail-desc" style="white-space:normal;margin-bottom:12px;">${escapeHtml(meal.descripcion)}</div>` : ""}
                    <div class="plan-meta pt-detail-meta" style="flex-wrap:wrap;gap:8px;margin-bottom:4px;">
                        <span class="plan-chip">${escapeHtml(tLang("Calorías", "Calories"))}: <strong>${escapeHtml(kcal)}</strong></span>
                    </div>
                </div>
            </div>
        `;

        const closeText = tLang("Cerrar", "Close");
        const titleText = "";
        const ariaLabelText = `${tLang("Detalle", "Details")}: ${escapeHtml(meal.nombre)}`;

        const openWithSheet = globalThis.PTBottomSheet && typeof globalThis.PTBottomSheet.open === "function";
        if (!openWithSheet) {
            console.error("PTBottomSheet helper not loaded; cannot open meal plan detail modal.");
            return;
        }

        await globalThis.PTBottomSheet.open({
            title: titleText,
            ariaLabel: ariaLabelText,
            className: "pt-food-detail-sheet",
            html,
            closeText,
            triggerEl: cardEl,
            didOpen: (sheet) => {
                try {
                    globalThis.UIIdioma?.translatePage?.(sheet);
                } catch {
                    // ignore
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
};

const initPlanDiaPagerAliment = (scroller) => {
    if (!scroller) return;

    if (scroller.dataset.diaPagerInit === "1") return;
    scroller.dataset.diaPagerInit = "1";

    // Copiado del patrón del dashboard: calcular por scrollTop + offsetTop,
    // y scrollear SOLO el contenedor (no usar scrollIntoView, que puede mover el body).
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
        const grid = target instanceof Element ? target.closest(".plan-grid") : null;
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
};

const openGenerarPlanAlimentModal = async (ctx, planPrevioRaw = null, triggerEl = null) => {
    const baseObjetivo = localStorage.getItem("dieta_objetivo") || "mantener";
    const baseIntensidad = localStorage.getItem("dieta_intensidad") || "media";

    const sheetTitle = tLang("Generar Plan de Alimentación con IA", "Generate Meal Plan with AI");
    const html = `
        <div class="pt-detail pt-gen">
            <p class="swal-helper">${escapeHtml(tLang(
                "Elegí tu objetivo y la intensidad del plan. Esto define el enfoque y la cantidad de comidas por día.",
                "Choose your goal and the plan intensity. This defines the approach and the number of meals per day."
            ))}</p>

            <section class="swal-section" aria-label="${escapeHtml(tLang("Opciones de plan de alimentación", "Meal plan options"))}">
                <h3>${escapeHtml(tLang("Objetivo", "Goal"))}</h3>
                <div class="swal-grid">
                    <div class="swal-field">
                        <label class="swal-radio"><input type="radio" name="objetivo" value="grasa"><span>${escapeHtml(tLang("Perder grasa", "Lose fat"))}</span></label>
                        <label class="swal-radio"><input type="radio" name="objetivo" value="musculo"><span>${escapeHtml(tLang("Ganar masa muscular", "Gain muscle"))}</span></label>
                        <label class="swal-radio"><input type="radio" name="objetivo" value="mantener"><span>${escapeHtml(tLang("Mantener peso", "Maintain weight"))}</span></label>
                    </div>
                </div>
            </section>

            <section class="swal-section" aria-label="${escapeHtml(tLang("Intensidad de plan de alimentación", "Meal plan intensity"))}">
                <h3>${escapeHtml(tLang("Intensidad", "Intensity"))}</h3>
                <div class="swal-grid">
                    <div class="swal-field">
                        <label class="swal-radio"><input type="radio" name="intensidad" value="baja"><span>${escapeHtml(tLang("Intensidad baja", "Low intensity"))}</span></label>
                        <label class="swal-radio"><input type="radio" name="intensidad" value="media"><span>${escapeHtml(tLang("Intensidad media", "Medium intensity"))}</span></label>
                        <label class="swal-radio"><input type="radio" name="intensidad" value="alta"><span>${escapeHtml(tLang("Intensidad alta", "High intensity"))}</span></label>
                        <p class="swal-helper">${escapeHtml(tLang(
                            "La intensidad ajusta la cantidad de comidas por día (baja: 3, media: 4, alta: 5).",
                            "Intensity adjusts the number of meals per day (low: 3, medium: 4, high: 5)."
                        ))}</p>
                    </div>
                </div>
            </section>

            <div class="pt-form-error" data-pt-alim-error style="display:none;"></div>
        </div>
    `;

    const askConfig = () => {
        if (!canUseBottomSheet()) return null;
        return new Promise((resolve) => {
            let resolved = false;
            const safeResolve = (v) => {
                if (resolved) return;
                resolved = true;
                resolve(v);
            };

            void globalThis.PTBottomSheet.open({
                title: sheetTitle,
                ariaLabel: sheetTitle,
                html,
                closeText: tLang("Cerrar", "Close"),
                showClose: false,
                showHandle: true,
                allowOutsideClose: true,
                allowEscapeClose: true,
                allowDragClose: true,
                triggerEl,
                didOpen: (sheet) => {
                    try {
                        globalThis.UIIdioma?.translatePage?.(sheet);
                    } catch {
                        // ignore
                    }

                    const ptGen = sheet.querySelector(".pt-gen");
                    if (ptGen) {
                        const btn = document.createElement("button");
                        btn.type = "button";
                        btn.className = "btn-primary";
                        btn.style.width = "100%";
                        btn.style.marginTop = "20px";
                        btn.textContent = tLang("Generar", "Generate");
                        btn.addEventListener("click", () => {
                            const objetivo = sheet.querySelector('input[name="objetivo"]:checked')?.value;
                            const intensidad = sheet.querySelector('input[name="intensidad"]:checked')?.value;
                            const errEl = sheet.querySelector("[data-pt-alim-error]");

                            const showErr = (msg) => {
                                if (!errEl) return;
                                errEl.textContent = msg;
                                errEl.style.display = "block";
                            };

                            if (!objetivo) {
                                showErr(tLang("Seleccioná un objetivo", "Select a goal"));
                                return;
                            }
                            if (!intensidad) {
                                showErr(tLang("Seleccioná una intensidad", "Select an intensity"));
                                return;
                            }

                            try {
                                btn.disabled = true;
                            } catch {
                                // ignore
                            }

                            safeResolve({ objetivo, intensidad });
                            closeBottomSheetSafe();
                        });
                        ptGen.appendChild(btn);
                    }

                    const obj = sheet.querySelector(`input[name="objetivo"][value="${CSS.escape(baseObjetivo)}"]`);
                    const inten = sheet.querySelector(`input[name="intensidad"][value="${CSS.escape(baseIntensidad)}"]`);
                    if (obj) obj.checked = true;
                    if (inten) inten.checked = true;
                },
                willClose: () => safeResolve(null),
            });
        });
    };

    const bottomSheetAvailable = canUseBottomSheet();
    let config = bottomSheetAvailable ? ((await askConfig()) || null) : null;
    if (bottomSheetAvailable && !config) {
        // Si el usuario cerró el bottom-sheet, no abrir ningún fallback.
        return;
    }

    if (!bottomSheetAvailable) {
        // Sin bottom-sheet disponible: no usar SweetAlert; abortar el flujo.
        await openStatusSheet({
            title: tLang("No disponible", "Not available"),
            ariaLabel: tLang("No disponible", "Not available"),
            html: `<div class="pt-status"><div class="pt-status-row"><div class="pt-status-text">${escapeHtml(
                tLang(
                    "No se pudo abrir el modal de configuración.",
                    "Could not open the configuration modal."
                )
            )}</div></div></div>`,
            showClose: false,
        });
        return;
    }

    if (!config) return;
    const { objetivo, intensidad } = config;

    // Persistir para regenerar con prefill
    try {
        localStorage.setItem("dieta_objetivo", objetivo);
        localStorage.setItem("dieta_intensidad", intensidad);
    } catch {
        // ignore
    }

    await crearPlanAlimentacion(objetivo, intensidad, ctx);
};

const obtenerPerfilBasico = () => {
    const readFirstNonEmpty = (...keys) => {
        for (const k of keys) {
            const v = localStorage.getItem(k);
            if (v != null && String(v).trim() !== "") return v;
        }
        return null;
    };

    const normalizeStoredNumber = (v) => {
        if (v == null) return null;
        const s = String(v).trim();
        if (!s) return null;
        // Permite valores tipo "75", "75.5", "75,5" o incluso "75 kg"
        const cleaned = s.replaceAll(",", ".").replace(/[^0-9.\-]/g, "");
        return cleaned.trim() || null;
    };

    const altura = normalizeStoredNumber(readFirstNonEmpty("altura_usuario"));
    const edad = normalizeStoredNumber(readFirstNonEmpty("edad_usuario"));
    // Compatibilidad: en el perfil se guarda como "peso_usuario" (no "peso_actual_usuario")
    const pesoActual = normalizeStoredNumber(readFirstNonEmpty("peso_actual_usuario", "peso_usuario"));
    const pesoObjetivo = normalizeStoredNumber(readFirstNonEmpty("peso_objetivo_usuario"));

    // Si existe el peso actual pero falta la key vieja, la rellenamos para consistencia futura
    try {
        if (pesoActual && !localStorage.getItem("peso_actual_usuario") && localStorage.getItem("peso_usuario")) {
            localStorage.setItem("peso_actual_usuario", pesoActual);
        }
    } catch {
        // ignore
    }

    return {
        Altura: altura,
        Peso_actual: pesoActual,
        Peso_objetivo: pesoObjetivo,
        Edad: edad,
    };
};

async function recuperar_planes() {
    const { data, error } = await supabase.auth.getUser();
    if (error) return;
    const user = data?.user;
    if (!user) return;

    const { data: planes, error: err2 } = await supabase
        .from("Planes")
        .select("Plan_alimenta")
        .eq("ID_user", user.id)
        .maybeSingle();

    if (err2) {
        await openStatusSheet({
            title: tLang("Error", "Error"),
            ariaLabel: tLang("Error", "Error"),
            html: `<div class="pt-status"><div class="pt-status-row"><div class="pt-status-text">${escapeHtml(
                (isEnglish() ? "Error fetching your plan: " : "Error al obtener tu plan: ") + err2.message
            )}</div></div></div>`,
            showClose: false,
        });
        return;
    }

    const plan = planes?.Plan_alimenta ?? "Ninguno";
    localStorage.setItem("plan_dieta_usuario", isPlanAlimentacionVacio(plan) ? "Ninguno" : plan);
}

const resolveId = (root, ...ids) => {
    const tryCssEscape = (value) => {
        try {
            return CSS && typeof CSS.escape === "function" ? CSS.escape(value) : value;
        } catch {
            return value;
        }
    };

    for (const id of ids.filter(Boolean)) {
        try {
            if (root && typeof root.querySelector === "function") {
                const el = root.querySelector(`#${tryCssEscape(String(id))}`);
                if (el) return el;
            }
        } catch {
            // ignore
        }
        const globalEl = document.getElementById(String(id));
        if (globalEl) return globalEl;
    }
    return null;
};

const getPlanAlimentacionCtx = (root) => {
    const scope = root && typeof root.querySelector === "function" ? root : document;
    return {
        root: scope,
        boton: resolveId(scope, "boton_alimentacion"),
        botonEliminar: resolveId(scope, "boton_eliminar_alim", "boton_eliminar"),
        botonRegenerar: resolveId(scope, "boton_regenerar_alim", "boton_regenerar"),
        cont: resolveId(scope, "Plan_alimentacion"),
        desc: resolveId(scope, "descripcion_previa_alim", "descripcion_previa"),
    };
};

const verificacion_plan_alimentacion = (ctx) => {
    const planRaw = localStorage.getItem("plan_dieta_usuario");
    const boton = ctx?.boton;
    const botonEliminar = ctx?.botonEliminar;
    const botonRegenerar = ctx?.botonRegenerar;
    const cont = ctx?.cont;
    const desc = ctx?.desc;
    const planActionsPill = ctx?.root?.querySelector?.(".plan-actions-pill") || null;

    const hasPlan = !isPlanAlimentacionVacio(planRaw);

    if (hasPlan) {
        planActionsPill?.classList.add("is-pill");
        if (desc) desc.style.display = "none";
        boton?.classList.remove("btn-primary");
        if (boton) {
            boton.removeAttribute("data-i18n-en");
            delete boton.dataset.i18nEs;
        }
        if (botonRegenerar) botonRegenerar.style.display = "inline-block";
        if (botonEliminar) botonEliminar.style.display = "inline-block";

        if (boton) {
            boton.innerHTML = '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0ibHVjaWRlIGx1Y2lkZS1yb3RhdGUtY3ctaWNvbiBsdWNpZGUtcm90YXRlLWN3Ij48cGF0aCBkPSJNMjEgMTJhOSA5IDAgMSAxLTktOWMyLjUyIDAgNC45MyAxIDYuNzQgMi43NEwyMSA4Ii8+PHBhdGggZD0iTTIxIDN2NWgtNSIvPjwvc3ZnPg==">';
            boton.classList.add("btn-icon-sm");
            boton.style.width = "";
            boton.style.height = "";
            boton.setAttribute("aria-label", "Refrescar plan de alimentación");
            boton.setAttribute("data-i18n-en-aria-label", "Refresh meal plan");
            try { globalThis.UIIdioma?.translatePage?.(boton); } catch { }
            boton.onclick = async () => {
                await recuperar_planes();
                await openStatusSheet({
                    title: tLang("Plan de alimentación actualizado", "Meal plan updated"),
                    ariaLabel: tLang("Plan de alimentación actualizado", "Meal plan updated"),
                    html: `<div class="pt-status"><div class="pt-status-row"><div class="pt-status-text">${escapeHtml(
                        tLang(
                            "Tu plan de alimentación ha sido refrescado correctamente.",
                            "Your meal plan has been refreshed successfully."
                        )
                    )}</div></div><div class="pt-status-actions"><button type="button" class="btn-primary" data-pt-sheet-close>${escapeHtml(
                        tLang("Listo", "Done")
                    )}</button></div></div>`,
                    showClose: false,
                    didOpen: (sheet) => {
                        sheet.querySelector("[data-pt-sheet-close]")?.addEventListener("click", () => closeModalSafe());
                        try {
                            globalThis.UIIdioma?.translatePage?.(sheet);
                        } catch {
                            // ignore
                        }
                    },
                });
            };
        }
    } else {
        planActionsPill?.classList.remove("is-pill");
        if (desc) desc.style.display = "block";
        if (botonEliminar) botonEliminar.style.display = "none";
        if (botonRegenerar) botonRegenerar.style.display = "none";

        if (boton) {
            boton?.classList.add("btn-primary");
            boton?.classList.remove("btn-icon-sm");
            boton.textContent = "Generar plan";
            boton.setAttribute("data-i18n-en", "Generate plan");
            boton.setAttribute("aria-label", "Generar plan de alimentación");
            boton.setAttribute("data-i18n-en-aria-label", "Generate meal plan");
            try { globalThis.UIIdioma?.translatePage?.(boton); } catch { }
            boton.style.width = "auto";
            boton.style.height = "auto";
            boton.onclick = async () => {
                await openGenerarPlanAlimentModal(ctx, null, boton);
            };
        }
    }

    if (cont) {
        if (hasPlan) {
            cont.innerHTML = mapear_plan_alimentacion(planRaw);
            try { globalThis.UIIdioma?.translatePage?.(cont); } catch { }
            cont.style.display = "block";
            initDetallePorDiaPlanAliment(cont);
            initPlanDiaPagerAliment(cont);
        } else {
            cont.innerHTML = "";
            cont.style.display = "none";
        }
    }
};

async function crearPlanAlimentacion(objetivo, intensidad, ctx) {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
        await openStatusSheet({
            title: tLang("Sesión requerida", "Session required"),
            ariaLabel: tLang("Sesión requerida", "Session required"),
            html: `<div class="pt-status"><div class="pt-status-row"><div class="pt-status-text">${escapeHtml(tLang(
                "Tenés que iniciar sesión para generar tu plan.",
                "You must be logged in to generate your plan."
            ))}</div></div></div>`,
            showClose: false,
        });
        return;
    }
    const user = data.user;

    const perfil = obtenerPerfilBasico();
    if (!perfil.Altura || !perfil.Peso_actual || !perfil.Peso_objetivo || !perfil.Edad) {
        await openStatusSheet({
            title: tLang("Perfil incompleto", "Incomplete profile"),
            ariaLabel: tLang("Perfil incompleto", "Incomplete profile"),
            html: `<div class="pt-status"><div class="pt-status-row"><div class="pt-status-text">${escapeHtml(tLang(
                "Completá tu perfil (edad, altura, peso actual y objetivo) para generar el plan.",
                "Complete your profile (age, height, current weight, and goal) to generate the plan."
            ))}</div></div></div>`,
            showClose: false,
        });
        return;
    }

    const stopLoading = showBlockingLoading({
        title: tLang("Generando Plan", "Generating plan"),
        text: isEnglish()
            ? `Goal: ${objetivo} | Intensity: ${intensidad}. Please wait...`
            : `Objetivo: ${objetivo} | Intensidad: ${intensidad}. Por favor, esperá...`,
    });

    let planAlimentaObj;
    try {
        planAlimentaObj = await callEdgeFunctionJson("/gen_plan_alimenta", {
            idioma: isEnglish() ? "en" : "es",
            objetivo,
            intensidad,
            ...perfil,
        });
    } catch (err) {
        stopLoading();
        await openStatusSheet({
            title: tLang("Error", "Error"),
            ariaLabel: tLang("Error", "Error"),
            html: `<div class="pt-status"><div class="pt-status-row"><div class="pt-status-text">${escapeHtml(
                (isEnglish() ? "Could not generate the plan with AI: " : "No se pudo generar el plan con IA: ") +
                (err?.message || String(err))
            )}</div></div></div>`,
            showClose: false,
        });
        return;
    }

    const planAlimentaToStore = JSON.stringify(planAlimentaObj);

    let response;
    let bodyText = "";
    try {
        response = await fetch("/generar_plan_alimentacion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id_usuario: user.id,
                idioma: isEnglish() ? "en" : "es",
                plan_alimenta: planAlimentaToStore,
            }),
        });
        bodyText = await response.text();
    } catch (err) {
        stopLoading();
        await openStatusSheet({
            title: tLang("Error", "Error"),
            ariaLabel: tLang("Error", "Error"),
            html: `<div class="pt-status"><div class="pt-status-row"><div class="pt-status-text">${escapeHtml(
                (isEnglish() ? "Could not contact the server: " : "No se pudo contactar al servidor: ") + (err?.message || String(err))
            )}</div></div></div>`,
            showClose: false,
        });
        return;
    }

    if (!response.ok) {
        stopLoading();
        if (isNetlifyEdgeUncaughtInvocation(bodyText)) {
            await showNetlifyHostingErrorAlert({
                endpoint: "/generar_plan_alimentacion",
                status: response.status,
                statusText: response.statusText,
                bodyText,
            });
            return;
        }

        let msg = bodyText;
        try {
            const parsed = JSON.parse(bodyText);
            msg = parsed?.error || parsed?.message || msg;
        } catch {
            // ignore
        }

        await openStatusSheet({
            title: tLang("Error", "Error"),
            ariaLabel: tLang("Error", "Error"),
            html: `<div class="pt-status"><div class="pt-status-row"><div class="pt-status-text">${escapeHtml(
                (isEnglish() ? "Could not generate the plan: " : "No se pudo generar el plan: ") + String(msg).slice(0, 240)
            )}</div></div></div>`,
            showClose: false,
        });
        return;
    }

    let dataJson;
    try {
        dataJson = JSON.parse(bodyText);
    } catch {
        dataJson = null;
    }

    const plan = dataJson?.plan_alimenta;
    if (!plan) {
        stopLoading();
        await openStatusSheet({
            title: tLang("Error", "Error"),
            ariaLabel: tLang("Error", "Error"),
            html: `<div class="pt-status"><div class="pt-status-row"><div class="pt-status-text">${escapeHtml(
                tLang("El servidor respondió sin plan.", "The server responded without a plan.")
            )}</div></div></div>`,
            showClose: false,
        });
        return;
    }

    stopLoading();

    localStorage.setItem("plan_dieta_usuario", plan);
    await recuperar_planes();
    verificacion_plan_alimentacion(ctx ?? getPlanAlimentacionCtx(document.getElementById("Alimentacion") || document));

    await openStatusSheet({
        title: tLang("¡Plan Generado!", "Plan generated!"),
        ariaLabel: tLang("¡Plan Generado!", "Plan generated!"),
        html: `<div class="pt-status"><div class="pt-status-row"><div class="pt-status-text">${escapeHtml(
            tLang("Tu plan de alimentación se creó correctamente.", "Your meal plan was created successfully.")
        )}</div></div><div class="pt-status-actions"><button type="button" class="btn-primary" data-pt-sheet-close>${escapeHtml(
            tLang("Listo", "Done")
        )}</button></div></div>`,
        showClose: false,
        showHandle: true,
        didOpen: (sheet) => {
            sheet.querySelector("[data-pt-sheet-close]")?.addEventListener("click", () => closeModalSafe());
            try {
                globalThis.UIIdioma?.translatePage?.(sheet);
            } catch {
                // ignore
            }
        },
    });
}

async function actualizar_cambios_plan_alimentacion(planValue) {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) throw new Error(tLang("Sesión inválida", "Invalid session"));
    const user = data.user;

    const payload = JSON.stringify({ id_usuario: user.id, plan_alimenta: planValue });

    // Igual que en dashboard: no seteamos Content-Type para evitar preflight CORS en algunos contextos.
    const tryRequest = async (url) => {
        let res;
        try {
            res = await fetch(url, { method: "POST", body: payload });
        } catch (e) {
            throw new Error(
                isEnglish()
                    ? `Network error while updating the plan: ${e?.message || String(e)}`
                    : `Error de red al actualizar el plan: ${e?.message || String(e)}`
            );
        }
        const txt = await res.text();
        return { res, txt };
    };

    // 1) Ruta mapeada por netlify.toml
    let { res, txt } = await tryRequest("/actualizar_cambios_plan_alimentacion");

    // 2) Fallback: ruta directa a Edge Function (útil si el mapping no está disponible)
    if (!res.ok && (res.status === 404 || res.status === 405)) {
        ({ res, txt } = await tryRequest("/.netlify/edge-functions/actualizar_cambios_plan_aliment"));
    }

    if (!res.ok) {
        if (isNetlifyEdgeUncaughtInvocation(txt)) {
            await showNetlifyHostingErrorAlert({
                endpoint:
                    res.url?.includes("/.netlify/edge-functions/")
                        ? "/.netlify/edge-functions/actualizar_cambios_plan_aliment"
                        : "/actualizar_cambios_plan_alimentacion",
                status: res.status,
                statusText: res.statusText,
                bodyText: txt,
            });
            throw new Error(tLang("Error del servidor de hosting", "Hosting server error"));
        }

        let msg = txt;
        try {
            const j = JSON.parse(txt);
            msg = j?.message || j?.error || msg;
        } catch {
            // ignore
        }
        throw new Error(String(msg).slice(0, 240));
    }
}

const bindUiHandlers = (ctx) => {
    const root = ctx?.root;
    if (root && root.dataset && root.dataset.planAlimentHandlersInit === "1") return;
    if (root && root.dataset) root.dataset.planAlimentHandlersInit = "1";

    ctx?.botonEliminar?.addEventListener("click", async () => {
        const ok = await openConfirmSheet({
            title: tLang("¿Estás seguro?", "Are you sure?"),
            message: tLang("Esta acción eliminará tu plan de alimentación actual.", "This action will delete your current meal plan."),
            confirmText: tLang("Sí, eliminar", "Yes, delete"),
        });
        if (!ok) return;

        try {
            localStorage.setItem("plan_dieta_usuario", "Ninguno");
            await actualizar_cambios_plan_alimentacion("Ninguno");
            verificacion_plan_alimentacion(ctx);
            await openStatusSheet({
                title: tLang("Plan eliminado", "Plan deleted"),
                ariaLabel: tLang("Plan eliminado", "Plan deleted"),
                html: `<div class="pt-status"><div class="pt-status-row"><div class="pt-status-text">${escapeHtml(
                    tLang("Tu plan de alimentación ha sido eliminado.", "Your meal plan has been deleted.")
                )}</div></div><div class="pt-status-actions"><button type="button" class="btn-primary" data-pt-sheet-close>${escapeHtml(
                    tLang("Listo", "Done")
                )}</button></div></div>`,
                showClose: false,
                didOpen: (sheet) => {
                    sheet.querySelector("[data-pt-sheet-close]")?.addEventListener("click", () => closeModalSafe());
                },
            });
        } catch (e) {
            await openStatusSheet({
                title: tLang("Error", "Error"),
                ariaLabel: tLang("Error", "Error"),
                html: `<div class="pt-status"><div class="pt-status-row"><div class="pt-status-text">${escapeHtml(
                    (isEnglish() ? "Could not delete: " : "No se pudo eliminar: ") + (e?.message || String(e))
                )}</div></div></div>`,
                showClose: false,
            });
        }
    });

    ctx?.botonRegenerar?.addEventListener("click", async () => {
        const ok = await openConfirmSheet({
            title: tLang("Regenerar plan de alimentación", "Regenerate meal plan"),
            message: tLang(
                "Se eliminará el plan actual y se generará uno nuevo basado en tu configuración previa.",
                "The current plan will be deleted and a new one will be generated based on your previous settings."
            ),
            confirmText: tLang("Sí, regenerar", "Yes, regenerate"),
            triggerEl: ctx?.botonRegenerar,
        });
        if (!ok) return;

        try {
            localStorage.setItem("plan_dieta_usuario", "Ninguno");
            await actualizar_cambios_plan_alimentacion("Ninguno");
            verificacion_plan_alimentacion(ctx);
            await openGenerarPlanAlimentModal(ctx, null, ctx?.botonRegenerar);
        } catch (e) {
            await openStatusSheet({
                title: tLang("Error", "Error"),
                ariaLabel: tLang("Error", "Error"),
                html: `<div class="pt-status"><div class="pt-status-row"><div class="pt-status-text">${escapeHtml(
                    (isEnglish() ? "Could not regenerate: " : "No se pudo regenerar: ") + (e?.message || String(e))
                )}</div></div></div>`,
                showClose: false,
            });
        }
    });
};

const domReady = () =>
    new Promise((resolve) => {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
        } else {
            resolve();
        }
    });

export const initPlanAlimentacion = async ({ root = null, skipRecuperarPlanes = false, autofocus = false } = {}) => {
    await domReady();

    try {
        const key = "ptFixedChromeObserversInit";
        if (document.documentElement?.dataset?.[key] !== "1") {
            document.documentElement.dataset[key] = "1";
            initFixedChromeObservers();
        }
    } catch {
        initFixedChromeObservers();
    }

    const rootEl = root || document.getElementById("Alimentacion") || document;
    const ctx = getPlanAlimentacionCtx(rootEl);
    bindUiHandlers(ctx);

    if (!skipRecuperarPlanes) {
        await recuperar_planes();
    }

    verificacion_plan_alimentacion(ctx);

    if (autofocus) {
        autofocusPlanAlimentacionOncePerSession(ctx.cont);
    }

    return ctx;
};

// Auto-init solo en la página dedicada (evita colisionar con Dashboard)
try {
    if (document.body?.dataset?.ptPage === "alimentacion") {
        void initPlanAlimentacion({ autofocus: true });
    }
} catch {
    // ignore
}
