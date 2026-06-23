import { NPC, SoulAxes } from './types';
import { Seeder } from './seeder';
import { AXIS_KEYS, readEmergentTraits } from './axes';
import { bandOf } from './stamps';
import { Ripple, ConversationParticipant } from './conversations';

/**
 * MODO DESARROLLO — visor de internos OCULTOS.
 *
 * El juego oculta a propósito: la dificultad (1-1000), los valores crudos de los
 * 14 ejes (el jugador solo ve conducta), las estampas y el CONTENIDO de las
 * conversaciones de fondo (el jugador solo ve ondas vagas). Durante el
 * desarrollo conviene verlos para afinar el balance.
 *
 * Este archivo es un mirador, no parte del motor: nada en el juego depende de él.
 * - Se auto-apaga cuando NODE_ENV === 'production' (DEV_MODE = false).
 * - Para retirarlo del todo antes del lanzamiento oficial: borra este archivo y
 *   la línea `export * from './debug'` en index.ts. No queda nada más que tocar.
 */

const isProd =
  typeof process !== 'undefined' &&
  !!process.env &&
  process.env.NODE_ENV === 'production';

// Visible mientras desarrollas; oculto en el build de producción.
export let DEV_MODE = !isProd;

/** Permite forzar el modo desde código/pruebas (p. ej. simular el lanzamiento). */
export function setDevMode(on: boolean): void {
  DEV_MODE = on;
}

// Etiquetas [polo bajo, polo alto] para leer un valor crudo sin abrir types.ts.
const AXIS_LABELS: Record<keyof SoulAxes, [string, string]> = {
  caution:     ['imprudente', 'cauto'],
  passivity:   ['combativo', 'pasivo'],
  submission:  ['dominante', 'sumiso'],
  warmth:      ['frío', 'cálido'],
  trust:       ['desconfiado', 'confiado'],
  altruism:    ['egoísta', 'altruista'],
  sociability: ['solitario', 'sociable'],
  integrity:   ['acomodaticio', 'íntegro'],
  loyalty:     ['desleal', 'leal'],
  optimism:    ['pesimista', 'optimista'],
  discipline:  ['impulsivo', 'disciplinado'],
  curiosity:   ['cerrado', 'curioso'],
  confidence:  ['inseguro', 'seguro'],
  forgiveness: ['rencoroso', 'indulgente'],
};

function bar(value: number, cells = 10): string {
  const filled = Math.round(value * cells);
  return '█'.repeat(filled) + '░'.repeat(cells - filled);
}

/** Lee un eje crudo: etiqueta del polo dominante + valor + barra + banda. */
function describeAxis(key: keyof SoulAxes, value: number): string {
  const [low, high] = AXIS_LABELS[key];
  const label = value < 0.5 ? low : high;
  return `${label.padEnd(13)} ${value.toFixed(2)} ${bar(value)} banda${bandOf(value)}`;
}

/**
 * Vuelca TODO lo oculto de un NPC en texto legible. Ejes ordenados por cuán
 * definitorios son (distancia al centro), así los rasgos dominantes van arriba.
 * Devuelve '' cuando DEV_MODE está apagado (simula el juego ya lanzado).
 */
export function inspectNPC(npc: NPC): string {
  if (!DEV_MODE) return '';

  const stamps = npc.stamps
    .map((s) => `${s.kind} ${s.axisKey}@${s.bandValue}`)
    .join(', ');
  const emergent = readEmergentTraits(npc.axes);

  const axesSorted = [...AXIS_KEYS].sort(
    (a, b) => Math.abs(npc.axes[b] - 0.5) - Math.abs(npc.axes[a] - 0.5),
  );
  const axesLines = axesSorted
    .map((k) => `     ${describeAxis(k, npc.axes[k])}`)
    .join('\n');

  return [
    `🔧 [DEV] ${npc.name} — ${npc.id}`,
    `   origen     : ${npc.originArchetypeId.padEnd(12)} dificultad: ${npc.difficulty}/1000   ` +
      `estrellas: ${npc.stars}★ (piso ${npc.rosterFloorAtSummon})`,
    `   estampas   : ${stamps}`,
    `   emergente  : ${emergent.length ? emergent.join(', ') : '(ninguno aún)'}`,
    `   ejes (14, de más a menos definitorio):`,
    axesLines,
  ].join('\n');
}

// Temas de charla anclados a los ejes: [temas polo bajo, temas polo alto].
// Solo se usan en DEV_MODE; el juego oficial nunca materializa el contenido.
const CONVO_TOPICS: Partial<Record<keyof SoulAxes, [string[], string[]]>> = {
  warmth: [
    ['lo poco fiable que es la calidez ajena', 'mantener la distancia con cierta gente'],
    ['alguien que les importa', 'un gesto amable que recibieron'],
  ],
  trust: [
    ['una traición que no terminan de soltar', 'a quién conviene vigilar'],
    ['en quién vale la pena apoyarse', 'una confianza recién ganada'],
  ],
  curiosity: [
    ['un rumor que prefieren ignorar', 'por qué no vale la pena preguntar'],
    ['algo que vieron y no logran explicar', 'una puerta que nadie ha abierto'],
  ],
  loyalty: [
    ['a quién conviene seguir ahora', 'qué bando rinde más esta semana'],
    ['un pacto que ninguno piensa romper', 'cubrirse las espaldas mutuamente'],
  ],
  optimism: [
    ['todo lo que puede salir mal', 'la ruina que ven venir'],
    ['un plan que podría salir bien', 'que mañana pinta mejor'],
  ],
  forgiveness: [
    ['una cuenta vieja sin saldar', 'un agravio que aún arde'],
    ['dejar atrás algo viejo', 'tender una mano que costó'],
  ],
  altruism: [
    ['cómo sacar ventaja de la próxima vuelta', 'lo que cada quien puede ganar'],
    ['a quién hay que ayudar primero', 'repartir lo poco que queda'],
  ],
  sociability: [
    ['lo cansados que están de la gente', 'por qué prefieren el rincón'],
    ['quién falta en la próxima reunión', 'armar un encuentro pronto'],
  ],
};

/**
 * Materializa el CONTENIDO de una conversación de fondo — algo que el jugador
 * jamás verá en el juego. El tema se ancla al eje donde AMBOS se inclinan al
 * mismo polo y más lejos del centro (es de lo que dos almas así hablarían). El
 * tono sale de la intensidad de la onda. Determinista vía el seeder dado.
 *
 * Fuera de DEV_MODE devuelve la onda vaga original (lo que ve el jugador).
 */
export function revealConversation(
  a: ConversationParticipant,
  b: ConversationParticipant,
  ripple: Ripple,
  seeder: Seeder,
): string {
  if (!DEV_MODE) return ripple.observable;

  let best: { key: keyof SoulAxes; side: 0 | 1; score: number } | null = null;
  for (const key of Object.keys(CONVO_TOPICS) as (keyof SoulAxes)[]) {
    const va = a.axes[key];
    const vb = b.axes[key];
    const sideA: 0 | 1 = va < 0.5 ? 0 : 1;
    const sideB: 0 | 1 = vb < 0.5 ? 0 : 1;
    if (sideA !== sideB) continue; // solo temas donde ambos coinciden de polo
    const score = Math.abs(va - 0.5) + Math.abs(vb - 0.5);
    if (!best || score > best.score) best = { key, side: sideA, score };
  }

  const topic = best
    ? seeder.branch('topic').nextChoice(CONVO_TOPICS[best.key]![best.side])
    : 'nada que dejara un hilo claro';
  const tone = ripple.intensity > 0.5 ? 'tensa' : 'en voz baja';

  return `[${a.id} ↔ ${b.id}] charla ${tone} sobre ${topic}.`;
}
