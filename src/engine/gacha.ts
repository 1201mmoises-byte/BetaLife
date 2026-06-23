import { StarRating } from './types';
import { Seeder } from './seeder';

// --- Gacha tunables -------------------------------------------------------
// Base weights at difficulty 1 (the easiest world, where penalty = 0, so
// these ARE the visible probabilities). Anchored by design:
//   5★ = 1%  (ceiling — extremely rare even at the easiest difficulty)
//   3★ = 10% (the "normal rare")
// 1★/2★/4★ fill the rest with a clean monotonic descent.
const BASE_WEIGHTS: Record<StarRating, number> = {
  1: 0.60,
  2: 0.25,
  3: 0.10,
  4: 0.04,
  5: 0.01,
};

// How hard difficulty crushes the high tiers. Higher = steeper collapse.
// Calibrated so that at difficulty 999 / floor 0, P(5★) ≈ 1e-7 (~0.00001%).
const PENALTY_STRENGTH = 3.0;

const DIFFICULTY_MIN = 1;
const DIFFICULTY_MAX = 1000;

// --- Floor bonus (meta-progresión global del roster) ----------------------
// Cada 10 pisos completados RESTA penalidad (y puede empujar el 5★ por encima
// de la base, hasta un techo). El bono se acumula con el piso más profundo que
// el roster ha alcanzado, y mejora TODAS las futuras invocaciones.
//
// Las dos anclas de diseño implican ritmos distintos de bono por paso, así que
// el bono por paso ESCALA con la dificultad (cada piso vale más en mundos
// brutales — el crisol recompensa escalar). Esto honra ambas anclas:
//   · dif 1,    piso 90  → 25% 5★ (techo)
//   · dif 1000, piso 100 → 1%  5★ (la base, por fin recuperada)
const M_CAP = 1.25;                  // exponente que da ~25% 5★ — techo absoluto
const FLOORS_PER_STEP = 10;          // cada 10 pisos = un paso de bono
const FLOORS_TO_CAP_EASY = 90;       // mundo fácil llega al techo a los 90 pisos
const FLOORS_TO_CANCEL_MAX = 100;    // mundo máximo cancela su penalidad a los 100

// Bono por paso en los extremos de dificultad (lerp entre ambos por difficultyNorm)
const PER_STEP_EASY = M_CAP / (FLOORS_TO_CAP_EASY / FLOORS_PER_STEP);          // ≈ 0.1389
const PER_STEP_HARD = PENALTY_STRENGTH / (FLOORS_TO_CANCEL_MAX / FLOORS_PER_STEP); // = 0.30
// --------------------------------------------------------------------------

const STAR_TIERS: StarRating[] = [1, 2, 3, 4, 5];

/**
 * Difficulty is the root property of a seed/world (1-1000, hidden from player).
 * Rolled independently — each world has its own inherent crucible.
 */
export function rollDifficulty(seeder: Seeder): number {
  return seeder.branch('difficulty').nextInt(DIFFICULTY_MIN, DIFFICULTY_MAX);
}

/**
 * Net per-tier exponent `m`: floorBonus − difficultyPenalty, clamped to M_CAP.
 *   m < 0 → high tiers suppressed (hard world, few floors climbed)
 *   m = 0 → base distribution (60/25/10/4/1)
 *   m > 0 → high tiers boosted above base, up to the 25% 5★ ceiling
 * At floor 0 this reduces to the original difficulty-only model.
 */
function computeExponent(difficulty: number, rosterFloor: number): number {
  const norm = clamp01((difficulty - DIFFICULTY_MIN) / (DIFFICULTY_MAX - DIFFICULTY_MIN));
  const difficultyPenalty = PENALTY_STRENGTH * norm;

  const perStep = PER_STEP_EASY + (PER_STEP_HARD - PER_STEP_EASY) * norm;
  const steps = Math.floor(Math.max(0, rosterFloor) / FLOORS_PER_STEP);
  const floorBonus = perStep * steps;

  return Math.min(M_CAP, floorBonus - difficultyPenalty);
}

/**
 * Per-tier probability distribution for a given difficulty and global roster
 * progress. Higher tiers decay with difficulty and recover (then exceed base,
 * capped at 25% 5★) as the roster climbs. `rosterFloor` defaults to 0.
 */
export function starProbabilities(
  difficulty: number,
  rosterFloor = 0,
): Record<StarRating, number> {
  const m = computeExponent(difficulty, rosterFloor);

  const weights = STAR_TIERS.map((s) => BASE_WEIGHTS[s] * Math.exp(m * (s - 1)));

  const total = weights.reduce((a, b) => a + b, 0);
  return STAR_TIERS.reduce((acc, s, i) => {
    acc[s] = weights[i] / total;
    return acc;
  }, {} as Record<StarRating, number>);
}

/**
 * Rolls a star rating conditioned on difficulty and global roster progress.
 * `rosterFloor` is the deepest floor any character has completed at summon time.
 */
export function rollStars(seeder: Seeder, difficulty: number, rosterFloor = 0): StarRating {
  const probs = starProbabilities(difficulty, rosterFloor);
  const roll = seeder.branch('stars').nextFloat();

  let cumulative = 0;
  for (const s of STAR_TIERS) {
    cumulative += probs[s];
    if (roll < cumulative) return s;
  }
  return 1; // floating-point safety net
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
