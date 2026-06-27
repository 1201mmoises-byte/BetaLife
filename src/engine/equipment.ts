import { NPC } from './types';
import { createSeeder, Seeder } from './seeder';
import { CombatStats } from './stats';

/**
 * RPG — Capa de EQUIPAMIENTO.
 *
 * Tres ganchos del handoff:
 *   · NPC.stars  → sesga la CALIDAD máxima que puede usar (1★ usa hasta tier 1).
 *   · NPC.originArchetypeId → sesga los TIPOS compatibles (afinidad de origen).
 *   · NPC.level  → desbloquea SLOTS de equipamiento adicionales.
 *
 * El loadout NO se guarda dentro del NPC (los ejes son el alma; esto es otra
 * capa). La capa de persistencia lo mantiene aparte, indexado por npc.id, y lo
 * pasa al combate. Así "ejes ≠ stats ≠ equipo" se respeta a nivel de tipos.
 *
 * Drops deterministas: generateEquipment(seed, floor, difficulty) — mismo input,
 * mismo objeto, siempre. Nunca Math.random.
 */

export type EquipmentType = 'weapon-heavy' | 'weapon-light' | 'staff' | 'shield' | 'trinket';
export type EquipmentSlot = 'mainHand' | 'offHand' | 'trinket';

export interface Equipment {
  id: string;
  name: string;          // mostrable (es)
  type: EquipmentType;
  slot: EquipmentSlot;
  quality: number;       // 1..5 (tier; gateado por estrellas)
  mods: Partial<Pick<CombatStats, 'maxHp' | 'atk' | 'def' | 'spd'>>; // mecánica interna
  observation: string;   // lo que el jugador percibe del objeto
}

const TYPE_SLOT: Record<EquipmentType, EquipmentSlot> = {
  'weapon-heavy': 'mainHand',
  'weapon-light': 'mainHand',
  'staff': 'mainHand',
  'shield': 'offHand',
  'trinket': 'trinket',
};

// Afinidad por arquetipo de origen (no hay clases; el origen del alma sesga el
// arsenal natural). Cada arquetipo prefiere ciertos tipos; 'difuso' es versátil.
const ARCHETYPE_AFFINITY: Record<string, EquipmentType[]> = {
  honor:      ['weapon-heavy', 'shield'],
  imprudente: ['weapon-light'],
  calido:     ['trinket', 'staff'],
  rencoroso:  ['weapon-heavy', 'weapon-light'],
  erudito:    ['staff', 'trinket'],
  difuso:     ['weapon-heavy', 'weapon-light', 'staff', 'shield', 'trinket'],
};

const ALL_TYPES: EquipmentType[] = ['weapon-heavy', 'weapon-light', 'staff', 'shield', 'trinket'];

const TYPE_NAMES: Record<EquipmentType, string[]> = {
  'weapon-heavy': ['Mandoble', 'Hacha de guerra', 'Maza pesada'],
  'weapon-light': ['Daga', 'Estoque', 'Par de cuchillas'],
  'staff':        ['Bastón rúnico', 'Cayado tallado', 'Vara de saúco'],
  'shield':       ['Escudo torre', 'Broquel', 'Égida abollada'],
  'trinket':      ['Amuleto gastado', 'Anillo deslustrado', 'Talismán de hueso'],
};

const QUALITY_WORD = ['', 'tosco', 'sólido', 'fino', 'magistral', 'legendario'];

/** Calidad máxima que un alma puede empuñar, gateada por su rareza. */
export function maxQualityForStars(stars: number): number {
  return Math.max(1, Math.min(5, stars));
}

/**
 * Slots desbloqueados por nivel:
 *   nivel 1+  → mainHand
 *   nivel 5+  → + offHand
 *   nivel 10+ → + trinket
 */
export function unlockedSlots(level: number): EquipmentSlot[] {
  const slots: EquipmentSlot[] = ['mainHand'];
  if (level >= 5) slots.push('offHand');
  if (level >= 10) slots.push('trinket');
  return slots;
}

export function affinityFor(archetypeId: string): EquipmentType[] {
  return ARCHETYPE_AFFINITY[archetypeId] ?? ALL_TYPES;
}

/** ¿Puede este NPC usar este objeto? Calidad ≤ tope por estrellas y slot abierto. */
export function equippableBy(item: Equipment, npc: Pick<NPC, 'stars' | 'level'>): boolean {
  return item.quality <= maxQualityForStars(npc.stars)
    && unlockedSlots(npc.level).includes(item.slot);
}

function statModsFor(type: EquipmentType, quality: number): Equipment['mods'] {
  const q = quality; // 1..5, escala lineal
  switch (type) {
    case 'weapon-heavy': return { atk: 4 * q, spd: -q };
    case 'weapon-light': return { atk: 2 * q, spd: 2 * q };
    case 'staff':        return { atk: 3 * q, maxHp: 2 * q };
    case 'shield':       return { def: 4 * q, spd: -q };
    case 'trinket':      return { maxHp: 5 * q, def: q };
  }
}

/**
 * Genera un drop determinista para un piso. La calidad escala con el piso y la
 * dificultad del pueblo (mundos brutales sueltan mejor botín), topada en 5.
 * El tipo se elige del seeder. Mismo (seed, floor, difficulty) → mismo objeto.
 */
export function generateEquipment(townSeed: string, floor: number, difficulty: number): Equipment {
  const s: Seeder = createSeeder(`town:${townSeed}:floor:${floor}:loot`);
  const type = s.branch('type').nextChoice(ALL_TYPES);

  const diffNorm = Math.max(0, Math.min(1, (difficulty - 1) / 999));
  // Piso y dificultad empujan la calidad; jitter determinista de ±1 tier.
  const base = 1 + floor / 12 + diffNorm * 2;
  const jitter = s.branch('q').nextInt(-1, 1);
  const quality = Math.max(1, Math.min(5, Math.round(base) + jitter));

  const name = s.branch('name').nextChoice(TYPE_NAMES[type]);
  const observation = `${name} ${QUALITY_WORD[quality]}.`;

  return {
    id: `eq-${townSeed}-${floor}-${type}-${quality}`,
    name, type, slot: TYPE_SLOT[type], quality,
    mods: statModsFor(type, quality),
    observation,
  };
}

/**
 * Aplica un loadout a unos stats base. Pura: devuelve copia nueva. Ignora
 * objetos no equipables por el NPC (gateo por estrellas/slots) y respeta un solo
 * objeto por slot (el primero que aparezca gana). HP no puede bajar de 1.
 */
export function applyLoadout(
  base: CombatStats,
  npc: Pick<NPC, 'stars' | 'level'>,
  items: Equipment[],
): CombatStats {
  const out: CombatStats = { ...base };
  const usedSlots = new Set<EquipmentSlot>();

  for (const item of items) {
    if (!equippableBy(item, npc)) continue;
    if (usedSlots.has(item.slot)) continue;
    usedSlots.add(item.slot);
    out.maxHp += item.mods.maxHp ?? 0;
    out.atk += item.mods.atk ?? 0;
    out.def += item.mods.def ?? 0;
    out.spd += item.mods.spd ?? 0;
  }

  out.maxHp = Math.max(1, out.maxHp);
  out.atk = Math.max(0, out.atk);
  out.def = Math.max(0, out.def);
  out.spd = Math.max(1, out.spd);
  out.hp = out.maxHp; // recalibra el HP lleno tras modificar el máximo
  return out;
}
