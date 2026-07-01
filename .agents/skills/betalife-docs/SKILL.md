---
name: betalife-docs
description: Use after adding a BetaLife addon, MCP server, plugin, ported module, or new sub-project spec, to determine which project doc needs updating.
---

# BetaLife Docs

## Overview

BetaLife's docs have drifted stale multiple times in a single day (CLAUDE.md's
Godot path, AGENTS.md's "empty scaffold" line long after 6 modules were
ported). This skill is a routing checklist, run right after a change that
should be documented — not a general writing-quality skill.

## Routing table

| You just... | Update |
|---|---|
| Installed/removed an addon, MCP server, or plugin | `docs/TOOLING.md` |
| Ported a TS engine module | `docs/TOOLING.md` (module status table) |
| Started a new Living AI sub-project design | `docs/superpowers/specs/YYYY-MM-DD-<name>.md` (new file) |
| Wrote an implementation plan | `docs/superpowers/plans/YYYY-MM-DD-<name>.md` (new file) |
| Changed folder layout, code style, or testing convention | `AGENTS.md` |
| Changed a path, env var, or MCP config specific to this machine/environment | `CLAUDE.md` — **delegate the actual audit to the `claude-md-management` plugin** (already installed; don't duplicate its quality checks here) |
| Moved/renamed anything referenced by `.gitignore` | Check `.gitignore` still matches |

## What this skill does NOT do

Does not audit CLAUDE.md quality itself (that's `claude-md-management`), and
does not own the *content* of any architecture decision — it only flags which
file that content belongs in. If unsure which sub-project/track a change
belongs to, check `betalife-architect` first.

## Red flag

If you're about to end a work session and haven't touched any doc despite
adding a module, addon, or spec — stop and check this table before finishing.
