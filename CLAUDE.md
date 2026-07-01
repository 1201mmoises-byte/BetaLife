# GodotGame — Claude Code environment

New Godot 4.x project. This file is the Claude-specific brief; see `AGENTS.md` for
tool-agnostic project conventions (folder layout, code style, testing).

## Engine

- Godot **4.7** (standard/GDScript build, not Mono/.NET), installed at
  `C:\Users\Noobi\OneDrive\Documents\GodotGame\Godot_v4.7-stable_win64.exe\Godot_v4.7-stable_win64.exe`
  (note: the zip extracted into a folder of the same name as the exe — the
  binaries are one level deeper than the top-level path suggests; the folder
  lives inside the repo root for convenience but is gitignored, never committed).
  Also available as the `GODOT_BIN` user environment variable.
- Headless/CLI runs: `Godot_v4.7-stable_win64_console.exe --headless --path .`
  — `run/main_scene` is set (`scenes/dev/dev_panel.tscn`), so this now launches
  rather than erroring. For tests, still use the GdUnit4 runner (see
  `docs/superpowers/plans/2026-06-30-engine-port-milestone-1.md` and the
  `gdUnit4` addon entry below) — it runs headlessly via `-s` script mode
  independent of the main scene.
- First visible scene: `scenes/dev/dev_panel.tscn` + `scripts/dev/dev_panel.gd`
  — a dev-only "Hero Generator" panel exercising the ported engine (seeder →
  archetypes → axes → name_generator → gacha), styled with
  `assets/ui/betalife_theme.tres` (CC0 Kenney Fantasy UI Borders, tinted via
  `StyleBoxTexture.modulate_color`). Set as the project's global GUI theme
  (`[gui] theme/custom` in `project.godot`), so future scenes inherit it
  automatically. Supports `BL_DEV_SCREENSHOT=<path>` env var to self-capture
  a PNG and quit — useful for headless/background-session visual verification
  where OS-level screen capture isn't available.
- Editor plugins (LimboAI, Gaea) need at least one `--headless --editor --quit-after 3`
  pass after being added before their classes/UIDs are picked up by other
  headless invocations (test runner, scripts) — see `docs/TOOLING.md`.

## Godot addons (`addons/`, project-scoped)

- **`gdUnit4`** — test runner (see `docs/superpowers/plans/2026-06-30-engine-port-milestone-1.md`
  for the exact headless invocation).
- **`limboai`** — Behavior Trees + State Machines (GDExtension), the intended
  foundation for Hero decision-making/cognitive architecture. Windows-only
  binaries checked in for now (`compatibility_minimum = "4.2"`, forward-compatible
  with 4.7); re-pull other platform binaries from the release when exporting
  to a new target.
- **`gaea`** (v2.0.0-beta6, pre-release — no stable 2.0 cut exists yet as of
  2026-07-01) — procedural world/terrain generation. GDScript-only, low risk
  to swap out later if the beta proves unstable.

## MCP servers (project-scoped, `.mcp.json`)

- **`godot`** (`@coding-solo/godot-mcp`) — editor launch/run, debug-output capture,
  scene creation/node-add, MeshLibrary export, UID management.
- **`better-godot-mcp`** (`@n24q02m/better-godot-mcp`) — everything `godot` doesn't
  cover: GDScript CRUD, shaders, animation, tilemaps, physics, audio, navigation,
  UI controls, input map, signals. Use this one for actual scene/script editing;
  use `godot` for run/debug/launch.
- **`firebase`** (official `firebase-tools` CLI MCP, scoped to this directory,
  feature groups pinned via `--only core,auth,firestore,storage,functions,hosting,messaging`
  so they load even before `firebase.json` exists) — Authentication (user
  management), Cloud Firestore, Cloud Storage, Cloud Functions (logs/list only —
  deploys go through `firebase deploy` directly, not MCP-exposed, by design),
  Hosting, Cloud Messaging. **No Analytics support** — the official server doesn't
  expose Analytics tools (no MCP alternative does either, as of this setup).
  Already authenticated via the Firebase CLI login on this machine
  (`1201m.moises@gmail.com`). Project assigned: `betalife-223a1` (`.firebaserc`);
  only Hosting is configured so far.

## MCP servers (user-scoped, available in every project)

- **`context7`** — fetches up-to-date, version-specific library docs. Useful for
  Godot API/addon documentation lookups.
- **`sequential-thinking`** — structured step-by-step reasoning scratchpad for
  multi-step architecture/design decisions.

## Skills

- **`godot`** plugin (`Randroids-Dojo/skills` marketplace) — GDScript development
  patterns, GdUnit4 testing, PlayGodot automation, web/desktop export, CI/CD and
  deployment guidance. Invokes automatically when relevant.

## Deliberately not installed (see reasoning in the setup plan)

- **Filesystem MCP** — redundant with Claude Code's built-in Read/Write/Edit/Glob/Grep,
  which aren't sandboxed to the project root anyway. Revisit only if you need to
  hard-fence Claude to specific external folders (e.g. a shared asset library).
- **Memory MCP** — redundant with the `remember` plugin and Claude Code's built-in
  auto-memory, both already active. Revisit only for a structured-entity/knowledge-graph
  use case neither of those covers.
- **Playwright MCP** — only relevant if this project does an HTML5/web export and
  needs automated browser testing of it. Cheap to add later.

## Commands

(To be filled in once the project has real content — e.g. `godot --headless --export-release`
export presets, test runner invocation via GdUnit4.)
