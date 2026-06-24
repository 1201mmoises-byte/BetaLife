/**
 * BUILD — Genera preview/slice.html (el vertical slice "Pueblo Vivo", Fase 1).
 *
 * Corre el MOTOR determinista (sin tocarlo) vía runPreviewSim(), hornea su estado
 * y lo inyecta en la plantilla estática preview/slice.template.html, que dibuja
 * el pueblo en 3D (Three.js por CDN en el navegador del jugador).
 *
 * La VOZ de la Hada se compone aquí (no en el motor): cualitativa, sin números.
 * El motor da las señales (cues observables, emergentes, y la deriva de ejes
 * nacimiento→ahora = "ha ido aprendiendo / acoplándose"); aquí se narran como
 * la Hada hablaría — nunca "hablaron 3 veces", sino "se le ve confundido",
 * "ha ido aprendiendo poco a poco", "teme a la Torre, no se siente listo".
 *
 * Uso:
 *   npx ts-node --project tsconfig.json scripts/buildSlice.ts
 */

import { explainRule }                    from '../src/engine/mediator';
import { readEmergentTraits, AXIS_KEYS }  from '../src/engine/axes';
import { readBehavior, firstImpression }  from '../src/engine/behavior';
import { createNeeds, tickNeeds, needsStatus, Activity, Needs } from '../src/engine/needs';
import { SoulAxes }                        from '../src/engine/types';
import { createSeeder }                    from '../src/engine/seeder';
import {
  runPreviewSim, fallbackDialogue, DialogueLine, ROLES, INITIAL,
} from './previewSim';
import * as fs   from 'fs';
import * as path from 'path';

// ── 1. Motor: pueblo + simulación de charlas (determinista) ──────────────────
const { town, pool, currentAxes, log: rawLog } = runPreviewSim();

// ── 2. Voz cualitativa de la Hada (compuesta aquí, sin números) ──────────────
function driftAmount(orig: SoulAxes, now: SoulAxes): number {
  return AXIS_KEYS.reduce((m, k) => m + Math.abs(now[k] - orig[k]), 0);
}

/** Lectura de un héroe como la diría la Hada: ánimo, cuerpo, aprendizaje, Torre.
 * Las necesidades (hambre/agotamiento/salud) entran como CONDUCTA observable —
 * nunca como número. Es "tipo Sims pero oculto": el jugador lo percibe por ella. */
function hadaReading(name: string, orig: SoulAxes, now: SoulAxes, cues: string[], needs: Needs): string {
  const s: string[] = [];
  if (cues[0]) s.push(cues[0]);

  // estado físico (necesidades) traducido a algo observable
  const phys = needsStatus(needs).filter((p) => p !== 'se le ve entero');
  if (phys.length) { const p = phys[0]; s.push(p.charAt(0).toUpperCase() + p.slice(1) + '.'); }

  const { confidence: conf, optimism: opt, curiosity: cur, warmth, sociability: soc } = now;

  // ánimo
  if (cur > 0.55 && conf < 0.45) s.push('Lo noto algo confundido: busca, pregunta, pero todavía no se afirma.');
  else if (opt < 0.4) s.push('Carga un peso estos días; no ve claro el camino.');
  else if (opt > 0.65 && conf > 0.6) s.push('Anda entero, con el ánimo en alto.');
  else s.push('Está sereno, ni arriba ni abajo.');

  // aprendizaje / acoplamiento (deriva nacimiento→ahora)
  const d = driftAmount(orig, now);
  if (d > 0.7) s.push('Ha ido cambiando poco a poco — aprende, se acopla al pueblo sin que se note de un día para otro.');
  else if (d > 0.3) s.push('Empieza a acoplarse, despacio.');

  // relación con los demás
  if (soc > 0.6 && warmth > 0.55) s.push('Se le da estar con los otros; se acerca sin esfuerzo.');
  else if (soc < 0.35) s.push('Prefiere su rincón; le cuesta abrirse.');

  // la Torre
  if (conf < 0.42) s.push('Y le teme a la Torre: no se siente preparado para subir.');
  else if (conf > 0.7) s.push('Si lo mandaras a la Torre, creo que iría sin que le tiemble el pulso.');
  else s.push('Lo de la Torre lo ronda; aún lo piensa.');

  return s.join(' ');
}

/** Panorama del pueblo, cualitativo: ánimo general + un par de notas observables. */
function hadaSituation(rosterAxes: SoulAxes[], rosterNames: string[]): string {
  const avg = (k: keyof SoulAxes) => rosterAxes.reduce((m, a) => m + a[k], 0) / rosterAxes.length;
  const opt = avg('optimism'), conf = avg('confidence'), warmth = avg('warmth');

  const parts: string[] = [];
  if (opt > 0.6 && warmth > 0.55) parts.push('El pueblo respira tranquilo, hay calor entre ellos.');
  else if (opt < 0.42) parts.push('Hay una sombra de desánimo rondando estos días.');
  else parts.push('El pueblo va a su ritmo, sin grandes sobresaltos.');

  // nota: quién destaca por inseguridad / por acoplarse
  let lowConf = -1, lowI = 0;
  rosterAxes.forEach((a, i) => { if (1 - a.confidence > lowConf) { lowConf = 1 - a.confidence; lowI = i; } });
  if (rosterAxes[lowI].confidence < 0.45) {
    parts.push(`${rosterNames[lowI]} es el que más duda de sí mismo; no se siente listo para lo que viene.`);
  }
  if (conf > 0.6) parts.push('Pero en general se les ve más firmes que al llegar.');
  return parts.join(' ');
}

const RULE_LABELS: Record<string, string> = {
  growth: 'El crecimiento', death: 'La muerte', promotion: 'El ascenso', start: 'El comienzo',
};
const rules = ['growth', 'death', 'promotion', 'start'].map((k) => ({
  k, label: RULE_LABELS[k] || k, text: explainRule(k),
}));

// Necesidades vitales (base Fase 2): simula un "día" determinista de actividades
// para tener un snapshot variado por héroe. La capa real las correrá en vivo.
function simulateNeeds(seed: string, axes: SoulAxes, role: string) {
  const s = createSeeder('needs:' + seed);
  const pool: Activity[] =
    role === 'warrior' || role === 'archer' ? ['train','idle','rest','rest','eat','work','train']
    : role === 'mage'                       ? ['work','idle','train','rest','rest','eat','idle']
    :                                         ['idle','work','rest','eat','train','rest','idle'];
  let n = createNeeds(s, axes);
  const day = s.branch('day');
  for (let t = 0; t < 110; t++) n = tickNeeds(n, axes, day.nextChoice(pool), 1);
  return n;
}

// ── 3. Héroes horneados (con ejes nacimiento + ahora para el panel de stats) ──
const heroes = pool.map((n, i) => {
  const orig = n.axes;
  const now = currentAxes[n.id];
  const role = ROLES[i % ROLES.length];
  const cues = readBehavior(createSeeder('cue:' + n.id), now, 3);
  const needs = simulateNeeds(n.id, now, role);
  return {
    id: n.id,
    name: n.name,
    role,
    stars: n.stars,
    inRoster: i < INITIAL,
    alive: true,
    emergent: readEmergentTraits(now),
    cues,
    impression: firstImpression(createSeeder('imp:' + n.id), now),
    axesOrig: orig,
    axesNow: now,
    reading: hadaReading(n.name, orig, now, cues, needs),
    needs,
    needsStatus: needsStatus(needs),
  };
});

const rosterHeroes = heroes.filter((h) => h.inRoster);
const situation = hadaSituation(
  rosterHeroes.map((h) => h.axesNow),
  rosterHeroes.map((h) => h.name),
);
const reports: Record<string, string> = {};
heroes.forEach((h) => { reports[h.id] = h.reading; });

// ── 4. Pool de diálogo por tema (para charlas EN VIVO, no un log previo) ──────
// El slice NO hornea charlas pasadas: genera las conversaciones en vivo y dibuja
// líneas de este pool (texto real del motor: Gemini/fallback agrupado por tema).
const cachePath = path.join(__dirname, '..', 'preview', 'dialogue-cache.json');
const rawCache: Record<string, any> =
  fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};
const dialoguePool: Record<string, [string, string][]> = {};
for (const e of rawLog) {
  const entry = rawCache[e.key];
  const lines: DialogueLine[] =
    entry?.lines ?? (Array.isArray(entry) ? entry : null) ?? fallbackDialogue(e);
  const a = lines.find((l) => l.speaker === 'a')?.text;
  const b = lines.find((l) => l.speaker === 'b')?.text;
  if (!a || !b) continue;
  (dialoguePool[e.topic] ||= []);
  if (dialoguePool[e.topic].length < 12 && !dialoguePool[e.topic].some((p) => p[0] === a)) {
    dialoguePool[e.topic].push([a, b]);
  }
}
const dialogueLines = Object.values(dialoguePool).reduce((acc, arr) => acc + arr.length, 0);

// resumen offline (cualitativo, sin conteos)
const catchup = rawLog.slice(-5).reverse().slice(0, 3).map((e) => {
  const verb: Record<string, string> = {
    training: 'practicaron lado a lado', survival: 'se cuidaron las espaldas',
    social: 'se fueron acercando', hobby: 'compartieron un rato suyo', casual: 'hablaron sin prisa',
  };
  return `${e.aName} y ${e.bName} ${verb[e.topic] || 'cruzaron palabras'}`;
});

const DATA = {
  town: { difficulty: town.difficulty },
  initial: INITIAL,
  heroes,
  hada: { situation, reports, rules },
  dialoguePool,
  catchup,
};

// ── 5. Inyectar en la plantilla y escribir slice.html ────────────────────────
const tplPath = path.join(__dirname, '..', 'preview', 'slice.template.html');
const outPath = path.join(__dirname, '..', 'preview', 'slice.html');
const tpl = fs.readFileSync(tplPath, 'utf8');
if (!tpl.includes('__BETALIFE_DATA__')) {
  throw new Error('La plantilla no contiene el token __BETALIFE_DATA__');
}
fs.writeFileSync(outPath, tpl.replace('__BETALIFE_DATA__', JSON.stringify(DATA)), 'utf8');

console.log('✓ slice.html generado:', JSON.stringify({
  heroes: heroes.length, roster: rosterHeroes.length,
  invocables: heroes.length - rosterHeroes.length,
  dialogueLines, difficulty: town.difficulty,
}, null, 0));
console.log('  héroes:', heroes.map((h) => `${h.name}(${h.role},${'★'.repeat(h.stars)})`).join(' '));
