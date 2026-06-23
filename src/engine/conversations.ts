import { SoulAxes } from './types';
import { Seeder } from './seeder';

/**
 * Fase 3 — Conversaciones de fondo.
 *
 * Privadas entre personajes. El jugador NUNCA ve el texto — solo efectos onda
 * raros (la rareza las hace creíbles). Gated por sociabilidad + curiosidad
 * (de ambos) + proximidad física + cooldown. Esta capa decide SI ocurren y qué
 * onda observable dejan; el contenido nunca se materializa, y el efecto
 * mecánico (empujar ejes) llega en fases posteriores.
 */

export interface ConversationParticipant {
  id: string;
  axes: SoulAxes;
}

export interface ConversationContext {
  proximity: number;         // 0..1 (1 = justo al lado)
  cooldownRemaining: number; // ticks hasta que la pareja puede volver a hablar; >0 bloquea
}

export interface Ripple {
  participants: [string, string];
  intensity: number;  // 0..1 — cuán perceptible (aun así sutil)
  observable: string; // vago, sin contenido: el jugador no sabe qué se dijo
  sealedAt: number;
}

const BASE_RATE = 0.06;     // "raras, casi nunca"
export const CONVERSATION_COOLDOWN = 40; // ticks de espera tras una charla

// Vague, content-free ripples. Never reveal what was said.
const RIPPLE_OBSERVABLES = [
  'Dos siluetas cerca, voces bajas. Cuando miras, ya se separaron.',
  'Algo se dijo entre ellos. No sabrás qué.',
  'Un gesto rápido, una mirada que se entiende sola.',
  'Se cruzaron más de la cuenta hoy. Nada que puedas señalar.',
  'Quedó un silencio distinto después de que hablaron.',
];

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

/**
 * Rolls for a background conversation. Returns a Ripple or null. The caller
 * provides a per-tick seeder (e.g. worldSeeder.branch('tick:'+t)) so successive
 * ticks differ, and tracks the cooldown: when a Ripple fires, reset the pair's
 * cooldown to CONVERSATION_COOLDOWN.
 */
export function rollConversation(
  seeder: Seeder,
  a: ConversationParticipant,
  b: ConversationParticipant,
  ctx: ConversationContext,
): Ripple | null {
  if (ctx.cooldownRemaining > 0) return null;

  const chance = conversationChance(a, b, ctx.proximity);
  const cs = seeder.branch(pairKey(a, b));
  if (cs.nextFloat() >= chance) return null;

  const intensity = parseFloat((0.2 + cs.nextFloat() * 0.5).toFixed(3));
  const observable = cs.nextChoice(RIPPLE_OBSERVABLES);
  return { participants: [a.id, b.id], intensity, observable, sealedAt: 0 };
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
