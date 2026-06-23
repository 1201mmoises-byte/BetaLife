import { SoulAxes, Stamp } from './types';
import { OriginArchetype } from './archetypes';
import { AXIS_KEYS } from './axes';

/**
 * Fase 3 — Sistema de estampas.
 *
 * Los ejes crecen en BANDAS. Cruzar una banda sella una estampa PERMANENTE
 * (un capítulo cerrado, como los anillos de un árbol). Las estampas nunca se
 * borran aunque el eje luego se mueva — son el mecanismo técnico del
 * "acento de origen". La estampa de nacimiento es la primera (el anillo más
 * interno).
 *
 * El MOVIMIENTO de los ejes que dispara los sellos llega en la Fase 4; aquí
 * está el cimiento: las bandas, la estampa de nacimiento, el sellado por cruce
 * y el techo suave (el movimiento casi se detiene cerca de los extremos).
 */

export const BANDS = [0.0, 0.25, 0.5, 0.75, 1.0];
const BAND_BOUNDARIES = [0.125, 0.375, 0.625, 0.875]; // edges between the 5 bands

/** Index of the band a value sits in: 0 (más bajo) … 4 (más alto). */
export function bandOf(value: number): number {
  let i = 0;
  while (i < BAND_BOUNDARIES.length && value >= BAND_BOUNDARIES[i]) i++;
  return i;
}

/** Nearest band anchor value (0, 0.25, 0.5, 0.75, 1.0) to a continuous value. */
export function nearestBand(value: number): number {
  return BANDS.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
}

/**
 * Seals the BIRTH stamp — the permanent "acento de origen". When the archetype
 * declares a primary axis, the stamp seals it (so stamp ↔ history always agree).
 * Otherwise (difuso origin) it falls on the most extreme axis.
 * `sealedAt` is provided by the caller; pure generation uses 0 for determinism
 * (the persistence layer assigns a real timestamp on first summon).
 */
export function sealBirthStamp(
  axes: SoulAxes,
  archetype?: OriginArchetype,
  sealedAt = 0,
): Stamp {
  let key: keyof SoulAxes;

  if (archetype?.primaryAxis) {
    key = archetype.primaryAxis;
  } else {
    let maxDist = -1;
    key = 'caution';
    for (const k of AXIS_KEYS) {
      const dist = Math.abs(axes[k] - 0.5);
      if (dist > maxDist) {
        maxDist = dist;
        key = k;
      }
    }
  }

  return { kind: 'birth', axisKey: key, bandValue: nearestBand(axes[key]), sealedAt };
}

/**
 * Fase 4 infrastructure: when an axis moves from `oldValue` to `newValue` and
 * crosses into a new band, seals a GROWTH stamp at the band just entered.
 * Returns null if no band was crossed. Pure — does not mutate anything.
 */
export function sealIfBandCrossed(
  axisKey: keyof SoulAxes,
  oldValue: number,
  newValue: number,
  sealedAt = 0,
): Stamp | null {
  if (bandOf(newValue) === bandOf(oldValue)) return null;
  return { kind: 'growth', axisKey, bandValue: nearestBand(newValue), sealedAt };
}

/**
 * Techo suave (Fase 4 helper): dampens a proposed movement so it almost stops
 * near the extremes — "fin poco a poco". `value` and result stay in [0,1].
 */
export function softCeiling(value: number, delta: number): number {
  // Movement scales with distance to the nearer extreme; at the very edge it
  // approaches zero. Quadratic falloff keeps the mid-range nearly unaffected.
  const headroom = delta > 0 ? 1 - value : value;
  const damping = Math.pow(headroom / 0.5, 2); // 1 at center, →0 at the edges
  const next = value + delta * Math.min(1, damping);
  return next < 0 ? 0 : next > 1 ? 1 : next;
}
