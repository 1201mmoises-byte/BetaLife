# BetaLife Engine Port — Sub-project 1: Deterministic Engine (No Rendering)

## Context

`GodotGame` is the target Godot 4.7 project for **BetaLife**, a deterministic
"soul engine" god-game currently implemented in TypeScript at
`C:\Users\Noobi\OneDrive\Documents\MoisesGame\BetaLife-main\BetaLife-main`
(separate git repo). That repo's `docs/BLUEPRINT-MENUS-Y-SISTEMA.md` already
defines the target Godot architecture (§3: views/scenes, §5: portable
architecture, §8: previz → Godot mapping) and explicitly calls the current
HTML/Three.js implementation **previz, not the product** — meant to be
rebuilt as Godot scenes, with the engine ported to GDScript.

`GodotGame` is currently an empty scaffold. Nothing has been ported yet.

This spec covers **only the first sub-project**: porting the deterministic
engine logic (no UI, no scenes, no rendering) into GDScript, proven correct
by tests. Later sub-projects (one per blueprint §3 view/scene) build the
actual game on top of this verified foundation.

## Goal

Port `src/engine/`, `src/runtime/` (excluding `browser.ts`), and `src/save/`
from the TS BetaLife engine into GDScript under `GodotGame/scripts/`, as pure
logic/data with zero Nodes/scenes. Success is proven by GdUnit4 tests,
including golden-value tests cross-checked against actual TS engine output
for fixed seeds — the same seed must produce bit-identical results in both
engines.

## Non-goals (deferred to later sub-projects)

- Any scene/UI work: `VillageScene.tscn`, `ShrinePanel.tscn`,
  `RosterPanel.tscn`, `HeroInspector.tscn`, `TowerPanel.tscn`,
  `MissionView.tscn`, `FairyOverlay.tscn`, `DevPanel.tscn` (blueprint §3, §8)
  — **superseded for `DevPanel.tscn` (built 2026-07-01 — see
  `scenes/dev/dev_panel.tscn`)**; the rest of this list remains deferred as
  originally scoped
- `src/runtime/browser.ts` — DOM/bundle entrypoint, meaningless outside a
  browser, not ported
- The four-meter survival rework, `GameClock`, and other items the blueprint
  marks as "pending" (§4, §9) — this port is **faithful to what the TS engine
  does today**, including known bugs (e.g. `DAY_LENGTH` timing issue);
  fixing those is a TS-side decision, not part of a faithful port
- Firebase integration (separate concern, already set up via `.mcp.json`)

## Architecture

### Module mapping

1:1 file mapping, following `AGENTS.md`'s existing `scripts/`/`tests/`
convention (snake_case filenames):

| TS source | GDScript target |
|---|---|
| `src/engine/*.ts` (26 files) | `scripts/engine/*.gd` (e.g. `npcGenerator.ts` → `npc_generator.gd`) |
| `src/runtime/liveWorld.ts` | `scripts/runtime/live_world.gd` |
| `src/save/saveState.ts` | `scripts/save/save_state.gd` |
| `src/runtime/browser.ts` | *(not ported)* |

TS plain interfaces (`SoulAxes`, `NPC`, `WorldStory`, `Stamp`, `PastLife`,
`Memory`, `HeroLore`, `GenerationOptions`, etc.) become GDScript typed inner
classes (`class_name`) where the shape is reused often (`NPC`, `SoulAxes`),
or plain `Dictionary` for one-off return shapes — decided per-type during
implementation to match GDScript idiom rather than mechanically forcing a
class per TS interface.

### Determinism

The entire determinism burden is concentrated in `seeder.gd`:

- Reimplements `mulberry32` + the FNV-1a `hashString` from `src/engine/seeder.ts`
  exactly, with explicit 32-bit wraparound: GDScript `int` is 64-bit, so every
  step relying on JS's implicit `>>> 0` / `Math.imul` overflow needs masking
  with `& 0xFFFFFFFF`, plus a custom `imul32(a, b)` helper replicating
  `Math.imul`'s signed 32-bit multiply-with-wraparound.
- Floats need no special handling: both JS numbers and GDScript `float` are
  IEEE-754 double precision.
- `branch(suffix)` ports directly (string concat + fresh hash).

Once `seeder.gd` is proven bit-exact against golden vectors, every module
built on it inherits exactness automatically **as long as each module's
sequence of RNG calls matches the TS module's call order and branch suffixes
exactly**. Porting work for downstream modules is mostly mechanical
translation, with care taken to preserve call order.

## Golden vectors

One-time generation, in the **BetaLife repo** (separate git history from
`GodotGame`):

1. Add `scripts/exportGoldenVectors.ts` to `BetaLife-main` — runs the real
   engine for 5-6 fixed seeds (covering different stars/cultures/catastrophe
   types) and dumps JSON: raw seeder draws (first N `next()` values),
   generated `SoulAxes`, a full `NPC`, a `WorldStory`, name-generator output,
   and a few ticks of `liveWorld`/`saveState` round-trips.
2. Run once via `npx ts-node`, copy resulting JSON into `GodotGame` as
   `tests/fixtures/golden_vectors.json`.
3. The export script stays in BetaLife as a reusable tool, not a throwaway —
   useful again if the TS engine changes and the port needs re-verification.

## Testing strategy

GdUnit4, per `AGENTS.md`'s existing testing convention (`tests/` mirrors
`scripts/`, `test_<thing>.gd` naming):

- `tests/engine/test_seeder.gd` — **foundational test**: raw PRNG draws vs.
  golden vectors, byte-for-byte. Must pass before anything else is trusted.
- `tests/engine/test_<module>.gd` per engine file — covering each module's
  public functions, modeled on the assertions already in
  `BetaLife-main/scripts/testEngine.ts` (e.g. "world generation is
  deterministic & unique per seed", "stars↔memory tier mapping",
  "reproducible pastLife/lore")
- `tests/runtime/test_live_world.gd`, `tests/save/test_save_state.gd` —
  mirroring `BetaLife-main/scripts/testLive.ts` (evolution/save/determinism)
- GdUnit4 is not yet installed in `GodotGame` (no `addons/` present) —
  installing it is the first implementation step.

## Implementation order

Dependency-driven, bottom-up. Each module is ported and tested before moving
to the next, so failures stay localized:

1. `seeder` (+ golden-vector test — gate for everything downstream)
2. `axes`, `types`
3. `archetypes`, `stamps`, `nameGenerator`
4. `npcGenerator`, `town`, `world`, `historyGenerator`
5. `needs`, `behavior`, `conversations`, `dreams`, `mediator`
6. `combat`, `equipment`, `skills`, `gacha`, `expedition`, `monsters`,
   `progression`, `experience`, `stats`
7. `debug`, `index`
8. `runtime/live_world`
9. `save/save_state`

## Out of scope / follow-up sub-projects

Each blueprint §3 view becomes its own future spec (brainstormed
separately): Pueblo/Base scene, Invocación/Shrine, Roster, Hero Inspector,
Torre/Expedición + mission playback, Forja (reserved/future), Hada overlay,
Dev panel. The four-meter survival rework and `GameClock` (blueprint §2, §4)
are also separate future specs, to be done on the TS side first or ported
once the TS team finalizes that design.
