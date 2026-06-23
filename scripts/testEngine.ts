import { generateNPC } from '../src/engine/npcGenerator';
import { readEmergentTraits } from '../src/engine/axes';
import { readBehavior } from '../src/engine/behavior';
import { createSeeder } from '../src/engine/seeder';
import { starProbabilities } from '../src/engine/gacha';
import { ARCHETYPES } from '../src/engine/archetypes';
import { sealIfBandCrossed, bandOf, softCeiling } from '../src/engine/stamps';
import { rollConversation, conversationAffinity, CONVERSATION_COOLDOWN } from '../src/engine/conversations';
import { inspectNPC, revealExchange, setDevMode } from '../src/engine/debug';
import { applyExperience, applyConversationNudges } from '../src/engine/experience';
import { briefRoster, describeNPC, reportActivity, explainRule, relay, rareWhisper } from '../src/engine/mediator';

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

// --- Conversaciones de fondo SILENCIOSAS ------------------------------------
console.log('\n=== Conversaciones de fondo (silenciosas — sin ripples) ===\n');
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
    let count = 0;
    const topicTally: Record<string, number> = {};
    for (let t = 0; t < TICKS; t++) {
      cooldown = Math.max(0, cooldown - 1);
      const ex = rollConversation(world.branch(`tick:${t}`), pair[0], pair[1], {
        proximity: 0.9,
        cooldownRemaining: cooldown,
      });
      if (ex) {
        count++;
        cooldown = CONVERSATION_COOLDOWN;
        topicTally[ex.topic] = (topicTally[ex.topic] ?? 0) + 1;
      }
    }
    const topics = Object.entries(topicTally).map(([k, v]) => `${k}:${v}`).join(' ') || '—';
    console.log(`  ${label}: ${count} charlas en ${TICKS} ticks   temas → ${topics}`);
  }
  simulate(social, 'pareja sociable ');
  simulate(distant, 'pareja reservada');
  console.log(`  (rareza + cooldown: casi nunca; el jugador no ve NADA de esto)`);
}

// --- Modo desarrollo: ver lo que el juego oculta ---------------------------
// Solo durante el desarrollo. Se auto-apaga en producción (NODE_ENV) y se
// retira borrando src/engine/debug.ts + su export en index.ts.
console.log('\n=== Modo desarrollo — internos ocultos (se quitan antes del lanzamiento) ===\n');
{
  // Dump completo de un NPC: dificultad, ejes crudos, estampas, emergentes.
  console.log(inspectNPC(generateNPC({ seed: SEEDS[0] })));

  // Inspeccionar charlas silenciosas (tema + nudges). El jugador no ve nada;
  // el dev sí, para afinar el balance de la influencia mutua.
  console.log('\n  Charlas silenciosas inspeccionadas (solo dev):');
  const a = generateNPC({ seed: 'conv:social-a' });
  const b = generateNPC({ seed: 'conv:social-b' });
  a.axes.sociability = 0.9; a.axes.curiosity = 0.85; a.axes.trust = 0.15; a.axes.optimism = 0.2;
  b.axes.sociability = 0.85; b.axes.curiosity = 0.8; b.axes.trust = 0.18; b.axes.optimism = 0.25;
  const nameOf = (id: string) => (id === a.id ? a.name : id === b.id ? b.name : id);
  const world = createSeeder('conv-world');
  let cooldown = 0;
  let shown = 0;
  for (let t = 0; t < 500 && shown < 3; t++) {
    cooldown = Math.max(0, cooldown - 1);
    const ex = rollConversation(world.branch(`tick:${t}`), a, b, { proximity: 0.9, cooldownRemaining: cooldown });
    if (ex) {
      cooldown = CONVERSATION_COOLDOWN;
      console.log(`    jugador ve : (nada)`);
      console.log(`    dev ve     : ${revealExchange(ex, nameOf)}`);
      shown++;
    }
  }

  // Con el modo apagado (juego lanzado), inspectNPC calla y revelar = onda vaga.
  setDevMode(false);
  const silent = inspectNPC(generateNPC({ seed: SEEDS[0] }));
  console.log(`\n  Con DEV_MODE=false (juego lanzado): inspectNPC => ${silent === '' ? '"" (oculto)' : '¡FUGA!'}`);
  setDevMode(true);
}

// --- Fase 4: Ejes en movimiento (desarrollo por exposición) -----------------
console.log('\n=== Fase 4 — Ejes en movimiento (desarrollo por exposición) ===\n');
{
  const npc = generateNPC({ seed: SEEDS[0] });
  const birthAxis = npc.stamps[0].axisKey;

  console.log(`NPC: ${npc.name} (origen: ${npc.originArchetypeId}, acento: ${birthAxis})`);
  console.log(`Conducta inicial:`);
  const behaviorSeed = createSeeder(SEEDS[0]);
  for (const line of readBehavior(behaviorSeed, npc.axes, 3)) console.log(`  • ${line}`);

  // Simular 10 combates exitosos consecutivos
  let axes = { ...npc.axes };
  let stamps = [...npc.stamps];
  const growthStamps: typeof npc.stamps = [];
  const trackedAxes: (keyof typeof axes)[] = ['confidence', 'passivity', 'caution'];

  console.log(`\nAntes de combates: ${trackedAxes.map((k) => `${k}=${axes[k]}`).join('  ')}`);

  for (let i = 0; i < 10; i++) {
    const es = createSeeder(`combat-sim:${i}`);
    const result = applyExperience(es, axes, stamps, { kind: 'combat', intensity: 0.8, outcome: 'success' });
    axes = result.axes;
    if (result.newStamps.length) {
      stamps = [...stamps, ...result.newStamps];
      growthStamps.push(...result.newStamps);
    }
  }

  console.log(`Tras 10 combates exitosos: ${trackedAxes.map((k) => `${k}=${axes[k]}`).join('  ')}`);
  if (growthStamps.length) {
    console.log(`  → Growth stamps sellados: ${growthStamps.map((s) => `${s.axisKey}@${s.bandValue}`).join(', ')}`);
  } else {
    console.log(`  → Sin cruces de banda (movimiento gradual, como se espera)`);
  }

  console.log(`\nConducta tras 10 combates exitosos:`);
  const behaviorSeed2 = createSeeder(SEEDS[0] + '-post');
  for (const line of readBehavior(behaviorSeed2, axes, 3)) console.log(`  • ${line}`);

  // El eje firma (birthStamp) debe moverse menos que los demás — verificar
  const birthDelta = Math.abs(axes[birthAxis] - npc.axes[birthAxis]);
  const freeDelta = trackedAxes
    .filter((k) => k !== birthAxis)
    .map((k) => Math.abs(axes[k] - npc.axes[k]));
  const avgFreeDelta = freeDelta.length ? freeDelta.reduce((a, b) => a + b, 0) / freeDelta.length : 0;
  const accentResists = birthDelta <= avgFreeDelta + 0.001;
  console.log(`\nResistencia del acento de origen (${birthAxis}):`);
  console.log(`  delta acento  = ${birthDelta.toFixed(4)}`);
  console.log(`  delta libre Ø = ${avgFreeDelta.toFixed(4)}`);
  console.log(`  acento resiste más: ${accentResists ? 'PASS' : 'FAIL — el acento debería moverse menos'}`);

  // Verificar que softCeiling funciona: 100 combates no llevan ningún eje al extremo
  let axesStress = { ...npc.axes };
  const stampsStress = [...npc.stamps];
  for (let i = 0; i < 100; i++) {
    const es = createSeeder(`stress:${i}`);
    axesStress = applyExperience(es, axesStress, stampsStress, { kind: 'combat', intensity: 1.0, outcome: 'success' }).axes;
  }
  const noExtreme = Object.values(axesStress).every((v) => v > 0.01 && v < 0.99);
  console.log(`\nTecho suave (100 combates max intensity): ${noExtreme ? 'PASS — ningún eje llegó al extremo absoluto' : 'FAIL'}`);

  // Verificar determinismo: mismo seed + mismo evento = mismo resultado
  const r1 = applyExperience(createSeeder('det-test'), npc.axes, npc.stamps, { kind: 'scout', intensity: 0.7, outcome: 'success' });
  const r2 = applyExperience(createSeeder('det-test'), npc.axes, npc.stamps, { kind: 'scout', intensity: 0.7, outcome: 'success' });
  const detPass = JSON.stringify(r1) === JSON.stringify(r2);
  console.log(`Determinismo de experiencia: ${detPass ? 'PASS' : 'FAIL'}`);
}

// --- Sabiduría mutua: NPCs influyéndose en silencio -------------------------
console.log('\n=== Sabiduría mutua — los NPC se mejoran entre ellos (en silencio) ===\n');
{
  // Erudito (muy curioso) entrena con un imprudente (nada curioso). Hablan de
  // training repetidamente; la curiosidad debería converger con el tiempo.
  const erudito = generateNPC({ seed: 'wisdom:scholar' });
  const novato = generateNPC({ seed: 'wisdom:reckless' });
  erudito.axes.curiosity = 0.90; erudito.axes.discipline = 0.85; erudito.axes.sociability = 0.7;
  novato.axes.curiosity = 0.12; novato.axes.discipline = 0.20; novato.axes.sociability = 0.7;

  let axesA = { ...erudito.axes };
  let axesB = { ...novato.axes };
  const stampsA = [...erudito.stamps];
  const stampsB = [...novato.stamps];
  let crossings = 0;

  console.log(`Inicio:  erudito.curiosity=${axesA.curiosity.toFixed(3)}  novato.curiosity=${axesB.curiosity.toFixed(3)}`);

  const world = createSeeder('wisdom-world');
  let cooldown = 0;
  let charlas = 0;
  for (let t = 0; t < 4000 && charlas < 30; t++) {
    cooldown = Math.max(0, cooldown - 1);
    // Participantes con los ejes ACTUALES (van cambiando)
    const pa = { id: erudito.id, axes: axesA };
    const pb = { id: novato.id, axes: axesB };
    const ex = rollConversation(world.branch(`tick:${t}`), pa, pb, { proximity: 1.0, cooldownRemaining: cooldown });
    if (!ex || ex.topic !== 'training') continue; // enfocamos la demo en training
    cooldown = CONVERSATION_COOLDOWN;
    charlas++;
    const ra = applyConversationNudges(axesA, stampsA, ex.nudges.a);
    const rb = applyConversationNudges(axesB, stampsB, ex.nudges.b);
    axesA = ra.axes; axesB = rb.axes;
    crossings += ra.newStamps.length + rb.newStamps.length;
  }

  console.log(`Tras ${charlas} charlas de training:`);
  console.log(`         erudito.curiosity=${axesA.curiosity.toFixed(3)}  novato.curiosity=${axesB.curiosity.toFixed(3)}`);
  const converged = axesB.curiosity > novato.axes.curiosity && axesA.curiosity < erudito.axes.curiosity;
  console.log(`  convergencia (novato sube, erudito baja): ${converged ? 'PASS' : 'FAIL'}`);
  console.log(`  growth stamps sellados en el proceso: ${crossings}`);
  console.log(`  (el jugador no vio ni una sola de estas charlas)`);
}

// --- La entidad mediadora (la hada) -----------------------------------------
console.log('\n=== La entidad (hada) — única voz al jefe, reactiva ===\n');
{
  const roster = [
    generateNPC({ seed: 'roster:1' }),
    generateNPC({ seed: 'roster:2' }),
    generateNPC({ seed: 'roster:3' }),
  ];
  roster[0].floorReached = 12;
  roster[1].floorReached = 5;
  roster[2].floorReached = 8; roster[2].isAlive = false; // uno cayó

  const seeder = createSeeder('mediator-demo');

  console.log('Jefe pregunta "¿estado del roster?":');
  console.log(`  hada → ${briefRoster(roster)}`);

  console.log('\nJefe pregunta por uno:');
  console.log(`  hada → ${describeNPC(seeder, roster[0])}`);

  console.log('\nJefe pregunta "¿qué han estado haciendo?":');
  const exchanges = [];
  const cw = createSeeder('activity');
  let cd = 0;
  for (let t = 0; t < 1500 && exchanges.length < 8; t++) {
    cd = Math.max(0, cd - 1);
    const ex = rollConversation(cw.branch(`t:${t}`),
      { id: roster[0].id, axes: roster[0].axes },
      { id: roster[1].id, axes: roster[1].axes },
      { proximity: 0.95, cooldownRemaining: cd });
    if (ex) { exchanges.push(ex); cd = CONVERSATION_COOLDOWN; }
  }
  console.log('  hada → ' + reportActivity(exchanges, roster).split('\n').join('\n         '));

  console.log('\nJefe pregunta una regla ("difficulty"):');
  console.log(`  hada → ${explainRule('difficulty')}`);

  console.log('\nJefe da una orden (jefe → entidad → NPC):');
  console.log(`  hada → ${relay(roster[1], 'sube al siguiente piso con cautela')}`);

  // Susurro condicional: la entidad habla SIN que le pregunten, pero solo cuando
  // el estado del mundo cruza un umbral real — no por porcentaje ni azar.
  console.log('\nSusurro condicional (influenciado por el mundo, no por azar):');

  // (1) Miedo colectivo: más de la mitad del roster con confianza y optimismo bajos.
  const fearRoster = [
    generateNPC({ seed: 'fear:1' }),
    generateNPC({ seed: 'fear:2' }),
    generateNPC({ seed: 'fear:3' }),
  ];
  fearRoster.forEach((n) => { n.axes.confidence = 0.20; n.axes.optimism = 0.18; });
  const wFear = rareWhisper(fearRoster);
  console.log(`  miedo colectivo    → "${wFear ?? '(silencio)'}"`);
  console.log(`    ${wFear !== null ? 'PASS — disparó' : 'FAIL — debería disparar'}`);

  // (2) Tensión entre dos NPC: ambos rencorosos, desconfiados y fríos.
  const conflictRoster = [
    generateNPC({ seed: 'conflict:1' }),
    generateNPC({ seed: 'conflict:2' }),
  ];
  conflictRoster[0].axes.forgiveness = 0.10; conflictRoster[0].axes.trust = 0.15; conflictRoster[0].axes.warmth = 0.12;
  conflictRoster[1].axes.forgiveness = 0.12; conflictRoster[1].axes.trust = 0.18; conflictRoster[1].axes.warmth = 0.20;
  const wConflict = rareWhisper(conflictRoster);
  console.log(`  tensión entre dos  → "${wConflict ?? '(silencio)'}"`);
  console.log(`    ${wConflict !== null ? 'PASS — disparó' : 'FAIL — debería disparar'}`);

  // (3) NPC aislado: sociabilidad y calidez en extremo inferior.
  const isoRoster = [
    generateNPC({ seed: 'iso:1' }),
    generateNPC({ seed: 'iso:2' }),
  ];
  isoRoster[0].axes.sociability = 0.10; isoRoster[0].axes.warmth = 0.12;
  const wIso = rareWhisper(isoRoster);
  console.log(`  NPC aislado        → "${wIso ?? '(silencio)'}"`);
  console.log(`    ${wIso !== null ? 'PASS — disparó' : 'FAIL — debería disparar'}`);

  // (4) Roster sano: ninguna condición supera el umbral — silencio correcto.
  const healthyRoster = [
    generateNPC({ seed: 'healthy:1' }),
    generateNPC({ seed: 'healthy:2' }),
  ];
  healthyRoster.forEach((n) => {
    n.axes.confidence = 0.60; n.axes.optimism = 0.65;
    n.axes.forgiveness = 0.55; n.axes.trust = 0.60; n.axes.warmth = 0.60;
    n.axes.sociability = 0.55;
  });
  const wHealthy = rareWhisper(healthyRoster);
  console.log(`  roster sano        → "${wHealthy ?? '(silencio — correcto)'}"`);
  console.log(`    ${wHealthy === null ? 'PASS — sin alertas, silencio' : 'FAIL — no debería disparar'}`);
}
