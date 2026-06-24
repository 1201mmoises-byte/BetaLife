import { NPC, GenerationOptions } from './types';
import { createSeeder } from './seeder';
import { generateAxes } from './axes';
import { sealBirthStamp } from './stamps';
import { generateCulture, generateName } from './nameGenerator';
import { generateHistory, generatePastLife, generateHeroLore, pastLifeLine } from './historyGenerator';
import { firstImpression } from './behavior';
import { rollDifficulty, rollStars } from './gacha';
import { pickArchetype } from './archetypes';
import { generateWorld } from './world';

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

  // El mundo del que proviene. Lo pasa el pueblo (compartido por todos sus
  // héroes); si se genera un NPC suelto, deriva su propio mundo de su semilla.
  const worldSeed = options.worldSeed ?? seed;
  const world = options.world ?? generateWorld(createSeeder(worldSeed));

  // Soul causality (master rule): historia → ejes ponderados → estampa.
  const archetype  = pickArchetype(seeder);
  const axes       = generateAxes(seeder, archetype);
  const birthStamp = sealBirthStamp(axes, archetype);
  const pastLife   = generatePastLife(seeder, archetype.id);
  const lore       = generateHeroLore(seeder, world, stars, pastLife);
  const history    = `${generateHistory(seeder, archetype, stars)} ${pastLifeLine(pastLife)}`;
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
    worldSeed,
    axes,
    stamps: [birthStamp],
    history,
    observation,
    pastLife,
    lore,
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
  partial: Partial<Pick<NPC, 'level' | 'floorReached' | 'isAlive' | 'stamps' | 'rosterFloorAtSummon' | 'difficulty' | 'worldSeed'>>
): NPC {
  const seeder = createSeeder(seed);
  const rosterFloorAtSummon = partial.rosterFloorAtSummon ?? 0;
  // Difficulty is a TOWN property: read the value persisted at summon time so the
  // star roll reproduces exactly. Fall back to a per-seed roll only if it was
  // never persisted (legacy saves). `rollDifficulty` uses an isolated branch, so
  // whether or not it runs it never perturbs the culture/archetype/axes rolls.
  const difficulty = partial.difficulty ?? rollDifficulty(seeder);
  const stars   = rollStars(seeder, difficulty, rosterFloorAtSummon);
  const culture = generateCulture(seeder);
  const archetype = pickArchetype(seeder);
  // El mundo se reproduce desde la semilla persistida (= town.seed). Rama aislada,
  // no perturba las tiradas anteriores. Memorias/sueños salen del mismo mundo.
  const worldSeed = partial.worldSeed ?? seed;
  const world = generateWorld(createSeeder(worldSeed));
  const pastLife = generatePastLife(seeder, archetype.id);
  const lore     = generateHeroLore(seeder, world, stars, pastLife);
  // Axes come from storage (they may have evolved), not from regeneration
  const history    = `${generateHistory(seeder, archetype, stars)} ${pastLifeLine(pastLife)}`;
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
    worldSeed,
    axes: storedAxes,
    // Stored stamps accumulate over a life; default to just the birth stamp.
    stamps: partial.stamps ?? [sealBirthStamp(storedAxes, archetype)],
    history,
    observation,
    pastLife,
    lore,
    level: partial.level ?? 1,
    floorReached: partial.floorReached ?? 0,
    isAlive: partial.isAlive ?? true,
    createdAt: 0,
  };
}
