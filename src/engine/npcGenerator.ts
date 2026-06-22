import { NPC, GenerationOptions } from './types';
import { createSeeder } from './seeder';
import { generateAxes, generateBirthStamp } from './axes';
import { generateCulture, generateName } from './nameGenerator';
import { generateHistory, generateObservation } from './historyGenerator';
import { rollDifficulty, rollStars } from './gacha';

export function generateNPC(options: GenerationOptions): NPC {
  const { seed } = options;
  const seeder = createSeeder(seed);

  // Causality: difficulty is the root property of the seed; stars are
  // conditioned on it. A brutal world rarely yields rare pulls.
  const difficulty = options.difficulty ?? rollDifficulty(seeder);
  const stars   = options.stars ?? rollStars(seeder, difficulty);
  const culture = generateCulture(seeder);
  const axes    = generateAxes(seeder);
  const name    = generateName(seeder, culture, axes);
  const birthStamp = generateBirthStamp(axes);
  const history    = generateHistory(seeder, axes, culture, stars);
  const observation = generateObservation(seeder, axes);

  return {
    id: `npc-${seed}`,
    seed,
    name,
    culture,
    stars,
    difficulty,
    axes,
    birthStamp,
    history,
    observation,
    level: 1,
    floorReached: 0,
    isAlive: true,
    createdAt: Date.now(),
  };
}

// Regenerate an NPC from seed + stored axes state (post-evolution)
export function regenerateNPC(
  seed: string,
  storedAxes: NPC['axes'],
  partial: Partial<Pick<NPC, 'level' | 'floorReached' | 'isAlive' | 'birthStamp'>>
): NPC {
  const seeder = createSeeder(seed);
  // Difficulty and stars regenerate deterministically from the seed,
  // matching the original generation order (difficulty → stars).
  const difficulty = rollDifficulty(seeder);
  const stars   = rollStars(seeder, difficulty);
  const culture = generateCulture(seeder);
  // Axes come from storage (they may have evolved), not from regeneration
  const name    = generateName(seeder, culture, storedAxes);
  const history    = generateHistory(seeder, storedAxes, culture, stars);
  const observation = generateObservation(seeder, storedAxes);

  return {
    id: `npc-${seed}`,
    seed,
    name,
    culture,
    stars,
    difficulty,
    axes: storedAxes,
    birthStamp: partial.birthStamp ?? generateBirthStamp(storedAxes),
    history,
    observation,
    level: partial.level ?? 1,
    floorReached: partial.floorReached ?? 0,
    isAlive: partial.isAlive ?? true,
    createdAt: Date.now(),
  };
}
