# GodotGame — Claude Code environment

New Godot 4.x project. This file is the Claude-specific brief; see `AGENTS.md` for
tool-agnostic project conventions (folder layout, code style, testing).

## Engine

- Godot **4.7** (standard/GDScript build, not Mono/.NET), installed at
  `C:\Users\Noobi\Godot\Godot_v4.7-stable_win64.exe`.
- Headless/CLI runs: `Godot_v4.7-stable_win64_console.exe --headless --path .`

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
  (`1201m.moises@gmail.com`). **No Firebase project is assigned to this game
  yet** — run `firebase use --add` from this directory once you've created/chosen
  a project.

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
