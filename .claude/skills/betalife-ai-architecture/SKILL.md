---
name: betalife-ai-architecture
description: Use when designing or implementing Hero perception, memory, cognition, planning, decision-making, social/relationship, communication, or emergent-behavior systems for BetaLife.
---

# BetaLife AI Architecture

## Overview

BetaLife's Living AI Architecture upgrade makes Heroes genuinely autonomous:
perceiving, thinking, remembering, and deciding as a consequence of living in
the world — not because a dialogue/behavior-tree script exists. Every
sub-project below must satisfy the same binding constraint (below) or it will
need to be rebuilt, as already happened once (see Precedent).

## Sub-project sequence (each depends on the previous)

1. **Perception** — sensing substrate. Spec written:
   `docs/superpowers/specs/2026-07-01-perception-system-design.md`. Not yet implemented.
2. **Memory** — multi-layer storage, fed by perception. Intended backing store:
   `godot-sqlite` addon (installed, unused so far).
3. **Cognition loop** — always-on thinking; reads memory + perception + needs.
4. **Social intelligence** — relationships as first-class state.
5. **Communication-as-action** — cognition may choose to speak.
6. **Daily life / combat learning** — activity selection, skill practice.

Do not start a later sub-project's implementation before its predecessor
exists — each spec explicitly reuses the prior layer's output.

## Binding constraint: three-tier simulation fidelity

Every AI system (not just Perception) must work across all three tiers:

1. **Owner online** — full pipeline runs live.
2. **Owner offline** — a lightweight fairy/caretaker process applies real
   (not random) lower-fidelity updates on a coarse interval.
3. **Owner reconnects** — full pipeline reconciles the elapsed gap in a fast
   compressed burst (real computation, not statistical approximation),
   surfaced to the player as a summary.

**Time dilation:** 1 real day = 3 in-world days (from "Pick Me Up! Infinite
Gacha" precedent). Catch-up math fast-forwards `3 × days_away` in-world ticks.

## Required pattern: engine-agnostic core

Detection/decision logic must be plain GDScript (position/distance/angle
math, state transitions) with **no Godot physics-node dependency**, fed by a
swappable data source:

- Live mode: `Area3D`/`RayCast3D` as a convenient data feed + visualization
  layer, running on a slow cognition tick (not per physics frame — required
  for hundreds of simultaneously-perceiving Heroes to be affordable).
- Catch-up mode: same core, fed by a lightweight world-event log instead,
  run in a tight loop with no scene loaded.

**Precedent (why this is non-negotiable):** an earlier Perception draft built
detection directly on `Area3D`/`RayCast3D` as *the* implementation. It was
reversed once tier-3 catch-up requirements made clear that hundreds of
thousands of ticks must run with no scene loaded at all — physics nodes
can't do that. Don't repeat this mistake for Memory/Cognition/Social/etc.

## Open question — do not silently resolve

Whether Hero cognition is classical/GOFAI (state machines, utility scoring,
`limboai` BT) or partly LLM-driven (Claude API at runtime) is **undecided**.
`agent-sdk-dev` plugin is installed as a hedge, not a decision. Flag this
explicitly when it becomes load-bearing (Cognition loop, sub-project 3) —
don't default to either silently.

## Collaborates with

- **betalife-engine-port** — for anything that's actually a TS-engine port
  (e.g. `needs.ts`, `behavior.ts`, `mediator.ts`) rather than new AI logic.
- `limboai` addon — the execution layer (BT/FSM) once a design here is ready;
  this skill owns the design, not the addon's node-graph mechanics.
- **REQUIRED BACKGROUND:** read the relevant sub-project spec in
  `docs/superpowers/specs/` before designing — this skill summarizes binding
  constraints, not full designs.
