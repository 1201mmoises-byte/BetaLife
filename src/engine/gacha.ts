import { StarRating } from './types';
import { Seeder } from './seeder';

// --- Gacha tunables -------------------------------------------------------
// Base weights at difficulty → 0 (a "soft" world). Roughly 50/28/15/6/1%.
const BASE_WEIGHTS: Record<StarRating, number> = {
  1: 0.50,
  2: 0.28,
  3: 0.15,
  4: 0.06,
  5: 0.01,
};

// How hard difficulty crushes the high tiers. Higher = steeper collapse.
// Calibrated so that at difficulty 999, P(5★) ≈ 1e-7 (~0.00001%).
const PENALTY_STRENGTH = 3.0;

const DIFFICULTY_MIN = 1;
const DIFFICULTY_MAX = 1000;
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
 * Returns the per-tier probability distribution for a given difficulty.
 * Higher tiers decay exponentially as difficulty rises; 1★ never decays,
 * so a brutal world floods the roster with commons. Useful for inspection.
 */
export function starProbabilities(difficulty: number): Record<StarRating, number> {
  const norm = clamp01((difficulty - DIFFICULTY_MIN) / (DIFFICULTY_MAX - DIFFICULTY_MIN));

  const weights = STAR_TIERS.map((s) => {
    const tierIndex = s - 1; // 1★ = 0 penalty, 5★ = 4× penalty
    const penalty = PENALTY_STRENGTH * tierIndex * norm;
    return BASE_WEIGHTS[s] * Math.exp(-penalty);
  });

  const total = weights.reduce((a, b) => a + b, 0);
  return STAR_TIERS.reduce((acc, s, i) => {
    acc[s] = weights[i] / total;
    return acc;
  }, {} as Record<StarRating, number>);
}

/**
 * Rolls a star rating conditioned on difficulty. The harder the world,
 * the rarer high stars become (5★ approaches impossibility near 1000).
 */
export function rollStars(seeder: Seeder, difficulty: number): StarRating {
  const probs = starProbabilities(difficulty);
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
