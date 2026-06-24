import { NPC, Memory } from './types';
import { Seeder } from './seeder';

/**
 * SUEÑOS — la fuga controlada del misterio.
 *
 * Los héroes OLVIDARON su mundo al ser traídos al pueblo (de ahí el misterio).
 * Pero algunos sueños devuelven fragmentos: un recuerdo aún no aflorado sube a la
 * superficie. Cuanto más cerca estuvo el héroe del fin del mundo (más estrellas),
 * más sueña — y lo que sueña es más central y ominoso.
 *
 * Determinista: dado el mismo `seeder` y el mismo estado del NPC, decide igual.
 * `surfaceDream` MUTA el recuerdo elegido (`surfaced = true`) para que no vuelva a
 * aflorar; por eso el llamador pasa un seeder distinto por "noche" (p.ej. ramas
 * por día/tick). No se conecta a ningún loop todavía: lo consume el preview/Hada
 * ("anoche soñó con…") y, más adelante, el descanso en la Posada.
 */

/** Probabilidad de soñar esta noche, escalada por estrellas (1★ .12 → 5★ .36). */
export function dreamChance(npc: NPC): number {
  return 0.12 + (npc.stars - 1) * 0.06;
}

/**
 * Intenta aflorar un recuerdo. Devuelve el recuerdo (ya marcado `surfaced`) o null
 * si esta noche no sueña o si ya no le quedan recuerdos por aflorar.
 */
export function surfaceDream(seeder: Seeder, npc: NPC): Memory | null {
  const pending = npc.lore.memories.filter((m) => !m.surfaced);
  if (!pending.length) return null;

  const ds = seeder.branch('dream:' + npc.id);
  if (ds.nextFloat() >= dreamChance(npc)) return null;

  // Elige ponderado por `weight`: los recuerdos más centrales insisten más.
  const total = pending.reduce((sum, m) => sum + m.weight, 0);
  let roll = ds.nextFloat(0, total);
  let picked = pending[pending.length - 1];
  for (const m of pending) { roll -= m.weight; if (roll < 0) { picked = m; break; } }

  picked.surfaced = true;
  return picked;
}
