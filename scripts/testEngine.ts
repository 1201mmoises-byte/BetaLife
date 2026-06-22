import { generateNPC } from '../src/engine/npcGenerator';
import { readEmergentTraits } from '../src/engine/axes';
import { starProbabilities } from '../src/engine/gacha';

const SEEDS = [
  'world-alpha:1001',
  'world-alpha:1002',
  'world-alpha:1003',
  'world-alpha:1004',
  'world-alpha:1005',
];

console.log('=== BetaLife Engine — Fase 1 Validation ===\n');

const names = new Set<string>();
let allUnique = true;

for (const seed of SEEDS) {
  const npc = generateNPC({ seed });
  const traits = readEmergentTraits(npc.axes);

  if (names.has(npc.name)) {
    console.error(`COLLISION: "${npc.name}" appeared twice!`);
    allUnique = false;
  }
  names.add(npc.name);

  console.log(`--- ${npc.name} (${npc.culture}, ${npc.stars}★) ---`);
  console.log(`  Difficulty  : ${npc.difficulty} (hidden)`);
  console.log(`  Birth stamp : ${npc.birthStamp.axisKey} @ band ${npc.birthStamp.bandValue}`);
  console.log(`  Emergent    : ${traits.length ? traits.join(', ') : '(none yet)'}`);
  console.log(`  History     : ${npc.history}`);
  console.log(`  Observation : ${npc.observation}`);
  console.log(`  Axes sample : caution=${npc.axes.caution} warmth=${npc.axes.warmth} loyalty=${npc.axes.loyalty}`);
  console.log();
}

console.log(`Uniqueness check: ${allUnique ? 'PASS — all names distinct' : 'FAIL — collision detected'}`);

// Determinism check: same seed must produce identical output
const a = generateNPC({ seed: SEEDS[0] });
const b = generateNPC({ seed: SEEDS[0] });
const deterministic = JSON.stringify(a) === JSON.stringify(b);
console.log(`Determinism check: ${deterministic ? 'PASS — same seed = same NPC' : 'FAIL — output differs!'}`);

// Gacha distribution across 200 rolls (mixed difficulties from seed)
const starCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
for (let i = 0; i < 200; i++) {
  const npc = generateNPC({ seed: `distrib-test:${i}` });
  starCounts[npc.stars]++;
}
console.log('\nGacha distribution (200 rolls, organic difficulties):');
for (const [s, c] of Object.entries(starCounts)) {
  const bar = '█'.repeat(Math.round(c / 2));
  console.log(`  ${s}★: ${String(c).padStart(3)} ${bar}`);
}

// Difficulty-conditioned star probabilities — the new behavior
console.log('\nStar probability vs difficulty (theoretical):');
console.log('  diff │      1★        2★        3★        4★         5★');
console.log('  ─────┼──────────────────────────────────────────────────────');
for (const d of [1, 100, 300, 500, 700, 900, 999]) {
  const p = starProbabilities(d);
  const pct = (x: number) => (x * 100).toFixed(x < 0.0001 ? 6 : 2).padStart(10);
  console.log(`  ${String(d).padStart(4)} │${pct(p[1])}${pct(p[2])}${pct(p[3])}${pct(p[4])}${pct(p[5])}`);
}
const p999 = starProbabilities(999)[5] * 100;
console.log(`\n  → P(5★ | difficulty 999) = ${p999.toExponential(2)}%  (target ≈ 0.00001%)`);
