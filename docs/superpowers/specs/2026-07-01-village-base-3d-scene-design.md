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
  `placeCamera()`/`framedCamera()`.
- Sky: `WorldEnvironment` + `ProceduralSkyMaterial` if its top/bottom
  gradient can match the previz's two-tone dome shader closely enough;
  otherwise a small custom sky shader reproducing `skyMat`'s vertex/fragment
  pair. Decide during implementation based on visual comparison, not upfront.
- Sun (`DirectionalLight3D`, warm, casts shadows) + moon (`DirectionalLight3D`,
  cool, dimmer, no shadows) + ambient/fill, driven by a single
  `time_of_day: float` (0..1) using the same elevation/smoothstep math as
  previz's `updateSky(tod)`.
- **Day length: 8640s (2.4 real hours/day, "reloj de doble tasa" 10× pueblo
  rate).** This is the *current* previz value (already fixed from the older
  buggy `DAY_LENGTH = 1200` the blueprint's §8 table still flags — that table
  predates the fix). Ported as-is; not the offline-catchup 3× dilation
  mentioned in project memory, which is a different mechanism (absent-player
  simulation, not live day/night rate).
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
  → (eventually) `gacha.gd` star roll. Real generated data, not hardcoded
  placeholders.
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
additional reachable scene, not a replacement.

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

Needs/behavior-driven hero AI (Cognition/Perception track), Forja
reconversion, Torre mission-playback view, Roster, Hero Inspector, Shrine
invocation flow — each remains its own future spec, per the engine-port
design doc's existing "Out of scope" list.
