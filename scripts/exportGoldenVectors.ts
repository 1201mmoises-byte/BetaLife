// One-off tool: dumps deterministic engine output for fixed seeds, as JSON,
// to serve as cross-language golden vectors for the Godot/GDScript port.
// Run with: npx ts-node --project tsconfig.json scripts/exportGoldenVectors.ts > out.json

import { createSeeder } from '../src/engine/seeder';
import { generateAxes, readEmergentTraits } from '../src/engine/axes';
import { ARCHETYPES, pickArchetype } from '../src/engine/archetypes';
import {
  bandOf, nearestBand, sealBirthStamp, sealIfBandCrossed, softCeiling,
} from '../src/engine/stamps';
import { generateCulture, generateName, nameNamespaceSize } from '../src/engine/nameGenerator';

const SEEDS = [
  'world-alpha:1001',
  'world-alpha:1002',
  'world-alpha:1003',
  'golden-seed-A',
  'golden-seed-B',
  '', // edge case: empty string seed
];

const CULTURES = ['hispano', 'nordico', 'celta', 'eslavo', 'greco', 'africano', 'asiatico'] as const;

const output: any = {};

// 1. Raw seeder draws: proves mulberry32 + hashString are bit-identical.
output.seederDraws = {};
for (const seed of SEEDS) {
  const s = createSeeder(seed);
  const draws: number[] = [];
  for (let i = 0; i < 10; i++) draws.push(s.next());
  const b = s.branch('axes');
  const branchDraws: number[] = [];
  for (let i = 0; i < 5; i++) branchDraws.push(b.next());
  output.seederDraws[seed] = { draws, branchDraws };
}

// 2. nextFloat / nextInt / nextChoice spot checks.
output.seederHelpers = {};
for (const seed of SEEDS) {
  const s = createSeeder(seed);
  output.seederHelpers[seed] = {
    nextFloatRange: s.nextFloat(10, 20),
    nextInt: s.nextInt(0, 99),
    nextChoice: s.nextChoice(['a', 'b', 'c', 'd', 'e']),
  };
}

// 3. Axes generation: without an archetype, and with each archetype.
output.axes = {};
for (const seed of SEEDS) {
  const noArch = generateAxes(createSeeder(seed));
  const perArchetype: Record<string, any> = {};
  for (const arch of ARCHETYPES) {
    perArchetype[arch.id] = generateAxes(createSeeder(seed), arch);
  }
  output.axes[seed] = { noArchetype: noArch, perArchetype, emergentTraits: readEmergentTraits(noArch) };
}

// 4. Archetype picks.
output.archetypePicks = {};
for (const seed of SEEDS) {
  output.archetypePicks[seed] = pickArchetype(createSeeder(seed)).id;
}

// 5. Stamp helpers.
output.stamps = {
  bandOfSamples: [0, 0.1, 0.124, 0.125, 0.2, 0.4, 0.6, 0.8, 0.9, 1.0]
    .map((v) => ({ value: v, band: bandOf(v) })),
  nearestBandSamples: [0.0, 0.05, 0.12, 0.13, 0.37, 0.5, 0.63, 0.88, 0.95, 1.0]
    .map((v) => ({ value: v, nearest: nearestBand(v) })),
  softCeilingSamples: [
    { value: 0.5, delta: 0.1 }, { value: 0.9, delta: 0.2 }, { value: 0.1, delta: -0.2 },
    { value: 0.99, delta: 0.5 }, { value: 0.01, delta: -0.5 },
  ].map((c) => ({ ...c, result: softCeiling(c.value, c.delta) })),
  growthStamp: sealIfBandCrossed('caution', 0.2, 0.4, 123),
  growthStampNone: sealIfBandCrossed('caution', 0.2, 0.24, 123),
};
output.birthStamps = {};
for (const seed of SEEDS) {
  const axes = generateAxes(createSeeder(seed));
  const arch = pickArchetype(createSeeder(seed));
  output.birthStamps[seed] = {
    withArchetype: sealBirthStamp(axes, arch, 0),
    withoutArchetype: sealBirthStamp(axes, undefined, 0),
  };
}

// 6. Names.
output.names = {};
for (const seed of SEEDS) {
  const culture = generateCulture(createSeeder(seed));
  const axes = generateAxes(createSeeder(seed));
  const perCulture: Record<string, string> = {};
  for (const c of CULTURES) {
    perCulture[c] = generateName(createSeeder(seed), c, axes);
  }
  output.names[seed] = { culture, perCulture };
}
output.nameNamespaceSize = nameNamespaceSize();

console.log(JSON.stringify(output, null, 2));
