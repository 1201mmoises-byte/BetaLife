# BetaLife — Diseño: Vertical Slice "Pueblo Vivo"

> Documento maestro de diseño de la fase de prototipo. Define la dirección del
> vertical slice 3D **antes** de programar. El motor (`src/engine/**`) NO se toca:
> es la joya y se reutiliza tal cual. Aquí se fija qué se construye encima y cómo.
>
> **Estado:** Fase 0 (diseño en papel). La parte de la **Hada está cerrada**
> (vocabulario, límites y negativas definidos). El resto del diseño está aprobado.
> Cero código hasta decidir por dónde empezar la Fase 1.

## Contexto

BetaLife tiene un motor de simulación sólido (almas, 14 ejes, rasgos emergentes,
conversaciones silenciosas, rareza, dificultad de pueblo, Hada mediadora) pero
sólo un preview de dev que muestra números. El objetivo de esta fase NO es
programar todavía: es fijar la dirección para un **vertical slice 3D** que provoque
"estas personas tienen vidas propias — quiero jugar esto".

Decisión clave de alcance: **el slice NO incluye combate ni entrar a la Torre**
(faltan stats; no hay nada que probar ahí aún). El slice es un **pueblo vivo que
observas**: prueba el pilar central sin necesitar ningún sistema inexistente.

---

## DECISIONES FIJADAS

1. **Terminología:** Hero (no NPC), Fairy/Hada (no Entity).
2. **Fantasía:** el jugador es una presencia superior que *moldea el entorno y observa*
   una comunidad viva. No es héroe, no es titiritero. Los héroes son autónomos.
3. **Tiempo: mundo vivo en tiempo real.** Motor por ticks → reloj; render continuo.
4. **Offline: el mundo NO para.** Si el dios se desconecta, los héroes siguen su rol y
   desarrollándose (descansar, practicar, hablar). Prototipo: catch-up determinista al
   volver (simular ticks transcurridos). Motor real: posible server-side.
5. **La Hada es la membrana única jugador↔héroes.** Todo lo que el jugador comunica a la
   gente pasa por ella. Conocimiento limitado ("no puedo ver eso"). Comandos pre-hechos,
   NO chat libre. Rol dual: interpreta la simulación para el jugador (jamás números/ejes)
   y guía a los héroes (mentora, no titiritera). Vive junto al Shrine.
6. **Prioridades = la Hada difunde el enfoque.** El jugador le dice el foco de la comunidad;
   ella lo transmite como guía; los héroes lo siguen o no según sus ejes. Palanca principal.
7. **Entrenamiento autónomo/ambiente.** Los héroes entrenan porque *son* disciplinados,
   no por orden. Camino de crecimiento principal. NO es 100% seguro: puede haber **muerte
   por sobre-agotamiento o mal uso** (rara, accidental). Y tiene **techo**: las habilidades
   muy poderosas NO se aprenden ahí — esas exigen arriesgar la vida al máximo (Arena/combate).
   En el slice es sólo el espacio observable; estas mecánicas llegan con la capa de stats+fatiga.
8. **Economía sin atajos:** primario = vivir + entrenar + sobrevivir; invocar = recursos
   escasos, produce héroes sin desarrollar; Merger = pierdes un desarrollado por boost leve.
9. **Merger = "el costo es la pérdida".** Valor escala con el desarrollo del sacrificado,
   transferido *a pérdida* → mata granjas y crecimiento explosivo solo. **Única orden
   irrechazable** = palanca de autoridad. **Versión simbólica en el slice:** el acto, la
   irrechazabilidad y la *reacción social* observable de los héroes (leal acepta, rebelde
   resiente, temeroso obedece). Número = placeholder hasta que exista la capa de stats.
10. **Tecnología del prototipo: Three.js isométrico 3D en HTML.** El motor TypeScript NO se
    toca (sólo se renderiza encima). Migración a engine nativo se evalúa *tras* validar el slice.
11. **Estructuras del slice = las 5 simples:** Torre (ancla visual/narrativa, NO enterable),
    Shrine (Hada + invocación), Posada (viven/descansan/socializan/conversan), Campo de
    Entrenamiento (crecimiento observable), Cámara de Fusión (Merger simbólico).
    **Expansión de estructuras (viviendas, biblioteca, cocina, arena) → diferida al motor real.**

---

## PLAN DE DISEÑO

### El momento que todo persigue
Cada sistema construye hacia **"no quiero que este héroe muera"**. Ahí la muerte permanente
deja de ser castigo y se vuelve narrativa. Diseñar hacia atrás desde ese momento.

### Modelo de control (dos dominios)
- **El mundo (directo):** el jugador moldea el asentamiento — construye, invoca en el Shrine.
- **La comunidad (mediado por la Hada — único canal):** definir foco → la Hada lo difunde;
  preguntar por un héroe / la situación → la Hada interpreta; pedir guía para un individuo →
  él acepta o rechaza; **Merger** → se transmite, NO se rechaza (única excepción).

### La economía como motor emocional
No puedes comprar poder (invocar es caro y débil) ni farmearlo (Merger a pérdida). El único
camino real es la *vida vivida* de los héroes. El pilar "que parezcan vivos" hecho regla económica.

---

## PLAN UX/UI

- **La Hada ES el HUD.** Toda la información y casi toda la acción pasan por ella. Nada de
  paneles de stats. Primero imágenes, luego palabras de la Hada, números casi nunca.
- **La cámara es el control primario:** vista elevada isométrica; el jugador navega observando.
- **Comandos de la Hada:** ver sección **VOCABULARIO DE LA HADA** (cerrada). Reutiliza
  `situationBrief` / `consultNPC` / `explainRule` / `readBehavior`.
- **Legibilidad del mundo vivo:** la Hada dirige la atención ("mira, esos dos…"). Eventos
  importantes se elevan; el resto vive de fondo.
- **Sensación de observar (lo más importante):** micro-comportamientos visibles; variación
  individual en la animación (un cauto pausa, un impulsivo cambia de dirección); consecuencias
  visibles. Reutiliza `firstImpression` / `readBehavior` para derivar conducta sin exponer ejes.

---

## PLAN TÉCNICO

- **No tocar:** motor determinista (`src/engine/**`). Es la joya; se reutiliza tal cual.
- **Nuevo (render):** capa Three.js isométrica que dibuja el pueblo y los héroes leyendo el
  estado del motor. Tiempo real = avanzar ticks del motor contra reloj; offline = catch-up al volver.
- **Nuevo (Hada UI):** capa de comandos que llama a funciones existentes del `mediator.ts` +
  nuevas para "definir foco" y "ordenar Merger" (simbólica en el slice).
- **Reutilizar:** patrón de `previewSim.ts` (simulación compartida determinista) como base del estado.
- **Pendiente de capa RPG** (ver `RPG-DEV-HANDOFF.md`): stats / `level` / `starProgressionMultiplier`
  para el número real del Merger y para hacer la Torre enterable. Fuera del slice.

---

## VOCABULARIO DE LA HADA (Fase 0 — CERRADO)

Comandos pre-hechos: NO hay chat libre. El jugador elige de un menú de comandos;
la Hada puede responder "no puedo ver eso" si el estado no es observable.
Reutilizan funciones existentes: `situationBrief` / `consultNPC` / `explainRule` / `readBehavior`.

### A — Lectura (observar)
| Comando | Lo que dispara |
|---|---|
| "¿Qué está pasando?" | `situationBrief` — panorama del grupo, eventos recientes |
| "¿Cómo está [héroe]?" | `consultNPC` — lectura observable del individuo (sin números) |
| "¿Qué hay entre [A] y [B]?" | relación observable entre dos héroes (tensión, amistad, nada) |
| "¿Cómo va el grupo?" | estado general de ánimo colectivo; la Hada elige qué destacar |

### B — Explicar (reglas del mundo)
| Comando | Lo que dispara |
|---|---|
| "Explícame [regla]" | `explainRule` — crecimiento, muerte, invocación, Merger, etc. |

### C — Influencia (guiar, no ordenar)
**"Enfoca" — dos variantes:**
- **Comunidad:** "Enfoca a la comunidad en [entrenamiento / descanso / socializar / supervivencia]"
  → la Hada difunde el foco; los héroes lo siguen o no según sus ejes. Palanca principal de dirección colectiva.
- **Individual:** "Enfoca a [héroe] hacia [lugar / actividad]"
  → la Hada le transmite el foco solo a ese héroe. El héroe acepta o ignora según sus ejes.
  Un solo foco activo por héroe; un foco nuevo reemplaza al anterior.

**"Guía a [héroe]":**
- La Hada le ofrece consejo personalizado según el estado actual del héroe.
- **Uso ideal:** héroe en bajo ánimo, desesperado, bloqueado, o en conflicto.
- **Restricciones de diseño (definidas):**
  - Cooldown por héroe: **2 días reales** entre guías al mismo individuo.
  - No puede dar el **mismo consejo dos veces** a la misma persona. Si no tiene nada nuevo que decir, lo admite.
  - La Hada puede rechazar si no ve bien al héroe: "No puedo leerle bien ahora."
- El héroe escucha o no (autónomo). La Hada no garantiza resultados.

### D — Autoridad (irrechazable)
| Comando | Comportamiento |
|---|---|
| "Merger: fusiona [A] en [B]" | Única orden que NUNCA se rechaza. [A] se pierde; [B] recibe boost leve. La comunidad reacciona de forma observable (leal acepta, rebelde resiente, temeroso obedece). |

### E — Mundo (acciones directas del jugador)
| Comando | Lo que dispara |
|---|---|
| "Invoca" | Ritual en el Shrine. Cuesta recurso escaso. Produce héroe sin desarrollar. |

### Lo que la Hada NO sabe (respuestas de límite)
- Qué hay dentro de la Torre.
- El futuro de cualquier héroe.
- Por qué un héroe tomó una decisión (solo ve comportamiento, no el alma).
- Qué siente exactamente un héroe (puede inferir, no leer mente).
- "No puedo ver eso" es una respuesta válida y frecuente.

### Comandos pendientes (se añadirán según haga falta)
- El jugador irá identificando comandos adicionales en sesiones posteriores.

---

## VERTICAL SLICE — ALCANCE

### Incluir (lo que prueba "tienen vidas propias")
- Asentamiento isométrico 3D, todo en una escena, vista elevada.
- **Torre dominante como ancla visual y misterio — NO enterable, sin combate.**
- 4 héroes viviendo en tiempo real autónomamente: descansan, entrenan, conversan; variación individual.
- El mundo continúa offline (catch-up al volver).
- La Hada: observación (dirige atención) + comandos + difusión de foco.
- Invocación en el Shrine con coste de recurso (ritual).
- Merger **simbólico**: acto irrechazable + reacción social observable; boost placeholder.
- **Muerte humana emergente RARA** (hambre/desesperación/asesinato), leyendo condiciones de alma
  existentes + ancla de voluntad de vivir. Rara por diseño; cuando ocurre, devasta.

### NO incluir (diferido)
- Entrar a la Torre / expediciones / pisos (faltan stats).
- Combate y **PvP / Arena** (sistema posterior — ver sección dedicada abajo).
- Capa RPG de stats/level; números reales del Merger.
- Expansión de estructuras (viene con el motor real).

### Métricas de éxito (~la primera mirada)
1. El jugador, en 30 segundos, piensa "estas personas tienen vidas propias".
2. Le pregunta algo a la Hada por voluntad propia.
3. Mira la Torre y quiere saber qué hay arriba.
4. Si hace un Merger, siente el peso de la autoridad y ve la reacción de los héroes.

---

## LA MUERTE ES HUMANA (filosofía central — definido)

"Es una vida. Humanos." La muerte es **emergente y omnipresente**, por causas humanas, no sólo
en combate. Todas las zonas la permiten:
- Accidente (sobre-agotamiento / mal uso en el Campo).
- **Hambre / inanición** (conecta con comer y descansar).
- **Desesperación → suicidio** (emerge de `optimism`+`confidence` muy bajos — ya es la condición de miedo).
- **Asesinato entre héroes** (emerge de `forgiveness`+`trust`+`warmth` muy bajos — ya es `checkConflict`).
- Combate / Torre (posterior).

Clave de diseño: estas muertes NO son sistemas arbitrarios — son la consecuencia *extrema* de
estados del alma que el motor **ya rastrea** (ejes + condiciones). Le dan gravedad real a la
mentoría de la Hada: intenta mantener entera a la gente; el jugador puede pedirle que intervenga;
el héroe decide. Es el pilar "tienen vidas propias" en su forma más pura.

**En el slice: real pero RARA.** La muerte humana emergente PUEDE ocurrir en la demo, pero su
probabilidad es baja — y la rareza no es un tope arbitrario, es **la historia hecha mecánica**:
los héroes *recuerdan por qué están vivos* (mundo perdido, segunda oportunidad), y esa **voluntad
de vivir** (ancla derivada de su origen/historia) resiste la desesperación y la violencia. Cuando
la muerte sí llega, devasta — precisamente por ser rara.

Implementación del slice: capa de **muerte emergente (rara)** que lee condiciones de alma que el
motor YA tiene (`checkConflict`, la condición de desesperación) + un mínimo de hambre/descanso +
el ancla de voluntad de vivir. NO requiere la capa completa de stats (esa es para Torre/combate).

---

## NORTE NARRATIVO (✓ ahora BASE del motor)

Cada semilla es un mundo con su propia historia. Los héroes tuvieron **vidas completas**
(obreros, leñadores, cocineros — no sólo guerreros). Ese mundo *terminó* por alguna catástrofe,
y la **Torre repara esos errores poco a poco**: cada piso es un fragmento de cómo su mundo
padeció — invasión de monstruos, guerras entre países, una ruina que oculta algo. El misterio
("¿por qué cayó su mundo?") es el motor de querer subir.

**Implementado en el motor (determinista):**
- **Cada semilla = un mundo único** con su catástrofe (`src/engine/world.ts`: grieta,
  guerra, ruina, plaga del olvido, marea, sol muerto) + `beats` (la verdad que la Torre
  revelará). `Town.world` lo comparten todos los héroes del pueblo.
- **Las estrellas codifican la conexión con el fin del mundo:** 5★ en el núcleo de la
  catástrofe · 4★ secundarios · 3★ periféricos · 1-2★ *fillers* (gente común, casi sin
  pericia de batalla — por eso los de baja estrella saben poco de combate).
- **Olvido + sueños:** al llegar al pueblo OLVIDAN su mundo (de ahí el misterio), pero
  algunos sueños afloran fragmentos (`src/engine/dreams.ts`). Los fillers sueñan su vida
  civil; los de núcleo, lo más central y ominoso.
- **Pasado civil** (`pastLife`: oficio + lugar) por arquetipo → "vidas propias".

La **dificultad de semilla** (ya existente) alimentará el RPG de pisos (monstruos, nivel,
terreno, acertijos, soporte aliado) cuando se construya la generación de pisos. Conclusión
de diseño: **la historia de cada persona da valor a conocer tu propio mundo.**

---

## EJE RIESGO / RECOMPENSA (definido — mecánicas con la capa de stats+fatiga)

Columna del juego: **el poder real cuesta riesgo real.** Sin atajos.

- **Campo de Entrenamiento** (camino seguro): crecimiento sostenido pero *limitado*; muerte
  rara y accidental (sobre-agotamiento / mal uso). No da las habilidades poderosas.
- **Arena / combate real** (camino arriesgado): donde se ganan las habilidades poderosas,
  arriesgando la vida al máximo.

## ARENA / PvP (definido — NO en el slice)

Distinto del Campo de Entrenamiento (práctica autónoma, techo bajo, en el slice).

- **PvP de verdad siempre significa muerte.** La **Arena** es el edificio que lo hace *seguro*:
  si un héroe caería muerto, en su lugar sufre **fatiga 95%** (severa pero recuperable, no permadeath).
- **Reglas:** máx. **3 combates/día** (anti-abuso). Penalidad por "muerte" en Arena = fatiga 95%.
- **Motivación emergente:** los héroes *quieren* competir por su cuenta — quién es más fuerte,
  quién merece conservar lo mejor, probarse entre sí. No es sólo dirigido por el jugador.
- **Por qué es posterior:** al principio no tienen nada por lo cual probarse. Requiere la capa de
  **stats + habilidades pasivas/activas + equipo** (ver `RPG-DEV-HANDOFF.md`), que aún no existe.
- **Implica "fatiga" como estado real** del héroe (conecta con descansar en la Posada y con el
  desarrollo offline). La fatiga es un sistema a definir junto con la capa de stats.

---

## ROADMAP

- **Fase 0 — Diseño fino (antes de código):** flujo de la primera sesión; vocabulario exacto
  de comandos de la Hada **(CERRADO)**; lenguaje visual de estados de héroes (pendiente).
- **Fase 1 — Vertical Slice "Pueblo Vivo":** render Three.js isométrico; las 5 estructuras;
  4 héroes vivos en tiempo real; Hada (observación + comandos + foco); invocación con coste;
  Merger simbólico; muerte emergente rara (voluntad de vivir); offline continuo. Sin Torre jugable, sin combate.
- **Fase 2 (motor real) — Torre + stats:** capa RPG, Torre enterable, expediciones, Merger real.
- **Fase 3:** habilidades pasivas/activas + equipo + fatiga; **Arena (PvP, muerte→fatiga 95%)**;
  expansión de estructuras; relaciones visibles; lore.
- **Fase 4 — Producción:** evaluar engine nativo; contenido, balance, playtests.

---

## RIESGOS

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Los héroes no se *sienten* vivos pese a la simulación | Crítico | Micro-comportamiento, variación visible, Hada-narradora. Prioridad #1 del slice. |
| Slice sin combate/Torre se percibe "sin juego" | Alto | El proof es "vidas propias" + el misterio de la Torre. Honesto y enfocado; no finge sistemas. |
| Scope creep | Alto | Lista "NO incluir" es vinculante. |
| Tiempo real ilegible | Alto | La Hada dirige la atención; eventos importantes se elevan. |
| Catch-up offline incoherente (saltos raros al volver) | Medio | Simular ticks transcurridos de forma determinista; la Hada resume "lo que pasó mientras no estabas". |
| Three.js subestimado | Medio | Empezar por escena estática legible antes de animación compleja. |

---

## RECOMENDACIONES

1. **La Hada es el sistema más crítico.** Si no suena auténtica, nada más importa. Invertir desproporcionadamente en ella.
2. **No añadir motor — hacerlo visible.** El trabajo es percepción, no más sistemas. Más pantalla, no más simulación.
3. **Los primeros 30 segundos son el juego.** Torre + un héroe cruzando el pueblo + la Hada diciendo algo sobre alguien.
4. **Diseñar Fase 0 en papel** antes de Three.js.

---

## HILOS ABIERTOS

- ~~Vocabulario exacto de comandos de la Hada y qué se niega a responder.~~ **CERRADO** (ver sección arriba).
- Lenguaje visual de estados (cómo se ve un héroe cansado / motivado / asustado).
- Cómo se representa el "foco de comunidad" en pantalla (interfaz del menú de comandos).
- Cómo el jugador elige a quién hacer Merger (selector en la Cámara de Fusión).

## NOTA
Diseño aprobado. Cero código hasta decidir por dónde empezar la Fase 1 (slice Three.js).
