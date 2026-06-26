// Modern Native SPA Routing (Prefetch + Cross-Document View Transitions)
// This gives the instant SPA feel without breaking MPA scripts.

document.addEventListener("DOMContentLoaded", () => {
    // 1. Activar View Transitions Nativas (SPA feel)
    const style = document.createElement('style');
    style.textContent = `
        @view-transition { navigation: auto; }
    `;
    document.head.appendChild(style);

    // 2. Pre-fetching instantáneo (Carga en memoria)
    const prefetchCache = new Set();
    const links = document.querySelectorAll('a.footer-btn');
    
    links.forEach(link => {
        if (!prefetchCache.has(link.href) && link.href !== location.href) {
            const prefetchLink = document.createElement('link');
            prefetchLink.rel = 'prefetch';
            prefetchLink.href = link.href;
            document.head.appendChild(prefetchLink);
            prefetchCache.add(link.href);
        }
    });

    // 3. Pre-render on hover/touch para mayor velocidad
    links.forEach(link => {
        link.addEventListener('pointerenter', () => {
            if (!prefetchCache.has(link.href + '_prerender')) {
                const prerenderLink = document.createElement('link');
                prerenderLink.rel = 'prerender';
                prerenderLink.href = link.href;
                document.head.appendChild(prerenderLink);
                prefetchCache.add(link.href + '_prerender');
            }
        }, { once: true });
    });
});
