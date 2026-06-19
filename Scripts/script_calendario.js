import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.94.1/+esm";
const supabaseUrl = "https://lhecmoeilmhzgxpcetto.supabase.co";
const supabaseKey = "sb_publishable_oLC8LcDLa3jR72Hpd_jJsA_eXjMlP3-";
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: false, storage: localStorage } });

const username = localStorage.getItem("username_usuario");
const avatar = localStorage.getItem("avatar_usuario");

const getColorWithOpacity = (varName, alpha = 1, defaultHex = '#ff073a') => {
    try {
        const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || defaultHex;
        const hex = val.replace(/^#/, '');
        if (hex.length === 6) {
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            if (Number.isInteger(r) && Number.isInteger(g) && Number.isInteger(b)) {
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            }
        }
    } catch (e) {
        // ignore
    }
    return `rgba(255, 7, 58, ${alpha})`;
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

const escapeHtml = (value) => {
    const text = String(value ?? "");
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
};

const canUseBottomSheet = () => !!globalThis.PTBottomSheet && typeof globalThis.PTBottomSheet.open === "function";

const openConfirmSheet = async ({
    title,
    message,
    okText,
    cancelText,
    triggerEl = null,
}) => {
    const safeTitle = title || tLang("Confirmar", "Confirm");
    const safeMessage = message || "";
    const safeOkText = okText || tLang("Confirmar", "Confirm");
    const safeCancelText = cancelText || tLang("Cancelar", "Cancel");

    if (!canUseBottomSheet()) {
        return confirm(`${safeTitle}\n\n${safeMessage}`);
    }

    return new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            resolve(Boolean(value));
        };

        void globalThis.PTBottomSheet.open({
            title: safeTitle,
            subtitle: "",
            ariaLabel: safeTitle,
            triggerEl,
            showClose: false,
            showHandle: true,
            showBack: false,
            allowOutsideClose: true,
            allowEscapeClose: true,
            allowDragClose: true,
            html: `
                <div class="pt-status">
                    <div class="pt-status-row" style="align-items:flex-start;">
                        <div class="pt-status-text">${escapeHtml(safeMessage)}</div>
                    </div>
                    <div class="pt-status-actions" style="margin-top:14px; display:flex; gap:8px; justify-content:flex-end;">
                        <button type="button" class="btn-secondary" data-pt-cancel>${escapeHtml(safeCancelText)}</button>
                        <button type="button" class="btn-primary" data-pt-confirm>${escapeHtml(safeOkText)}</button>
                    </div>
                </div>
            `,
            didOpen: (sheet) => {
                try { globalThis.UIIdioma?.translatePage?.(sheet); } catch { }
                const btnCancel = sheet.querySelector("[data-pt-cancel]");
                const btnConfirm = sheet.querySelector("[data-pt-confirm]");

                btnCancel?.addEventListener("click", () => {
                    finish(false);
                    try { globalThis.PTBottomSheet?.close?.(); } catch { }
                });

                btnConfirm?.addEventListener("click", () => {
                    finish(true);
                    try { globalThis.PTBottomSheet?.close?.(); } catch { }
                });
            },
            willClose: () => {
                if (!settled) finish(false);
            },
        });
    });
};

const normalizarDiasEntrenados = (value) => {
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

const leerRegistrosLocales = () => {
    try {
        return normalizarDiasEntrenados(localStorage.getItem("Dias_cale"));
    } catch {
        return [];
    }
};

const obtenerRegistrosEntreno = async () => {
    const fromLocal = leerRegistrosLocales();
    try {
        const { data, error } = await supabase
            .from("Planes")
            .select("Dias_entrenados")
            .eq("ID_user", localStorage.getItem("id_usuario"))
            .limit(1)
            .single();

        if (error) throw new Error(error.message);

        const fromDb = normalizarDiasEntrenados(data?.Dias_entrenados);
        return fromDb.length ? fromDb : fromLocal;
    } catch (err) {
        console.error("Error al recuperar el registro de entreno:", err);
        return fromLocal;
    }
};

const guardarRegistrosEntreno = async (registros) => {
    const res = await fetch("/guardar_registro_entreno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            id_usuario: localStorage.getItem("id_usuario"),
            registro_entreno: registros,
        }),
    });
    return res;
};

const getRegistroId = (registro, index) => {
    const start = String(registro?.start ?? registro?.fecha ?? "sin-fecha").trim();
    return String(registro?.id_registro ?? registro?.id ?? `${start}-${index}`);
};

const formatearFechaLarga = (fechaIso) => {
    const date = new Date(`${fechaIso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return fechaIso;
    return new Intl.DateTimeFormat(getIdiomaPreferido(), {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    }).format(date);
};

const getGreetingByHour = (hour) => {
    const h = Number.isFinite(Number(hour)) ? Number(hour) : new Date().getHours();
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
    const setTo = (hour) => {
        next.setHours(hour, 0, 5, 0);
    };

    if (h < 5) setTo(5);
    else if (h < 12) setTo(12);
    else if (h < 20) setTo(20);
    else {
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
    window.setTimeout(function tick() {
        sync();
        window.setTimeout(tick, getNextGreetingChangeDelayMs());
    }, getNextGreetingChangeDelayMs());
};

const buildRegistroMeta = (registro, index) => {
    const start = String(registro?.start ?? registro?.fecha ?? "").trim();
    const title = String(registro?.title ?? registro?.titulo_entreno ?? registro?.dia ?? registro?.descripcion ?? `Entreno ${index + 1}`).trim();
    const extendedProps = registro?.extendedProps && typeof registro.extendedProps === "object" ? registro.extendedProps : {};
    return {
        id: getRegistroId(registro, index),
        title,
        start,
        allDay: true,
        extendedProps: {
            status: extendedProps.status ?? registro?.status ?? "completado",
            calories_burnt: extendedProps.calories_burnt ?? registro?.calorias_quemadas ?? registro?.caloriasQuemadas ?? null,
            tiempo_total_min: extendedProps.tiempo_total_min ?? registro?.tiempo_total_min ?? registro?.tiempoTotalMin ?? null,
            hora_confirmacion: extendedProps.hora_confirmacion ?? registro?.hora_confirmacion ?? null,
            confirmado_en: extendedProps.confirmado_en ?? registro?.confirmado_en ?? null,
            descripcion: extendedProps.descripcion ?? registro?.descripcion ?? "",
        },
    };
};

const renderDetalleEntreno = async (fechaIso, registrosDelDia, onDeleteRegistro, getRegistrosByFecha, triggerEl = null) => {
    const fechaLarga = formatearFechaLarga(fechaIso);
    const itemsHtml = registrosDelDia.length
        ? registrosDelDia.map((registro, index) => {
            const props = registro.extendedProps || {};
            const titulo = escapeHtml(registro.title || `Entreno ${index + 1}`);
            const calorias = props.calories_burnt ?? "-";
            const tiempo = props.tiempo_total_min ?? "-";
            const hora = props.hora_confirmacion ?? "-";
            const status = props.status ?? "completado";
            const descripcion = props.descripcion
                ? `<div class="pt-cal-registro-desc">${escapeHtml(props.descripcion)}</div>`
                : "";
            return `
                <div class="pt-status-row pt-cal-registro-row">
                    <div class="pt-status-text pt-cal-registro-card">
                        <div class="pt-cal-registro-title">${titulo}</div>
                        <div class="pt-cal-registro-meta">
                            <div><span class="pt-cal-k">${escapeHtml(tLang("Estado", "Status"))}</span><span class="pt-cal-v">${escapeHtml(status)}</span></div>
                            <div><span class="pt-cal-k">${escapeHtml(tLang("Calorías", "Calories"))}</span><span class="pt-cal-v">${escapeHtml(calorias)}</span></div>
                            <div><span class="pt-cal-k">${escapeHtml(tLang("Tiempo", "Time"))}</span><span class="pt-cal-v">${escapeHtml(tiempo)} min</span></div>
                            <div><span class="pt-cal-k">${escapeHtml(tLang("Hora", "Time"))}</span><span class="pt-cal-v">${escapeHtml(hora)}</span></div>
                        </div>
                        ${descripcion}
                        <div class="pt-cal-registro-actions">
                            <button
                                type="button"
                                data-limpiar-registro
                                data-reg-id="${escapeHtml(registro.id)}"
                                class="pt-cal-clear-btn"
                            >
                                ${escapeHtml(tLang("Limpiar registro", "Clear record"))}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join("")
        : `<div class="pt-status-row"><div class="pt-status-text">${escapeHtml(tLang("No hay entrenos registrados para este día.", "No workouts recorded for this day."))}</div></div>`;

    const html = `
        <div class="pt-status pt-cal-detalle-sheet">
            <div class="pt-status-row pt-cal-header-row">
                <div class="pt-status-text pt-cal-header-text">
                    <strong class="pt-cal-header-title">${escapeHtml(fechaLarga)}</strong>
                    <div class="pt-cal-header-sub">${escapeHtml(fechaIso)}</div>
                </div>
            </div>
            ${itemsHtml}
        </div>
    `;

    if (!canUseBottomSheet()) {
        alert(`${fechaLarga}\n\n${registrosDelDia.map((r) => `${r.title || "Entreno"} - ${r.extendedProps?.calories_burnt ?? "-"} kcal`).join("\n")}`);
        return;
    }

    await globalThis.PTBottomSheet.open({
        title: tLang("Detalle del día", "Day detail"),
        subtitle: fechaLarga,
        ariaLabel: tLang("Detalle del día", "Day detail"),
        className: "pt-calendar-day-detail-sheet",
        html,
        showClose: false,
        showHandle: true,
        allowOutsideClose: true,
        allowEscapeClose: true,
        allowDragClose: true,
        triggerEl,
        didOpen: (sheet) => {
            try { globalThis.UIIdioma?.translatePage?.(sheet); } catch { }

            const botonesLimpiar = Array.from(sheet.querySelectorAll("[data-limpiar-registro]"));
            botonesLimpiar.forEach((btn) => {
                btn.addEventListener("click", async () => {
                    const regId = String(btn.getAttribute("data-reg-id") ?? "").trim();
                    if (!regId) return;

                    const ok = await openConfirmSheet({
                        title: tLang("Confirmar eliminación", "Confirm deletion"),
                        message: tLang("¿Eliminar este registro de entreno?", "Delete this workout record?"),
                        okText: tLang("Eliminar", "Delete"),
                        cancelText: tLang("Cancelar", "Cancel"),
                        triggerEl: btn,
                    });
                    if (!ok) return;

                    const deleted = await onDeleteRegistro(regId);
                    if (!deleted) return;

                    try { globalThis.PTBottomSheet?.close?.(); } catch { }

                    const nuevosRegistrosDia = getRegistrosByFecha(fechaIso);
                    await renderDetalleEntreno(fechaIso, nuevosRegistrosDia, onDeleteRegistro, getRegistrosByFecha, triggerEl);
                });
            });
        },
    });
};

async function initCalendario() {
    const calendarEl = document.getElementById("calendario");
    if (!calendarEl) return;

    let registros = await obtenerRegistrosEntreno();
    let eventos = [];
    let recordsByDate = new Map();
    let lastStats = null;

    const rebuildCalendarData = () => {
        eventos = registros
            .map(buildRegistroMeta)
            .filter((event) => !!event.start);

        recordsByDate = eventos.reduce((acc, event) => {
            if (!acc.has(event.start)) acc.set(event.start, []);
            acc.get(event.start).push(event);
            return acc;
        }, new Map());
    };

    const safeNum = (v) => {
        const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
        return Number.isFinite(n) ? n : 0;
    };

    const computeStatsFromEventos = (allEventos, targetDate = null) => {
        const now = targetDate || new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth(); // 0-based

        const eventosThisMonth = allEventos.filter((e) => {
            try {
                const d = new Date(`${e.start}T00:00:00`);
                return d.getFullYear() === curYear && d.getMonth() === curMonth;
            } catch {
                return false;
            }
        });

        const aggByDate = new Map();
        const allDatesSet = new Set();
        allEventos.forEach((ev) => {
            const date = ev.start;
            if (!date) return;
            allDatesSet.add(date);
            const calories = safeNum(ev.extendedProps?.calories_burnt);
            const minutes = safeNum(ev.extendedProps?.tiempo_total_min);
            const prev = aggByDate.get(date) || { calories: 0, minutes: 0 };
            prev.calories += calories;
            prev.minutes += minutes;
            aggByDate.set(date, prev);
        });

        // Month aggregates
        let totalCalories = 0;
        let totalMinutes = 0;
        const daysTrainedSet = new Set();
        eventosThisMonth.forEach((ev) => {
            const date = ev.start;
            const c = safeNum(ev.extendedProps?.calories_burnt);
            const m = safeNum(ev.extendedProps?.tiempo_total_min);
            totalCalories += c;
            totalMinutes += m;
            if (date) daysTrainedSet.add(date);
        });

        const daysTrained = daysTrainedSet.size;
        const avgDailyMinutes = daysTrained ? Math.round(totalMinutes / daysTrained) : 0;
        const avgDailyCalories = daysTrained ? Math.round(totalCalories / daysTrained) : 0;

        // Best day (by calories, tiebreaker minutes)
        let bestDay = null;
        let bestCalories = -1;
        let bestMinutes = -1;
        aggByDate.forEach((vals, date) => {
            if (!date) return;
            // only consider dates in current month
            const d = new Date(`${date}T00:00:00`);
            if (d.getFullYear() !== curYear || d.getMonth() !== curMonth) return;
            if (vals.calories > bestCalories || (vals.calories === bestCalories && vals.minutes > bestMinutes)) {
                bestCalories = vals.calories;
                bestMinutes = vals.minutes;
                bestDay = { date, calories: vals.calories, minutes: vals.minutes };
            }
        });

        // Streak calculations (using all recorded dates)
        const allDates = Array.from(allDatesSet).sort();
        const dateSet = new Set(allDates);
        const dayIsoToTs = (iso) => new Date(`${iso}T00:00:00`).getTime();

        // longest streak
        let longestStreak = 0;
        let currentStreak = 0;
        let prevTs = null;
        const sortedAllDates = Array.from(dateSet).map((d) => new Date(`${d}T00:00:00`)).sort((a,b)=>a-b);
        sortedAllDates.forEach((d, idx) => {
            if (idx === 0) { currentStreak = 1; prevTs = d.getTime(); longestStreak = 1; return; }
            const diffDays = Math.round((d.getTime() - prevTs) / (1000*60*60*24));
            if (diffDays === 1) currentStreak += 1;
            else currentStreak = 1;
            prevTs = d.getTime();
            if (currentStreak > longestStreak) longestStreak = currentStreak;
        });

        // current streak up to today
        let streakCurrent = 0;
        for (let i = 0; ; i++) {
            const check = new Date();
            check.setDate(check.getDate() - i);
            const iso = check.toISOString().slice(0,10);
            if (dateSet.has(iso)) streakCurrent += 1;
            else break;
        }

        const efficiency = totalMinutes ? +(totalCalories / totalMinutes).toFixed(2) : 0;

        // Consistency
        const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
        const pctActive = daysInMonth ? +(daysTrained / daysInMonth * 100).toFixed(1) : 0;
        const daysRest = daysInMonth - daysTrained;

        // Distribution by weekday for current month
        const weekdayCounts = {};
        eventosThisMonth.forEach((ev) => {
            const d = new Date(`${ev.start}T00:00:00`);
            const wd = d.toLocaleDateString(getIdiomaPreferido(), { weekday: 'long' });
            weekdayCounts[wd] = (weekdayCounts[wd] || 0) + 1;
        });

        // Monthly variation (compare previous month)
        const prevMonthDate = new Date(curYear, curMonth - 1, 1);
        const prevYear = prevMonthDate.getFullYear();
        const prevMonth = prevMonthDate.getMonth();
        let prevTotalCalories = 0;
        allEventos.forEach((ev) => {
            const d = new Date(`${ev.start}T00:00:00`);
            if (d.getFullYear() === prevYear && d.getMonth() === prevMonth) {
                prevTotalCalories += safeNum(ev.extendedProps?.calories_burnt);
            }
        });
        const variationAbsolute = totalCalories - prevTotalCalories;
        const variationPct = prevTotalCalories ? +((variationAbsolute / prevTotalCalories) * 100).toFixed(1) : null;

        // Weekly trend inside month (simple week index by day of month)
        const weeks = {};
        eventosThisMonth.forEach((ev) => {
            const d = new Date(`${ev.start}T00:00:00`);
            const weekIndex = Math.ceil(d.getDate() / 7);
            weeks[weekIndex] = weeks[weekIndex] || { calories: 0, minutes: 0 };
            weeks[weekIndex].calories += safeNum(ev.extendedProps?.calories_burnt);
            weeks[weekIndex].minutes += safeNum(ev.extendedProps?.tiempo_total_min);
        });

        // Projection
        const projectedCalories = daysTrained ? Math.round((totalCalories / daysTrained) * daysInMonth) : 0;

        return {
            totalCalories,
            totalMinutes,
            avgDailyMinutes,
            avgDailyCalories,
            daysTrained,
            bestDay,
            longestStreak,
            streakCurrent,
            efficiency,
            pctActive,
            daysRest,
            weekdayCounts,
            variationAbsolute,
            variationPct,
            weeks,
            projectedCalories,
            daysInMonth,
            aggByDate,
            curYear,
            curMonth,
        };
    };

    const formatNumber = (v) => (typeof v === 'number' ? v.toLocaleString(getIdiomaPreferido()) : v);

    const renderEstadisticas = (stats) => {
        lastStats = stats;
        try {
            const container = document.getElementById('pt-stats-grid');
            const section = document.getElementById('estadisticas');
            const emptyOverlay = document.getElementById('pt-stats-empty');
            if (section) section.style.display = 'block';
            if (!container) return;

            const noData = !stats || (stats.totalCalories === 0 && stats.totalMinutes === 0 && stats.daysTrained === 0);

            // ── Empty state ──
            if (emptyOverlay) emptyOverlay.style.display = noData ? 'flex' : 'none';

            // ── Charts ──
            renderCharts(stats);
            initChartSwipeDots();

            // ── Stat cards (existing logic) ──
            const items = [];
            const weeklyEntries = Object.entries(stats.weeks || {})
                .map(([k, v]) => [Number(k), v])
                .filter(([k]) => Number.isFinite(k))
                .sort((a, b) => a[0] - b[0]);
            const firstWeek = weeklyEntries[0]?.[1] || null;
            const lastWeek = weeklyEntries[weeklyEntries.length - 1]?.[1] || null;
            const weeklyTrendLabel = (() => {
                if (!firstWeek || !lastWeek) return tLang('Sin datos', 'No data');
                const diff = (lastWeek.calories || 0) - (firstWeek.calories || 0);
                if (diff === 0) return tLang('Estable', 'Stable');
                return diff > 0 ? `+${formatNumber(diff)} kcal` : `${formatNumber(diff)} kcal`;
            })();

            items.push({ type: 'group', v: tLang('Resumen Mensual', 'Monthly Summary') });
            items.push({ k: tLang('Total minutos (mes)', 'Total minutes (month)'), v: `${formatNumber(stats.totalMinutes)} min`, tone: 'primary' });
            items.push({ k: tLang('Total calorías (mes)', 'Total calories (month)'), v: `${formatNumber(stats.totalCalories)} kcal`, tone: 'primary' });
            items.push({ k: tLang('Promedio diario minutos', 'Avg daily minutes'), v: `${formatNumber(stats.avgDailyMinutes)} min`, tone: 'primary' });
            items.push({ k: tLang('Promedio diario calorías', 'Avg daily calories'), v: `${formatNumber(stats.avgDailyCalories)} kcal`, tone: 'primary' });
            items.push({ k: tLang('Días entrenados (mes)', 'Days trained (month)'), v: `${formatNumber(stats.daysTrained)}`, tone: 'primary' });

            const bestLabel = stats.bestDay ? `${stats.bestDay.date} — ${stats.bestDay.calories} kcal / ${stats.bestDay.minutes} min` : tLang('N/A', 'N/A');
            items.push({ type: 'group', v: tLang('Rendimiento', 'Performance') });
            items.push({ k: tLang('Mejor día (mes)', 'Best day (month)'), v: bestLabel, tone: 'performance' });
            items.push({ k: tLang('Racha más larga', 'Longest streak'), v: `${formatNumber(stats.longestStreak)} ${tLang('días','days')}`, tone: 'performance' });
            items.push({ k: tLang('Racha actual', 'Current streak'), v: `${formatNumber(stats.streakCurrent)} ${tLang('días','days')}`, tone: 'performance' });
            items.push({ k: tLang('Eficiencia calórica', 'Caloric efficiency'), v: `${stats.efficiency} ${tLang('kcal/min','kcal/min')}`, tone: 'performance' });

            items.push({ type: 'group', v: tLang('Consistencia', 'Consistency') });
            items.push({ k: tLang('% días activos', '% active days'), v: `${stats.pctActive}%`, tone: 'consistency' });
            items.push({ k: tLang('Días de descanso', 'Rest days'), v: `${formatNumber(stats.daysRest)}`, tone: 'consistency' });

            const weekdayEntries = Object.entries(stats.weekdayCounts || {}).sort((a, b) => b[1] - a[1]);
            const distLabel = weekdayEntries.length ? weekdayEntries.map(([k,v])=>`${k}: ${v}`).slice(0,5).join(' · ') : tLang('Sin datos', 'No data');
            items.push({ k: tLang('Distribución por día', 'Distribution by weekday'), v: distLabel, tone: 'consistency' });

            const varPct = stats.variationPct === null ? tLang('N/A', 'N/A') : `${stats.variationPct}%`;
            items.push({ type: 'group', v: tLang('Progreso y Proyección', 'Progress and Projection') });
            items.push({ k: tLang('Variación mensual (cal)', 'Monthly variation (cal)'), v: `${formatNumber(stats.variationAbsolute)} kcal (${varPct})`, tone: 'progress' });
            items.push({ k: tLang('Tendencia semanal', 'Weekly trend'), v: weeklyTrendLabel, tone: 'progress' });
            items.push({ k: tLang('Ritmo proyectado (cal)', 'Projected pace (cal)'), v: `${formatNumber(stats.projectedCalories)} kcal`, tone: 'projection' });

            container.innerHTML = items.map((it) => {
                if (it.type === 'group') {
                    return `<div class="pt-stat-group">${escapeHtml(it.v)}</div>`;
                }
                const tone = it.tone ? ` pt-stat-card--${it.tone}` : '';
                return `
                    <div class="pt-stat-card${tone}">
                        <div class="pt-stat-key">${escapeHtml(it.k)}</div>
                        <div class="pt-stat-value">${escapeHtml(it.v)}</div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error('Error renderEstadisticas', err);
        }
    };

    /* ── Chart drawing helpers ─────────────────────────── */
    const setupCanvas = (canvas) => {
        if (!canvas) return null;
        const wrap = canvas.parentElement;
        const w = wrap.clientWidth;
        const h = wrap.clientHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);
        return { ctx, w, h };
    };

    const renderCharts = (stats) => {
        if (!stats) return;
        const dim = stats.daysInMonth || 30;
        const agg = stats.aggByDate || new Map();
        const yr = stats.curYear ?? new Date().getFullYear();
        const mo = stats.curMonth ?? new Date().getMonth();

        // Build per-day arrays for current month
        const dailyMin = [];
        const dailyCal = [];
        for (let d = 1; d <= dim; d++) {
            const iso = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const entry = agg.get(iso);
            dailyMin.push(entry ? entry.minutes : 0);
            dailyCal.push(entry ? entry.calories : 0);
        }

        drawBarChart(dailyMin, dim);
        drawDonutChart(stats.daysTrained || 0, stats.daysRest ?? (dim - (stats.daysTrained || 0)));
    };

    const drawBarChart = (data, days) => {
        const c = setupCanvas(document.getElementById('pt-chart-bar'));
        if (!c) return;
        const { ctx, w, h } = c;
        const pad = { t: 8, b: 22, l: 6, r: 6 };
        const plotW = w - pad.l - pad.r;
        const plotH = h - pad.t - pad.b;
        const barW = Math.max(2, (plotW / days) - 2);
        const gap = (plotW - barW * days) / (days - 1 || 1);
        const maxVal = Math.max(...data, 1);

        // Bars
        const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + plotH);
        grad.addColorStop(0, getColorWithOpacity('--accent', 0.9, '#ff073a'));
        grad.addColorStop(1, getColorWithOpacity('--accent', 0.25, '#ff073a'));

        data.forEach((val, i) => {
            const barH = (val / maxVal) * plotH;
            const x = pad.l + i * (barW + gap);
            const y = pad.t + plotH - barH;
            ctx.fillStyle = val > 0 ? grad : 'rgba(255,255,255,0.04)';
            ctx.beginPath();
            const r = Math.min(3, barW / 2);
            ctx.roundRect(x, y, barW, Math.max(barH, 2), [r, r, 0, 0]);
            ctx.fill();
        });

        // X labels (every 5 days)
        ctx.fillStyle = 'rgba(255,255,255,0.38)';
        ctx.font = '500 9px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i < days; i += 5) {
            const x = pad.l + i * (barW + gap) + barW / 2;
            ctx.fillText(String(i + 1), x, h - 4);
        }
    };

    const drawLineChart = (data, days) => {
        const c = setupCanvas(document.getElementById('pt-chart-line'));
        if (!c) return;
        const { ctx, w, h } = c;
        const pad = { t: 12, b: 22, l: 10, r: 10 };
        const plotW = w - pad.l - pad.r;
        const plotH = h - pad.t - pad.b;
        const maxVal = Math.max(...data, 1);
        const stepX = plotW / (days - 1 || 1);

        // Area fill
        const gradFill = ctx.createLinearGradient(0, pad.t, 0, pad.t + plotH);
        gradFill.addColorStop(0, getColorWithOpacity('--accent2', 0.25, '#ff3b65'));
        gradFill.addColorStop(1, getColorWithOpacity('--accent2', 0.02, '#ff3b65'));
        ctx.beginPath();
        ctx.moveTo(pad.l, pad.t + plotH);
        data.forEach((val, i) => {
            const x = pad.l + i * stepX;
            const y = pad.t + plotH - (val / maxVal) * plotH;
            i === 0 ? ctx.lineTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.lineTo(pad.l + (days - 1) * stepX, pad.t + plotH);
        ctx.closePath();
        ctx.fillStyle = gradFill;
        ctx.fill();

        // Line
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff073a';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        data.forEach((val, i) => {
            const x = pad.l + i * stepX;
            const y = pad.t + plotH - (val / maxVal) * plotH;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Dots on active days
        data.forEach((val, i) => {
            if (val <= 0) return;
            const x = pad.l + i * stepX;
            const y = pad.t + plotH - (val / maxVal) * plotH;
            ctx.beginPath();
            ctx.arc(x, y, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff073a';
            ctx.fill();
        });

        // X labels
        ctx.fillStyle = 'rgba(255,255,255,0.38)';
        ctx.font = '500 9px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i < days; i += 5) {
            ctx.fillText(String(i + 1), pad.l + i * stepX, h - 4);
        }
    };

    const drawDonutChart = (active, rest) => {
        const c = setupCanvas(document.getElementById('pt-chart-donut'));
        if (!c) return;
        const { ctx, w, h } = c;
        const cx = w / 2, cy = h / 2;
        const radius = Math.min(cx, cy) - 16;
        const lineW = Math.max(18, radius * 0.28);
        const total = active + rest || 1;
        const pctActive = active / total;

        // Rest arc (background)
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.lineWidth = lineW;
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineCap = 'round';
        ctx.stroke();

        // Active arc
        if (active > 0) {
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + pctActive * Math.PI * 2;
            const grad = ctx.createConicGradient(startAngle, cx, cy);
            const activeColor1 = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff073a';
            const activeColor2 = getComputedStyle(document.documentElement).getPropertyValue('--accent2').trim() || '#ff3b65';
            const activeColor3 = getComputedStyle(document.documentElement).getPropertyValue('--accent3').trim() || '#cc062e';
            grad.addColorStop(0, activeColor1);
            grad.addColorStop(pctActive * 0.7, activeColor2);
            grad.addColorStop(pctActive, activeColor3);
            ctx.beginPath();
            ctx.arc(cx, cy, radius, startAngle, endAngle);
            ctx.lineWidth = lineW;
            ctx.strokeStyle = grad;
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        // Center text
        const pctLabel = `${Math.round(pctActive * 100)}%`;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = `900 ${Math.round(radius * 0.38)}px "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pctLabel, cx, cy - 4);
        ctx.fillStyle = 'rgba(255,255,255,0.48)';
        ctx.font = `600 ${Math.round(radius * 0.15)}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillText(tLang('activo', 'active'), cx, cy + radius * 0.22);

        // Legend
        const legY = h - 6;
        ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        // Active legend
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff073a';
        ctx.beginPath(); ctx.arc(cx - 48, legY, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.58)';
        ctx.textAlign = 'left';
        ctx.fillText(`${active} ${tLang('días', 'days')}`, cx - 40, legY + 3);
        // Rest legend
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath(); ctx.arc(cx + 8, legY, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.58)';
        ctx.fillText(`${rest} ${tLang('días', 'days')}`, cx + 16, legY + 3);
    };

    /* ── Swipe dot sync ────────────────────────────────── */
    let _dotsInitialized = false;
    const initChartSwipeDots = () => {
        if (_dotsInitialized) return;
        const swipe = document.getElementById('pt-charts-swipe');
        const dotsWrap = document.getElementById('pt-charts-dots');
        if (!swipe || !dotsWrap) return;
        _dotsInitialized = true;

        const dots = Array.from(dotsWrap.querySelectorAll('.pt-charts-dot'));
        const panels = Array.from(swipe.querySelectorAll('.pt-chart-panel'));

        const syncDots = () => {
            const scrollLeft = swipe.scrollLeft;
            const panelW = swipe.clientWidth || 1;
            const idx = Math.round(scrollLeft / panelW);
            dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
        };

        swipe.addEventListener('scroll', syncDots, { passive: true });

        dots.forEach((dot) => {
            dot.addEventListener('click', () => {
                const idx = Number(dot.dataset.dot || 0);
                const target = panels[idx];
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            });
        });
    };

    const getRegistrosByFecha = (fechaIso) => recordsByDate.get(fechaIso) || [];

    let currentViewDate = new Date(); // Track the current view date

    const onDeleteRegistro = async (registroId) => {
        const prev = Array.isArray(registros) ? registros.slice() : [];
        const next = prev.filter((registro, index) => getRegistroId(registro, index) !== registroId);
        if (next.length === prev.length) return false;

        registros = next;
        localStorage.setItem("Dias_cale", JSON.stringify(registros));

        try {
            const res = await guardarRegistrosEntreno(registros);
            if (!res.ok) {
                const txt = await res.text().catch(() => null);
                console.warn("No se pudo actualizar /guardar_registro_entreno:", res.status, txt);
                throw new Error("No se pudo guardar");
            }
        } catch (err) {
            registros = prev;
            localStorage.setItem("Dias_cale", JSON.stringify(registros));
            rebuildCalendarData();
            renderCustomCalendar();
            alert(tLang("No se pudo eliminar el registro. Intenta de nuevo.", "Could not delete the record. Please try again."));
            return false;
        }

        rebuildCalendarData();
        renderCustomCalendar();
        try {
            const stats = computeStatsFromEventos(eventos, currentViewDate);
            renderEstadisticas(stats);
        } catch (e) {
            console.warn('No se pudo actualizar estadísticas después de eliminar:', e);
        }
        return true;
    };

    rebuildCalendarData();

    const renderCustomCalendar = () => {
        const year = currentViewDate.getFullYear();
        const month = currentViewDate.getMonth();
        
        const firstDay = new Date(year, month, 1).getDay();
        const startDayIndex = firstDay === 0 ? 6 : firstDay - 1; // Monday=0
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const monthNames = isEnglish() 
            ? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
            : ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        
        const weekdays = isEnglish() ? ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] : ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

        let html = `
            <div class="custom-cal">
                <div class="custom-cal-header">
                    <button class="custom-cal-btn" id="custom-cal-prev"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
                    <h2 class="custom-cal-title">${monthNames[month]} ${year}</h2>
                    <button class="custom-cal-btn" id="custom-cal-next"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
                </div>
                <div class="custom-cal-weekdays">
                    ${weekdays.map(d => `<span>${d}</span>`).join("")}
                </div>
                <div class="custom-cal-grid" id="custom-cal-grid">
        `;

        for (let i = 0; i < startDayIndex; i++) {
            html += `<div class="custom-cal-cell is-empty"></div>`;
        }

        const todayIso = new Date().toLocaleDateString('en-CA');

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = dateStr === todayIso;
            
            const dayEvents = eventos.filter(e => e.start.startsWith(dateStr));
            let dotsHtml = "";
            if (dayEvents.length > 0) {
                dotsHtml = '<div class="custom-cal-dots">';
                dayEvents.forEach(e => {
                    const status = e.extendedProps?.status || "otro";
                    const color = status === "completado" ? (getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || "#ff073a") : "#d0c9c3";
                    dotsHtml += `<div class="custom-cal-dot" style="background:${color}"></div>`;
                });
                dotsHtml += '</div>';
            }

            html += `
                <div class="custom-cal-cell ${isToday ? 'is-today' : ''}" data-date="${dateStr}">
                    <span class="custom-cal-num">${d}</span>
                    ${dotsHtml}
                </div>
            `;
        }

        html += `</div></div>`;
        calendarEl.innerHTML = html;

        document.getElementById("custom-cal-prev").onclick = () => {
            currentViewDate.setMonth(currentViewDate.getMonth() - 1);
            onMonthChange();
        };
        document.getElementById("custom-cal-next").onclick = () => {
            currentViewDate.setMonth(currentViewDate.getMonth() + 1);
            onMonthChange();
        };

        const cells = calendarEl.querySelectorAll(".custom-cal-cell:not(.is-empty)");
        cells.forEach(cell => {
            cell.onclick = async () => {
                const fechaIso = cell.getAttribute("data-date");
                let registrosDelDia = getRegistrosByFecha(fechaIso);
                if (!registrosDelDia || registrosDelDia.length === 0) {
                    registrosDelDia = [];
                }
                await renderDetalleEntreno(fechaIso, registrosDelDia, onDeleteRegistro, getRegistrosByFecha, cell);
            };
        });
    };

    const onMonthChange = () => {
        renderCustomCalendar();
        try {
            const stats = computeStatsFromEventos(eventos, currentViewDate);
            renderEstadisticas(stats);
        } catch (e) {
            console.warn('No se pudo actualizar estadísticas:', e);
        }
    };

    renderCustomCalendar();
    try {
        const stats = computeStatsFromEventos(eventos, currentViewDate);
        renderEstadisticas(stats);
    } catch (e) {
        console.warn('No se pudo renderizar estadísticas:', e);
    }

    // Setup ResizeObserver to redraw charts dynamically when container sizes change (prevents stretching)
    try {
        const resizeObserver = new ResizeObserver((entries) => {
            if (lastStats) {
                requestAnimationFrame(() => {
                    renderCharts(lastStats);
                });
            }
        });
        const barWrap = document.getElementById('pt-chart-bar')?.parentElement;
        const donutWrap = document.getElementById('pt-chart-donut')?.parentElement;
        if (barWrap) resizeObserver.observe(barWrap);
        if (donutWrap) resizeObserver.observe(donutWrap);
    } catch (err) {
        console.warn('ResizeObserver setup failed:', err);
    }
}

window.onload = async () => {
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
    initCalendario();
    //initDetallePorDiaCalendario();
};