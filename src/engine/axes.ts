import { SoulAxes, Stamp } from './types';
import { Seeder } from './seeder';
import { OriginArchetype } from './archetypes';

export const AXIS_KEYS: (keyof SoulAxes)[] = [
  'caution', 'passivity', 'submission', 'warmth', 'trust',
  'altruism', 'sociability', 'integrity', 'loyalty', 'optimism',
  'discipline', 'curiosity', 'confidence', 'forgiveness',
];

// Generates 14 axes in (0,1) using a bimodal-leaning distribution
// so most NPCs feel "typed" but not extreme — humans rarely sit at dead center
function generateAxisValue(seeder: Seeder): number {
  // Beta-like shape: pull toward poles without reaching them
  const raw = seeder.nextFloat(0.05, 0.95);
  // Skew toward extremes: apply gentle S-curve
  return raw < 0.5
    ? 0.5 * Math.pow(raw / 0.5, 0.7)
    : 1 - 0.5 * Math.pow((1 - raw) / 0.5, 0.7);
}

/**
 * Generates the 14 axes. When an archetype is given, its signature axes are
 * drawn from biased ranges (ejes ponderados) while the rest stay free —
 * preserving uniqueness. Without an archetype, every axis is free.
 */
export function generateAxes(seeder: Seeder, archetype?: OriginArchetype): SoulAxes {
  const axisSeed = seeder.branch('axes');
  return AXIS_KEYS.reduce((acc, key) => {
    const range = archetype?.signature[key];
    const value = range
      ? axisSeed.nextFloat(range[0], range[1])
      : generateAxisValue(axisSeed);
    acc[key] = parseFloat(value.toFixed(4));
    return acc;
  }, {} as SoulAxes);
}

// Birth stamp: the band the soul starts in for its dominant axis
const BANDS = [0.0, 0.25, 0.5, 0.75, 1.0];

function nearestBand(value: number): number {
  return BANDS.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
}

/**
 * Seals the birth stamp — the permanent "acento de origen". When the archetype
 * declares a primary axis, the stamp seals it (so stamp ↔ history always agree).
 * Otherwise (difuso origin) it falls on the most extreme axis.
 * `sealedAt` is provided by the caller; pure generation uses 0 for determinism
 * (the persistence layer assigns a real timestamp on first summon).
 */
export function generateBirthStamp(
  axes: SoulAxes,
  archetype?: OriginArchetype,
  sealedAt = 0,
): Stamp {
  let key: keyof SoulAxes;

  if (archetype?.primaryAxis) {
    key = archetype.primaryAxis;
  } else {
    // Most extreme axis = the one furthest from center (0.5)
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

  return {
    axisKey: key,
    bandValue: nearestBand(axes[key]),
    sealedAt,
  };
}

// Emergent readings — computed from axis combinations, never stored
export function readEmergentTraits(axes: SoulAxes): string[] {
  const traits: string[] = [];

  if (axes.integrity > 0.7 && axes.loyalty > 0.7 && axes.altruism > 0.6) traits.push('honor');
  if (axes.caution > 0.65 && axes.discipline > 0.65 && axes.curiosity > 0.5) traits.push('estratega');
  if (axes.warmth > 0.75 && axes.altruism > 0.65) traits.push('nobleza');
  if (axes.passivity < 0.3 && axes.confidence > 0.7) traits.push('heroísmo');
  if (axes.caution < 0.3 && axes.discipline < 0.35) traits.push('imprudencia extrema');
  if (axes.trust < 0.25 && axes.forgiveness < 0.3) traits.push('rencor');
  if (axes.submission > 0.8 && axes.confidence < 0.3) traits.push('ingenuidad');
  if (axes.optimism > 0.75 && axes.trust > 0.65 && axes.warmth > 0.6) traits.push('sabiduría benevolente');

  return traits;
}
