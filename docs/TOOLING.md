# Installed Tooling — MCP Servers, Plugins, and Skills

Snapshot of everything wired into Claude Code for this project. Last audited
2026-07-01 (see Maintenance notes below).
Sources: `.mcp.json` (project), `~/.claude/settings.json` and
`~/.claude/plugins/installed_plugins.json` (user), plugin cache at
`~/.claude/plugins/cache/`, `~/.claude.json` (user-scoped MCP servers), and
`skills-lock.json` (vendored project skills).

## MCP servers

### Project-scoped (`.mcp.json`, this repo only)

| Server | Package | Purpose |
|---|---|---|
| `godot` | `@coding-solo/godot-mcp` (npx) | Editor launch/run, debug-output capture, scene creation/node-add, MeshLibrary export, UID management. |
| `better-godot-mcp` | `@n24q02m/better-godot-mcp` (npx) | GDScript CRUD, shaders, animation, tilemaps, physics, audio, navigation, UI controls, input map, signals — everything `godot` doesn't cover. |
| `firebase` | `firebase-tools@latest mcp` (npx) | Auth, Firestore, Storage, Functions (logs/list only), Hosting, Messaging. Scoped via `--only core,auth,firestore,storage,functions,hosting,messaging`. No Analytics support (not exposed by the official server). |

### User-scoped (available in every project)

| Server | Purpose |
|---|---|
| `context7` | Up-to-date, version-specific library/API documentation lookups. |
| `sequential-thinking` | Structured step-by-step reasoning scratchpad for multi-step design decisions. |
| `prompt-caching-mcp` | Bundled with the `prompt-caching` plugin (below); automatic prompt-cache optimization. |

## Plugins (marketplace-installed, user-scoped)

| Plugin | Version | Marketplace | Description |
|---|---|---|---|
| `superpowers` | 6.1.0 | `claude-plugins-official` | Core skills library: TDD, systematic debugging, brainstorming→plan→subagent-driven implementation workflow, code review, git worktrees. Reinstalled at **user** scope 2026-07-01 (was accidentally project-scoped — see Maintenance notes). |
| `remember` | 0.8.3 | `claude-plugins-official` | Continuous memory — extracts/summarizes/compresses conversations into tiered daily logs (`.remember/`). |
| `frontend-design` | (unversioned) | `claude-plugins-official` | UI/UX design guidance for distinctive, intentional visual work. |
| `prompt-caching` | 1.0.0 | `ercan-ermis` | Automatic Anthropic prompt caching, zero-config; ships the `prompt-caching-mcp` server. |
| `godot` | 1.2.0 | `skills` | GDScript dev patterns, GdUnit4 testing, PlayGodot automation, web/desktop export, CI/CD guidance. |

## Skills

### From the `superpowers` plugin
`brainstorming`, `dispatching-parallel-agents`, `executing-plans`,
`finishing-a-development-branch`, `receiving-code-review`,
`requesting-code-review`, `subagent-driven-development`,
`systematic-debugging`, `test-driven-development`, `using-git-worktrees`,
`using-superpowers`, `verification-before-completion`, `writing-plans`,
`writing-skills`

### From other plugins
- `remember:remember` — save session state for clean continuation.
- `frontend-design:frontend-design` — visual/aesthetic direction for UI work.
- `godot:godot` — Godot 4.x develop/test/build/deploy.

### Bundled with Claude Code (built-in, no plugin)
`update-config`, `keybindings-help`, `verify`, `code-review`, `simplify`,
`fewer-permission-prompts`, `loop`, `schedule`, `claude-api`, `run`, `init`,
`review`, `security-review`

### Project-vendored (this repo only)
Pulled from `firebase/agent-skills` on GitHub, tracked in `skills-lock.json`,
mirrored into both `.agents/skills/` and `.claude/skills/`:

`firebase-ai-logic-basics`, `firebase-app-hosting-basics`,
`firebase-auth-basics`, `firebase-basics`, `firebase-crashlytics`,
`firebase-data-connect`, `firebase-firestore`, `firebase-hosting-basics`,
`firebase-remote-config-basics`, `firebase-security-rules-auditor`,
`xcode-project-setup`

## Godot addons (`addons/`, project-scoped, checked into the repo)

| Addon | Version | Type | Purpose |
|---|---|---|---|
| `gdUnit4` | (see `addons/gdUnit4`) | GDScript editor plugin | Test runner used by every module's test suite. |
| `limboai` | v1.8.0 (GDExtension build tagged 4.6, forward-compatible to 4.7) | GDExtension, no `plugin.cfg` (auto-registers) | Behavior Trees + State Machines — the intended foundation for autonomous Hero decision-making/cognitive architecture. Windows-only binaries checked in (~9 MB); other platform binaries deliberately stripped from the release download to keep repo size down — re-pull from [limbonaut/limboai releases](https://github.com/limbonaut/limboai/releases) (`gdextension-4.6.zip` asset) when exporting to a new platform. |
| `gaea` | v2.0.0-beta6 | GDScript editor plugin | Procedural world/terrain generation (noise, WFC, cellular automata graph system). **Pre-release** — Gaea's 2.0 line has never cut a stable tag as of 2026-07-01; chosen anyway since it's the actively-maintained (1.6k★), GDScript-only (easy to swap) option and no world-gen work depends on it yet. |

New GDExtension/editor-plugin addons need one `--headless --editor --quit-after 3`
pass (which triggers a full filesystem scan/import) before their classes are
visible to other headless invocations (test runner, `--script` runs) — a bare
`--headless --script foo.gd` run will silently fail to see newly-added
GDExtension classes or new `.gd` files (missing `.uid` sidecar) otherwise.

## Randomization / procedural systems (`scripts/engine/`, ported from the TS engine)

| Module | Status | Purpose |
|---|---|---|
| `seeder.gd` (`BLSeeder`) | Ported, Milestone 1 | Bit-identical mulberry32 PRNG + FNV-1a seed hash. |
| `gacha.gd` (`BLGacha`) | Ported 2026-07-01 | Weighted star-rating (1★-5★) rolls for Hero summoning — difficulty-scaled probability curve with a roster-progress bonus that lerps between "hard world, suppressed high tiers" and "easy world, boosted high tiers, 25% 5★ ceiling." Golden-vector-verified against `src/engine/gacha.ts` (see `scripts/exportGoldenVectors.ts`'s `gacha` section in the TS repo). |

For generic "roll a random world-content layout" needs (terrain, dungeons),
use the `gaea` addon above rather than hand-rolling — it doesn't touch
`BLSeeder`'s determinism guarantees since it's used for spatial content
generation, not gameplay-affecting rolls.

## Deliberately not installed

Per `CLAUDE.md`:
- **Filesystem MCP** — redundant with Claude Code's built-in Read/Write/Edit/Glob/Grep.
- **Memory MCP** — redundant with `remember` + built-in auto-memory.
- **Playwright MCP** — only relevant for an HTML5/web export of this game; cheap to add later.

## Global development tools

| Tool | Status | Notes |
|---|---|---|
| `gh` (GitHub CLI) | Installed 2026-07-01 via `winget install --id GitHub.cli` | Authenticated as `1201mmoises-byte`. Not on PATH in already-open shells — new shells pick it up automatically. |
| Claude Code | v2.1.197, npm install | `~/.claude` at `C:\Users\Noobi\.claude`. |

## Version control & hosting

- This repo (`GodotGame`, the Godot 4.7 port) now has a remote: `origin` →
  `https://github.com/1201mmoises-byte/BetaLife.git`, pushed to branch
  **`godot-port`** (not `main`) on 2026-07-01.
- That same GitHub repo's `main` and `gh-pages` branches hold the **original
  TypeScript "soul engine" previz** (`BetaLife-main`, also present locally at
  `C:\Users\Noobi\OneDrive\Documents\MoisesGame\BetaLife-main\BetaLife-main`)
  — the source this Godot project is porting from. The two codebases now
  share one GitHub repo but live on separate branches; they have **unrelated
  git histories** (never merged) by design.
- Firebase project **is** assigned: `.firebaserc` → `betalife-223a1`.
  `firebase.json` currently only configures Hosting (static `public/` dir);
  no Firestore/Functions/Storage/Auth config exists yet even though the
  `firebase` MCP server is scoped for all of those. (`CLAUDE.md` still says
  "No Firebase project is assigned yet" as of this audit — that line is
  stale and not yet corrected.)
- No CI (`.github/workflows`) and no `export_presets.cfg` yet — appropriate
  for now, since no scenes/exports exist in this repo yet either.

## Maintenance notes (from 2026-07-01 audit, updated same day)

Fixed 2026-07-01 (first pass):
- `superpowers` plugin scope corrected from project-only to user-scoped.
- GitHub remote configured; project pushed to `godot-port` branch.
- `gh` CLI installed and authenticated.

Fixed 2026-07-01 (second pass — AI-architecture tooling):
- `CLAUDE.md`'s stale Firebase line and stale Godot install path both corrected.
- `.gitignore` secrets guard-rail added (`.env`, `*.pem`, `*.key`,
  `*serviceaccount*.json`, `firebase-debug.log`).
- `limboai` and `gaea` addons installed (see table above) as the Godot-native
  foundation for Hero decision-making and world-content generation.
- `gacha.ts` ported to `scripts/engine/gacha.gd` (`BLGacha`) via TDD, golden-vector
  verified — the engine's actual weighted-randomization system, in place of a
  generic ad-hoc utility.

Still **not fixed** (needs a manual step, low risk either way):
- `prompt-caching` plugin is one minor version behind its marketplace
  (1.0.0 installed vs 1.1.1 available). This is a Claude Code plugin-cache
  update, not a repo file — run `/plugin update prompt-caching` (or reinstall
  via the marketplace) from an interactive session; not something this
  session can safely hand-edit from `~/.claude/plugins/cache`.

Future recommendation:
- Before designing any further AI Hero cognitive architecture (memory,
  perception, planning, social/emergent behavior) for this Godot project,
  read the TS engine's own design docs (`docs/`, `CLAUDE.md`, `.superpowers/`
  in the `BetaLife-main` repo/`main` branch) and continue porting its engine
  modules (following the `gacha.ts` example above) rather than inventing new
  systems from scratch — `limboai`'s Behavior Trees/State Machines are the
  Godot-side execution layer once that design is ported.
