// Aplica el estado de transparencia global desde localStorage.
// Default: transparencia activada. Guardamos "0" solo si el usuario la desactiva.
(() => {
	const KEY = "ui_transparencia";
	let enabled = true;
	try {
		enabled = localStorage.getItem(KEY) !== "0";
	} catch {
		enabled = true;
	}
	document.documentElement.classList.toggle("no-transparency", !enabled);
})();
