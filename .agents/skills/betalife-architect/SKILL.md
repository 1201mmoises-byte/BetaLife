---
name: betalife-architect
description: Use when starting new BetaLife feature or sub-project work, deciding what to build next, or needing the current roadmap/dependency order across the Living AI Architecture and engine-port tracks.
---

# BetaLife Architect

## Overview

BetaLife has two parallel, independent work tracks. This skill is the router
between them and the docs that hold their detail — it does not own technical
decisions itself.

## Two-repo relationship

- `GodotGame` (this repo) — the Godot 4.7 GDScript port. Target implementation.
- `BetaLife-main` (`C:\Users\Noobi\OneDrive\Documents\MoisesGame\BetaLife-main\BetaLife-main`,
  separate git history) — the TypeScript "soul engine" previz. Source of truth
  for anything not yet ported. Same GitHub repo, different unrelated branches
  (`main`/`gh-pages` = TS, `godot-port` = this repo).

## The two tracks

| Track | Status | Owning skill |
|---|---|---|
| Engine port (`src/engine/*.ts` → `scripts/engine/*.gd`) | 6 modules ported (seeder, axes, archetypes, stamps, name_generator, gacha). Remaining: `town`, `world`, `monsters`, `combat`, `equipment`, `progression`, `expedition`, `stats`, `skills`. | **REQUIRED:** betalife-engine-port |
| Living AI Architecture (autonomous Hero cognition) | Sequential: Perception (spec written, not implemented) → Memory → Cognition loop → Social intelligence → Communication-as-action → Daily life/combat learning. Each depends on the previous; do not start a later one before its predecessor is implemented. | **REQUIRED:** betalife-ai-architecture |

The two tracks are independent (either can proceed without the other), but
some AI-architecture work will eventually need ported modules (e.g. Cognition
reading `needs.ts`/`behavior.ts`) — check the engine-port table above before
assuming a TS module doesn't exist yet.

## Doc routing (delegate detail to betalife-docs)

- New sub-project design → `docs/superpowers/specs/YYYY-MM-DD-<name>.md`
- Implementation plan → `docs/superpowers/plans/YYYY-MM-DD-<name>.md`
- Tooling/addon/MCP changes → `docs/TOOLING.md`
- Structural/folder/code-style conventions → `AGENTS.md`
- Claude Code environment specifics (paths, MCP config) → `CLAUDE.md`

## What this skill does NOT do

Does not make Godot engineering, AI-architecture, or porting decisions itself
— defers to `betalife-engine-port`, `betalife-ai-architecture`, and the
generic `godot:godot` skill for those. Use this skill only to establish
sequencing and find the right doc/skill, then hand off.
