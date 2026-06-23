import { generateNPC } from '../src/engine/npcGenerator';
import { readEmergentTraits } from '../src/engine/axes';
import { readBehavior } from '../src/engine/behavior';
import { createSeeder } from '../src/engine/seeder';
import { starProbabilities } from '../src/engine/gacha';
import { ARCHETYPES } from '../src/engine/archetypes';
import { sealIfBandCrossed, bandOf, softCeiling } from '../src/engine/stamps';
import { rollConversation, conversationAffinity, CONVERSATION_COOLDOWN } from '../src/engine/conversations';

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
  console.log(`  Birth stamp : ${npc.stamps[0].axisKey} @ band ${npc.stamps[0].bandValue}`);
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
    if (npc.stamps[0].axisKey === arch.primaryAxis) stampCoherent++;
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

// Difficulty-conditioned star probabilities at floor 0 (fresh world)
console.log('\nStar probability vs difficulty (floor 0):');
console.log('  diff │      1★        2★        3★        4★         5★');
console.log('  ─────┼──────────────────────────────────────────────────────');
for (const d of [1, 100, 300, 500, 700, 900, 999]) {
  const p = starProbabilities(d);
  const pct = (x: number) => (x * 100).toFixed(x < 0.0001 ? 6 : 2).padStart(10);
  console.log(`  ${String(d).padStart(4)} │${pct(p[1])}${pct(p[2])}${pct(p[3])}${pct(p[4])}${pct(p[5])}`);
}

// Floor bonus: P(5★) across difficulty × roster floor
console.log('\nP(5★) vs difficulty × roster floor (meta-progresión):');
const floors = [0, 30, 60, 90, 100, 150];
console.log('  diff │' + floors.map((f) => `piso ${f}`.padStart(11)).join(''));
console.log('  ─────┼' + '─'.repeat(11 * floors.length));
for (const d of [1, 300, 500, 1000]) {
  const cells = floors.map((f) => {
    const v = starProbabilities(d, f)[5] * 100;
    return (v < 0.0001 ? v.toExponential(1) : v.toFixed(2) + '%').padStart(11);
  });
  console.log(`  ${String(d).padStart(4)} │${cells.join('')}`);
}

// Anchor verification
const a1 = starProbabilities(1, 90)[5] * 100;
const a2 = starProbabilities(1000, 100)[5] * 100;
const a3 = starProbabilities(999, 0)[5] * 100;
const pct2 = (x: number) => x.toFixed(2);
console.log('\nAnchor checks:');
console.log(`  dif 1   / piso 90  → ${pct2(a1)}% 5★  ${a1 >= 24 && a1 <= 26 ? 'PASS' : 'FAIL'} (objetivo 25%)`);
console.log(`  dif 1000/ piso 100 → ${pct2(a2)}% 5★  ${a2 >= 0.9 && a2 <= 1.1 ? 'PASS' : 'FAIL'} (objetivo 1%)`);
console.log(`  dif 999 / piso 0   → ${a3.toExponential(2)}% 5★  ${a3 < 0.0001 ? 'PASS' : 'FAIL'} (objetivo ≈0.00001%)`);

// Determinism with rosterFloor: same seed + same floor = same NPC
const d1 = generateNPC({ seed: 'floor-det', rosterFloor: 50 });
const d2 = generateNPC({ seed: 'floor-det', rosterFloor: 50 });
console.log(`  determinismo con rosterFloor: ${JSON.stringify(d1) === JSON.stringify(d2) ? 'PASS' : 'FAIL'}`);

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

// --- Fase 3a: sistema de estampas -----------------------------------------
console.log('=== Fase 3a — Estampas (nacimiento + cruce de banda) ===\n');
{
  const npc = generateNPC({ seed: SEEDS[0] });
  console.log(`${npc.name}: estampas al nacer = ${npc.stamps.length}`);
  console.log(`  [0] ${npc.stamps[0].kind}: ${npc.stamps[0].axisKey} @ banda ${npc.stamps[0].bandValue}`);

  // Simular un movimiento que cruza una banda (la Fase 4 hará el movimiento real)
  const axis = npc.stamps[0].axisKey;
  const before = npc.axes[axis];
  const after = 0.80; // valor hipotético tras experiencia
  const sealed = sealIfBandCrossed(axis, before, after);
  console.log(`  movimiento ${axis}: ${before} (banda ${bandOf(before)}) → ${after} (banda ${bandOf(after)})`);
  console.log(`  → ${sealed ? `sella estampa growth @ banda ${sealed.bandValue}` : 'sin cruce, no sella'}`);

  // Techo suave: el mismo delta rinde menos cerca de los extremos
  const dMid = softCeiling(0.50, 0.10) - 0.50;
  const dEdge = softCeiling(0.92, 0.10) - 0.92;
  console.log(`  techo suave: +0.10 en centro=${dMid.toFixed(3)}, cerca del extremo=${dEdge.toFixed(3)} (casi se detiene)`);
}

// --- Fase 3b: conversaciones de fondo --------------------------------------
console.log('\n=== Fase 3b — Conversaciones de fondo (efectos onda) ===\n');
{
  // Pareja sociable+curiosa vs pareja reservada; misma proximidad alta
  const social = [generateNPC({ seed: 'conv:social-a' }), generateNPC({ seed: 'conv:social-b' })];
  const distant = [generateNPC({ seed: 'conv:quiet-a' }), generateNPC({ seed: 'conv:quiet-b' })];
  // Forzar perfiles para la demo (la generación real ya los varía)
  social[0].axes.sociability = 0.9; social[0].axes.curiosity = 0.8;
  social[1].axes.sociability = 0.85; social[1].axes.curiosity = 0.75;
  distant[0].axes.sociability = 0.15; distant[0].axes.curiosity = 0.2;
  distant[1].axes.sociability = 0.2; distant[1].axes.curiosity = 0.15;

  console.log(`Afinidad sociable = ${conversationAffinity(social[0], social[1]).toFixed(3)}`);
  console.log(`Afinidad reservada = ${conversationAffinity(distant[0], distant[1]).toFixed(3)}`);

  const TICKS = 500;
  function simulate(pair: ReturnType<typeof generateNPC>[], label: string) {
    const world = createSeeder('conv-world');
    let cooldown = 0;
    let ripples = 0;
    let firstRipple = '';
    for (let t = 0; t < TICKS; t++) {
      cooldown = Math.max(0, cooldown - 1);
      const r = rollConversation(world.branch(`tick:${t}`), pair[0], pair[1], {
        proximity: 0.9,
        cooldownRemaining: cooldown,
      });
      if (r) {
        ripples++;
        cooldown = CONVERSATION_COOLDOWN;
        if (!firstRipple) firstRipple = r.observable;
      }
    }
    console.log(`  ${label}: ${ripples} ondas en ${TICKS} ticks` + (firstRipple ? `\n      ej: "${firstRipple}"` : ''));
  }
  simulate(social, 'pareja sociable ');
  simulate(distant, 'pareja reservada');
  console.log(`  (rareza + cooldown: casi nunca, y nunca se ve el texto)`);
}
