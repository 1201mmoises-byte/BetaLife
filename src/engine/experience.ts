import { SoulAxes, Stamp, StarRating } from './types';
import { Seeder } from './seeder';
import { softCeiling, sealIfBandCrossed } from './stamps';

/**
 * Fase 4 — Ejes empiezan a moverse.
 *
 * "Desarrollo por exposición filtrado por personalidad": el jugador SIEMBRA
 * (decide a qué expone al NPC); el NPC traduce esa experiencia filtrada por
 * sus ejes actuales. Misma exposición → resultados distintos según el alma.
 *
 * PURE: applyExperience devuelve copias, nunca muta nada. El caller decide
 * cuándo persistir. Determinista vía el seeder provisto.
 *
 * Fase 5 expandirá el catálogo de eventos y filtros. En Fase 4 solo operan
 * combat, scout y rest (este último sin movimiento por ahora).
 */

export type EventKind = 'combat' | 'scout' | 'rest';
export type EventOutcome = 'success' | 'failure' | 'partial';

export interface ExperienceEvent {
  kind: EventKind;
  intensity: number;     // 0..1 — cuán intensa fue la experiencia
  outcome: EventOutcome;
}

export interface ExperienceResult {
  axes: SoulAxes;        // ejes actualizados (copia nueva)
  newStamps: Stamp[];    // growth stamps sellados en este evento (puede ser [])
}

const BASE_DELTA = 0.04; // movimiento base antes de filtros y techo suave

/**
 * SCAFFOLD — gancho estrellas → facilidad de progreso. NO se usa todavía.
 *
 * Diseño: las estrellas son el modificador POR-NPC de qué tan fácil/rápido
 * progresa un personaje (la dificultad es del pueblo, no del NPC). Más estrellas
 * = mayor multiplicador. Esta función queda CREADA y lista para cuando exista el
 * sistema de stats/niveles/habilidades; hoy NO se conecta a `applyExperience` ni
 * a ningún cálculo, porque aún no hay reglas de progreso que mover.
 *
 * Curva suave anclada por diseño (ajustable cuando se integre):
 *   1★→1.00  2★→1.15  3★→1.30  4★→1.45  5★→1.60
 */
export function starProgressionMultiplier(stars: StarRating): number {
  return 1 + (stars - 1) * 0.15;
}

// El eje que sella el birthStamp es el más estable de un alma — resiste cambio.
const BIRTH_AXIS_RESISTANCE = 0.6; // ×0.6 del delta al eje firma de origen

/** Extrae el eje que selló el birthStamp de un NPC (stamps[0]). */
function birthAxis(stamps: Stamp[]): keyof SoulAxes | null {
  const birth = stamps.find((s) => s.kind === 'birth');
  return birth ? birth.axisKey : null;
}

/**
 * Factor de resistencia: el eje del birthStamp recibe menos movimiento.
 * Los demás ejes reciben el delta completo.
 */
function resistanceFactor(axisKey: keyof SoulAxes, stamps: Stamp[]): number {
  return axisKey === birthAxis(stamps) ? BIRTH_AXIS_RESISTANCE : 1.0;
}

/**
 * Mueve un eje aplicando el techo suave y sella una growth stamp si se cruza
 * una banda. Devuelve el nuevo valor y la estampa (o null).
 */
function moveAxis(
  axisKey: keyof SoulAxes,
  axes: SoulAxes,
  stamps: Stamp[],
  rawDelta: number,
): { newValue: number; stamp: Stamp | null } {
  const delta = rawDelta * resistanceFactor(axisKey, stamps);
  const oldValue = axes[axisKey];
  const newValue = parseFloat(softCeiling(oldValue, delta).toFixed(4));
  const stamp = sealIfBandCrossed(axisKey, oldValue, newValue);
  return { newValue, stamp };
}

/**
 * Aplica una experiencia a los ejes. Devuelve los ejes actualizados y cualquier
 * growth stamp sellado. El seeder asegura variación determinista por tick.
 */
export function applyExperience(
  seeder: Seeder,
  axes: SoulAxes,
  stamps: Stamp[],
  event: ExperienceEvent,
): ExperienceResult {
  const updated = { ...axes };
  const newStamps: Stamp[] = [];
  const es = seeder.branch('experience');

  // Pequeña variación aleatoria en la intensidad efectiva (±15%) para evitar
  // que eventos idénticos produzcan exactamente el mismo delta — los NPCs no
  // aprenden en pasos perfectamente uniformes.
  const jitter = 0.85 + es.nextFloat() * 0.30;
  const intensity = Math.min(1, event.intensity * jitter);
  const delta = BASE_DELTA * intensity;

  function apply(axisKey: keyof SoulAxes, rawDelta: number) {
    const { newValue, stamp } = moveAxis(axisKey, updated, stamps, rawDelta);
    updated[axisKey] = newValue;
    if (stamp) newStamps.push(stamp);
  }

  if (event.kind === 'combat') {
    const sign = event.outcome === 'failure' ? -1 : 1;
    const magnitude = event.outcome === 'partial' ? 0.5 : 1.0;

    // Confianza: sube en éxito, baja en fracaso.
    // Filtro: cuanto más baja la confianza base, mayor la ganancia relativa.
    const confFilter = 1.0 + (0.5 - axes.confidence) * 0.8;
    apply('confidence', sign * delta * magnitude * confFilter);

    // Pasividad baja en éxito (el combate activa al NPC); sube levemente en fracaso.
    // Filtro: NPCs más pasivos (alta pasividad) responden más.
    const passFilter = 0.5 + axes.passivity * 0.8;
    apply('passivity', -sign * delta * magnitude * 0.6 * passFilter);

    // Cautela: en fracaso siempre sube (aprender del golpe); en éxito se acerca
    // al centro (el eje se regula — ni muy imprudente ni paralizado por miedo).
    if (event.outcome === 'failure') {
      apply('caution', delta * 0.5);
    } else {
      // Acercar al centro: si caution < 0.5 sube; si > 0.5 baja.
      apply('caution', (0.5 - axes.caution) * delta * 0.3);
    }

  } else if (event.kind === 'scout') {
    const sign = event.outcome === 'failure' ? -1 : 1;

    // Curiosidad crece con exploración exitosa.
    // Filtro: disciplina alta amplifica el aprendizaje (observación metódica).
    const discFilter = 0.7 + axes.discipline * 0.6;
    apply('curiosity', sign * delta * discFilter);

    // Cautela baja levemente con la exposición (el miedo a lo desconocido cede).
    // Solo en éxito — en fracaso la cautela se refuerza.
    if (event.outcome === 'success') {
      apply('caution', -delta * 0.3);
    } else if (event.outcome === 'failure') {
      apply('caution', delta * 0.3);
    }

  }
  // 'rest': sin movimiento de ejes en Fase 4. Fase 5 lo expande
  // (recuperación de confianza, optimismo, etc.)

  return { axes: updated, newStamps };
}

/**
 * Aplica los nudges de una charla de fondo (conversations.ts) a un participante.
 * Reutiliza moveAxis, así que el acento de origen resiste y el techo suave actúa
 * igual que en applyExperience. No recibe seeder: los nudges ya vienen calculados
 * en el Exchange (la charla decidió su efecto al ocurrir). Puro: devuelve copias.
 */
export function applyConversationNudges(
  axes: SoulAxes,
  stamps: Stamp[],
  nudges: Partial<Record<keyof SoulAxes, number>>,
): ExperienceResult {
  const updated = { ...axes };
  const newStamps: Stamp[] = [];
  for (const [key, delta] of Object.entries(nudges) as [keyof SoulAxes, number][]) {
    if (!delta) continue;
    const { newValue, stamp } = moveAxis(key, updated, stamps, delta);
    updated[key] = newValue;
    if (stamp) newStamps.push(stamp);
  }
  return { axes: updated, newStamps };
}
