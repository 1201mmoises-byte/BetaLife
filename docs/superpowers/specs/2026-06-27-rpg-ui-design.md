# RPG UI Integration — Tower Expedition Design

**Date:** 2026-06-27
**Status:** Approved
**Scope:** Wire the RPG combat layer (stats, skills, equipment, combat, expedition) into the BetaLife slice.html 3D village UI, introducing the Tower as a playable dungeon entry point.

---

## Philosophy

BetaLife's "architect not controller" principle governs every decision here. The player:
- Never commands combat moves
- Never sees raw numbers (HP, ATK, floor index)
- Observes and guides; heroes act by their own soul axes

The Fairy (Hada) remains the only voice between the player and the world. All RPG results are filtered through her qualitative prose.

---

## 1. Volunteering Logic

When the player taps the Tower, the engine checks each living hero's soul axes to determine willingness.

**Volunteer threshold** (both conditions required):
- `confidence > 0.45`
- `passivity < 0.70`

**Strong volunteer** (highlighted, shown first):
- `confidence > 0.65` AND `optimism > 0.55`

**Reluctant volunteer** (dimmed, still included):
- Meets base threshold but not strong threshold

**No volunteers**: Sheet does not open. Tower tap shows a toast via `toast()`:
> "Nadie siente el llamado todavía."

**Floor selection**: Always `Math.floor(average hero level)`. No floor picker exposed to the player. The engine's `runExpedition` handles monster scaling automatically.

---

## 2. Tower Sheet (`#sheet-torre`)

A new bottom-drawer sheet following the existing `.sheet` / `.sheet-body` / `.sheet-head` pattern.

### Structure

```html
<div class="sheet" id="sheet-torre">
  <div class="sheet-grip"></div>
  <div class="sheet-head">
    <span class="sheet-icon" style="color:var(--violet);">⬡</span>
    <div class="sheet-title">La Torre<small>algo llama desde lo alto</small></div>
    <span class="sheet-close" data-close="sheet-torre">✕</span>
  </div>
  <div class="sheet-body mw">
    <div class="fairy-line" id="torre-fairy-line"></div>
    <div class="torre-volunteers" id="torre-volunteers"></div>
    <button class="btn-merge" id="btn-send-tower">Enviarlos →</button>
  </div>
</div>
```

### Hero Cards

Same `.hero-card` + `.bust` HTML as the Roster. Below the star rating, a qualitative label:
- `"listo"` — strong volunteer (default styling)
- `"dudoso"` — reluctant volunteer (dimmed, `opacity: 0.7`)
- `"retenido"` — held back by player tap (grayed, strikethrough name, `opacity: 0.4`)

Tapping a card toggles between volunteering and held-back.

### Send Button

- Disabled + dimmed when all heroes are held back
- Gets `.ready` class (gold border glow) when ≥1 hero is confirmed
- Button text: "Enviarlos →" (plural), or "Enviar a [Name] →" when exactly one hero confirmed

### Fairy Opening Line

Composed in JS from volunteer state (no hardcoded strings per hero). Examples:
- *"[Name] da un paso adelante sin dudarlo. Hay otros dos que lo siguen, aunque sin la misma certeza."*
- *"Solo [Name] siente el llamado ahora. Los demás no están listos — o simplemente no quieren."*

Rendered in `#torre-fairy-line` with a local typing animation (NOT `fairySays()`, which targets `#hada-thread`). A simple `torreLineEl.textContent = ''` + char-by-char interval is sufficient — no bubble structure needed.

---

## 3. Expedition Runtime (3D World)

### Departure Sequence (0–8 seconds)

1. Sheet closes.
2. Confirmed heroes get state `'tower'` — `pickActivity` and `updateHero` skip them (frozen behavior).
3. Heroes walk toward `P_TORRE` (existing `spotPos` / movement logic).
4. On arrival at Tower base: speech bubble appears (drawn from a `BANKS.tower` bank filtered by `toneOf`):
   - Confident: *"Vuelvo."*
   - Reluctant/cautious: *"Ojalá."* / *"No tengo otra opción."*
   - Optimistic: *"Será rápido."*
5. Hero 3D groups hidden (`group.visible = false`).
6. Tower tip light pulses: `intensity` 12 → 22 for 2 seconds, then returns.

### Absence Timer

Duration: `Math.min((floor + 1) * 90, 480)` real seconds.
- Floor 1 → ~3 min, Floor 5 → ~9 min (cap 8 min).

Stored in `LIVE` state as `LIVE.expedition = { partyIds, floor, resolvedResult, returnAt }` so a page reload resumes correctly.

HUD sub-label: `"esperando noticias…"` while any hero is inside.

### Live Chat During Absence

New `'tower'` beat added to `BANKS`. Weight increases with NIGHT (they left at dusk, tension):
```js
['¿Cuánto tardan?', 'No lo sé. Nadie sabe lo que hay ahí arriba.'],
['¿Y si no vuelven?', '…Esperamos.'],
```

### Fairy During Absence

If tapped while heroes are inside: *"No puedo ver dentro de la Torre. Solo sé que están ahí — y que espero."*

### Resolution

`runExpedition(town, floor, party)` is called at departure (result computed instantly, held in `LIVE.expedition.resolvedResult`). When the timer fires:

1. Survivors' groups reappear at Tower base (`group.visible = true`), walk to plaza.
2. Dead heroes: `data.alive = false`, group stays hidden, `recentLoss` set (same as Merger permadeath path).
3. Fairy report queued: opens automatically if no sheet is active, otherwise waits for player to tap her.

---

## 4. Fairy Report

All results translated to qualitative prose. Zero numbers.

| Outcome | Fairy line |
|---|---|
| Victory, all survive | *"Volvieron. [Name] marcó el camino; los demás siguieron."* |
| Victory with casualties | *"Volvió [Name]. [DeadName] no. La Torre se lo quedó."* |
| Total wipe | *"No volvió nadie. El pueblo los recuerda."* |
| Hero grew (level up) | *"[Name] salió distinto. No sé explicarlo bien, pero lo noto."* |
| Loot found | *"Trajeron algo de allá dentro. No sé qué significa aún."* |

Report is delivered via `fairySays()` in the existing `#hada-thread`, followed by `hadaRoot()` to restore normal navigation.

### Permadeath in the World

Dead heroes follow the same path as Merger sacrifice:
- 3D group removed from scene
- `recentLoss = { name, timer: 180 }` set
- Surviving heroes reference them in live chat for ~3 minutes

---

## 5. Roster Card Update

Replaces the `"lvl · stats — próximamente"` placeholder div.

Two new qualitative lines below star rating:

**Floor depth** (rendered as filled blocks, max 5):
- `▪▪▪▫▫` — no number, just depth indicator derived from `npc.level`

**Readiness** (derived from `deriveStats(npc).hp / deriveStats(npc).maxHp`):
- `≥ 0.7` → `"en forma"`
- `0.4–0.69` → `"herido"`
- `< 0.4` → `"malherido"`
- `isAlive === false` → `"caído"` (card grayed)

---

## 6. Dev Panel Addition

New "Expedición" section in `#sheet-dev` (tab alongside Charlas / Stats):

Shows raw `CombatResult` for the last expedition:
- `narration[]` — the full observable log
- `fallenNpcIds[]` — who fell
- `floor` reached
- Loot items if any

Only visible to the developer. The player never sees this panel in normal play.

---

## Files to Touch

| File | Change |
|---|---|
| `preview/slice.template.html` | Add `#sheet-torre` markup |
| `preview/slice.js` | Add `'sheet-torre'` to `SHEETS` array; `onPlace('torre')` opens sheet; volunteering logic; departure/return sequences; `BANKS.tower`; Fairy report composer; `liveTick` expedition timer check |
| `preview/slice.css` | `.torre-volunteers`, `.held-back` card state, depth-block style |
| `scripts/buildSlice.ts` | Pass RPG-relevant fields (level, hp ratio) into baked hero data |
| `src/save/saveState.ts` | Include `expedition` field in `serializeSave`/`restoreSave` so in-progress expeditions survive page reload |
| `preview/engine.bundle.js` | Rebuild after confirming `runExpedition` export is live |

No changes to any engine source files — the RPG layer is already complete and tested (47/47 pass).

---

## Out of Scope

- Floor selector (always auto-selected)
- Combat animation / blow-by-blow UI (Fairy narrates after the fact)
- Equipment management UI (items silently stored, dev panel only for now)
- Skills display (internal only for now)
- Multiplayer / sync (Fase 3)
