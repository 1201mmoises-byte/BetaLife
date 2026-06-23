import { SoulAxes } from './types';
import { Seeder } from './seeder';

/**
 * Conversaciones de fondo — SILENCIOSAS.
 *
 * Los NPC hablan entre ellos por su cuenta: entrenan juntos y se pasan sabiduría
 * (mejoran), pero también son humanos (les gusta alguien, temen morir, tienen
 * mini-hobbies, charlan sin más). Cada charla empuja levemente los ejes de ambos.
 *
 * REGLA: el jugador NO ve esto. No hay ondas ni texto flotando en el mundo. Todo
 * lo que el jefe sabe le llega por la ENTIDAD mediadora (la hada), y solo cuando
 * pregunta (ver mediator.ts). Esta capa decide SI ocurre una charla, de qué tema,
 * y qué nudges deja; aplicarlos es trabajo de experience.ts.
 */

export interface ConversationParticipant {
  id: string;
  axes: SoulAxes;
}

export interface ConversationContext {
  proximity: number;         // 0..1 (1 = justo al lado)
  cooldownRemaining: number; // ticks hasta que la pareja puede volver a hablar; >0 bloquea
}

export type ConversationTopic =
  | 'training'   // entrenamiento, técnicas, opiniones de los pisos (sabiduría mutua)
  | 'survival'   // cómo no morir, miedos, riesgo del próximo tramo
  | 'social'     // le gusta alguien, vínculos, vida personal
  | 'hobby'      // pasatiempos, cosas del tiempo libre
  | 'casual';    // cháchara sin agenda, solo acompañarse

export type AxisNudges = Partial<Record<keyof SoulAxes, number>>;

/**
 * Una charla ocurrida. Es un registro INTERNO — sin texto para el jugador.
 * `nudges.a` / `.b` son los deltas crudos a aplicar a cada participante
 * (experience.ts les pone techo suave y resistencia de origen).
 */
export interface Exchange {
  participants: [string, string];
  topic: ConversationTopic;
  intensity: number;        // 0..1 — cuán significativa fue
  nudges: { a: AxisNudges; b: AxisNudges };
  sealedAt: number;
}

const BASE_RATE = 0.06;     // "raras, casi nunca"
export const CONVERSATION_COOLDOWN = 40; // ticks de espera tras una charla
const CONVO_NUDGE = 0.008;  // ≈ 1/5 del BASE_DELTA de experience.ts (la charla mueve poco)

const TOPICS: ConversationTopic[] = ['training', 'survival', 'social', 'hobby', 'casual'];

// Inclinación de un alma a charlar en privado: pesa sociabilidad sobre curiosidad.
function chattiness(axes: SoulAxes): number {
  return axes.sociability * 0.6 + axes.curiosity * 0.4;
}

/** Stable key for a pair, order-independent, so (a,b) and (b,a) share a stream. */
function pairKey(a: ConversationParticipant, b: ConversationParticipant): string {
  return a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
}

/** Both souls must lean in — a recluse and a chatterbox rarely click. */
export function conversationAffinity(
  a: ConversationParticipant,
  b: ConversationParticipant,
): number {
  return chattiness(a.axes) * chattiness(b.axes);
}

/** Probability of a background conversation this tick (before the cooldown gate). */
export function conversationChance(
  a: ConversationParticipant,
  b: ConversationParticipant,
  proximity: number,
): number {
  return BASE_RATE * conversationAffinity(a, b) * clamp01(proximity);
}

// Pesos de tema según ambos participantes. Más curiosos/disciplinados entrenan;
// pesimistas/cautelosos hablan de sobrevivir; cálidos y sociables, de gente; etc.
function topicWeights(a: SoulAxes, b: SoulAxes): Record<ConversationTopic, number> {
  const avg = (k: keyof SoulAxes) => (a[k] + b[k]) / 2;
  return {
    training: (avg('curiosity') + avg('discipline')) / 2,
    survival: (1 - avg('optimism')) * 0.5 + avg('caution') * 0.3,
    social:   ((avg('warmth') + avg('sociability')) / 2) * 0.8,
    hobby:    avg('optimism') * 0.4,
    casual:   0.3, // siempre posible
  };
}

function pickTopic(seeder: Seeder, a: SoulAxes, b: SoulAxes): ConversationTopic {
  const w = topicWeights(a, b);
  const total = TOPICS.reduce((s, t) => s + w[t], 0);
  let roll = seeder.nextFloat(0, total);
  for (const t of TOPICS) {
    roll -= w[t];
    if (roll < 0) return t;
  }
  return 'casual';
}

// −1, 0 o +1 según haya que subir o bajar `self` para acercarse a `other`.
function toward(self: number, other: number): number {
  if (other > self) return 1;
  if (other < self) return -1;
  return 0;
}

/**
 * Construye los nudges de ambos participantes según el tema. Magnitud = paso
 * base × intensidad. Los deltas son crudos: la resistencia del acento de origen
 * y el techo suave se aplican al EJECUTARLOS (experience.applyConversationNudges).
 */
function buildNudges(
  topic: ConversationTopic,
  a: SoulAxes,
  b: SoulAxes,
  intensity: number,
): { a: AxisNudges; b: AxisNudges } {
  const step = CONVO_NUDGE * intensity;
  const na: AxisNudges = {};
  const nb: AxisNudges = {};

  const converge = (k: keyof SoulAxes, scale = 1) => {
    na[k] = (na[k] ?? 0) + toward(a[k], b[k]) * step * scale;
    nb[k] = (nb[k] ?? 0) + toward(b[k], a[k]) * step * scale;
  };
  // Empuja a ambos hacia el participante con MÁS de ese eje (el "más X" enseña).
  const liftToHigher = (k: keyof SoulAxes, scale = 1) => {
    const target = Math.max(a[k], b[k]);
    na[k] = (na[k] ?? 0) + toward(a[k], target) * step * scale;
    nb[k] = (nb[k] ?? 0) + toward(b[k], target) * step * scale;
  };
  const bumpBoth = (k: keyof SoulAxes, scale = 1) => {
    na[k] = (na[k] ?? 0) + step * scale;
    nb[k] = (nb[k] ?? 0) + step * scale;
  };

  switch (topic) {
    case 'training':
      // Sabiduría mutua: se acercan en curiosidad y disciplina; el más cauto modera.
      converge('curiosity');
      converge('discipline');
      liftToHigher('caution', 0.5);
      break;
    case 'survival':
      // Calculan riesgos: cautela converge; el más seguro sube al más inseguro.
      converge('caution');
      liftToHigher('confidence', 0.8);
      break;
    case 'social':
      // Vínculo: calidez y optimismo hacia el más positivo; un poco más de confianza.
      liftToHigher('warmth', 0.8);
      liftToHigher('optimism', 0.5);
      bumpBoth('trust', 0.4);
      break;
    case 'hobby':
      // Compartir algo ligero abre y anima un poco.
      bumpBoth('curiosity', 0.5);
      bumpBoth('optimism', 0.5);
      break;
    case 'casual':
      // Solo acompañarse calienta y genera algo de confianza.
      bumpBoth('warmth', 0.4);
      bumpBoth('trust', 0.4);
      break;
  }

  return { a: na, b: nb };
}

/**
 * Tira por una charla de fondo. Devuelve un Exchange (silencioso) o null. El
 * caller pasa un seeder por tick (p. ej. worldSeeder.branch('tick:'+t)) y lleva
 * el cooldown: al ocurrir, reinícialo a CONVERSATION_COOLDOWN. Aplica los nudges
 * con experience.applyConversationNudges sobre cada participante.
 */
export function rollConversation(
  seeder: Seeder,
  a: ConversationParticipant,
  b: ConversationParticipant,
  ctx: ConversationContext,
): Exchange | null {
  if (ctx.cooldownRemaining > 0) return null;

  const chance = conversationChance(a, b, ctx.proximity);
  const cs = seeder.branch(pairKey(a, b));
  if (cs.nextFloat() >= chance) return null;

  const intensity = parseFloat((0.2 + cs.nextFloat() * 0.5).toFixed(3));
  const topic = pickTopic(cs, a.axes, b.axes);
  const nudges = buildNudges(topic, a.axes, b.axes, intensity);

  return { participants: [a.id, b.id], topic, intensity, nudges, sealedAt: 0 };
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
