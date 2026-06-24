/**
 * DEV TOOL — Genera preview/shrine-dev.html con datos reales del motor.
 *
 * Corre el motor: genera un POOL de NPCs (4 en el roster inicial + varios
 * invocables), simula charlas silenciosas entre el roster inicial durante N
 * ticks, y monta un HTML interactivo (mismo diseño que shrine.html) con:
 *   - Clic en un NPC → panel flotante con ejes, estampas y emergentes
 *   - Clic en el SANTUARIO → invoca al siguiente NPC del pool (gacha)
 *   - Botón "charlas" → log flotante de las conversaciones de fondo
 *   - Alerta de la entidad cuando una condición de susurro dispara
 *
 * Solo es una herramienta de desarrollo. Uso:
 *   npx ts-node --project tsconfig.json scripts/devPreview.ts
 */

import { rareWhisper, consultNPC, situationBrief } from '../src/engine/mediator';
import { readEmergentTraits }                      from '../src/engine/axes';
import { Exchange, ConversationTopic }             from '../src/engine/conversations';
import { createSeeder }                            from '../src/engine/seeder';
import {
  runPreviewSim, fallbackDialogue, DialogueLine,
  ROLES, INITIAL, TICKS,
} from './previewSim';
import * as fs   from 'fs';
import * as path from 'path';

// ── 1+2. Pool (dificultad de PUEBLO) + simulación de charlas ─────────────────
// La simulación vive en previewSim.ts y la comparte generateDialogue.ts, así el
// log y las claves de caché coinciden exactamente. Todos los NPC comparten una
// sola dificultad de pueblo (modelo nuevo), no una por NPC.
const { town, pool, roster, currentAxes, log: rawLog } = runPreviewSim();

// Diálogo IA horneado: leer la caché generada por generateDialogue.ts. Si falta
// una clave (caché aún no generada), usar el fallback redactado para no romper.
// Formato de caché: { [key]: { via: 'gemini'|'fallback', lines: DialogueLine[] } }
const cachePath = path.join(__dirname, '..', 'preview', 'dialogue-cache.json');
const rawCache: Record<string, any> =
  fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};
const log = rawLog.map((e) => {
  const entry = rawCache[e.key];
  const dialogue: DialogueLine[] =
    entry?.lines ?? (Array.isArray(entry) ? entry : null) ?? fallbackDialogue(e);
  return { ...e, dialogue };
});

// ── 3. Datos para el HTML ─────────────────────────────────────────────────────
const whisperMsg = rareWhisper(roster.map(n => ({ ...n, axes: currentAxes[n.id] })));

const npcData = pool.map((n, i) => ({
  id: n.id,
  name: n.name,
  stars: n.stars,
  difficulty: n.difficulty,
  origin: n.originArchetypeId,
  culture: n.culture,
  floorReached: n.floorReached,
  stamps: n.stamps,
  emergent: readEmergentTraits(currentAxes[n.id]),
  axesOrig: n.axes,
  axesNow: currentAxes[n.id],
  role: ROLES[i % ROLES.length],
  observation: n.observation,
  initial: i < INITIAL,
}));

const DATA = JSON.stringify({ npcs: npcData, log, whisper: whisperMsg, ticks: TICKS, initial: INITIAL, townDifficulty: town.difficulty }, null, 0);

// ── 4. HTML ───────────────────────────────────────────────────────────────────
const html = /* html */`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>BetaLife DEV — Shrine</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background:#05050d; overflow:hidden; font-family:Georgia, serif; }

/* ── SCENE — ocupa toda la pantalla del teléfono ── */
.scene { position:relative; width:100vw; height:100vh; height:100svh; }

.star { position:absolute; background:#fff; border-radius:50%; animation:twinkle var(--d) ease-in-out infinite var(--delay); pointer-events:none; }
@keyframes twinkle { 0%,100%{opacity:.15;} 50%{opacity:1;} }

.ground { position:absolute; bottom:0; left:0; right:0; height:25%; background:linear-gradient(to top,#0b0b18 0%,#0b0b18 55%,transparent 100%); pointer-events:none; }
.fog { position:absolute; bottom:10%; width:120%; left:-10%; height:8%; background:radial-gradient(ellipse at 50% 100%,rgba(70,45,110,.35) 0%,transparent 70%); animation:fog-drift 9s ease-in-out infinite; pointer-events:none; }
@keyframes fog-drift { 0%,100%{transform:scaleX(1) translateX(0);} 50%{transform:scaleX(1.06) translateX(18px);} }

.pillar { position:absolute; bottom:11%; width:1px; background:linear-gradient(to top,rgba(110,70,200,.28),transparent); animation:pillar-flicker var(--d) ease-in-out infinite var(--delay); pointer-events:none; }
@keyframes pillar-flicker { 0%,100%{opacity:.3;} 50%{opacity:.9;} }

/* SHRINE — zoom:0.48 escala todo el shrine proporcionalmente en móvil sin romper centrado */
.shrine { position:absolute; bottom:14%; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; cursor:pointer; z-index:5; transition:filter .25s; touch-action:manipulation; zoom:0.48; }
.shrine::before { content:''; position:absolute; inset:-32px; border-radius:20px; z-index:-1; }
.shrine:hover { filter:brightness(1.25) drop-shadow(0 0 14px rgba(180,120,255,.5)); }
.crystal-wrap { position:relative; margin-bottom:4px; }
.crystal { width:22px; height:40px; background:linear-gradient(160deg,#e0c8ff 0%,#9060e0 45%,#3a1870 100%); clip-path:polygon(50% 0%,90% 55%,75% 100%,25% 100%,10% 55%); animation:crystal-glow 3.5s ease-in-out infinite; filter:drop-shadow(0 0 6px #b080ff); }
@keyframes crystal-glow { 0%,100%{filter:drop-shadow(0 0 4px #9060d0) brightness(.85);} 50%{filter:drop-shadow(0 0 14px #d0a0ff) brightness(1.25);} }
.crystal.flash { animation:crystal-flash .8s ease-out; }
@keyframes crystal-flash { 0%{filter:drop-shadow(0 0 30px #ffffff) brightness(3);} 100%{filter:drop-shadow(0 0 6px #b080ff) brightness(1);} }
.crystal-beam { position:absolute; bottom:100%; left:50%; transform:translateX(-50%); width:4px; height:210px; background:linear-gradient(to top,rgba(160,100,255,.55) 0%,rgba(200,160,255,.2) 55%,transparent 100%); border-radius:2px; animation:beam-flicker 4s ease-in-out infinite; pointer-events:none; }
@keyframes beam-flicker { 0%,100%{opacity:.45;width:3px;} 50%{opacity:.85;width:5px;} }
.shrine-cap { width:170px; height:28px; background:linear-gradient(to bottom,#28203a,#1c1628); clip-path:polygon(3% 100%,97% 100%,92% 0%,8% 0%); border-top:1px solid #4a306a; position:relative; }
.cap-rune { position:absolute; top:6px; color:#8050c0; font-size:12px; animation:rune-pulse var(--d) ease-in-out infinite var(--delay); text-shadow:0 0 6px #a070e0; }
@keyframes rune-pulse { 0%,100%{opacity:.4;text-shadow:0 0 4px #7040b0;} 50%{opacity:1;text-shadow:0 0 12px #c0a0ff,0 0 22px #8050c0;} }
.shrine-body { width:148px; height:76px; background:linear-gradient(to bottom,#1c1628 0%,#120e1c 100%); border-left:1px solid #3a2555; border-right:1px solid #3a2555; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; }
.shrine-body::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse at 50% 0%,rgba(120,70,200,.18) 0%,transparent 65%); }
.shrine-center-rune { font-size:28px; color:#9060d0; text-shadow:0 0 10px #b080f0,0 0 25px #8050b0; animation:rune-pulse 2.8s ease-in-out infinite; z-index:1; }
.shrine-step { background:linear-gradient(to bottom,#1a1528,#100d1c); border-left:1px solid #2e1e46; border-right:1px solid #2e1e46; border-bottom:1px solid #2e1e46; }
.shrine-particle { position:absolute; width:3px; height:3px; background:#c0a0ff; border-radius:50%; animation:shrine-float var(--d) var(--delay) ease-in linear infinite; opacity:0; pointer-events:none; }
@keyframes shrine-float { 0%{transform:translateY(0) translateX(0);opacity:0;} 15%{opacity:.8;} 100%{transform:translateY(-160px) translateX(var(--drift));opacity:0;} }
.shrine-hint { position:absolute; bottom:-20px; left:50%; transform:translateX(-50%); color:rgba(180,140,240,.45); font-size:9px; letter-spacing:2px; white-space:nowrap; text-transform:uppercase; animation:hint-pulse 2.5s ease-in-out infinite; }
@keyframes hint-pulse { 0%,100%{opacity:.35;} 50%{opacity:.7;} }

/* NPC — zoom:0.72 para escalar figuras al tamaño de teléfono */
.npc { position:absolute; bottom:12%; display:flex; flex-direction:column; align-items:center; animation:npc-idle var(--speed) ease-in-out infinite; cursor:pointer; z-index:4; touch-action:manipulation; zoom:0.72; }
.npc::before { content:''; position:absolute; inset:-30px -24px; border-radius:16px; }
.npc:hover .npc-figure { filter:brightness(1.3); }
.npc.selected .npc-figure { filter:brightness(1.4) drop-shadow(0 0 10px #c0a0ff); }
.npc.spawning { animation:npc-spawn .85s cubic-bezier(.2,1.3,.5,1) forwards; }
@keyframes npc-spawn { 0%{opacity:0;transform:translateY(26px) scale(.25);filter:brightness(3.5);} 60%{filter:brightness(1.8);} 100%{opacity:1;transform:translateY(0) scale(1);filter:brightness(1);} }
@keyframes npc-idle { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-5px);} }
.npc-shadow { width:48px; height:7px; border-radius:50%; background:rgba(0,0,0,.45); margin-top:-3px; animation:shadow-breathe var(--speed) ease-in-out infinite; }
@keyframes shadow-breathe { 0%,100%{transform:scaleX(1);opacity:.6;} 50%{transform:scaleX(.82);opacity:.3;} }
.npc-figure { position:relative; transition:filter .2s; }
.npc-head { width:var(--hw,24px); height:var(--hh,26px); background:var(--skin,#c8a478); border-radius:45% 45% 38% 38%; margin:0 auto; position:relative; box-shadow:inset -3px -3px 6px rgba(0,0,0,.35); }
.npc-eye { position:absolute; width:4px; height:4px; background:#111; border-radius:50%; top:42%; animation:blink 5.5s ease-in-out infinite var(--blink,0s); }
.npc-eye.l { left:22%; } .npc-eye.r { right:22%; }
@keyframes blink { 0%,94%,100%{transform:scaleY(1);} 96%{transform:scaleY(.08);} }
.helm { position:absolute; top:-10px; left:-3px; right:-3px; height:16px; background:linear-gradient(to bottom,#708090,#4a5560); border-radius:50% 50% 0 0; box-shadow:inset 0 3px 5px rgba(255,255,255,.15); }
.helm-visor { position:absolute; bottom:-3px; left:10%; right:10%; height:6px; background:#3a4248; border-radius:0 0 3px 3px; }
.hood { position:absolute; top:-14px; left:-5px; right:-5px; height:22px; background:var(--robe-color,#1a1540); border-radius:50% 50% 0 0; box-shadow:-2px -2px 4px rgba(0,0,0,.5); }
.bandana { position:absolute; top:50%; left:-3px; right:-3px; height:10px; background:#6a2030; border-radius:2px; }
.npc-torso { width:var(--tw,30px); height:var(--th,36px); background:var(--armor,#2a3050); border-radius:3px 3px 5px 5px; margin:-2px auto 0; position:relative; border:1px solid rgba(255,255,255,.07); box-shadow:inset -3px -4px 8px rgba(0,0,0,.4); }
.torso-detail { position:absolute; top:6px; left:50%; transform:translateX(-50%); width:10px; height:18px; border:1px solid rgba(255,255,255,.1); border-radius:2px; }
.npc-arm { position:absolute; width:9px; height:var(--th,36px); background:var(--armor,#2a3050); border-radius:3px; top:0; box-shadow:inset -2px -2px 4px rgba(0,0,0,.35); transform-origin:top center; }
.npc-arm.l { right:calc(100% - 2px); animation:arm-l var(--speed) ease-in-out infinite; }
.npc-arm.r { left:calc(100% - 2px); animation:arm-r var(--speed) ease-in-out infinite; }
@keyframes arm-l { 0%,100%{transform:rotate(-6deg);} 50%{transform:rotate(6deg);} }
@keyframes arm-r { 0%,100%{transform:rotate(6deg);} 50%{transform:rotate(-6deg);} }
.npc-legs { display:flex; gap:4px; margin:1px auto 0; width:var(--tw,30px); justify-content:center; }
.npc-leg { width:11px; height:var(--lh,28px); background:var(--leg,#18182e); border-radius:2px 2px 4px 4px; border:1px solid rgba(255,255,255,.05); }
.npc-label { position:absolute; top:-26px; width:90px; left:50%; transform:translateX(-50%); text-align:center; pointer-events:none; }
.npc-stars { color:#f0c040; font-size:9px; text-shadow:0 0 5px #f0c040; letter-spacing:1px; }
.npc-name { color:rgba(190,175,230,.6); font-size:8px; letter-spacing:1.5px; margin-top:2px; text-transform:uppercase; }
.weapon { position:absolute; top:-8px; right:-14px; width:5px; height:60px; background:linear-gradient(to bottom,#c0c8d8,#6a7280); border-radius:2px; box-shadow:0 0 4px rgba(200,220,255,.4); }
.weapon::before { content:''; position:absolute; top:-10px; left:50%; transform:translateX(-50%); width:14px; height:14px; background:linear-gradient(135deg,#c0d8ff,#6090d0); clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%); }
.staff { position:absolute; top:-22px; left:-12px; width:4px; height:70px; background:linear-gradient(to bottom,#6a4a2a,#3a2818); border-radius:2px; }
.staff-orb { position:absolute; top:-14px; left:50%; transform:translateX(-50%); width:16px; height:16px; background:radial-gradient(circle at 35% 35%,#d0a0ff,#6030a0); border-radius:50%; box-shadow:0 0 8px rgba(160,100,255,.8),0 0 20px rgba(130,70,220,.4); animation:orb-pulse 2.5s ease-in-out infinite; }
@keyframes orb-pulse { 0%,100%{box-shadow:0 0 6px rgba(160,100,255,.6);} 50%{box-shadow:0 0 14px rgba(200,150,255,1),0 0 28px rgba(160,100,255,.5);} }
.dagger { position:absolute; top:-2px; left:-10px; width:3px; height:22px; background:linear-gradient(to bottom,#e0e8f0,#6a7888); border-radius:1px 1px 0 0; transform:rotate(-20deg); }

/* HADA — zoom:0.55 para que no domine la pantalla del teléfono */
.hada { position:absolute; top:4%; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; animation:hada-float 5.5s ease-in-out infinite; cursor:pointer; z-index:4; zoom:0.55; }
@keyframes hada-float { 0%,100%{transform:translateX(-50%) translateY(0);} 50%{transform:translateX(-50%) translateY(-14px);} }
.hada-aura-outer { position:absolute; width:160px; height:160px; border-radius:50%; background:radial-gradient(circle,rgba(200,230,255,.12) 0%,rgba(140,190,255,.04) 55%,transparent 75%); top:50%; left:50%; transform:translate(-50%,-50%); animation:aura-breathe 5.5s ease-in-out infinite; pointer-events:none; }
@keyframes aura-breathe { 0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.7;} 50%{transform:translate(-50%,-50%) scale(1.18);opacity:1;} }
.hada-ring { position:absolute; width:80px; height:20px; border:1px solid rgba(180,220,255,.25); border-radius:50%; top:50%; left:50%; transform:translate(-50%,-50%) rotateX(75deg); animation:ring-spin 9s linear infinite; box-shadow:0 0 8px rgba(180,220,255,.15); pointer-events:none; }
.hada-ring::before { content:''; position:absolute; width:6px; height:6px; background:rgba(200,235,255,.9); border-radius:50%; top:50%; left:0; transform:translateY(-50%); box-shadow:0 0 6px rgba(200,235,255,1); }
@keyframes ring-spin { from{transform:translate(-50%,-50%) rotateX(75deg) rotate(0deg);} to{transform:translate(-50%,-50%) rotateX(75deg) rotate(360deg);} }
.hada-wings { position:absolute; top:12px; width:200px; height:90px; pointer-events:none; }
.wing { position:absolute; border-radius:50%; animation:wing-beat 3.5s ease-in-out infinite var(--wd,0s); }
.w-ul { width:60px; height:48px; right:50%; top:0; transform-origin:right 80%; background:radial-gradient(ellipse at right center,rgba(200,230,255,.5) 0%,rgba(140,200,255,.2) 50%,transparent 80%); border-radius:70% 10% 30% 50%; }
.w-ur { width:60px; height:48px; left:50%; top:0; transform-origin:left 80%; background:radial-gradient(ellipse at left center,rgba(200,230,255,.5) 0%,rgba(140,200,255,.2) 50%,transparent 80%); border-radius:10% 70% 50% 30%; }
.w-ll { width:48px; height:38px; right:50%; top:36px; transform-origin:right 20%; background:radial-gradient(ellipse at right top,rgba(170,210,255,.4) 0%,rgba(120,180,255,.15) 50%,transparent 80%); border-radius:60% 20% 20% 50%; }
.w-lr { width:48px; height:38px; left:50%; top:36px; transform-origin:left 20%; background:radial-gradient(ellipse at left top,rgba(170,210,255,.4) 0%,rgba(120,180,255,.15) 50%,transparent 80%); border-radius:20% 60% 50% 20%; }
@keyframes wing-beat { 0%,100%{transform:scaleX(1) rotate(-4deg);opacity:.7;} 50%{transform:scaleX(.75) rotate(6deg);opacity:1;} }
.w-ur,.w-lr { animation-direction:reverse; }
.hada-body { position:relative; z-index:2; display:flex; flex-direction:column; align-items:center; }
.hada-head { width:30px; height:32px; background:radial-gradient(circle at 38% 32%,rgba(255,255,255,.95) 0%,rgba(200,228,255,.92) 55%,rgba(150,200,255,.85) 100%); border-radius:50%; position:relative; box-shadow:0 0 16px rgba(200,225,255,.85),0 0 35px rgba(140,200,255,.4); }
.hada-eye { position:absolute; width:5px; height:5px; background:rgba(80,140,255,.92); border-radius:50%; top:44%; box-shadow:0 0 7px rgba(160,210,255,1); animation:hada-eye-pulse 3.5s ease-in-out infinite; }
.hada-eye.l { left:24%; } .hada-eye.r { right:24%; }
@keyframes hada-eye-pulse { 0%,100%{opacity:.7;} 50%{opacity:1;box-shadow:0 0 12px rgba(180,225,255,1);} }
.hada-torso { width:22px; height:34px; background:linear-gradient(175deg,rgba(230,242,255,.95) 0%,rgba(160,205,255,.88) 55%,rgba(110,170,255,.8) 100%); border-radius:4px 4px 7px 7px; margin:-3px auto 0; box-shadow:0 0 16px rgba(170,215,255,.5); }
.hada-skirt { width:36px; height:22px; background:linear-gradient(to bottom,rgba(155,200,255,.75) 0%,rgba(100,160,255,.35) 100%); clip-path:polygon(0% 0%,100% 0%,82% 100%,18% 100%); margin:-2px auto 0; }
.hdot { position:absolute; width:5px; height:5px; background:rgba(210,235,255,.92); border-radius:50%; box-shadow:0 0 7px rgba(200,235,255,.9); top:50%; left:50%; animation:hdot-orbit var(--od) linear infinite var(--odelay); pointer-events:none; }
@keyframes hdot-orbit { from{transform:rotate(var(--ostart)) translateX(var(--or)) rotate(calc(-1 * var(--ostart)));} to{transform:rotate(calc(var(--ostart) + 360deg)) translateX(var(--or)) rotate(calc(-1 * (var(--ostart) + 360deg)));} }
.hada-label { position:absolute; bottom:-28px; left:50%; transform:translateX(-50%); color:rgba(200,230,255,.7); font-size:9px; letter-spacing:4px; text-transform:uppercase; white-space:nowrap; text-shadow:0 0 10px rgba(180,220,255,.6); pointer-events:none; }

.amb-rune { position:absolute; color:rgba(100,65,160,.38); font-size:16px; animation:amb-float var(--d) var(--delay) ease-in-out infinite; user-select:none; pointer-events:none; }
@keyframes amb-float { 0%,100%{transform:translateY(0) rotate(0deg);opacity:.25;} 50%{transform:translateY(-14px) rotate(8deg);opacity:.65;} }

.scene-title { position:absolute; bottom:3%; left:50%; transform:translateX(-50%); color:rgba(160,140,210,.3); font-size:10px; letter-spacing:5px; text-transform:uppercase; pointer-events:none; }

/* ── DEV BADGE + CONTROLS — más grandes para toque en móvil ── */
.dev-badge { position:absolute; top:env(safe-area-inset-top,10px); left:12px; top:12px; background:rgba(58,31,96,.85); color:#c0a0ff; font-size:10px; letter-spacing:2px; padding:5px 10px; border-radius:4px; text-transform:uppercase; z-index:20; }
.dev-controls { position:absolute; top:12px; right:12px; display:flex; gap:10px; z-index:20; }
.dev-btn { background:rgba(26,21,48,.9); border:1px solid #3a2868; color:rgba(200,180,240,.85); font-size:12px; padding:8px 16px; border-radius:6px; cursor:pointer; letter-spacing:1px; font-family:Georgia,serif; transition:all .2s; touch-action:manipulation; min-height:40px; }
.dev-btn:active { background:#2e1f50; border-color:#8060c0; color:#e0c8ff; }

/* WHISPER ALERT */
.whisper-alert { display:none; position:absolute; top:22%; left:50%; transform:translateX(-50%); background:rgba(14,10,28,.92); border:1px solid rgba(200,230,255,.35); color:rgba(220,240,255,.88); font-size:11px; padding:7px 16px; border-radius:4px; letter-spacing:.5px; box-shadow:0 0 24px rgba(140,200,255,.25); z-index:15; animation:whisper-in .6s ease-out; max-width:88vw; white-space:normal; text-align:center; }
.whisper-alert.visible { display:block; }
@keyframes whisper-in { from{opacity:0;transform:translateX(-50%) translateY(-6px);} to{opacity:1;transform:translateX(-50%) translateY(0);} }
.whisper-label { color:rgba(160,210,255,.55); font-size:9px; letter-spacing:3px; text-transform:uppercase; margin-right:8px; }

/* ── INSPECTOR — sheet desde abajo, full-width (nativo en móvil) ── */
.inspector { position:fixed; bottom:0; left:0; right:0; height:75%; background:rgba(8,7,20,.97); border-top:1px solid #2a1f40; border-radius:18px 18px 0 0; padding:20px 18px 28px; overflow-y:auto; transform:translateY(105%); transition:transform .35s cubic-bezier(.3,1,.4,1); z-index:30; }
.inspector.open { transform:translateY(0); }
.inspector-close { position:absolute; top:14px; right:18px; color:rgba(180,160,220,.6); font-size:20px; cursor:pointer; line-height:1; padding:4px 8px; touch-action:manipulation; }
.inspector-close:active { color:#c0a0ff; }
.inspector-name { font-size:16px; color:#e8d8ff; letter-spacing:1px; margin-bottom:2px; padding-right:20px; }
.inspector-sub { font-size:10px; color:rgba(180,160,220,.5); letter-spacing:2px; text-transform:uppercase; margin-bottom:12px; }
.inspector-row { display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px; }
.inspector-key { color:rgba(160,140,200,.5); }
.inspector-val { color:#c8b8f0; }
.inspector-obs { margin-top:6px; font-size:10px; color:rgba(170,150,210,.45); font-style:italic; line-height:1.4; }
.axes-title { font-size:9px; color:rgba(160,140,200,.4); letter-spacing:3px; text-transform:uppercase; margin:14px 0 6px; }
.tag-row { display:flex; flex-wrap:wrap; gap:4px; }
.tag { font-size:9px; padding:2px 7px; border-radius:2px; letter-spacing:1px; text-transform:uppercase; }
.tag-emergent { background:#1e2840; border:1px solid #3a5080; color:#80a8e0; }
.tag-birth { background:#281840; border:1px solid #5a3080; color:#b080e0; }
.tag-growth { background:#182828; border:1px solid #305050; color:#60a8a8; }
.tag-none { color:rgba(160,140,200,.3); font-size:10px; }
.axis-row { display:flex; align-items:center; gap:6px; margin-bottom:5px; }
.axis-lbl { width:84px; font-size:10px; color:rgba(200,180,240,.65); flex-shrink:0; text-align:right; }
.axis-bar-track { flex:1; height:4px; background:#1a1530; border-radius:2px; }
.axis-bar-fill { height:100%; border-radius:2px; }
.axis-val { width:30px; font-size:10px; color:rgba(200,180,240,.7); text-align:right; flex-shrink:0; }
.axis-delta { width:44px; font-size:9px; text-align:right; flex-shrink:0; }

/* ── LOG — sheet desde abajo, full-width ── */
.convo-log { position:fixed; bottom:0; left:0; right:0; height:70%; background:rgba(6,6,18,.97); border-top:1px solid #1e1a2e; border-radius:18px 18px 0 0; padding:16px 14px 28px; overflow-y:auto; transform:translateY(105%); transition:transform .35s cubic-bezier(.3,1,.4,1); z-index:25; }
.convo-log.open { transform:translateY(0); }
.log-header { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.log-title { font-size:10px; color:rgba(160,140,200,.5); letter-spacing:3px; text-transform:uppercase; }
.log-count { font-size:10px; color:rgba(160,140,200,.35); }
.log-filters { display:flex; flex-wrap:wrap; gap:5px; margin:0 0 10px; }
.filter-btn { font-size:9px; padding:2px 8px; border-radius:2px; border:1px solid #2e2050; background:#1a1530; color:rgba(180,160,220,.5); cursor:pointer; letter-spacing:1px; text-transform:uppercase; }
.filter-btn:hover, .filter-btn.active { border-color:var(--tc,#6040a0); color:var(--tc,#c0a0ff); background:rgba(60,30,100,.3); }
.exchange-entry { border-left:2px solid var(--tc,#404080); padding:7px 10px; margin-bottom:7px; background:rgba(20,16,36,.6); border-radius:0 4px 4px 0; }
.ex-header { display:flex; align-items:center; gap:8px; margin-bottom:3px; }
.topic-tag { font-size:8px; padding:1px 6px; border-radius:2px; text-transform:uppercase; letter-spacing:1px; background:var(--tc,#2a2050); color:var(--tct,#c0a0ff); border:1px solid var(--tc,#4a3080); }
.ex-names { font-size:11px; color:rgba(200,180,240,.8); }
.ex-intensity { font-size:8px; color:rgba(160,140,200,.4); margin-left:auto; }
.nudge-line { font-size:10px; color:rgba(180,160,220,.5); }
.nudge-name { color:rgba(180,160,220,.4); }
.nudge-pos { color:#60c880; }
.nudge-neg { color:#c06060; }
.no-exchanges { color:rgba(160,140,200,.25); font-size:11px; text-align:center; margin-top:24px; letter-spacing:1px; }

/* ── Diálogo IA (burbujas alternadas A↔B) ── */
.dlg { margin:6px 0 4px; display:flex; flex-direction:column; gap:5px; }
.bubble { max-width:82%; padding:6px 9px; font-size:12px; line-height:1.35; border-radius:12px; position:relative; }
.bubble .who { display:block; font-size:8px; letter-spacing:1px; text-transform:uppercase; opacity:.55; margin-bottom:1px; }
.bubble.a { align-self:flex-start; background:rgba(40,32,70,.85); color:#e6dcff; border:1px solid rgba(120,90,200,.35); border-bottom-left-radius:3px; }
.bubble.b { align-self:flex-end; background:rgba(28,40,60,.85); color:#dcecff; border:1px solid rgba(80,130,200,.35); border-bottom-right-radius:3px; text-align:right; }
.dev-detail { margin-top:4px; }
.dev-detail > summary { font-size:8px; letter-spacing:1px; text-transform:uppercase; color:rgba(160,140,200,.35); cursor:pointer; list-style:none; outline:none; }
.dev-detail > summary::-webkit-details-marker { display:none; }
.dev-detail[open] > summary { color:rgba(160,140,200,.55); }

::-webkit-scrollbar { width:4px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:#2e2050; border-radius:2px; }
</style>
</head>
<body>
<div class="scene" id="scene">

  <!-- Ambient runes -->
  <span class="amb-rune" style="left:6%;top:20%;--d:6s;--delay:0s">ᚱ</span>
  <span class="amb-rune" style="left:12%;top:50%;--d:8s;--delay:1.5s">ᚦ</span>
  <span class="amb-rune" style="left:4%;top:70%;--d:7s;--delay:3s">ᚷ</span>
  <span class="amb-rune" style="right:7%;top:25%;--d:9s;--delay:.8s">ᚾ</span>
  <span class="amb-rune" style="right:13%;top:55%;--d:6.5s;--delay:2.2s">ᛁ</span>
  <span class="amb-rune" style="right:5%;top:72%;--d:7.5s;--delay:4s">ᛗ</span>
  <span class="amb-rune" style="left:28%;top:12%;--d:10s;--delay:1s">ᚩ</span>
  <span class="amb-rune" style="right:30%;top:10%;--d:8.5s;--delay:2.5s">ᛖ</span>

  <!-- Pillars -->
  <div class="pillar" style="left:18%;height:200px;--d:6s;--delay:0s"></div>
  <div class="pillar" style="left:35%;height:160px;--d:8s;--delay:2s"></div>
  <div class="pillar" style="right:18%;height:190px;--d:7s;--delay:1s"></div>
  <div class="pillar" style="right:35%;height:140px;--d:9s;--delay:3s"></div>

  <!-- HADA -->
  <div class="hada" id="hada">
    <div class="hada-aura-outer"></div>
    <div class="hada-ring"></div>
    <div class="hada-wings">
      <div class="wing w-ul" style="--wd:0s"></div>
      <div class="wing w-ur" style="--wd:0s"></div>
      <div class="wing w-ll" style="--wd:.18s"></div>
      <div class="wing w-lr" style="--wd:.18s"></div>
    </div>
    <div class="hada-body">
      <div class="hada-head"><div class="hada-eye l"></div><div class="hada-eye r"></div></div>
      <div class="hada-torso"></div>
      <div class="hada-skirt"></div>
    </div>
    <div class="hdot" style="--od:4s;--odelay:0s;--ostart:0deg;--or:38px"></div>
    <div class="hdot" style="--od:4s;--odelay:0s;--ostart:120deg;--or:38px"></div>
    <div class="hdot" style="--od:4s;--odelay:0s;--ostart:240deg;--or:38px"></div>
    <div class="hdot" style="--od:6.5s;--odelay:0s;--ostart:60deg;--or:52px;opacity:.6"></div>
    <div class="hdot" style="--od:6.5s;--odelay:0s;--ostart:180deg;--or:52px;opacity:.6"></div>
    <div class="hdot" style="--od:6.5s;--odelay:0s;--ostart:300deg;--or:52px;opacity:.6"></div>
    <div class="hada-label">La Entidad</div>
  </div>

  <!-- WHISPER -->
  <div class="whisper-alert" id="whisper-alert">
    <span class="whisper-label">entidad</span><span id="whisper-text"></span>
  </div>

  <!-- SHRINE (clic = invocar) -->
  <div class="shrine" id="shrine" title="Tocar para invocar">
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
      <div class="crystal-beam"></div>
      <div class="crystal-wrap"><div class="crystal" id="crystal"></div></div>
    </div>
    <div class="shrine-cap">
      <span class="cap-rune" style="left:18px;--d:3s;--delay:0s">ᚱ</span>
      <span class="cap-rune" style="left:50%;transform:translateX(-50%);--d:2.5s;--delay:.8s">᛫</span>
      <span class="cap-rune" style="right:18px;--d:3.5s;--delay:1.4s">ᚾ</span>
    </div>
    <div class="shrine-body">
      <span class="shrine-center-rune">ᚷ</span>
      <div class="shrine-particle" style="left:30%;bottom:10%;--d:2.8s;--delay:0s;--drift:-18px"></div>
      <div class="shrine-particle" style="left:50%;bottom:10%;--d:3.4s;--delay:.7s;--drift:5px"></div>
      <div class="shrine-particle" style="left:65%;bottom:10%;--d:2.5s;--delay:1.4s;--drift:12px"></div>
      <div class="shrine-particle" style="left:40%;bottom:20%;--d:3.8s;--delay:2s;--drift:-8px"></div>
      <div class="shrine-particle" style="left:55%;bottom:5%;--d:3.1s;--delay:2.8s;--drift:20px"></div>
    </div>
    <div class="shrine-step" style="width:180px;height:20px;"></div>
    <div class="shrine-step" style="width:220px;height:16px;"></div>
    <div class="shrine-step" style="width:270px;height:14px;border-bottom:none;"></div>
    <div class="shrine-hint" id="shrine-hint">✦ toca para invocar ✦</div>
  </div>

  <!-- NPCs se inyectan aquí -->
  <div id="npc-layer"></div>

  <div class="fog"></div>
  <div class="ground"></div>
  <div class="scene-title">BetaLife · Fase 4</div>

  <!-- DEV overlay -->
  <div class="dev-badge">DEV MODE</div>
  <div class="dev-controls">
    <div class="dev-btn" id="btn-log">charlas (${log.length})</div>
  </div>

  <!-- INSPECTOR -->
  <div class="inspector" id="inspector">
    <span class="inspector-close" id="inspector-close">✕</span>
    <div id="inspector-body"></div>
  </div>

  <!-- LOG -->
  <div class="convo-log" id="convo-log">
    <div class="log-header">
      <span class="log-title">Charlas de fondo · pueblo dif ${town.difficulty}</span>
      <span class="log-count" id="log-count"></span>
    </div>
    <div class="log-filters" id="log-filters"></div>
    <div id="log-entries"></div>
  </div>

</div>

<script>
const DATA = ${DATA};

const TOPICS = {
  training: { label:'training', color:'#4070d0', textColor:'#90b8ff', desc:'comparan técnicas y lo aprendido en los pisos' },
  survival: { label:'survival', color:'#c04040', textColor:'#ff9090', desc:'calculan riesgos y cómo seguir vivos' },
  social:   { label:'social',   color:'#b04090', textColor:'#ff90d0', desc:'algo personal — alguien del pueblo, un vínculo' },
  hobby:    { label:'hobby',    color:'#408040', textColor:'#90d090', desc:'un pasatiempo en común, sin urgencia' },
  casual:   { label:'casual',   color:'#505060', textColor:'#a0a0b8', desc:'cháchara sin agenda, solo acompañarse' },
};

const AXIS_LABELS = {
  caution:['imprudente','cauto'], passivity:['combativo','pasivo'], submission:['dominante','sumiso'],
  warmth:['frío','cálido'], trust:['desconfiado','confiado'], altruism:['egoísta','altruista'],
  sociability:['solitario','sociable'], integrity:['acomodaticio','íntegro'], loyalty:['desleal','leal'],
  optimism:['pesimista','optimista'], discipline:['impulsivo','disciplinado'], curiosity:['cerrado','curioso'],
  confidence:['inseguro','seguro'], forgiveness:['rencoroso','indulgente'],
};
const AXIS_KEYS = Object.keys(AXIS_LABELS);

function axisLabel(k,v){ const [lo,hi]=AXIS_LABELS[k]; return v<0.5?lo:hi; }
function barColor(v){ if(v<0.25)return '#604060'; if(v<0.5)return '#504880'; if(v<0.75)return '#406080'; return '#608060'; }

// ── Posiciones de los NPC en la escena — porcentajes del viewport ───────
const SLOTS = [
  { css:'left:4%;',   bottom:'17%', speed:'3.8s' },
  { css:'left:22%;',  bottom:'17.5%', speed:'4.5s' },
  { css:'right:22%;', bottom:'17.5%', speed:'4.2s' },
  { css:'right:4%;',  bottom:'17%', speed:'3.6s' },
  { css:'left:38%;',  bottom:'19%', speed:'4.1s', scale:.82 },
  { css:'right:38%;', bottom:'19%', speed:'3.9s', scale:.82 },
  { css:'left:12%;',  bottom:'15.5%', speed:'4.0s', scale:1.06 },
  { css:'right:12%;', bottom:'15.5%', speed:'3.7s', scale:1.06 },
];

// ── Plantillas visuales por rol ──────────────────────────────────────────
const ROLE_VIS = {
  warrior:{ skin:'#c09060', armor:'#3a4860', leg:'#22223a', hw:24,hh:25,tw:32,th:38,lh:30,
    head:'<div class="helm"><div class="helm-visor"></div></div>', detail:true, rArm:'<div class="weapon"></div>' },
  mage:{ skin:'#b08868', armor:'#1a1255', leg:'#120e3a', hw:22,hh:24,tw:26,th:34,lh:26,
    head:'<div class="hood" style="--robe-color:#1a1255;"></div>', lArm:'<div class="staff"><div class="staff-orb"></div></div>' },
  rogue:{ skin:'#c09a74', armor:'#2a2218', leg:'#1a1510', hw:21,hh:23,tw:26,th:33,lh:27,
    head:'<div class="bandana"></div>', lArm:'<div class="dagger"></div>' },
  archer:{ skin:'#b07850', armor:'#2a3820', leg:'#1a2012', hw:23,hh:25,tw:28,th:36,lh:29,
    head:'', detail:true },
};

function figureHTML(npc, blink){
  const v = ROLE_VIS[npc.role] || ROLE_VIS.archer;
  const stars = '★'.repeat(npc.stars);
  return \`
    <div class="npc-figure">
      <div class="npc-label">
        <div class="npc-stars">\${stars}</div>
        <div class="npc-name">\${npc.name}</div>
      </div>
      <div class="npc-head" style="--hw:\${v.hw}px;--hh:\${v.hh}px;--skin:\${v.skin};">
        \${v.head||''}
        <div class="npc-eye l" style="--blink:\${blink}s"></div>
        <div class="npc-eye r" style="--blink:\${blink}s"></div>
      </div>
      <div class="npc-torso" style="--tw:\${v.tw}px;--th:\${v.th}px;--armor:\${v.armor};">
        \${v.detail?'<div class="torso-detail"></div>':''}
        <div class="npc-arm l" style="--armor:\${v.armor};height:\${v.th}px;">\${v.lArm||''}</div>
        <div class="npc-arm r" style="--armor:\${v.armor};height:\${v.th}px;">\${v.rArm||''}</div>
      </div>
      <div class="npc-legs" style="--tw:\${v.tw}px;">
        <div class="npc-leg" style="--lh:\${v.lh}px;--leg:\${v.leg};"></div>
        <div class="npc-leg" style="--lh:\${v.lh}px;--leg:\${v.leg};"></div>
      </div>
    </div>
    <div class="npc-shadow" style="--speed:\${SLOTS[npc._slot].speed};"></div>\`;
}

// ── Estado ───────────────────────────────────────────────────────────────
let visibleCount = 0;
const visibleNpcs = [];

function placeNPC(npc, slotIdx, spawning){
  npc._slot = slotIdx;
  const slot = SLOTS[slotIdx];
  const blink = (slotIdx * 0.7) % 3;
  const el = document.createElement('div');
  el.className = 'npc' + (spawning ? ' spawning' : '');
  el.id = 'npc-' + npc.id;
  el.style.cssText = slot.css + 'bottom:' + slot.bottom + ';--speed:' + slot.speed + ';';
  el.innerHTML = figureHTML(npc, blink);
  if (slot.scale) el.querySelector('.npc-figure').style.transform = 'scale(' + slot.scale + ')';
  el.addEventListener('click', () => selectNPC(npc.id));
  if (spawning) {
    el.addEventListener('animationend', () => el.classList.remove('spawning'), { once:true });
  }
  document.getElementById('npc-layer').appendChild(el);
  visibleNpcs.push(npc);
}

// ── Init ─────────────────────────────────────────────────────────────────
function init(){
  // Stars
  const scene = document.getElementById('scene');
  for (let i=0;i<80;i++){
    const s=document.createElement('div'); s.className='star';
    const sz=Math.random()<0.15?2:1;
    s.style.cssText=\`width:\${sz}px;height:\${sz}px;top:\${Math.random()*72}%;left:\${Math.random()*100}%;--d:\${2+Math.random()*5}s;--delay:\${Math.random()*6}s;\`;
    scene.insertBefore(s, scene.firstChild);
  }

  // Roster inicial
  const initial = DATA.npcs.filter(n => n.initial);
  initial.forEach((n,i) => placeNPC(n, i, false));
  visibleCount = initial.length;

  // Whisper
  if (DATA.whisper){
    document.getElementById('whisper-text').textContent = DATA.whisper;
    document.getElementById('whisper-alert').classList.add('visible');
  }

  // Log
  buildFilters();
  renderLog(null);

  // Shrine summon
  document.getElementById('shrine').addEventListener('click', summonNext);

  // Log toggle
  document.getElementById('btn-log').addEventListener('click', () => {
    const panel = document.getElementById('convo-log');
    const btn = document.getElementById('btn-log');
    panel.classList.toggle('open');
    btn.classList.toggle('active');
  });

  // Inspector close
  document.getElementById('inspector-close').addEventListener('click', closeInspector);
}

// Si el DOM ya está listo (visores que inyectan el HTML después de cargar),
// corre init de inmediato; si no, espera a DOMContentLoaded. Sin esta guarda,
// en un visor embebido el listener nunca dispara y nada responde a los clics.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ── Summon ───────────────────────────────────────────────────────────────
function summonNext(){
  const next = DATA.npcs.find(n => !n.initial && !visibleNpcs.includes(n));
  const crystal = document.getElementById('crystal');
  crystal.classList.remove('flash'); void crystal.offsetWidth; crystal.classList.add('flash');

  if (!next || visibleCount >= SLOTS.length){
    const hint = document.getElementById('shrine-hint');
    hint.textContent = '✦ el santuario descansa ✦';
    setTimeout(()=>{ hint.textContent='✦ toca para invocar ✦'; }, 1800);
    return;
  }
  placeNPC(next, visibleCount, true);
  visibleCount++;
  setTimeout(()=>selectNPC(next.id), 400);
}

// ── Inspector ────────────────────────────────────────────────────────────
let selectedId = null;

function selectNPC(id){
  selectedId = id;
  document.querySelectorAll('.npc').forEach(el => el.classList.remove('selected'));
  const el = document.getElementById('npc-'+id);
  if (el) el.classList.add('selected');
  renderInspector(id);
  document.getElementById('inspector').classList.add('open');
}

function closeInspector(){
  document.getElementById('inspector').classList.remove('open');
  document.querySelectorAll('.npc').forEach(el => el.classList.remove('selected'));
  selectedId = null;
}

function renderInspector(id){
  const n = DATA.npcs.find(x => x.id === id);
  const body = document.getElementById('inspector-body');

  const sorted = [...AXIS_KEYS].sort((a,b)=>Math.abs(n.axesNow[b]-0.5)-Math.abs(n.axesNow[a]-0.5));
  const starsHtml = '★'.repeat(n.stars) + '<span style="color:#3a3060">'+'★'.repeat(5-n.stars)+'</span>';

  const stampsHtml = n.stamps.map(s =>
    \`<span class="tag tag-\${s.kind}">\${s.kind} · \${s.axisKey} @\${s.bandValue}</span>\`).join('') || '<span class="tag-none">—</span>';
  const emergentHtml = n.emergent.length
    ? n.emergent.map(e=>\`<span class="tag tag-emergent">\${e}</span>\`).join('')
    : '<span class="tag-none">ninguno aún</span>';

  const axesHtml = sorted.map(k => {
    const now=n.axesNow[k], orig=n.axesOrig[k], d=now-orig;
    const deltaStr = Math.abs(d)>0.0001
      ? \`<span class="axis-delta" style="color:\${d>0?'#60c880':'#c06060'}">\${d>0?'+':''}\${d.toFixed(3)}</span>\`
      : '<span class="axis-delta"></span>';
    return \`<div class="axis-row">
      <span class="axis-lbl">\${axisLabel(k,now)}</span>
      <div class="axis-bar-track"><div class="axis-bar-fill" style="width:\${(now*100).toFixed(1)}%;background:\${barColor(now)};"></div></div>
      <span class="axis-val">\${now.toFixed(2)}</span>\${deltaStr}
    </div>\`;
  }).join('');

  const convivencia = n.initial ? '' :
    '<div class="inspector-obs">Recién invocado — aún no ha convivido con el roster.</div>';

  body.innerHTML = \`
    <div class="inspector-name">\${n.name} &nbsp;<span style="color:#f0c040;font-size:13px">\${starsHtml}</span></div>
    <div class="inspector-sub">\${n.origin} · \${n.culture}</div>
    <div class="inspector-row"><span class="inspector-key">dificultad (oculta)</span><span class="inspector-val">\${n.difficulty}/1000</span></div>
    <div class="inspector-row"><span class="inspector-key">piso alcanzado</span><span class="inspector-val">\${n.floorReached}</span></div>
    <div class="inspector-obs">\${n.observation}</div>
    \${convivencia}
    <div class="axes-title">estampas</div><div class="tag-row">\${stampsHtml}</div>
    <div class="axes-title">emergentes</div><div class="tag-row">\${emergentHtml}</div>
    <div class="axes-title">ejes — de más a menos definitorio</div>\${axesHtml}\`;
}

// ── Log ──────────────────────────────────────────────────────────────────
function buildFilters(){
  const filters = document.getElementById('log-filters');
  ['training','survival','social','hobby','casual'].forEach(topic => {
    const count = DATA.log.filter(e=>e.topic===topic).length;
    if (!count) return;
    const btn=document.createElement('div');
    btn.className='filter-btn'; btn.style.setProperty('--tc',TOPICS[topic].color);
    btn.textContent=\`\${topic} (\${count})\`; btn.dataset.topic=topic;
    btn.onclick=()=>{
      const active=btn.classList.contains('active');
      document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
      if(!active){ btn.classList.add('active'); renderLog(topic); } else renderLog(null);
    };
    filters.appendChild(btn);
  });
}

function renderLog(filterTopic){
  const container=document.getElementById('log-entries');
  let entries=DATA.log;
  if(filterTopic) entries=entries.filter(e=>e.topic===filterTopic);

  document.getElementById('log-count').textContent =
    entries.length===DATA.log.length ? \`\${entries.length} total\` : \`\${entries.length} / \${DATA.log.length}\`;

  if(!entries.length){ container.innerHTML='<div class="no-exchanges">Sin charlas para este filtro</div>'; return; }

  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  container.innerHTML=[...entries].reverse().map(e=>{
    const tc=TOPICS[e.topic];
    const nudgeLine=(name,nudges)=>{
      const parts=Object.entries(nudges).filter(([,v])=>Math.abs(v)>0.0001)
        .map(([k,v])=>{ const cls=v>0?'nudge-pos':'nudge-neg'; return \`<span class="nudge-name">\${k}</span> <span class="\${cls}">\${v>0?'+':''}\${v.toFixed(4)}</span>\`; }).join('  ');
      return parts?\`<div class="nudge-line">\${name}: \${parts}</div>\`:'';
    };
    const bars=Math.round(e.intensity*8);
    const ibar='▮'.repeat(bars)+'▯'.repeat(8-bars);
    const bubbles=(e.dialogue||[]).map(l=>{
      const who=l.speaker==='b'?e.bName:e.aName;
      return \`<div class="bubble \${l.speaker==='b'?'b':'a'}"><span class="who">\${esc(who)}</span>\${esc(l.text)}</div>\`;
    }).join('');
    return \`<div class="exchange-entry" style="--tc:\${tc.color};">
      <div class="ex-header">
        <span class="topic-tag" style="--tc:\${tc.color};--tct:\${tc.textColor};">\${tc.label}</span>
        <span class="ex-names">\${e.aName} ↔ \${e.bName}</span>
        <span class="ex-intensity">\${ibar} \${e.intensity.toFixed(2)}</span>
      </div>
      <div class="dlg">\${bubbles}</div>
      <details class="dev-detail">
        <summary>detalle dev · \${esc(tc.desc)}</summary>
        \${nudgeLine(e.aName,e.nudgesA)}\${nudgeLine(e.bName,e.nudgesB)}
      </details>
    </div>\`;
  }).join('');
}
</script>
</body>
</html>`;

const outDir = path.join(__dirname, '..', 'preview');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'shrine-dev.html');
fs.writeFileSync(outPath, html, 'utf8');

console.log(`✓ Pool: ${pool.length} NPCs (${INITIAL} en roster, ${pool.length - INITIAL} invocables)`);
console.log(`✓ ${log.length} charlas simuladas en ${TICKS} ticks`);
console.log(`✓ Susurro: ${whisperMsg ?? '(ninguno)'}`);
console.log(`✓ Generado: ${outPath}`);
