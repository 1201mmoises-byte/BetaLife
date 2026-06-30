/**
 * MUNDO VIVO — orquesta el motor determinista EN TIEMPO REAL (navegador o Node).
 *
 * El motor (src/engine) es puro y determinista; esta capa lo hace "correr": mantiene
 * héroes con ejes/needs/stamps MUTABLES y aplica charlas (que empujan los ejes) y el
 * paso de las necesidades. Así los personajes dejan de ser una foto horneada y SIGUEN
 * APRENDIENDO mientras se juega. No toca el motor: solo lo invoca.
 *
 * Determinismo: la evolución EN VIVO del navegador la disparan encuentros espaciales
 * (no reproducibles), pero el estado resultante se guarda tal cual. El catch-up
 * offline (`simulateOffline`) sí es reproducible: avanza ticks sembrados desde la
 * semilla del pueblo, para fast-forwardear el tiempo que el jugador estuvo fuera.
 */

import { SoulAxes, NPC } from '../engine/types';
import { Town, createTown, summonInTown } from '../engine/town';
import { createSeeder } from '../engine/seeder';
import { rollConversation } from '../engine/conversations';
import { applyConversationNudges } from '../engine/experience';
import { Needs, createNeeds, tickNeeds, Activity } from '../engine/needs';
import { surfaceDream } from '../engine/dreams';
import type { ExpeditionResult } from '../engine/expedition';

export interface LiveHero {
  npc: NPC;             // identidad + ejes VIVOS (npc.axes se reasigna al evolucionar)
  bornAxes: SoulAxes;   // copia al nacer (para leer "ha ido aprendiendo")
  needs: Needs;
  inRoster: boolean;
  alive: boolean;
}

export interface LiveExpedition {
  partyIds: string[];              // npc.id of heroes currently inside
  floor: number;
  returnAt: number;                // epoch ms when they emerge
  resolvedResult?: ExpeditionResult; // pre-computed; absent after page-reload restore
}

export interface LiveWorld {
  town: Town;
  heroes: LiveHero[];
  tick: number;         // ticks de motor transcurridos (avanza el catch-up offline)
  expedition?: LiveExpedition;     // present while heroes are inside the Tower
}

/** Crea un pueblo vivo desde una semilla: invoca el pool y arranca sus necesidades. */
export function createLiveWorld(seed: string, poolSize = 8, initialRoster = 0): LiveWorld {
  const town = createTown(seed);
  const heroes: LiveHero[] = [];
  for (let i = 0; i < poolSize; i++) {
    const npc = summonInTown(town, i + 1);
    heroes.push({
      npc,
      bornAxes: { ...npc.axes },
      needs: createNeeds(createSeeder('needs:' + npc.id), npc.axes),
      inRoster: i < initialRoster,
      alive: true,
    });
  }
  return { town, heroes, tick: 0 };
}

/**
 * Aplica una charla entre dos héroes: si el motor decide que ocurre, MUTA sus ejes
 * (con techo suave + resistencia de origen) y acumula growth-stamps. Devuelve el tema
 * de la charla, o null si no hubo. Lo llaman tanto el navegador (en vivo) como el
 * catch-up offline.
 */
export function applyConversation(world: LiveWorld, ai: number, bi: number, seederKey: string): string | null {
  const A = world.heroes[ai], B = world.heroes[bi];
  if (!A || !B || !A.alive || !B.alive) return null;
  const ex = rollConversation(
    createSeeder(seederKey),
    { id: A.npc.id, axes: A.npc.axes },
    { id: B.npc.id, axes: B.npc.axes },
    { proximity: 0.9, cooldownRemaining: 0 },
  );
  if (!ex) return null;
  const ra = applyConversationNudges(A.npc.axes, A.npc.stamps, ex.nudges.a);
  const rb = applyConversationNudges(B.npc.axes, B.npc.stamps, ex.nudges.b);
  A.npc.axes = ra.axes; if (ra.newStamps.length) A.npc.stamps = [...A.npc.stamps, ...ra.newStamps];
  B.npc.axes = rb.axes; if (rb.newStamps.length) B.npc.stamps = [...B.npc.stamps, ...rb.newStamps];
  return ex.topic;
}

/** Avanza las necesidades de un héroe según su actividad. Marca como caído si HP = 0. */
export function tickHeroNeeds(h: LiveHero, activity: Activity, n = 1): void {
  if (!h.alive) return;
  h.needs = tickNeeds(h.needs, h.npc.axes, activity, n);
  if (h.needs.health <= 0) h.alive = false;
}

/** Intenta aflorar un sueño (raro, escala con estrellas). Devuelve el fragmento o null. */
export function tryDream(h: LiveHero, seederKey: string): string | null {
  const m = surfaceDream(createSeeder(seederKey), h.npc);
  return m ? m.text : null;
}

/**
 * Catch-up offline DETERMINISTA: avanza `ticks` pasos del mundo. En cada uno empareja
 * dos héroes del roster (sembrado por town.seed + tick), aplica una charla y mueve las
 * necesidades. Reproducible: el mismo (semilla, estado, ticks) da el mismo resultado.
 */
export function simulateOffline(world: LiveWorld, ticks: number): void {
  for (let t = 0; t < ticks; t++) {
    world.tick++;
    const s = createSeeder(world.town.seed + ':off:' + world.tick);
    const roster = world.heroes.filter((h) => h.inRoster && h.alive);
    if (roster.length >= 2) {
      const i = s.nextInt(0, roster.length - 1);
      let j = s.nextInt(0, roster.length - 1);
      if (j === i) j = (j + 1) % roster.length;
      applyConversation(world, world.heroes.indexOf(roster[i]), world.heroes.indexOf(roster[j]),
        world.town.seed + ':offc:' + world.tick);
    }
    for (const h of roster) tickHeroNeeds(h, 'idle', 1);
  }
}
