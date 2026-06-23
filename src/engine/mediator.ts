import { NPC } from './types';
import { Seeder } from './seeder';
import { firstImpression } from './behavior';
import { Exchange, ConversationTopic } from './conversations';

/**
 * La ENTIDAD mediadora (la hada).
 *
 * Única voz que habla al jefe. Sin personalidad, sin opinión, sin agenda: solo
 * AUTORIDAD y trato directo. Conoce las reglas del juego y las explica. Es el
 * canal jefe → entidad → NPC (y de vuelta).
 *
 * Reglas de su voz:
 * - REACTIVA: no le dice nada al jefe salvo que él pregunte (briefRoster,
 *   describeNPC, reportActivity, explainRule).
 * - EXCEPCIÓN: un susurro rarísimo no solicitado (rareWhisper) — la rareza lo
 *   hace creíble (regla del maestro conservada como única excepción).
 * - Nunca filtra internos prohibidos: ni dificultad, ni valores de ejes, ni
 *   etiquetas de personalidad. De los NPC solo transmite lo OBSERVABLE
 *   (reutiliza firstImpression, igual que vería el jugador mirando).
 */

export const MEDIATOR_WHISPER_RATE = 0.02; // proactivo: casi nunca

// Tema → frase llana con la que la entidad REPORTA actividad al jefe cuando pregunta.
const TOPIC_REPORT: Record<ConversationTopic, string> = {
  training: 'entrenan juntos',
  survival: 'hablan de cómo seguir vivos',
  social:   'pasan tiempo cerca; algo personal',
  hobby:    'comparten un pasatiempo',
  casual:   'se acompañan sin más',
};

// La entidad conoce las reglas y las explica de forma directa, sin adorno.
const RULES: Record<string, string> = {
  difficulty: 'La dificultad no multiplica fuerza: obliga a desbloquear más para sobrevivir. No la verás; la intuirás.',
  promotion:  'Promover tiene riesgo real: éxito, parcial, corrupción o muerte. Los recursos son escasos.',
  death:      'La muerte es permanente. Quien cae no vuelve.',
  start:      'Todos empiezan en el piso 1, sin importar la dificultad de su mundo.',
  growth:     'Crecen por exposición, filtrada por quiénes son. La misma experiencia forja almas distintas.',
};

/** Estado factual del roster. Reactivo: responde cuando el jefe pregunta. */
export function briefRoster(npcs: NPC[]): string {
  if (npcs.length === 0) return 'El roster está vacío. Invoca para empezar.';
  const alive = npcs.filter((n) => n.isAlive);
  const dead = npcs.length - alive.length;
  const top = alive.reduce((m, n) => (n.floorReached > m ? n.floorReached : m), 0);
  const parts = [`Roster: ${alive.length} ${alive.length === 1 ? 'vivo' : 'vivos'}`];
  if (dead) parts.push(`${dead} ${dead === 1 ? 'caído' : 'caídos'}`);
  parts.push(`el más alto en piso ${top}`);
  return parts.join('. ') + '.';
}

/**
 * Lo que la entidad transmite de un NPC cuando el jefe pregunta por él. Solo
 * hechos conocidos (estrellas, piso, vivo/caído) + conducta OBSERVABLE. Nunca
 * números de ejes, etiquetas ni dificultad.
 */
export function describeNPC(seeder: Seeder, npc: NPC): string {
  const status = npc.isAlive ? `piso ${npc.floorReached}` : 'caído';
  const seen = firstImpression(seeder.branch('observe:' + npc.id), npc.axes);
  return `${npc.name} (${npc.stars}★, ${status}). ${seen}`;
}

/**
 * Reporta qué ha estado pasando entre los NPC cuando el jefe pregunta. Resume
 * las charlas silenciosas en términos llanos, por pareja y tema dominante. Es la
 * única forma en que el jefe "se entera" de las conversaciones de fondo.
 */
export function reportActivity(exchanges: Exchange[], npcs: NPC[]): string {
  if (exchanges.length === 0) return 'Nada que reportar. El roster ha estado quieto.';

  const nameOf = new Map(npcs.map((n) => [n.id, n.name]));
  const resolve = (id: string) => nameOf.get(id) ?? id;

  const byPair = new Map<string, { count: number; topics: Record<string, number> }>();
  for (const e of exchanges) {
    const key = `${resolve(e.participants[0])} y ${resolve(e.participants[1])}`;
    const rec = byPair.get(key) ?? { count: 0, topics: {} };
    rec.count++;
    rec.topics[e.topic] = (rec.topics[e.topic] ?? 0) + 1;
    byPair.set(key, rec);
  }

  const lines: string[] = [];
  for (const [pair, rec] of byPair) {
    const dominant = Object.entries(rec.topics).sort((x, y) => y[1] - x[1])[0][0] as ConversationTopic;
    lines.push(`${pair}: ${TOPIC_REPORT[dominant]} (${rec.count}).`);
  }
  return lines.join('\n');
}

/** La entidad explica una regla del juego, directa. Reactiva. */
export function explainRule(key: string): string {
  return RULES[key] ?? 'No tengo esa regla registrada. Sé más específico.';
}

/**
 * Canal jefe → entidad → NPC. La entidad transmite la orden; el NPC la filtrará
 * por quién es (la disonancia y el peso real llegan en Fase 7).
 */
export function relay(npc: NPC, instruction: string): string {
  return `Transmitido a ${npc.name}: "${instruction}". Lo interpretará a su manera.`;
}

/**
 * El ÚNICO mensaje no solicitado de la entidad. Casi nunca dispara
 * (MEDIATOR_WHISPER_RATE). Terso y sin detalle: el jefe debe preguntar para
 * saber más. Determinista vía el seeder dado.
 */
export function rareWhisper(seeder: Seeder, npcs: NPC[]): string | null {
  const alive = npcs.filter((n) => n.isAlive);
  if (alive.length === 0) return null;
  if (seeder.nextFloat() >= MEDIATOR_WHISPER_RATE) return null;
  const pick = seeder.nextChoice(alive);
  return `No preguntaste, pero: vigila a ${pick.name}.`;
}
