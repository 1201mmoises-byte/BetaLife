# Living Village milestone — remaining phases (paused 2026-07-02)

Execution paused mid-milestone (monthly spend limit + upcoming user changes).
Completed work: commits `7761150..d4ebf43` on `master` — re-skin, doc
reconciliation + village spec amendment, village 3D shell (orbit/zoom/pan
camera, day/night `DAY_LENGTH = 28800.0`), six structures, hero figures +
fairy + `Roster` autoload + `BLHeroFactory` + "Entrar al Pueblo" flow, and
golden vectors for the 5 behavior modules. Suite: 47/47 green.

Full approved plan: `~/.claude/plans/i-want-to-organize-snazzy-swing.md`.
Execution ledger: `.superpowers/sdd/progress.md` (git-ignored scratch — this
file is the durable copy of what remains).

**NOTE before resuming:** the user said they intend to make many changes.
Re-validate this plan against the repo/spec state at resume time — the
amended village spec (`docs/superpowers/specs/2026-07-01-village-base-3d-scene-design.md`)
remains the governing doc unless it was re-amended.

## Remaining phases, in dependency order

### Phase 3b-1 — Port `needs.ts` + `behavior.ts` → `scripts/engine/{needs,behavior}.gd`
- TDD against the `needs` / `behavior` sections of `tests/fixtures/golden_vectors.json`.
- `BLNeeds`: 4 meters (hambre/descanso/energia/health), Activity constants,
  `tick_needs` decay/recovery branches, DEBILIDAD=0.30, clamps
  ([-0.30,1] / [-1,1] / [0,1]), status helpers incl. `criticalNeed` null.
- `BLBehavior`: AXIS_CUES Spanish strings verbatim (golden-compared),
  T_MILD/T_STRONG, stable sort by dist desc, `seeder.branch("behavior").branch(axis)`
  stream usage, neutral fallback string.
- toFixed(4) parity: copy the rounding helper pattern from `axes.gd`.

### Phase 3b-2 — Port `conversations.ts` → `scripts/engine/conversations.gd`
- Hardest determinism port: `pairKey` (order-independent `a|b` key) feeding
  `seeder.branch(pair_key)`; cooldown=40 gate; intensity `toFixed(3)`;
  topic weights from both participants' axes; nudge builders
  (converge / liftToHigher / bumpBoth) with exact key insertion order.
- Vectors cover cooldown-null, miss-null, hit (incl. swapped-order pins).

### Phase 3b-3 — Port `experience.ts` then `mediator.ts`
- `BLExperience` uses `BLStamps.soft_ceiling` / `seal_if_band_crossed`
  (already ported); vectors cover saturation + origin-resistance edges.
- `BLMediator` uses `BLBehavior.first_impression` + Exchange records.
  **Port as-is ("sin personalidad") — fairy personality shift is a later,
  separate decision.** `reportActivity` is order-DEPENDENT in the real TS
  (no pairKey normalization) — replicate faithfully; vectors pin it.

### Phase 4 — `scripts/village/village_sim.gd`
- 5 s pueblo tick × dev speed multiplier: `tick_needs` → utility activity
  selection (pure helper + small unit test; previz `updateHero`/`pickActivity`
  in `BetaLife-main/preview/slice.js` is the reference) → spot targeting
  (campo=train, posada=rest, plaza=eat/social) → proximity pair scan →
  `roll_conversation` with per-pair cooldowns → `apply_conversation_nudges`
  into Roster data. Signals: `exchange_occurred`, `hero_state_changed`.
- Replace hero_figure placeholder wander via its `set_destination()` seam.

### Phase 5 — In-game UI panels (`scenes/village/village_ui.tscn`)
- F1 dev overlay: hero generator + spawn-into-village, time-of-day slider,
  tick-speed multiplier, click hero inspector (name/stars/archetype/needs
  bars/first_impression cues — observable only, never raw axes).
- Fairy reports panel (player-facing): `report_activity` / `brief_roster` /
  `describe_npc`.
- Dev-only raw Exchange log tab fed by `exchange_occurred`.

### Phase 6 — Docs pass + final whole-branch review
- Add the 5 new modules to engine-port tables in `CLAUDE.md`,
  `docs/TOOLING.md`, `betalife-*` skills; mark village spec status.
- Document in TOOLING.md: `--headless` screenshot capture is broken on this
  machine (dummy renderer null texture) — run windowed so the GPU renders.
- Full suite + fresh screenshots; whole-branch code review (base `02521a7`).

## Loose ends to remember

- TS previz repo (`BetaLife-main`) checkout sits on branch
  `claude/code-review-65yx3p`; exporter commits `1cfe858` + `0710499` live there.
- Minor review findings deferred to the final review (see ledger): village
  spec wording nits; ground_bottom sky band at max zoom; dual day/night
  curves unconsolidated; torre height 7.6 vs 8-10 guidance;
  `get_heroes()` returns live array; hero dicts stored by reference;
  1-frame-stale `look_at`; unseeded flicker RNG.
