---
name: betalife-engine-port
description: Use when porting a BetaLife TS engine module (src/engine/*.ts) to GDScript, or touching already-ported determinism-critical code (seeder, axes, archetypes, stamps, gacha, name_generator).
---

# BetaLife Engine Port

## Overview

BetaLife's engine is deterministic: the same seed must produce bit-identical
output in both the TS source and the GDScript port. This skill is the proven
methodology (6 modules ported, 31/31 tests passing) — follow it exactly,
don't improvise a new approach per module.

## Determinism rules (the entire burden lives in `seeder.gd`)

- `seeder.gd` reimplements `mulberry32` + FNV-1a `hashString` from
  `src/engine/seeder.ts` exactly, with explicit 32-bit wraparound: GDScript
  `int` is 64-bit, so every step relying on JS's implicit `>>> 0` /
  `Math.imul` overflow needs `& 0xFFFFFFFF` masking, plus a custom
  `imul32(a, b)` replicating `Math.imul`'s signed 32-bit wraparound multiply.
- Floats need no special handling — JS numbers and GDScript `float` are both
  IEEE-754 double precision.
- `branch(suffix)` ports directly (string concat + fresh hash).
- Once `seeder.gd` is proven bit-exact, every downstream module inherits
  exactness automatically **only if its sequence of RNG calls matches the TS
  module's call order and branch suffixes exactly**. Preserve call order —
  this is the single most common way a port silently diverges.

## Golden-vector workflow

1. In the **BetaLife-main** repo (not here): `scripts/exportGoldenVectors.ts`
   runs the real TS engine for fixed seeds and dumps JSON (raw seeder draws,
   generated structures, a few ticks of round-trips).
2. Run once via `npx ts-node`; copy the JSON into `GodotGame` as
   `tests/fixtures/golden_vectors.json`.
3. GDScript tests load `tests/fixtures/golden_vectors_loader.gd` and assert
   byte-for-byte equality against the ported module's output.
4. The export script stays in `BetaLife-main` as a reusable tool — re-run it
   if the TS engine changes and the port needs re-verification.

## Module mapping convention

1:1 file mapping, snake_case: `src/engine/npcGenerator.ts` →
`scripts/engine/npc_generator.gd`. TS plain interfaces become GDScript
`class_name` classes where the shape is reused often (`NPC`, `SoulAxes`), or
plain `Dictionary` for one-off return shapes — decide per-type to match
GDScript idiom, don't mechanically force a class per TS interface.

## Implementation order (dependency-driven, bottom-up)

Already done: `seeder` → `axes`/`types` → `archetypes`/`stamps`/`nameGenerator`
→ `gacha`. Remaining, in dependency order: `town`, `world`, `monsters` →
`combat`, `equipment`, `skills`, `progression`, `experience` → `expedition`
(orchestrates the above) → `needs`, `behavior`, `conversations`, `dreams`,
`mediator` → `debug`, `index` → `runtime/live_world` → `save/save_state`.
Port and test one module before starting the next — failures stay localized.

## Testing convention

GdUnit4, `tests/` mirrors `scripts/`, `test_<thing>.gd` naming (see
`AGENTS.md`). Golden-vector cross-check for ported modules with TS
precedent; ordinary TDD for genuinely new logic (no TS precedent exists —
that's `betalife-ai-architecture`'s territory, not this skill's).

## Quick reference — is this skill or betalife-ai-architecture?

| Has a TS source file? | Skill |
|---|---|
| Yes (`src/engine/*.ts` exists) | betalife-engine-port (this skill) |
| No — new autonomous-Hero logic | betalife-ai-architecture |
