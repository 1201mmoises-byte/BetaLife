import { SoulAxes } from './types';
import { Seeder } from './seeder';

/**
 * Necesidades vitales — base para Fase 2/3 (capa de supervivencia, estilo Sims).
 *
 * Lo esencial para vivir: SACIEDAD (hambre), ENERGÍA (agotamiento) y SALUD.
 * Convención: floats 0..1 donde 1 = bien (saciado / descansado / sano) y 0 = al
 * límite (hambriento / agotado / al borde). Igual que los ejes, NUNCA se muestran
 * como números al jugador — `needsStatus` los traduce a conducta observable.
 *
 * PURE + determinista: `tickNeeds` devuelve copias y depende solo de sus entradas
 * (estado + ejes + actividad), sin azar; `createNeeds` usa el seeder para una
 * variación inicial reproducible. El motor no se conecta a nada todavía — es la
 * base lista para cuando la capa RPG (Torre, combate, fatiga, Arena) la consuma.
 *
 * Conexión con el alma: la DISCIPLINA modula el ritmo (los disciplinados gastan
 * menos y se recuperan mejor) — así las necesidades no son un sistema aislado,
 * sino otra cara de la personalidad que el motor ya rastrea.
 */

export interface Needs {
  satiety: number; // 1 = saciado, 0 = hambriento
  energy: number;  // 1 = descansado, 0 = agotado
  health: number;  // 1 = sano, 0 = al borde de caer
}

/** Lo que el héroe está haciendo en este tick (afecta gasto/recuperación). */
export type Activity = 'idle' | 'rest' | 'eat' | 'work' | 'train' | 'fight';

/** Necesidad crítica que, mantenida, llevaría a la muerte (gancho Fase 2/3). */
export type Vital = 'starvation' | 'exhaustion' | 'collapse';

// Tasas base por tick (lentas — una vida transcurre en muchos ticks).
const SATIETY_DECAY = 0.012; // hambre que crece por tick en reposo
const ENERGY_DECAY  = 0.010; // agotamiento que crece por tick en reposo
const EAT_RECOVER   = 0.14;  // saciedad recuperada al comer
const REST_RECOVER  = 0.05;  // energía recuperada al descansar
const HEALTH_REGEN  = 0.006; // salud que vuelve cuando todo va bien
const HEALTH_DRAIN  = 0.020; // salud perdida con necesidad crítica
const CRITICAL      = 0.12;  // umbral: por debajo, empieza a dañar la salud

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const round = (n: Needs): Needs => ({
  satiety: parseFloat(n.satiety.toFixed(4)),
  energy:  parseFloat(n.energy.toFixed(4)),
  health:  parseFloat(n.health.toFixed(4)),
});

// Cuánto esfuerzo/comida consume cada actividad (multiplicador sobre la tasa base).
function effortOf(a: Activity): number {
  return a === 'fight' ? 2.6 : a === 'train' ? 2.0 : a === 'work' ? 1.4 : 1.0;
}
function appetiteOf(a: Activity): number {
  return a === 'fight' || a === 'train' ? 1.4 : a === 'work' ? 1.2 : 1.0;
}

/** Necesidades iniciales de un héroe: casi llenas, con leve variación por seed/alma. */
export function createNeeds(seeder: Seeder, axes: SoulAxes): Needs {
  const s = seeder.branch('needs');
  const j = () => 0.82 + s.nextFloat() * 0.18; // 0.82..1.0
  return round({
    satiety: clamp01(0.65 * j() + 0.25),
    energy:  clamp01(0.65 * j() + 0.25 + (axes.discipline - 0.5) * 0.1),
    health:  clamp01(0.85 + s.nextFloat() * 0.15),
  });
}

/** Avanza un tick. PURE: no muta, depende solo de las entradas. */
function step(n: Needs, axes: SoulAxes, activity: Activity): Needs {
  const drainMul = 1.1 - axes.discipline * 0.3;  // disciplinado gasta menos
  const recovMul = 0.85 + axes.discipline * 0.3; // y se recupera mejor

  let satiety = n.satiety;
  if (activity === 'eat') satiety += EAT_RECOVER * recovMul;
  else satiety -= SATIETY_DECAY * drainMul * appetiteOf(activity);

  let energy = n.energy;
  if (activity === 'rest') energy += REST_RECOVER * recovMul;
  else energy -= ENERGY_DECAY * drainMul * effortOf(activity);

  satiety = clamp01(satiety);
  energy = clamp01(energy);

  // Salud: cae con hambre/agotamiento crítico; regenera si todo va holgado.
  let health = n.health;
  const starving = satiety <= CRITICAL;
  const exhausted = energy <= CRITICAL;
  if (starving || exhausted) {
    const deficit = (starving ? CRITICAL - satiety : 0) + (exhausted ? CRITICAL - energy : 0);
    health -= HEALTH_DRAIN * (0.5 + deficit / CRITICAL);
  } else if (satiety > 0.5 && energy > 0.5) {
    health += HEALTH_REGEN * recovMul;
  }
  health = clamp01(health);

  return { satiety, energy, health };
}

/** Avanza `ticks` ticks de la misma actividad. Devuelve copia nueva. */
export function tickNeeds(needs: Needs, axes: SoulAxes, activity: Activity, ticks = 1): Needs {
  let n = needs;
  for (let i = 0; i < ticks; i++) n = step(n, axes, activity);
  return round(n);
}

/** Lectura OBSERVABLE (sin números) — reutilizable por la Hada / el dev panel. */
export function needsStatus(n: Needs): string[] {
  const out: string[] = [];
  if (n.energy <= CRITICAL) out.push('está al borde del colapso por agotamiento');
  else if (n.energy < 0.3) out.push('se le ve agotado, arrastra los pies');
  else if (n.energy < 0.5) out.push('anda algo cansado');
  if (n.satiety <= CRITICAL) out.push('se muere de hambre');
  else if (n.satiety < 0.3) out.push('está hambriento');
  else if (n.satiety < 0.5) out.push('le vendría bien comer');
  if (n.health < 0.3) out.push('se le ve débil, como enfermo');
  if (out.length === 0) out.push('se le ve entero');
  return out;
}

/** Necesidad crítica (o null). Gancho para la muerte emergente de Fase 2/3. */
export function criticalNeed(n: Needs): Vital | null {
  if (n.health <= 0.02) return 'collapse';
  if (n.satiety <= 0) return 'starvation';
  if (n.energy <= 0) return 'exhaustion';
  return null;
}
