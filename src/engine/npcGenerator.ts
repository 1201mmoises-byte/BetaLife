import { NPC, GenerationOptions } from './types';
import { createSeeder } from './seeder';
import { generateAxes, generateBirthStamp } from './axes';
import { generateCulture, generateName } from './nameGenerator';
import { generateHistory, generateObservation } from './historyGenerator';
import { rollDifficulty, rollStars } from './gacha';
import { pickArchetype } from './archetypes';

export function generateNPC(options: GenerationOptions): NPC {
  const { seed } = options;
  const seeder = createSeeder(seed);

  // Causality: difficulty is the root property of the seed; stars are
  // conditioned on it. A brutal world rarely yields rare pulls.
  const difficulty = options.difficulty ?? rollDifficulty(seeder);
  const stars   = options.stars ?? rollStars(seeder, difficulty);
  const culture = generateCulture(seeder);

  // Soul causality (master rule): historia → ejes ponderados → estampa.
  const archetype  = pickArchetype(seeder);
  const axes       = generateAxes(seeder, archetype);
  const birthStamp = generateBirthStamp(axes, archetype);
  const history    = generateHistory(seeder, archetype, stars);
  const observation = generateObservation(seeder, axes);
  const name       = generateName(seeder, culture, axes);

  return {
    id: `npc-${seed}`,
    seed,
    name,
    culture,
    originArchetypeId: archetype.id,
    stars,
    difficulty,
    axes,
    birthStamp,
    history,
    observation,
    level: 1,
    floorReached: 0,
    isAlive: true,
    createdAt: 0, // assigned by the persistence layer on first summon
  };
}

// Regenerate an NPC from seed + stored axes state (post-evolution)
export function regenerateNPC(
  seed: string,
  storedAxes: NPC['axes'],
  partial: Partial<Pick<NPC, 'level' | 'floorReached' | 'isAlive' | 'birthStamp'>>
): NPC {
  const seeder = createSeeder(seed);
  // Regenerate deterministically from the seed, matching generation order:
  // difficulty → stars → culture → archetype.
  const difficulty = rollDifficulty(seeder);
  const stars   = rollStars(seeder, difficulty);
  const culture = generateCulture(seeder);
  const archetype = pickArchetype(seeder);
  // Axes come from storage (they may have evolved), not from regeneration
  const history    = generateHistory(seeder, archetype, stars);
  const observation = generateObservation(seeder, storedAxes);
  const name    = generateName(seeder, culture, storedAxes);

  return {
    id: `npc-${seed}`,
    seed,
    name,
    culture,
    originArchetypeId: archetype.id,
    stars,
    difficulty,
    axes: storedAxes,
    birthStamp: partial.birthStamp ?? generateBirthStamp(storedAxes, archetype),
    history,
    observation,
    level: partial.level ?? 1,
    floorReached: partial.floorReached ?? 0,
    isAlive: partial.isAlive ?? true,
    createdAt: 0,
  };
}
