# RPG UI — Tower Expedition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the completed RPG engine (stats/skills/combat/expedition) into the BetaLife 3D slice UI, making the Tower a playable dungeon that heroes enter by personality, not by player command.

**Architecture:** Heroes self-select for expeditions based on soul axes (confidence/passivity thresholds). The player opens a Tower sheet, optionally holds specific heroes back, and confirms. Heroes walk to the Tower and disappear for a real-time timer. Combat resolves instantly (stored in `LIVE.expedition`); survivors walk back out; the Fairy delivers results in qualitative prose.

**Tech Stack:** TypeScript (engine), plain ES module JS (slice.js), Three.js (3D), localStorage (save), esbuild (bundle)

## Global Constraints

- **No raw numbers shown to the player** — HP%, ATK, floors, level numbers are all forbidden in UI text
- **No `Math.random()` in engine code** — all engine calls use the existing `Seeder` system (already true — don't add any)
- **`slice.js` is plain JS** (not TypeScript) — use `const`/`let`, no type annotations
- **All Fairy text in Spanish** — match existing register ("lo noto", "no sé explicarlo", etc.)
- **Engine source files untouched** — `src/engine/*.ts` are complete and must not be modified
- **Run `npm run bundle` before `npm run build:slice`** — slice.html imports engine.bundle.js
- **Working dir:** `C:\Users\Noobi\OneDrive\Documents\MoisesGame\BetaLife-main\BetaLife-main`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/runtime/liveWorld.ts` | Modify | Add `LiveExpedition` interface + `expedition?` to `LiveWorld` |
| `src/save/saveState.ts` | Modify | Add `ExpeditionSave` interface + serialize/restore expedition |
| `scripts/buildSlice.ts` | Modify | Inject `level` + `floorReached` into baked hero data |
| `preview/slice.template.html` | Modify | Add `#sheet-torre` markup |
| `preview/slice.css` | Modify | Tower sheet styles + depth blocks + readiness labels |
| `preview/slice.js` | Modify | All JS logic: volunteering, Tower sheet, departure, timer, resolution, report |
| `preview/engine.bundle.js` | Rebuild | `npm run bundle` — picks up liveWorld.ts changes |
| `preview/slice.html` | Rebuild | `npm run build:slice` — picks up buildSlice.ts changes |

---

## Task 1: Engine Types — LiveWorld + SaveState expedition fields

**Files:**
- Modify: `src/runtime/liveWorld.ts`
- Modify: `src/save/saveState.ts`

**Interfaces:**
- Produces: `LiveExpedition` (used by slice.js via `LIVE.expedition`)
- Produces: `ExpeditionSave` (persisted in localStorage via `serializeSave`)

- [ ] **Step 1: Add `LiveExpedition` interface and `expedition?` to `LiveWorld`**

In `src/runtime/liveWorld.ts`, add after the existing imports at the top:

```typescript
import type { ExpeditionResult } from '../engine/expedition';
```

Then add the new interface directly before `export interface LiveWorld`:

```typescript
export interface LiveExpedition {
  partyIds: string[];              // npc.id of heroes currently inside
  floor: number;
  returnAt: number;                // epoch ms when they emerge
  resolvedResult?: ExpeditionResult; // pre-computed; absent after page-reload restore
}
```

And add `expedition?` to `LiveWorld`:

```typescript
export interface LiveWorld {
  town: Town;
  heroes: LiveHero[];
  tick: number;
  expedition?: LiveExpedition;     // present while heroes are inside the Tower
}
```

- [ ] **Step 2: Add `ExpeditionSave` and update `SaveState` in `saveState.ts`**

In `src/save/saveState.ts`, add the interface before `SaveState`:

```typescript
export interface ExpeditionSave {
  partyIds: string[];
  floor: number;
  returnAt: number;
  // resolvedResult is NOT saved — it is recomputed from the hero state on restore
}
```

Add `expedition?` to `SaveState`:

```typescript
export interface SaveState {
  v: number;
  townSeed: string;
  difficulty: number;
  rosterFloor: number;
  tick: number;
  lastSeen: number;
  heroes: SavedHero[];
  expedition?: ExpeditionSave;
}
```

- [ ] **Step 3: Update `serializeSave` to include expedition**

Replace the `return { ... }` block in `serializeSave`:

```typescript
export function serializeSave(world: LiveWorld, lastSeen = Date.now()): SaveState {
  return {
    v: SAVE_VERSION,
    townSeed: world.town.seed,
    difficulty: world.town.difficulty,
    rosterFloor: world.town.rosterFloor,
    tick: world.tick,
    lastSeen,
    heroes: world.heroes.map((h) => ({
      seed: h.npc.seed,
      axes: h.npc.axes,
      stamps: h.npc.stamps,
      needs: h.needs,
      surfaced: h.npc.lore.memories
        .map((m, i) => (m.surfaced ? i : -1))
        .filter((i) => i >= 0),
      bornAxes: h.bornAxes,
      inRoster: h.inRoster,
      alive: h.alive,
    })),
    expedition: world.expedition
      ? { partyIds: world.expedition.partyIds, floor: world.expedition.floor, returnAt: world.expedition.returnAt }
      : undefined,
  };
}
```

- [ ] **Step 4: Update `restoreSave` to restore expedition**

Replace the `return { town, heroes, tick: save.tick };` line at the end of `restoreSave`:

```typescript
  return { town, heroes, tick: save.tick, expedition: save.expedition };
```

- [ ] **Step 5: Verify TypeScript compiles**

Run (PowerShell, from project root):
```
.\node_modules\.bin\tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```
git add src/runtime/liveWorld.ts src/save/saveState.ts
git commit -m "feat: add LiveExpedition + ExpeditionSave for Tower persistence"
```

---

## Task 2: Build Script — Inject RPG fields into baked hero data

**Files:**
- Modify: `scripts/buildSlice.ts`

**Interfaces:**
- Produces: baked hero objects gain `level: number` and `floorReached: number`
- Consumed by: `slice.js` `depthBlocks()` and `readinessLabel()` (Tasks 4 and 7)

- [ ] **Step 1: Add `level` and `floorReached` to the baked hero object**

In `scripts/buildSlice.ts`, find the `return { ... }` block inside `pool.map((n, i) => { ... })` (around line 136). Add two fields after `dreamed`:

```typescript
    dreamed,
    level: n.level,
    floorReached: n.floorReached,
  };
```

The full return block becomes:

```typescript
  return {
    id: n.id,
    name: n.name,
    role,
    stars: n.stars,
    inRoster: i < INITIAL,
    alive: true,
    emergent: readEmergentTraits(now),
    cues,
    impression: firstImpression(createSeeder('imp:' + n.id), now),
    axesOrig: orig,
    axesNow: now,
    reading,
    needs,
    needsStatus: needsStatus(needs),
    trade: n.pastLife.trade,
    place: n.pastLife.place,
    tier: n.lore.tier,
    memories: n.lore.memories.map((m) => m.text),
    dreamed,
    level: n.level,
    floorReached: n.floorReached,
  };
```

- [ ] **Step 2: Verify build script runs**

```
npx ts-node --project tsconfig.json scripts/buildSlice.ts
```
Expected: `✓ slice.html generado:` with hero summary (no errors).

- [ ] **Step 3: Commit**

```
git add scripts/buildSlice.ts
git commit -m "feat: inject level and floorReached into baked slice hero data"
```

---

## Task 3: HTML + CSS — Tower sheet structure and styles

**Files:**
- Modify: `preview/slice.template.html`
- Modify: `preview/slice.css`

**Interfaces:**
- Produces: `#sheet-torre` DOM element, `.torre-fairy-line`, `#torre-volunteers`, `#btn-send-tower`
- Consumed by: Task 4 JS (`document.getElementById('sheet-torre')` etc.)

- [ ] **Step 1: Add `#sheet-torre` to `slice.template.html`**

In `preview/slice.template.html`, insert the following block immediately before the closing `</body>` tag (after the `#sheet-dev` div, before the `<script type="importmap">` block):

```html
<!-- ░░ Torre — expedición ░░ -->
<div class="sheet" id="sheet-torre">
  <div class="sheet-grip"></div>
  <div class="sheet-head">
    <span class="sheet-icon" style="color:var(--violet-soft);text-shadow:0 0 10px var(--violet-soft);">⬡</span>
    <div class="sheet-title">La Torre<small>algo llama desde lo alto</small></div>
    <span class="sheet-close" data-close="sheet-torre">✕</span>
  </div>
  <div class="sheet-body mw">
    <div class="torre-fairy-line" id="torre-fairy-line"></div>
    <div class="torre-volunteers" id="torre-volunteers"></div>
    <button class="btn-merge" id="btn-send-tower" disabled>Enviarlos →</button>
  </div>
</div>
```

- [ ] **Step 2: Add Tower sheet styles to `slice.css`**

In `preview/slice.css`, append at the end of the file:

```css
  /* ── Torre: expedición ── */
  .torre-fairy-line{font-size:13px;line-height:1.65;color:var(--txt);margin-bottom:18px;
       min-height:48px;font-style:italic;}
  .torre-volunteers{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px;}
  .torre-volunteers .hero-card{flex:1 1 120px;max-width:150px;cursor:pointer;
       transition:opacity .2s,border-color .2s;}
  .torre-volunteers .hero-card:hover{border-color:var(--violet);}
  .hero-volunteer-label{font-size:10px;letter-spacing:1px;color:var(--gold);
       text-align:center;margin-top:4px;text-transform:uppercase;}
  .hero-card.held-back{opacity:.38;}
  .hero-card.held-back .hero-name{text-decoration:line-through;color:var(--txt-dim);}
  .hero-card.held-back .hero-volunteer-label{color:var(--danger-soft);}

  /* ── Profundidad + disposición en tarjetas del Roster ── */
  .depth-blocks{font-size:11px;color:var(--violet-soft);letter-spacing:3px;display:block;
       text-align:center;margin:3px 0 2px;}
  .readiness{font-size:9.5px;letter-spacing:1px;text-transform:uppercase;display:block;
       text-align:center;margin-top:2px;}
  .readiness.en-forma{color:#5a8868;}
  .readiness.herido{color:var(--gold);}
  .readiness.malherido{color:var(--danger-soft);}
  .readiness.caido{color:var(--txt-dim);text-decoration:line-through;}

  /* ── Dev panel: Expedición tab ── */
  #dev-expedition{font-size:12px;line-height:1.6;}
  .exp-result{margin:10px 0;padding:10px 12px;background:var(--panel2);
       border-radius:10px;border:1px solid var(--line);}
  .exp-narration{color:var(--txt-dim);margin-top:6px;}
  .exp-narration .log-line{margin:2px 0;}
```

- [ ] **Step 3: Commit**

```
git add preview/slice.template.html preview/slice.css
git commit -m "feat: add Tower expedition sheet HTML and CSS"
```

---

## Task 4: slice.js — Tower sheet, volunteering, send button

**Files:**
- Modify: `preview/slice.js`

**Interfaces:**
- Consumes: `#sheet-torre`, `#torre-fairy-line`, `#torre-volunteers`, `#btn-send-tower` (from Task 3)
- Produces: `openTowerSheet()`, `launchExpedition()` entry point (wired in Task 5)

- [ ] **Step 1: Add `'sheet-torre'` to the SHEETS array**

Find (line ~742):
```js
const SHEETS = ['sheet-hada','sheet-roster','sheet-merge','sheet-dev'];
```
Replace with:
```js
const SHEETS = ['sheet-hada','sheet-roster','sheet-merge','sheet-dev','sheet-torre'];
```

- [ ] **Step 2: Store Tower tip light reference**

In the `torre()` IIFE (around line 291), find this line:
```js
const tip = new THREE.PointLight(0xb080ff, 12, 22, 1.5); tip.position.set(0,15,0); g.add(tip);
```
Immediately after it, add:
```js
PLACES.torre.tipLight = tip;
```

- [ ] **Step 3: Update `onPlace('torre')` to open Tower sheet**

Find (around line 887):
```js
else if(k==='torre'){ toast('<b>La Torre</b> — algo llama desde lo alto. Aún no se puede entrar.'); }
```
Replace with:
```js
else if(k==='torre'){ openTowerSheet(); }
```

- [ ] **Step 4: Update Fairy's "¿Qué hay arriba?" line**

Find (around line 840):
```js
{ label:'¿Qué hay arriba?', cls:'back', act:()=>{ bub('right','¿Qué hay en la Torre?'); fairySays('No puedo ver eso. La Torre no me habla — solo sé que llama.', hadaRoot); } },
```
Replace with:
```js
{ label:'¿Qué hay arriba?', cls:'back', act:()=>{ bub('right','¿Qué hay en la Torre?'); fairySays('La Torre llama. Si hay almas dispuestas a subir, puedes enviarlas desde ella. Yo estaré aquí cuando vuelvan — o cuando no.', hadaRoot); } },
```

- [ ] **Step 5: Add state variables for the Tower sheet**

After the `let recentLoss = null;` line (around line 1524), add:
```js
let torreHeld = new Set();   // data.id of heroes held back by player
let pendingReport = null;    // Fairy report text queued while sheets were open
```

- [ ] **Step 6: Add volunteer helper functions**

Add the following block immediately before the `function onPlace(k){` function (around line 884):

```js
// ── Torre: voluntarios ────────────────────────────────────────────────────────
function volunteerAxes(h){
  return (h.data._live && h.data._live.npc.axes) || h.data.axesNow || {};
}
function isVolunteer(h){
  const ax = volunteerAxes(h);
  return (ax.confidence||0.5) > 0.45 && (ax.passivity||0.5) < 0.70;
}
function isStrongVolunteer(h){
  const ax = volunteerAxes(h);
  return (ax.confidence||0.5) > 0.65 && (ax.optimism||0.5) > 0.55;
}
```

- [ ] **Step 7: Add Tower sheet rendering functions**

Add the following block immediately after the volunteer helpers (still before `onPlace`):

```js
function torreTypeLine(text){
  const el = document.getElementById('torre-fairy-line');
  el.textContent = '';
  let i = 0;
  const iv = setInterval(()=>{ el.textContent += text[i++]; if(i>=text.length) clearInterval(iv); }, 18);
}

function updateSendButton(volunteers){
  const btn = document.getElementById('btn-send-tower');
  const confirmed = volunteers.filter(h=>!torreHeld.has(h.data.id));
  if(!confirmed.length){
    btn.classList.remove('ready'); btn.disabled=true; btn.textContent='Enviarlos →';
  } else {
    btn.classList.add('ready'); btn.disabled=false;
    btn.textContent = confirmed.length===1 ? 'Enviar a '+confirmed[0].data.name+' →' : 'Enviarlos →';
  }
}

function toggleHeld(h, card){
  const volunteers = heroes.filter(x=>x.alive && isVolunteer(x));
  if(torreHeld.has(h.data.id)){
    torreHeld.delete(h.data.id);
    card.classList.remove('held-back');
    document.getElementById('vlabel-'+h.data.id).textContent = isStrongVolunteer(h)?'listo':'dudoso';
  } else {
    torreHeld.add(h.data.id);
    card.classList.add('held-back');
    document.getElementById('vlabel-'+h.data.id).textContent = 'retenido';
  }
  updateSendButton(volunteers);
}

function renderTorreSheet(volunteers){
  torreHeld = new Set();
  // Fairy opening line
  const strong = volunteers.filter(h=>isStrongVolunteer(h));
  const reluctant = volunteers.filter(h=>!isStrongVolunteer(h));
  let line;
  if(strong.length===0){
    line = reluctant.length===1
      ? 'Solo '+reluctant[0].data.name+' da un paso, aunque con dudas.'
      : reluctant.length+' dan un paso, sin mucha certeza. Es su decisión.';
  } else if(strong.length===1 && reluctant.length===0){
    line = strong[0].data.name+' da un paso adelante sin dudarlo. Nadie más siente el llamado ahora.';
  } else if(strong.length===1){
    line = strong[0].data.name+' da un paso sin dudar. '+(reluctant.length===1?reluctant[0].data.name+' lo sigue, aunque sin la misma certeza.':reluctant.length+' más lo siguen, con reservas.');
  } else {
    const strongNames = strong.map(h=>h.data.name).join(' y ');
    line = strongNames+' dan un paso sin dudar.'+(reluctant.length?' Hay '+reluctant.length+' más que los siguen, con reservas.':'');
  }
  torreTypeLine(line);
  // Volunteer cards
  const grid = document.getElementById('torre-volunteers'); grid.innerHTML='';
  volunteers.forEach(h=>{
    const card = document.createElement('div'); card.className='hero-card';
    const label = isStrongVolunteer(h)?'listo':'dudoso';
    card.innerHTML = '<div class="portrait">'+bustHTML(h.data)+'</div>'+
      '<div class="hero-name">'+h.data.name+'</div>'+
      '<div class="hero-stars">'+('★'.repeat(h.data.stars))+'</div>'+
      '<div class="hero-volunteer-label" id="vlabel-'+h.data.id+'">'+label+'</div>';
    card.addEventListener('click',()=>toggleHeld(h,card));
    grid.appendChild(card);
  });
  updateSendButton(volunteers);
}

function openTowerSheet(){
  if(TUTORIAL) return;
  // Block if expedition already running
  if(LIVE && LIVE.expedition){ toast('<b>La Torre</b> — ya hay almas dentro. Espera a que vuelvan.'); return; }
  const volunteers = heroes.filter(h=>h.alive && isVolunteer(h));
  if(!volunteers.length){ toast('<b>La Torre</b> — nadie siente el llamado todavía.'); return; }
  renderTorreSheet(volunteers);
  openSheet('sheet-torre');
}
```

- [ ] **Step 8: Wire the send button**

Find the `document.getElementById('btn-roster').addEventListener(...)` line (around line 941). Immediately after it, add:

```js
document.getElementById('btn-send-tower').addEventListener('click',()=>{
  const volunteers = heroes.filter(h=>h.alive && isVolunteer(h));
  const confirmed = volunteers.filter(h=>!torreHeld.has(h.data.id));
  if(!confirmed.length) return;
  closeSheets();
  launchExpedition(confirmed);
});
```

- [ ] **Step 9: Manual test — open the Tower sheet**

Run `npm run build:slice` then open `preview/slice.html` in a browser. After the tutorial, tap the Tower:
- Expected: Toast "nadie siente el llamado todavía" if all heroes have low confidence (early game), OR the Tower sheet slides up with volunteer cards and the Fairy typing line.
- Expected: Tapping a volunteer card grays it out and labels it "retenido".
- Expected: Send button dims when all are held back; shows active state when at least one is confirmed.

- [ ] **Step 10: Commit**

```
git add preview/slice.js
git commit -m "feat: Tower sheet with volunteer logic, hold-back, and send button"
```

---

## Task 5: slice.js — Expedition launch and departure

**Files:**
- Modify: `preview/slice.js`

**Interfaces:**
- Consumes: `LIVE`, `BL.runExpedition`, `LIVE.expedition` (set here)
- Produces: `launchExpedition(confirmedHeroes)` called by send button (Task 4)

- [ ] **Step 1: Add `launchExpedition` function**

Add the following block immediately after the `openTowerSheet` function (before `onPlace`):

```js
function walkHeroToTower(h, onArrival){
  const g = h.group;
  const iv = setInterval(()=>{
    const dx=P_TORRE.x-g.position.x, dz=P_TORRE.z-g.position.z;
    const d=Math.hypot(dx,dz);
    if(d<1.2){ clearInterval(iv); onArrival(); }
    else { const sp=0.08; g.position.x+=dx/d*sp; g.position.z+=dz/d*sp; g.rotation.y=Math.atan2(dx,dz); }
  },16);
}

function launchExpedition(confirmedHeroes){
  if(!LIVE||!BL){ toast('El motor no está disponible.'); return; }
  const party = confirmedHeroes.map(h=>h.data._live.npc);
  const floor = Math.max(1, Math.round(party.reduce((s,n)=>s+n.level,0)/party.length));
  const resolvedResult = BL.runExpedition(LIVE.town, floor, party);
  const returnAt = Date.now() + Math.min((floor+1)*90*1000, 480000);
  LIVE.expedition = { partyIds: party.map(n=>n.id), floor, returnAt, resolvedResult };
  doSave();

  // Departure speech by personality
  const DEPART_LINES = {
    optimista:'Será rápido.', cauto:'No tengo otra opción.',
    inseguro:'Ojalá.', sombrío:'Así termina todo.',
    sereno:'Vuelvo.', cálido:'Cuidaos mientras.', curioso:'Quiero ver qué hay arriba.',
  };
  confirmedHeroes.forEach((h,idx)=>{
    h.state = 'tower';
    setTimeout(()=>{ if(h.alive) say(h, DEPART_LINES[toneOf(h)]||'Vuelvo.'); }, idx*400);
    setTimeout(()=>{
      walkHeroToTower(h, ()=>{ h.group.visible=false; });
    }, idx*300);
  });

  // Tower tip pulse
  const tip = PLACES.torre.tipLight;
  if(tip){ tip.intensity=22; setTimeout(()=>{ tip.intensity=12; },2000); }

  // HUD
  const sub = document.getElementById('hud-sub');
  if(sub && !TUTORIAL) sub.textContent='esperando noticias…';
}
```

- [ ] **Step 2: Add the `'tower'` beat to `BANKS`**

In the `BANKS` object (around line 1204), add a `tower` key after the `loss` entry:

```js
  tower: [
    ['¿Cuánto tardan?','No lo sé. Nadie sabe lo que hay ahí arriba.'],
    ['¿Y si no vuelven?','…Esperamos.'],
    ['El silencio de la Torre me pesa.','A todos.'],
    ['¿Crees que están bien?','Pregúntale a la Hada. Yo no me atrevo a pensar en eso.'],
  ],
```

- [ ] **Step 3: Add tower beat to `composeExchange`**

In `composeExchange` (around line 1254), find the line:
```js
  if(recentLoss) add('loss', 5);
```
Immediately after it, add:
```js
  const inTower = LIVE && LIVE.expedition && LIVE.expedition.partyIds.length>0;
  add('tower', inTower ? 6 : 0);
```

- [ ] **Step 4: Verify `launchExpedition` wires correctly**

Run `npm run build:slice` and open `preview/slice.html`. After tutorial, if any volunteer appears in the Tower sheet: confirm one hero, press "Enviarlos". Expected:
- Sheet closes.
- Hero speech bubble appears ("Vuelvo." etc.).
- Hero walks toward Tower, disappears.
- HUD sub-label says "esperando noticias…".
- Tower tip light briefly brightens.
- If another pair of heroes is nearby and idle, their chat might include tower beats.

- [ ] **Step 5: Commit**

```
git add preview/slice.js
git commit -m "feat: launchExpedition with departure walk, LIVE.expedition state, tower chat beat"
```

---

## Task 6: slice.js — Expedition resolution and Fairy report

**Files:**
- Modify: `preview/slice.js`

**Interfaces:**
- Consumes: `LIVE.expedition.resolvedResult`, `LIVE.expedition.returnAt`
- Produces: `resolveExpedition()`, `pendingReport`, `deliverReport()` used by `openHada()`

- [ ] **Step 1: Add expedition restore logic after `bindLive` setup**

In the `if(BL){` block (around line 67), find the line:
```js
    DATA.heroes.forEach((d,i)=>{ if(LIVE.heroes[i]) bindLive(d, LIVE.heroes[i]); });
```
Immediately after it, add:

```js
    // If a page reload happened mid-expedition, recompute the result
    if(LIVE.expedition && !LIVE.expedition.resolvedResult){
      try{
        const expParty = LIVE.heroes.filter(h=>LIVE.expedition.partyIds.includes(h.npc.id)).map(h=>h.npc);
        LIVE.expedition.resolvedResult = BL.runExpedition(LIVE.town, LIVE.expedition.floor, expParty);
        // Heroes are hidden (they're inside); hide their 3D groups after spawn
        window.__pendingHiddenIds = LIVE.expedition.partyIds.slice();
      }catch(e){ console.warn('expedition restore failed', e); LIVE.expedition=undefined; }
    }
```

- [ ] **Step 2: Hide in-tower heroes after they spawn**

In the `start()` function (around line 1606), find:
```js
  DATA.heroes.forEach((d,i)=>{ if(d.inRoster) spawnHero(d, heroes.length); });
```
After it, add:

```js
    // Hide heroes that were inside the Tower when the page reloaded
    if(window.__pendingHiddenIds && window.__pendingHiddenIds.length){
      setTimeout(()=>{
        heroes.forEach(h=>{ if(window.__pendingHiddenIds.includes(h.data.id)){ h.group.visible=false; h.state='tower'; } });
        window.__pendingHiddenIds=null;
      }, 200);
    }
```

- [ ] **Step 3: Add expedition timer to `liveTick`**

In `liveTick` (around line 1592), find:
```js
  saveThrottled();
```
Immediately before it, add:

```js
  if(LIVE.expedition && Date.now() >= LIVE.expedition.returnAt) resolveExpedition();
```

- [ ] **Step 4: Add `composeTowerReport` function**

Add the following block before the `animate()` function (around line 1525):

```js
function composeTowerReport(expResult, towerHeroes, preLevels){
  const { result, party:updatedParty, drops } = expResult;
  const fallen = new Set(result.fallenNpcIds);
  const survivors = towerHeroes.filter(h=>!fallen.has(h.data.id));
  const dead      = towerHeroes.filter(h=> fallen.has(h.data.id));
  const lines = [];
  if(result.outcome==='defeat'){
    lines.push('No volvió nadie. El pueblo los recuerda.');
  } else if(dead.length===0){
    lines.push(survivors.length===1
      ? survivors[0].data.name+' vuelve. Solo, pero vuelve.'
      : 'Volvieron. '+survivors[0].data.name+' marcó el camino; los demás lo siguieron.');
  } else {
    const survNames = survivors.map(h=>h.data.name).join(' y ');
    const deadNames = dead.map(h=>h.data.name).join(' y ');
    lines.push((survivors.length?'Volvió '+survNames+'. ':'')+deadNames+' no. La Torre se lo quedó.');
  }
  // Level-up (qualitative: "salió distinto")
  updatedParty.forEach(n=>{
    if(!fallen.has(n.id) && n.level>(preLevels[n.id]||1)){
      const h = towerHeroes.find(x=>x.data.id===n.id);
      if(h) lines.push(h.data.name+' salió distinto. No sé explicarlo bien, pero lo noto.');
    }
  });
  if(drops && drops.length) lines.push('Trajeron algo de allá dentro. No sé qué significa aún.');
  return lines.join(' ');
}
```

- [ ] **Step 5: Add `resolveExpedition` function**

Add immediately after `composeTowerReport`:

```js
function walkHeroFromTower(h){
  const g = h.group;
  g.position.set(P_TORRE.x+(Math.random()-0.5)*1.5, 0, P_TORRE.z+(Math.random()-0.5)*1.5);
  g.visible = true;
  const iv = setInterval(()=>{
    const dx=P_PLAZA.x-g.position.x, dz=P_PLAZA.z-g.position.z;
    const d=Math.hypot(dx,dz);
    if(d<2.0){ clearInterval(iv); h.state='idle'; h.timer=2+Math.random()*2; }
    else { const sp=0.07; g.position.x+=dx/d*sp; g.position.z+=dz/d*sp; g.rotation.y=Math.atan2(dx,dz); }
  },16);
}

function resolveExpedition(){
  if(!LIVE||!LIVE.expedition) return;
  const { partyIds, floor, resolvedResult } = LIVE.expedition;
  LIVE.expedition = undefined;

  // Save pre-levels for level-up detection
  const preLevels = {};
  LIVE.heroes.forEach(lh=>{ preLevels[lh.npc.id]=lh.npc.level; });

  // Recompute if missing (edge case: resolved immediately after restore)
  const expResult = resolvedResult ||
    BL.runExpedition(LIVE.town, floor,
      LIVE.heroes.filter(h=>partyIds.includes(h.npc.id)).map(h=>h.npc));

  // Apply updated NPCs back to the live world
  expResult.party.forEach(updatedNpc=>{
    const lh = LIVE.heroes.find(h=>h.npc.id===updatedNpc.id);
    if(lh){ lh.npc=updatedNpc; lh.alive=updatedNpc.isAlive; }
  });
  doSave();

  const fallen = new Set(expResult.result.fallenNpcIds);
  const towerHeroes = heroes.filter(h=>partyIds.includes(h.data.id));

  towerHeroes.forEach(h=>{
    if(fallen.has(h.data.id)){
      h.state='idle'; h.alive=false;
      if(h.data._live) h.data._live.alive=false;
      scene.remove(h.group);
      recentLoss = { name:h.data.name, timer:180 };
    } else {
      walkHeroFromTower(h);
    }
  });

  // Queue Fairy report
  pendingReport = composeTowerReport(expResult, towerHeroes, preLevels);
  const sub = document.getElementById('hud-sub');
  if(sub && !TUTORIAL) sub.textContent = heroes.some(h=>h.alive)?'el pueblo vive':'silencio';

  // Auto-deliver if no sheet open
  if(SHEETS.every(s=>!document.getElementById(s).classList.contains('open'))){
    setTimeout(deliverReport, 800);
  }
}
```

- [ ] **Step 6: Add `deliverReport` and hook into `openHada`**

Add after `resolveExpedition`:

```js
function deliverReport(){
  if(!pendingReport) return;
  const report = pendingReport; pendingReport = null;
  openSheet('sheet-hada');
  if(!hadaOpened) hadaOpened=true;
  fairySays(report, hadaRoot);
}
```

Find `openHada()` (around line 861):
```js
function openHada(){
  openSheet('sheet-hada');
  if(TUTORIAL) return;
  if(!hadaOpened){
```
Replace the body with:
```js
function openHada(){
  openSheet('sheet-hada');
  if(TUTORIAL) return;
  if(pendingReport){ deliverReport(); return; }
  if(!hadaOpened){
    hadaOpened=true;
    if(window.__catchupMins){
      fairySays('Volviste. Mientras no estabas, el pueblo siguió: '+(DATA.catchup[0]||'la vida continuó, sin pausa.')+' Nada se detiene aquí.', hadaRoot);
    } else {
      fairySays('Aquí estoy. ¿Qué deseas hacer… o quieres que te explique algo?', hadaRoot);
    }
  }
}
```

- [ ] **Step 7: Manual end-to-end test**

Run `npm run build:slice`. Open `preview/slice.html`. Complete tutorial. Send at least one volunteer into the Tower (if confidence is too low, click Dev → reset and start with heroes that have high confidence seeds — try a few resets until one hero volunteers). Observe:
- Hero walks to Tower, disappears.
- "esperando noticias…" in HUD.
- After the timer (floor 1 = ~3 minutes), hero reappears at Tower base and walks to plaza.
- Fairy sheet auto-opens with a qualitative report.
- If hero died: `recentLoss` set, other heroes may reference them in live chat.

- [ ] **Step 8: Commit**

```
git add preview/slice.js
git commit -m "feat: resolveExpedition, Fairy report delivery, liveTick expedition timer"
```

---

## Task 7: slice.js — Roster card depth + Dev Expedition tab

**Files:**
- Modify: `preview/slice.js`

**Interfaces:**
- Consumes: `d.floorReached` (baked, from Task 2), `d._live.npc.floorReached` (live), `BL.deriveStats`
- Produces: visual roster update; dev panel Expedition tab

- [ ] **Step 1: Add `depthBlocks` and `readinessLabel` helpers**

Add the following two functions immediately before `renderRoster()` (around line 924):

```js
function depthBlocks(floorReached){
  const max=5, filled=Math.min(max,(floorReached||0)+1);
  return '<span class="depth-blocks">'+'▪'.repeat(filled)+'▫'.repeat(max-filled)+'</span>';
}

function readinessLabel(d){
  if(d.alive===false) return '<span class="readiness caido">caído</span>';
  if(!BL||!d._live) return '';
  try{
    const st = BL.deriveStats(d._live.npc);
    const ratio = st.hp/st.maxHp;
    if(ratio>=0.7) return '<span class="readiness en-forma">en forma</span>';
    if(ratio>=0.4) return '<span class="readiness herido">herido</span>';
    return '<span class="readiness malherido">malherido</span>';
  }catch(e){ return ''; }
}
```

- [ ] **Step 2: Update `renderRoster` to show depth + readiness**

In `renderRoster()` (around line 928), find:
```js
      '<div class="hero-future">lvl · stats — próximamente</div>';
```
Replace it with:
```js
      depthBlocks(d._live ? d._live.npc.floorReached : (d.floorReached||0)) +
      readinessLabel(d);
```

The full card.innerHTML assignment becomes:
```js
    card.innerHTML = '<div class="portrait">'+bustHTML(d)+'</div>'+
      '<div class="hero-name">'+d.name+'</div>'+
      '<div class="hero-class">'+(CLASS_ES[d.role]||d.role)+'</div>'+
      '<div class="hero-stars">'+('★'.repeat(d.stars))+'</div>'+
      depthBlocks(d._live ? d._live.npc.floorReached : (d.floorReached||0)) +
      readinessLabel(d);
```

- [ ] **Step 3: Add Expedition tab to the dev panel**

In `slice.template.html`, find the dev panel tabs block:
```html
    <div class="tabs">
      <button class="tab active" id="tab-charlas">Charlas</button>
      <button class="tab" id="tab-stats">Stats</button>
    </div>
    <div id="dev-charlas"></div>
    <div id="dev-stats" style="display:none;"></div>
```
Replace with:
```html
    <div class="tabs">
      <button class="tab active" id="tab-charlas">Charlas</button>
      <button class="tab" id="tab-stats">Stats</button>
      <button class="tab" id="tab-expedition">Expedición</button>
    </div>
    <div id="dev-charlas"></div>
    <div id="dev-stats" style="display:none;"></div>
    <div id="dev-expedition" style="display:none;"></div>
```

- [ ] **Step 4: Update `devTab` to handle `'expedition'`**

Find `devTab(which)` (around line 1135):
```js
function devTab(which){
  devCurrent=which;
  document.getElementById('tab-charlas').classList.toggle('active', which==='charlas');
  document.getElementById('tab-stats').classList.toggle('active', which==='stats');
  document.getElementById('dev-charlas').style.display = which==='charlas'?'block':'none';
  document.getElementById('dev-stats').style.display = which==='stats'?'block':'none';
}
```
Replace with:
```js
function devTab(which){
  devCurrent=which;
  document.getElementById('tab-charlas').classList.toggle('active', which==='charlas');
  document.getElementById('tab-stats').classList.toggle('active', which==='stats');
  document.getElementById('tab-expedition').classList.toggle('active', which==='expedition');
  document.getElementById('dev-charlas').style.display = which==='charlas'?'block':'none';
  document.getElementById('dev-stats').style.display = which==='stats'?'block':'none';
  document.getElementById('dev-expedition').style.display = which==='expedition'?'block':'none';
}
```

- [ ] **Step 5: Wire the Expedition tab button**

Find:
```js
document.getElementById('tab-charlas').addEventListener('click', ()=>devTab('charlas'));
document.getElementById('tab-stats').addEventListener('click', ()=>devTab('stats'));
```
Add after:
```js
document.getElementById('tab-expedition').addEventListener('click', ()=>{ renderExpedition(); devTab('expedition'); });
```

- [ ] **Step 6: Add `renderExpedition` function**

Add immediately before `renderCharlas()`:

```js
let lastExpeditionResult = null;   // stored by resolveExpedition for the dev panel

function renderExpedition(){
  const box = document.getElementById('dev-expedition');
  if(!lastExpeditionResult && !(LIVE && LIVE.expedition)){
    box.innerHTML='<div class="dev-count">sin expedición aún en esta sesión.</div>'; return;
  }
  // Active expedition
  if(LIVE && LIVE.expedition){
    const secs = Math.max(0, Math.floor((LIVE.expedition.returnAt-Date.now())/1000));
    const mins = Math.floor(secs/60), s=secs%60;
    box.innerHTML='<div class="dev-count">Expedición activa — piso '+LIVE.expedition.floor+
      ' — vuelven en '+(mins?mins+'m ':'')+s+'s</div>'+
      '<div class="dev-count" style="margin-top:6px">party: '+LIVE.expedition.partyIds.join(', ')+'</div>';
    return;
  }
  // Last result
  const { result, floor, drops } = lastExpeditionResult;
  let html='<div class="dev-count">Última expedición — piso '+floor+' — '+result.outcome+'</div>';
  html+='<div class="exp-result"><div class="exp-narration">';
  html+=result.narration.map(l=>'<div class="log-line">'+l+'</div>').join('');
  html+='</div>';
  if(result.fallenNpcIds.length) html+='<div class="log-line" style="color:var(--danger-soft)">Caídos: '+result.fallenNpcIds.join(', ')+'</div>';
  if(drops && drops.length) html+='<div class="log-line" style="color:var(--gold)">Botín: '+drops.map(d=>d.slot+' ('+d.rarity+')').join(', ')+'</div>';
  html+='</div>';
  box.innerHTML=html;
}
```

- [ ] **Step 7: Store last result in `resolveExpedition`**

In the `resolveExpedition()` function (added in Task 6), after the `doSave()` line, add:
```js
  lastExpeditionResult = expResult;
```

- [ ] **Step 8: Rebuild and verify roster cards**

Run `npm run build:slice`. Open `preview/slice.html` → "los héroes". Expected:
- Each roster card now shows depth blocks (`▪▫▫▫▫` for level 1 heroes) and a readiness label ("en forma" if no expedition has been run).
- Dev panel → Expedición tab shows "sin expedición aún en esta sesión." initially.

- [ ] **Step 9: Commit**

```
git add preview/slice.js preview/slice.template.html
git commit -m "feat: roster depth blocks, readiness labels, dev expedition tab"
```

---

## Task 8: Rebuild engine bundle and full deploy

**Files:**
- Rebuild: `preview/engine.bundle.js`
- Rebuild: `preview/slice.html`

**Interfaces:**
- Consumes: `src/runtime/liveWorld.ts` (Task 1), `scripts/buildSlice.ts` (Task 2)
- Produces: final deployable `preview/slice.html` + updated `engine.bundle.js`

- [ ] **Step 1: Rebuild the engine bundle (picks up liveWorld.ts changes)**

```
.\node_modules\.bin\esbuild.cmd src/runtime/browser.ts --bundle --format=esm --outfile=preview/engine.bundle.js
```
Expected: `preview/engine.bundle.js` updated with no errors.

- [ ] **Step 2: Rebuild slice.html (picks up buildSlice.ts changes)**

```
npx ts-node --project tsconfig.json scripts/buildSlice.ts
```
Expected: `✓ slice.html generado:` with no errors.

- [ ] **Step 3: TypeScript final check**

```
.\node_modules\.bin\tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit the compiled outputs**

```
git add preview/engine.bundle.js preview/slice.html
git commit -m "build: rebuild engine bundle and slice for Tower expedition feature"
```

- [ ] **Step 5: Push to branch**

```
git push origin claude/code-review-65yx3p
```
Expected: push succeeds. Preview URL updates within ~30 seconds:
`https://raw.githack.com/1201mmoises-byte/BetaLife/claude/code-review-65yx3p/preview/slice.html`

- [ ] **Step 6: Final smoke test on live URL**

Open the preview URL. Complete the tutorial. Observe:
- Tower tap → volunteer sheet OR "nadie siente el llamado" toast
- If volunteers appear: confirm one, press send → departure animation → HUD says "esperando noticias…"
- Dev panel → Expedición shows active expedition + countdown
- Dev panel → Los Héroes shows depth blocks + readiness labels
- After timer expires: survivors walk back → Fairy auto-opens with qualitative report

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Volunteering via soul axes (confidence/passivity) | Task 4 `isVolunteer` |
| Strong vs reluctant volunteer display | Task 4 `isStrongVolunteer`, `renderTorreSheet` |
| Hold-back by player tap | Task 4 `toggleHeld` |
| Send button disabled/enabled | Task 4 `updateSendButton` |
| Tower sheet fairy opening line | Task 4 `torreTypeLine` |
| No floor picker (auto from level) | Task 5 `launchExpedition` floor formula |
| Departure speech bubbles by personality | Task 5 `DEPART_LINES` + `toneOf` |
| Heroes walk to Tower, disappear | Task 5 `walkHeroToTower` |
| Tower tip light pulse | Task 5 |
| HUD → "esperando noticias…" | Task 5 |
| Real-time absence timer | Task 6 `liveTick` timer check |
| `LIVE.expedition` persisted through page reload | Task 1 `ExpeditionSave` + Task 6 restore |
| Tower chat beat during absence | Task 5 `BANKS.tower` + `composeExchange` |
| Expedition result computed at departure | Task 5 `BL.runExpedition` |
| Survivors walk back from Tower | Task 6 `walkHeroFromTower` |
| Permadeath: dead heroes removed from scene | Task 6 `resolveExpedition` |
| `recentLoss` set for dead heroes | Task 6 |
| Fairy report — victory/defeat/casualties | Task 6 `composeTowerReport` |
| Fairy report — level-up qualitative notice | Task 6 `composeTowerReport` preLevels check |
| Fairy report — loot notice | Task 6 `composeTowerReport` |
| Fairy auto-opens when no sheet active | Task 6 `resolveExpedition` |
| Pending report delivered when player taps Fairy | Task 6 `openHada` + `deliverReport` |
| Roster card depth blocks | Task 7 `depthBlocks` |
| Roster card readiness label | Task 7 `readinessLabel` |
| Dev panel Expedition tab with raw CombatResult | Task 7 `renderExpedition` |
| `saveState.ts` expedition field | Task 1 |
| `buildSlice.ts` level + floorReached | Task 2 |
| Engine source files untouched | ✓ no engine file modified |
