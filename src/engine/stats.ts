import { SoulAxes, StarRating, NPC } from './types';

/**
 * RPG — Capa de STATS de combate.
 *
 * Regla de diseño innegociable: los 14 ejes son PERSONALIDAD, no combate.
 * Los stats (HP, ATK, DEF, SPD) son una capa SEPARADA que se *deriva* del alma.
 * Aquí vive esa derivación. No hay azar: dados los mismos ejes + estrella +
 * nivel, los stats son siempre idénticos (determinismo total, función pura).
 *
 * Intención de diseño (del handoff):
 *   HP  = f(confidence, caution, stars, level)   alma resiliente + cauta = más vida
 *   ATK = f(1-passivity, confidence, stars, level) agresivo + seguro    = más ataque
 *   DEF = f(caution, discipline, stars, level)    cauto + disciplinado  = más defensa
 *   SPD = f(1-caution, curiosity, stars)          imprudente + curioso  = más velocidad
 *
 * Nada de esto se le muestra crudo al jugador: la entidad (mediator) traduce.
 * En combate sí se usan los números, pero el jugador solo ve la conducta.
 */

export interface CombatStats {
  maxHp: number;
  hp: number;   // arranca == maxHp; el combate trabaja sobre una copia
  atk: number;
  def: number;
  spd: number;
}

// --- Tunables de derivación (afinables en diseño) -------------------------
// base = piso de un alma "neutra" (todos los ejes en 0.5); span = cuánto suma
// la inclinación del alma hacia los polos relevantes.
const HP_BASE = 40, HP_SPAN = 60;
const ATK_BASE = 12, ATK_SPAN = 28;
const DEF_BASE = 8,  DEF_SPAN = 24;
const SPD_BASE = 10, SPD_SPAN = 20;

// Las estrellas son el modificador POR-NPC (la dificultad del pueblo ya quedó
// horneada en el nivel de estrella). Mismo slope que starProgressionMultiplier
// (0.15/estrella) para que stats y velocidad-de-progreso lean coherentes.
const STAR_STAT_SLOPE = 0.15;   // 1★→1.00 … 5★→1.60

// El nivel sube HP/ATK/DEF (no SPD: por diseño la velocidad nace del alma).
const LEVEL_STAT_SLOPE = 0.08;  // +8% por nivel

/** Mezcla ponderada de ejes (cada peso 0..1); devuelve un escalar 0..1. */
function blend(...pairs: [number, number][]): number {
  let acc = 0, wsum = 0;
  for (const [value, weight] of pairs) {
    acc += value * weight;
    wsum += weight;
  }
  return wsum === 0 ? 0.5 : acc / wsum;
}

export function starStatFactor(stars: StarRating): number {
  return 1 + (stars - 1) * STAR_STAT_SLOPE;
}

export function levelStatFactor(level: number): number {
  return 1 + Math.max(0, level - 1) * LEVEL_STAT_SLOPE;
}

/**
 * Deriva los stats de combate desde el alma. Pura y determinista: sin seeder,
 * sin estado. `hp` arranca lleno (== maxHp).
 */
export function deriveStats(npc: Pick<NPC, 'axes' | 'stars' | 'level'>): CombatStats {
  const a = npc.axes;
  const starF = starStatFactor(npc.stars);
  const lvlF = levelStatFactor(npc.level);

  // Cada eje aporta como inclinación hacia su polo relevante.
  const hpMix  = blend([a.confidence, 1.0], [a.caution, 0.7]);
  const atkMix = blend([1 - a.passivity, 1.0], [a.confidence, 0.6]);
  const defMix = blend([a.caution, 1.0], [a.discipline, 0.8]);
  const spdMix = blend([1 - a.caution, 1.0], [a.curiosity, 0.5]);

  const maxHp = Math.round((HP_BASE + HP_SPAN * hpMix) * starF * lvlF);
  const atk   = Math.round((ATK_BASE + ATK_SPAN * atkMix) * starF * lvlF);
  const def   = Math.round((DEF_BASE + DEF_SPAN * defMix) * starF * lvlF);
  const spd   = Math.round((SPD_BASE + SPD_SPAN * spdMix) * starF); // sin nivel

  return { maxHp, hp: maxHp, atk, def, spd };
}

/** Copia de stats con el HP reseteado al máximo (entre expediciones). */
export function fullHeal(stats: CombatStats): CombatStats {
  return { ...stats, hp: stats.maxHp };
}
