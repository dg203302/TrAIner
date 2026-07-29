// Injects a shared back-to-top button and behavior
(function(){
    const createButton = () => {
        if (document.getElementById('back-to-top')) return document.getElementById('back-to-top');
        const btn = document.createElement('button');
        btn.id = 'back-to-top';
        btn.className = 'back-to-top';
        btn.setAttribute('aria-label','Volver arriba');
        btn.title = 'Volver arriba';
        btn.innerText = '↑';
        
        // Solid non-transparent background styling
        btn.style.border = '1px solid rgba(255,255,255,0.18)';
        btn.style.background = '#1c1d24';
        btn.style.color = '#fff';
        btn.style.borderRadius = '12px';
        btn.style.outline = 'none';
        btn.style.padding = '0';
        btn.style.boxSizing = 'border-box';
        btn.style.boxShadow = '0 8px 24px rgba(0,0,0,0.6)';
        btn.style.transition = 'opacity 0.2s, transform 0.2s, background-color 0.2s';
        
        // Hover effects in JS to bypass CSS caching
        btn.addEventListener('mouseenter', () => {
            btn.style.backgroundColor = '#262933';
            btn.style.transform = 'translateY(-3px)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.backgroundColor = '#1c1d24';
            btn.style.transform = 'translateY(0)';
        });
        
        document.body.appendChild(btn);
        return btn;
    };

    const init = () => {
        const btn = createButton();
        if(!btn) return;
        btn.addEventListener('click', ()=> window.scrollTo({top:0, behavior:'smooth'}));
        const onScroll = () => {
            btn.style.opacity = window.scrollY > 100 ? '1' : '0';
        };
        window.addEventListener('scroll', onScroll, {passive:true});
        onScroll();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, {once:true});
    } else {
        init();
    }
})();
