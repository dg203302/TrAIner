import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.94.1/+esm";

const supabaseUrl = "https://lhecmoeilmhzgxpcetto.supabase.co";
const supabaseKey = "sb_publishable_oLC8LcDLa3jR72Hpd_jJsA_eXjMlP3-";
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: localStorage
    }
});

function isDesktopScreen() {
    return (window.matchMedia && window.matchMedia("(min-width: 1024px)").matches) || window.innerWidth >= 1024;
}

function tLang(es, en) {
    const isEn = window.UIIdioma && typeof window.UIIdioma.getIdioma === "function" && window.UIIdioma.getIdioma() === "en";
    return isEn ? en : es;
}

function setVerificationStatus(title, desc) {
    const titleEl = document.getElementById("status-title");
    const descEl = document.getElementById("status-desc");
    if (titleEl && title) titleEl.textContent = title;
    if (descEl && desc) descEl.textContent = desc;
}

function showFallbackActions(errorMessage) {
    const fallbackBox = document.getElementById("fallback-action-wrap");
    if (fallbackBox) {
        fallbackBox.classList.add("is-visible");
    }
    if (errorMessage) {
        setVerificationStatus(tLang("Aviso de conexión", "Connection note"), errorMessage);
    }
}

async function verificarUsuario() {
    // Si la verificación tarda más de 5 segundos, mostrar acciones de contingencia
    const slowTimeout = setTimeout(() => {
        showFallbackActions(tLang("La conexión está tardando más de lo habitual.", "Connection is taking longer than usual."));
    }, 5000);

    try {
        setVerificationStatus(
            tLang("Verificando sesión...", "Verifying session..."),
            tLang("Comprobando tus credenciales de acceso...", "Checking your credentials...")
        );

        // 1. Obtener la sesión activa
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        let user = sessionData?.session?.user;

        // Respaldo de verificación directa con getUser
        if (!user) {
            const { data: userData } = await supabase.auth.getUser();
            user = userData?.user;
        }

        if (user) {
            setVerificationStatus(
                tLang("Sincronizando perfil...", "Syncing profile..."),
                tLang("Recuperando tus datos fitness...", "Retrieving your fitness metrics...")
            );

            // 2. Consultar Datos Fitness con .limit(1)
            const { data: fitData, error: fitErr } = await supabase
                .from("Datos Fitness")
                .select("*")
                .eq("ID_user", user.id)
                .limit(1);

            const datos = fitData ?? [];

            if (fitErr) {
                console.warn("Aviso al consultar Datos Fitness:", fitErr.message);
            }

            const desktopMode = isDesktopScreen();
            localStorage.setItem("trainer_screen_mode", desktopMode ? "desktop" : "mobile");

            // Si es un usuario nuevo sin datos fitness registrados -> a la nueva pantalla de registro
            if (datos.length === 0) {
                clearTimeout(slowTimeout);
                sessionStorage.clear();
                localStorage.setItem("username_usuario", user.user_metadata?.full_name ?? "Usuario");
                localStorage.setItem("avatar_usuario", user.user_metadata?.avatar_url ?? "/Assets/Imagenes/Avatares/avatar_default.png");
                localStorage.setItem("id_usuario", user.id);

                setVerificationStatus(
                    tLang("¡Bienvenido!", "Welcome!"),
                    tLang("Comencemos configurando tu perfil...", "Let's configure your profile...")
                );

                if (desktopMode) {
                    window.location.href = "/Templates_Pantalla_Ancha/creacionCuen_desktop/datosUnuevo_desktop.html";
                } else {
                    window.location.href = "/Templates/creacionCuen/datosUnuevo.html";
                }
                return;
            }

            // Usuario con datos fitness registrados -> Guardar perfil en localStorage
            sessionStorage.clear();
            localStorage.setItem("username_usuario", user.user_metadata?.full_name ?? "Usuario");
            localStorage.setItem("avatar_usuario", user.user_metadata?.avatar_url ?? "/Assets/Imagenes/Avatares/avatar_default.png");
            localStorage.setItem("id_usuario", user.id);
            localStorage.setItem("altura_usuario", datos[0].Altura);
            localStorage.setItem("edad_usuario", datos[0].Edad);
            localStorage.setItem("peso_usuario", datos[0].Peso);
            localStorage.setItem("peso_objetivo_usuario", datos[0].Peso_Obj);

            setVerificationStatus(
                tLang("Cargando tus planes...", "Loading your plans..."),
                tLang("Preparando rutinas y nutrición...", "Preparing workouts and nutrition...")
            );

            // 3. Consultar Planes con .limit(1)
            const { data: planData } = await supabase
                .from("Planes")
                .select("Plan_entreno, Plan_alimenta, Dias_entrenados")
                .eq("ID_user", user.id)
                .limit(1);

            if (planData && planData.length > 0) {
                const pEntreno = planData[0]?.Plan_entreno ?? "Ninguno";
                const pAlimenta = planData[0]?.Plan_alimenta ?? "Proximamente";
                const pDias = planData[0]?.Dias_entrenados ?? [];
                localStorage.setItem("plan_entreno_usuario", typeof pEntreno === "object" ? JSON.stringify(pEntreno) : pEntreno);
                localStorage.setItem("plan_dieta_usuario", typeof pAlimenta === "object" ? JSON.stringify(pAlimenta) : pAlimenta);
                if (pDias) {
                    localStorage.setItem("Dias_cale", typeof pDias === "string" ? pDias : JSON.stringify(pDias));
                }
            } else {
                localStorage.setItem("plan_entreno_usuario", "Ninguno");
                localStorage.setItem("plan_dieta_usuario", "Proximamente");
            }

            clearTimeout(slowTimeout);
            setVerificationStatus(
                tLang("¡Todo listo!", "All set!"),
                tLang("Ingresando a tu panel de entrenamiento...", "Entering your workout dashboard...")
            );

            // Redirigir al Dashboard según el formato de pantalla detectado
            if (desktopMode) {
                window.location.href = "/Templates_Pantalla_Ancha/dashboard_desktop.html";
            } else {
                window.location.href = "/Templates/dashboard.html";
            }
            return;

        } else {
            // Usuario sin sesión -> Redirigir a la landing page renovada
            clearTimeout(slowTimeout);
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = "/indice_renovado.html";
            return;
        }

    } catch (err) {
        clearTimeout(slowTimeout);
        console.error("Error inesperado en verificación:", err);
        showFallbackActions(tLang("No se pudo completar la verificación automática.", "Could not complete automatic verification."));
    }
}

// Inicialización segura contra ciclo de vida de DOM
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", verificarUsuario, { once: true });
} else {
    verificarUsuario();
}