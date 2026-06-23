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
 * - EXCEPCIÓN: rareWhisper — habla sin que le pregunten, pero solo cuando el
 *   estado del mundo la obliga: miedo colectivo, tensión entre dos NPC, o uno
 *   apartándose. No es una decisión ni un porcentaje: el mundo la influye.
 * - Nunca filtra internos prohibidos: ni dificultad, ni valores de ejes, ni
 *   etiquetas de personalidad. De los NPC solo transmite lo OBSERVABLE
 *   (reutiliza firstImpression, igual que vería el jugador mirando).
 */

// Umbrales para condiciones observables — definen cuándo el mundo obliga a hablar.
const FEAR_CONF_MAX  = 0.35; // confidence por debajo → NPC con miedo
const FEAR_OPT_MAX   = 0.35; // optimism por debajo  → NPC desesperanzado
const FEAR_MIN_FRAC  = 0.5;  // fracción del roster que debe cumplir ambos

const CONFLICT_FORG_MAX = 0.25; // muy rencoroso
const CONFLICT_TRST_MAX = 0.25; // muy desconfiado
const CONFLICT_WARM_MAX = 0.30; // muy frío

const ISOLATION_SOC_MAX  = 0.18; // prácticamente ermitaño
const ISOLATION_WARM_MAX = 0.22; // frío y apartado

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

// Más de la mitad del roster teme el siguiente piso.
function checkRosterFear(alive: NPC[]): string | null {
  if (alive.length < 2) return null;
  const fearful = alive.filter(
    (n) => n.axes.confidence < FEAR_CONF_MAX && n.axes.optimism < FEAR_OPT_MAX,
  );
  if (fearful.length / alive.length < FEAR_MIN_FRAC) return null;
  return 'Hay miedo en el roster. No el tuyo — el de ellos. Pregunta si quieres saber más.';
}

// Dos NPC con ejes que anuncian rotura: rencorosos, desconfiados y fríos.
function checkConflict(alive: NPC[]): string | null {
  for (let i = 0; i < alive.length - 1; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i];
      const b = alive[j];
      if (
        a.axes.forgiveness < CONFLICT_FORG_MAX &&
        b.axes.forgiveness < CONFLICT_FORG_MAX &&
        a.axes.trust < CONFLICT_TRST_MAX &&
        b.axes.trust < CONFLICT_TRST_MAX &&
        (a.axes.warmth < CONFLICT_WARM_MAX || b.axes.warmth < CONFLICT_WARM_MAX)
      ) {
        return `Entre ${a.name} y ${b.name} hay algo que no se dice. Podría volverse problema.`;
      }
    }
  }
  return null;
}

// Un NPC ha derivado hacia el aislamiento extremo — nadie lo ha notado.
function checkIsolation(alive: NPC[]): string | null {
  const isolated = alive.find(
    (n) => n.axes.sociability < ISOLATION_SOC_MAX && n.axes.warmth < ISOLATION_WARM_MAX,
  );
  if (!isolated) return null;
  return `${isolated.name} se ha apartado del grupo. Nadie lo notó todavía.`;
}

/**
 * El ÚNICO mensaje no solicitado de la entidad. No es una decisión — el estado
 * del mundo la obliga a hablar. Condiciones: miedo colectivo en el roster,
 * tensión cerca de rotura entre dos NPC, o uno que se aparta en silencio. Terso:
 * el jefe debe preguntar para saber más. Devuelve null si no hay nada urgente.
 */
export function rareWhisper(npcs: NPC[]): string | null {
  const alive = npcs.filter((n) => n.isAlive);
  if (alive.length === 0) return null;
  return checkRosterFear(alive) ?? checkConflict(alive) ?? checkIsolation(alive);
}
