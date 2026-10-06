/* Campanita de novedades.
   - Se inserta sola en cada ".header-actions" (a la izquierda de la foto de perfil, si existe).
   - Lee las novedades de /Datos/novedades.json: para publicar una nueva basta con agregar una entrada a ese archivo.
   - La lista y el detalle se abren con PTBottomSheet (se carga bajo demanda si la página no lo incluye).
   Expone window.PTNovedades.
*/
(() => {
	"use strict";

	const DATA_URL = "/Datos/novedades.json";
	const SEEN_KEY = "pt_novedades_vistas";

	const isEn = () => { try { return window.UIIdioma?.getIdioma?.() === "en"; } catch { return false; } };
	const T = (es, en) => (isEn() ? en : es);
	const pick = (v) => (v && typeof v === "object" ? (isEn() ? v.en || v.es : v.es || v.en) : v) ?? "";
	const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

	const readSeen = () => {
		try { const v = JSON.parse(localStorage.getItem(SEEN_KEY)); return Array.isArray(v) ? v : []; } catch { return []; }
	};
	const markSeen = (id) => {
		try {
			const seen = new Set(readSeen());
			seen.add(id);
			localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
		} catch { /* sin almacenamiento */ }
	};

	const formatDate = (iso) => {
		const [y, m, d] = String(iso).split("-").map(Number);
		if (!y || !m || !d) return String(iso);
		try {
			return new Intl.DateTimeFormat(isEn() ? "en-US" : "es-AR", { day: "2-digit", month: isEn() ? "short" : "2-digit", year: "numeric" })
				.format(new Date(y, m - 1, d));
		} catch { return String(iso); }
	};

	const ICONS = {
		store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
		dumbbell: '<path d="M6.5 6.5v11"/><path d="M17.5 6.5v11"/><path d="M3.5 9v6"/><path d="M20.5 9v6"/><path d="M6.5 12h11"/>',
		default: '<path d="M12 2l2.4 6.9H22l-6 4.4 2.3 7L12 16l-6.3 4.3 2.3-7-6-4.4h7.6z"/>',
	};
	const iconSvg = (name, size = 20) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.default}</svg>`;
	const BELL_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';

	const injectStyles = () => {
		if (document.getElementById("pt-novedades-styles")) return;
		const style = document.createElement("style");
		style.id = "pt-novedades-styles";
		style.textContent = `
			.pt-bell-btn { padding: 0; }
			.pt-bell-btn svg { display: block; }
			.pt-bell-btn.has-unread::after {
				content: "";
				position: absolute;
				top: 10px;
				right: 11px;
				width: 9px;
				height: 9px;
				border-radius: 50%;
				background: #ff4d4d;
				border: 2px solid #14161c;
				box-shadow: 0 0 8px rgba(255, 77, 77, 0.7);
			}
			.pt-bell-btn.is-ringing svg { animation: pt-bell-ring 0.9s ease 0.4s 1; transform-origin: 50% 10%; }
			@keyframes pt-bell-ring {
				0%, 100% { transform: rotate(0); }
				15% { transform: rotate(14deg); }
				30% { transform: rotate(-12deg); }
				45% { transform: rotate(9deg); }
				60% { transform: rotate(-6deg); }
				75% { transform: rotate(3deg); }
			}
			@media (prefers-reduced-motion: reduce) { .pt-bell-btn.is-ringing svg { animation: none; } }

			.pt-news-head { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
			.pt-news-heading { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.4px; margin: 0; }
			.pt-news-sub { font-size: 13px; color: rgba(255, 255, 255, 0.55); margin: 0; }
			.pt-news-list { display: flex; flex-direction: column; gap: 10px; }
			.pt-news-empty { text-align: center; color: rgba(255, 255, 255, 0.55); font-size: 13px; padding: 24px 0; }

			.pt-news-card {
				display: flex;
				align-items: flex-start;
				gap: 12px;
				width: 100%;
				text-align: left;
				font-family: inherit;
				color: #fff;
				cursor: pointer;
				padding: 14px;
				border-radius: 18px;
				background: #1a1d24;
				border: 1px solid rgba(255, 255, 255, 0.08);
				transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
			}
			.pt-news-card:hover { background: #20242c; border-color: rgba(255, 255, 255, 0.18); }
			.pt-news-card:active { transform: scale(0.985); }
			.pt-news-card.is-unread { border-color: rgba(157, 243, 255, 0.35); }
			.pt-news-icon {
				width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
				display: flex; align-items: center; justify-content: center;
				background: rgba(157, 243, 255, 0.1); color: #9df3ff;
			}
			.pt-news-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
			.pt-news-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 11.5px; font-weight: 700; color: rgba(255, 255, 255, 0.5); }
			.pt-news-tag { padding: 1px 8px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.16); color: rgba(255, 255, 255, 0.7); font-size: 10.5px; }
			.pt-news-new { padding: 1px 8px; border-radius: 999px; background: #ff4d4d; color: #fff; font-size: 10.5px; }
			.pt-news-title { font-size: 15px; font-weight: 800; line-height: 1.3; color: #fff; }
			.pt-news-summary { font-size: 12.5px; line-height: 1.45; color: rgba(255, 255, 255, 0.6); }
			.pt-news-more { font-size: 12px; font-weight: 700; color: #9df3ff; margin-top: 4px; }

			.pt-news-detail { display: flex; flex-direction: column; gap: 16px; }
			.pt-news-detail-top { display: flex; align-items: center; gap: 12px; }
			.pt-news-detail-title { font-size: 20px; font-weight: 800; line-height: 1.25; color: #fff; margin: 0; letter-spacing: -0.3px; }
			.pt-news-intro { font-size: 14px; line-height: 1.55; color: rgba(255, 255, 255, 0.78); margin: 0; }
			.pt-news-section { display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: 16px; background: #1a1d24; border: 1px solid rgba(255, 255, 255, 0.07); }
			.pt-news-section h3 { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #9df3ff; }
			.pt-news-section ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 7px; }
			.pt-news-section li { font-size: 13px; line-height: 1.5; color: rgba(255, 255, 255, 0.75); }
			.pt-news-cta {
				display: flex; align-items: center; justify-content: center; gap: 8px;
				padding: 13px 16px; border-radius: 14px; text-decoration: none;
				background: #9df3ff; color: #0c0d10; font-weight: 800; font-size: 14px;
			}
			.pt-news-cta:active { transform: scale(0.98); }
		`;
		document.head.appendChild(style);
	};

	let newsCache = null;
	const loadNews = async () => {
		if (newsCache) return newsCache;
		try {
			const res = await fetch(DATA_URL, { cache: "no-cache" });
			if (!res.ok) throw new Error("HTTP " + res.status);
			const data = await res.json();
			newsCache = (Array.isArray(data) ? data : []).filter((n) => n && n.id && n.fecha)
				.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
		} catch (e) {
			console.warn("No se pudieron cargar las novedades:", e);
			newsCache = [];
		}
		return newsCache;
	};

	const ensureSheet = () => new Promise((resolve) => {
		if (window.PTBottomSheet) return resolve(true);
		const s = document.createElement("script");
		s.src = "/Scripts/ui_bottom_sheet.js?v=5";
		s.onload = () => resolve(!!window.PTBottomSheet);
		s.onerror = () => resolve(false);
		document.head.appendChild(s);
	});

	const refreshBadge = async () => {
		const news = await loadNews();
		const seen = new Set(readSeen());
		const unread = news.some((n) => !seen.has(n.id));
		document.querySelectorAll(".pt-bell-btn").forEach((b) => {
			b.classList.toggle("has-unread", unread);
			b.setAttribute("aria-label", unread ? T("Novedades (hay nuevas)", "What's new (new items)") : T("Novedades", "What's new"));
			if (unread) b.classList.add("is-ringing");
		});
	};

	const cardHtml = (n, seen) => {
		const unread = !seen.has(n.id);
		return `
			<button type="button" class="pt-news-card ${unread ? "is-unread" : ""}" data-news-id="${esc(n.id)}">
				<span class="pt-news-icon">${iconSvg(n.icono)}</span>
				<span class="pt-news-body">
					<span class="pt-news-meta">
						<time datetime="${esc(n.fecha)}">${esc(formatDate(n.fecha))}</time>
						${n.etiqueta ? `<span class="pt-news-tag">${esc(pick(n.etiqueta))}</span>` : ""}
						${unread ? `<span class="pt-news-new">${esc(T("Nuevo", "New"))}</span>` : ""}
					</span>
					<span class="pt-news-title">${esc(pick(n.titulo))}</span>
					<span class="pt-news-summary">${esc(pick(n.resumen))}</span>
					<span class="pt-news-more">${esc(T("Ver detalle", "See details"))} ›</span>
				</span>
			</button>`;
	};

	const detailHtml = (n) => {
		const sections = (n.secciones || []).map((s) => `
			<section class="pt-news-section">
				<h3>${esc(pick(s.titulo))}</h3>
				<ul>${(s.items || []).map((it) => `<li>${esc(pick(it))}</li>`).join("")}</ul>
			</section>`).join("");
		const safeUrl = n.cta?.url && /^https:\/\//.test(n.cta.url) ? n.cta.url : "";
		const cta = safeUrl
			? `<a class="pt-news-cta" href="${esc(safeUrl)}" target="_blank" rel="noopener noreferrer">${esc(pick(n.cta.texto))}</a>`
			: "";
		return `
			<article class="pt-news-detail">
				<div class="pt-news-detail-top">
					<span class="pt-news-icon">${iconSvg(n.icono)}</span>
					<div class="pt-news-body">
						<span class="pt-news-meta"><time datetime="${esc(n.fecha)}">${esc(formatDate(n.fecha))}</time>${n.etiqueta ? `<span class="pt-news-tag">${esc(pick(n.etiqueta))}</span>` : ""}</span>
					</div>
				</div>
				<h2 class="pt-news-detail-title">${esc(pick(n.titulo))}</h2>
				${n.intro ? `<p class="pt-news-intro">${esc(pick(n.intro))}</p>` : ""}
				${sections}
				${cta}
			</article>`;
	};

	const openDetail = async (n) => {
		markSeen(n.id);
		refreshBadge();
		await window.PTBottomSheet.open({
			ariaLabel: pick(n.titulo),
			html: detailHtml(n),
			className: "pt-news-sheet",
			closeText: T("Cerrar", "Close"),
			stack: true,
			hideAd: true,
		});
		// Al volver a la lista, se actualizan las marcas de "Nuevo".
	};

	const openList = async (trigger) => {
		if (!(await ensureSheet())) return;
		const news = await loadNews();
		const seen = new Set(readSeen());
		const body = news.length
			? `<div class="pt-news-list">${news.map((n) => cardHtml(n, seen)).join("")}</div>`
			: `<p class="pt-news-empty">${esc(T("Todavía no hay novedades.", "No news yet."))}</p>`;
		await window.PTBottomSheet.open({
			ariaLabel: T("Novedades", "What's new"),
			html: `
				<div class="pt-news-head">
					<h2 class="pt-news-heading">${esc(T("Novedades", "What's new"))}</h2>
					<p class="pt-news-sub">${esc(T("Lo último de TrAIner. Tocá una novedad para ver el detalle.", "The latest from TrAIner. Tap an item to see the details."))}</p>
				</div>
				${body}`,
			className: "pt-news-list-sheet",
			closeText: T("Cerrar", "Close"),
			hideAd: true,
			triggerEl: trigger || null,
			didOpen: (sheet) => {
				sheet.addEventListener("click", async (e) => {
					const card = e.target.closest(".pt-news-card");
					if (!card) return;
					const item = news.find((n) => n.id === card.getAttribute("data-news-id"));
					if (!item) return;
					await openDetail(item);
					card.classList.remove("is-unread");
					card.querySelector(".pt-news-new")?.remove();
				});
			},
		});
	};

	const buildBell = () => {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "header-btn pt-bell-btn";
		btn.id = "btn-header-novedades";
		btn.title = T("Novedades", "What's new");
		btn.setAttribute("aria-label", T("Novedades", "What's new"));
		btn.setAttribute("aria-haspopup", "dialog");
		btn.innerHTML = BELL_SVG;
		btn.addEventListener("click", () => openList(btn));
		return btn;
	};

	const mount = () => {
		injectStyles();
		let mounted = false;
		document.querySelectorAll(".header-actions").forEach((box) => {
			if (box.querySelector(".pt-bell-btn")) { mounted = true; return; }
			const bell = buildBell();
			const avatar = box.querySelector(".header-avatar-btn");
			if (avatar) box.insertBefore(bell, avatar); else box.appendChild(bell);
			mounted = true;
		});
		if (mounted) refreshBadge();
	};

	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
	else mount();

	window.PTNovedades = { open: openList, refresh: refreshBadge };
})();
