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

## Maintenance notes (from 2026-07-01 audit)

Fixed this session:
- `superpowers` plugin scope corrected from project-only to user-scoped.
- GitHub remote configured; project pushed to `godot-port` branch.
- `gh` CLI installed and authenticated.

Flagged but **not yet fixed** (needs a decision, low risk either way):
- `CLAUDE.md`'s "No Firebase project is assigned yet" line is stale
  (`betalife-223a1` is assigned) — not corrected this session.
- `.gitignore` has no secrets guard-rail (`.env`, `*.pem`,
  `*serviceaccount*.json`) — nothing sensitive is tracked yet, but there's
  no proactive protection before Firebase Auth/Firestore work begins.
- `prompt-caching` plugin is one minor version behind its marketplace
  (1.0.0 installed vs 1.1.1 available).

Future recommendation:
- Before designing any AI Hero cognitive architecture (memory, perception,
  planning, decision-making) for this Godot project, read the TS engine's
  own design docs (`docs/`, `CLAUDE.md`, `.superpowers/` in the
  `BetaLife-main` repo/`main` branch) — that design likely already exists
  and should be ported/adapted rather than reinvented. This was in progress
  as of this audit; see the project's own session history for the outcome.
