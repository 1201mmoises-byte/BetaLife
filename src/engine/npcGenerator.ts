import { NPC, GenerationOptions } from './types';
import { createSeeder } from './seeder';
import { generateAxes, generateBirthStamp } from './axes';
import { generateCulture, generateName } from './nameGenerator';
import { generateHistory } from './historyGenerator';
import { firstImpression } from './behavior';
import { rollDifficulty, rollStars } from './gacha';
import { pickArchetype } from './archetypes';

export function generateNPC(options: GenerationOptions): NPC {
  const { seed } = options;
  const seeder = createSeeder(seed);

  // Causality: difficulty is the root property of the seed; stars are
  // conditioned on it AND on global roster progress (floor bonus). A brutal
  // world rarely yields rare pulls — but a roster that has climbed earns better.
  const rosterFloor = options.rosterFloor ?? 0;
  const difficulty = options.difficulty ?? rollDifficulty(seeder);
  const stars   = options.stars ?? rollStars(seeder, difficulty, rosterFloor);
  const culture = generateCulture(seeder);

  // Soul causality (master rule): historia → ejes ponderados → estampa.
  const archetype  = pickArchetype(seeder);
  const axes       = generateAxes(seeder, archetype);
  const birthStamp = generateBirthStamp(axes, archetype);
  const history    = generateHistory(seeder, archetype, stars);
  const observation = firstImpression(seeder, axes);
  const name       = generateName(seeder, culture, axes);

  return {
    id: `npc-${seed}`,
    seed,
    name,
    culture,
    originArchetypeId: archetype.id,
    stars,
    difficulty,
    rosterFloorAtSummon: rosterFloor,
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

// Regenerate an NPC from seed + stored state (post-evolution).
// `rosterFloorAtSummon` must be the value persisted at the original summon, so
// the star roll (which depends on it) reproduces exactly.
export function regenerateNPC(
  seed: string,
  storedAxes: NPC['axes'],
  partial: Partial<Pick<NPC, 'level' | 'floorReached' | 'isAlive' | 'birthStamp' | 'rosterFloorAtSummon'>>
): NPC {
  const seeder = createSeeder(seed);
  const rosterFloorAtSummon = partial.rosterFloorAtSummon ?? 0;
  // Regenerate deterministically from the seed, matching generation order:
  // difficulty → stars → culture → archetype.
  const difficulty = rollDifficulty(seeder);
  const stars   = rollStars(seeder, difficulty, rosterFloorAtSummon);
  const culture = generateCulture(seeder);
  const archetype = pickArchetype(seeder);
  // Axes come from storage (they may have evolved), not from regeneration
  const history    = generateHistory(seeder, archetype, stars);
  const observation = firstImpression(seeder, storedAxes);
  const name    = generateName(seeder, culture, storedAxes);

  return {
    id: `npc-${seed}`,
    seed,
    name,
    culture,
    originArchetypeId: archetype.id,
    stars,
    difficulty,
    rosterFloorAtSummon,
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
