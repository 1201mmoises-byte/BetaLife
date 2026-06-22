import { SoulAxes } from './types';
import { Seeder } from './seeder';

/**
 * An origin archetype is the ROOT of a soul (master rule:
 * historia → ejes ponderados → estampa). It biases 2-3 "signature" axes
 * into weighted ranges and seals the birth stamp on its primary axis.
 * The remaining axes stay free, preserving mathematical uniqueness.
 */
export interface OriginArchetype {
  id: string;
  weight: number; // selection weight from seed (tunable)
  // Signature axes constrained to a biased [min, max] range (not a fixed value)
  signature: Partial<Record<keyof SoulAxes, [number, number]>>;
  // Axis the birth stamp seals. Omitted for "difuso" → stamp falls on extreme.
  primaryAxis?: keyof SoulAxes;
  // Narrative origin fragments (composed with a star-context line elsewhere)
  fragments: string[];
}

// Ranges are aligned to readEmergentTraits() thresholds (axes.ts) so the
// matching emergent reading fires reliably — but not always, because the OTHER
// axes in each emergent's AND-condition still vary. That variance is desired:
// origin biases personality, it does not deterministically label it.
export const ARCHETYPES: OriginArchetype[] = [
  {
    id: 'honor',
    weight: 1.0,
    signature: {
      integrity: [0.72, 0.93],
      loyalty:   [0.72, 0.95],
      altruism:  [0.62, 0.88],
    },
    primaryAxis: 'integrity',
    fragments: [
      'Creció en una familia que ponía el honor por encima de la supervivencia.',
      'Aprendió desde joven que romper una promesa era peor que morir.',
      'Su linaje cargó vergüenzas ajenas durante generaciones; juró no añadir más.',
    ],
  },
  {
    id: 'imprudente',
    weight: 1.0,
    signature: {
      caution:    [0.05, 0.28],
      discipline: [0.05, 0.33],
      passivity:  [0.05, 0.35],
    },
    primaryAxis: 'caution',
    fragments: [
      'Nunca terminó nada que empezó, pero eso nunca le frenó de intentarlo.',
      'Fue expulsado de tres gremios por insubordinación, y está orgulloso de ello.',
      'Sus cicatrices cuentan historias que su memoria ya no puede.',
    ],
  },
  {
    id: 'calido',
    weight: 1.0,
    signature: {
      warmth:      [0.76, 0.96],
      altruism:    [0.66, 0.90],
      sociability: [0.55, 0.90],
    },
    primaryAxis: 'warmth',
    fragments: [
      'Recogió a mendigos en invierno cuando nadie más lo hacía.',
      'Su puerta nunca estuvo cerrada para los que llegaban con hambre.',
      'Perdió su fortuna ayudando a extraños; nunca lo lamentó del todo.',
    ],
  },
  {
    id: 'rencoroso',
    weight: 1.0,
    signature: {
      trust:       [0.05, 0.24],
      forgiveness: [0.05, 0.29],
      warmth:      [0.10, 0.45],
    },
    primaryAxis: 'trust',
    fragments: [
      'Alguien a quien amaba lo traicionó. No olvidó. No perdonó.',
      'Aprendió que la confianza es un lujo que los ingenuos pagan caro.',
      'Guarda cada deuda como monedas en un bolso que nunca vacía.',
    ],
  },
  {
    id: 'erudito',
    weight: 1.0,
    signature: {
      curiosity:  [0.76, 0.97],
      discipline: [0.62, 0.90],
      caution:    [0.55, 0.85],
    },
    primaryAxis: 'curiosity',
    fragments: [
      'Llenó cuadernos enteros antes de cumplir doce años.',
      'Viajó a lugares donde el mapa terminaba solo para ver qué había más allá.',
      'Su maestro dijo que sabía demasiado para su propio bien. Tenía razón.',
    ],
  },
  {
    id: 'difuso',
    weight: 1.5, // slightly more common: many souls carry no defining origin
    signature: {},
    // no primaryAxis → birth stamp seals whichever axis emerged most extreme
    fragments: [
      'Su pasado es difuso, como arena que el viento remodela continuamente.',
      'No habla de dónde vino. Nadie ha insistido lo suficiente.',
      'Llegó al pueblo sin más pertenencias que lo puesto y una historia a medias.',
    ],
  },
];

/**
 * Picks an origin archetype from the seed via its own RNG branch, so adding
 * this stream does not perturb the determinism of axes/name/history/etc.
 */
export function pickArchetype(seeder: Seeder): OriginArchetype {
  const as = seeder.branch('archetype');
  const total = ARCHETYPES.reduce((sum, a) => sum + a.weight, 0);
  let roll = as.nextFloat(0, total);
  for (const a of ARCHETYPES) {
    roll -= a.weight;
    if (roll < 0) return a;
  }
  return ARCHETYPES[ARCHETYPES.length - 1];
}
