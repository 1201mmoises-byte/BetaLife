/**
 * DEV TOOL — Genera preview/shrine-dev.html con datos reales del motor.
 *
 * Corre el motor en modo desarrollo: genera 4 NPCs, simula charlas silenciosas
 * entre todos los pares durante N ticks, y monta un HTML interactivo con:
 *   - La animación del shrine (ejes, ranas, partículas)
 *   - Panel de ejes + estampas al hacer clic en un NPC
 *   - Log de charlas con tema, nudges y participantes
 *   - Alerta de susurro de la entidad si alguna condición dispara
 *
 * Uso: npx ts-node --project tsconfig.json scripts/devPreview.ts
 */

import { generateNPC }            from '../src/engine/npcGenerator';
import { createSeeder }           from '../src/engine/seeder';
import { rollConversation, CONVERSATION_COOLDOWN } from '../src/engine/conversations';
import { applyConversationNudges }from '../src/engine/experience';
import { rareWhisper }            from '../src/engine/mediator';
import { readEmergentTraits, AXIS_KEYS } from '../src/engine/axes';
import { NPC, SoulAxes }          from '../src/engine/types';
import * as fs   from 'fs';
import * as path from 'path';

// ── 1. NPCs — seeds iguales que el visual del shrine ─────────────────────────
const NPC_DEFS = [
  { seed: 'roster:npc1', role: 'warrior', visualName: 'Renfangto', stars: 3 as const },
  { seed: 'roster:npc2', role: 'mage',    visualName: 'Eilwynoch', stars: 2 as const },
  { seed: 'roster:npc3', role: 'rogue',   visualName: 'Darosa',    stars: 2 as const },
  { seed: 'roster:npc4', role: 'archer',  visualName: 'Cauran',    stars: 4 as const },
];

const npcs: NPC[] = NPC_DEFS.map(({ seed }) => generateNPC({ seed }));
NPC_DEFS.forEach(({ visualName }, i) => { npcs[i].name = visualName; });

// ── 2. Simulación de charlas ─────────────────────────────────────────────────
const currentAxes: Record<string, SoulAxes> = {};
npcs.forEach(n => { currentAxes[n.id] = { ...n.axes }; });

interface ExchangeRecord {
  tick: number;
  aId: string; aName: string;
  bId: string; bName: string;
  topic: string;
  intensity: number;
  nudgesA: Partial<Record<string, number>>;
  nudgesB: Partial<Record<string, number>>;
}

const world = createSeeder('shrine-dev-preview');
const cooldowns = new Map<string, number>();
const log: ExchangeRecord[] = [];

const pairs: [number, number][] = [];
for (let i = 0; i < npcs.length - 1; i++)
  for (let j = i + 1; j < npcs.length; j++)
    pairs.push([i, j]);

const TICKS = 3000;
for (let t = 0; t < TICKS; t++) {
  for (const [ai, bi] of pairs) {
    const na = npcs[ai], nb = npcs[bi];
    const key = na.id < nb.id ? `${na.id}|${nb.id}` : `${nb.id}|${na.id}`;
    const cd = cooldowns.get(key) ?? 0;
    if (cd > 0) { cooldowns.set(key, cd - 1); continue; }

    const pa = { id: na.id, axes: currentAxes[na.id] };
    const pb = { id: nb.id, axes: currentAxes[nb.id] };
    const ex = rollConversation(world.branch(`t:${t}:${key}`), pa, pb, {
      proximity: 0.9, cooldownRemaining: 0,
    });

    if (ex) {
      cooldowns.set(key, CONVERSATION_COOLDOWN);
      const ra = applyConversationNudges(currentAxes[na.id], na.stamps, ex.nudges.a);
      const rb = applyConversationNudges(currentAxes[nb.id], nb.stamps, ex.nudges.b);
      currentAxes[na.id] = ra.axes;
      currentAxes[nb.id] = rb.axes;
      log.push({
        tick: t, aId: na.id, aName: na.name, bId: nb.id, bName: nb.name,
        topic: ex.topic, intensity: ex.intensity,
        nudgesA: ex.nudges.a as Record<string, number>,
        nudgesB: ex.nudges.b as Record<string, number>,
      });
    }
  }
}

// ── 3. Datos para el HTML ─────────────────────────────────────────────────────
const whisperMsg = rareWhisper(npcs.map((n, i) => ({ ...n, axes: currentAxes[n.id] })));

const npcData = npcs.map((n, i) => ({
  id: n.id,
  name: n.name,
  stars: n.stars,
  difficulty: n.difficulty,
  origin: n.originArchetypeId,
  culture: n.culture,
  stamps: n.stamps,
  emergent: readEmergentTraits(currentAxes[n.id]),
  axesOrig: n.axes,
  axesNow: currentAxes[n.id],
  role: NPC_DEFS[i].role,
  observation: n.observation,
}));

const DATA = JSON.stringify({ npcs: npcData, log, whisper: whisperMsg, ticks: TICKS }, null, 0);

// ── 4. HTML ───────────────────────────────────────────────────────────────────
const html = /* html */`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>BetaLife DEV — Shrine</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#05050d;color:#c8c0e0;font-family:Georgia,serif;display:flex;flex-direction:column;min-height:100vh;overflow-x:hidden;}

/* ── DEV HEADER ── */
.dev-header{background:#0e0c18;border-bottom:1px solid #2a1f40;padding:10px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;}
.dev-badge{background:#3a1f60;color:#c0a0ff;font-size:10px;letter-spacing:2px;padding:3px 8px;border-radius:3px;text-transform:uppercase;}
.dev-stat{color:rgba(180,160,220,.6);font-size:11px;}
.npc-tabs{display:flex;gap:8px;margin-left:auto;}
.npc-tab{background:#1a1530;border:1px solid #2e2050;color:rgba(200,180,240,.6);font-size:11px;padding:5px 12px;border-radius:4px;cursor:pointer;letter-spacing:1px;transition:all .2s;}
.npc-tab:hover{border-color:#6040a0;color:#c0a0ff;}
.npc-tab.active{background:#2e1f50;border-color:#8060c0;color:#e0c8ff;}

/* ── SCENE ── */
.scene-wrap{position:relative;width:100%;height:420px;overflow:hidden;}
.scene{position:relative;width:860px;height:420px;margin:0 auto;}

/* STARS */
.star{position:absolute;background:#fff;border-radius:50%;animation:twinkle var(--d) ease-in-out infinite var(--delay);}
@keyframes twinkle{0%,100%{opacity:.15;}50%{opacity:1;}}

/* GROUND */
.ground{position:absolute;bottom:0;left:0;right:0;height:120px;background:linear-gradient(to top,#0b0b18 0%,#0b0b18 55%,transparent 100%);pointer-events:none;}
.fog{position:absolute;bottom:45px;width:120%;left:-10%;height:65px;background:radial-gradient(ellipse at 50% 100%,rgba(70,45,110,.3) 0%,transparent 70%);animation:fog-drift 9s ease-in-out infinite;}
@keyframes fog-drift{0%,100%{transform:scaleX(1) translateX(0);}50%{transform:scaleX(1.06) translateX(18px);}}

/* PILLARS */
.pillar{position:absolute;bottom:50px;width:1px;background:linear-gradient(to top,rgba(110,70,200,.28),transparent);animation:pillar-flicker var(--d) ease-in-out infinite var(--delay);}
@keyframes pillar-flicker{0%,100%{opacity:.3;}50%{opacity:.85;}}

/* SHRINE */
.shrine{position:absolute;bottom:72px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;}
.crystal-wrap{position:relative;margin-bottom:4px;}
.crystal{width:22px;height:40px;background:linear-gradient(160deg,#e0c8ff 0%,#9060e0 45%,#3a1870 100%);clip-path:polygon(50% 0%,90% 55%,75% 100%,25% 100%,10% 55%);animation:crystal-glow 3.5s ease-in-out infinite;filter:drop-shadow(0 0 6px #b080ff);}
@keyframes crystal-glow{0%,100%{filter:drop-shadow(0 0 4px #9060d0) brightness(.85);}50%{filter:drop-shadow(0 0 14px #d0a0ff) brightness(1.25);}}
.crystal-beam{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);width:4px;height:185px;background:linear-gradient(to top,rgba(160,100,255,.5) 0%,rgba(200,160,255,.18) 55%,transparent 100%);border-radius:2px;animation:beam-flicker 4s ease-in-out infinite;}
@keyframes beam-flicker{0%,100%{opacity:.4;width:3px;}50%{opacity:.8;width:5px;}}
.shrine-cap{width:170px;height:26px;background:linear-gradient(to bottom,#28203a,#1c1628);clip-path:polygon(3% 100%,97% 100%,92% 0%,8% 0%);border-top:1px solid #4a306a;position:relative;}
.cap-rune{position:absolute;top:5px;color:#8050c0;font-size:12px;animation:rune-pulse var(--d) ease-in-out infinite var(--delay);text-shadow:0 0 6px #a070e0;}
@keyframes rune-pulse{0%,100%{opacity:.4;text-shadow:0 0 4px #7040b0;}50%{opacity:1;text-shadow:0 0 12px #c0a0ff,0 0 22px #8050c0;}}
.shrine-body{width:148px;height:72px;background:linear-gradient(to bottom,#1c1628 0%,#120e1c 100%);border-left:1px solid #3a2555;border-right:1px solid #3a2555;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;}
.shrine-body::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(120,70,200,.18) 0%,transparent 65%);}
.shrine-center-rune{font-size:28px;color:#9060d0;text-shadow:0 0 10px #b080f0,0 0 25px #8050b0;animation:rune-pulse 2.8s ease-in-out infinite;z-index:1;}
.shrine-step{background:linear-gradient(to bottom,#1a1528,#100d1c);border-left:1px solid #2e1e46;border-right:1px solid #2e1e46;border-bottom:1px solid #2e1e46;}
.shrine-particle{position:absolute;width:3px;height:3px;background:#c0a0ff;border-radius:50%;animation:shrine-float var(--d) var(--delay) ease-in linear infinite;opacity:0;}
@keyframes shrine-float{0%{transform:translateY(0) translateX(0);opacity:0;}15%{opacity:.8;}100%{transform:translateY(-150px) translateX(var(--drift));opacity:0;}}

/* NPC */
.npc{position:absolute;bottom:72px;display:flex;flex-direction:column;align-items:center;animation:npc-idle var(--speed) ease-in-out infinite;cursor:pointer;transition:filter .2s;}
.npc:hover{filter:brightness(1.25);}
.npc.selected{filter:brightness(1.4) drop-shadow(0 0 8px #c0a0ff);}
@keyframes npc-idle{0%,100%{transform:translateY(0);}50%{transform:translateY(-5px);}}
.npc-shadow{width:48px;height:7px;border-radius:50%;background:rgba(0,0,0,.45);margin-top:-3px;animation:shadow-breathe var(--speed) ease-in-out infinite;}
@keyframes shadow-breathe{0%,100%{transform:scaleX(1);opacity:.6;}50%{transform:scaleX(.82);opacity:.3;}}
.npc-figure{position:relative;}
.npc-head{width:var(--hw,24px);height:var(--hh,26px);background:var(--skin,#c8a478);border-radius:45% 45% 38% 38%;margin:0 auto;position:relative;box-shadow:inset -3px -3px 6px rgba(0,0,0,.35);}
.npc-eye{position:absolute;width:4px;height:4px;background:#111;border-radius:50%;top:42%;animation:blink 5.5s ease-in-out infinite var(--blink,0s);}
.npc-eye.l{left:22%;}.npc-eye.r{right:22%;}
@keyframes blink{0%,94%,100%{transform:scaleY(1);}96%{transform:scaleY(.08);}}
.helm{position:absolute;top:-10px;left:-3px;right:-3px;height:16px;background:linear-gradient(to bottom,#708090,#4a5560);border-radius:50% 50% 0 0;box-shadow:inset 0 3px 5px rgba(255,255,255,.15);}
.helm-visor{position:absolute;bottom:-3px;left:10%;right:10%;height:6px;background:#3a4248;border-radius:0 0 3px 3px;}
.hood{position:absolute;top:-14px;left:-5px;right:-5px;height:22px;background:var(--robe-color,#1a1540);border-radius:50% 50% 0 0;box-shadow:-2px -2px 4px rgba(0,0,0,.5);}
.bandana{position:absolute;top:50%;left:-3px;right:-3px;height:10px;background:#6a2030;border-radius:2px;}
.npc-torso{width:var(--tw,30px);height:var(--th,36px);background:var(--armor,#2a3050);border-radius:3px 3px 5px 5px;margin:-2px auto 0;position:relative;border:1px solid rgba(255,255,255,.07);box-shadow:inset -3px -4px 8px rgba(0,0,0,.4);}
.torso-detail{position:absolute;top:6px;left:50%;transform:translateX(-50%);width:10px;height:18px;border:1px solid rgba(255,255,255,.1);border-radius:2px;}
.npc-arm{position:absolute;width:9px;height:var(--th,36px);background:var(--armor,#2a3050);border-radius:3px;top:0;box-shadow:inset -2px -2px 4px rgba(0,0,0,.35);transform-origin:top center;}
.npc-arm.l{right:calc(100% - 2px);animation:arm-l var(--speed) ease-in-out infinite;}
.npc-arm.r{left:calc(100% - 2px);animation:arm-r var(--speed) ease-in-out infinite;}
@keyframes arm-l{0%,100%{transform:rotate(-6deg);}50%{transform:rotate(6deg);}}
@keyframes arm-r{0%,100%{transform:rotate(6deg);}50%{transform:rotate(-6deg);}}
.npc-legs{display:flex;gap:4px;margin:1px auto 0;width:var(--tw,30px);justify-content:center;}
.npc-leg{width:11px;height:var(--lh,28px);background:var(--leg,#18182e);border-radius:2px 2px 4px 4px;border:1px solid rgba(255,255,255,.05);}
.npc-label{position:absolute;top:-26px;width:80px;left:50%;transform:translateX(-50%);text-align:center;}
.npc-stars{color:#f0c040;font-size:9px;text-shadow:0 0 5px #f0c040;letter-spacing:1px;}
.npc-name-tag{color:rgba(190,175,230,.55);font-size:8px;letter-spacing:1.5px;margin-top:2px;text-transform:uppercase;}
.weapon{position:absolute;top:-8px;right:-14px;width:5px;height:60px;background:linear-gradient(to bottom,#c0c8d8,#6a7280);border-radius:2px;}
.weapon::before{content:'';position:absolute;top:-10px;left:50%;transform:translateX(-50%);width:14px;height:14px;background:linear-gradient(135deg,#c0d8ff,#6090d0);clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);}
.staff{position:absolute;top:-22px;left:-12px;width:4px;height:70px;background:linear-gradient(to bottom,#6a4a2a,#3a2818);border-radius:2px;}
.staff-orb{position:absolute;top:-14px;left:50%;transform:translateX(-50%);width:16px;height:16px;background:radial-gradient(circle at 35% 35%,#d0a0ff,#6030a0);border-radius:50%;box-shadow:0 0 8px rgba(160,100,255,.8),0 0 20px rgba(130,70,220,.4);animation:orb-pulse 2.5s ease-in-out infinite;}
@keyframes orb-pulse{0%,100%{box-shadow:0 0 6px rgba(160,100,255,.6);}50%{box-shadow:0 0 14px rgba(200,150,255,1),0 0 28px rgba(160,100,255,.5);}}
.dagger{position:absolute;top:-2px;left:-10px;width:3px;height:22px;background:linear-gradient(to bottom,#e0e8f0,#6a7888);border-radius:1px 1px 0 0;transform:rotate(-20deg);}

/* HADA */
.hada{position:absolute;top:28px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;animation:hada-float 5.5s ease-in-out infinite;}
@keyframes hada-float{0%,100%{transform:translateX(-50%) translateY(0);}50%{transform:translateX(-50%) translateY(-14px);}}
.hada-aura-outer{position:absolute;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(200,230,255,.12) 0%,rgba(140,190,255,.04) 55%,transparent 75%);top:50%;left:50%;transform:translate(-50%,-50%);animation:aura-breathe 5.5s ease-in-out infinite;}
@keyframes aura-breathe{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.7;}50%{transform:translate(-50%,-50%) scale(1.18);opacity:1;}}
.hada-ring{position:absolute;width:80px;height:20px;border:1px solid rgba(180,220,255,.25);border-radius:50%;top:50%;left:50%;transform:translate(-50%,-50%) rotateX(75deg);animation:ring-spin 9s linear infinite;box-shadow:0 0 8px rgba(180,220,255,.15);}
.hada-ring::before{content:'';position:absolute;width:6px;height:6px;background:rgba(200,235,255,.9);border-radius:50%;top:50%;left:0;transform:translateY(-50%);box-shadow:0 0 6px rgba(200,235,255,1);}
@keyframes ring-spin{from{transform:translate(-50%,-50%) rotateX(75deg) rotate(0deg);}to{transform:translate(-50%,-50%) rotateX(75deg) rotate(360deg);}}
.hada-wings{position:absolute;top:10px;width:200px;height:90px;pointer-events:none;}
.wing{position:absolute;border-radius:50%;animation:wing-beat 3.5s ease-in-out infinite var(--wd,0s);}
.w-ul{width:60px;height:48px;right:50%;top:0;transform-origin:right 80%;background:radial-gradient(ellipse at right center,rgba(200,230,255,.5) 0%,rgba(140,200,255,.2) 50%,transparent 80%);border-radius:70% 10% 30% 50%;}
.w-ur{width:60px;height:48px;left:50%;top:0;transform-origin:left 80%;background:radial-gradient(ellipse at left center,rgba(200,230,255,.5) 0%,rgba(140,200,255,.2) 50%,transparent 80%);border-radius:10% 70% 50% 30%;}
.w-ll{width:48px;height:38px;right:50%;top:36px;transform-origin:right 20%;background:radial-gradient(ellipse at right top,rgba(170,210,255,.4) 0%,rgba(120,180,255,.15) 50%,transparent 80%);border-radius:60% 20% 20% 50%;}
.w-lr{width:48px;height:38px;left:50%;top:36px;transform-origin:left 20%;background:radial-gradient(ellipse at left top,rgba(170,210,255,.4) 0%,rgba(120,180,255,.15) 50%,transparent 80%);border-radius:20% 60% 50% 20%;}
@keyframes wing-beat{0%,100%{transform:scaleX(1) rotate(-4deg);opacity:.7;}50%{transform:scaleX(.75) rotate(6deg);opacity:1;}}
.w-ur,.w-lr{animation-direction:reverse;}
.hada-body{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;}
.hada-head{width:30px;height:32px;background:radial-gradient(circle at 38% 32%,rgba(255,255,255,.95) 0%,rgba(200,228,255,.92) 55%,rgba(150,200,255,.85) 100%);border-radius:50%;position:relative;box-shadow:0 0 16px rgba(200,225,255,.85),0 0 35px rgba(140,200,255,.4);}
.hada-eye{position:absolute;width:5px;height:5px;background:rgba(80,140,255,.92);border-radius:50%;top:44%;box-shadow:0 0 7px rgba(160,210,255,1);animation:hada-eye-pulse 3.5s ease-in-out infinite;}
.hada-eye.l{left:24%;}.hada-eye.r{right:24%;}
@keyframes hada-eye-pulse{0%,100%{opacity:.7;}50%{opacity:1;box-shadow:0 0 12px rgba(180,225,255,1);}}
.hada-torso{width:22px;height:34px;background:linear-gradient(175deg,rgba(230,242,255,.95) 0%,rgba(160,205,255,.88) 55%,rgba(110,170,255,.8) 100%);border-radius:4px 4px 7px 7px;margin:-3px auto 0;box-shadow:0 0 16px rgba(170,215,255,.5);}
.hada-skirt{width:36px;height:22px;background:linear-gradient(to bottom,rgba(155,200,255,.75) 0%,rgba(100,160,255,.35) 100%);clip-path:polygon(0% 0%,100% 0%,82% 100%,18% 100%);margin:-2px auto 0;}
.hdot{position:absolute;width:5px;height:5px;background:rgba(210,235,255,.92);border-radius:50%;box-shadow:0 0 7px rgba(200,235,255,.9);top:50%;left:50%;animation:hdot-orbit var(--od) linear infinite var(--odelay);}
@keyframes hdot-orbit{from{transform:rotate(var(--ostart)) translateX(var(--or)) rotate(calc(-1 * var(--ostart)));}to{transform:rotate(calc(var(--ostart) + 360deg)) translateX(var(--or)) rotate(calc(-1 * (var(--ostart) + 360deg)));}}
.hada-label{position:absolute;bottom:-26px;left:50%;transform:translateX(-50%);color:rgba(200,230,255,.7);font-size:9px;letter-spacing:4px;text-transform:uppercase;white-space:nowrap;text-shadow:0 0 10px rgba(180,220,255,.6);}
.amb-rune{position:absolute;color:rgba(100,65,160,.38);font-size:16px;animation:amb-float var(--d) var(--delay) ease-in-out infinite;user-select:none;}
@keyframes amb-float{0%,100%{transform:translateY(0) rotate(0deg);opacity:.25;}50%{transform:translateY(-14px) rotate(8deg);opacity:.65;}}

/* ── WHISPER ALERT ── */
.whisper-alert{display:none;position:absolute;top:14px;left:50%;transform:translateX(-50%);background:rgba(14,10,28,.9);border:1px solid rgba(200,230,255,.35);color:rgba(220,240,255,.85);font-size:11px;padding:7px 16px;border-radius:4px;letter-spacing:.5px;white-space:nowrap;box-shadow:0 0 20px rgba(140,200,255,.2);animation:whisper-in .6s ease-out;}
.whisper-alert.visible{display:block;}
@keyframes whisper-in{from{opacity:0;transform:translateX(-50%) translateY(-6px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
.whisper-label{color:rgba(160,210,255,.55);font-size:9px;letter-spacing:3px;text-transform:uppercase;margin-right:8px;}

/* ── BOTTOM PANELS ── */
.panels{display:flex;gap:0;border-top:1px solid #1e1a2e;min-height:260px;}

/* NPC INSPECTOR */
.inspector{width:320px;flex-shrink:0;background:#0a0918;border-right:1px solid #1e1a2e;padding:16px;overflow-y:auto;}
.inspector-placeholder{color:rgba(160,140,200,.3);font-size:11px;letter-spacing:2px;text-align:center;margin-top:40px;text-transform:uppercase;}
.inspector-name{font-size:16px;color:#e8d8ff;letter-spacing:1px;margin-bottom:2px;}
.inspector-sub{font-size:10px;color:rgba(180,160,220,.5);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;}
.inspector-row{display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;}
.inspector-key{color:rgba(160,140,200,.5);}
.inspector-val{color:#c8b8f0;}
.inspector-tags{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0;}
.tag{font-size:9px;padding:2px 7px;border-radius:2px;letter-spacing:1px;text-transform:uppercase;}
.tag-emergent{background:#1e2840;border:1px solid #3a5080;color:#80a8e0;}
.tag-birth{background:#281840;border:1px solid #5a3080;color:#b080e0;}
.tag-growth{background:#182828;border:1px solid #305050;color:#60a8a8;}
.axes-title{font-size:9px;color:rgba(160,140,200,.4);letter-spacing:3px;text-transform:uppercase;margin:12px 0 6px;}
.axis-row{display:flex;align-items:center;gap:6px;margin-bottom:5px;}
.axis-lbl{width:88px;font-size:10px;color:rgba(200,180,240,.65);flex-shrink:0;text-align:right;}
.axis-bar-track{flex:1;height:4px;background:#1a1530;border-radius:2px;position:relative;}
.axis-bar-fill{height:100%;border-radius:2px;transition:width .3s;}
.axis-val{width:30px;font-size:10px;color:rgba(200,180,240,.7);text-align:right;flex-shrink:0;}
.axis-delta{width:42px;font-size:9px;text-align:right;flex-shrink:0;}

/* CONVERSATION LOG */
.convo-log{flex:1;background:#080816;padding:14px;overflow-y:auto;max-height:260px;}
.log-header{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.log-title{font-size:10px;color:rgba(160,140,200,.4);letter-spacing:3px;text-transform:uppercase;}
.log-count{font-size:10px;color:rgba(160,140,200,.35);}
.log-filters{display:flex;gap:6px;margin-left:auto;}
.filter-btn{font-size:9px;padding:2px 8px;border-radius:2px;border:1px solid #2e2050;background:#1a1530;color:rgba(180,160,220,.5);cursor:pointer;letter-spacing:1px;text-transform:uppercase;}
.filter-btn:hover,.filter-btn.active{border-color:var(--tc,#6040a0);color:var(--tc,#c0a0ff);background:rgba(60,30,100,.3);}
.exchange-entry{border-left:2px solid var(--tc,#404080);padding:8px 10px;margin-bottom:8px;background:rgba(20,16,36,.6);border-radius:0 4px 4px 0;}
.ex-header{display:flex;align-items:center;gap:8px;margin-bottom:4px;}
.topic-tag{font-size:8px;padding:1px 6px;border-radius:2px;text-transform:uppercase;letter-spacing:1px;background:var(--tc,#2a2050);color:var(--tct,#c0a0ff);border:1px solid var(--tc,#4a3080);}
.ex-names{font-size:11px;color:rgba(200,180,240,.8);}
.ex-intensity{font-size:9px;color:rgba(160,140,200,.4);margin-left:auto;}
.nudge-lines{display:flex;flex-direction:column;gap:2px;}
.nudge-line{font-size:10px;color:rgba(180,160,220,.5);}
.nudge-name{color:rgba(180,160,220,.4);}
.nudge-pos{color:#60c880;}
.nudge-neg{color:#c06060;}
.no-exchanges{color:rgba(160,140,200,.25);font-size:11px;text-align:center;margin-top:30px;letter-spacing:1px;}

/* SCROLLBARS */
::-webkit-scrollbar{width:4px;}
::-webkit-scrollbar-track{background:#0a0918;}
::-webkit-scrollbar-thumb{background:#2e2050;border-radius:2px;}
</style>
</head>
<body>

<!-- ── DEV HEADER ── -->
<div class="dev-header">
  <span class="dev-badge">DEV MODE</span>
  <span class="dev-stat" id="stat-ticks"></span>
  <span class="dev-stat" id="stat-exchanges"></span>
  <div class="npc-tabs" id="npc-tabs"></div>
</div>

<!-- ── SHRINE SCENE ── -->
<div class="scene-wrap">
<div class="scene" id="scene">

  <!-- Ambient runes -->
  <span class="amb-rune" style="left:6%;top:20%;--d:6s;--delay:0s">ᚱ</span>
  <span class="amb-rune" style="left:12%;top:50%;--d:8s;--delay:1.5s">ᚦ</span>
  <span class="amb-rune" style="left:4%;top:68%;--d:7s;--delay:3s">ᚷ</span>
  <span class="amb-rune" style="right:7%;top:25%;--d:9s;--delay:.8s">ᚾ</span>
  <span class="amb-rune" style="right:13%;top:52%;--d:6.5s;--delay:2.2s">ᛁ</span>
  <span class="amb-rune" style="right:5%;top:70%;--d:7.5s;--delay:4s">ᛗ</span>
  <span class="amb-rune" style="left:28%;top:10%;--d:10s;--delay:1s">ᚩ</span>
  <span class="amb-rune" style="right:30%;top:8%;--d:8.5s;--delay:2.5s">ᛖ</span>

  <!-- Pillars -->
  <div class="pillar" style="left:18%;height:180px;--d:6s;--delay:0s"></div>
  <div class="pillar" style="left:35%;height:150px;--d:8s;--delay:2s"></div>
  <div class="pillar" style="right:18%;height:175px;--d:7s;--delay:1s"></div>
  <div class="pillar" style="right:35%;height:130px;--d:9s;--delay:3s"></div>

  <!-- HADA -->
  <div class="hada">
    <div class="hada-aura-outer"></div>
    <div class="hada-ring"></div>
    <div class="hada-wings">
      <div class="wing w-ul" style="--wd:0s"></div>
      <div class="wing w-ur" style="--wd:0s"></div>
      <div class="wing w-ll" style="--wd:.18s"></div>
      <div class="wing w-lr" style="--wd:.18s"></div>
    </div>
    <div class="hada-body">
      <div class="hada-head">
        <div class="hada-eye l"></div>
        <div class="hada-eye r"></div>
      </div>
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

  <!-- WHISPER ALERT -->
  <div class="whisper-alert" id="whisper-alert">
    <span class="whisper-label">entidad</span>
    <span id="whisper-text"></span>
  </div>

  <!-- SHRINE -->
  <div class="shrine">
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
      <div class="crystal-beam"></div>
      <div class="crystal-wrap"><div class="crystal"></div></div>
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
    <div class="shrine-step" style="width:180px;height:18px;"></div>
    <div class="shrine-step" style="width:220px;height:14px;"></div>
    <div class="shrine-step" style="width:268px;height:12px;border-bottom:none;"></div>
  </div>

  <!-- NPC: GUERRERO (left) -->
  <div class="npc" id="npc-0" style="left:78px;--speed:3.8s;" onclick="selectNPC(0)">
    <div class="npc-figure">
      <div class="npc-label">
        <div class="npc-stars" id="stars-0"></div>
        <div class="npc-name-tag" id="name-0"></div>
      </div>
      <div class="npc-head" style="--hw:24px;--hh:25px;--skin:#c09060;">
        <div class="helm"><div class="helm-visor"></div></div>
        <div class="npc-eye l" style="--blink:0s"></div>
        <div class="npc-eye r" style="--blink:0s"></div>
      </div>
      <div class="npc-torso" style="--tw:32px;--th:38px;--armor:#3a4860;">
        <div class="torso-detail"></div>
        <div class="npc-arm l" style="--armor:#3a4860;height:38px;"></div>
        <div class="npc-arm r" style="--armor:#3a4860;height:38px;">
          <div class="weapon"></div>
        </div>
      </div>
      <div class="npc-legs" style="--tw:32px;">
        <div class="npc-leg" style="--lh:30px;--leg:#22223a;"></div>
        <div class="npc-leg" style="--lh:30px;--leg:#22223a;"></div>
      </div>
    </div>
    <div class="npc-shadow" style="--speed:3.8s;"></div>
  </div>

  <!-- NPC: MAGO (left inner) -->
  <div class="npc" id="npc-1" style="left:185px;--speed:4.5s;bottom:74px;" onclick="selectNPC(1)">
    <div class="npc-figure">
      <div class="npc-label">
        <div class="npc-stars" id="stars-1"></div>
        <div class="npc-name-tag" id="name-1"></div>
      </div>
      <div class="npc-head" style="--hw:22px;--hh:24px;--skin:#b08868;">
        <div class="hood" style="--robe-color:#1a1255;"></div>
        <div class="npc-eye l" style="--blink:1.2s"></div>
        <div class="npc-eye r" style="--blink:1.2s"></div>
      </div>
      <div class="npc-torso" style="--tw:26px;--th:34px;--armor:#1a1255;">
        <div class="npc-arm l" style="--armor:#1a1255;height:34px;">
          <div class="staff"><div class="staff-orb"></div></div>
        </div>
        <div class="npc-arm r" style="--armor:#1a1255;height:34px;"></div>
      </div>
      <div class="npc-legs" style="--tw:26px;">
        <div class="npc-leg" style="--lh:26px;--leg:#120e3a;"></div>
        <div class="npc-leg" style="--lh:26px;--leg:#120e3a;"></div>
      </div>
    </div>
    <div class="npc-shadow" style="--speed:4.5s;"></div>
  </div>

  <!-- NPC: PÍCARO (right inner) -->
  <div class="npc" id="npc-2" style="right:178px;--speed:4.2s;bottom:74px;" onclick="selectNPC(2)">
    <div class="npc-figure">
      <div class="npc-label">
        <div class="npc-stars" id="stars-2"></div>
        <div class="npc-name-tag" id="name-2"></div>
      </div>
      <div class="npc-head" style="--hw:21px;--hh:23px;--skin:#c09a74;">
        <div class="bandana"></div>
        <div class="npc-eye l" style="--blink:2.5s"></div>
        <div class="npc-eye r" style="--blink:2.5s"></div>
      </div>
      <div class="npc-torso" style="--tw:26px;--th:33px;--armor:#2a2218;">
        <div class="npc-arm l" style="--armor:#2a2218;height:33px;">
          <div class="dagger"></div>
        </div>
        <div class="npc-arm r" style="--armor:#2a2218;height:33px;"></div>
      </div>
      <div class="npc-legs" style="--tw:26px;">
        <div class="npc-leg" style="--lh:27px;--leg:#1a1510;"></div>
        <div class="npc-leg" style="--lh:27px;--leg:#1a1510;"></div>
      </div>
    </div>
    <div class="npc-shadow" style="--speed:4.2s;"></div>
  </div>

  <!-- NPC: ARQUERO (right) -->
  <div class="npc" id="npc-3" style="right:74px;--speed:3.6s;" onclick="selectNPC(3)">
    <div class="npc-figure">
      <div class="npc-label">
        <div class="npc-stars" id="stars-3"></div>
        <div class="npc-name-tag" id="name-3"></div>
      </div>
      <div class="npc-head" style="--hw:23px;--hh:25px;--skin:#b07850;">
        <div class="npc-eye l" style="--blink:.4s"></div>
        <div class="npc-eye r" style="--blink:.4s"></div>
      </div>
      <div class="npc-torso" style="--tw:28px;--th:36px;--armor:#2a3820;">
        <div class="torso-detail" style="border-color:rgba(255,255,255,.08)"></div>
        <div class="npc-arm l" style="--armor:#2a3820;height:36px;"></div>
        <div class="npc-arm r" style="--armor:#2a3820;height:36px;"></div>
      </div>
      <div class="npc-legs" style="--tw:28px;">
        <div class="npc-leg" style="--lh:29px;--leg:#1a2012;"></div>
        <div class="npc-leg" style="--lh:29px;--leg:#1a2012;"></div>
      </div>
    </div>
    <div class="npc-shadow" style="--speed:3.6s;"></div>
  </div>

  <div class="fog"></div>
  <div class="ground"></div>
</div><!-- /scene -->
</div><!-- /scene-wrap -->

<!-- ── BOTTOM PANELS ── -->
<div class="panels">

  <!-- NPC INSPECTOR -->
  <div class="inspector" id="inspector">
    <div class="inspector-placeholder">↑ clic en un NPC para inspeccionar</div>
  </div>

  <!-- CONVERSATION LOG -->
  <div class="convo-log">
    <div class="log-header">
      <span class="log-title">Charlas de fondo</span>
      <span class="log-count" id="log-count"></span>
      <div class="log-filters" id="log-filters"></div>
    </div>
    <div id="log-entries"></div>
  </div>

</div>

<!-- ── DATA + JS ── -->
<script>
const DATA = ${DATA};

// ── Topic config ────────────────────────────────────────────────────────
const TOPICS = {
  training: { label:'training', color:'#4070d0', textColor:'#90b8ff', desc:'comparan técnicas y lo aprendido en los pisos' },
  survival: { label:'survival', color:'#c04040', textColor:'#ff9090', desc:'calculan riesgos y cómo seguir vivos' },
  social:   { label:'social',   color:'#b04090', textColor:'#ff90d0', desc:'algo personal — alguien del pueblo, un vínculo' },
  hobby:    { label:'hobby',    color:'#408040', textColor:'#90d090', desc:'un pasatiempo en común, sin urgencia' },
  casual:   { label:'casual',   color:'#505060', textColor:'#a0a0b8', desc:'cháchara sin agenda, solo acompañarse' },
};

// ── Axis labels (matching debug.ts) ─────────────────────────────────────
const AXIS_LABELS = {
  caution:     ['imprudente','cauto'],
  passivity:   ['combativo','pasivo'],
  submission:  ['dominante','sumiso'],
  warmth:      ['frío','cálido'],
  trust:       ['desconfiado','confiado'],
  altruism:    ['egoísta','altruista'],
  sociability: ['solitario','sociable'],
  integrity:   ['acomodaticio','íntegro'],
  loyalty:     ['desleal','leal'],
  optimism:    ['pesimista','optimista'],
  discipline:  ['impulsivo','disciplinado'],
  curiosity:   ['cerrado','curioso'],
  confidence:  ['inseguro','seguro'],
  forgiveness: ['rencoroso','indulgente'],
};

const AXIS_KEYS = ['caution','passivity','submission','warmth','trust','altruism',
  'sociability','integrity','loyalty','optimism','discipline','curiosity','confidence','forgiveness'];

function axisLabel(key, val) {
  const [low, high] = AXIS_LABELS[key];
  return val < 0.5 ? low : high;
}

function bandOf(v) {
  if (v <= 0.25) return 1;
  if (v <= 0.50) return 2;
  if (v <= 0.75) return 3;
  return 4;
}

function barColor(val) {
  if (val < 0.25) return '#604060';
  if (val < 0.50) return '#504880';
  if (val < 0.75) return '#406080';
  return '#608060';
}

// ── Init ─────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Stars
  const scene = document.getElementById('scene');
  for (let i = 0; i < 80; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const sz = Math.random() < 0.15 ? 2 : 1;
    s.style.cssText = \`width:\${sz}px;height:\${sz}px;top:\${Math.random()*72}%;left:\${Math.random()*100}%;--d:\${2+Math.random()*5}s;--delay:\${Math.random()*6}s;\`;
    scene.insertBefore(s, scene.firstChild);
  }

  // Header stats
  document.getElementById('stat-ticks').textContent = \`\${DATA.ticks.toLocaleString()} ticks simulados\`;
  document.getElementById('stat-exchanges').textContent = \`\${DATA.log.length} charlas registradas\`;

  // NPC name tags + stars in scene
  DATA.npcs.forEach((n, i) => {
    const el = document.getElementById(\`name-\${i}\`);
    if (el) el.textContent = n.name;
    const st = document.getElementById(\`stars-\${i}\`);
    if (st) st.textContent = '★'.repeat(n.stars);
  });

  // NPC tabs in header
  const tabs = document.getElementById('npc-tabs');
  DATA.npcs.forEach((n, i) => {
    const t = document.createElement('div');
    t.className = 'npc-tab';
    t.id = \`tab-\${i}\`;
    t.textContent = \`\${'★'.repeat(n.stars)} \${n.name}\`;
    t.onclick = () => selectNPC(i);
    tabs.appendChild(t);
  });

  // Whisper
  if (DATA.whisper) {
    const el = document.getElementById('whisper-alert');
    document.getElementById('whisper-text').textContent = DATA.whisper;
    el.classList.add('visible');
  }

  // Log
  renderLog(null);

  // Filter buttons
  const filters = document.getElementById('log-filters');
  ['training','survival','social','hobby','casual'].forEach(topic => {
    const count = DATA.log.filter(e => e.topic === topic).length;
    if (count === 0) return;
    const btn = document.createElement('div');
    btn.className = 'filter-btn';
    btn.style.setProperty('--tc', TOPICS[topic].color);
    btn.textContent = \`\${topic} (\${count})\`;
    btn.dataset.topic = topic;
    btn.onclick = () => {
      const active = btn.classList.contains('active');
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      if (!active) { btn.classList.add('active'); renderLog(topic); }
      else renderLog(null);
    };
    filters.appendChild(btn);
  });
});

// ── NPC selection ─────────────────────────────────────────────────────────
let selectedIdx = null;

window.selectNPC = function(idx) {
  selectedIdx = idx;
  // Highlight scene figure
  document.querySelectorAll('.npc').forEach((el, i) => {
    el.classList.toggle('selected', i === idx);
  });
  // Highlight header tab
  document.querySelectorAll('.npc-tab').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  renderInspector(idx);
  renderLog(getActiveFilter(), idx);
};

function getActiveFilter() {
  const active = document.querySelector('.filter-btn.active');
  return active ? active.dataset.topic : null;
}

function renderInspector(idx) {
  const panel = document.getElementById('inspector');
  const n = DATA.npcs[idx];

  // Sort axes by how defining they are (distance from center)
  const sortedAxes = [...AXIS_KEYS].sort(
    (a, b) => Math.abs(n.axesNow[b] - 0.5) - Math.abs(n.axesNow[a] - 0.5)
  );

  const starsHtml = '★'.repeat(n.stars) + '<span style="color:#3a3060">' + '★'.repeat(5 - n.stars) + '</span>';

  const stampsHtml = n.stamps.map(s =>
    \`<span class="tag tag-\${s.kind}">\${s.kind} · \${s.axisKey} @\${s.bandValue}</span>\`
  ).join('');

  const emergentHtml = n.emergent.length
    ? n.emergent.map(e => \`<span class="tag tag-emergent">\${e}</span>\`).join('')
    : '<span style="color:rgba(160,140,200,.3);font-size:10px">ninguno aún</span>';

  const axesHtml = sortedAxes.map(key => {
    const now = n.axesNow[key];
    const orig = n.axesOrig[key];
    const delta = now - orig;
    const lbl = axisLabel(key, now);
    const pct = (now * 100).toFixed(1);
    const color = barColor(now);
    const deltaStr = Math.abs(delta) > 0.0001
      ? \`<span class="axis-delta" style="color:\${delta>0?'#60c880':'#c06060'}">\${delta>0?'+':''}\${delta.toFixed(3)}</span>\`
      : '<span class="axis-delta"></span>';
    return \`<div class="axis-row">
      <span class="axis-lbl">\${lbl}</span>
      <div class="axis-bar-track">
        <div class="axis-bar-fill" style="width:\${pct}%;background:\${color};"></div>
      </div>
      <span class="axis-val">\${now.toFixed(2)}</span>
      \${deltaStr}
    </div>\`;
  }).join('');

  panel.innerHTML = \`
    <div style="margin-bottom:12px;">
      <div class="inspector-name">\${n.name} &nbsp;<span style="color:#f0c040;font-size:13px">\${starsHtml}</span></div>
      <div class="inspector-sub">\${n.origin} · \${n.culture}</div>
    </div>
    <div class="inspector-row"><span class="inspector-key">dificultad</span><span class="inspector-val">\${n.difficulty}/1000</span></div>
    <div class="inspector-row"><span class="inspector-key">piso</span><span class="inspector-val">\${n.floorReached}</span></div>
    <div class="inspector-row" style="margin-top:4px;font-size:10px;color:rgba(160,140,200,.4);font-style:italic;">\${n.observation}</div>
    <div class="axes-title">estampas</div>
    <div class="inspector-tags">\${stampsHtml}</div>
    <div class="axes-title">emergentes</div>
    <div class="inspector-tags">\${emergentHtml}</div>
    <div class="axes-title">ejes — de más a menos definitorio</div>
    \${axesHtml}
  \`;
}

// ── Log rendering ────────────────────────────────────────────────────────
function renderLog(filterTopic, filterNpcIdx) {
  const container = document.getElementById('log-entries');
  let entries = DATA.log;
  if (filterTopic) entries = entries.filter(e => e.topic === filterTopic);
  if (filterNpcIdx != null) {
    const npc = DATA.npcs[filterNpcIdx];
    entries = entries.filter(e => e.aId === npc.id || e.bId === npc.id);
  }

  document.getElementById('log-count').textContent =
    entries.length === DATA.log.length
      ? \`\${entries.length} total\`
      : \`\${entries.length} / \${DATA.log.length}\`;

  if (entries.length === 0) {
    container.innerHTML = '<div class="no-exchanges">Sin charlas para este filtro</div>';
    return;
  }

  container.innerHTML = [...entries].reverse().map(e => {
    const tc = TOPICS[e.topic];
    const nudgeLines = (name, nudges) => {
      const parts = Object.entries(nudges)
        .filter(([,v]) => Math.abs(v) > 0.0001)
        .map(([k, v]) => {
          const cls = v > 0 ? 'nudge-pos' : 'nudge-neg';
          return \`<span class="nudge-name">\${k}</span> <span class="\${cls}">\${v>0?'+':''}\${v.toFixed(4)}</span>\`;
        }).join('  ');
      return parts ? \`<div class="nudge-line">\${name}: \${parts}</div>\` : '';
    };
    const intensityBar = '▮'.repeat(Math.round(e.intensity * 8)) + '▯'.repeat(8 - Math.round(e.intensity * 8));
    return \`<div class="exchange-entry" style="--tc:\${tc.color};">
      <div class="ex-header">
        <span class="topic-tag" style="--tc:\${tc.color};--tct:\${tc.textColor};">\${tc.label}</span>
        <span class="ex-names">\${e.aName} ↔ \${e.bName}</span>
        <span class="ex-intensity">\${intensityBar} \${e.intensity.toFixed(2)}</span>
      </div>
      <div style="font-size:9px;color:rgba(160,140,200,.3);margin-bottom:4px;">\${tc.desc}</div>
      <div class="nudge-lines">
        \${nudgeLines(e.aName, e.nudgesA)}
        \${nudgeLines(e.bName, e.nudgesB)}
      </div>
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

console.log(`✓ ${log.length} charlas simuladas en ${TICKS} ticks`);
console.log(`✓ Pares: ${pairs.length} (${npcs.length} NPCs)`);
console.log(`✓ Susurro: ${whisperMsg ?? '(ninguno)'}`);
console.log(`✓ Generado: ${outPath}`);
