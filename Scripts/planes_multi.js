// Varios planes de entreno por usuario dentro de la misma columna Planes.Plan_entreno (y de localStorage "plan_entreno_usuario").
// El plan ACTIVO se guarda con su forma de siempre en la raíz del JSON; los demás van en "otros_planes" y el nombre/posición
// del activo en "plan_meta". Así el resto de la app (dashboard, calendario, chatbot, funciones edge) sigue leyendo el plan
// activo sin cambios, y un plan guardado con el formato anterior se lee como una biblioteca de un solo plan.
// Expone window.PTPlanes. Lo usan plan_entreno (móvil y desktop).
(function () {
	"use strict";

	const MAX_PLANES = 10;
	const MAX_NOMBRE = 28;
	const CLAVES_EXTRA = ["plan_meta", "otros_planes"];

	const isEn = () => { try { return window.UIIdioma?.getIdioma?.() === "en"; } catch { return false; } };

	const parsear = (raw) => {
		if (raw && typeof raw === "object") return raw;
		const s = String(raw ?? "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
		if (!s || s === "Ninguno" || s === "Proximamente") return null;
		const intentar = (t) => { try { return JSON.parse(t); } catch { return null; } };
		const ini = Math.min(...["{", "["].map((c) => s.indexOf(c)).filter((i) => i !== -1));
		const fin = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
		const obj = (Number.isFinite(ini) && fin > ini ? intentar(s.slice(ini, fin + 1)) : null) ?? intentar(s);
		return obj && typeof obj === "object" ? obj : null;
	};

	const nuevoId = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
	const limpiarNombre = (n) => String(n ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_NOMBRE);

	// "Mi plan" para el primero; "Plan 2", "Plan 3"... para los siguientes, sin repetir nombres.
	const nombreLibre = (lib) => {
		const usados = new Set(lib.planes.map((p) => p.nombre.toLowerCase()));
		if (lib.planes.length === 0) return isEn() ? "My plan" : "Mi plan";
		for (let n = lib.planes.length + 1; ; n++) {
			const nombre = `Plan ${n}`;
			if (!usados.has(nombre.toLowerCase())) return nombre;
		}
	};

	// raw (string u objeto guardado) -> { activoId, planes: [{ id, nombre, plan }] }
	const leer = (raw) => {
		const lib = { activoId: null, planes: [] };
		const obj = parsear(raw);
		if (!obj) return lib;

		const base = Array.isArray(obj) ? { ejercicios: obj } : obj;
		const meta = base.plan_meta && typeof base.plan_meta === "object" ? base.plan_meta : {};
		for (const o of Array.isArray(base.otros_planes) ? base.otros_planes : []) {
			if (!o?.plan || typeof o.plan !== "object") continue;
			lib.planes.push({ id: String(o.id || nuevoId()), nombre: "", plan: o.plan, _nombre: limpiarNombre(o.nombre) });
		}

		const plan = {};
		for (const [k, v] of Object.entries(base)) if (!CLAVES_EXTRA.includes(k)) plan[k] = v;
		if (Object.keys(plan).length > 0) {
			const activo = { id: String(meta.id || nuevoId()), nombre: "", plan, _nombre: limpiarNombre(meta.nombre) };
			const pos = Number.isInteger(meta.pos) ? Math.min(Math.max(meta.pos, 0), lib.planes.length) : 0;
			lib.planes.splice(pos, 0, activo);
			lib.activoId = activo.id;
		} else if (lib.planes.length > 0) {
			lib.activoId = lib.planes[0].id;
		}

		// Nombres: se respetan los guardados; a los que falten se les asigna uno libre.
		const pendientes = lib.planes.slice();
		lib.planes = [];
		for (const p of pendientes) {
			const nombre = p._nombre || nombreLibre(lib);
			delete p._nombre;
			lib.planes.push(Object.assign(p, { nombre }));
		}
		return lib;
	};

	const activo = (lib) => lib.planes.find((p) => p.id === lib.activoId) || null;

	// Biblioteca -> string para guardar ("Ninguno" si no queda ningún plan).
	const serializar = (lib) => {
		const act = activo(lib) || lib.planes[0];
		if (!act) return "Ninguno";
		return JSON.stringify({
			...act.plan,
			plan_meta: { id: act.id, nombre: act.nombre, pos: lib.planes.indexOf(act) },
			otros_planes: lib.planes.filter((p) => p !== act).map(({ id, nombre, plan }) => ({ id, nombre, plan })),
		});
	};

	// Guarda el contenido de un plan: reemplaza el activo o, con { nuevo: true } (o si no hay ninguno), lo añade y lo activa.
	const guardar = (lib, planObj, { nuevo = false } = {}) => {
		const plan = {};
		for (const [k, v] of Object.entries(parsear(planObj) || {})) if (!CLAVES_EXTRA.includes(k)) plan[k] = v;
		if (Object.keys(plan).length === 0) return null; // contenido ilegible: no se guarda nada
		const act = activo(lib);
		if (act && !nuevo) { act.plan = plan; return act; }
		const creado = { id: nuevoId(), nombre: nombreLibre(lib), plan };
		lib.planes.push(creado);
		lib.activoId = creado.id;
		return creado;
	};

	const activar = (lib, id) => {
		if (!lib.planes.some((p) => p.id === id)) return false;
		lib.activoId = id;
		return true;
	};

	// Devuelve null si el nombre es válido y se aplicó; si no, el motivo ("vacio" | "repetido").
	const renombrar = (lib, id, nombre) => {
		const limpio = limpiarNombre(nombre);
		if (!limpio) return "vacio";
		if (lib.planes.some((p) => p.id !== id && p.nombre.toLowerCase() === limpio.toLowerCase())) return "repetido";
		const p = lib.planes.find((x) => x.id === id);
		if (p) p.nombre = limpio;
		return null;
	};

	// Elimina un plan; si era el activo, pasa a serlo el vecino (el anterior, o el siguiente si era el primero).
	const eliminar = (lib, id) => {
		const i = lib.planes.findIndex((p) => p.id === id);
		if (i === -1) return;
		lib.planes.splice(i, 1);
		if (lib.activoId === id) lib.activoId = lib.planes[Math.max(0, i - 1)]?.id ?? null;
	};

	const api = { MAX_PLANES, MAX_NOMBRE, leer, serializar, activo, guardar, activar, renombrar, eliminar, puedeCrear: (lib) => lib.planes.length < MAX_PLANES };
	if (typeof module !== "undefined") module.exports = api;
	if (typeof window !== "undefined") window.PTPlanes = api;
})();
