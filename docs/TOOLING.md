# Installed Tooling — MCP Servers, Plugins, and Skills

Snapshot of everything wired into Claude Code for this project. Last audited
2026-07-01, updated same day across three passes (see Maintenance notes below).
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
| `prompt-caching` | 1.0.0 | `ercan-ermis` | Automatic Anthropic prompt caching, zero-config; ships the `prompt-caching-mcp` server. Marketplace manifest claims 1.1.1 is available, but `claude plugin update` reports 1.0.0 as already latest even after refreshing the marketplace cache — an upstream metadata/release mismatch, not fixable from this repo. |
| `godot` | 1.2.0 | `skills` | GDScript dev patterns, GdUnit4 testing, PlayGodot automation, web/desktop export, CI/CD guidance. |
| `claude-code-setup` | 1.0.0 | `claude-plugins-official` | Analyzes the codebase and recommends tailored Claude Code automations (hooks, skills, MCP servers, subagents). Installed 2026-07-01, not yet run. |
| `claude-md-management` | 1.0.0 | `claude-plugins-official` | Audits/improves `CLAUDE.md` quality and captures session learnings — keeps project memory lean (serves the token/context-saving goal). Installed 2026-07-01, not yet run. |
| `agent-sdk-dev` | (unversioned) | `claude-plugins-official` | Claude Agent SDK dev kit (Python/TS scaffolding + verifier subagents). Installed 2026-07-01 as a hedge in case Hero cognition ends up calling the Claude API at runtime rather than pure classical/GOFAI decision-making — not yet used, no architecture decision made either way. |
| `session-report` | (unversioned) | `claude-plugins-official` | Generates an explorable HTML report of Claude Code token usage, cache efficiency, subagents, and most-expensive prompts from local `~/.claude/projects` transcripts. Zero-config, no external account. Installed 2026-07-01 as the token profiler; not yet run. |

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
  **Scope note (2026-07-01):** BetaLife's design tooling needs are
  Godot-internal (Control-node UI, Theme resources, scene composition) —
  this plugin's guidance is generically useful but its mechanics assume
  web/HTML output; don't reach for Figma/Canva/Adobe-style plugins for this
  project even though they exist in `claude-plugins-official`.
- `godot:godot` — Godot 4.x develop/test/build/deploy.
- `claude-code-setup:claude-automation-recommender` — recommends hooks/skills/MCP/subagent automations tailored to this repo.
- `claude-md-management:claude-md-improver` (+ `/revise-claude-md` command) — audits and revises `CLAUDE.md` quality.
- `agent-sdk-dev` — `/new-sdk-app` command, plus `agent-sdk-verifier-py`/`agent-sdk-verifier-ts` subagents for Claude Agent SDK work.
- `session-report:session-report` — token/cache-usage HTML report from local session transcripts.

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

### Project-authored (this repo only) — the multi-skill dev-team architecture

Authored 2026-07-01, mirrored into both `.claude/skills/` and `.agents/skills/`
(same pattern as the vendored Firebase skills above). Designed to cover
BetaLife's actual gaps rather than a generic org chart — see
`docs/superpowers/plans/` for the design rationale if a plan doc was saved,
or the conversation that produced them. Deliberately **4 skills, not 8**:
skills can't enforce authority over each other at runtime (they're all just
context injected into one agent), so "collaboration" below means documented
consultation order, not enforced hierarchy. Rejected candidates (Godot/Game
Design/Performance/Backend/QA specialists) were redundant with the `godot`
plugin skill, the vendored `firebase-*` skills, or had no BetaLife-specific
content yet to encode — see the conversation for the full reasoning per
candidate.

| Skill | Purpose | Owns | Defers to |
|---|---|---|---|
| `betalife-architect` | Roadmap router — not a decision-maker. | Sub-project dependency order (both tracks), two-repo relationship, doc routing map. | `betalife-ai-architecture` / `betalife-engine-port` for domain specifics. |
| `betalife-ai-architecture` | Living AI Architecture constraints. | Three-tier simulation fidelity, 1:3 time dilation, engine-agnostic-core pattern, Perception→Memory→Cognition→Social→Communication→Daily-life sequencing. Flags the undecided classical-vs-LLM cognition question rather than presuming an answer. | `betalife-engine-port` for anything that's actually a TS port; `limboai` addon for BT/FSM execution once a design is ready. |
| `betalife-engine-port` | TS→GDScript porting methodology (proven across 6 modules, 31/31 tests). | Determinism rules (`seeder.gd`, 32-bit wraparound, RNG call-order), golden-vector workflow, 1:1 module mapping, TDD ordering. | `godot:godot` for generic GdUnit4 mechanics; `betalife-ai-architecture` for logic with no TS precedent. |
| `betalife-docs` | Doc-drift checkpoint (routing only). | Which file gets a given change (`TOOLING.md`/specs/`AGENTS.md`/`CLAUDE.md`). | `claude-md-management` plugin for actual CLAUDE.md quality auditing — not duplicated here. |

Why skills instead of expanding `CLAUDE.md`/`AGENTS.md`: those load in full
on every turn; skills load conditionally when their description matches the
task, which matters given how much BetaLife-specific architecture detail
exists (token-optimization goal from the original environment audit).

Verification note: these are **Reference-type** skills (project facts and
routing, not discipline rules), so they were checked with a lighter
retrieval self-check (can a realistic question be answered correctly from
the skill alone?) rather than the full adversarial pressure-testing
`superpowers:writing-skills` prescribes for discipline-enforcing skills like
TDD — that apparatus doesn't fit static reference content.

## Godot addons (`addons/`, project-scoped, checked into the repo)

| Addon | Version | Type | Purpose |
|---|---|---|---|
| `gdUnit4` | (see `addons/gdUnit4`) | GDScript editor plugin | Test runner used by every module's test suite. |
| `limboai` | v1.8.0 (GDExtension build tagged 4.6, forward-compatible to 4.7) | GDExtension, no `plugin.cfg` (auto-registers) | Behavior Trees + State Machines — the intended foundation for autonomous Hero decision-making/cognitive architecture. Windows-only binaries checked in (~9 MB); other platform binaries deliberately stripped from the release download to keep repo size down — re-pull from [limbonaut/limboai releases](https://github.com/limbonaut/limboai/releases) (`gdextension-4.6.zip` asset) when exporting to a new platform. |
| `gaea` | v2.0.0-beta6 | GDScript editor plugin | Procedural world/terrain generation (noise, WFC, cellular automata graph system). **Pre-release** — Gaea's 2.0 line has never cut a stable tag as of 2026-07-01; chosen anyway since it's the actively-maintained (1.6k★), GDScript-only (easy to swap) option and no world-gen work depends on it yet. |
| `godot-sqlite` | v4.7 release tag (2shady4u/godot-sqlite, 1.4k★) | GDExtension editor plugin (class `SQLite`) | Persistent, queryable structured storage — intended for long-term Hero memory/save-file data once an in-memory dictionary/JSON blob stops scaling (hundreds of Heroes, thousands of memories). Windows-only binaries checked in; other platforms re-pulled from the release's `bin.zip` when needed. |

Considered but **not installed**: `godot-utility-ai` (Pennycook) — utility-AI scoring addon, would have complemented `limboai`'s BT/FSM layer for weighted decision-making, but last commit is April 2024 (stale, only 83★) — fails the "actively maintained" bar. Revisit if a better-maintained utility-AI addon appears, or build scoring logic directly as `limboai` BT tasks instead.

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

### Mission/world generation — already designed in the TS engine, not yet ported

"Randomize the mission's world/structure/objective by difficulty" is **not**
a tooling gap — it's a fully-specified system in the TS engine, not yet
ported, following the same pattern as `gacha.ts`:

- `town.ts` — the mission/world container. Rolls **one** `difficulty`
  (1-1000) per seed via `rollDifficulty()` (already ported, `BLGacha.roll_difficulty`).
- `world.ts` — generates the "Lost World" cataclysm lore per seed (the
  mission's narrative objective/mystery layer).
- `monsters.ts` — generates each floor's encounter, scaled by
  `difficulty × floor × rosterFloor` (the mission's structure layer).
- `combat.ts`, `equipment.ts`, `experience.ts`/`progression.ts` — resolve a
  floor, drop loot, feed results back into the Hero.
- `expedition.ts` — orchestrates the above into one deterministic "run a
  floor" call.

Next milestone candidate: port `town`, `world`, `monsters`, `combat`,
`equipment`, `progression`/`experience`, `expedition` (plus `stats.ts`/`skills.ts`
as dependencies) — same TDD + golden-vector workflow as `gacha.gd`. Scope and
plan properly before starting; this is roughly Milestone-1-sized or larger.

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

Fixed 2026-07-01 (third pass — Claude Code meta-tooling + persistence):
- Installed `claude-code-setup`, `claude-md-management`, `agent-sdk-dev`,
  `session-report` plugins (user scope) — see Plugins table above.
- Installed `godot-sqlite` addon for persistent Hero memory/save storage.
- Confirmed (via `gh` + web research) that `godot-utility-ai` is stale and
  should not be installed; `feature-dev`/`code-review`/`code-modernization`
  marketplace plugins were considered for "multi-agent" tooling and rejected
  as duplicates of `superpowers` / the bundled `code-review` skill / not
  applicable (no legacy code here).
- Identified that mission/world/difficulty randomization is already designed
  in the TS engine (`town.ts`/`world.ts`/`monsters.ts`/`expedition.ts` etc.)
  — see the "Mission/world generation" note above. No new tooling needed;
  it's a porting task for a future milestone.

Still **not fixed** (needs a manual step, low risk either way):
- `prompt-caching` plugin version mismatch — see note in the Plugins table
  above (attempted twice via `claude plugin update` + marketplace refresh,
  reports already-latest; likely an upstream metadata issue, not ours to fix).

Future recommendation:
- Before designing any further AI Hero cognitive architecture (memory,
  perception, planning, social/emergent behavior) for this Godot project,
  read the TS engine's own design docs (`docs/`, `CLAUDE.md`, `.superpowers/`
  in the `BetaLife-main` repo/`main` branch) and continue porting its engine
  modules (following the `gacha.ts` example above) rather than inventing new
  systems from scratch — `limboai`'s Behavior Trees/State Machines are the
  Godot-side execution layer once that design is ported.
