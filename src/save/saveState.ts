/**
 * GUARDADO — serializa/restaura una partida viva. Gracias al determinismo del motor
 * el save es PEQUEÑO: guarda semillas + el estado mutable (ejes/needs/stamps/sueños);
 * nombre, cultura, pastLife, lore y mundo se REGENERAN de la semilla al restaurar.
 *
 * Se usa para el guardado en device (localStorage/IndexedDB) y, envuelto, para la
 * sincronización en la nube (Supabase). Puro y testeable en Node.
 */

import { SoulAxes, Stamp } from '../engine/types';
import { Needs } from '../engine/needs';
import { createTown } from '../engine/town';
import { regenerateNPC } from '../engine/npcGenerator';
import { LiveWorld, LiveHero } from '../runtime/liveWorld';

export const SAVE_VERSION = 1;

export interface SavedHero {
  seed: string;
  axes: SoulAxes;
  stamps: Stamp[];
  needs: Needs;
  surfaced: number[];   // índices de memorias ya afloradas (sueños)
  bornAxes: SoulAxes;
  inRoster: boolean;
  alive: boolean;
  level: number;
  floorReached: number;
}

export interface ExpeditionSave {
  partyIds: string[];
  floor: number;
  returnAt: number;
  // resolvedResult is NOT saved — it is recomputed from the hero state on restore
}

export interface SaveState {
  v: number;
  townSeed: string;
  difficulty: number;
  rosterFloor: number;
  tick: number;
  lastSeen: number;     // epoch ms — para el catch-up offline
  heroes: SavedHero[];
  expedition?: ExpeditionSave;
}

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
      level: h.npc.level,
      floorReached: h.npc.floorReached,
    })),
    expedition: world.expedition
      ? { partyIds: world.expedition.partyIds, floor: world.expedition.floor, returnAt: world.expedition.returnAt }
      : undefined,
  };
}

export function restoreSave(save: SaveState): LiveWorld {
  // createTown reproduce difficulty + world idénticos desde la semilla.
  const town = createTown(save.townSeed, save.rosterFloor);
  const heroes: LiveHero[] = save.heroes.map((sh) => {
    const npc = regenerateNPC(sh.seed, sh.axes, {
      stamps: sh.stamps,
      difficulty: save.difficulty,
      rosterFloorAtSummon: save.rosterFloor,
      worldSeed: save.townSeed,
      level: sh.level ?? 1,
      floorReached: sh.floorReached ?? 0,
      isAlive: sh.alive,
    });
    // re-marcar los sueños que ya habían aflorado
    sh.surfaced.forEach((i) => { if (npc.lore.memories[i]) npc.lore.memories[i].surfaced = true; });
    return { npc, bornAxes: sh.bornAxes, needs: sh.needs, inRoster: sh.inRoster, alive: sh.alive };
  });
  return { town, heroes, tick: save.tick, expedition: save.expedition };
}
