import { NPC, SoulAxes } from './types';
import { AXIS_KEYS, readEmergentTraits } from './axes';
import { bandOf } from './stamps';
import { Exchange, ConversationTopic, AxisNudges } from './conversations';

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

// Contenido llano de una charla por tema — SOLO para el desarrollador. En el
// juego el jugador no ve nada de esto; se entera por la entidad si pregunta.
const TOPIC_REVEAL: Record<ConversationTopic, string> = {
  training: 'comparan técnicas y lo aprendido en los pisos',
  survival: 'calculan riesgos y cómo seguir vivos',
  social:   'algo personal — alguien del pueblo, un vínculo',
  hobby:    'un pasatiempo en común, sin urgencia',
  casual:   'cháchara sin agenda, solo acompañarse',
};

function formatNudges(n: AxisNudges): string {
  const entries = Object.entries(n).filter(([, v]) => v);
  if (entries.length === 0) return '—';
  return entries
    .map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${(v as number).toFixed(3)}`)
    .join(', ');
}

/**
 * Inspecciona una charla silenciosa (Exchange) — tema y nudges crudos a cada
 * participante. SOLO para desarrollo: en el juego nadie ve esto. Devuelve ''
 * cuando DEV_MODE está apagado.
 */
export function revealExchange(ex: Exchange, nameOf?: (id: string) => string): string {
  if (!DEV_MODE) return '';
  const a = nameOf ? nameOf(ex.participants[0]) : ex.participants[0];
  const b = nameOf ? nameOf(ex.participants[1]) : ex.participants[1];
  return (
    `[${a} ↔ ${b}] ${ex.topic} — ${TOPIC_REVEAL[ex.topic]} (intensidad ${ex.intensity}).\n` +
    `    nudges ${a}: ${formatNudges(ex.nudges.a)}\n` +
    `    nudges ${b}: ${formatNudges(ex.nudges.b)}`
  );
}
