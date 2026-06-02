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

    // Gestor de fondo (Video Animado vs Imagen Estática)
    const BG_KEY = "ui_background";
    let bgPref = "video"; // por defecto
    try {
        bgPref = localStorage.getItem(BG_KEY) || "video";
    } catch {}

    let style = document.getElementById("dynamic-bg-style");
    if (!style) {
        style = document.createElement("style");
        style.id = "dynamic-bg-style";
        document.head.appendChild(style);
    }
    
    if (bgPref === "static") {
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
        `;
    }
})();
