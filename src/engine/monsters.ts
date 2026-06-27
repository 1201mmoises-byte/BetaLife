import { createSeeder, Seeder } from './seeder';
import { Town } from './town';
import { CombatStats } from './stats';

/**
 * RPG — Capa de MONSTRUOS por piso.
 *
 * Completamente determinista: createSeeder(`town:${seed}:floor:${n}:monsters`).
 * El mismo pueblo + piso produce siempre el mismo encuentro. Variables de escala
 * (del handoff):
 *   · town.difficulty (1-1000) → dureza base de las criaturas del piso
 *   · floor                    → multiplicador progresivo (cada piso pesa más)
 *   · town.rosterFloor         → leve presión extra por meta-progresión del roster
 *
 * Igual que los NPC, un monstruo se *lee* por conducta observable, no por sus
 * números (que existen solo dentro del motor de combate).
 */

export interface Monster {
  id: string;
  name: string;          // generado (es)
  stats: CombatStats;
  trait: string;         // etiqueta interna de comportamiento de combate
  observation: string;   // lo que el jugador percibe
}

const PREFIX = ['Acechador', 'Devorador', 'Centinela', 'Carroñero', 'Heraldo', 'Resto', 'Aullido', 'Sombra'];
const OF = ['del Foso', 'de Ceniza', 'sin Nombre', 'de la Grieta', 'Hueco', 'de Sal', 'del Umbral', 'Marchito'];

// Rasgos de combate: sesgan cómo actúa la criatura en el resolver.
const TRAITS = [
  { id: 'feroz',     observation: 'Carga sin medir el riesgo, todo dientes y avance.' },
  { id: 'acorazado', observation: 'Avanza despacio, como si nada pudiera atravesarlo.' },
  { id: 'veloz',     observation: 'Se mueve a tirones, demasiado rápido para seguirlo.' },
  { id: 'tenaz',     observation: 'No cae cuando debería; se levanta una vez más.' },
];

function scaledStats(s: Seeder, difficulty: number, floor: number, rosterFloor: number, trait: string): CombatStats {
  const diffNorm = Math.max(0, Math.min(1, (difficulty - 1) / 999));
  // Multiplicador de potencia: base 1 + dificultad + piso (progresivo) + leve
  // empuje por progreso global del roster (el crisol sube con todos).
  const power = 1
    + diffNorm * 1.5
    + floor * 0.12
    + Math.floor(rosterFloor / 10) * 0.05;

  const roll = (min: number, max: number) => s.branch('hp').nextFloat(min, max);
  let maxHp = Math.round((30 + roll(0, 30)) * power);
  let atk   = Math.round((8 + s.branch('atk').nextFloat(0, 8)) * power);
  let def   = Math.round((4 + s.branch('def').nextFloat(0, 6)) * power);
  let spd   = Math.round((9 + s.branch('spd').nextFloat(0, 10)) * power);

  // El rasgo deforma el perfil para que cada criatura "lea" distinta.
  if (trait === 'feroz')     { atk = Math.round(atk * 1.35); def = Math.round(def * 0.8); }
  if (trait === 'acorazado') { def = Math.round(def * 1.6); spd = Math.round(spd * 0.7); }
  if (trait === 'veloz')     { spd = Math.round(spd * 1.5); maxHp = Math.round(maxHp * 0.8); }
  if (trait === 'tenaz')     { maxHp = Math.round(maxHp * 1.4); atk = Math.round(atk * 0.9); }

  return { maxHp: Math.max(1, maxHp), hp: Math.max(1, maxHp), atk: Math.max(1, atk), def: Math.max(0, def), spd: Math.max(1, spd) };
}

/** Cuántas criaturas habitan un piso (crece despacio con la profundidad). */
export function monsterCountForFloor(floor: number): number {
  return Math.min(5, 1 + Math.floor(floor / 4));
}

/**
 * Genera el encuentro completo de un piso. Determinista por (town.seed, floor).
 * `town.rosterFloor` añade una leve presión de meta-progresión.
 */
export function generateFloorMonsters(town: Town, floor: number): Monster[] {
  const root = createSeeder(`town:${town.seed}:floor:${floor}:monsters`);
  const count = monsterCountForFloor(floor);
  const monsters: Monster[] = [];

  for (let i = 0; i < count; i++) {
    const s = root.branch(String(i));
    const trait = s.branch('trait').nextChoice(TRAITS);
    const name = `${s.branch('p').nextChoice(PREFIX)} ${s.branch('o').nextChoice(OF)}`;
    monsters.push({
      id: `mon-${town.seed}-${floor}-${i}`,
      name,
      stats: scaledStats(s, town.difficulty, floor, town.rosterFloor, trait.id),
      trait: trait.id,
      observation: trait.observation,
    });
  }

  return monsters;
}
