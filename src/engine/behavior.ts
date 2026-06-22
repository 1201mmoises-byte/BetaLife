import { SoulAxes } from './types';
import { Seeder } from './seeder';
import { AXIS_KEYS } from './axes';

/**
 * Fase 2 — Los ejes se LEEN como comportamiento.
 *
 * Master rule: la personalidad NUNCA se etiqueta. Se infiere observando.
 * Aquí traducimos los 14 ejes continuos en conductas OBSERVABLES — nunca
 * números, nunca el nombre del eje, nunca una categoría. El jugador lee la
 * conducta y deduce el alma.
 *
 * Cada eje se expresa solo si está lo bastante lejos del centro (0.5). Cuanto
 * más extremo, más pronunciada la conducta (mild → strong). Solo los ejes más
 * expresivos se muestran, para que el personaje "lea" como sus rasgos
 * dominantes y no como un muro de texto.
 */

interface PoleCues {
  mild: string[];   // shown when |v-0.5| ∈ [0.15, 0.30)
  strong: string[]; // shown when |v-0.5| ≥ 0.30
}

interface AxisCue {
  axis: keyof SoulAxes;
  low: PoleCues;  // value < 0.5
  high: PoleCues; // value ≥ 0.5
}

// Expressiveness thresholds (distance from center)
const T_MILD = 0.15;
const T_STRONG = 0.30;

const AXIS_CUES: AxisCue[] = [
  {
    axis: 'caution',
    low: {
      mild: ['A veces cruza un umbral sin mirar lo que hay detrás.'],
      strong: ['Entra a cualquier lugar sin revisar las salidas.', 'Se lanza antes de medir la caída.'],
    },
    high: {
      mild: ['Hace una pausa breve antes de avanzar.'],
      strong: ['Escanea la sala antes de cruzar cualquier umbral.', 'Tantea cada paso como si el suelo pudiera ceder.'],
    },
  },
  {
    axis: 'passivity',
    low: {
      mild: ['Responde rápido cuando algo lo desafía.'],
      strong: ['Da el primer golpe en cuanto huele tensión.', 'Avanza hacia el conflicto en vez de rodearlo.'],
    },
    high: {
      mild: ['Deja que otros tomen la iniciativa.'],
      strong: ['Espera a que la tormenta pase antes de moverse.', 'Cede el paso aunque tenga la razón.'],
    },
  },
  {
    axis: 'submission',
    low: {
      mild: ['Reacomoda al grupo a su alrededor sin pedir permiso.'],
      strong: ['Habla último y todos esperan a que termine.', 'Ocupa el centro de la sala como si le correspondiera.'],
    },
    high: {
      mild: ['Busca aprobación con la mirada antes de actuar.'],
      strong: ['Baja la voz cuando alguien con más peso entra.', 'Acomoda sus planes a los de cualquiera que insista.'],
    },
  },
  {
    axis: 'warmth',
    low: {
      mild: ['Rara vez sostiene el contacto visual.'],
      strong: ['Trata a los demás como obstáculos o herramientas.', 'Su saludo es un trámite, no un gesto.'],
    },
    high: {
      mild: ['Sus ojos encuentran a los demás con facilidad.'],
      strong: ['Recuerda detalles pequeños de quienes acaba de conocer.', 'Toca el hombro del que pasa a su lado.'],
    },
  },
  {
    axis: 'trust',
    low: {
      mild: ['Tarda en aceptar lo que le ofrecen.'],
      strong: ['Cuenta las monedas dos veces aunque se las dé un amigo.', 'Busca el motivo oculto detrás de cada favor.'],
    },
    high: {
      mild: ['Acepta la palabra de otros sin mucho rodeo.'],
      strong: ['Entrega su espalda a quien apenas conoce.', 'Cree primero y comprueba después, si acaso.'],
    },
  },
  {
    axis: 'altruism',
    low: {
      mild: ['Calcula lo que gana antes de mover un dedo.'],
      strong: ['Toma su parte primero y la de nadie más le importa.', 'Pasa de largo ante quien necesita ayuda.'],
    },
    high: {
      mild: ['Comparte sin que se lo pidan.'],
      strong: ['Cede su ración al que tiene menos.', 'Se interpone cuando alguien más va a salir herido.'],
    },
  },
  {
    axis: 'sociability',
    low: {
      mild: ['Prefiere los bordes de la plaza a su centro.'],
      strong: ['Desaparece de las reuniones sin que nadie lo note.', 'Busca el rincón más lejano de cualquier multitud.'],
    },
    high: {
      mild: ['Se mueve hacia el grupo, no lejos de él.'],
      strong: ['Hila conversación con cualquiera que se cruce.', 'Se marchita cuando pasa demasiado tiempo solo.'],
    },
  },
  {
    axis: 'integrity',
    low: {
      mild: ['Acomoda la verdad según le convenga.'],
      strong: ['Promete con facilidad y olvida con la misma.', 'Toma el atajo aunque sepa que no le toca.'],
    },
    high: {
      mild: ['Cumple lo que dice incluso cuando estorba.'],
      strong: ['Devuelve de más antes que quedarse con lo ajeno.', 'Sostiene su palabra aunque le cueste caro.'],
    },
  },
  {
    axis: 'loyalty',
    low: {
      mild: ['Cambia de bando si el viento cambia.'],
      strong: ['Abandona al aliado en cuanto deja de servirle.', 'Mide cada lealtad por lo que rinde hoy.'],
    },
    high: {
      mild: ['Defiende a los suyos incluso ausentes.'],
      strong: ['Se queda junto al que cae aunque ardan los puentes.', 'No traiciona ni cuando traicionarlo sería sensato.'],
    },
  },
  {
    axis: 'optimism',
    low: {
      mild: ['Espera lo peor de cada plan.'],
      strong: ['Cuenta las formas en que algo puede salir mal.', 'Ve la ruina antes que la oportunidad.'],
    },
    high: {
      mild: ['Encuentra un resquicio de luz en lo torcido.'],
      strong: ['Da por hecho que mañana irá mejor.', 'Se levanta de cada golpe como si esperara el siguiente con ganas.'],
    },
  },
  {
    axis: 'discipline',
    low: {
      mild: ['Rara vez termina lo que empieza en el orden que planeó.'],
      strong: ['Salta de un impulso a otro sin acabar ninguno.', 'Rompe su propia rutina al primer antojo.'],
    },
    high: {
      mild: ['Mantiene su horario sin que nadie se lo pida.'],
      strong: ['Repite el mismo gesto mil veces hasta que sale perfecto.', 'No cede al antojo aunque nadie lo esté mirando.'],
    },
  },
  {
    axis: 'curiosity',
    low: {
      mild: ['Deja sin abrir lo que no le concierne.'],
      strong: ['Aparta la mirada de lo desconocido.', 'Prefiere lo de siempre a cualquier puerta nueva.'],
    },
    high: {
      mild: ['Pregunta una vez más de lo que haría falta.'],
      strong: ['Abre cada caja solo para ver qué guarda.', 'Sigue el ruido extraño en vez de alejarse de él.'],
    },
  },
  {
    axis: 'confidence',
    low: {
      mild: ['Hace pausas largas antes de opinar en grupo.'],
      strong: ['Retira lo que dijo en cuanto alguien frunce el ceño.', 'Pide perdón por ocupar espacio.'],
    },
    high: {
      mild: ['Sostiene su postura sin buscar respaldo.'],
      strong: ['Habla como si sus palabras ya hubieran sido aprobadas.', 'No se inmuta cuando la sala entera lo contradice.'],
    },
  },
  {
    axis: 'forgiveness',
    low: {
      mild: ['Guarda los desaires más de la cuenta.'],
      strong: ['Lleva la cuenta de cada agravio sin olvidar uno.', 'Devuelve el golpe aunque tarde años en hacerlo.'],
    },
    high: {
      mild: ['Suelta las ofensas pequeñas con un encogimiento.'],
      strong: ['Tiende la mano al que ayer lo hirió.', 'Olvida la deuda antes de que pese.'],
    },
  },
];

interface ScoredCue {
  axis: keyof SoulAxes;
  dist: number;
  pole: PoleCues;
}

function scoreAxes(axes: SoulAxes): ScoredCue[] {
  const byAxis = new Map(AXIS_CUES.map((c) => [c.axis, c]));
  return AXIS_KEYS
    .map((axis) => {
      const cue = byAxis.get(axis)!;
      const v = axes[axis];
      const dist = Math.abs(v - 0.5);
      const pole = v < 0.5 ? cue.low : cue.high;
      return { axis, dist, pole };
    })
    .filter((s) => s.dist >= T_MILD)
    .sort((a, b) => b.dist - a.dist);
}

/**
 * Reads the axes as observable behavior. Returns up to `maxCues` lines, drawn
 * from the most expressive axes, with intensity-aware phrasing and seeded
 * variation so similar souls don't read word-for-word identical.
 */
export function readBehavior(seeder: Seeder, axes: SoulAxes, maxCues = 3): string[] {
  const top = scoreAxes(axes).slice(0, maxCues);
  return top.map((s) => {
    const tier = s.dist >= T_STRONG ? s.pole.strong : s.pole.mild;
    return seeder.branch('behavior').branch(s.axis).nextChoice(tier);
  });
}

/**
 * Short first impression for the roster glance — the 1-2 strongest cues.
 * Falls back to a neutral line when no axis is expressive enough.
 */
export function firstImpression(seeder: Seeder, axes: SoulAxes): string {
  const cues = readBehavior(seeder, axes, 2);
  if (cues.length === 0) return 'No hay nada inmediatamente llamativo en cómo se mueve.';
  return cues.join(' ');
}
