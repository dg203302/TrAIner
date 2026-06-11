// Gestor de fondo de esferas rojas animadas en Canvas
(() => {
    const BG_KEY = "ui_background";
    const COLOR_KEY = "ui_background_color";
    let bgPref = "video"; // "video" = animado, "static" = negro sólido
    let colorPref = "red";
    try {
        bgPref = localStorage.getItem(BG_KEY) || "video";
        colorPref = localStorage.getItem(COLOR_KEY) || "red";
    } catch {}

    const getColorParams = (color) => {
        switch (color) {
            case "green":
                return {
                    bubbleFill: "rgba(70, 255, 100, ",
                    bubbleStroke: "rgba(120, 255, 140, ",
                    gradient: "linear-gradient(135deg, #024a14 0%, #001704 100%) !important"
                };
            case "blue":
                return {
                    bubbleFill: "rgba(70, 150, 255, ",
                    bubbleStroke: "rgba(120, 190, 255, ",
                    gradient: "linear-gradient(135deg, #02204a 0%, #000917 100%) !important"
                };
            case "red":
            default:
                return {
                    bubbleFill: "rgba(255, 70, 80, ",
                    bubbleStroke: "rgba(255, 120, 120, ",
                    gradient: "linear-gradient(135deg, #4a0205 0%, #170000 100%) !important"
                };
        }
    };

    // Aplicar estilos CSS de inmediato para evitar destellos blancos
    const applyStyles = (pref, color) => {
        let style = document.getElementById("dynamic-bg-style");
        if (!style) {
            style = document.createElement("style");
            style.id = "dynamic-bg-style";
            document.head.appendChild(style);
        }

        const params = getColorParams(color);
        if (pref === "static") {
            style.innerHTML = `
                #canvas-bg { display: none !important; }
                body, html { 
                    background: #000000 !important;
                }
            `;
        } else {
            style.innerHTML = `
                body, html { 
                    background: ${params.gradient};
                }
                #canvas-bg {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: -2;
                    pointer-events: none;
                    display: block !important;
                }
            `;
        }
    };

    applyStyles(bgPref, colorPref);

    let animationFrameId = null;
    let canvas = null;

    const stopAnimation = () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        canvas = document.getElementById("canvas-bg");
        if (canvas) {
            canvas.remove();
        }
    };

    const startAnimation = () => {
        stopAnimation();

        if (!document.body) return; // check de seguridad

        canvas = document.createElement("canvas");
        canvas.id = "canvas-bg";
        // Insertarlo al inicio del body
        document.body.insertBefore(canvas, document.body.firstChild);
        
        const ctx = canvas.getContext('2d');
        let width, height;
        let bubbles = [];
        const isAggressive = window.PT_CANVAS_MODE === "aggressive";
        const BUBBLE_COUNT = isAggressive ? 50 : 35;
        
        function resizeCanvas() {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        }
        
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();
 
        class Bubble {
            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.radius = Math.random() * 90 + 20; 
                
                // Velocidad extremadamente lenta o más activa para la pantalla de carga
                const speedMult = isAggressive ? 1.8 : 0.4;
                this.vx = (Math.random() - 0.5) * speedMult;
                this.vy = (Math.random() - 0.5) * speedMult;
                
                // Efecto Bokeh: algunas burbujas son nítidas, otras difuminadas
                this.isBlurred = Math.random() > 0.4;
                
                // Translucidez base baja típica de iOS
                this.baseOpacity = Math.random() * 0.3 + 0.05; 
                
                // Para hacer que palpiten (fade in/out) lentamente
                const pulseMult = isAggressive ? 0.03 : 0.01;
                this.pulseRate = Math.random() * pulseMult + 0.005;
                this.angle = Math.random() * Math.PI * 2;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.angle += this.pulseRate;

                // Reaparecer fluidamente al otro lado
                if (this.x - this.radius > width) this.x = -this.radius;
                if (this.x + this.radius < 0) this.x = width + this.radius;
                if (this.y - this.radius > height) this.y = -this.radius;
                if (this.y + this.radius < 0) this.y = height + this.radius;
            }

            draw() {
                const currentOpacity = this.baseOpacity + Math.sin(this.angle) * 0.08;
                const safeOpacity = Math.max(0, currentOpacity);
                const activeColor = window.PT_CanvasBg_Color || colorPref;
                const params = getColorParams(activeColor);

                ctx.beginPath();
                
                if (this.isBlurred) {
                    // Burbuja fuera de foco (difuminada en los bordes)
                    const gradient = ctx.createRadialGradient(this.x, this.y, this.radius * 0.3, this.x, this.y, this.radius);
                    gradient.addColorStop(0, `${params.bubbleFill}${safeOpacity})`);
                    gradient.addColorStop(1, `${params.bubbleFill}0)`);
                    ctx.fillStyle = gradient;
                } else {
                    // Burbuja nítida
                    ctx.fillStyle = `${params.bubbleFill}${safeOpacity})`;
                    ctx.strokeStyle = `${params.bubbleStroke}${safeOpacity * 1.5})`;
                    ctx.lineWidth = 1.5;
                }

                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fill();
                if (!this.isBlurred) ctx.stroke();
            }
        }

        function initBubbles() {
            bubbles = [];
            for (let i = 0; i < BUBBLE_COUNT; i++) {
                bubbles.push(new Bubble());
            }
        }

        function animate() {
            ctx.clearRect(0, 0, width, height);
            ctx.globalCompositeOperation = 'screen';

            bubbles.forEach(bubble => {
                bubble.update();
                bubble.draw();
            });

            animationFrameId = requestAnimationFrame(animate);
        }

        initBubbles();
        animate();
    };

    // API pública para que las opciones del perfil la actualicen en tiempo real
    window.PT_CanvasBg = {
        update: (pref, color) => {
            if (color) colorPref = color;
            window.PT_CanvasBg_Color = colorPref;
            applyStyles(pref, colorPref);
            if (pref === "static") {
                stopAnimation();
            } else {
                startAnimation();
            }
        }
    };

    // Ejecutar cuando el body esté listo
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            if (bgPref !== "static") startAnimation();
        });
    } else {
        if (bgPref !== "static") startAnimation();
    }
})();
