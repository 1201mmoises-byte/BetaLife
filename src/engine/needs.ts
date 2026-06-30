import { SoulAxes } from './types';
import { Seeder } from './seeder';

/**
 * Necesidades vitales — sistema de 4 medidores (Blueprint §4).
 *
 * HAMBRE   — 1=saciado; puede ir a −0.30 (debilidad < 0.30; crítico < 0).
 * DESCANSO — 1=descansado; puede ir a −0.30. Independiente del hambre.
 * ENERGÍA  — modificador NO letal. Principal: entreno/movimiento. A ≤0.30
 *            hambre+descanso drenan al doble; a ≤0 el agotamiento duplica/triplica.
 * SALUD    — HP real (0..1). ÚNICA visible al jugador (% con bandas de color).
 *            La mueve sobre todo el daño directo (combate). Las otras la erosionan
 *            poco a poco. MUERTE cuando HP = 0.
 *
 * PURE + determinista. La UI conecta HP=0 al permadeath.
 */

export interface Needs {
  hambre:   number;  // 1=saciado,    puede llegar a −0.30
  descanso: number;  // 1=descansado, puede llegar a −0.30
  energia:  number;  // modificador,  puede ser negativo; NUNCA mata
  health:   number;  // HP 0..1 — MUERTE en 0
}

/** Lo que el héroe está haciendo en este tick. */
export type Activity = 'idle' | 'rest' | 'eat' | 'work' | 'train' | 'fight';

/** Causa de muerte (solo la salud puede causar muerte directa). */
export type Vital = 'collapse';

// ── Tasas base por tick ────────────────────────────────────────────────────
// A 5 s/tick en el pueblo (10×): hambre en ~3.5 días de juego (idle).
const HAMBRE_DECAY       = 0.012;
const DESCANSO_DECAY     = 0.010;
const ENERGIA_DECAY      = 0.008;
const EAT_RECOVER        = 0.14;
const REST_RECOVER       = 0.05;
const ENERGIA_RECOVER    = 0.06;
const HEALTH_REGEN       = 0.003;  // regenera con condición buena (lento)
const HEALTH_DRAIN_DEBIL = 0.002;  // drena en debilidad (muy lento)
const HEALTH_DRAIN_CRIT  = 0.015;  // drena rápido con hambre/descanso < 0
export const DEBILIDAD   = 0.30;   // umbral de debilidad (< 30%)

const clampH  = (v: number) => Math.max(-0.30, Math.min(1, v)); // hambre/descanso
const clampE  = (v: number) => Math.max(-1,    Math.min(1, v)); // energía
const clamp01 = (v: number) => Math.max(0,     Math.min(1, v)); // health
const round4  = (v: number) => parseFloat(v.toFixed(4));

const round = (n: Needs): Needs => ({
  hambre:   round4(n.hambre),
  descanso: round4(n.descanso),
  energia:  round4(n.energia),
  health:   round4(n.health),
});

function effortOf(a: Activity): number {
  return a === 'fight' ? 2.6 : a === 'train' ? 2.0 : a === 'work' ? 1.4 : 1.0;
}
function appetiteOf(a: Activity): number {
  return a === 'fight' || a === 'train' ? 1.4 : a === 'work' ? 1.2 : 1.0;
}

/** Necesidades iniciales: casi llenas, leve variación por seed/alma. */
export function createNeeds(seeder: Seeder, axes: SoulAxes): Needs {
  const s = seeder.branch('needs');
  const j = () => 0.82 + s.nextFloat() * 0.18;
  const resil = axes.discipline;
  return round({
    hambre:   clamp01(0.65 * j() + 0.25),
    descanso: clamp01(0.65 * j() + 0.25 + (resil - 0.5) * 0.1),
    energia:  clamp01(0.70 * j() + 0.20),
    health:   clamp01(0.85 + s.nextFloat() * 0.15),
  });
}

function step(n: Needs, axes: SoulAxes, activity: Activity): Needs {
  const resil    = axes.discipline;
  const drainMul = 1.2 - resil * 0.4;
  const recovMul = 0.8 + resil * 0.4;

  // ── Energía (modificador, no letal) ──────────────────────────────────────
  let energia = n.energia;
  if (activity === 'rest') {
    energia += ENERGIA_RECOVER * recovMul;
  } else {
    energia -= ENERGIA_DECAY * drainMul * effortOf(activity);
  }
  energia = clampE(energia);

  // Multiplicador de drain cuando la energía está baja:
  // ≤ 0.30 → hambre/descanso al doble; ≤ 0 → 2x…3x según cuán abajo
  const energiaMul = energia <= 0
    ? 2 + Math.min(1, -energia)
    : energia <= DEBILIDAD
    ? 2
    : 1;

  // ── Hambre ───────────────────────────────────────────────────────────────
  let hambre = n.hambre;
  if (activity === 'eat') {
    hambre += EAT_RECOVER * recovMul;
  } else {
    hambre -= HAMBRE_DECAY * drainMul * appetiteOf(activity) * energiaMul;
  }
  hambre = clampH(hambre);

  // ── Descanso ─────────────────────────────────────────────────────────────
  let descanso = n.descanso;
  if (activity === 'rest') {
    descanso += REST_RECOVER * recovMul;
  } else {
    descanso -= DESCANSO_DECAY * drainMul * effortOf(activity) * energiaMul;
  }
  descanso = clampH(descanso);

  // ── Salud / HP ───────────────────────────────────────────────────────────
  let health = n.health;
  const hambreDebil   = hambre   < DEBILIDAD && hambre   >= 0;
  const descansoDebil = descanso < DEBILIDAD && descanso >= 0;
  const hambreCrit    = hambre   < 0;
  const descansoCrit  = descanso < 0;

  if (hambreCrit || descansoCrit) {
    const deficit = (hambreCrit ? -hambre : 0) + (descansoCrit ? -descanso : 0);
    health -= HEALTH_DRAIN_CRIT * (0.5 + deficit);
  } else if (hambreDebil || descansoDebil) {
    health -= HEALTH_DRAIN_DEBIL;
  } else if (hambre > 0.5 && descanso > 0.5) {
    health += HEALTH_REGEN * recovMul;
  }
  health = clamp01(health);

  return { hambre, descanso, energia, health };
}

/** Avanza `ticks` ticks de la misma actividad. Devuelve copia nueva. */
export function tickNeeds(needs: Needs, axes: SoulAxes, activity: Activity, ticks = 1): Needs {
  let n = needs;
  for (let i = 0; i < ticks; i++) n = step(n, axes, activity);
  return round(n);
}

/** Lectura OBSERVABLE (sin números) — para la Hada y el dev panel. */
export function needsStatus(n: Needs): string[] {
  const out: string[] = [];
  if (n.descanso < 0)            out.push('al borde del colapso por agotamiento extremo');
  else if (n.descanso < DEBILIDAD) out.push('se le ve agotado, arrastra los pies');
  else if (n.descanso < 0.5)     out.push('anda algo cansado');
  if (n.hambre < 0)              out.push('se muere de hambre, en estado crítico');
  else if (n.hambre < DEBILIDAD)   out.push('está hambriento, le falla el cuerpo');
  else if (n.hambre < 0.5)       out.push('le vendría bien comer');
  if (n.energia <= 0)            out.push('agotado sin fuerza para nada');
  else if (n.energia < DEBILIDAD)  out.push('sin energía');
  if (n.health < 0.10)           out.push('al límite — podría caer en cualquier momento');
  else if (n.health < DEBILIDAD)   out.push('se le ve débil, como enfermo');
  if (out.length === 0)          out.push('se le ve entero');
  return out;
}

/** Qué medidores están en debilidad. */
export function debilidadStatus(n: Needs): { hambre: boolean; descanso: boolean; salud: boolean } {
  return {
    hambre:   n.hambre   < DEBILIDAD,
    descanso: n.descanso < DEBILIDAD,
    salud:    n.health   < DEBILIDAD,
  };
}

/** Devuelve 'collapse' si HP = 0 (única causa de muerte). */
export function criticalNeed(n: Needs): Vital | null {
  return n.health <= 0 ? 'collapse' : null;
}
