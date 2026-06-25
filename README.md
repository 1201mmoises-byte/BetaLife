# BetaLife

Un god-game con un **motor de almas determinista** en TypeScript. Cada semilla
engendra un pueblo único: héroes con 14 ejes de personalidad que evolucionan por lo
que viven, un mundo perdido con su catástrofe oculta, y una Hada que es la única voz
entre el jugador y los héroes.

El motor (`src/engine/`) es puro y determinista: la misma semilla reproduce el mismo
mundo. Corre en Node (tests) y en el navegador (empaquetado con esbuild) para el
vertical slice 3D "Pueblo Vivo".

## Estructura
- `src/engine/` — motor determinista (generación de NPC, ejes, mundo, sueños, mediador…).
- `src/runtime/` — `liveWorld` (mundo vivo en el navegador) + `browser` (entrada del bundle).
- `src/save/` — serialización compacta de la partida (semillas + estado mutable).
- `scripts/` — `buildSlice` (genera el slice 3D), `previewSim` (simulación compartida),
  `testEngine` / `testLive` (tests del motor).
- `preview/` — `slice.template.html` (plantilla del juego 3D) → `slice.html` (generado).

## Comandos
```bash
npm test            # tests del motor (testEngine)
npm run test:live   # tests del mundo vivo + guardado
npm run build:slice # genera preview/slice.html desde la plantilla
npm run bundle      # empaqueta el motor → preview/engine.bundle.js
npx tsc --noEmit    # chequeo de tipos
```

## Preview
El juego 3D se publica en `gh-pages` como `index.html`
(`https://raw.githack.com/1201mmoises-byte/BetaLife/gh-pages/index.html`).

Ver `CLAUDE.md` para el estado detallado del proyecto y sus fases.
