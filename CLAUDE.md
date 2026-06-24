# BetaLife — Estado del proyecto para Claude Code

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

# Regenerar preview HTML
npx ts-node --project tsconfig.json scripts/devPreview.ts

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
