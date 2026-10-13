// Pedido de reseña en Google Play: se muestra al registrar un entreno, solo dentro de la app instalada en Android.
// Expone window.PTResena.entrenoCompletado(); lo llaman plan_entreno (móvil y desktop) y dashboard.js.
(function () {
	"use strict";

	const PLAY_URL = "https://play.google.com/store/apps/details?id=app.netlify.aipersonaltr.twa";
	const KEY = "pt_resena";
	// Se pide en el 3.er entreno registrado y, si responde "Ahora no", una vez más en el 10.º.
	const PEDIR_EN = [3, 10];
	const DEMORA_MS = 1400; // deja ver antes el aviso de "Entreno registrado"

	const leer = () => {
		try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
	};
	const guardar = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

	const isEn = () => { try { return window.UIIdioma?.getIdioma?.() === "en"; } catch { return false; } };
	const T = (es, en) => (isEn() ? en : es);

	const enAppAndroid = () => {
		const instalada = window.matchMedia?.("(display-mode: standalone)").matches
			|| window.matchMedia?.("(display-mode: fullscreen)").matches
			|| document.referrer.includes("android-app://");
		return instalada && /Android/i.test(navigator.userAgent || "");
	};

	const cerrar = (overlay) => {
		overlay.classList.remove("is-visible");
		setTimeout(() => overlay.remove(), 220);
	};

	const mostrar = () => {
		if (document.getElementById("pt-resena-overlay")) return;
		if (!document.getElementById("pt-resena-style")) {
			const style = document.createElement("style");
			style.id = "pt-resena-style";
			style.textContent = `
#pt-resena-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:flex-end;justify-content:center;padding:16px;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .2s ease}
#pt-resena-overlay.is-visible{opacity:1}
.pt-resena-card{width:100%;max-width:420px;margin-bottom:env(safe-area-inset-bottom,0px);padding:24px 20px 18px;border-radius:26px;background:#181a1f;border:1px solid rgba(255,255,255,.1);color:#fff;text-align:center;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;transform:translateY(16px);transition:transform .2s ease}
#pt-resena-overlay.is-visible .pt-resena-card{transform:none}
.pt-resena-stars{font-size:28px;letter-spacing:4px;color:#ffd166;margin-bottom:10px}
.pt-resena-card h2{font-size:19px;font-weight:800;margin:0 0 8px}
.pt-resena-card p{font-size:14.5px;line-height:1.5;color:#a3a9b3;margin:0 0 18px}
.pt-resena-btn{display:block;width:100%;padding:13px 18px;border:0;border-radius:999px;font:inherit;font-size:15px;font-weight:800;cursor:pointer;text-decoration:none}
.pt-resena-si{background:#fff;color:#0c0d10;margin-bottom:8px}
.pt-resena-no{background:transparent;color:#a3a9b3}
@media (min-width:1024px){#pt-resena-overlay{align-items:center}}`;
			document.head.appendChild(style);
		}

		const overlay = document.createElement("div");
		overlay.id = "pt-resena-overlay";
		overlay.setAttribute("role", "dialog");
		overlay.setAttribute("aria-modal", "true");
		overlay.setAttribute("aria-labelledby", "pt-resena-titulo");
		overlay.innerHTML = `
<div class="pt-resena-card">
	<div class="pt-resena-stars" aria-hidden="true">★★★★★</div>
	<h2 id="pt-resena-titulo">${T("¿Te está sirviendo TrAIner?", "Is TrAIner working for you?")}</h2>
	<p>${T("Tu reseña en Google Play nos ayuda a llegar a más personas. Te lleva menos de un minuto.", "Your review on Google Play helps us reach more people. It takes less than a minute.")}</p>
	<a class="pt-resena-btn pt-resena-si" href="${PLAY_URL}" target="_blank" rel="noopener">${T("Calificar en Google Play", "Rate on Google Play")}</a>
	<button type="button" class="pt-resena-btn pt-resena-no">${T("Ahora no", "Not now")}</button>
</div>`;

		overlay.querySelector(".pt-resena-si").addEventListener("click", () => {
			guardar({ ...leer(), hecho: true });
			cerrar(overlay);
		});
		overlay.querySelector(".pt-resena-no").addEventListener("click", () => cerrar(overlay));
		overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrar(overlay); });

		document.body.appendChild(overlay);
		requestAnimationFrame(() => overlay.classList.add("is-visible"));
	};

	const entrenoCompletado = () => {
		const estado = leer();
		estado.entrenos = (Number(estado.entrenos) || 0) + 1;
		guardar(estado);
		if (estado.hecho || !PEDIR_EN.includes(estado.entrenos) || !enAppAndroid()) return;
		setTimeout(mostrar, DEMORA_MS);
	};

	window.PTResena = { entrenoCompletado, mostrar };
})();
