# GodotGame — agent project brief

Tool-agnostic conventions for working in this repo. Claude Code users: see
`CLAUDE.md` for the MCP/skill setup specific to this environment.

## Project

Godot 4.7 (GDScript, standard build — not Mono/.NET). No longer an empty
scaffold: as of 2026-07-01 the project has `scenes/dev/`, `scripts/engine/`
(6 ported modules), `scripts/dev/`, `tests/` (8 suites, 31 test cases), and
4 addons (`gdUnit4`, `limboai`, `gaea`, `godot-sqlite`). The structure below
describes the layout as it's actually used today, not an aspiration.

## Folder structure (in use, mirrored as content grows)

```
scenes/      .tscn scene files, one subfolder per feature/area
scripts/     .gd scripts, mirroring the scenes/ layout where a script is scene-specific;
             shared/global scripts (autoloads, utilities) live in scripts/global/
assets/      art, audio, fonts — subfolder per asset type
addons/      third-party Godot plugins (GdUnit4 etc.)
tests/       GdUnit4 test suites, mirroring scripts/ layout
```

## Code style

- GDScript, static typing preferred (`var x: int = 0` over `var x = 0`) for
  anything beyond trivial local scratch variables.
- Signals over polling/direct cross-node references where it keeps coupling low.
- Autoloads (singletons) only for genuinely global state (game state, save data,
  event bus) — not as a substitute for proper scene composition.

## Testing

GdUnit4 (via the `godot` skill). Test files mirror the source file they cover,
named `test_<thing>.gd`, under `tests/`.

## Source control

`.gitignore` already configured for Godot's generated/import directories
(`.godot/`, `.import/`, etc.) — those should never be committed.
