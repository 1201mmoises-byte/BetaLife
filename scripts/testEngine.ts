import { generateNPC } from '../src/engine/npcGenerator';
import { readEmergentTraits } from '../src/engine/axes';
import { readBehavior } from '../src/engine/behavior';
import { createSeeder } from '../src/engine/seeder';
import { starProbabilities } from '../src/engine/gacha';
import { ARCHETYPES } from '../src/engine/archetypes';

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
  console.log(`  Origin      : ${npc.originArchetypeId}`);
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

// Coherence: birth stamp must seal the archetype's primary axis (when defined),
// and the matching emergent trait should fire for the large majority.
const SAMPLE = 2000;
const archMap = new Map(ARCHETYPES.map((arch) => [arch.id, arch]));
// Born-emergent readings per archetype. 'erudito' is intentionally absent:
// per the master, 'estratega' emerges from diverse EXPERIENCE (Fase 4+),
// not from birth — a scholar is born curious, not yet a strategist.
const emergentForArchetype: Record<string, string> = {
  honor: 'honor',
  imprudente: 'imprudencia extrema',
  calido: 'nobleza',
  rencoroso: 'rencor',
};
let stampCoherent = 0;
let stampTotalWithPrimary = 0;
const emergentHits: Record<string, { hit: number; total: number }> = {};

for (let i = 0; i < SAMPLE; i++) {
  const npc = generateNPC({ seed: `coherence:${i}` });
  const arch = archMap.get(npc.originArchetypeId)!;
  if (arch.primaryAxis) {
    stampTotalWithPrimary++;
    if (npc.birthStamp.axisKey === arch.primaryAxis) stampCoherent++;
  }
  const expected = emergentForArchetype[npc.originArchetypeId];
  if (expected) {
    emergentHits[npc.originArchetypeId] ??= { hit: 0, total: 0 };
    emergentHits[npc.originArchetypeId].total++;
    if (readEmergentTraits(npc.axes).includes(expected)) {
      emergentHits[npc.originArchetypeId].hit++;
    }
  }
}

const stampPass = stampCoherent === stampTotalWithPrimary;
console.log(
  `Stamp↔origin coherence: ${stampPass ? 'PASS' : 'FAIL'} — ` +
  `${stampCoherent}/${stampTotalWithPrimary} stamps seal the archetype's primary axis`,
);
console.log('Emergent↔origin coherence (expected trait fires):');
for (const [id, { hit, total }] of Object.entries(emergentHits)) {
  const rate = ((hit / total) * 100).toFixed(0);
  console.log(`  ${id.padEnd(11)} → ${expectedTrait(id)}: ${rate}% (${hit}/${total})`);
}
function expectedTrait(id: string): string {
  return emergentForArchetype[id] ?? '(none)';
}

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

// --- Fase 2 demo: ejes leídos como comportamiento -------------------------
console.log('\n=== Fase 2 — Ejes leídos como comportamiento ===\n');
for (const seed of SEEDS) {
  const npc = generateNPC({ seed });
  const behavior = readBehavior(createSeeder(seed), npc.axes, 4);
  console.log(`--- ${npc.name} (origen: ${npc.originArchetypeId}) ---`);
  for (const line of behavior) console.log(`  • ${line}`);
  console.log(`  (sin etiquetas, sin números — el jugador infiere)`);
  console.log();
}
