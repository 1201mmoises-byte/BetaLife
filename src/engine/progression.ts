import { NPC } from './types';

/**
 * RPG — Capa de NIVEL / progresión.
 *
 * El handoff dejó `NPC.level` declarado, persistente y siempre en 1. Aquí se
 * activa el gancho. Regla de diseño elegida: SE CRECE DESCENDIENDO. El nivel no
 * puede superar (piso más profundo alcanzado + 1), así que subir de nivel exige
 * escalar el crisol — no se puede "farmear" en pisos triviales para siempre.
 *
 * Todo puro: cada función devuelve una copia nueva del NPC, nunca muta.
 */

/** Primitiva pedida por el handoff: sube un nivel. Pura. */
export function levelUp(npc: NPC): NPC {
  return { ...npc, level: npc.level + 1 };
}

/** Tope de nivel para un NPC dado el piso más profundo que ha alcanzado. */
export function levelCap(floorReached: number): number {
  return floorReached + 1;
}

/**
 * Registra que un NPC superó un piso: actualiza `floorReached` (meta-progresión
 * individual) y sube un nivel si el nuevo tope lo permite. Pura.
 */
export function applyFloorCleared(npc: NPC, floor: number): NPC {
  const floorReached = Math.max(npc.floorReached, floor);
  let next: NPC = { ...npc, floorReached };
  if (next.level < levelCap(floorReached)) {
    next = levelUp(next);
  }
  return next;
}
