# Living Slice — Godot port design (supersedes the 2026-07-01 village spec)

**Source of truth:** `preview/slice.html` + `preview/slice.js` (2107 ln) + `slice.css`
on `main` of `1201mmoises-byte/BetaLife` (local checkout
`C:\Users\Noobi\OneDrive\Documents\MoisesGame\BetaLife-main\BetaLife-main`, branch
`main`), plus `src/runtime/liveWorld.ts` and `src/engine/*`. After the 2026-07-02
GitHub consolidation this is the ONLY previz version; all older variants were
deleted. Live copy: <https://1201mmoises-byte.github.io/BetaLife/preview/slice.html>.

**Why this spec exists:** the 2026-07-01 village spec described the previz as a
decorative 3D mock with wandering heroes and deferred "everything else". That was
based on a stale version. The real slice is a full vertical slice of the game —
living heroes, visible dialogue, the Hada, a tutorial, Torre expeditions, the
merge chamber, and save/offline. The Godot port targets THIS. The old spec's
scene-geometry content (positions, camera, structures) remains accurate and its
built output survives; its scope/non-goals and its "silent conversations,
fairy-reports-only UI" model are **retired**.

## Canonical deviations from the slice (deliberate, user-decided)

1. **Clock:** town = **3× real time** → `DAY_LENGTH = 28800.0` s of real time per
   in-world day (slice uses 10×/8640 — obsolete tuning). Tower stays 1:1. Offline
   catch-up fast-forwards the same 3× clock. Needs cadence stays DERIVED so pacing
   survives the change: `NEEDS_TICK = DAY_LENGTH * 0.048` (hambre lasts ~4
   in-world days at any day length). The dev overlay's tick-speed multiplier is
   the testing lever.
2. Everything else ports faithfully, Spanish strings verbatim.

## System catalog (status: ✅ built in Godot · 🔶 partial · ⬜ missing)

| # | System | slice.js reference | Status | Milestone |
|---|--------|--------------------|--------|-----------|
| 1 | Ground (grass r130 speckled, stone r18), PLACES positions | `ground()`, `place()` | ✅ (phases 2A/2B) | done |
| 2 | Ortho camera: azimuth π/4, pitch 0.34, dist 30, target y2.4, frustum 27; 1-finger orbit, 2-finger/wheel zoom, pan; `focusOn` ease | `framedCamera/placeCamera/panBy` | 🔶 orbit/zoom/pan built; focusOn + touch model ⬜ | A (S) |
| 3 | Day/night: sun/moon lights + **discs + additive halo sprite**, sky/fog color lerp, stars, NIGHT scalar, FogExp2 | `updateSky/stars/skyDome` | 🔶 lights/sky/stars built; discs, halo, fog ⬜ | A (S) |
| 4 | Six structures (torre/shrine/posada/campo/fusion/plaza) + Label3D | `torre()…chamber()` | ✅ | done |
| 5 | **Perimeter wall** r17, 48 pieces, h2.8, camera-side see-through fade; torches (`makeTorch`), plaza **bonfire** (`bonfire()`), fires flicker scaled by NIGHT | `wall()/makeFire/animate` | ⬜ | A (S) |
| 6 | Hero figure: legs/torso/head boxes+sphere, ROLE_VIS palette + class accessory (helm/hood/bandana), name label | `buildHero` | 🔶 base built; accessories + exact palette ⬜ | A (S) |
| 7 | Shrine crystal pulse/rotation, fusion echo crystal + expanding rings | `animate()` §crystal/echo | 🔶 rotation built; pulse/echo rings ⬜ | A (S) |
| 8 | Click-picking heroes/places (raycast), pointer model | `pickHero/pickPlace/doPick` | ⬜ | A (S) |
| 9 | HUD: "Día N" counter (dawn crossing ++), mood subtitle ("el pueblo vive"/"atardece"/"cae la noche"/"siguió sin ti"/"silencio") | `animate()` §HUD | ⬜ | A (S/U) |
| 10 | **Hero behavior loop**: states idle/walking/eat/rest/train/talk/tower; per-state motion (train spin, eat nibble, bob), walking wander-offset around spot radius, arrive→`_nextState` | `updateHero` | ⬜ (placeholder wander only) | A (L) |
| 11 | **pickActivity**: graduated initiative — hambre<0.70 P=urgency×0.9→posada/eat; descanso<0.60 P=urgency×0.8→posada/rest; order processing (obeyChance); role-weighted free choice (plaza 38%; warrior/archer→campo; mage→shrine; else posada) | `pickActivity` | ⬜ | A (L) |
| 12 | **Live engine tick**: every NEEDS_TICK, `tickHeroNeeds(lh, activity)` per hero (tower state skipped — 1:1), LIVE.tick++, autosave throttle | `liveTick` | ⬜ | A (L) — autosave part → C |
| 13 | **socialDirector**: every ~0.5–1.2s scan idle unpartnered heroes; pair if dist<3.6 → startConversation | `socialDirector` | ⬜ | A (L) |
| 14 | **Conversations**: engine nudges via `applyConversation(world, ai, bi, seederKey)`; VIEW composes dialogue: `composeExchange` micro-planner (needs urgency, tone, tier weights TIER_W, night/tower/recentLoss context, anti-repetition beat×0.25 + template no-repeat) over BANKS (arrival/pastlife/hunger/hunger_invite/tired/tired_invite/dream/bond/environment/idle/loss/tower) with token filling {1t}{2t}{1p}{2p}{1obs}{2obs}{food}{frag}{lost}; tone system `toneOf`/`TONE_OBS`, FOODS list | `composeExchange/BANKS/startConversation` | ⬜ | A (L) |
| 15 | Dialogue playback: **speech bubbles** per line (~1.65 s/turn), faceEachOther, end→idle; hunger/tired beats → BOTH walk to posada (eat/rest) after | `startConversation/say/updateSpeeches` | ⬜ | A (L) |
| 16 | **Charlas log**: `liveChats` last 40 {a, b, topic, lines[{who,text}]}, rendered in dev sheet "charlas" tab | `renderCharlas` | ⬜ | A (U) |
| 17 | **Hada**: glowing avatar roams HADA_SPOTS; evolving state {confidence, solemnity, wisdom+0.08/dawn}; rare musings (~1/session); ask-UI (know/request/explain), `liveReading` observable summaries; typewriter `fairySays` | `hadaRoam/guidanceDirector/openHada` | 🔶 avatar roams; state/ask-UI/readings ⬜ | A (U) basics; rest → B |
| 18 | Orders + obedience: issueOrder(eat/rest/train/cheer), obeyChance from personality, markObeyed→hada confidence, ORDER_FAIRY lines, _order/_orderT on hero | `issueOrder/obeyChance` | ⬜ | B |
| 19 | Tutorial: fresh start → town EMPTY, Hada-led summon of 4 heroes, golden highlight ring, tut hints; saved game skips | `startTutorial/tutHint/hlRing` | ⬜ | B |
| 20 | Summon/roster/merge sheets (sheet-roster, sheet-merge), readiness labels | `SHEETS/openSheet` | ⬜ | B (roster/summon), C (merge) |
| 21 | **Torre expeditions**: party 2–5, multi-team, `runExpedition`, real-time `returnAt` (1:1), heroes hidden + state 'tower', resolve→fallen removed + `recentLoss` 180s + survivors walk back + qualitative fairy report (`composeTowerReport`), level-up "salió distinto" lines | `resolveExpedition` etc. | ⬜ | C |
| 22 | Merge chamber (Cámara de los Ecos) flow + `recentLoss` feeding 'loss' conversations | sheet-merge | ⬜ | C |
| 23 | **Save/offline**: serialize/restore (`saveState.ts`), save on quit + throttled autosave, offline catch-up `simulateOffline` (capped 2000 ticks), "siguió sin ti" | `loadSave/doSave/offline` | ⬜ | C |
| 24 | Live world runtime: `createLiveWorld(seed, poolSize)`, LiveHero {npc, needs, inRoster, alive}, `tryDream` memories | `src/runtime/liveWorld.ts` | ⬜ port | A (P) |

## Engine/runtime port map (TS → GDScript)

Ported ✅: seeder, axes, archetypes, stamps, name_generator, gacha (golden-vector verified).
Vectors ready, port pending (milestone A): `needs`, `behavior`, `conversations`,
`experience`, `mediator` (as-is; fairy personality later; `reportActivity`
order-dependence is real TS behavior — replicate).
New ports needed (milestone A, vectors first): `npcGenerator` (trade/place/lore/
memories/observation — dialogue tokens depend on it), `dreams`, `historyGenerator`
(npcGenerator dep), `src/runtime/liveWorld.ts` → `scripts/runtime/live_world.gd`
(create_live_world/apply_conversation/tick_hero_needs/try_dream; simulate_offline
→ C). Milestone C adds: `saveState`, `town`/`world`/`monsters`/`stats`/`skills`/
`equipment`/`combat`/`progression`/`expedition` (Torre stack).
`hero_factory.gd` reconciles with `npc_generator` at port time — ONE canonical
hero record in `Roster`.

## Milestones

- **A — Living core (current):** ports (P1–P5) + scene parity (S) + living sim +
  dialogue (L) + charlas panel/hada basics/HUD (U). Exit: heroes visibly live,
  talk, and are inspectable; charlas panel logs everything.
- **B — Guidance:** tutorial, summon/roster sheets, orders + obedience, Hada
  evolving state + musings.
- **C — Stakes:** Torre expeditions, merge chamber + loss, save/offline catch-up.

## Verification (milestone A)

1. GdUnit: all port suites green vs golden vectors (existing 47 + new).
2. Playable loop: accelerate ticks via dev overlay → heroes drain hambre → invite
   each other ("¿me acompañas?") with visible bubbles → walk to posada together →
   eat/rest; warriors train at campo (spin), mages visit shrine; night falls —
   bonfire/torches flare, environment beats appear; charlas panel lists the last
   conversations with full lines; click hero → focus + inspector; click fairy →
   observable readings.
3. Visual parity screenshots vs the live slice URL at matching times of day
   (windowed capture — `--headless` capture is broken on this machine).
