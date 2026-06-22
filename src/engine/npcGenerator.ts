import { NPC, GenerationOptions, StarRating } from './types';
import { createSeeder } from './seeder';
import { generateAxes, generateBirthStamp } from './axes';
import { generateCulture, generateName } from './nameGenerator';
import { generateHistory, generateObservation } from './historyGenerator';

function generateDifficulty(seeder: ReturnType<typeof createSeeder>, stars: StarRating): number {
  // Stars loosely correlate with difficulty band, but there's wide variance
  const bands: Record<StarRating, [number, number]> = {
    1: [1,   200],
    2: [50,  400],
    3: [200, 650],
    4: [450, 850],
    5: [700, 1000],
  };
  const [min, max] = bands[stars];
  return seeder.branch('difficulty').nextInt(min, max);
}

function generateStars(seeder: ReturnType<typeof createSeeder>): StarRating {
  // Gacha distribution: heavily weighted toward low stars
  const roll = seeder.branch('stars').nextFloat();
  if (roll < 0.50) return 1;
  if (roll < 0.78) return 2;
  if (roll < 0.93) return 3;
  if (roll < 0.99) return 4;
  return 5;
}

export function generateNPC(options: GenerationOptions): NPC {
  const { seed } = options;
  const seeder = createSeeder(seed);

  const stars   = options.stars      ?? generateStars(seeder);
  const culture = generateCulture(seeder);
  const axes    = generateAxes(seeder);
  const name    = generateName(seeder, culture, axes);
  const difficulty = options.difficulty ?? generateDifficulty(seeder, stars);
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
  const stars   = generateStars(createSeeder(seed));
  const culture = generateCulture(seeder);
  // Axes come from storage (they may have evolved), not from regeneration
  const name    = generateName(seeder, culture, storedAxes);
  const difficulty = generateDifficulty(seeder, stars);
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
