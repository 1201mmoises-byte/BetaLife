# BetaLife Godot Port — Sub-project: Pueblo/Base 3D Scene

## Context

The engine-port sub-project (`2026-06-30-engine-port-design.md`) ported
`seeder`, `axes`, `archetypes`, `stamps`, `nameGenerator`, and `gacha` from
the TS "soul engine" into GDScript — pure logic, explicitly **no rendering**.
That spec's own "Out of scope" section named the blueprint's §3 views,
including "Pueblo/Base scene," as separate future sub-projects. This is that
sub-project.

**Clarifying the premise that started this work:** it is not the case that
3D assets were ported from HTML to Godot and then lost. There never were any
3D asset files, in either codebase. The TS repo's "HTML/Three.js implementation"
(`BetaLife-main/preview/slice.js`, ~2000 lines) renders its one 3D scene —
the village — entirely from code: primitive Three.js geometry (52
box/cylinder/cone/sphere/etc. calls), canvas-drawn procedural textures (grass
speckle, radial sun glow, text-label sprites), and a scripted day/night light
cycle. Its own blueprint doc (`BetaLife-main/docs/BLUEPRINT-MENUS-Y-SISTEMA.md`)
explicitly labels this **"previz, not product"** — a placeholder always meant
to be rebuilt as real Godot scenes, not carried over. Nothing was lost in the
Godot port; the 3D layer simply hasn't been built yet, and this spec is that
build.

Everything else in the TS previz (Roster, Torre team formation, Hero sheet,
Dev tabs) is flat HTML/CSS/DOM, not 3D, and stays out of scope here — only
`slice.js`'s Three.js village (blueprint §3.1 "Pueblo / Base") is being ported.

## Goal

A new Godot scene, **Village/Base**, faithfully reproducing the previz
village: ground, isometric-orbit camera, day/night sky, 6 named structures,
simple role-colored hero figures spawned from the already-ported engine data,
and a wandering fairy avatar. Reached from the existing Dev Panel via a
button; does not replace it as the project's main scene.

Visual style is a **faithful primitive port** — same low-poly/primitive
construction as the previz, in Godot's own primitive meshes. No external 3D
assets are sourced for this pass (per the user's explicit direction and the
project's standing "Godot-native visual tooling only" preference).

## Non-goals (deferred)

- **Full needs/activity-driven hero behavior.** The previz's `updateHero()` /
  `pickActivity()` state machine (idle/train/rest/eat/walk/talk) reads from
  `needs.ts`, `behavior.ts`, `mediator.ts`, `conversations.ts` — none of
  which are ported to GDScript yet (engine-port step 5, not started). Hero
  figures in this scene get a lightweight placeholder motion (idle bob +
  slow wander between named spots) instead. Full AI-driven behavior is
  future Cognition/Perception work, already tracked separately
  (`betalife-ai-architecture` skill, LimboAI).
  **SUPERSEDED — see "## Amendments (2026-07-01, approved)" below.** This
  milestone now also ports the previz's classical behavior stack
  (`needs.gd`/`behavior.gd`/`conversations.gd`/`experience.gd`/`mediator.gd`)
  and a `village_sim.gd` pueblo tick; the full Living-AI cognition chain
  (Perception→Memory→Cognition) is unaffected and still comes later.
- **The Cámara de los Ecos / Forja reconversion.** The blueprint itself marks
  this structure "✗ a reconvertir (Merger ≠ novela)" — still undecided on the
  TS side. Build its exterior (matches previz's `chamber()`) but don't wire
  interactive logic to it.
- **GameClock rework, four-meter survival system.** Out of scope; this spec
  ports the *current* day/night timing value as-is (see below), not a
  redesign of it.
- Sourcing any external 3D asset packs — explicitly ruled out for this pass.
- Torre mission playback, Roster, Hero Inspector, Shrine invocation flow —
  separate future sub-projects per the engine-port spec's "Out of scope"
  list.

## Architecture

### Scene layout

```
scenes/village/
  village_base.tscn        — root Node3D, camera, WorldEnvironment, day/night driver
  hero_figure.tscn          — reusable role-colored figure (legs/torso/head primitives)
  fairy_avatar.tscn         — small glowing capsule+wings

scripts/village/
  village_base.gd           — day/night tick, spot registry, camera orbit input
  hero_figure.gd            — idle bob + wander-between-spots placeholder motion
  fairy_avatar.gd           — independent wander
  spots.gd                  — named-position lookup (torre/shrine/posada/campo/fusion/plaza),
                              mirrors previz's `PLACES`/`place()`
```

### Ground, camera, sky

- Outer grass: flat circular mesh, radius 130, speckled green procedural
  texture (`GradientTexture2D`/noise, matching `grassTexture()`'s canvas
  speckle look — exact pixel technique doesn't need to match, the visual
  effect does).
- Inner village floor: flat circle, radius 18, dark stone material.
- `Camera3D`, **orthogonal** projection, drag-to-orbit around a fixed target
  (`camTarget` in previz sits at half-structure-height, not ground level) —
  azimuth + pitch (~19° above horizon) + fixed distance (~30), matching
  `placeCamera()`/`framedCamera()`. **AMENDED — see "## Amendments
  (2026-07-01, approved)" below**: zoom and pan are added on top of this
  orbit so the player can move through the town.
- Sky: `WorldEnvironment` + `ProceduralSkyMaterial` if its top/bottom
  gradient can match the previz's two-tone dome shader closely enough;
  otherwise a small custom sky shader reproducing `skyMat`'s vertex/fragment
  pair. Decide during implementation based on visual comparison, not upfront.
- Sun (`DirectionalLight3D`, warm, casts shadows) + moon (`DirectionalLight3D`,
  cool, dimmer, no shadows) + ambient/fill, driven by a single
  `time_of_day: float` (0..1) using the same elevation/smoothstep math as
  previz's `updateSky(tod)`.
- **Day length: OBSOLETE PREVIZ VALUE, corrected — see "## Amendments
  (2026-07-01, approved)" below.** This section originally specified 8640s
  (2.4 real hours/day, "reloj de doble tasa" 10× pueblo rate), the *then-
  current* previz value (already fixed from the older buggy
  `DAY_LENGTH = 1200` the blueprint's §8 table still flags — that table
  predates the fix), ported as-is, and explicitly described as **not**
  related to the offline-catchup 3× dilation mentioned in project memory
  (treated at the time as a different mechanism — absent-player simulation,
  not live day/night rate). The user corrected this same-day: under the
  corrected model, the 3× IS the live town clock (Tower interior is 1:1),
  and offline catch-up simply fast-forwards that same clock rather than
  being a separate dilation mechanism. See the Amendments section for the
  replacement value (`DAY_LENGTH = 28800.0`) and full corrected model.
- Faint starfield (`MultiMeshInstance3D` or `GPUParticles3D`, static points),
  opacity driven by night-ness, matching previz's `stars()`.

### Structures (6, fixed relative positions, primitive-built)

Positions mirror previz's `PLACES` (torre 0,-8 · shrine -6,3 · posada 7,-2 ·
campo 6,5 · fusion -7,-4 · plaza 0,1), same relative scale:

| Structure | Construction | Distinguishing detail |
|---|---|---|
| Torre | Cylinder body + cone roof | 5 emissive "windows," `OmniLight3D` glow — visual anchor, not enterable |
| Shrine | Cylinder dais + crystal | Octahedron-ish emissive crystal (Godot has no built-in octahedron primitive — approximate with a small custom `ArrayMesh` or a scaled/rotated `PrismMesh`, decided during implementation), purple point light |
| Posada | Box body + cone roof | One warm emissive window + point light |
| Campo de Entrenamiento | Circular pad + fence posts + training-dummy figures | Widest footprint, most "observable growth" real estate per blueprint |
| Cámara de los Ecos (Fusión) | Enclosed chamber | Exterior only (see non-goals) |
| Plaza | Campfire + logs | Particle/emissive fire, no structure body |

Labels via `Label3D` (billboard text) — cleaner native equivalent of previz's
canvas-texture sprite hack (`makeLabel()`), same information, no need to
reproduce the canvas-drawing technique itself.

### Hero figures + fairy

- `hero_figure.tscn`: stacked primitive meshes (legs = `BoxMesh`, torso =
  `BoxMesh`, head = `SphereMesh`), material color set at spawn time from a
  `ROLE_VIS`-equivalent GDScript dictionary (warrior/mage/rogue/archer —
  skin/armor/leg/accent colors + headgear kind), mirroring previz's
  `buildHero(role)`/`ROLE_VIS`.
- Spawned using the **already-ported** pipeline: seed → `archetypes.gd` role
  → `gacha.gd` star roll (`gacha.gd` was ported and golden-verified
  2026-07-01, after this spec's original draft — hero spawn uses it now,
  not "eventually"). Real generated data, not hardcoded placeholders.
- Motion: idle breathing bob (sine-wave y-offset, matches previz's `phase`
  bob) + slow position drift to a randomly-chosen named spot, pause, repeat.
  This is intentionally simpler than previz's full state machine (see
  non-goals) — just enough for the village to feel inhabited.
- `fairy_avatar.tscn`: small glowing capsule + simple wing quads, emissive
  material, wanders independently of hero figures — matches previz's
  `buildFairy()`. No personality/dialogue hookup here (that's the
  already-decided-separately fairy-tone work in project memory).

### Integration point

New scene reachable from the existing Dev Panel (`scenes/dev/dev_panel.tscn`)
via a button ("Enter Village" or similar) that changes scene to
`village_base.tscn`. `run/main_scene` stays on the Dev Panel; this is an
additional reachable scene, not a replacement. **AMENDED — see "##
Amendments (2026-07-01, approved)" below** for the new `scripts/global/roster.gd`
autoload that lets dev-panel-generated heroes carry over into the village,
and for the new in-game UI panels (`scenes/village/village_ui.tscn`).

## Testing strategy

- `tests/village/test_spots.gd` (GdUnit4) — pure-logic check on `spots.gd`'s
  named-position lookup and any deterministic day/night math extracted into
  testable functions (e.g. a standalone `time_of_day_to_sun_elevation(tod)`
  helper), per `AGENTS.md`'s existing convention.
- Everything else (camera framing, lighting look, structure placement, hero
  motion) is visually verified, not unit-tested — matches how the Dev Panel
  milestone was verified. Use `run_project`/`get_debug_output` (godot MCP)
  and the existing `BL_DEV_SCREENSHOT=<path>` self-capture env var for
  headless/background visual confirmation before calling any task done.

## Implementation order

1. Ground + camera + empty sky (get *something* rendering and navigable first)
2. Day/night driver (`time_of_day`, sun/moon/ambient, sky color lerp, stars)
3. Six structures (can be split across parallel subagents — each structure
   is visually and logically independent)
4. `hero_figure.tscn` + role palette + spawn-from-engine-data + placeholder
   wander motion
5. `fairy_avatar.tscn`
6. Dev Panel → Village Base navigation button
7. Visual verification pass (screenshot, compare against previz intent) +
   docs update (`betalife-docs`)

## Out of scope / follow-up sub-projects

Needs/behavior-driven hero AI (Cognition/Perception track) **— PARTIALLY
SUPERSEDED, see "## Amendments (2026-07-01, approved)" below**: this
milestone now ports the previz's own classical needs/behavior/conversation
layer (not the full Living-AI cognition chain, which remains future work
and is unaffected). Forja reconversion, Torre mission-playback view,
Roster, Hero Inspector, Shrine invocation flow — each remains its own
future spec, per the engine-port design doc's existing "Out of scope" list.

## Amendments (2026-07-01, approved)

Everything above this heading is the **original scope**, as brainstormed and
approved on 2026-07-01, and is left in place (with inline "SUPERSEDED" /
"AMENDED" pointers added at the specific spots this section changes) rather
than rewritten, per the project's spec-first, don't-rewrite-history
convention. Everything below is an **amendment**, approved the same day
after further review (including a direct user correction of the time
model — see item 2, the most important change here).

### 1. Camera: zoom + pan

In addition to the original drag-to-orbit, the camera also supports:

- **Zoom**: clamped orthographic `size` (mouse wheel and/or keys), lerped
  toward the target value rather than snapping.
- **Pan**: drag-pan bound to a second mouse button, AND WASD/edge-pan, so
  the player can move the camera target through the town rather than only
  orbiting a fixed point.

New input-map actions are added to `project.godot` for these (orbit-drag,
pan-drag, zoom-in/out, and the WASD pan directions) — exact action names
and bindings are an implementation detail decided when the camera script is
built, not fixed here.

### 2. Canonical time model (user correction — supersedes the previz value)

**This is the single most important correction in this amendment.** The
original spec's `DAY_LENGTH = 8640s` ("10× pueblo rate," see the inline
SUPERSEDED note above under Ground/camera/sky) was a faithfully-ported
*previz* value and is now obsolete. It is replaced by the following
canonical model, which also supersedes the "not the offline-catchup 3×
dilation... a different mechanism" claim in the original text — under this
corrected model, the 3× rate IS the same live clock, not a separate one:

- The game clock is **dual-rate**:
  - **Town/pueblo always runs at 3× real time** — 1 real day = 3 in-world
    days, i.e. one in-world day = **28800 seconds of real time**
    (`DAY_LENGTH = 28800.0`).
  - **Tower interior runs 1:1 real time** (no dilation while inside a Tower
    expedition).
- **Offline catch-up fast-forwards the same town 3× clock.** It is NOT a
  separate dilation mechanism layered on top — it is the identical
  always-on town clock, simply advanced in a compressed burst while the
  owner was away, exactly as already described in
  `docs/superpowers/specs/2026-07-01-perception-system-design.md`'s
  tier-3 catch-up architecture (see that spec's own phrasing fix, made
  alongside this one).
- `DAY_LENGTH = 28800.0` (seconds of real time per in-world day) is the
  canonical constant for the town clock going forward. Any future
  implementation of the day/night driver (`village_base.gd`'s
  `time_of_day` tick) uses this value, not the previz's 8640s.

### 3. Behavior-driven heroes (replaces "wander-only" scope + the non-goal)

This milestone **also** ports the TS behavior stack to `scripts/engine/`,
1:1 from `src/engine/*.ts` in the BetaLife-main repo, using the same
golden-vector TDD methodology as the prior engine-port modules
(`seeder`/`axes`/`archetypes`/`stamps`/`nameGenerator`/`gacha`):

- `needs.gd`
- `behavior.gd`
- `conversations.gd`
- `experience.gd`
- `mediator.gd`

A new `scripts/village/village_sim.gd` runs a **5 second pueblo tick**
(scaled by a dev speed multiplier) that:

1. Decays needs.
2. Selects a utility-scored activity (reference implementation: the
   previz's own `updateHero()`/`pickActivity()` in `preview/slice.js` —
   this reference is view-layer inspiration only, not golden-vector
   tested, unlike the ported `.ts` modules above).
3. Moves the hero to the spot matching the chosen activity: `campo` = train,
   `posada` = rest, `plaza` = eat/social.
4. Runs proximity-based `roll_conversation` (40-tick cooldown, per-pair
   seeder branch streams, matching the ported `conversations.gd`'s
   determinism rules).
5. Applies `apply_conversation_nudges` back into the roster's hero data.

`village_sim.gd` emits `exchange_occurred` and `hero_state_changed` signals
for the UI layer (see item 4).

This supersedes the original spec's "lightweight placeholder motion (idle
bob + slow wander between named spots)" hero behavior and the "Full
needs/activity-driven hero behavior" non-goal — see the inline SUPERSEDED
note under Non-goals above. It does **not** touch the full Living-AI
cognition chain (Perception→Memory→Cognition, per
`betalife-ai-architecture`) — that remains separate, future work, unchanged
by this amendment. This is the previz's own classical/GOFAI behavior layer,
not an early version of Living-AI cognition.

### 4. In-game UI panels (new)

A new Control overlay, `scenes/village/village_ui.tscn`, inheriting the
project's global theme (`assets/ui/betalife_theme.tres`), with three parts:

- **Dev overlay** (toggled by an F1 input action): hero generator (reuses
  the existing dev-panel generation pipeline) with spawn-into-village,
  a time-of-day slider, a tick-speed multiplier control, and a hero
  inspector on click showing name/stars/archetype/needs bars/
  `first_impression` behavior cues — observable information only, never
  raw axis values (same "show, don't tell" rule the engine already follows
  elsewhere).
- **Fairy reports panel** (player-facing): recent conversation summaries
  via `mediator.report_activity` (e.g. "entrenan juntos" style phrasing),
  plus `brief_roster` / `describe_npc` output.
- **Dev-only raw conversation log tab**: full `Exchange` records
  (participants, topic, intensity, nudges) — a debug tool, not
  player-facing.

The silent-conversation design rule is unchanged and applies here: players
only ever see the fairy's observable reports; the raw exchange log is a
dev-only tool, never shown in the normal player-facing UI.

### 5. Roster autoload

`scripts/global/roster.gd` — the project's **first autoload** — holds
generated heroes in memory so heroes created in the Dev Panel can enter the
village and be simulated by `village_sim.gd`. No persistence/SQLite is in
scope this milestone (the roster is memory-only and resets on restart);
`godot-sqlite`-backed persistence remains future work.

### 6. `gacha.gd` phrasing fix

See the inline fix under Hero figures + fairy above: the original spec's
"(eventually) `gacha.gd` star roll" phrasing is corrected — `gacha.gd` was
already ported and golden-verified as of 2026-07-01 (after this spec's
original draft), so hero spawn uses it now, not eventually.

### 7. Mediator divergence note

`mediator.gd` is ported **as-is** this milestone, including its "sin
personalidad" (no-personality) design comment carried over verbatim from
`mediator.ts`. This is a faithful port, not an endorsement of that neutral
tone: project memory already records that a later sub-project will
deliberately shift the fairy to a personality-driven voice (see the
"Time dilation + fairy tone" memory entry). This note exists so the
as-ported neutral `mediator.gd` isn't mistaken for a design decision to
keep the fairy voiceless going forward — it is a known, planned future
divergence, not an oversight.
