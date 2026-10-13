// Exporta el plan de entreno activo a PDF: arma una hoja solo para impresión (nombre del plan, días y una tarjeta por
// ejercicio con el GIF completo y la descripción detallada) y abre el diálogo de impresión, donde se elige "Guardar como PDF".
// Se imprime con el navegador (y no con canvas) porque los GIFs vienen de otro dominio sin CORS y no se pueden rasterizar.
// La hoja queda oculta en pantalla y se rehace en cada exportación.
// Expone window.PTExportPlan. Lo usan plan_entreno (móvil y desktop).
(function () {
	"use strict";

	const ROOT_ID = "pt-export-root";
	const STYLE_ID = "pt-export-styles";
	const ESPERA_MAX_MS = 25000;

	const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
	const isEn = () => { try { return window.UIIdioma?.getIdioma?.() === "en"; } catch { return false; } };
	// Con "en" explícito se usa tal cual; sin él, se busca en el diccionario (textos del catálogo y del plan).
	const T = (es, en) => { try { return window.UIIdioma?.t ? window.UIIdioma.t(es, en) : es; } catch { return es; } };

	const CSS = `
		#${ROOT_ID} { display: none; }
		@media print {
			@page { size: A4; margin: 0; }
			html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; position: static !important; background: #0c0d10 !important; margin: 0 !important; padding: 0 !important; }
			body > *:not(#${ROOT_ID}) { display: none !important; }
			#${ROOT_ID} { display: block; color: #fff; font-family: "Plus Jakarta Sans", system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
			#${ROOT_ID} * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

			/* Página sin márgenes para que el fondo oscuro llegue al borde; el margen superior e inferior de cada hoja
			   lo dan el thead/tfoot vacíos, que el navegador repite en todas las páginas. */
			.ptx-sheet { width: 100%; border-collapse: collapse; border-spacing: 0; }
			.ptx-sheet td { padding: 0 9mm; }
			.ptx-pad { height: 11mm; }

			.ptx-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; padding-bottom: 10px; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.12); }
			.ptx-brand { font-size: 11px; font-weight: 800; letter-spacing: 0.02em; color: rgba(255,255,255,0.7); margin-bottom: 4px; }
			.ptx-brand b { color: #9df3ff; font-weight: 800; }
			.ptx-title { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.15; margin: 0; }
			.ptx-meta { font-size: 10.5px; font-weight: 600; color: #8a909a; text-align: right; white-space: nowrap; line-height: 1.5; }

			.ptx-day { margin-bottom: 16px; }
			.ptx-day-head { display: flex; align-items: center; gap: 10px; margin-bottom: 9px; break-after: avoid; page-break-after: avoid; }
			.ptx-day-num { width: 28px; height: 28px; border-radius: 50%; background: rgba(157,243,255,0.15); color: #9df3ff; font-size: 13px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
			.ptx-day-name { font-size: 15px; font-weight: 800; letter-spacing: -0.2px; margin: 0; }
			.ptx-day-sub { font-size: 10.5px; font-weight: 500; color: #8a909a; margin: 1px 0 0; }
			.ptx-day-count { margin-left: auto; font-size: 10px; font-weight: 700; color: #8a909a; white-space: nowrap; }
			.ptx-rest { font-size: 11px; color: #8a909a; background: #14161b; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 12px 14px; }

			.ptx-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
			.ptx-card { background: #14161b; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 9px; break-inside: avoid; page-break-inside: avoid; min-width: 0; }
			.ptx-gif { position: relative; width: 100%; aspect-ratio: 4 / 3; border-radius: 11px; background: #fff; overflow: hidden; display: flex; align-items: center; justify-content: center; }
			.ptx-gif img { width: 100%; height: 100%; object-fit: contain; display: block; }
			.ptx-gif.is-empty { background: rgba(255,255,255,0.04); color: rgba(157,243,255,0.6); }
			.ptx-sets { position: absolute; top: 5px; right: 5px; background: rgba(12,13,16,0.86); border: 1px solid rgba(255,255,255,0.14); color: #fff; font-size: 8.5px; font-weight: 700; padding: 2px 7px; border-radius: 999px; }
			.ptx-name { font-size: 11.5px; font-weight: 800; line-height: 1.25; letter-spacing: -0.2px; margin: 8px 0 6px; overflow-wrap: anywhere; }
			.ptx-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 7px; }
			.ptx-reps { background: rgba(46,213,115,0.14); color: #2ed573; padding: 2px 7px; border-radius: 6px; font-size: 9.5px; font-weight: 700; }
			.ptx-descanso { font-size: 9.5px; font-weight: 600; color: rgba(255,255,255,0.55); white-space: nowrap; }
			.ptx-guia { border-top: 1px solid rgba(255,255,255,0.07); padding-top: 6px; }
			.ptx-guia p { font-size: 8.6px; line-height: 1.42; color: rgba(255,255,255,0.78); margin: 0 0 5px; overflow-wrap: anywhere; }
			.ptx-guia p:last-child { margin-bottom: 0; }
			.ptx-guia b { display: block; font-size: 7.6px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #9df3ff; margin-bottom: 1px; }
		}
	`;

	const FALLBACK_SVG = '<svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" fill="none" stroke-width="2"><path d="m6.5 6.5 11 11"></path><path d="m21 21-1-1"></path><path d="m3 3 1 1"></path><path d="m18 22 4-4"></path><path d="m2 6 4-4"></path><path d="m3 10 7-7"></path><path d="m14 21 7-7"></path></svg>';

	// Línea "Etiqueta: texto" del texto detallado del catálogo (Técnica / Sobrecarga / Respiración).
	const linea = (detalle, etiqueta) => {
		const m = String(detalle || "").match(new RegExp("(?:^|\\n)\\s*" + etiqueta + ":\\s*([^\\n]+)"));
		return m ? m[1].trim() : "";
	};
	const tieneEtiquetas = (txt) => /(?:^|\n)\s*(Técnica|Sobrecarga|Respiración):/.test(String(txt || ""));

	// Las tres partes de la guía de un ejercicio: lo guardado en el plan tiene prioridad; lo que falte sale del catálogo.
	const guiaDe = (ex, data) => {
		const det = data?.descripcion_detallada || "";
		const propia = String(ex.tecnica || "").trim();
		let tecnica = linea(propia, "Técnica") || (tieneEtiquetas(propia) ? "" : propia) || linea(det, "Técnica") || data?.descripcion_guia || ex.descripcion || "";
		if (isEn() && data?.tecnica_en) tecnica = data.tecnica_en;
		else tecnica = T(tecnica);
		return {
			tecnica,
			sobrecarga: T(String(ex.sobrecarga || "").trim() || linea(propia, "Sobrecarga") || linea(det, "Sobrecarga")),
			respiracion: T(String(ex.respiracion || "").trim() || linea(propia, "Respiración") || linea(det, "Respiración")),
		};
	};

	const esDescanso = (d) => !d.ejercicios?.length;

	const cardHtml = (ex, buscar) => {
		const data = buscar ? buscar(ex.nombre) : null;
		const gifUrl = data?.gifUrl || ex.gifUrl || "";
		const nombre = isEn() && data?.nombre_en ? data.nombre_en : T(ex.nombre);
		const descanso = String(ex.descanso_segundos ?? ex.descanso ?? "90").replace(/\s*s(eg)?\.?$/i, "");
		const g = guiaDe(ex, data);
		const parte = (titulo, txt) => (txt ? `<p><b>${esc(titulo)}</b>${esc(txt)}</p>` : "");
		return `
			<div class="ptx-card">
				<div class="ptx-gif${gifUrl ? "" : " is-empty"}">
					${gifUrl ? `<img src="${esc(gifUrl)}" alt="" loading="eager" decoding="sync">` : FALLBACK_SVG}
					<span class="ptx-sets">${esc(ex.series || 3)} sets</span>
				</div>
				<h4 class="ptx-name" translate="no">${esc(nombre)}</h4>
				<div class="ptx-row">
					<span class="ptx-reps">${esc(ex.repeticiones || "8-12")} reps</span>
					<span class="ptx-descanso">${esc(T("Descanso", "Rest"))} ${esc(descanso)}s</span>
				</div>
				<div class="ptx-guia" translate="no">
					${parte(T("Técnica", "Technique"), g.tecnica)}
					${parte(T("Sobrecarga", "Overload"), g.sobrecarga)}
					${parte(T("Respiración", "Breathing"), g.respiracion)}
				</div>
			</div>`;
	};

	const hojaHtml = ({ nombre, dias, buscar }) => {
		const total = dias.reduce((acc, d) => acc + (d.ejercicios?.length || 0), 0);
		const activos = dias.filter((d) => !esDescanso(d)).length;
		const fecha = new Date().toLocaleDateString(isEn() ? "en-US" : "es", { day: "numeric", month: "long", year: "numeric" });
		const diasHtml = dias.map((d, i) => {
			const n = d.ejercicios?.length || 0;
			return `
				<section class="ptx-day">
					<div class="ptx-day-head">
						<span class="ptx-day-num">${i + 1}</span>
						<div>
							<h3 class="ptx-day-name">${esc(T(d.dia))}</h3>
							<p class="ptx-day-sub">${esc(esDescanso(d) ? T("Descanso", "Rest") : T(d.enfoque || "Rutina del día"))}</p>
						</div>
						${n ? `<span class="ptx-day-count">${n} ${esc(n === 1 ? T("ejercicio", "exercise") : T("ejercicios", "exercises"))}</span>` : ""}
					</div>
					${n ? `<div class="ptx-grid">${d.ejercicios.map((ex) => cardHtml(ex, buscar)).join("")}</div>`
						: `<div class="ptx-rest">${esc(T("Día de descanso: recuperación muscular.", "Rest day: muscle recovery."))}</div>`}
				</section>`;
		}).join("");
		return `
			<table class="ptx-sheet" role="presentation">
			<thead><tr><td><div class="ptx-pad"></div></td></tr></thead>
			<tfoot><tr><td><div class="ptx-pad"></div></td></tr></tfoot>
			<tbody><tr><td>
			<header class="ptx-head">
				<div>
					<div class="ptx-brand" translate="no">Tr<b>AI</b>ner</div>
					<h1 class="ptx-title" translate="no">${esc(nombre)}</h1>
				</div>
				<div class="ptx-meta">
					${activos} ${esc(T("días / sem", "days / wk"))} · ${total} ${esc(T("ejercicios", "exercises"))}<br>${esc(fecha)}
				</div>
			</header>
			${diasHtml}
			</td></tr></tbody>
			</table>`;
	};

	// Espera a que carguen (o fallen) todos los GIFs; el que falla se cambia por el ícono genérico.
	const esperarImagenes = (root, onProgreso) => new Promise((resolve) => {
		const imgs = Array.from(root.querySelectorAll("img"));
		let listas = 0;
		let terminado = false;
		const fin = () => { if (!terminado) { terminado = true; clearTimeout(timer); resolve(); } };
		const timer = setTimeout(fin, ESPERA_MAX_MS);
		const avisar = () => { try { onProgreso?.(listas, imgs.length); } catch { /* el aviso es opcional */ } };
		if (imgs.length === 0) { fin(); return; }
		avisar();
		for (const img of imgs) {
			const una = (ok) => {
				if (!ok) {
					const caja = img.parentElement;
					img.remove();
					caja?.classList.add("is-empty");
					caja?.insertAdjacentHTML("afterbegin", FALLBACK_SVG);
				}
				listas++;
				avisar();
				if (listas >= imgs.length) fin();
			};
			if (img.complete) una(img.naturalWidth > 0);
			else {
				img.addEventListener("load", () => una(true), { once: true });
				img.addEventListener("error", () => una(false), { once: true });
			}
		}
	});

	// Arma la hoja dentro de <body> y resuelve cuando sus imágenes están listas. No imprime.
	const preparar = async ({ nombre, dias, buscar, onProgreso } = {}) => {
		if (!Array.isArray(dias) || dias.length === 0) return null;
		if (!document.getElementById(STYLE_ID)) {
			const st = document.createElement("style");
			st.id = STYLE_ID;
			st.textContent = CSS;
			document.head.appendChild(st);
		}
		document.getElementById(ROOT_ID)?.remove();
		const root = document.createElement("div");
		root.id = ROOT_ID;
		root.setAttribute("aria-hidden", "true");
		root.innerHTML = hojaHtml({ nombre: nombre || T("Plan de Entrenamiento", "Training Plan"), dias, buscar });
		document.body.appendChild(root);
		await esperarImagenes(root, onProgreso);
		return root;
	};

	let exportando = false;

	// Devuelve false si no había nada que exportar (o ya hay una exportación en curso).
	const exportar = async (opts = {}) => {
		if (exportando) return false;
		exportando = true;
		try {
			const root = await preparar(opts);
			if (!root) return false;

			// El título del documento es el nombre de archivo que propone el diálogo al guardar como PDF.
			const tituloPrevio = document.title;
			const restaurar = () => { document.title = tituloPrevio; };
			document.title = `TrAIner - ${opts.nombre || "Plan"}`;
			window.addEventListener("afterprint", restaurar, { once: true });
			setTimeout(restaurar, 60000);

			window.print();
			return true;
		} finally {
			exportando = false;
		}
	};

	window.PTExportPlan = { exportar, preparar };
})();
