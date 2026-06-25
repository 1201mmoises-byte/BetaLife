/**
 * Simulación compartida del preview.
 *
 * `buildSlice.ts` corre esta simulación determinista para hornear el estado inicial
 * del slice 3D (ejes evolucionados + log de charlas para el resumen offline). Las
 * charlas con texto se componen EN VIVO en el navegador (sin Gemini, sin caché).
 *
 * Integra el modelo nuevo: una sola DIFICULTAD de pueblo (createTown) compartida
 * por todos los NPC invocados, en vez de que cada uno tire la suya.
 */

import { createTown, summonInTown, Town } from '../src/engine/town';
import { createSeeder } from '../src/engine/seeder';
import { rollConversation, CONVERSATION_COOLDOWN } from '../src/engine/conversations';
import { applyConversationNudges } from '../src/engine/experience';
import { readBehavior } from '../src/engine/behavior';
import { NPC, SoulAxes } from '../src/engine/types';

export const ROLES = ['warrior', 'mage', 'rogue', 'archer'];
export const POOL_SIZE = 8;
export const INITIAL = 4;
export const TICKS = 3000;
export const TOWN_SEED = 'shrine-dev-town';

export interface ExchangeRecord {
  tick: number;
  aId: string; aName: string;
  bId: string; bName: string;
  topic: string;
  intensity: number;
  nudgesA: Partial<Record<string, number>>;
  nudgesB: Partial<Record<string, number>>;
  // Conducta OBSERVABLE de cada uno al momento de la charla (no se filtran ejes
  // crudos — solo lo que se vería mirando). Es la "persona" que recibe la IA.
  cuesA: string[];
  cuesB: string[];
}

export interface PreviewSim {
  town: Town;
  pool: NPC[];
  roster: NPC[];
  currentAxes: Record<string, SoulAxes>;
  log: ExchangeRecord[];
}

/** Corre la simulación determinista y devuelve pool, roster, ejes finales y log. */
export function runPreviewSim(): PreviewSim {
  // Pool: una sola dificultad de pueblo para TODOS (modelo nuevo).
  const town = createTown(TOWN_SEED);
  const pool: NPC[] = Array.from({ length: POOL_SIZE }, (_, i) => summonInTown(town, i + 1));

  const currentAxes: Record<string, SoulAxes> = {};
  pool.forEach((n) => { currentAxes[n.id] = { ...n.axes }; });

  const roster = pool.slice(0, INITIAL);
  const pairs: [number, number][] = [];
  for (let i = 0; i < roster.length - 1; i++)
    for (let j = i + 1; j < roster.length; j++)
      pairs.push([i, j]);

  const world = createSeeder('shrine-dev-preview');
  const cooldowns = new Map<string, number>();
  const log: ExchangeRecord[] = [];

  for (let t = 0; t < TICKS; t++) {
    for (const [ai, bi] of pairs) {
      const na = roster[ai], nb = roster[bi];
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
        // Conducta observable al momento (antes de aplicar el empujón de esta charla).
        const cuesA = readBehavior(createSeeder('cue:' + na.id), currentAxes[na.id], 2);
        const cuesB = readBehavior(createSeeder('cue:' + nb.id), currentAxes[nb.id], 2);
        currentAxes[na.id] = ra.axes;
        currentAxes[nb.id] = rb.axes;
        log.push({
          tick: t, aId: na.id, aName: na.name, bId: nb.id, bName: nb.name,
          topic: ex.topic, intensity: ex.intensity,
          nudgesA: ex.nudges.a as Record<string, number>,
          nudgesB: ex.nudges.b as Record<string, number>,
          cuesA, cuesB,
        });
      }
    }
  }

  return { town, pool, roster, currentAxes, log };
}
