# BetaLife — Estado del proyecto para Claude Code

## Fase 1 — Vertical Slice "Pueblo Vivo" (3D) — EN CURSO
Diseño completo en `docs/DISENO-VERTICAL-SLICE.md`. Primera versión jugable:
- `preview/slice.template.html` — escena **Three.js isométrica** (CDN, corre en el
  navegador del jugador). El motor NO se toca: es solo capa de render que lee su estado.
  Las 5 estructuras (Torre no-enterable, Shrine, Posada, Campo, Cámara de Fusión),
  4 héroes vivos en tiempo real (caminan/entrenan/descansan solos), la **Hada como
  orbe tocable** que abre la conversación con burbujas (ramas: saber/pedir/explicar),
  **Roster**, **Cámara de Fusión (Merger simbólico)**, invocación en el Shrine,
  catch-up offline (el mundo no para). **Ambiente:** ciclo día/noche (sol + luna),
  muralla circular de fondo, antorchas en cada sitio + fogata central que se encienden
  de noche. **Charlas EN VIVO:** los héroes se juntan (sobre todo en la plaza) y hablan
  en tiempo real con burbujas de diálogo flotando sobre ellos (texto del pool real del
  motor). NO hay log previo horneado. **Panel de dev** (botón "dev"): feed de charlas en
  vivo de la sesión + 14 ejes por héroe (barra=ahora, marca=al nacer) + necesidades.
  Token `__BETALIFE_DATA__`. **Onboarding (tutorial):** el pueblo arranca VACÍO
  (`start()` pone `inRoster=false` a todos) y la Hada **señala dónde, el jugador
  toca la estructura real** (no lo hace ella por ti). `startTutorial()`→
  `tutBeginSummon()` cierra la hoja, resalta el Shrine (anillo dorado) y muestra
  el cartel `#tut-hint` "Toca el Shrine"; cada tap al Shrine = `tutDoSummon()`
  (×4) → `tutExplain()`/`tutTryAsk()` (única voz, sin números; prueba a preguntar
  por uno) → `tutFusionIntro()`+`tutGoFusion()` resalta la Cámara de los Ecos y
  pide tocarla (tap = abre el Merger) → `tutAfterFusion()` (obliga a sentir UN
  Eco). Durante el tutorial `body.tut` oculta cierres/HUD y `doPick` sólo responde
  a la estructura pedida (tocar la Hada re-pulsa el cartel). Termina en
  `tutDone()`. Corre en cada carga (el roster no se persiste).
- `scripts/buildSlice.ts` — corre `runPreviewSim()`, hornea héroes (ejes nacimiento+ahora,
  emergentes, cues, necesidades) + **voz CUALITATIVA de la Hada compuesta aquí** (sin
  números: deriva de ejes = "ha ido aprendiendo", `confidence` = miedo a la Torre, y teje
  las necesidades observables) + **pool de diálogo por tema** (`dialoguePool`) para las
  charlas en vivo. (En vivo, la lectura por héroe la compone `liveReading` en el navegador.)
- Build: `npm run build:slice`
- **Pendiente:** verificación visual en navegador real (WebGL); conectar foco/guía a
  efectos reales; muerte emergente rara (hoy stub: voluntad de vivir = no mueren en la
  demo). NO incluye Torre jugable ni combate (faltan stats).

## Bases para Fase 2 (capa RPG) — EN CURSO
- `src/engine/needs.ts` — necesidades vitales deterministas (estilo Sims): `satiety`
  (hambre), `energy` (agotamiento), `health`. Floats 0..1 (1=bien), nunca se muestran
  como número. API: `createNeeds(seeder, axes)`, `tickNeeds(needs, axes, activity, ticks)`,
  `needsStatus(needs)` (lectura observable), `criticalNeed(needs)` (= gancho para la muerte
  emergente de Fase 2/3). Puro, modulado por `discipline`. Exportado en `index.ts`.
- NO conectado al juego en vivo aún. El slice lo hornea como snapshot (simula un día
  determinista por héroe en `buildSlice.ts`) y lo muestra como barras en el panel de dev.
- Test en `scripts/testEngine.ts` (bloque "Necesidades vitales").

## Base narrativa — Mundo por semilla + estrellas↔catástrofe + sueños (motor) ✓
Promueve el "Norte Narrativo" a base real y determinista del motor:
- `src/engine/world.ts` — `generateWorld(seeder)` → cada SEMILLA engendra un mundo
  único con su **catástrofe** (6 tipos: grieta/guerra/ruina/olvido/marea/sol-muerto) +
  `beats` (la "verdad" que la Torre revelará) + `shards` por profundidad. `Town.world`
  (en `town.ts`) lo comparten TODOS los héroes del pueblo. El jugador nunca ve la
  verdad; solo se filtra por sueños. (En el slice: panel de dev = rayos-X.)
- `src/engine/historyGenerator.ts` — `generatePastLife` (oficio civil + lugar por
  arquetipo) y `generateHeroLore`: las **estrellas** deciden a qué profundidad de la
  catástrofe estuvo el héroe (5★ núcleo · 4★ secundario · 3★ periférico · 1-2★
  fillers sin pericia), con **memorias OLVIDADAS** sacadas de los `shards` del mundo
  según el tier (los fillers recuerdan su vida civil, no la catástrofe).
- `src/engine/dreams.ts` — `surfaceDream` aflora un recuerdo (raro, escala con
  estrellas) = la fuga controlada del misterio. No conectado a un loop aún; lo
  consume el preview/Hada ("anoche soñó con…").
- `NPC` gana `worldSeed`, `pastLife`, `lore`; reproducibles en `regenerateNPC`.
- Tests en `scripts/testEngine.ts` (mundo determinista/único, estrellas↔memorias,
  pastLife y sueños reproducibles).
- **Pendiente (RPG futuro):** la dificultad de semilla → pisos (monstruos/terreno/
  acertijos/soporte) y la Torre revela los `beats`. La misma data por personaje
  alimentará la IA on-device (Fase 5).

## Mundo VIVO + persistencia (device) — EN CURSO (Fase 1/2)
El slice deja de ser una "foto": el motor determinista corre EN EL NAVEGADOR y se guarda.
- `src/runtime/liveWorld.ts` — `createLiveWorld(seed)`, `applyConversation` (las charlas
  MUTAN los ejes con techo suave + sellan growth-stamps), `tickHeroNeeds`, `tryDream`,
  `simulateOffline` (catch-up offline determinista).
- `src/save/saveState.ts` — `serializeSave`/`restoreSave` compactos (semillas + estado
  mutable; nombre/lore/mundo se REGENERAN del seed con `regenerateNPC`).
- `src/runtime/browser.ts` + `esbuild` → `preview/engine.bundle.js` (ESM, importmap
  `betalife-engine`). Comando: `npm run bundle`.
- `preview/slice.template.html` — importa el bundle (`await import`), `bindLive` vuelve
  cada héroe horneado en una VISTA viva del NPC (getters axes/needs/emergent/memories);
  el loop hace `liveTick` (necesidades por actividad + autoguardado a localStorage); las
  charlas evolucionan los ejes. Persistencia `betalife_save_v1` + catch-up offline. Si
  hay save, RESTAURA el roster y omite el tutorial; botón dev "↺ reiniciar partida".
  **Defensivo:** si el bundle no carga, cae a modo horneado (no se rompe).
- `scripts/testLive.ts` — evolución/save/determinismo, todo PASS.
- **Pendiente:** la lectura de la Hada (`reading`) sigue horneada (no refleja la deriva
  en vivo aún); Fase 3 = cuenta Supabase (sync); Fases 4-5 = LLM on-device + aprendizaje.

## Fases completadas

### Fase A — Motor de pueblo + scaffold de estrellas ✓
- `src/engine/town.ts` — `createTown(seed)` → UN dificultad compartida por pueblo.
  `summonInTown(town, index)` → genera NPC con esa dificultad (no una por NPC).
- `src/engine/experience.ts` — `starProgressionMultiplier(stars)` scaffold puro.
  1★→1.00, 5★→1.60. NO conectado a applyExperience aún (sin sistema de stats todavía).
- `src/engine/npcGenerator.ts` — `regenerateNPC` lee `partial.difficulty` en vez
  de re-rollar (reproduce estrellas determinísticamente desde la dificultad persistida).
- `src/engine/types.ts` — `NPC.difficulty` = del pueblo, no por NPC.
- `src/engine/index.ts` — exporta `town`.

### Fase B — Diálogo IA en el dev preview ✓ (Gemini + dev tool 2D RETIRADOS)
- `scripts/previewSim.ts` — simulación compartida. `runPreviewSim()` devuelve
  `{town, pool, roster, currentAxes, log}`; lo consume `buildSlice.ts` para hornear el
  estado inicial del slice 3D.
- **Gemini eliminado** (free-tier diminuto) y **dev tool 2D retirado** (`devPreview.ts`,
  `preview/shrine-dev.html`, `preview/shrine.html` borrados, junto con `fallbackDialogue`/
  `consultNPC`/`situationBrief`). El slice 3D ya NO usa diálogo horneado: **compone las
  charlas en vivo en el navegador** (ver Fase 1), ancladas en la voz real de cada héroe
  (oficio/sueños/hambre/sitio). Sin API, sin límites.

### Fase C — ~~Auto-generación via GitHub Actions~~ RETIRADA
- `.github/workflows/dialogue-gen.yml` ELIMINADO junto con Gemini. El `GEMINI_API_KEY`
  ya no se usa. (Ideas minadas de Sentient-NPC / AutoChatManager: offline-first,
  estado/plan por personaje, round-robin — aplicadas al compositor determinista.)

## Preview publicado
URL: `https://raw.githack.com/1201mmoises-byte/BetaLife/gh-pages/index.html`
Branch: `gh-pages` → `index.html` = **el slice 3D** (el dev tool 2D fue retirado).
Fuente: `preview/slice.template.html` → `npm run build:slice` → `preview/slice.html`.
Deploy: copiar `preview/slice.html` a `index.html` y `preview/engine.bundle.js` a la
raíz de `gh-pages` (el slice importa `./engine.bundle.js`, relativo).

## Arquitectura del motor
- Determinismo: `seeder.branch(suffix)` crea seeders hijos independientes.
- `rollConversation` → empujones de ejes (charlas silenciosas, nunca texto).
- La hada (`mediator.ts`) es la única voz hacia el jugador.
- El texto de diálogo es SOLO para el preview de dev, nunca en el juego real.

### Fase 6 — El Hada interactiva ✓
- `src/engine/mediator.ts` — voz de la Hada: `briefRoster`, `describeNPC`,
  `reportActivity`, `explainRule`, `relay`, `rareWhisper`. (El slice usa `explainRule`
  para las reglas; la lectura por héroe se compone en vivo en el navegador con
  `liveReading`, sin números.)
- **Terminología de dominio (cara al jugador):**
  - "La hada" = la entidad mediadora (`mediator.ts`). Guía/mentora del jugador Y de los héroes.
  - "Héroes" = los personajes del roster (internamente siguen siendo `NPC` en el código).
- **NOTA PENDIENTE:** "Chequear si dos mismos personajes en diferentes ambientes
  se desarrollan diferente" — verificar que el mismo NPC seed en dos pueblos distintos
  produce ejes divergentes con el tiempo (por las diferentes interacciones de contexto).

## Fase 5 — IA local on-device (diseñada, a implementar)
Integrar `transformers.js` (https://github.com/huggingface/transformers.js) con
`SmolLM2-360M-Instruct` (~200 MB cuantizado). Corre en el browser del jugador sin
servidor. El modelo aprende del contexto de la partida (localStorage). A largo plazo:
federated learning con LoRA + FLOWER (https://github.com/adap/flower).
Archivos futuros: `src/ai/localDialogue.ts`, `src/ai/playerContext.ts`.

## Comandos frecuentes
```bash
# (Gemini + dev tool 2D retirados: las charlas del slice 3D se componen en vivo, sin API)

# Generar el vertical slice 3D (Fase 1) → preview/slice.html
npm run build:slice

# Empaquetar el motor para el navegador → preview/engine.bundle.js
npm run bundle

# Ejecutar tests del motor / mundo vivo
npm test
npm run test:live

# TypeScript check
npx tsc --noEmit
```

## Notas técnicas importantes
- `npm test` falla con Node 22 + `--loader ts-node/esm` (cycle ESM bug). Usar
  `npx ts-node --project tsconfig.json scripts/testEngine.ts` en cambio.
- **Gemini retirado** del flujo de charlas (free-tier muy chico). El slice compone
  las charlas en vivo de forma determinista; no se llama a ninguna API en el build.
- La meta on-device (Fase 5) sustituye a Gemini a futuro: `transformers.js` +
  SmolLM2 en el navegador, alimentado por el mismo contexto por personaje
  (world+lore+pastLife+needs+sitio).
