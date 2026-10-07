/* Anuncio fijo (solo móvil): escala el banner al ancho de la franja y reserva espacio al final de la página.
   Trabaja sobre el contenedor .pt-ad-container que ya existe en la plantilla; no mueve ni recarga el anuncio. */
(() => {
	"use strict";

	const BANNER_W = 728;
	const BANNER_H = 90;

	const init = () => {
		const box = document.querySelector(".pt-ad-container");
		const wrap = box?.querySelector(".pt-ad-slot-wrapper");
		if (!box || !wrap) return;

		document.body.classList.add("has-fixed-ad");

		const update = () => {
			const w = wrap.clientWidth || box.clientWidth - 20 || 340;
			const scale = Math.min(1, w / BANNER_W);
			box.style.setProperty("--pt-ad-scale", scale.toFixed(4));
			box.style.setProperty("--pt-ad-slot-h", Math.round(BANNER_H * scale) + "px");
			// Alto real de la franja, para dejar ese espacio libre al final del contenido.
			const h = Math.ceil(box.getBoundingClientRect().height);
			if (h > 0) document.documentElement.style.setProperty("--pt-ad-h", h + "px");
		};

		update();
		if (typeof ResizeObserver === "function") new ResizeObserver(update).observe(wrap);
		window.addEventListener("resize", update, { passive: true });
		window.addEventListener("orientationchange", update, { passive: true });
	};

	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
	else init();
})();
