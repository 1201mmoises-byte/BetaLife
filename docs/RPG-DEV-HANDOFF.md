# BetaLife — RPG System Handoff

**Para:** desarrollador/IA que va a construir el sistema RPG: niveles, stats, habilidades, equipamiento, monstruos por piso.  
**Repositorio:** https://github.com/1201mmoises-byte/BetaLife  
**Branch de trabajo:** `claude/code-review-65yx3p` (se mergea a `main`)

---

## La cadena causal — cómo nace un NPC

```
TOWN SEED ("shrine-dev-town")
  └─ rollDifficulty()       → difficulty: 1-1000  ← propiedad del PUEBLO, no del NPC
       └─ rollStars()        → stars: 1-5          ← propiedad del NPC
  └─ summonInTown(index)
       └─ generateNPC(seed, difficulty, rosterFloor)
            ├─ pickArchetype()    → OriginArchetype (sesga los ejes)
            ├─ generateAxes()     → SoulAxes (14 ejes 0.0–1.0)
            ├─ sealBirthStamp()   → Stamp (eje firma = resistente al cambio)
            ├─ generateHistory()  → string (historia de origen)
            └─ firstImpression()  → string (conducta observable, nunca números)
```

**Regla maestra:** la dificultad es del PUEBLO (compartida por todos sus NPC). Las estrellas son del NPC (condicionadas por la dificultad del pueblo + el progreso global del roster).

---

## Archivos del engine

Todos en `src/engine/`. Links al branch activo.

| Archivo | Qué hace | Link |
|---|---|---|
| `types.ts` | Tipos: `NPC`, `SoulAxes`, `Stamp`, `StarRating` | [ver](https://github.com/1201mmoises-byte/BetaLife/blob/claude/code-review-65yx3p/src/engine/types.ts) |
| `seeder.ts` | PRNG determinista. `.branch(suffix)` para sub-dominios independientes | [ver](https://github.com/1201mmoises-byte/BetaLife/blob/claude/code-review-65yx3p/src/engine/seeder.ts) |
| `gacha.ts` | Sistema dificultad + estrellas. `rollDifficulty`, `rollStars`, `starProbabilities` | [ver](https://github.com/1201mmoises-byte/BetaLife/blob/claude/code-review-65yx3p/src/engine/gacha.ts) |
| `axes.ts` | Genera los 14 ejes + rasgos emergentes calculados | [ver](https://github.com/1201mmoises-byte/BetaLife/blob/claude/code-review-65yx3p/src/engine/axes.ts) |
| `archetypes.ts` | Arquetipos de origen (sesgan rangos de ejes) | [ver](https://github.com/1201mmoises-byte/BetaLife/blob/claude/code-review-65yx3p/src/engine/archetypes.ts) |
| `stamps.ts` | Birth stamps + growth stamps. `softCeiling` (techo suave de ejes) | [ver](https://github.com/1201mmoises-byte/BetaLife/blob/claude/code-review-65yx3p/src/engine/stamps.ts) |
| `behavior.ts` | Lee ejes como conducta observable. `readBehavior`, `firstImpression` | [ver](https://github.com/1201mmoises-byte/BetaLife/blob/claude/code-review-65yx3p/src/engine/behavior.ts) |
| `experience.ts` | Mueve ejes por eventos. `applyExperience`, `starProgressionMultiplier` (scaffold) | [ver](https://github.com/1201mmoises-byte/BetaLife/blob/claude/code-review-65yx3p/src/engine/experience.ts) |
| `conversations.ts` | Charlas silenciosas NPC↔NPC (empujones de ejes) | [ver](https://github.com/1201mmoises-byte/BetaLife/blob/claude/code-review-65yx3p/src/engine/conversations.ts) |
| `mediator.ts` | La entidad (hada): única voz hacia el jugador | [ver](https://github.com/1201mmoises-byte/BetaLife/blob/claude/code-review-65yx3p/src/engine/mediator.ts) |
| `npcGenerator.ts` | `generateNPC`, `regenerateNPC` | [ver](https://github.com/1201mmoises-byte/BetaLife/blob/claude/code-review-65yx3p/src/engine/npcGenerator.ts) |
| `town.ts` | `createTown(seed)`, `summonInTown(town, index)` | [ver](https://github.com/1201mmoises-byte/BetaLife/blob/claude/code-review-65yx3p/src/engine/town.ts) |
| `index.ts` | Re-exporta todo el engine | [ver](https://github.com/1201mmoises-byte/BetaLife/blob/claude/code-review-65yx3p/src/engine/index.ts) |

---

## Tipo NPC — todos los campos

```typescript
interface NPC {
  id: string;                  // "npc-{seed}"
  seed: string;
  name: string;
  culture: Culture;            // 'hispano'|'nordico'|'celta'|'eslavo'|'greco'|'africano'|'asiatico'
  originArchetypeId: string;   // arquetipo de origen del alma

  stars: StarRating;           // 1|2|3|4|5 — rareza del NPC

  // Propiedades del PUEBLO (persisten para que las estrellas sean reproducibles)
  difficulty: number;          // 1-1000, del pueblo, oculta al jugador
  rosterFloorAtSummon: number; // piso del roster cuando fue invocado

  axes: SoulAxes;              // 14 ejes 0.0-1.0, evolucionan con experiencia
  stamps: Stamp[];             // [0] = birth (acento origen); resto = growth
  history: string;
  observation: string;         // conducta observable, nunca números

  level: number;               // ← SIEMPRE 1 HOY — hook libre para el sistema de niveles
  floorReached: number;        // piso más alto que alcanzó (meta-progresión individual)
  isAlive: boolean;            // permanente; false = caído para siempre
  createdAt: number;
}
```

---

## Los 14 ejes del alma (SoulAxes)

Float 0.0–1.0. Nunca se muestran como números al jugador — solo como comportamiento observable (`behavior.ts`).

| Eje | Polo 0 | Polo 1 |
|---|---|---|
| `caution` | Imprudente | Cauto |
| `passivity` | Agresivo | Pasivo |
| `submission` | Dominante | Sumiso |
| `warmth` | Frío | Cálido |
| `trust` | Desconfiado | Confiado |
| `altruism` | Egoísta | Altruista |
| `sociability` | Solitario | Sociable |
| `integrity` | Acomodaticio | Íntegro |
| `loyalty` | Desleal | Leal |
| `optimism` | Pesimista | Optimista |
| `discipline` | Impulsivo | Disciplinado |
| `curiosity` | Cerrado | Curioso |
| `confidence` | Inseguro | Seguro |
| `forgiveness` | Rencoroso | Indulgente |

### Rasgos emergentes (calculados al vuelo, no almacenados — `axes.ts:readEmergentTraits`)

| Rasgo | Condición de los ejes |
|---|---|
| `honor` | integrity > 0.7 && loyalty > 0.7 && altruism > 0.6 |
| `estratega` | caution > 0.65 && discipline > 0.65 && curiosity > 0.5 |
| `nobleza` | warmth > 0.75 && altruism > 0.65 |
| `heroísmo` | passivity < 0.3 && confidence > 0.7 |
| `imprudencia extrema` | caution < 0.3 && discipline < 0.35 |
| `rencor` | trust < 0.25 && forgiveness < 0.3 |
| `ingenuidad` | submission > 0.8 && confidence < 0.3 |
| `sabiduría benevolente` | optimism > 0.75 && trust > 0.65 && warmth > 0.6 |

---

## Sistema Gacha — `gacha.ts`

### Probabilidades base (dificultad 1, piso 0)

| ★ | P base | Descripción |
|---|---|---|
| 1★ | 60% | Normal |
| 2★ | 25% | Poco inusual |
| 3★ | 10% | Raro |
| 4★ | 4% | Muy raro |
| 5★ | 1% | Extremadamente raro |

### Efecto de la dificultad

- `PENALTY_STRENGTH = 3.0` — aplasta las altas estrellas en mundos brutales.
- Dificultad 1000, piso 0 → P(5★) ≈ 0.00001%.
- Dificultad 1, piso 0 → P(5★) = 1% (base, sin penalidad).

### Meta-progresión del roster (bono por pisos completados)

Cada 10 pisos que el roster completa reduce la penalidad y puede superar la base:

- Mundo fácil (dif 1): piso 90 → P(5★) sube al **25% (techo absoluto, `M_CAP = 1.25`)**.
- Mundo máximo (dif 1000): piso 100 → recupera el **1% base**.

El bono por paso escala con la dificultad: escalar pisos vale **más** en mundos brutales.

### Constantes de diseño (`gacha.ts`)

```
BASE_WEIGHTS      = { 1: 0.60, 2: 0.25, 3: 0.10, 4: 0.04, 5: 0.01 }
PENALTY_STRENGTH  = 3.0
DIFFICULTY_MIN    = 1
DIFFICULTY_MAX    = 1000
M_CAP             = 1.25          // techo del exponente (25% max 5★)
FLOORS_PER_STEP   = 10            // cada 10 pisos = 1 paso de bono
FLOORS_TO_CAP_EASY   = 90         // mundo fácil → techo en piso 90
FLOORS_TO_CANCEL_MAX = 100        // mundo máximo → cancela penalidad en piso 100
```

### Fórmula del exponente

```
m = min(M_CAP,  floorBonus − difficultyPenalty)
P(s) ∝ BASE_WEIGHT[s] × exp(m × (s − 1))
```

---

## Sistema de experiencia — `experience.ts`

### Parámetros clave

```
BASE_DELTA             = 0.04    // movimiento base por evento antes de filtros
BIRTH_AXIS_RESISTANCE  = 0.6     // el eje del birthStamp mueve solo 40% del delta
jitter                 = ±15%    // variación aleatoria determinista por tick
```

### Eventos implementados

| EventKind | Ejes que mueve | Filtros dinámicos |
|---|---|---|
| `combat` | `confidence` (±), `passivity` (−éxito / +fracaso), `caution` (↑fracaso, regula éxito) | `confFilter`, `passFilter` |
| `scout` | `curiosity` (±), `caution` (↓éxito / ↑fracaso) | `discFilter` |
| `rest` | **Nada todavía** — hook libre para Fase 5 | — |

### Filtros dinámicos (cómo el alma filtra la experiencia)

Los ejes del NPC amplifican o amortiguan cada delta. Por ejemplo en `combat`:
```typescript
const confFilter  = 1.0 + (0.5 - axes.confidence) * 0.8;  // inseguros ganan más confianza
const passFilter  = 0.5 + axes.passivity * 0.8;            // pasivos sienten más el combate
```

Misma exposición → resultados distintos según el alma del NPC.

### Birth stamp: el acento de origen

El eje firma del arquetipo de origen recibe `× 0.6` del delta. No puedes convertir fácilmente un NPC frío en cálido si la frialdad es su acento de origen.

### Techo suave (`softCeiling` en `stamps.ts`)

Los ejes no llegan a 0.0 ni 1.0 por experiencia — hay fricción creciente cerca de los extremos. Un NPC ya extremadamente disciplinado es difícil de volver aún más disciplinado.

### Growth stamps

Cuando un eje cruza una banda (0.25 / 0.5 / 0.75 / 1.0), se sella automáticamente un `growth stamp`. Estos stamps registran los "capítulos" del desarrollo del NPC y **pueden anclar habilidades o desbloqueos** del sistema RPG.

---

## Scaffold ya creado — listo para conectar

### 1. `starProgressionMultiplier(stars)` — `experience.ts`

```typescript
// 1★→1.00  2★→1.15  3★→1.30  4★→1.45  5★→1.60
export function starProgressionMultiplier(stars: StarRating): number {
  return 1 + (stars - 1) * 0.15;
}
```

**Estado:** función pura, exportada, documentada. **No conectada** a `applyExperience` todavía.

**Para activar:** pasar `stars` a `applyExperience` y multiplicar `BASE_DELTA`:
```typescript
const delta = BASE_DELTA * intensity * starProgressionMultiplier(npc.stars);
```
Un NPC de 5★ moverá sus ejes **60% más rápido** que uno de 1★ ante la misma exposición.

---

### 2. `NPC.level` — `types.ts`

```typescript
level: number;  // inicializado a 1 en generateNPC; nunca incrementado
```

**Estado:** campo declarado, persiste en el tipo, siempre vale 1.

**Para activar:** definir `levelUp(npc) → NPC` (pura, sin mutación) que incremente el campo. Decidir qué otorga XP (eventos de combate, pisos completados, charlas de alta intensidad).

---

### 3. `EventKind.rest` — `experience.ts`

```typescript
// 'rest': sin movimiento de ejes. Fase 5 lo expande.
```

**Para activar:** añadir un bloque `else if (event.kind === 'rest')` que recupere `confidence`, `optimism`, reduzca `caution` levemente.

---

### 4. `Town.rosterFloor` — `gacha.ts` + `town.ts`

El piso más profundo del roster ya afecta el gacha. Este mismo valor es la variable natural para escalar monstruos:
- Pisos bajos + dificultad baja → criaturas débiles.
- Pisos altos + dificultad alta → criaturas que usan todo el rango del sistema.

---

## Slots abiertos (sin código todavía)

### Stats de combate

Los 14 ejes son **personalidad**, no combate. Los stats (HP, ATK, DEF, SPD…) son la capa siguiente y se **derivan** de los ejes + estrella + nivel.

Propuesta de derivación:

```typescript
// Ejemplo — valores finales a afinar en diseño
HP_base  = f(confidence, caution, stars, level)    // alma resiliente + cautelosa = más HP
ATK_base = f(1-passivity, confidence, stars, level) // agresivo + seguro = más ataque
DEF_base = f(caution, discipline, stars, level)     // cauto + disciplinado = más defensa
SPD_base = f(1-caution, curiosity, stars)           // imprudente + curioso = más velocidad
```

`starProgressionMultiplier` está listo para escalar el resultado. Las estrellas son el modificador por-NPC; la dificultad del pueblo ya está incorporada en el nivel de estrellas del NPC.

---

### Habilidades (skills)

No existen todavía. Propuesta de emergencia por ejes y stamps:

| Eje / condición | Habilidad natural |
|---|---|
| `confidence > 0.75` | Intimidar (taunt, genera agro) |
| `altruism > 0.7` | Proteger (absorbe daño de aliado) |
| `curiosity > 0.7` | Explorar (scan, recon avanzado) |
| `discipline > 0.75` | Técnica perfecta (+% daño en combates consecutivos) |
| `warmth > 0.75` | Galvanizar (buff grupal de ánimo) |
| `loyalty > 0.75` | Escudo de lealtad (bonus cuando protege aliado de su grupo) |
| `forgiveness < 0.25` | Rencor acumulado (daño extra contra enemigos que ya lo hirieron) |

Los **growth stamps** (`Stamp.bandValue` en 0.25 / 0.5 / 0.75 / 1.0) ya son el mecanismo de "capítulos sellados" — perfectos para anclar desbloqueos permanentes.

---

### Equipamiento

No existe. Los ganchos naturales:
- `NPC.stars` sesga la calidad máxima que puede usar.
- `NPC.originArchetypeId` sesga los tipos compatibles (guerrero → armas pesadas; mago → bastones).
- `NPC.level` puede desbloquear slots de equipamiento adicionales.

---

### Monstruos por piso

No existen todavía. El sistema puede ser completamente determinista:

```typescript
// Generación determinista de criaturas por piso
const floorSeed = createSeeder(`town:${town.seed}:floor:${floor}:monsters`);
// generar criaturas con HP/ATK/DEF basados en town.difficulty + floor
```

Variables naturales de escala:
- `town.difficulty` (1-1000) → dificultad base de las criaturas del piso
- `floor` → multiplicador progresivo (cada piso es más duro)
- `town.rosterFloor` (meta-progresión) → opcionalmente escalar también con el progreso del roster

---

## Reglas de diseño a respetar

| Regla | Qué significa en práctica |
|---|---|
| **Determinismo total** | Siempre `createSeeder(seed).branch('dominio')`. Nunca `Math.random()`. Mismos inputs → mismo NPC siempre. |
| **Dificultad oculta** | `difficulty` (1-1000) nunca se muestra ni en UI ni en texto. El jugador lo intuye por el progreso. La entidad no la revela. |
| **La entidad es la única voz** | Ejes, dificultad, arquetipo, stats — nunca crudos al jugador. Todo llega filtrado por la hada (`mediator.ts`). |
| **Ejes ≠ stats de combate** | Los 14 ejes son personalidad/comportamiento social. Los stats se derivan de ellos pero son una capa separada. |
| **Muerte permanente** | `isAlive: false` es final. Sin revive, sin segunda oportunidad. |
| **Puro / sin mutación** | Las funciones del engine devuelven copias, nunca mutan. La capa de persistencia decide cuándo guardar. |
| **Arquitecto, no controlador** | El jugador expone al NPC a situaciones. El NPC responde filtrado por su alma. El jugador no puede ordenar directamente. |

---

## Comandos

```bash
# TypeScript check (verifica tipos sin compilar)
npx tsc --noEmit

# Test del motor (determinismo + integridad)
npx ts-node --project tsconfig.json scripts/testEngine.ts

# Regenerar preview HTML con NPC reales
npx ts-node --project tsconfig.json scripts/devPreview.ts
```

> `npm test` falla con Node 22 (`ERR_REQUIRE_CYCLE_MODULE`). Usar `testEngine.ts` directamente.

---

## Preview en vivo (dev)

https://raw.githack.com/1201mmoises-byte/BetaLife/gh-pages/index.html

Muestra NPC reales con ejes visualizados, charlas de fondo con diálogo IA (Gemini), inspector por NPC, alerta de la entidad.

---

## Estado de las fases (para no pisar trabajo existente)

| Fase | Estado | Archivos principales |
|---|---|---|
| A — Pueblo + estrellas | ✅ Completada | `town.ts`, `experience.ts`, `npcGenerator.ts`, `types.ts` |
| B — Diálogo IA (dev preview) | ✅ Completada | `scripts/generateDialogue.ts`, `preview/dialogue-cache.json`, `scripts/devPreview.ts` |
| C — Auto-generación (GitHub Actions) | ✅ Completada | `.github/workflows/dialogue-gen.yml` |
| 6 — Entidad interactiva | 🔄 En progreso | `mediator.ts` (nuevas funciones), `scripts/devPreview.ts` (panel pendiente) |
| 5 — IA on-device | 📐 Diseñada | `src/ai/` — transformers.js + SmolLM2-360M (a implementar) |
| **RPG system** | 🆕 Este handoff | `level`, stats, skills, equipo, monstruos |
