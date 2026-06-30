import { SoulAxes, Stamp, NPC } from './types';

/**
 * RPG — Capa de HABILIDADES.
 *
 * Las habilidades no se "equipan" ni se compran: EMERGEN del alma. Un NPC
 * suficientemente seguro intimida; uno altruista protege; uno disciplinado
 * remata con técnica. Esto mantiene la coherencia alma↔conducta del proyecto:
 * el jugador no elige el kit, lo *descubre* observando a quién invocó.
 *
 * Dos fuentes:
 *   1. Umbrales de ejes (estado actual del alma) — pueden aparecer y
 *      desaparecer si los ejes se mueven con la experiencia.
 *   2. Growth stamps (capítulos SELLADOS) — desbloqueos PERMANENTES. Una vez
 *      sellada la banda alta de un eje, la maestría queda aunque el eje recaiga.
 *
 * `observation` es lo único que el jugador llega a ver (vía la entidad): nunca
 * números, nunca el nombre del eje. `power` y `kind` son mecánica interna que
 * el motor de combate usa y la entidad oculta.
 */

export type SkillKind = 'offensive' | 'defensive' | 'support' | 'passive';

export interface Skill {
  id: string;
  name: string;          // nombre mostrable (es)
  kind: SkillKind;
  observation: string;   // conducta observable — sin números, sin ejes
  power: number;         // 0..1 — el combate lo escala por los stats (interno)
  source: 'axis' | 'stamp';
}

interface AxisSkillDef {
  id: string;
  name: string;
  kind: SkillKind;
  observation: string;
  power: number;
  /** Condición sobre el alma actual. */
  when: (a: SoulAxes) => boolean;
}

// Catálogo por umbrales de ejes (del handoff, afinable).
const AXIS_SKILLS: AxisSkillDef[] = [
  {
    id: 'intimidar', name: 'Intimidar', kind: 'offensive', power: 0.55,
    observation: 'Se planta de frente y obliga a la amenaza a fijarse en él.',
    when: (a) => a.confidence > 0.75,
  },
  {
    id: 'proteger', name: 'Proteger', kind: 'defensive', power: 0.6,
    observation: 'Se interpone para que el golpe lo reciba él y no su aliado.',
    when: (a) => a.altruism > 0.7,
  },
  {
    id: 'explorar', name: 'Explorar', kind: 'support', power: 0.4,
    observation: 'Lee el terreno antes que nadie y señala lo que otros no ven.',
    when: (a) => a.curiosity > 0.7,
  },
  {
    id: 'tecnica-perfecta', name: 'Técnica perfecta', kind: 'passive', power: 0.5,
    observation: 'Cada movimiento repite al anterior, sin un gesto de más.',
    when: (a) => a.discipline > 0.75,
  },
  {
    id: 'galvanizar', name: 'Galvanizar', kind: 'support', power: 0.5,
    observation: 'Su sola presencia levanta el ánimo de quienes pelean a su lado.',
    when: (a) => a.warmth > 0.75,
  },
  {
    id: 'escudo-lealtad', name: 'Escudo de lealtad', kind: 'defensive', power: 0.65,
    observation: 'Se vuelve inquebrantable cuando cubre a alguien de los suyos.',
    when: (a) => a.loyalty > 0.75,
  },
  {
    id: 'rencor-acumulado', name: 'Rencor acumulado', kind: 'offensive', power: 0.7,
    observation: 'Golpea más fuerte a quien ya lo hirió antes; no olvida una herida.',
    when: (a) => a.forgiveness < 0.25,
  },
];

// Ejes cuya banda alta sellada (growth stamp en 0.75 o 1.0) ancla una maestría
// PERMANENTE. Espejo de algunos AXIS_SKILLS, pero el stamp los vuelve fijos.
const STAMP_MASTERIES: Partial<Record<keyof SoulAxes, { id: string; name: string; kind: SkillKind; observation: string; power: number }>> = {
  discipline: { id: 'maestria-tecnica', name: 'Maestría: técnica sellada', kind: 'passive', power: 0.65,
    observation: 'Hay una calma de oficio en cómo se mueve, ganada y ya imborrable.' },
  confidence: { id: 'maestria-aplomo', name: 'Maestría: aplomo sellado', kind: 'offensive', power: 0.7,
    observation: 'Ya no duda al avanzar; lo aprendió a golpes y se le quedó.' },
  altruism:   { id: 'maestria-guardian', name: 'Maestría: guardián sellado', kind: 'defensive', power: 0.75,
    observation: 'Cubrir a otro le sale antes que pensar; es parte de quién es ahora.' },
  curiosity:  { id: 'maestria-rastreador', name: 'Maestría: rastreador sellado', kind: 'support', power: 0.6,
    observation: 'Nada del entorno se le escapa; ese ojo ya no se apaga.' },
};

const HIGH_BANDS = [0.75, 1.0];

/**
 * Deriva el kit de habilidades de un NPC: emergentes por ejes + maestrías
 * permanentes selladas por growth stamps. Determinista, pura, sin duplicados.
 */
export function deriveSkills(npc: Pick<NPC, 'axes' | 'stamps'>): Skill[] {
  const out: Skill[] = [];
  const seen = new Set<string>();

  for (const def of AXIS_SKILLS) {
    if (def.when(npc.axes)) {
      out.push({ id: def.id, name: def.name, kind: def.kind, observation: def.observation, power: def.power, source: 'axis' });
      seen.add(def.id);
    }
  }

  for (const stamp of npc.stamps) {
    if (stamp.kind !== 'growth') continue;
    if (!HIGH_BANDS.includes(stamp.bandValue)) continue;
    const m = STAMP_MASTERIES[stamp.axisKey];
    if (m && !seen.has(m.id)) {
      out.push({ id: m.id, name: m.name, kind: m.kind, observation: m.observation, power: m.power, source: 'stamp' });
      seen.add(m.id);
    }
  }

  return out;
}

/** Mejor habilidad ofensiva disponible (la de mayor power), si existe. */
export function bestOffensive(skills: Skill[]): Skill | null {
  return skills.filter((s) => s.kind === 'offensive')
    .reduce<Skill | null>((best, s) => (!best || s.power > best.power ? s : best), null);
}

/** Mejor habilidad defensiva/protectora disponible, si existe. */
export function bestDefensive(skills: Skill[]): Skill | null {
  return skills.filter((s) => s.kind === 'defensive')
    .reduce<Skill | null>((best, s) => (!best || s.power > best.power ? s : best), null);
}
