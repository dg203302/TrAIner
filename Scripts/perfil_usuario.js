import { logout } from "./logout.js";
const username = localStorage.getItem("username_usuario")
const avatar = localStorage.getItem("avatar_usuario")
const id_usuario = localStorage.getItem("id_usuario")
const altura_usuario = localStorage.getItem("altura_usuario")
const edad_usuario = localStorage.getItem("edad_usuario")
const peso_usuario = localStorage.getItem("peso_usuario")
const peso_objetivo_usuario = localStorage.getItem("peso_objetivo_usuario")

const NETLIFY_EDGE_UNCAUGHT = "uncaught exception during edge function invocation";

const escapeHtml = (value) => String(value)
	.replaceAll("&", "&amp;")
	.replaceAll("<", "&lt;")
	.replaceAll(">", "&gt;")
	.replaceAll('"', "&quot;")
	.replaceAll("'", "&#39;");

const renderBMI = () => {
	const p = parseFloat(localStorage.getItem("peso_usuario"));
	const a = parseFloat(localStorage.getItem("altura_usuario"));
	const badge = document.getElementById("bmi_badge");
	if (!badge) return;

	if (p > 0 && a > 0) {
		const heightMeters = a / 100;
		const bmi = (p / (heightMeters * heightMeters)).toFixed(1);
		badge.textContent = `BMI: ${bmi}`;
		badge.style.display = "inline-flex";
	} else {
		badge.style.display = "none";
	}
};

const isNetlifyEdgeUncaughtInvocation = (text) =>
	String(text ?? "")
		.toLowerCase()
		.includes(NETLIFY_EDGE_UNCAUGHT);

const showNetlifyHostingErrorAlert = async ({ endpoint, status, statusText, bodyText }) => {
	const safeEndpoint = String(endpoint ?? "").trim() || "(desconocido)";
	const safeStatus = Number.isFinite(Number(status)) ? Number(status) : "-";
	const safeStatusText = String(statusText ?? "").trim() || "";
	const safeBody = String(bodyText ?? "").trim();

	const contentHtml = `
		<div class="server-error-swal">
			<div class="server-error">
				<div class="server-error__hero">${escapeHtml(NETLIFY_EDGE_UNCAUGHT)}</div>
				<div class="server-error__meta">
					<div><strong>Endpoint:</strong> ${escapeHtml(safeEndpoint)}</div>
					<div><strong>HTTP:</strong> ${escapeHtml(safeStatus)}${safeStatusText ? ` (${escapeHtml(safeStatusText)})` : ""}</div>
				</div>
				${safeBody ? `<pre class="server-error__body">${escapeHtml(safeBody.slice(0, 1200))}</pre>` : ""}
				<p class="server-error__note">
					Este es un error del servidor de hosting (<strong>Netlify</strong>). Por favor, aguardá unos minutos e intentá nuevamente cuando se restaure el servicio.
				</p>
			</div>
		</div>
		<div class="pt-status-actions">
			<button type="button" class="btn-primary" data-pt-close>Entendido</button>
		</div>
	`;

	try {
		const canUseSheet = !!window.PTBottomSheet && typeof window.PTBottomSheet.open === "function";
		if (canUseSheet) {
			await window.PTBottomSheet.open({
				title: "Error del servidor",
				ariaLabel: "Error del servidor",
				html: contentHtml,
				showClose: false,
				showHandle: true,
				allowOutsideClose: true,
				allowEscapeClose: true,
				allowDragClose: true,
				didOpen: (sheet) => {
					try {
						window.UIIdioma?.translatePage?.(sheet);
					} catch {
						// ignore
					}
					sheet.querySelector("[data-pt-close]")?.addEventListener("click", () => {
						try {
							window.PTBottomSheet?.close?.();
						} catch {
							// ignore
						}
					});
				},
			});
			return;
		}
	} catch {
		// ignore
	}

	try {
		const fallbackText = [
			"Error del servidor",
			`${NETLIFY_EDGE_UNCAUGHT}`,
			`Endpoint: ${safeEndpoint}`,
			`HTTP: ${safeStatus}${safeStatusText ? ` (${safeStatusText})` : ""}`,
			safeBody ? `\n${safeBody.slice(0, 800)}` : "",
		].filter(Boolean).join("\n");
		window.alert(fallbackText);
	} catch {
		// ignore
	}
};

const WHEEL_ITEM_HEIGHT = 44;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const buildWheelInRoot = ({ root, field, values, format, initialValue }) => {
	const wheelEl = root?.querySelector(`.wheel[data-field="${field}"]`);
	const inputEl = root?.querySelector(`#${field}`);
	if (!wheelEl || !inputEl) return;

	wheelEl.innerHTML = "";
	wheelEl.dataset.index = "0";
	wheelEl.dataset.length = String(values.length);

	const frag = document.createDocumentFragment();
	for (let i = 0; i < values.length; i++) {
		const item = document.createElement("div");
		item.className = "wheel-item";
		item.dataset.value = String(values[i]);
		item.textContent = format ? format(values[i]) : String(values[i]);
		frag.appendChild(item);
	}
	wheelEl.appendChild(frag);

	const setActive = (index) => {
		const clampedIndex = clamp(index, 0, values.length - 1);
		wheelEl.dataset.index = String(clampedIndex);
		inputEl.value = String(values[clampedIndex]);
		const items = wheelEl.querySelectorAll(".wheel-item");
		items.forEach((node, idx) => node.classList.toggle("is-active", idx === clampedIndex));
	};

	let scrollTimer = null;
	const onScroll = () => {
		const idx = Math.round((wheelEl.scrollTop + 0.0001) / WHEEL_ITEM_HEIGHT);
		setActive(idx);
		if (scrollTimer) window.clearTimeout(scrollTimer);
		scrollTimer = window.setTimeout(() => {
			wheelEl.scrollTo({ top: Number(wheelEl.dataset.index) * WHEEL_ITEM_HEIGHT, behavior: "smooth" });
		}, 80);
	};

	wheelEl.addEventListener("scroll", onScroll, { passive: true });
	wheelEl.addEventListener("click", (e) => {
		const item = e.target.closest(".wheel-item");
		if (!item) return;
		const items = Array.from(wheelEl.querySelectorAll(".wheel-item"));
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
		wheelEl.scrollTo({ top: Number(wheelEl.dataset.index) * WHEEL_ITEM_HEIGHT, behavior: "smooth" });
	});

	// Init at a provided value if present, otherwise first item
	const initial = Number.isFinite(initialValue) ? Number(initialValue) : values[0];
	const initialIndex = clamp(values.indexOf(initial), 0, values.length - 1);
	setActive(initialIndex);
	wheelEl.scrollTop = initialIndex * WHEEL_ITEM_HEIGHT;
};

const initAlturaWheelInPopup = (popupEl, currentAltura) => {
	const alturas = [];
	for (let cm = 100; cm <= 200; cm++) alturas.push(cm);
	const safeCurrent = clamp(Number(currentAltura) || 170, 100, 200);
	buildWheelInRoot({
		root: popupEl,
		field: "altura_modal",
		values: alturas,
		format: (cm) => `${cm} cm`,
		initialValue: safeCurrent,
	});
};

const pad2 = (value) => String(value).padStart(2, "0");

const isValidYMD = (year, month, day) => {
	if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
	if (month < 1 || month > 12) return false;
	if (day < 1 || day > 31) return false;
	const d = new Date(year, month - 1, day);
	return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
};

const calcAgeFromYMD = (year, month, day) => {
	const today = new Date();
	let age = today.getFullYear() - year;
	const m = (today.getMonth() + 1) - month;
	if (m < 0 || (m === 0 && today.getDate() < day)) age -= 1;
	return age;
};

const initEdadWheelsInPopup = (popupEl, currentEdad) => {
	const years = [];
	for (let y = 2032; y >= 1900; y--) years.push(y);

	const safeEdad = clamp(Number(currentEdad) || 26, 1, 120);
	const yearDefault = clamp(new Date().getFullYear() - safeEdad, 1900, 2032);

	buildWheelInRoot({
		root: popupEl,
		field: "dia_modal",
		values: Array.from({ length: 31 }, (_, i) => i + 1),
		format: pad2,
		initialValue: 1,
	});
	buildWheelInRoot({
		root: popupEl,
		field: "mes_modal",
		values: Array.from({ length: 12 }, (_, i) => i + 1),
		format: pad2,
		initialValue: 1,
	});
	buildWheelInRoot({
		root: popupEl,
		field: "ano_modal",
		values: years,
		format: (y) => String(y),
		initialValue: yearDefault,
	});
};

const initPesoWheelInPopup = (popupEl, { mode, currentPesoAct, currentPesoObj }) => {
	const weights = [];
	for (let kg = 40; kg <= 200; kg++) weights.push(kg);

	const safeAct = clamp(Number(currentPesoAct) || 70, 40, 200);
	const safeObj = clamp(Number(currentPesoObj) || 75, 40, 200);

	if (mode === "obj") {
		buildWheelInRoot({
			root: popupEl,
			field: "peso_desea_modal",
			values: weights,
			format: (kg) => `${kg} kg`,
			initialValue: safeObj,
		});
		return;
	}

	buildWheelInRoot({
		root: popupEl,
		field: "peso_act_modal",
		values: weights,
		format: (kg) => `${kg} kg`,
		initialValue: safeAct,
	});
};

const canUseBottomSheet = () => {
	try {
		return !!window.PTBottomSheet && typeof window.PTBottomSheet.open === "function";
	} catch {
		return false;
	}
};

const closeBottomSheetSafe = () => {
	try {
		window.PTBottomSheet?.close?.();
	} catch {
		// ignore
	}
};

const openStatusSheet = async ({ title, message } = {}) => {
	const safeTitle = String(title || "");
	const safeMessage = String(message || "");

	if (canUseBottomSheet()) {
		await window.PTBottomSheet.open({
			title: safeTitle,
			ariaLabel: safeTitle,
			html: `
				<div class="pt-status">
					<div class="pt-status-row">
						<div class="pt-status-text">${escapeHtml(safeMessage)}</div>
					</div>
					<div class="pt-status-actions">
						<button type="button" class="btn-primary" data-pt-close>Listo</button>
					</div>
				</div>
			`,
			showClose: false,
			showHandle: true,
			allowOutsideClose: true,
			allowEscapeClose: true,
			allowDragClose: true,
			didOpen: (sheet) => {
				try {
					window.UIIdioma?.translatePage?.(sheet);
				} catch {
					// ignore
				}
				sheet.querySelector("[data-pt-close]")?.addEventListener("click", () => closeBottomSheetSafe());
			},
		});
		return;
	}

	try {
		const msg = [safeTitle, safeMessage].filter(Boolean).join("\n\n");
		if (msg) window.alert(msg);
	} catch {
		// ignore
	}
};

const openConfirmSheet = async ({ title, message, confirmText, cancelText } = {}) => {
	const safeTitle = String(title || "Confirmar");
	const safeMessage = String(message || "");
	const okText = String(confirmText || "Aceptar");

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

		void window.PTBottomSheet.open({
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
				try {
					window.UIIdioma?.translatePage?.(sheet);
				} catch {
					// ignore
				}
				sheet.querySelector("[data-pt-confirm]")?.addEventListener("click", () => {
					safeResolve(true);
					closeBottomSheetSafe();
				});
			},
			willClose: () => safeResolve(false),
		});
	});
};

const openPerfilWheelSheet = async ({
	title,
	ariaLabel,
	helperText,
	helperTextEn,
	html,
	init,
	getValue,
	validate,
}) => {
	const bs = window.PTBottomSheet;
	if (!bs || typeof bs.open !== "function" || typeof bs.close !== "function") {
		console.warn("PTBottomSheet no está disponible; se mantiene SweetAlert para otros flujos.");
		return null;
	}

	let resolved = false;
	let resolvedValue = null;

	await bs.open({
		title: title || "",
		ariaLabel: ariaLabel || title || "Modal",
		className: "pt-perfil-sheet",
		html: `
			<div class="pt-perfil-form">
				<p class="pt-perfil-helper" data-i18n-en="${escapeHtml(helperTextEn || helperText || "")}">${escapeHtml(helperText || "")}</p>
				<div class="pt-form-error" data-pt-error role="alert" aria-live="polite"></div>
				${html || ""}
				<div class="pt-perfil-actions">
					<button type="button" class="btn-primary" data-pt-save data-i18n-en="Save">Guardar</button>
				</div>
			</div>
		`,
		didOpen: (sheet) => {
			const ui = window.UIIdioma;
			try {
				if (ui && typeof ui.translatePage === "function") ui.translatePage(sheet);
			} catch {
				// ignore
			}

			const errorEl = sheet.querySelector("[data-pt-error]");
			const setError = (msg) => {
				if (!errorEl) return;
				const text = String(msg || "").trim();
				errorEl.textContent = text;
				errorEl.classList.toggle("is-show", !!text);
			};
			const onSave = () => {
				setError("");
				let v = null;
				try {
					v = typeof getValue === "function" ? getValue(sheet) : null;
				} catch {
					v = null;
				}
				let err = "";
				try {
					err = typeof validate === "function" ? validate(v, sheet) : "";
				} catch {
					err = "";
				}
				if (err) {
					setError(err);
					return;
				}
				resolved = true;
				resolvedValue = v;
				bs.close();
			};
			sheet.querySelector("[data-pt-save]")?.addEventListener("click", onSave);

			try {
				if (typeof init === "function") init(sheet);
			} catch {
				// ignore
			}
		},
		willClose: () => {
			if (resolved) return;
			resolved = true;
			resolvedValue = null;
		},
	});

	return resolvedValue;
};

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

const initLogoutSidebarPlacement = () => {
	const header = document.querySelector("header");
	const footer = document.querySelector("footer");
	const logoutBtn = document.getElementById("logout_button");
	if (!header || !footer || !logoutBtn) return;

	const mqDesktop = (() => {
		try {
			return window.matchMedia ? window.matchMedia("(min-width: 1024px)") : null;
		} catch {
			return null;
		}
	})();

	const place = () => {
		const isDesktop = !!(mqDesktop && mqDesktop.matches);
		const target = isDesktop ? footer : header;
		if (logoutBtn.parentElement !== target) {
			target.appendChild(logoutBtn);
			updateFixedChromeHeights();
		}
	};

	place();

	// Reconfigurar automáticamente al cruzar el breakpoint.
	if (mqDesktop && document.documentElement.dataset.logoutSidebarMqInit !== "1") {
		document.documentElement.dataset.logoutSidebarMqInit = "1";
		try {
			mqDesktop.addEventListener("change", place);
		} catch {
			// Safari antiguo
			try {
				mqDesktop.addListener(place);
			} catch {
				// ignore
			}
		}
	}
};

const TRANSPARENCIA_STORAGE_KEY = "ui_transparencia";

const isTransparenciaEnabled = () => {
	// Por defecto: activado. Guardamos "0" solo si el usuario lo desactiva.
	try {
		return localStorage.getItem(TRANSPARENCIA_STORAGE_KEY) !== "0";
	} catch {
		return true;
	}
};

const setTransparenciaEnabled = (enabled) => {
	try {
		if (enabled) localStorage.removeItem(TRANSPARENCIA_STORAGE_KEY);
		else localStorage.setItem(TRANSPARENCIA_STORAGE_KEY, "0");
	} catch {
		// ignore
	}
	// La clase vive en <html> para afectar toda la página.
	document.documentElement.classList.toggle("no-transparency", !enabled);
};

const initTransparenciaToggle = () => {
	const toggle = document.getElementById("toggle_transparencia");
	if (!(toggle instanceof HTMLInputElement)) {
		// Aun sin toggle, aplicamos el estado persistido.
		setTransparenciaEnabled(isTransparenciaEnabled());
		return;
	}

	const enabled = isTransparenciaEnabled();
	toggle.checked = enabled;
	setTransparenciaEnabled(enabled);

	toggle.addEventListener("change", () => {
		setTransparenciaEnabled(toggle.checked);
	});
};

const initIdiomaToggle = () => {
	const ui = window.UIIdioma;
	if (!ui || typeof ui.getIdioma !== "function" || typeof ui.setIdioma !== "function" || typeof ui.translatePage !== "function") {
		return;
	}

	const toggle = document.getElementById("toggle_idioma");
	const current = ui.getIdioma();

	if (toggle instanceof HTMLInputElement) {
		toggle.checked = current === "en";
		toggle.addEventListener("change", () => {
			ui.setIdioma(toggle.checked ? "en" : "es");
			ui.translatePage(document);
		});
	}

	// Asegura que la página quede en el idioma persistido.
	ui.translatePage(document);
};

if (document.readyState === "loading") {
	document.addEventListener(
		"DOMContentLoaded",
		() => {
			initFixedChromeObservers();
			initLogoutSidebarPlacement();
		},
		{ once: true }
	);
} else {
	initFixedChromeObservers();
	initLogoutSidebarPlacement();
}


const initFondoToggle = () => {
    const BG_KEY = "ui_background";
    const toggle = document.getElementById("toggle_fondo");
    if (!toggle) return;

    let bgPref = "video";
    try {
        bgPref = localStorage.getItem(BG_KEY) || "video";
    } catch {}

    toggle.checked = bgPref === "video";

    toggle.addEventListener("change", () => {
        const newPref = toggle.checked ? "video" : "static";
        try {
            localStorage.setItem(BG_KEY, newPref);
        } catch {}
        
        let style = document.getElementById("dynamic-bg-style");
        if (!style) {
            style = document.createElement("style");
            style.id = "dynamic-bg-style";
            document.head.appendChild(style);
        }
        
        if (newPref === "static") {
            style.innerHTML = `
                #bg-video { display: none !important; }
                body { 
                    background: #000 url('/Images/bg_dashboard.jpg') no-repeat center center fixed !important;
                    background-size: cover !important;
                }
            `;
        } else {
            style.innerHTML = `
                body { background: transparent !important; }
                #bg-video { display: block !important; }
            `;
        }
    });
};

window.onload = async () => {
	document.getElementById("username").textContent = username;
	document.getElementById("icono_usuario").src = avatar;
	document.getElementById("altura_usuario").textContent = altura_usuario;
	document.getElementById("edad_usuario").textContent = edad_usuario;
	document.getElementById("peso_usuario").textContent = peso_usuario;
	document.getElementById("peso_objetivo_usuario").textContent = peso_objetivo_usuario;

	initIdiomaToggle();
	initTransparenciaToggle();
	initFondoToggle();
	renderBMI();
}

document.getElementById("editar_altura").addEventListener("click", async () => {
	const currentAltura = parseInt(localStorage.getItem("altura_usuario") || "170", 10);

	const nuevaAltura = await openPerfilWheelSheet({
		title: "Editar altura",
		ariaLabel: "Editar altura",
		helperText: "Seleccioná tu altura. Podés deslizar, tocar o usar las flechas ↑ ↓.",
		helperTextEn: "Select your height. You can scroll, tap or use ↑ ↓.",
		html: `
			<div class="altura-wheel">
				<div class="wheel-row has-row-highlight" role="group" aria-label="Altura" data-i18n-en-aria-label="Height">
					<div class="wheel" data-field="altura_modal" aria-label="Altura en centímetros" data-i18n-en-aria-label="Height in centimeters" tabindex="0"></div>
				</div>
				<input type="hidden" id="altura_modal" required>
			</div>
		`,
		init: (sheet) => {
			initAlturaWheelInPopup(sheet, currentAltura);
			sheet.querySelector(".wheel[data-field='altura_modal']")?.focus?.();
		},
		getValue: (sheet) => parseInt(sheet.querySelector("#altura_modal")?.value || "", 10),
		validate: (alt) => {
			if (!Number.isFinite(alt) || alt < 100 || alt > 200) return "Altura inválida";
			return "";
		},
	});

	if (!Number.isFinite(nuevaAltura)) return;
	localStorage.setItem("altura_usuario", String(nuevaAltura));
	const alturaSpan = document.getElementById("altura_usuario");
	if (alturaSpan) alturaSpan.textContent = String(nuevaAltura);
	renderBMI();
	await subirCambiosPerfil();
})

document.getElementById("editar_edad").addEventListener("click", async () => {
	const currentEdad = parseInt(localStorage.getItem("edad_usuario") || "26", 10);

	const fecha = await openPerfilWheelSheet({
		title: "Editar edad",
		ariaLabel: "Editar edad",
		helperText: "Elegí tu fecha de nacimiento (día/mes/año). Luego calculamos tu edad automáticamente.",
		helperTextEn: "Pick your birth date (day/month/year). We'll calculate your age automatically.",
		html: `
			<div class="edad-wheel">
				<div class="wheel-row" role="group" aria-label="Fecha de nacimiento" data-i18n-en-aria-label="Birth date">
					<div class="wheel" data-field="dia_modal" aria-label="Día" data-i18n-en-aria-label="Day" tabindex="0"></div>
					<div class="wheel" data-field="mes_modal" aria-label="Mes" data-i18n-en-aria-label="Month" tabindex="0"></div>
					<div class="wheel" data-field="ano_modal" aria-label="Año" data-i18n-en-aria-label="Year" tabindex="0"></div>
				</div>
				<input type="hidden" id="dia_modal" required>
				<input type="hidden" id="mes_modal" required>
				<input type="hidden" id="ano_modal" required>
			</div>
		`,
		init: (sheet) => {
			initEdadWheelsInPopup(sheet, currentEdad);
			sheet.querySelector(".wheel[data-field='dia_modal']")?.focus?.();
		},
		getValue: (sheet) => {
			const dia = parseInt(sheet.querySelector("#dia_modal")?.value || "", 10);
			const mes = parseInt(sheet.querySelector("#mes_modal")?.value || "", 10);
			const ano = parseInt(sheet.querySelector("#ano_modal")?.value || "", 10);
			return { dia, mes, ano };
		},
		validate: ({ dia, mes, ano }) => {
			if (!isValidYMD(ano, mes, dia)) return "Fecha de nacimiento inválida";
			const edad = calcAgeFromYMD(ano, mes, dia);
			if (!Number.isFinite(edad) || edad < 1 || edad > 120) return "Edad inválida";
			return "";
		},
	});

	const edadCalculada = (() => {
		if (!fecha || typeof fecha !== "object") return null;
		const { dia, mes, ano } = fecha;
		if (!isValidYMD(ano, mes, dia)) return null;
		const edad = calcAgeFromYMD(ano, mes, dia);
		if (!Number.isFinite(edad) || edad < 1 || edad > 120) return null;
		return edad;
	})();

	if (!Number.isFinite(edadCalculada)) return;
	localStorage.setItem("edad_usuario", String(edadCalculada));
	const edadSpan = document.getElementById("edad_usuario");
	if (edadSpan) edadSpan.textContent = String(edadCalculada);
	await subirCambiosPerfil();
})

const openPesoModal = async ({ mode = "act" } = {}) => {
	const currentPesoAct = parseInt(localStorage.getItem("peso_usuario") || "70", 10);
	const currentPesoObj = parseInt(localStorage.getItem("peso_objetivo_usuario") || "75", 10);

	const isObj = mode === "obj";
	const title = isObj ? "Editar Peso Objetivo" : "Editar Peso Actual";
	const sectionTitle = isObj ? "Peso objetivo" : "Peso actual";
	const sectionTitleEn = isObj ? "Target weight" : "Current weight";
	const wheelField = isObj ? "peso_desea_modal" : "peso_act_modal";
	const wheelAria = isObj ? "Peso objetivo en kilogramos" : "Peso actual en kilogramos";
	const inputId = isObj ? "peso_desea_modal" : "peso_act_modal";

	const newValue = await openPerfilWheelSheet({
		title: isObj ? "Editar peso objetivo" : "Editar peso actual",
		ariaLabel: isObj ? "Editar peso objetivo" : "Editar peso actual",
		helperText: `Ajustá tu ${sectionTitle.toLowerCase()}. Podés deslizar, tocar o usar ↑ ↓.`,
		helperTextEn: `Adjust your ${isObj ? "target weight" : "current weight"}. You can scroll, tap or use ↑ ↓.`,
		html: `
			<div class="pesos-wheel">
				<div class="pesos-grid" role="group" aria-label="Selección de pesos" data-i18n-en-aria-label="Weight selection">
					<section class="field">
						<h3 data-i18n-en="${escapeHtml(sectionTitleEn)}">${escapeHtml(sectionTitle)}</h3>
						<div class="wheel-wrap">
							<div class="wheel" data-field="${escapeHtml(wheelField)}" aria-label="${escapeHtml(wheelAria)}" tabindex="0"></div>
							<div class="wheel-highlight" aria-hidden="true"></div>
						</div>
						<input type="hidden" id="${escapeHtml(inputId)}" required>
					</section>
				</div>
			</div>
		`,
		init: (sheet) => {
			initPesoWheelInPopup(sheet, { mode, currentPesoAct, currentPesoObj });
			sheet.querySelector(`.wheel[data-field="${wheelField}"]`)?.focus?.();
		},
		getValue: (sheet) => parseInt(sheet.querySelector(`#${inputId}`)?.value || "", 10),
		validate: (value) => {
			if (!Number.isFinite(value) || value < 40 || value > 200) {
				return isObj ? "Peso objetivo inválido" : "Peso actual inválido";
			}
			return "";
		},
	});

	if (!Number.isFinite(newValue)) return;
	if (isObj) {
		localStorage.setItem("peso_objetivo_usuario", String(newValue));
		const pesoObjSpan = document.getElementById("peso_objetivo_usuario");
		if (pesoObjSpan) pesoObjSpan.textContent = String(newValue);
	} else {
		localStorage.setItem("peso_usuario", String(newValue));
		const pesoSpan = document.getElementById("peso_usuario");
		if (pesoSpan) pesoSpan.textContent = String(newValue);
		renderBMI();
	}
	await subirCambiosPerfil();
};

document.getElementById("editar_peso").addEventListener("click", async () => {
	await openPesoModal({ mode: "act" });
})
document.getElementById("editar_peso_objetivo").addEventListener("click", async () => {
	await openPesoModal({ mode: "obj" });
})


document.getElementById("eliminar_cuenta").addEventListener("click", async () => {
	await EliminarPerfil()
})

async function EliminarPerfil() {
	const ok = await openConfirmSheet({
		title: "¿Estás seguro?",
		message: "Esta acción no se puede deshacer. Se eliminará toda tu información.",
		confirmText: "Sí, eliminar mi cuenta",
		cancelText: "Cancelar",
	});

	if (!ok) return;

	let response;
	try {
		response = await fetch('/eliminar_cuenta_perfil', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id_usuario: id_usuario }),
		});
	} catch (e) {
		await openStatusSheet({
			title: "Error",
			message: "No se pudo conectar con el servidor. Intentá nuevamente.",
		});
		return;
	}

	if (!response.ok) {
		const bodyText = await response.text().catch(() => "");
		console.log("[EdgeFunction:/eliminar_cuenta_perfil] Error:", {
			status: response.status,
			statusText: response.statusText,
			body: bodyText,
		});

		if (isNetlifyEdgeUncaughtInvocation(bodyText)) {
			await showNetlifyHostingErrorAlert({
				endpoint: "/eliminar_cuenta_perfil",
				status: response.status,
				statusText: response.statusText,
				bodyText,
			});
			return;
		}

		let payload = {};
		try { payload = JSON.parse(bodyText || "{}"); } catch { payload = {}; }
		await openStatusSheet({
			title: "Error al eliminar",
			message: payload?.error ? String(payload.error) : "No se pudo eliminar la cuenta. Intentá nuevamente.",
		});
		return;
	}

	await openStatusSheet({
		title: "Cuenta eliminada",
		message: "Tu cuenta ha sido eliminada correctamente.",
	});

	try {
		await logout();
	} catch {
		// ignore
	}
}

async function subirCambiosPerfil() {
	let response;
	try {
		response = await fetch('/cargar_cambios_perfil', {
			method: 'POST',
			body: JSON.stringify({
				id_usuario: id_usuario,
				altura_usuario: localStorage.getItem("altura_usuario"),
				edad_usuario: localStorage.getItem("edad_usuario"),
				peso_usuario: localStorage.getItem("peso_usuario"),
				peso_objetivo_usuario: localStorage.getItem("peso_objetivo_usuario"),
			}),
		});
	} catch (e) {
		console.log("[EdgeFunction:/cargar_cambios_perfil] Error de red:", e);
		await openStatusSheet({
			title: 'Error',
			message: 'No se pudo conectar con el servidor. Intentá nuevamente.',
		});
		return;
	}

	const bodyText = await response.text().catch(() => "");
	let result = {};
	try { result = JSON.parse(bodyText || "{}"); } catch { result = {}; }

	if (response.ok) {
		await openStatusSheet({
			title: 'Cambios guardados',
			message: 'Tu perfil ha sido actualizado correctamente.',
		});
		console.log("Cambios de perfil subidos correctamente:", result);
	} else {
		console.log("[EdgeFunction:/cargar_cambios_perfil] Error:", {
			status: response.status,
			statusText: response.statusText,
			body: bodyText,
		});
		if (isNetlifyEdgeUncaughtInvocation(bodyText)) {
			await showNetlifyHostingErrorAlert({
				endpoint: "/cargar_cambios_perfil",
				status: response.status,
				statusText: response.statusText,
				bodyText,
			});
			return;
		}
		console.error("Error al subir cambios de perfil:", result);
	}
}