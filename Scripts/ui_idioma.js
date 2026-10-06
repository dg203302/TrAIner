/* Idioma de la interfaz (ES / EN).
   - Preferencia en localStorage ("ui_idioma"). API: UIIdioma.getIdioma / setIdioma / applyIdioma / translatePage / t / mountSwitch.
   - Textos con atributos data-i18n-en* (mecanismo original) se siguen respetando.
   - En inglés, además, se carga el diccionario /Scripts/i18n_en.js y se traduce todo el texto de la página,
     incluido el que generan los scripts después (un MutationObserver traduce lo nuevo).
   - Al volver a español se restauran los textos originales.
*/
(() => {
	"use strict";

	const STORAGE_KEY = "ui_idioma";
	const ES = "es";
	const EN = "en";
	const DICT_URL = "/Scripts/i18n_en.js?v=1";
	const CATALOG_URL = "/Datos/entrenamientos.json";

	// ───────────────────────── Núcleo puro (sin DOM): diccionario y traducción de cadenas ─────────────────────────
	const normKey = (s) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
	const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

	const createTranslator = () => {
		const exact = new Map();
		const patterns = [];

		const add = (es, en) => {
			if (typeof es !== "string" || typeof en !== "string") return;
			const key = normKey(es);
			if (!key) return;
			if (key.includes("{}")) {
				const raw = key.split("{}");
				const re = new RegExp("^" + raw.map(escapeRe).join("([^\\n]+?)") + "$", "i");
				// Prefiltros baratos para no ejecutar la regex sobre textos que no pueden coincidir.
				const lit = raw.reduce((a, b) => (b.length > a.length ? b : a), "");
				patterns.push({ re, tpl: en, weight: key.replace(/\{\}/g, "").length, first: raw[0], last: raw[raw.length - 1], lit });
				patterns.sort((a, b) => b.weight - a.weight);
			} else {
				exact.set(key, en);
			}
		};

		const matchCase = (src, out) => {
			const letters = src.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
			if (letters.length >= 2 && letters === letters.toUpperCase()) return out.toUpperCase();
			const first = src.charAt(0);
			if (!first || !out || first === first.toLowerCase() && first === first.toUpperCase()) return out; // no es una letra
			if (first === first.toLowerCase()) return out.charAt(0).toLowerCase() + out.slice(1);
			return out.charAt(0).toUpperCase() + out.slice(1);
		};

		const translate = (text, depth = 0) => {
			const raw = String(text ?? "");
			const core = raw.trim();
			if (!core) return raw;
			const lead = raw.slice(0, raw.length - raw.trimStart().length);
			const trail = raw.slice(raw.trimEnd().length);
			const key = normKey(core);

			if (exact.has(key)) return lead + matchCase(core, exact.get(key)) + trail;

			// Los textos con variables son cortos; evita gastar regex en párrafos largos.
			if (depth < 2 && core.length <= 160) {
				for (const p of patterns) {
					if (p.first && !key.startsWith(p.first)) continue;
					if (p.last && !key.endsWith(p.last)) continue;
					if (p.lit && !key.includes(p.lit)) continue;
					const mm = core.replace(/\s+/g, " ").match(p.re);
					if (!mm) continue;
					// Las variables suelen ser cortas (nombres, números); si capturan una frase larga, el patrón no aplica.
					if (mm.slice(1).some((cap) => cap.length > 60)) continue;
					const caps = mm.slice(1).map((c) => {
						if (/^[\d\s.,:/%+\-–—()]+$/.test(c)) return c;
						const t = translate(c, depth + 1);
						return t;
					});
					let i = 0;
					const out = p.tpl.replace(/\{(\d*)\}/g, (_, n) => (n ? caps[Number(n) - 1] : caps[i++]) ?? "");
					return lead + matchCase(core, out) + trail;
				}
			}
			return raw;
		};

		return { add, translate, size: () => exact.size + patterns.length, has: (s) => exact.has(normKey(s)) };
	};

	// Entorno sin navegador (pruebas en Node): solo exporta el núcleo.
	if (typeof window === "undefined" || typeof document === "undefined") {
		if (typeof module !== "undefined") module.exports = { createTranslator, normKey };
		return;
	}

	// ───────────────────────── Preferencia de idioma ─────────────────────────
	const normalizeLang = (value) => (String(value).toLowerCase() === EN ? EN : ES);

	const getIdioma = () => {
		try {
			return normalizeLang(localStorage.getItem(STORAGE_KEY));
		} catch {
			return ES;
		}
	};

	// ───────────────────────── Diccionario (carga bajo demanda, solo en inglés) ─────────────────────────
	const translator = createTranslator();
	let dictState = "idle"; // idle | loading | ready | failed
	let dictPromise = null;

	const loadScript = (src) => new Promise((resolve, reject) => {
		const s = document.createElement("script");
		s.src = src;
		s.onload = () => resolve();
		s.onerror = () => reject(new Error("No se pudo cargar " + src));
		document.head.appendChild(s);
	});

	const loadCatalogNames = async () => {
		try {
			const res = await fetch(CATALOG_URL);
			if (!res.ok) return;
			const data = await res.json();
			for (const lista of Object.values(data)) {
				for (const ex of lista) {
					if (ex.nombre && ex.nombre_en) translator.add(ex.nombre, ex.nombre_en);
					if (ex.tecnica_en) {
						if (ex.descripcion_guia) translator.add(ex.descripcion_guia, ex.tecnica_en);
						if (ex.descripcion) translator.add(ex.descripcion, ex.tecnica_en.length > 100 ? ex.tecnica_en.slice(0, 100) + "..." : ex.tecnica_en);
						// Texto detallado completo (tres líneas: Técnica / Sobrecarga / Respiración): se compone con las líneas ya traducidas.
						if (ex.descripcion_detallada) {
							const labels = { "Técnica": "Technique", "Sobrecarga": "Overload", "Respiración": "Breathing" };
							const en = ex.descripcion_detallada.split("\n").map((line) => {
								const m = line.match(/^(Técnica|Sobrecarga|Respiración):\s*([\s\S]*)$/);
								if (!m) return translator.translate(line);
								return labels[m[1]] + ": " + (m[1] === "Técnica" ? ex.tecnica_en : translator.translate(m[2]));
							}).join("\n");
							translator.add(ex.descripcion_detallada, en);
						}
					}
				}
			}
		} catch { /* sin catálogo: se sigue con el diccionario */ }
	};

	const ensureDict = () => {
		if (dictState === "ready") return Promise.resolve(true);
		if (dictPromise) return dictPromise;
		dictState = "loading";
		dictPromise = (async () => {
			try {
				if (!window.PT_I18N_EN) await loadScript(DICT_URL);
				for (const [es, en] of window.PT_I18N_EN || []) translator.add(es, en);
				await loadCatalogNames();
				dictState = "ready";
				return true;
			} catch (e) {
				console.warn("Diccionario de inglés no disponible:", e);
				dictState = "failed";
				return false;
			}
		})();
		return dictPromise;
	};

	// ───────────────────────── Traducción del DOM ─────────────────────────
	const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"]);
	const ATTRS = ["placeholder", "title", "aria-label", "alt"];

	const origText = new WeakMap();
	const appliedText = new WeakMap();
	const origAttrs = new WeakMap(); // el -> { attr: { orig, applied } }
	const touched = new Set(); // WeakRef de nodos/elementos modificados (para restaurar)
	let titleState = null;

	const shouldSkip = (node) => {
		for (let el = node.nodeType === 1 ? node : node.parentElement; el; el = el.parentElement) {
			if (SKIP_TAGS.has(el.tagName.toUpperCase())) return true;
			if (el.hasAttribute("data-i18n-skip") || el.getAttribute("translate") === "no") return true;
			if (el.hasAttribute("data-i18n-en")) return true; // lo gestiona el mecanismo original
		}
		return false;
	};

	const processTextNode = (node) => {
		if (!node.nodeValue || !node.nodeValue.trim() || shouldSkip(node)) return;
		const cur = node.nodeValue;
		if (origText.has(node) && cur === appliedText.get(node)) return;
		const out = translator.translate(cur);
		if (out !== cur) {
			origText.set(node, cur);
			appliedText.set(node, out);
			node.nodeValue = out;
			touched.add(new WeakRef(node));
		} else if (origText.has(node)) {
			origText.delete(node);
			appliedText.delete(node);
		}
	};

	const attrExcluded = (el) => {
		for (let e = el; e; e = e.parentElement) {
			if (e.tagName === "SCRIPT" || e.tagName === "STYLE") return true;
			if (e.hasAttribute("data-i18n-skip") || e.getAttribute("translate") === "no") return true;
		}
		return false;
	};

	const processAttrs = (el) => {
		if (!el.getAttribute || attrExcluded(el)) return;
		let rec = origAttrs.get(el);
		for (const attr of ATTRS) {
			if (!el.hasAttribute(attr)) continue;
			const cur = el.getAttribute(attr);
			if (rec?.[attr] && cur === rec[attr].applied) continue;
			const out = translator.translate(cur);
			if (out !== cur) {
				if (!rec) { rec = {}; origAttrs.set(el, rec); touched.add(new WeakRef(el)); }
				rec[attr] = { orig: cur, applied: out };
				el.setAttribute(attr, out);
			} else if (rec?.[attr]) {
				delete rec[attr];
			}
		}
	};

	const processTree = (root) => {
		if (!root) return;
		if (root.nodeType === 3) { processTextNode(root); return; }
		if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
		if (root.nodeType === 1) processAttrs(root);
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
		let n = walker.nextNode();
		while (n) {
			if (n.nodeType === 3) processTextNode(n); else processAttrs(n);
			n = walker.nextNode();
		}
	};

	const processTitle = () => {
		const cur = document.title;
		if (titleState && cur === titleState.applied) return;
		const out = translator.translate(cur);
		if (out !== cur) {
			titleState = { orig: cur, applied: out };
			document.title = out;
		}
	};

	const restoreAll = () => {
		for (const ref of touched) {
			const n = ref.deref();
			if (!n) continue;
			if (n.nodeType === 3) {
				if (origText.has(n) && n.nodeValue === appliedText.get(n)) n.nodeValue = origText.get(n);
				origText.delete(n);
				appliedText.delete(n);
			} else {
				const rec = origAttrs.get(n);
				if (rec) for (const [attr, v] of Object.entries(rec)) if (n.getAttribute(attr) === v.applied) n.setAttribute(attr, v.orig);
				origAttrs.delete(n);
			}
		}
		touched.clear();
		if (titleState && document.title === titleState.applied) document.title = titleState.orig;
		titleState = null;
	};

	// Observador: traduce nodos y atributos que los scripts agregan o cambian después de la carga.
	let observer = null;
	let pending = new Set();
	let scheduled = false;

	const flush = () => {
		scheduled = false;
		const batch = pending;
		pending = new Set();
		for (const t of batch) {
			if (t.nodeType === 3) { if (t.isConnected) processTextNode(t); } else if (t.isConnected) processTree(t);
		}
		processTitle();
	};

	const queue = (t) => {
		pending.add(t);
		if (!scheduled) { scheduled = true; setTimeout(flush, 30); }
	};

	const startObserver = () => {
		if (observer || !document.documentElement) return;
		observer = new MutationObserver((records) => {
			for (const r of records) {
				if (r.type === "characterData") queue(r.target);
				else if (r.type === "attributes") queue(r.target);
				else r.addedNodes.forEach((n) => { if (n.nodeType === 1 || n.nodeType === 3) queue(n); });
			}
		});
		observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
	};

	const stopObserver = () => { observer?.disconnect(); observer = null; pending = new Set(); };

	// Evita el "parpadeo" en español mientras se carga el diccionario.
	const setPending = (on) => {
		const root = document.documentElement;
		if (!root) return;
		if (on) {
			if (!document.getElementById("pt-i18n-pending-style") && document.head) {
				const st = document.createElement("style");
				st.id = "pt-i18n-pending-style";
				st.textContent = "html.i18n-pending body{visibility:hidden!important}";
				document.head.appendChild(st);
			}
			root.classList.add("i18n-pending");
			setTimeout(() => root.classList.remove("i18n-pending"), 2500);
		} else {
			root.classList.remove("i18n-pending");
		}
	};

	const applyDictionaryTranslation = async (root = document) => {
		const ok = await ensureDict();
		if (getIdioma() !== EN) { setPending(false); return; }
		if (ok) {
			processTree(root === document ? document.body : root);
			processTitle();
			startObserver();
		}
		setPending(false);
	};

	// ───────────────────────── Mecanismo original (data-i18n-en*) ─────────────────────────
	const applyIdioma = (lang) => {
		const normalized = normalizeLang(lang);
		document.documentElement.lang = normalized;
		document.documentElement.classList.toggle("lang-en", normalized === EN);
	};

	const toDatasetKey = (attrName) => {
		const pascal = String(attrName)
			.split("-")
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join("");
		return `i18nEs${pascal}`;
	};

	const translateElement = (el, lang) => {
		if (!(el instanceof Element)) return;

		const normalized = normalizeLang(lang);

		const enText = el.getAttribute("data-i18n-en");
		if (enText !== null) {
			if (!el.dataset.i18nEs) el.dataset.i18nEs = el.textContent ?? "";
			el.textContent = normalized === EN ? enText : el.dataset.i18nEs;
		}

		for (const attr of ATTRS) {
			const enAttr = el.getAttribute(`data-i18n-en-${attr}`);
			if (enAttr === null) continue;

			const datasetKey = toDatasetKey(attr);
			if (!(datasetKey in el.dataset)) {
				const current = el.getAttribute(attr);
				el.dataset[datasetKey] = current ?? "";
			}

			if (normalized === EN) el.setAttribute(attr, enAttr);
			else el.setAttribute(attr, el.dataset[datasetKey] ?? "");
		}
	};

	const translatePage = (root = document) => {
		const lang = getIdioma();
		applyIdioma(lang);

		const selector = [
			"[data-i18n-en]",
			"[data-i18n-en-aria-label]",
			"[data-i18n-en-title]",
			"[data-i18n-en-placeholder]",
		].join(",");

		if (root instanceof Element) {
			if (root.matches(selector)) translateElement(root, lang);
			root.querySelectorAll(selector).forEach((el) => translateElement(el, lang));
		} else {
			document.querySelectorAll(selector).forEach((el) => translateElement(el, lang));
		}

		if (lang === EN) {
			applyDictionaryTranslation(root);
		} else {
			stopObserver();
			restoreAll();
		}
	};

	const setIdioma = (lang) => {
		const normalized = normalizeLang(lang);
		try {
			localStorage.setItem(STORAGE_KEY, normalized);
		} catch {
			// ignore
		}
		applyIdioma(normalized);
		translatePage(document);
		try { document.dispatchEvent(new CustomEvent("ui-idioma-change", { detail: { lang: normalized } })); } catch { /* ignore */ }
		return normalized;
	};

	// Traduce una cadena suelta (para scripts): en inglés y con el diccionario listo devuelve la traducción.
	const t = (es, en) => {
		if (getIdioma() !== EN) return es;
		if (typeof en === "string" && en) return en;
		return dictState === "ready" ? translator.translate(es) : es;
	};

	// Selector ES | EN reutilizable. Cambia el idioma y recarga para que todo el contenido se regenere.
	const mountSwitch = (container, { reload = true } = {}) => {
		if (!(container instanceof Element)) return null;
		const wrap = document.createElement("div");
		wrap.className = "pt-lang-switch";
		wrap.setAttribute("role", "group");
		wrap.setAttribute("aria-label", "Language / Idioma");
		const current = getIdioma();
		wrap.innerHTML = `
			<button type="button" class="pt-lang-btn${current === ES ? " is-active" : ""}" data-lang="es" aria-pressed="${current === ES}">ES</button>
			<button type="button" class="pt-lang-btn${current === EN ? " is-active" : ""}" data-lang="en" aria-pressed="${current === EN}">EN</button>`;
		wrap.addEventListener("click", (e) => {
			const btn = e.target.closest(".pt-lang-btn");
			if (!btn) return;
			const lang = btn.getAttribute("data-lang");
			if (lang === getIdioma()) return;
			setIdioma(lang);
			if (reload) location.reload();
			else wrap.querySelectorAll(".pt-lang-btn").forEach((b) => { const on = b === btn; b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", String(on)); });
		});
		container.appendChild(wrap);
		injectSwitchStyles();
		return wrap;
	};

	const injectSwitchStyles = () => {
		if (document.getElementById("pt-lang-switch-styles")) return;
		const st = document.createElement("style");
		st.id = "pt-lang-switch-styles";
		st.textContent = `
			.pt-lang-switch { display: inline-flex; padding: 3px; gap: 2px; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); }
			.pt-lang-btn { border: 0; background: transparent; color: rgba(255,255,255,0.65); font-family: inherit; font-size: 12px; font-weight: 700; line-height: 1; letter-spacing: .04em; padding: 7px 12px; border-radius: 999px; cursor: pointer; transition: background .15s ease, color .15s ease; }
			.pt-lang-btn:hover { color: #fff; }
			.pt-lang-btn.is-active { background: #fff; color: #0c0d10; }
		`;
		document.head.appendChild(st);
	};

	window.UIIdioma = {
		getIdioma,
		setIdioma,
		applyIdioma,
		translatePage,
		t,
		mountSwitch,
	};

	// Inserta el selector ES | EN en cada elemento marcado con data-lang-switch.
	const mountAllSwitches = () => document.querySelectorAll("[data-lang-switch]:not([data-lang-switch-ready])").forEach((el) => { el.setAttribute("data-lang-switch-ready", ""); mountSwitch(el); });
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAllSwitches, { once: true }); else mountAllSwitches();

	// Aplica de inmediato y traduce cuando el DOM está listo.
	const initialLang = getIdioma();
	applyIdioma(initialLang);
	if (initialLang === EN) { ensureDict(); setPending(true); }
	if (document.readyState === "loading") {
		document.addEventListener(
			"DOMContentLoaded",
			() => {
				translatePage(document);
			},
			{ once: true },
		);
	} else {
		translatePage(document);
	}
})();
