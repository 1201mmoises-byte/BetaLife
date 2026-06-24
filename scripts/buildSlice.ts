/**
 * BUILD — Genera preview/slice.html (el vertical slice "Pueblo Vivo", Fase 1).
 *
 * Corre el MOTOR determinista (sin tocarlo) vía runPreviewSim(), hornea su estado
 * — héroes, ejes evolucionados, conducta observable, y los textos de la Hada
 * (situationBrief / consultNPC / explainRule) — y los inyecta en la plantilla
 * estática preview/slice.template.html, que dibuja el pueblo en 3D (Three.js,
 * cargado por CDN en el navegador del jugador).
 *
 * El motor NO se importa al navegador: solo su salida horneada. Determinista:
 * el mismo seed produce el mismo pueblo.
 *
 * Uso:
 *   npx ts-node --project tsconfig.json scripts/buildSlice.ts
 */

import { consultNPC, situationBrief, explainRule } from '../src/engine/mediator';
import { readEmergentTraits }                       from '../src/engine/axes';
import { readBehavior, firstImpression }            from '../src/engine/behavior';
import { Exchange, ConversationTopic }              from '../src/engine/conversations';
import { createSeeder }                             from '../src/engine/seeder';
import { runPreviewSim, ROLES, INITIAL }            from './previewSim';
import * as fs   from 'fs';
import * as path from 'path';

// ── 1. Motor: pueblo + simulación de charlas (determinista) ──────────────────
const { town, pool, currentAxes, log: rawLog } = runPreviewSim();

// ── 2. La Hada — pre-cómputo en build time ───────────────────────────────────
const exchanges: Exchange[] = rawLog.map((e) => ({
  participants: [e.aId, e.bId] as [string, string],
  topic: e.topic as ConversationTopic,
  intensity: e.intensity,
  nudges: { a: {}, b: {} },
  sealedAt: e.tick,
}));

const allLive = pool.map((n) => ({ ...n, axes: currentAxes[n.id] }));
const consultSeeder = createSeeder('shrine-slice-consult');

const situation = situationBrief(allLive.slice(0, INITIAL), exchanges);
const reports: Record<string, string> = {};
for (const n of allLive) {
  reports[n.id] = consultNPC(consultSeeder, { ...n, isAlive: true }, exchanges, allLive);
}
const RULE_LABELS: Record<string, string> = {
  growth: 'El crecimiento', death: 'La muerte', promotion: 'El ascenso', start: 'El comienzo',
};
const rules = ['growth', 'death', 'promotion', 'start'].map((k) => ({
  k, label: RULE_LABELS[k] || k, text: explainRule(k),
}));

// Resumen "lo que pasó mientras no estabas" (catch-up offline): tomamos algunas
// charlas reales del log y las narramos como rumores del pueblo.
const catchup = rawLog.slice(-6).reverse().slice(0, 4).map((e) => {
  const verb: Record<string, string> = {
    training: 'entrenaron juntos', survival: 'hablaron de sobrevivir',
    social: 'se acercaron', hobby: 'compartieron un rato', casual: 'charlaron sin prisa',
  };
  return `${e.aName} y ${e.bName} ${verb[e.topic] || 'cruzaron palabras'}`;
});

// ── 3. Héroes horneados ──────────────────────────────────────────────────────
const heroes = pool.map((n, i) => {
  const axes = currentAxes[n.id];
  const role = ROLES[i % ROLES.length];
  const cueSeeder = createSeeder('cue:' + n.id);
  return {
    id: n.id,
    name: n.name,
    role,
    stars: n.stars,
    inRoster: i < INITIAL,           // los 4 iniciales viven; el resto son invocables
    alive: true,
    emergent: readEmergentTraits(axes),
    cues: readBehavior(cueSeeder, axes, 3),
    impression: firstImpression(createSeeder('imp:' + n.id), axes),
  };
});

const DATA = {
  town: { difficulty: town.difficulty },
  initial: INITIAL,
  heroes,
  hada: { situation, reports, rules },
  catchup,
};

// ── 4. Inyectar en la plantilla y escribir slice.html ────────────────────────
const tplPath = path.join(__dirname, '..', 'preview', 'slice.template.html');
const outPath = path.join(__dirname, '..', 'preview', 'slice.html');
const tpl = fs.readFileSync(tplPath, 'utf8');

if (!tpl.includes('__BETALIFE_DATA__')) {
  throw new Error('La plantilla no contiene el token __BETALIFE_DATA__');
}
const html = tpl.replace('__BETALIFE_DATA__', JSON.stringify(DATA));
fs.writeFileSync(outPath, html, 'utf8');

const stats = {
  heroes: heroes.length,
  roster: heroes.filter((h) => h.inRoster).length,
  invocables: heroes.filter((h) => !h.inRoster).length,
  difficulty: town.difficulty,
  bytes: html.length,
};
console.log('✓ slice.html generado:', JSON.stringify(stats, null, 0));
console.log('  héroes:', heroes.map((h) => `${h.name}(${h.role},${'★'.repeat(h.stars)})`).join(' '));
