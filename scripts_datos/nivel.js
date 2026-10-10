// Clasifica un ejercicio en principiante / intermedio / avanzado por palabras clave (heurística, ajustable a mano en el JSON).
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const AVANZADO = /muscle-up|planche|handstand|pistol|pistola|dragon flag|toes to bar|dedos a la barra|windshield|limpiaparabrisas|(^|[^a-z])l-sit|clap|palmada|archer|arquero|hindu|human flag|front lever|turkish|turco|devil press|thruster|snatch|clean|jerk|box jump|salto al cajon|tuck jump|sissy|glute ham|gluteo-isquio|nordic|v-up|abdominales en v|jackknife|rack pull|pendlay|zercher|sprint|assault|bicicleta de aire|pike|diamante|diamond|cosaca|cossack|shrimp|dominadas escapulares|back lever|bandera humana|chakrasana|flexion de pino|sobre las manos|a un brazo|flexion a una mano|one arm chin|single-arm push-up|rollout de pie|korean|coreanos|arquero/;
const PRINCIPIANTE = /maquina|machine|polea|cable|pec deck|contractora|lever|assisted|asistid|curl|extension de triceps|jalon de triceps|pushdown|elevaciones? laterales|elevaciones? frontales|encogimientos|gemelos|talones|bicicleta estatica|elíptica|eliptica|cinta|caminata|walking|puente de gluteos|elevacion de cadera|clamshell|almeja|donkey|burro|fire hydrant|bird dog|superman|dead bug|bicho muerto|crunch|plancha alta|plancha abdominal|flexiones (inclinadas|de rodillas)|sentadilla con peso corporal|sentadilla goblet|zancada con peso corporal|carrera en el sitio|saltos de tijera|jumping jack|pinza|hand gripper|vacio abdominal|band pull-apart|apertura de banda|rotacion externa|face pull|remo invertido en mesa|remo sentado|remo en polea|jalon|prensa|extension de cuadriceps|curl femoral|aducc|abducc|kickback|patada de|estiramiento|stretch|rodillo de espuma|foam roller|circulos de|balanceo|postura del nino|gato-vaca|esfinge|en pared|basculacion|retraccion|rotacion de (cuello|tronco|pie)|pendulo de hombro/;

module.exports = function nivelDe(nombreEs, nombreEn = "") {
	const t = norm(nombreEs) + " | " + norm(nombreEn);
	if (/asistid|assisted|maquina|machine/.test(t) && !/pistol|pistola/.test(t)) return "principiante";
	if (AVANZADO.test(t)) return "avanzado";
	if (PRINCIPIANTE.test(t)) return "principiante";
	return "intermedio";
};
module.exports.NIVELES = ["principiante", "intermedio", "avanzado"];
