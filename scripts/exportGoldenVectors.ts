// One-off tool: dumps deterministic engine output for fixed seeds, as JSON,
// to serve as cross-language golden vectors for the Godot/GDScript port.
// Run with: npx ts-node --project tsconfig.json scripts/exportGoldenVectors.ts > out.json

import { createSeeder } from '../src/engine/seeder';
import { generateAxes, readEmergentTraits, AXIS_KEYS } from '../src/engine/axes';
import { ARCHETYPES, pickArchetype } from '../src/engine/archetypes';
import {
  bandOf, nearestBand, sealBirthStamp, sealIfBandCrossed, softCeiling,
} from '../src/engine/stamps';
import { generateCulture, generateName, nameNamespaceSize } from '../src/engine/nameGenerator';
import { rollDifficulty, starProbabilities, rollStars } from '../src/engine/gacha';
import { NPC, SoulAxes, Stamp } from '../src/engine/types';
import {
  createNeeds, tickNeeds, needsStatus, debilidadStatus, criticalNeed, Activity,
} from '../src/engine/needs';
import { readBehavior, firstImpression } from '../src/engine/behavior';
import {
  conversationAffinity, conversationChance, rollConversation,
  ConversationParticipant, Exchange,
} from '../src/engine/conversations';
import { applyExperience, applyConversationNudges, ExperienceEvent } from '../src/engine/experience';
import { briefRoster, describeNPC, reportActivity, explainRule, rareWhisper } from '../src/engine/mediator';
import { generateNPC } from '../src/engine/npcGenerator';

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

// 7. Gacha: difficulty rolls, star-tier probability curves, and star rolls.
const GACHA_POINTS = [
  { difficulty: 1, rosterFloor: 0 },
  { difficulty: 1, rosterFloor: 90 },
  { difficulty: 500, rosterFloor: 0 },
  { difficulty: 500, rosterFloor: 50 },
  { difficulty: 1000, rosterFloor: 0 },
  { difficulty: 1000, rosterFloor: 100 },
];
output.gacha = {
  difficultyRolls: {} as Record<string, number>,
  starProbabilities: GACHA_POINTS.map((p) => ({ ...p, probs: starProbabilities(p.difficulty, p.rosterFloor) })),
  starRolls: {} as Record<string, Record<string, number>>,
};
for (const seed of SEEDS) {
  output.gacha.difficultyRolls[seed] = rollDifficulty(createSeeder(seed));
  const perPoint: Record<string, number> = {};
  for (const p of GACHA_POINTS) {
    perPoint[`${p.difficulty}:${p.rosterFloor}`] = rollStars(createSeeder(seed), p.difficulty, p.rosterFloor);
  }
  output.gacha.starRolls[seed] = perPoint;
}

// ── Shared axes profiles for behavior / conversations / experience sections ─
const CENTER_AXES: SoulAxes = AXIS_KEYS.reduce((acc, key) => {
  acc[key] = 0.5;
  return acc;
}, {} as SoulAxes);

// A few mild axes (|v-0.5| in [0.15, 0.30)) — exercises the "mild" cue tier.
const MILD_AXES: SoulAxes = { ...CENTER_AXES, caution: 0.35, warmth: 0.62, optimism: 0.38 };

// Strong extremes on both poles (|v-0.5| >= 0.30) — exercises the "strong" tier,
// with some axes pinned below 0.5 (low pole) and others above (high pole).
const STRONG_AXES: SoulAxes = {
  ...CENTER_AXES,
  caution: 0.05, trust: 0.02, confidence: 0.03,   // low pole, strong
  passivity: 0.97, warmth: 0.9, discipline: 0.95, // high pole, strong
};

// A mid-range profile for experience.ts application cases.
const MID_AXES: SoulAxes = {
  ...CENTER_AXES,
  confidence: 0.5, passivity: 0.5, caution: 0.5, curiosity: 0.5, discipline: 0.5, optimism: 0.5,
};

// Near-ceiling profile — exercises softCeiling's saturation branch.
const SAT_AXES: SoulAxes = { ...CENTER_AXES, confidence: 0.98, passivity: 0.02, caution: 0.97 };

// 8. Needs: initial state, per-activity tick sequences (crossing DEBILIDAD and
// negative territory for hambre/descanso), and the observable status helpers.
const NEEDS_TICK_SEEDS = ['world-alpha:1001', 'golden-seed-A'];
const NEEDS_ACTIVITIES: Activity[] = ['idle', 'rest', 'eat', 'work', 'train', 'fight'];
const NEEDS_CHECKPOINTS = [1, 20, 60, 120, 200]; // cumulative tick counts

output.needs = { initial: {} as Record<string, any>, ticks: {} as Record<string, any>, statusCases: [] as any[] };
for (const seed of SEEDS) {
  const axes = generateAxes(createSeeder(seed));
  output.needs.initial[seed] = createNeeds(createSeeder(seed), axes);
}
for (const seed of NEEDS_TICK_SEEDS) {
  const axes = generateAxes(createSeeder(seed));
  const initial = createNeeds(createSeeder(seed), axes);
  const perActivity: Record<string, any[]> = {};
  for (const activity of NEEDS_ACTIVITIES) {
    const seq: any[] = [];
    let n = initial;
    let prevTick = 0;
    for (const t of NEEDS_CHECKPOINTS) {
      n = tickNeeds(n, axes, activity, t - prevTick);
      prevTick = t;
      seq.push({ ticks: t, needs: n });
    }
    perActivity[activity] = seq;
  }
  output.needs.ticks[seed] = { initial, sequence: perActivity };
}
output.needs.statusCases = [
  { label: 'full', needs: { hambre: 1, descanso: 1, energia: 1, health: 1 } },
  { label: 'mild_hunger_tired', needs: { hambre: 0.4, descanso: 0.45, energia: 0.5, health: 0.9 } },
  { label: 'debilidad_all', needs: { hambre: 0.2, descanso: 0.25, energia: 0.1, health: 0.25 } },
  { label: 'critical_hambre_descanso', needs: { hambre: -0.1, descanso: -0.05, energia: -0.5, health: 0.05 } },
  { label: 'collapse', needs: { hambre: 0.5, descanso: 0.5, energia: 0.5, health: 0 } },
].map((c) => ({
  ...c,
  status: needsStatus(c.needs),
  debilidad: debilidadStatus(c.needs),
  critical: criticalNeed(c.needs),
}));

// 9. Behavior: readBehavior + firstImpression across axes profiles, per seed.
const BEHAVIOR_PROFILES: Record<string, SoulAxes> = {
  allCenter: CENTER_AXES,
  mild: MILD_AXES,
  strongBothPoles: STRONG_AXES,
};
output.behavior = {};
for (const seed of SEEDS) {
  const perProfile: Record<string, any> = {};
  for (const [label, axes] of Object.entries(BEHAVIOR_PROFILES)) {
    perProfile[label] = {
      readBehavior: readBehavior(createSeeder(seed), axes),
      firstImpression: firstImpression(createSeeder(seed), axes),
    };
  }
  output.behavior[seed] = perProfile;
}

// 10. Conversations: affinity/chance for known pairs, and rollConversation
// across cooldown-blocked / roll-miss / roll-hit branches, both id orders
// (pins pairKey's order-independence).
const CONV_PARTICIPANTS: Record<string, ConversationParticipant> = {
  chatty:   { id: 'npc-chatty',   axes: { ...CENTER_AXES, sociability: 0.9,  curiosity: 0.85 } },
  chatty2:  { id: 'npc-chatty2',  axes: { ...CENTER_AXES, sociability: 0.95, curiosity: 0.9 } },
  recluse:  { id: 'npc-recluse',  axes: { ...CENTER_AXES, sociability: 0.05, curiosity: 0.1 } },
  balanced: {
    id: 'npc-balanced',
    axes: { ...CENTER_AXES, sociability: 0.55, curiosity: 0.5, optimism: 0.7, caution: 0.6, warmth: 0.65, discipline: 0.6 },
  },
};
const CONV_PAIRS: [string, string][] = [['chatty', 'recluse'], ['chatty', 'balanced'], ['recluse', 'balanced']];
const PROXIMITIES = [0.2, 0.6, 1.0];

output.conversations = { affinity: {} as Record<string, number>, chance: {} as Record<string, any>, rollConversation: {} as Record<string, any> };
for (const [x, y] of CONV_PAIRS) {
  const a = CONV_PARTICIPANTS[x];
  const b = CONV_PARTICIPANTS[y];
  const key = `${x}:${y}`;
  output.conversations.affinity[key] = conversationAffinity(a, b);
  const perProximity: Record<string, number> = {};
  for (const p of PROXIMITIES) perProximity[String(p)] = conversationChance(a, b, p);
  output.conversations.chance[key] = perProximity;
}

function findRollConversationCase(
  aLabel: string, bLabel: string, proximity: number, wantHit: boolean, seedPrefix: string, maxTries = 3000,
): { seed: string; result: Exchange | null } {
  const a = CONV_PARTICIPANTS[aLabel];
  const b = CONV_PARTICIPANTS[bLabel];
  for (let i = 0; i < maxTries; i++) {
    const seed = `${seedPrefix}:${i}`;
    const result = rollConversation(createSeeder(seed), a, b, { proximity, cooldownRemaining: 0 });
    if ((result !== null) === wantHit) return { seed, result };
  }
  throw new Error(`No ${wantHit ? 'hit' : 'miss'} case found for ${aLabel}-${bLabel}`);
}

// cooldownRemaining > 0 blocks regardless of the roll — deterministic, any seed.
output.conversations.rollConversation.cooldownBlocked = {
  seed: 'golden-seed-A', pair: ['chatty', 'recluse'], proximity: 1.0, cooldownRemaining: 5,
  result: rollConversation(
    createSeeder('golden-seed-A'), CONV_PARTICIPANTS.chatty, CONV_PARTICIPANTS.recluse,
    { proximity: 1.0, cooldownRemaining: 5 },
  ),
};

const missCase = findRollConversationCase('chatty', 'recluse', 0.3, false, 'rc-miss-chatty-recluse');
const missCaseSwapped = rollConversation(
  createSeeder(missCase.seed), CONV_PARTICIPANTS.recluse, CONV_PARTICIPANTS.chatty,
  { proximity: 0.3, cooldownRemaining: 0 },
);
output.conversations.rollConversation.rollMiss = {
  seed: missCase.seed, pair: ['chatty', 'recluse'], proximity: 0.3, cooldownRemaining: 0,
  result: missCase.result, swappedOrderResult: missCaseSwapped,
};

const hitCase = findRollConversationCase('chatty', 'chatty2', 1.0, true, 'rc-hit-chatty-chatty2');
const hitCaseSwapped = rollConversation(
  createSeeder(hitCase.seed), CONV_PARTICIPANTS.chatty2, CONV_PARTICIPANTS.chatty,
  { proximity: 1.0, cooldownRemaining: 0 },
);
output.conversations.rollConversation.rollHit = {
  seed: hitCase.seed, pair: ['chatty', 'chatty2'], proximity: 1.0, cooldownRemaining: 0,
  result: hitCase.result, swappedOrderResult: hitCaseSwapped,
};

// 11. Experience: applyExperience over combat/scout/rest, soft-ceiling
// saturation, origin-signature resistance, the star multiplier, and
// applyConversationNudges with several axes at once.
const EXP_SEEDS = ['world-alpha:1001', 'golden-seed-A', 'golden-seed-B'];
const EXP_EVENTS: Record<string, ExperienceEvent> = {
  combatSuccess:   { kind: 'combat', intensity: 0.8, outcome: 'success' },
  combatFailure:   { kind: 'combat', intensity: 0.9, outcome: 'failure' },
  scoutSuccess:    { kind: 'scout',  intensity: 0.7, outcome: 'success' },
  restInterrupted: { kind: 'rest',   intensity: 0.5, outcome: 'failure' },
};
const birthOnConfidence: Stamp = { kind: 'birth', axisKey: 'confidence', bandValue: 1.0, sealedAt: 0 };
const birthOnCuriosity: Stamp  = { kind: 'birth', axisKey: 'curiosity',  bandValue: 1.0, sealedAt: 0 };
const birthOnWarmth: Stamp     = { kind: 'birth', axisKey: 'warmth',     bandValue: 0.5, sealedAt: 0 };

output.experience = {
  midRange: {} as Record<string, any>,
  starMultiplier: {} as Record<string, any>,
  saturation: {} as Record<string, any>,
  originResistance: {} as Record<string, any>,
};
for (const seed of EXP_SEEDS) {
  const perEvent: Record<string, any> = {};
  for (const [label, event] of Object.entries(EXP_EVENTS)) {
    perEvent[label] = applyExperience(createSeeder(seed), MID_AXES, [], event);
  }
  output.experience.midRange[seed] = perEvent;

  output.experience.starMultiplier[seed] = {
    noStars: applyExperience(createSeeder(seed), MID_AXES, [], EXP_EVENTS.combatSuccess),
    fiveStars: applyExperience(createSeeder(seed), MID_AXES, [], EXP_EVENTS.combatSuccess, 5),
  };

  output.experience.saturation[seed] = {
    combatSuccessNearCeiling: applyExperience(createSeeder(seed), SAT_AXES, [], EXP_EVENTS.combatSuccess),
  };

  output.experience.originResistance[seed] = {
    resisted:   applyExperience(createSeeder(seed), MID_AXES, [birthOnConfidence], EXP_EVENTS.combatSuccess),
    unresisted: applyExperience(createSeeder(seed), MID_AXES, [birthOnCuriosity], EXP_EVENTS.combatSuccess),
  };
}

const MULTI_NUDGES: Partial<Record<keyof SoulAxes, number>> = {
  warmth: 0.02, trust: 0.015, curiosity: -0.01, discipline: 0.008,
};
output.experience.conversationNudges = {
  plain:     applyConversationNudges(MID_AXES, [], MULTI_NUDGES),
  resisted:  applyConversationNudges(MID_AXES, [birthOnWarmth], MULTI_NUDGES),
  saturated: applyConversationNudges(SAT_AXES, [], { confidence: 0.05, passivity: -0.05, caution: 0.05 }),
};

// 12. Mediator: roster/NPC/report/rule copy, and rareWhisper's three trigger
// conditions (collective fear, pair conflict, isolation) plus the null branch.
function withAxes(npc: NPC, overrides: Partial<SoulAxes>, extra: Partial<NPC> = {}): NPC {
  return { ...npc, ...extra, axes: { ...npc.axes, ...overrides } };
}

const medA = generateNPC({ seed: 'mediator-npc-A' });
const medB = generateNPC({ seed: 'mediator-npc-B' });
const medC = generateNPC({ seed: 'mediator-npc-C' });

output.mediator = {};

output.mediator.briefRoster = {
  empty: briefRoster([]),
  allAlive: briefRoster([
    withAxes(medA, {}, { floorReached: 3, isAlive: true }),
    withAxes(medB, {}, { floorReached: 7, isAlive: true }),
  ]),
  mixedAliveDead: briefRoster([
    withAxes(medA, {}, { floorReached: 5, isAlive: true }),
    withAxes(medB, {}, { floorReached: 2, isAlive: false }),
    withAxes(medC, {}, { floorReached: 9, isAlive: true }),
  ]),
};

output.mediator.describeNPC = {};
for (const seed of ['golden-seed-A', 'golden-seed-B']) {
  output.mediator.describeNPC[seed] = {
    alive: describeNPC(createSeeder(seed), withAxes(medA, {}, { floorReached: 4, isAlive: true })),
    fallen: describeNPC(createSeeder(seed), withAxes(medB, {}, { isAlive: false })),
  };
}

const reportNpcs: NPC[] = [
  withAxes(medA, {}, { id: 'chatty', name: 'Chatty NPC' }),
  withAxes(medB, {}, { id: 'recluse', name: 'Recluse NPC' }),
];
const reportExchanges: Exchange[] = [
  { participants: ['chatty', 'recluse'], topic: 'training', intensity: 0.5, nudges: { a: {}, b: {} }, sealedAt: 0 },
  { participants: ['recluse', 'chatty'], topic: 'training', intensity: 0.4, nudges: { a: {}, b: {} }, sealedAt: 0 },
  { participants: ['chatty', 'recluse'], topic: 'casual',   intensity: 0.3, nudges: { a: {}, b: {} }, sealedAt: 0 },
  { participants: ['chatty', 'unknown-id'], topic: 'hobby', intensity: 0.6, nudges: { a: {}, b: {} }, sealedAt: 0 },
];
output.mediator.reportActivity = {
  empty: reportActivity([], reportNpcs),
  populated: reportActivity(reportExchanges, reportNpcs),
};

output.mediator.explainRule = {};
for (const key of ['difficulty', 'promotion', 'death', 'start', 'growth', 'unknown-rule']) {
  output.mediator.explainRule[key] = explainRule(key);
}

const fearRoster: NPC[] = [
  withAxes(generateNPC({ seed: 'whisper-w1' }), { confidence: 0.2, optimism: 0.2 }, { id: 'w1', name: 'Uno', isAlive: true }),
  withAxes(generateNPC({ seed: 'whisper-w2' }), { confidence: 0.25, optimism: 0.1 }, { id: 'w2', name: 'Dos', isAlive: true }),
];
const conflictRoster: NPC[] = [
  withAxes(
    generateNPC({ seed: 'whisper-w3' }),
    { forgiveness: 0.1, trust: 0.1, warmth: 0.2, confidence: 0.7, optimism: 0.7 },
    { id: 'w3', name: 'Tres', isAlive: true },
  ),
  withAxes(
    generateNPC({ seed: 'whisper-w4' }),
    { forgiveness: 0.15, trust: 0.2, warmth: 0.5, confidence: 0.7, optimism: 0.7 },
    { id: 'w4', name: 'Cuatro', isAlive: true },
  ),
];
const isolationRoster: NPC[] = [
  withAxes(
    generateNPC({ seed: 'whisper-w5' }),
    { sociability: 0.1, warmth: 0.15, confidence: 0.7, optimism: 0.7, forgiveness: 0.7, trust: 0.7 },
    { id: 'w5', name: 'Cinco', isAlive: true },
  ),
];
const nullRoster: NPC[] = [
  withAxes(
    generateNPC({ seed: 'whisper-w6' }),
    { confidence: 0.7, optimism: 0.7, forgiveness: 0.7, trust: 0.7, warmth: 0.7, sociability: 0.7 },
    { id: 'w6', name: 'Seis', isAlive: true },
  ),
];

output.mediator.rareWhisper = {
  fear: rareWhisper(fearRoster),
  conflict: rareWhisper(conflictRoster),
  isolation: rareWhisper(isolationRoster),
  none: rareWhisper(nullRoster),
  emptyRoster: rareWhisper([]),
};

console.log(JSON.stringify(output, null, 2));
