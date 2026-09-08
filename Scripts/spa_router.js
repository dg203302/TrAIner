/**
 * TrAIner - Modern Native SPA Router & Page Transition Engine
 * Integrado con Cross-Document View Transitions, Prefetching inteligente
 * y pantalla de carga Dark Glassmorphism Premium.
 */

(function () {
    'use strict';

    // ── 1. MAPA DE RUTAS CANÓNICAS ──
    const CANONICAL_ROUTES = {
        "dashboard": "/Templates/dashboard.html",
        "calendario": "/Templates/calendario_renov.html",
        "plan_entreno": "/Templates/plan_entreno.html",
        "plan_alimentacion": "/Templates/plan_alimentacion.html",
        "chatbot": "/Templates/chatbot.html",
        "config": "/Templates/config.html",
        "login": "/Templates/creacionCuen/loginGoogle.html",
        "registro": "/Templates/creacionCuen/datosUnuevo.html",
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

    function normalizeUrl(urlStr) {
        try {
            const url = new URL(urlStr, window.location.origin);
            const pathname = url.pathname;
            if (LEGACY_MAP[pathname]) {
                url.pathname = LEGACY_MAP[pathname];
                return url.toString();
            }
            return url.toString();
        } catch {
            return urlStr;
        }
    }

    // ── 2. ESTILOS DE TRANSICIÓN Y PANTALLA DE CARGA ──
    function injectStyles() {
        if (document.getElementById('spa-router-styles')) return;

        const style = document.createElement('style');
        style.id = 'spa-router-styles';
        style.textContent = `
            /* View Transitions Nativas del Navegador (Chrome / Edge / Safari Tech Preview) */
            @view-transition { navigation: auto; }
            
            ::view-transition-old(root) {
                animation: 180ms cubic-bezier(0.16, 1, 0.3, 1) both spaFadeOut;
            }
            ::view-transition-new(root) {
                animation: 240ms cubic-bezier(0.16, 1, 0.3, 1) both spaFadeIn;
            }

            @keyframes spaFadeOut {
                from { opacity: 1; transform: scale(1); }
                to { opacity: 0; transform: scale(0.99); }
            }
            @keyframes spaFadeIn {
                from { opacity: 0; transform: scale(1.01); }
                to { opacity: 1; transform: scale(1); }
            }

            /* Barra de Progreso Superior Neón (Estilo YouTube / Next.js) */
            #spa-top-progress {
                position: fixed;
                top: 0;
                left: 0;
                height: 3px;
                width: 0%;
                background: linear-gradient(90deg, #9df3ff 0%, #8b5cf6 50%, #7cffb8 100%);
                box-shadow: 0 0 14px rgba(157, 243, 255, 0.8), 0 0 28px rgba(139, 92, 246, 0.4);
                z-index: 1000000;
                pointer-events: none;
                opacity: 0;
                transition: width 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease;
            }

            /* Pantalla de Carga Glassmorphic */
            #spa-router-loader {
                position: fixed;
                inset: 0;
                z-index: 999999;
                background: rgba(6, 8, 12, 0.72);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
                transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.22s ease;
            }

            #spa-router-loader.is-active {
                opacity: 1;
                visibility: visible;
                pointer-events: auto;
            }

            .spa-loader-card {
                background: rgba(14, 18, 27, 0.85);
                backdrop-filter: blur(28px);
                -webkit-backdrop-filter: blur(28px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 26px;
                padding: 26px 36px;
                box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7), 0 0 35px rgba(157, 243, 255, 0.08);
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                animation: spaCardPop 0.28s cubic-bezier(0.16, 1, 0.3, 1);
                max-width: 300px;
                width: 85%;
            }

            .spa-loader-spinner {
                position: relative;
                width: 58px;
                height: 58px;
                margin-bottom: 16px;
            }

            .spa-spinner-ring-out {
                position: absolute;
                inset: 0;
                border-radius: 50%;
                border: 2.5px solid rgba(255, 255, 255, 0.08);
                border-top-color: #9df3ff;
                border-right-color: rgba(157, 243, 255, 0.4);
                animation: spaSpin 1s linear infinite;
                box-shadow: 0 0 16px rgba(157, 243, 255, 0.25);
            }

            .spa-spinner-ring-in {
                position: absolute;
                inset: 8px;
                border-radius: 50%;
                border: 2px solid transparent;
                border-bottom-color: #b6a8ff;
                border-left-color: rgba(182, 168, 255, 0.35);
                animation: spaSpinRev 1.4s linear infinite;
            }

            .spa-spinner-core {
                position: absolute;
                top: 50%;
                left: 50%;
                width: 8px;
                height: 8px;
                margin-top: -4px;
                margin-left: -4px;
                border-radius: 50%;
                background: #9df3ff;
                box-shadow: 0 0 12px #9df3ff, 0 0 24px rgba(157, 243, 255, 0.8);
                animation: spaPulse 1.4s ease-in-out infinite alternate;
            }

            .spa-brand-title {
                font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
                font-size: 19px;
                font-weight: 800;
                color: #ffffff;
                letter-spacing: -0.3px;
                margin-bottom: 4px;
            }

            .spa-brand-title span {
                color: #9df3ff;
                text-shadow: 0 0 18px rgba(157, 243, 255, 0.5);
            }

            .spa-loader-text {
                font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
                font-size: 13px;
                font-weight: 600;
                color: #8a99ad;
                letter-spacing: 0.1px;
            }

            @keyframes spaSpin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            @keyframes spaSpinRev {
                0% { transform: rotate(360deg); }
                100% { transform: rotate(0deg); }
            }
            @keyframes spaPulse {
                0% { transform: scale(0.8); opacity: 0.6; }
                100% { transform: scale(1.2); opacity: 1; }
            }
            @keyframes spaCardPop {
                0% { opacity: 0; transform: scale(0.92) translateY(8px); }
                100% { opacity: 1; transform: scale(1) translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }

    // ── 3. DOM DE LA PANTALLA DE CARGA ──
    let progressBarEl = null;
    let loaderOverlayEl = null;
    let loaderTextEl = null;
    let pendingNavTimeout = null;
    let safetyTimeout = null;

    function buildLoaderDOM() {
        if (progressBarEl && loaderOverlayEl) return;

        // Barra superior
        progressBarEl = document.createElement('div');
        progressBarEl.id = 'spa-top-progress';
        document.body.appendChild(progressBarEl);

        // Overlay modal
        loaderOverlayEl = document.createElement('div');
        loaderOverlayEl.id = 'spa-router-loader';
        loaderOverlayEl.setAttribute('aria-hidden', 'true');
        loaderOverlayEl.innerHTML = `
            <div class="spa-loader-card" role="status" aria-live="polite">
                <div class="spa-loader-spinner" aria-hidden="true">
                    <div class="spa-spinner-ring-out"></div>
                    <div class="spa-spinner-ring-in"></div>
                    <div class="spa-spinner-core"></div>
                </div>
                <div class="spa-brand-title">Tr<span>AI</span>ner</div>
                <div class="spa-loader-text" id="spa-loader-msg">Cargando espacio...</div>
            </div>
        `;
        document.body.appendChild(loaderOverlayEl);
        loaderTextEl = document.getElementById('spa-loader-msg');
    }

    function showLoader(customMsg) {
        buildLoaderDOM();

        // 1. Activar barra superior de inmediato (< 10ms)
        if (progressBarEl) {
            progressBarEl.style.opacity = '1';
            progressBarEl.style.width = '35%';
            setTimeout(() => {
                if (progressBarEl) progressBarEl.style.width = '75%';
            }, 100);
        }

        // 2. Si la navegación tarda más de 120ms, desplegar el overlay glassmorphism
        clearTimeout(pendingNavTimeout);
        pendingNavTimeout = setTimeout(() => {
            if (loaderOverlayEl) {
                if (customMsg && loaderTextEl) {
                    loaderTextEl.textContent = customMsg;
                }
                loaderOverlayEl.classList.add('is-active');
            }
        }, 120);

        // 3. Timeout de seguridad (si la navegación se cancela o aborta)
        clearTimeout(safetyTimeout);
        safetyTimeout = setTimeout(() => {
            hideLoader();
        }, 4500);
    }

    function hideLoader() {
        clearTimeout(pendingNavTimeout);
        clearTimeout(safetyTimeout);

        if (progressBarEl) {
            progressBarEl.style.width = '100%';
            setTimeout(() => {
                if (progressBarEl) {
                    progressBarEl.style.opacity = '0';
                    progressBarEl.style.width = '0%';
                }
            }, 180);
        }

        if (loaderOverlayEl) {
            loaderOverlayEl.classList.remove('is-active');
        }
    }

    // ── 4. PREFETCH & PRERENDER INTELIGENTE ──
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
        // Seleccionar todos los enlaces de barras de navegación y accesos clave
        const selector = [
            '.bottom-nav a',
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

            // Prefetch suave al estar inactivo
            prefetchUrl(link.href);

            // Prerender instantáneo al pasar el puntero o tocar
            link.addEventListener('pointerenter', () => prerenderUrl(link.href), { passive: true, once: true });
            link.addEventListener('touchstart', () => prerenderUrl(link.href), { passive: true, once: true });
        });
    }

    // ── 5. INTERCEPTOR DE NAVEGACIÓN Y CORRECCIÓN DE RUTAS ──
    function setupNavigationInterceptor() {
        document.addEventListener('click', (e) => {
            // Buscar si el click fue en un <a> o dentro de un <a>
            const anchor = e.target.closest('a');
            if (!anchor) return;

            const href = anchor.getAttribute('href');
            if (!href) return;

            // Ignorar enlaces externos, anclas locales, descargas o nuevas pestañas
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

            // Validar si pertenece al mismo origen
            let targetUrl;
            try {
                targetUrl = new URL(anchor.href, window.location.origin);
                if (targetUrl.origin !== window.location.origin) return;
            } catch {
                return;
            }

            // Normalizar si apunta a una plantilla antigua
            const normalized = normalizeUrl(anchor.href);
            if (normalized !== anchor.href) {
                e.preventDefault();
                showLoader();
                window.location.href = normalized;
                return;
            }

            // Si es la misma página actual, no recargar
            if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search) {
                return;
            }

            // Activar loader suave
            showLoader();
        }, { capture: true });
    }

    // ── 6. NAVEGACIÓN PROGRAMÁTICA ──
    function navigate(destination, customMsg) {
        let finalUrl = destination;
        if (CANONICAL_ROUTES[destination]) {
            finalUrl = CANONICAL_ROUTES[destination];
        } else {
            finalUrl = normalizeUrl(destination);
        }

        showLoader(customMsg);
        window.location.href = finalUrl;
    }

    // ── 7. INICIALIZACIÓN ──
    function init() {
        injectStyles();
        buildLoaderDOM();
        setupAutoPrefetch();
        setupNavigationInterceptor();

        // Ocultar loader al volver por BFCache (botón atrás/adelante del navegador)
        window.addEventListener('pageshow', (e) => {
            hideLoader();
        });
        window.addEventListener('popstate', () => {
            hideLoader();
        });
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
        ROUTES: CANONICAL_ROUTES
    };

})();
