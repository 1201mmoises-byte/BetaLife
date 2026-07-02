# BetaLife Living AI Architecture — Sub-project 1: Perception System

## Context

BetaLife's existing "soul engine" (`src/engine/` in the TS repo, partially
ported to `GodotGame/scripts/engine/`) is a narrative/simulation generator:
axes, archetypes, growth stamps, needs, silent background conversations, and
dream-surfaced backstory fragments all exist, but nothing perceives, thinks
continuously, or decides autonomously. The Living AI Architecture upgrade
asks for genuinely autonomous Heroes — perceiving, thinking, remembering,
adapting, and communicating as a *consequence* of living inside the world,
not because a dialogue system exists.

That upgrade is too large for one spec. It decomposes into sequential
sub-projects, each depending on the one before it:

1. **Perception** (this spec) — sensing substrate
2. Memory — multi-layer storage, fed by perception
3. Cognition loop — always-on thinking, reads memory + perception + needs
4. Social intelligence — relationships as first-class state
5. Communication-as-action — cognition may choose to speak
6. Daily life / combat learning — activity selection, skill practice

This spec covers **only Perception**. Later sub-projects get their own
spec → plan → implementation cycle.

## Reused systems (do not rebuild)

- **`axes.gd`/`archetypes.gd`/`stamps.gd`** (ported) — 14-axis personality,
  bounded drift. Attention (below) reads axes; sensory capability does not.
- **`behavior.gd`** equivalent (not yet ported) — the TS engine's pattern of
  translating axes into observable phrases, never raw numbers. Interpretation
  (below) will eventually follow this same "show, don't tell" precedent.
- **`skills.gd`** equivalent (not yet ported) — axis-emergent skill kit.
  Explicitly **not** reused for sensory variation (see Decisions). Flagged by
  the user as needing its own rework later (no training/practice loop) —
  out of scope here.
- **`godot-sqlite`** addon (installed) — intended backing store for Memory
  (sub-project 2), referenced here only because Perception's event log
  (catch-up path) will eventually need durable storage too.
- **`mediator.gd`** equivalent (not yet ported, the "Hada"/fairy) — reused
  conceptually for the offline caretaker tier (below), not modified by this
  spec.

## Cross-cutting decision: three-tier simulation fidelity

This is not Perception-specific, but Perception must be built to fit it, so
it's recorded here and should be treated as binding for every later
sub-project too:

1. **Owner online, Hero actively simulated** — the full pipeline runs live.
2. **Owner offline, town potentially visited by another player** — a town
   can't visibly freeze. The fairy runs a lightweight caretaker process on a
   coarse interval, applying real (not random) but lower-fidelity updates
   informed by each Hero's existing goals/needs/personality.
3. **Owner reconnects** — the full pipeline reconciles the elapsed gap in a
   fast, compressed burst: real computation (real memories, real relationship
   shifts, real appearance/skill changes), not a statistical approximation.
   The player sees a brief summary on top — the same aggregation pattern
   `mediator.ts`'s `reportActivity()` already uses for background
   conversations today.

**Time model (corrected 2026-07-01 — see the village-base-3d-scene-design
spec's Amendments section for the full correction):** adopted from
BetaLife's genre reference ("Pick Me Up! Infinite Gacha") — the town/pueblo
always runs at **3× real time** (1 real day = 3 in-world days, i.e. one
in-world day = 28800 seconds real time; `DAY_LENGTH = 28800.0`), while
Tower interiors run 1:1 real time. This 3× rate is the town's normal,
always-on live clock, not a mechanism exclusive to offline catch-up. Tier-3
catch-up burst math simply **fast-forwards that same town clock** across
the elapsed real-world gap — it fast-forwards `3 × days_away` worth of
in-world ticks because that's what the live clock would have produced,
not because catch-up applies its own separate dilation factor. The tier-3
catch-up architecture itself (coarse caretaker tier → full-pipeline
reconciliation burst on reconnect) is unchanged by this correction — only
the framing of *why* the multiplier is 3× changes.

**Why this constrains Perception specifically:** tier 3 must run the *same*
detection logic as tier 1, just compressed (potentially hundreds of thousands
of ticks with no scene loaded). That logic therefore cannot be hard-built on
`Area3D`/`RayCast3D`, which require a live, stepping physics world.

## Perception pipeline

Three independent layers, confirmed one at a time during brainstorming:

### 1. Sensory capability (physical, innate)

What a Hero can physically detect at all: vision range + a **160° base
forward-facing cone** (never omniscient 360°), hearing range. This is a new,
dedicated per-Hero trait set — **not** derived from the 14 personality axes,
and **not** part of `skills.gd`'s axis-emergent kit (combat/support skills
and raw sensory acuity are different things, even though `skills.ts` has one
perception-flavored entry, `explorar`). Rolled per-Hero at generation time
(same deterministic, seed-based pattern as axes/archetype), with headroom for
later modification by injury or dedicated training (not by personality).

### 2. Attention (personality-driven filter)

How much of what's physically in range actually gets *noticed*. Reuses the
existing 14-axis system: e.g. a curious Hero's attention catches subtler
things than a distracted one, even with identical sensory capability. Runs
as a cheap "did anything change since last check" gate — the expensive full
detection/processing path only fires on real novelty. Tuned to a **slow
cognition tick** (matching `needs.ts`'s tick model), not per physics frame —
required for hundreds of simultaneously-perceiving Heroes to be affordable.

### 3. Interpretation (knowledge/experience-driven) — stub only

What a noticed thing *means* (the lumberjack-recognizes-good-wood case).
Depends on accumulated domain-specific experience, which doesn't exist until
Memory (sub-project 2) does. This spec defines the interface Perception calls
("interpret(percept, hero) -> meaning") but the real implementation is
deferred. A stub returning the raw, uninterpreted percept is sufficient for
now.

## Implementation approach

**Core detection logic is engine-independent plain GDScript** — position,
distance, and angle math, not Godot physics nodes. This single core runs
identically whether fed by:

- **Live mode**: a Hero actually in a loaded scene. `Area3D` (broad-phase
  "what's nearby") and `RayCast3D` (line-of-sight occlusion — vision is
  blocked by walls, hearing is not) are a convenient *data feed* into the
  shared core, and double as the visualization/debugging layer. Runs on the
  slow cognition tick, not every physics frame.
- **Catch-up mode**: no scene loaded at all. The same core is fed by a
  lightweight world-event log instead of live physics queries, run in a tight
  loop with no rendering.

This is a deliberate reversal from an earlier draft of this design (native
`Area3D`/`RayCast3D` as *the* implementation) once it became clear tier 3
catch-up must be the same real pipeline, not an approximation — see the
brainstorming transcript for the reasoning.

## Non-goals (deferred)

- Full Interpretation logic (needs Memory — sub-project 2)
- `skills.gd` rework / training-based sensory improvement (explicitly
  deferred by the user, own future sub-project)
- Mission/Tower system port (`town`/`world`/`monsters`/`expedition` — already
  flagged in `docs/TOOLING.md`), autonomous Tower attempts, floor-replay
  training — all belong to Cognition/Combat-learning (sub-projects 3 and 6)
- Synthesis Chamber, Fairy personality/tone shift, economy/currency, class
  system — none of these touch Perception; captured in project memory for
  whichever sub-project ends up owning them
- Any concrete numeric tuning (exact sensory ranges, exact attention
  thresholds) — decided during implementation planning, not fixed here

## Testing approach

Following the project's established pattern (golden-vector cross-checks
against the TS engine for ported modules): Perception is **new** logic with
no TS-engine precedent, so it gets ordinary TDD (GdUnit4) instead — unit
tests per layer (sensory-capability generation, attention gating, the
engine-agnostic core's range/angle/occlusion math), plus an integration test
proving live-mode and catch-up-mode produce identical results when fed
equivalent input data.
