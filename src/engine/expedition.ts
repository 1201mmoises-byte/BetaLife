import { NPC } from './types';
import { createSeeder } from './seeder';
import { Town } from './town';
import { deriveStats, fullHeal } from './stats';
import { deriveSkills } from './skills';
import { Equipment, applyLoadout, generateEquipment } from './equipment';
import { generateFloorMonsters } from './monsters';
import { Combatant, CombatResult, resolveCombat } from './combat';
import { applyExperience } from './experience';
import { applyFloorCleared } from './progression';

/**
 * RPG — Orquestador de EXPEDICIÓN (la capa que cierra el bucle).
 *
 * Une todo: deriva stats del alma, equipa el loadout, lee las habilidades,
 * genera los monstruos del piso, resuelve el combate y luego — lo importante —
 * devuelve la experiencia AL ALMA: los supervivientes mueven sus ejes (con el
 * multiplicador de estrellas YA activo), sellan growth stamps, suben de nivel y
 * registran el piso; los caídos quedan isAlive:false para siempre.
 *
 * Puro y determinista: no muta la party recibida; devuelve copias nuevas.
 * El jugador solo ve `result.narration`. Todo lo numérico se queda dentro.
 */

export interface ExpeditionResult {
  floor: number;
  result: CombatResult;
  party: NPC[];        // copias actualizadas (evolucionadas, niveladas, o caídas)
  drops: Equipment[];  // botín si hubo victoria
}

/** Loadout opcional por NPC, indexado por npc.id (vive fuera del NPC). */
export type Loadouts = Record<string, Equipment[]>;

function toCombatant(npc: NPC, loadout: Equipment[]): Combatant {
  const base = fullHeal(deriveStats(npc));
  const stats = applyLoadout(base, npc, loadout);
  return {
    id: npc.id,
    name: npc.name,
    stats,
    skills: deriveSkills(npc),
    isNpc: true,
    axes: npc.axes,
  };
}

export function runExpedition(
  town: Town,
  floor: number,
  party: NPC[],
  loadouts: Loadouts = {},
): ExpeditionResult {
  // Solo bajan los vivos.
  const living = party.filter((n) => n.isAlive);

  const npcCombatants = living.map((n) => toCombatant(n, loadouts[n.id] ?? []));
  const monsterCombatants: Combatant[] = generateFloorMonsters(town, floor).map((m) => ({
    id: m.id,
    name: m.name,
    stats: m.stats,
    skills: [],
    isNpc: false,
    trait: m.trait,
  }));

  const result = resolveCombat(`${town.seed}:f${floor}`, npcCombatants, monsterCombatants);
  const fallen = new Set(result.fallenNpcIds);

  const updated: NPC[] = party.map((npc) => {
    if (!npc.isAlive) return npc;              // ya estaba fuera
    if (fallen.has(npc.id)) return { ...npc, isAlive: false }; // permadeath

    // Superviviente: la experiencia vuelve al alma (estrellas YA activas).
    const ev = result.npcEvents[npc.id];
    const es = createSeeder(`expedition:${town.seed}:f${floor}:${npc.id}`);
    const { axes, newStamps } = applyExperience(es, npc.axes, npc.stamps, ev, npc.stars);

    let evolved: NPC = { ...npc, axes, stamps: [...npc.stamps, ...newStamps] };
    if (result.outcome === 'victory') {
      evolved = applyFloorCleared(evolved, floor);
    }
    return evolved;
  });

  const drops = result.outcome === 'victory'
    ? [generateEquipment(town.seed, floor, town.difficulty)]
    : [];

  return { floor, result, party: updated, drops };
}
