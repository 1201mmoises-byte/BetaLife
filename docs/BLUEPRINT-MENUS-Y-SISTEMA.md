# BetaLife — Blueprint: Sistema, Menús y Vistas

> **Propósito de este documento:** planear la idea completa antes de insertarla al juego.
> El HTML/Three.js es **previz** — sirve para ver y sentir cómo quedará todo antes de
> transcribirlo a Godot. Este blueprint es la fuente de verdad de diseño para esa transcripción.

---

## 1. Filosofía y principios

**Previz, no producto final.** El HTML es una maqueta de alta fidelidad para validar la idea.
Legibilidad de la intención > pulido visual. Cada vista del previz debe mapear limpio a una
escena/nodo de Godot para que el port sea mecánico.

**Fiel a *Pick Me Up! Infinite Gacha*.** El jugador es el Master: invoca, vincula, ordena y manda
equipos a la Torre. La Hada es la asistente (nunca el jugador-personaje). Los héroes tienen alma
real — actúan por su carácter, no como fichas. La muerte es permanente.

**Regla de oro: modelo separado de la vista.**

```
Motor (src/engine + src/runtime + src/save)
  ↓  view-model (snapshot de estado)
Vista (HTML hoy → Godot mañana)
  ↓  intents (invocar, enviar, enfocar…)
Motor
```

Las vistas LEEN estado y emiten intents. Nunca tienen lógica de juego. El mismo motor
determinista (`engine.bundle.js`) alimenta el previz y, más adelante, Godot.

**Moderación.** El previz vale por la claridad de la idea, no por el acabado. Tres líneas de
código claras son mejor que una abstracción prematura.

---

## 2. Modelo de tiempo: doble reloj

Hay un único **reloj de juego** como fuente de verdad. Todo (día/noche, necesidades, charlas,
autoguardado, catch-up offline) lo lee de ahí — nunca de `dt` crudo ni de ticks por frame.

| Contexto | Tasa | Efecto |
|---|---|---|
| **Pueblo (observación)** | **10× tiempo real** | 1 min real = 10 min de vida del héroe |
| **Misión (Torre)** | **1:1 tiempo real** | 1 min real = 1 min de juego; estrategia en tiempo real |

### Por qué dos tasas

En el pueblo el jugador observa: la vida de los héroes pasa mientras miras, sin que tengas que
esperar. En la Torre el jugador asigna estrategia activamente: el tiempo real crea tensión y
da espacio para decisiones.

### Fix del bug "el día no avanza"

**Bug actual:** `DAY_LENGTH = 1200s` (20 min reales); el primer amanecer visible tarda ~16 min.

**Spec del fix:** definir un día de juego como `GAME_DAY_SECONDS` en segundos-héroe (tiempo de
juego). A 10×, un día de juego que dure 6 min-héroe pasa en 36 seg reales — visible y sin
agobio. Exponer la constante como tuneable. El contador "Día N" sube de forma determinista al
cruzar el umbral, independiente del ciclo visual (amanecer/anochecer sincroniza al mismo reloj).

### Fix del bug "hambre/energía se mueven muy rápido"

**Bug actual:** `liveTick` avanza necesidades 5×/seg (cada 0.2 s) con tasas diseñadas para
"muchos ticks" → saciedad cae de 1 a 0 en ~16 s.

**Spec del fix:** las necesidades tickean por **tiempo de juego**, derivado del reloj (pueblo
10×). La cadencia se define en §4 (hambre a 0 en 4–7 días de juego). Nada de cráter en segundos.

---

## 3. Las vistas / menús

Para cada vista: **qué muestra · cómo funciona · intents que emite · nodo Godot equivalente.**

---

### 3.1 Pueblo / Base (HUB de observación)

**Qué muestra:** escena 3D isométrica. Estructuras tocables. Héroes moviéndose en tiempo real
(caminan, entrenan, comen, descansan). Ciclo día/noche. Fogata central, antorchas de noche.
Barra de Salud (HP) flotando sobre cada héroe cuando está en debilidad (<30%). Contador de día.

**Cómo funciona:** reloj 10×. Los héroes actúan por su alma (`pickActivity` según necesidades y
ejes). Las charlas aparecen como burbujas flotantes sobre ellos. Tocar una estructura navega
a la vista correspondiente. Tocar la Hada abre el overlay de conversación.

**Intents que emite:**

| Intent | Descripción |
|---|---|
| `FOCUS_HERO(id)` | El jugador toca un héroe — abre Inspector |
| `OPEN_SHRINE` | Toca el Shrine — abre Invocación |
| `OPEN_TOWER` | Toca la Torre — abre Torre/Expedición |
| `OPEN_INN` | Toca la Posada — contexto de descanso |
| `OPEN_FIELD` | Toca el Campo — contexto de trabajo |
| `OPEN_FAIRY` | Toca la Hada — abre overlay de conversación |
| `OPEN_FORGE` | Toca la Forja — abre Forja/Promoción (futuro) |

**Nodo Godot:** `VillageScene.tscn` — escena principal, Node3D, cámara isométrica.

---

### 3.2 Invocación (Shrine / Altar)

**Qué muestra:** ritual de invocación. Coste de esencia. Rareza posible (1★–5★ hoy; 7★ futuro).
Animación de aparición del héroe. Nombre, oficio civil, primer destello de alma.

**Cómo funciona:** el jugador gasta esencia → `summonInTown(town, index)` → nuevo NPC con la
dificultad del pueblo. La Hada presenta al recién llegado con voz cualitativa (oficio/lore).
Sin repetición de nombres (nameGenerator con ~1.64M combinaciones).

**Intents que emite:**

| Intent | Descripción |
|---|---|
| `SUMMON` | Confirma invocación, gasta esencia |
| `CLOSE_SHRINE` | Vuelve al Pueblo |

**Nodo Godot:** `ShrinePanel.tscn` — Control panel superpuesto a VillageScene.

---

### 3.3 Roster

**Qué muestra:** lista de héroes en el pueblo. Nombre, oficio, rareza (★), Salud (HP barra +
color), estado de ánimo observable (listo / cansado / hambriento). Indicador si está en
expedición activa.

**Cómo funciona:** lectura del estado actual de `liveWorld`. Tocar un héroe → Inspector.
Sin números internos (ejes, hambre/descanso/energía) visibles aquí — solo lo observable.

**Intents que emite:**

| Intent | Descripción |
|---|---|
| `FOCUS_HERO(id)` | Abre Inspector del héroe |
| `CLOSE_ROSTER` | Vuelve al Pueblo |

**Nodo Godot:** `RosterPanel.tscn` — Control panel / lista vertical.

---

### 3.4 Inspector de Héroe *(la ventana a la IA)*

**Qué muestra:** la vista más importante para "ver cómo se desarrolla la IA".

- **Identidad:** nombre, rareza, oficio civil, lugar de origen, sueños.
- **Historia:** recuerdo de la catástrofe (según tier de estrella) — observado, no exacto.
  Sueño reciente si `surfaceDream` tiene uno.
- **Alma:** 14 ejes — **barra doble**: marca del nacimiento vs. valor actual. El jugador ve
  adónde ha ido, no el número. Rasgos emergentes si aparecieron. Skills si se desbloquearon.
- **Growth stamps:** "capítulos sellados" — eventos importantes que movieron un eje (sin
  revelar el valor exacto, solo el evento observable).
- **Salud (HP):** barra de % con bandas de color. Único número visible.
- **Estado observable:** frases de la Hada sobre cómo se le ve (hambre, cansancio, ánimo).
- **Modo Dev (solo panel dev):** valores crudos de los 4 medidores + 14 ejes como números.

**Cómo funciona:** todo se lee del `liveWorld` del héroe. Nada se expone como número al
jugador excepto el HP. El jugador infiere el estado leyendo observaciones y growthstamps.

**Intents que emite:**

| Intent | Descripción |
|---|---|
| `CLOSE_INSPECTOR` | Vuelve al Roster o al Pueblo |
| `OPEN_FAIRY_FOR(id)` | Pregunta a la Hada sobre este héroe |

**Nodo Godot:** `HeroInspector.tscn` — Panel de detalle, puede ser overlay o escena propia.

---

### 3.5 Torre / Expedición

**Qué muestra:** armado de la expedición. Piso objetivo (calculado del héroe más profundo + 1).
Número de equipos que requiere la misión. Equipos en construcción (pestañas). Roster de
voluntarios con disposición (`listo` / `dudoso` / `se niega`).

**Cómo funciona:**

**Formación de equipos:**
- El piso objetivo determina cuántos equipos requiere la misión:
  - Base: 1 equipo.
  - Piso múltiplo de 5: +1 equipo.
  - Piso múltiplo de 10: +1 equipo adicional.
- Cada equipo lleva de **2 a 5 héroes**.
- El jugador (Master) elige libremente quién va en qué equipo desde el roster completo.

**Disposición del alma:**
- `listo` — confianza alta, pasividad baja, optimismo alto → va con ganas.
- `dudoso` — valores intermedios → va, pero con reservas.
- `se niega` — confianza muy baja o pasividad muy alta → **no puede ser forzado**. El alma manda.

**Vista de misión (1:1):** cuando la expedición parte, el tiempo corre a 1:1. El motor resuelve
el combate determinista; la vista lo **reproduce a ritmo** mostrando el avance de cada equipo.
El Master puede asignar órdenes de estrategia de equipo (qué priorizar, cómo reagrupar) en
los puntos de decisión — sin romper el principio de "arquitecto, no controlador": cada héroe
ejecuta según su alma.

**Tipos de misión:**
- `standard` — hoy.
- `asedio / oleadas` — futuro (reservado su sitio en la spec).

**Intents que emite:**

| Intent | Descripción |
|---|---|
| `ADD_TO_TEAM(heroId, teamIdx)` | Suma héroe al equipo activo |
| `REMOVE_FROM_TEAM(heroId, teamIdx)` | Quita héroe del equipo |
| `SET_ACTIVE_TEAM(idx)` | Cambia la pestaña de equipo que se está editando |
| `SEND_EXPEDITION` | Confirma y lanza todos los equipos |
| `ASSIGN_STRATEGY(teamIdx, order)` | Orden de estrategia durante la misión (1:1) |
| `CLOSE_TOWER` | Vuelve al Pueblo |

**Nodo Godot:** `TowerPanel.tscn` (formación) + `MissionView.tscn` (reproducción 1:1).

---

### 3.6 Forja / Promoción *(futuro — reservado)*

**Qué mostrará:** materiales del mundo + héroe seleccionado → subir de rango → desbloquear
skills alineadas con el alma del héroe (las skills emergen de los ejes, no son árboles fijos).
Reemplaza al Merger de sacrificio (que no es fiel a la novela).

**Por qué no ahora:** necesita el sistema de stats completo (`stats.ts`, `equipment.ts`) y los
materiales de la Torre. Se documenta aquí para reservar su sitio en la arquitectura.

**Nodo Godot futuro:** `ForgePanel.tscn`.

---

### 3.7 La Hada (overlay de asistencia)

**Qué muestra:** conversación con burbujas. La Hada ofrece tips, reportes de héroes, guía de
mecánicas. Ramas de intención: saber / pedir / explicar. No es un muro — el jugador puede
ignorarla.

**Cómo funciona:** overlay sobre cualquier vista (no pantalla aparte). La Hada reacciona al
estado del mundo: si un héroe está en debilidad, lo menciona. Si hay un sueño nuevo, lo trae.
Respuestas compuestas en tiempo real (`liveReading`) — sin texto horneado estático. Sin números
en su voz: solo observaciones cualitativas.

**Intents que emite:**

| Intent | Descripción |
|---|---|
| `SELECT_BRANCH(branch)` | El jugador elige rama de conversación |
| `CLOSE_FAIRY` | Cierra el overlay |

**Nodo Godot:** `FairyOverlay.tscn` — CanvasLayer, siempre encima.

---

### 3.8 Dev / Observabilidad *(panel de backstage)*

**Qué muestra:** lo que el jugador normal no ve. Pensado para desarrollo y para que el dueño
pueda "chequear cómo se desarrolla la IA" con datos crudos.

- **Pestaña Charlas:** feed en vivo de las conversaciones entre héroes durante la sesión.
- **Pestaña Stats:** por cada héroe — los 14 ejes como barras (valor al nacer vs. ahora),
  los 4 medidores de supervivencia como números crudos, growth stamps.
- **Pestaña Expedición:** estado de la expedición activa o resultado de la última.

**Nodo Godot:** `DevPanel.tscn` — solo en builds de desarrollo.

---

## 4. Sistema de supervivencia — Cuatro medidores

### Principio de diseño

Los medidores son herramientas de presión de vida, no minijuegos de gestión. El jugador no
ve números de hambre o cansancio — solo comportamiento observable y la Hada. La Salud (HP) es
la única excepción numérica porque es la vida real del héroe.

---

### 4.1 Hambre

- Rango: `100%` → puede bajar a `−30%` (negativo por descuido).
- Por debajo de **30%** → estado de **DEBILIDAD** (observable: animación, postura, la Hada lo nota).
- No mata directamente. Al llegar a **−30%** drena HP a tasa drástica → lleva HP a 0 → muerte.
- **Cadencia:** llega a 0% en **4–7 días de juego** según la resiliencia del héroe.
  - Héroe resiliente (disciplina/constitución altas): 7 días.
  - Héroe frágil: 4 días.
- **Actividad que la afecta:** `eat` la recupera; cualquier actividad la consume (más `fight`/`train`).

---

### 4.2 Descanso

- Rango: `100%` → puede bajar a `−30%`.
- Por debajo de **30%** → **DEBILIDAD**.
- No mata directamente. A **−30%** drena HP a tasa drástica → lleva HP a 0 → muerte.
- **Cadencia:** llega a 0% en **3–5 días de juego** según resiliencia.
- **Actividad que la afecta:** `rest` lo recupera; `fight`/`train` lo consumen más.

---

### 4.3 Energía *(modificador, nunca letal)*

- Rango: `100%` → puede bajar bajo 0% (se permite negativo).
- **No causa muerte ni debilidad.**
- **No drena HP** en ningún nivel.
- Es una combinación de hambre+descanso con peso leve (~40%); la mueven sobre todo
  entrenar, moverse, combatir.
- Otorga estado de **agotamiento** (observable).
- **A ≤ 30%:** Hambre y Descanso se consumen al **doble de velocidad**.
- **A ≤ 0%:** el agotamiento se duplica o triplica según cuán por debajo de 0 esté.

---

### 4.4 Salud (HP) — la vida real del héroe

- Rango: `100%` → `0%` (visible al jugador con bandas de color).
- **La mueve principalmente el daño directo:** cortes, combate. Ese es el factor dominante.
- Los tres medidores la afectan **poco y lento** vía un *factor de condición general*
  (promedio ponderado hambre + descanso + energía con peso leve):
  - Condición buena → HP **regenera lento**.
  - Por cada medidor en debilidad (<30%) → HP **drena lento** (coeficiente pequeño).
  - Este efecto es amortiguado: no oscila, erosiona gradualmente.
  - La Energía no drena HP directamente (solo acelera hambre/descanso y agrava el agotamiento).
- **Hambre ≤ −30% o Descanso ≤ −30%** → drenaje de HP a tasa drástica (ruta de muerte por descuido).
- **MUERTE = HP llega a 0.** Es la única condición de muerte. Muerte permanente (permadeath).
- **Bandas de color (única excepción numérica al jugador):**

| HP % | Color |
|---|---|
| 100–70 | Verde |
| 69–40 | Amarillo |
| 39–10 | Rojo |
| 9–0 | Todo rojo — warning |

---

### 4.5 Resiliencia

- Deriva del alma del héroe: ejes de **disciplina** y **constitución** (o equivalente).
- Define dónde cae cada héroe dentro de los rangos de cadencia:
  - Hambre: 4–7 días de juego.
  - Descanso: 3–5 días de juego.
- El motor ya modula por `discipline` en `needs.ts` → esa es la base de la resiliencia.
- A implementar: conectar constitución/resilencia al rango real de días.

---

### 4.6 Cadencia y el reloj de juego

Los "días" son de juego. A 10× en el pueblo, un día de juego transcurre 10× más rápido que
el tiempo real. El hambre tardando 4–7 días de juego en vaciarse se vuelve legible en la
sesión, sin que caiga en segundos ni tarde horas.

La implementación futura extiende `needs.ts`:
- Permitir negativos (hambre/descanso hasta −30%).
- Estado de debilidad como flag observable.
- Energía como modificador con multiplicadores 2×/3×.
- Conectar `criticalNeed` → drenaje drástico de HP → muerte al llegar HP=0.

---

## 5. Arquitectura portable a Godot

### Capa de modelo (motor)

```
src/engine/     ← lógica pura determinista
src/runtime/    ← mundo vivo, tick, simulación offline
src/save/       ← serialización/restauración compacta
   ↓
npm run bundle → preview/engine.bundle.js (ESM)
```

Este bundle es la **fuente de verdad del juego**. Godot lo re-implementa siguiendo el mismo
modelo de datos, o lo consume directamente via GDExtension/WebAssembly (decisión futura).

### Capa de vista (delgada)

Cada pantalla de §3 es una vista que:
1. Recibe un **view-model** (snapshot del estado relevante para esa vista).
2. Emite **intents** (acciones del jugador, sin lógica de juego).

El motor procesa los intents y devuelve nuevo estado. La vista nunca toma decisiones de juego.

### Contratos por vista (resumen)

| Vista | Datos de entrada clave | Intents de salida clave |
|---|---|---|
| Pueblo | `heroes[]`, `day`, `timeOfDay` | `FOCUS_HERO`, `OPEN_*` |
| Invocación | `town.essence`, `town.difficulty` | `SUMMON` |
| Roster | `heroes[].{name,hp,status}` | `FOCUS_HERO` |
| Inspector | `hero.{axes,needs,stamps,lore}` | `OPEN_FAIRY_FOR` |
| Torre | `heroes[].disposition`, `missionFloor`, `teamsRequired` | `ADD_TO_TEAM`, `SEND_EXPEDITION` |
| Forja (futuro) | `hero.rank`, `materials[]` | `PROMOTE` |
| Hada | `fairy.thread`, `fairy.branches` | `SELECT_BRANCH` |
| Dev | `heroes[].rawAxes`, `heroes[].rawNeeds` | — (solo lectura) |

### Reloj de juego como servicio compartido

Un único objeto `GameClock` con:
- `villageTime` (acumulado en segundos-héroe a 10×).
- `missionTime` (acumulado a 1:1, solo activo durante expedición).
- `day` (= `Math.floor(villageTime / GAME_DAY_SECONDS)`).
- Método `tick(dt, rate)` llamado desde el loop de render.

Todos los sistemas (necesidades, charlas, autoguardado, catch-up offline) leen de `GameClock`,
no de `dt` crudo.

---

## 6. Observabilidad: cómo se ve el desarrollo de la IA

El motor determinista ya produce desarrollo real de los héroes (los ejes se mueven con las
charlas, los growthstamps sellan capítulos). Lo que falta es **hacerlo visible**.

### Inspector de Héroe como ventana a la IA

El Inspector (§3.4) muestra:
- **Ejes al nacer vs. ahora:** barra doble. El jugador ve la trayectoria sin ver el número.
- **Rasgos emergentes:** qué emergió y cuándo (en lenguaje de lore, no "emergent_1 = true").
- **Growth stamps:** "en la primera charla con Kael aprendió a confiar" — el *por qué* del cambio.
- **Skills:** las que aparecieron como consecuencia del alma.
- **Sueños:** el último sueño aflorado por `surfaceDream` (fragmento de memoria de la catástrofe).

### El panel Dev como rayos X

El Dev panel (§3.8) muestra los mismos datos como barras/números crudos para el equipo de
desarrollo. El jugador normal no lo ve.

### Lo que esto responde

El dueño quería "ver cómo se desarrolla la IA correctamente". La respuesta del blueprint:
- El Inspector hace visible **qué cambió, cuánto, y por qué** — en lenguaje del mundo, no
  en variables.
- El Dev muestra los valores crudos para confirmar que el motor está funcionando.
- La IA on-device (Fase 5, `transformers.js` + SmolLM2) es el siguiente nivel — este
  blueprint deja el sitio listo.

---

## 7. Qué NO hacer en esta fase (moderación)

- **No** implementar IA on-device (Fase 5) aún.
- **No** implementar tipos de misión asedio/oleadas — reservado su sitio en §3.5.
- **No** pulido cosmético excesivo en el previz — la idea importa más que el acabado.
- **No** conectar la Forja hasta tener stats/materiales completos.
- **No** tocar el motor determinista en esta ronda (solo el blueprint).

---

## 8. Mapa: previz actual → vistas del blueprint

| Elemento actual en `slice.js` / `slice.template.html` | Vista objetivo (§3) | Estado |
|---|---|---|
| `#app` + Three.js village | 3.1 Pueblo / Base | ✓ funciona; falta reloj doble |
| `#sheet-roster` / `#roster-grid` | 3.3 Roster | ✓ funciona; falta HP barra+color |
| `sheet-hada` / `hada-thread` | 3.7 La Hada | ✓ funciona; lectura sigue horneada parcialmente |
| `#sheet-torre` + formación de equipos | 3.5 Torre / Expedición | ✓ formación; falta vista misión 1:1 |
| `#sheet-merge` (Cámara de los Ecos) | 3.6 Forja / Promoción | ✗ a reconvertir (Merger ≠ novela) |
| `#sheet-dev` tabs Charlas/Stats/Expedición | 3.8 Dev / Observabilidad | ✓ funciona; Stats → Inspector futuro |
| `liveTick` / `_engineAccum < 0.2` | Reloj de juego (§2) | ✗ bug; a reemplazar por GameClock |
| `DAY_LENGTH = 1200` | Contador de día (§2) | ✗ bug; demasiado largo |
| `needs.ts` (`satiety`, `energy`, `health`) | 4 medidores (§4) | ✗ parcial; extender a spec nueva |
| Invocación en Shrine (tutorial) | 3.2 Invocación | ✓ funciona |
| `src/engine/inspector` (ninguno aún) | 3.4 Inspector de Héroe | ✗ a crear |
| `src/engine/progression.ts` + `combat.ts` | Motor RPG (§5) | ✓ base lista |

---

## 9. Orden sugerido de implementación (siguiente ronda)

1. **GameClock:** reloj de doble tasa; migrar `liveTick` y `DAY_LENGTH` a él.
2. **Cuatro medidores:** extender `needs.ts` a la spec del §4 (negativos, debilidad, muerte HP=0).
3. **HP visible:** barra de Salud en Roster e Inspector con bandas de color.
4. **Inspector de Héroe:** vista nueva con ejes dobles + growthstamps + lore.
5. **Vista de misión 1:1:** reproducir expedición a ritmo real.
6. **Reconvertir Merger → Forja:** placeholder hasta tener stats/materiales.
