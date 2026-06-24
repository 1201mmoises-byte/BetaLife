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
  (`start()` pone `inRoster=false` a todos) y la Hada conduce paso a paso —
  `startTutorial()`→`tutDoSummon()`×4 (invocar los primeros 4, anillo dorado de
  resalte en el sitio) → `tutExplain()`/`tutTryAsk()` (única voz, sin números;
  prueba a preguntar por uno) → `tutFusionIntro()` + `tutAfterFusion()` (obliga a
  sentir UN Eco/Merger). Durante el tutorial `body.tut` oculta cierres/HUD y
  `doPick` deja el mundo inerte salvo la acción pedida. Termina en `tutDone()`.
  Corre en cada carga (el roster no se persiste).
- `scripts/buildSlice.ts` — corre `runPreviewSim()`, hornea héroes (ejes nacimiento+ahora,
  emergentes, cues, necesidades) + **voz CUALITATIVA de la Hada compuesta aquí** (sin
  números: deriva de ejes = "ha ido aprendiendo", `confidence` = miedo a la Torre, y teje
  las necesidades observables; NO usa `consultNPC`/`situationBrief` del motor porque
  mencionan conteos) + **pool de diálogo por tema** (`dialoguePool`) para las charlas en vivo.
- Build: `npx ts-node --project tsconfig.json scripts/buildSlice.ts`
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

### Fase B — Diálogo IA en el dev preview ✓
- `scripts/previewSim.ts` — simulación compartida. `runPreviewSim()` devuelve
  `{town, pool, roster, currentAxes, log}`. `fallbackDialogue(e)` para sin API key.
  `dialogueKey()` = FNV-1a hash estable para claves de caché.
- `scripts/generateDialogue.ts` — Gemini 2.5-flash via `curl` (respeta HTTPS_PROXY).
  Formato de caché: `{ [key]: { via: 'gemini'|'fallback', lines: DialogueLine[] } }`.
  Guardado incremental (después de CADA llamada). Modo por defecto = fill-missing
  (solo regenera entradas ausentes o `via:'fallback'`). `--force` regenera todo.
- `preview/dialogue-cache.json` — 63 entradas (18 gemini, 45 fallback). Commiteado.
- `scripts/devPreview.ts` — lee `entry.lines` del nuevo formato de caché.
  Burbujas A/B en el log de charlas. Importa de previewSim.ts.

### Fase C — Auto-generación incremental via GitHub Actions ✓
- `.github/workflows/dialogue-gen.yml` — corre diariamente 4 AM UTC + en push a
  `main` si cambian `src/engine/**` o `scripts/previewSim.ts`.
  Genera dialogue → rebuild preview → commit → deploy a gh-pages. Todo automático.
- **Secret necesario:** repo → Settings → Secrets and variables → Actions →
  New secret → nombre `GEMINI_API_KEY`.

## Preview publicado
URL: `https://raw.githack.com/1201mmoises-byte/BetaLife/gh-pages/index.html`
Branch: `gh-pages` → `index.html`
Fuente: `preview/shrine-dev.html` generado por `scripts/devPreview.ts`

## Arquitectura del motor
- Determinismo: `seeder.branch(suffix)` crea seeders hijos independientes.
- `rollConversation` → empujones de ejes (charlas silenciosas, nunca texto).
- La hada (`mediator.ts`) es la única voz hacia el jugador.
- El texto de diálogo es SOLO para el preview de dev, nunca en el juego real.

### Fase 6 — El Hada interactiva ✓
- `src/engine/mediator.ts` — `consultNPC`, `situationBrief`, `explainRule` activos.
- `scripts/devPreview.ts` — panel del hada (bottom sheet): situación del roster,
  lectura por héroe (toca para ir al inspector), reglas que el hada explica.
  El inspector de cada héroe muestra "el hada dice" (lectura observable, sin números).
  Hada clicable en la escena + botón "el hada" en dev-controls.
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
# Generar diálogo IA (fill-missing, rellena fallback con Gemini si hay clave)
GEMINI_API_KEY=xxx npx ts-node --project tsconfig.json scripts/generateDialogue.ts

# Regenerar preview HTML (dev tool 2D)
npx ts-node --project tsconfig.json scripts/devPreview.ts

# Generar el vertical slice 3D (Fase 1) → preview/slice.html
npx ts-node --project tsconfig.json scripts/buildSlice.ts

# Ejecutar tests del motor
npx ts-node --project tsconfig.json scripts/testEngine.ts

# TypeScript check
npx tsc --noEmit
```

## Notas técnicas importantes
- `npm test` falla con Node 22 + `--loader ts-node/esm` (cycle ESM bug). Usar
  `npx ts-node --project tsconfig.json scripts/testEngine.ts` en cambio.
- Gemini API: `gemini-2.0-flash` tiene `limit:0` en este proyecto. Usar `gemini-2.5-flash`.
- HTTP via `curl`, no `fetch` global de Node (no honra HTTPS_PROXY en este entorno).
- `groq.com` y `openai.com` están bloqueados por el proxy. Solo Gemini alcanzable.
