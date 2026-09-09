/**
 * TrAIner - SPA Router & Responsive View Manager
 * Gestión canónica de rutas, detección dinámica de cambios de dimensiones (Desktop <-> Móvil),
 * prefetching inteligente y delegación completa a las animaciones nativas de cada plantilla.
 */

(function () {
    'use strict';

    // ── 1. MAPA DE RUTAS RESPONSIVAS Y CANÓNICAS ──
    function isDesktopScreen() {
        return (window.matchMedia && window.matchMedia("(min-width: 1024px)").matches) || window.innerWidth >= 1024;
    }

    const DESKTOP_MAP = {
        "/Templates/dashboard.html": "/Templates_Pantalla_Ancha/dashboard_desktop.html",
        "/Templates/calendario_renov.html": "/Templates_Pantalla_Ancha/calendario_renov_desktop.html",
        "/Templates/plan_entreno.html": "/Templates_Pantalla_Ancha/plan_entreno_desktop.html",
        "/Templates/plan_alimentacion.html": "/Templates_Pantalla_Ancha/plan_alimentacion_desktop.html",
        "/Templates/chatbot.html": "/Templates_Pantalla_Ancha/chatbot_desktop.html",
        "/Templates/config.html": "/Templates_Pantalla_Ancha/config_desktop.html",
        "/Templates/creacionCuen/loginGoogle.html": "/Templates_Pantalla_Ancha/creacionCuen_desktop/loginGoogle_desktop.html",
        "/Templates/creacionCuen/datosUnuevo.html": "/Templates_Pantalla_Ancha/creacionCuen_desktop/datosUnuevo_desktop.html"
    };

    const MOBILE_MAP = {
        "/Templates_Pantalla_Ancha/dashboard_desktop.html": "/Templates/dashboard.html",
        "/Templates_Pantalla_Ancha/calendario_renov_desktop.html": "/Templates/calendario_renov.html",
        "/Templates_Pantalla_Ancha/plan_entreno_desktop.html": "/Templates/plan_entreno.html",
        "/Templates_Pantalla_Ancha/plan_alimentacion_desktop.html": "/Templates/plan_alimentacion.html",
        "/Templates_Pantalla_Ancha/chatbot_desktop.html": "/Templates/chatbot.html",
        "/Templates_Pantalla_Ancha/config_desktop.html": "/Templates/config.html",
        "/Templates_Pantalla_Ancha/creacionCuen_desktop/loginGoogle_desktop.html": "/Templates/creacionCuen/loginGoogle.html",
        "/Templates_Pantalla_Ancha/creacionCuen_desktop/datosUnuevo_desktop.html": "/Templates/creacionCuen/datosUnuevo.html"
    };

    const CANONICAL_ROUTES = {
        get "dashboard"() { return isDesktopScreen() ? "/Templates_Pantalla_Ancha/dashboard_desktop.html" : "/Templates/dashboard.html"; },
        get "calendario"() { return isDesktopScreen() ? "/Templates_Pantalla_Ancha/calendario_renov_desktop.html" : "/Templates/calendario_renov.html"; },
        get "plan_entreno"() { return isDesktopScreen() ? "/Templates_Pantalla_Ancha/plan_entreno_desktop.html" : "/Templates/plan_entreno.html"; },
        get "plan_alimentacion"() { return isDesktopScreen() ? "/Templates_Pantalla_Ancha/plan_alimentacion_desktop.html" : "/Templates/plan_alimentacion.html"; },
        get "chatbot"() { return isDesktopScreen() ? "/Templates_Pantalla_Ancha/chatbot_desktop.html" : "/Templates/chatbot.html"; },
        get "config"() { return isDesktopScreen() ? "/Templates_Pantalla_Ancha/config_desktop.html" : "/Templates/config.html"; },
        get "login"() { return isDesktopScreen() ? "/Templates_Pantalla_Ancha/creacionCuen_desktop/loginGoogle_desktop.html" : "/Templates/creacionCuen/loginGoogle.html"; },
        get "registro"() { return isDesktopScreen() ? "/Templates_Pantalla_Ancha/creacionCuen_desktop/datosUnuevo_desktop.html" : "/Templates/creacionCuen/datosUnuevo.html"; },
        "inicio": "/indice_renovado.html",
        "gateway": "/index.html"
    };

    // Diccionario de normalización para rutas antiguas o desactualizadas
    const LEGACY_MAP = {
        "/Templates/templates_nuevas/dashboard.html": "/Templates/dashboard.html",
        "/Templates/templates_nuevas/calendario_renov.html": "/Templates/calendario_renov.html",
        "/Templates/templates_nuevas/plan_entreno.html": "/Templates/plan_entreno.html",
        "/Templates/templates_nuevas/plan_alimentacion.html": "/Templates/plan_alimentacion.html",
        "/Templates/templates_nuevas/chatbot.html": "/Templates/chatbot.html",
        "/Templates/templates_nuevas/config.html": "/Templates/config.html",
        "/Templates/templates_nuevas/creacionCuen/loginGoogle.html": "/Templates/creacionCuen/loginGoogle.html",
        "/Templates/templates_nuevas/creacionCuen/datosUnuevo.html": "/Templates/creacionCuen/datosUnuevo.html",
        "/Templates/Inicio/Dashboard.html": "/Templates/dashboard.html",
        "/Templates/Inicio/calendario.html": "/Templates/calendario_renov.html",
        "/Templates/Inicio/inicio_indice.html": "/indice_renovado.html",
        "/Templates/Creacion_cuenta/login_google.html": "/Templates/creacionCuen/loginGoogle.html",
        "/Templates/Creacion_cuenta/Edad.html": "/Templates/creacionCuen/datosUnuevo.html"
    };

    function findMapMatch(map, path) {
        if (!path) return null;
        if (map[path]) return map[path];
        const lower = path.toLowerCase();
        for (const key in map) {
            if (key.toLowerCase() === lower) return map[key];
        }
        return null;
    }

    function normalizeUrl(urlStr) {
        try {
            const url = new URL(urlStr, window.location.origin);
            let pathname = url.pathname;

            // 1. Resolver alias legacy
            const legacyTarget = findMapMatch(LEGACY_MAP, pathname);
            if (legacyTarget) {
                pathname = legacyTarget;
            }

            // 2. Normalización responsiva si no se fuerza la vista con ?view=
            if (!url.searchParams.has('view')) {
                if (isDesktopScreen()) {
                    const dTarget = findMapMatch(DESKTOP_MAP, pathname);
                    if (dTarget) pathname = dTarget;
                } else {
                    const mTarget = findMapMatch(MOBILE_MAP, pathname);
                    if (mTarget) pathname = mTarget;
                }
            }

            url.pathname = pathname;
            return url.toString();
        } catch {
            return urlStr;
        }
    }

    // ── 2. PREFETCH & PRERENDER INTELIGENTE ──
    const prefetchCache = new Set();

    function prefetchUrl(url) {
        if (!url || prefetchCache.has(url) || url === window.location.href) return;
        try {
            const normalized = normalizeUrl(url);
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = normalized;
            document.head.appendChild(link);
            prefetchCache.add(url);
            prefetchCache.add(normalized);
        } catch { }
    }

    function prerenderUrl(url) {
        if (!url) return;
        const key = url + '_prerender';
        if (prefetchCache.has(key)) return;
        try {
            const normalized = normalizeUrl(url);
            const link = document.createElement('link');
            link.rel = 'prerender';
            link.href = normalized;
            document.head.appendChild(link);
            prefetchCache.add(key);
        } catch { }
    }

    function setupAutoPrefetch() {
        const selector = [
            '.bottom-nav a',
            '.desktop-sidebar a',
            '.nav-item',
            'a.footer-btn',
            '.navbar-actions a',
            'a.header-btn',
            'a[data-spa]',
            '.quick-pill'
        ].join(', ');

        const navLinks = document.querySelectorAll(selector);

        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

            prefetchUrl(link.href);

            link.addEventListener('pointerenter', () => prerenderUrl(link.href), { passive: true, once: true });
            link.addEventListener('touchstart', () => prerenderUrl(link.href), { passive: true, once: true });
        });
    }

    // ── 3. INTERCEPTOR DE NAVEGACIÓN Y CORRECCIÓN DE RUTAS ──
    function setupNavigationInterceptor() {
        document.addEventListener('click', (e) => {
            const anchor = e.target.closest('a');
            if (!anchor) return;

            const href = anchor.getAttribute('href');
            if (!href) return;

            if (
                anchor.target === '_blank' ||
                anchor.hasAttribute('download') ||
                href.startsWith('#') ||
                href.startsWith('mailto:') ||
                href.startsWith('tel:') ||
                href.startsWith('javascript:')
            ) {
                return;
            }

            let targetUrl;
            try {
                targetUrl = new URL(anchor.href, window.location.origin);
                if (targetUrl.origin !== window.location.origin) return;
            } catch {
                return;
            }

            // Normalizar si apunta a una plantilla del ecosistema opuesto o legacy
            const normalized = normalizeUrl(anchor.href);
            if (normalized !== anchor.href) {
                e.preventDefault();
                window.location.href = normalized;
                return;
            }

            // Si es la misma página actual, no recargar
            if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search) {
                return;
            }
        }, { capture: true });
    }

    // ── 4. NAVEGACIÓN PROGRAMÁTICA ──
    function navigate(destination) {
        let finalUrl = destination;
        if (CANONICAL_ROUTES[destination]) {
            finalUrl = CANONICAL_ROUTES[destination];
        } else {
            finalUrl = normalizeUrl(destination);
        }
        window.location.href = finalUrl;
    }

    // Stubs seguros para compatibilidad sin animaciones del router
    function showLoader() {}
    function hideLoader() {}

    // ── 5. DETECCIÓN DINÁMICA DE CAMBIO DE DIMENSIONES (DESKTOP <-> MÓVIL) ──
    let lastKnownIsDesktop = isDesktopScreen();
    let resizeDebounceTimer = null;

    function checkResponsiveRedirect() {
        try {
            const params = new URLSearchParams(window.location.search);
            // Respetar forzado explícito de vista ?view=desktop o ?view=mobile
            if (params.has('view')) return;

            const isDesk = isDesktopScreen();
            const currentPath = window.location.pathname;

            if (isDesk) {
                const targetPath = findMapMatch(DESKTOP_MAP, currentPath);
                if (targetPath && targetPath !== currentPath) {
                    const target = targetPath + window.location.search + window.location.hash;
                    window.location.replace(target);
                }
            } else {
                const targetPath = findMapMatch(MOBILE_MAP, currentPath);
                if (targetPath && targetPath !== currentPath) {
                    const target = targetPath + window.location.search + window.location.hash;
                    window.location.replace(target);
                }
            }
        } catch (e) { }
    }

    function handleResponsiveDimensionChange() {
        const currentIsDesktop = isDesktopScreen();
        // Solo redirigir cuando efectivamente se cruza el umbral (breakpoint de 1024px)
        if (currentIsDesktop !== lastKnownIsDesktop) {
            lastKnownIsDesktop = currentIsDesktop;
            try {
                localStorage.setItem("trainer_screen_mode", currentIsDesktop ? "desktop" : "mobile");
            } catch (e) { }
            checkResponsiveRedirect();
        }
    }

    function setupResponsiveDimensionListener() {
        // A. Escuchador de Media Query instantáneo al cruzar 1024px
        try {
            if (window.matchMedia) {
                const mql = window.matchMedia("(min-width: 1024px)");
                const mqlHandler = () => {
                    handleResponsiveDimensionChange();
                };
                if (mql.addEventListener) {
                    mql.addEventListener("change", mqlHandler);
                } else if (mql.addListener) {
                    mql.addListener(mqlHandler);
                }
            }
        } catch (e) { }

        // B. Escuchador de Resize con debounce (cubre cambios interactivos de ventana)
        window.addEventListener("resize", () => {
            clearTimeout(resizeDebounceTimer);
            resizeDebounceTimer = setTimeout(() => {
                handleResponsiveDimensionChange();
            }, 120);
        }, { passive: true });

        // C. Escuchador de Orientación para tablets y móviles
        window.addEventListener("orientationchange", () => {
            setTimeout(handleResponsiveDimensionChange, 150);
        }, { passive: true });
    }

    // ── 6. INICIALIZACIÓN ──
    function init() {
        checkResponsiveRedirect();
        setupResponsiveDimensionListener();
        setupAutoPrefetch();
        setupNavigationInterceptor();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    // Exponer API global en window
    window.SPARouter = {
        navigate,
        showLoader,
        hideLoader,
        prefetch: prefetchUrl,
        prerender: prerenderUrl,
        ROUTES: CANONICAL_ROUTES,
        isDesktop: isDesktopScreen,
        checkRedirect: checkResponsiveRedirect
    };

})();
