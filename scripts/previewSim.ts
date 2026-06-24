/**
 * Simulación compartida del preview (dev tool).
 *
 * `devPreview.ts` (el dev tool 2D legacy) corre ESTA misma simulación determinista
 * para sus burbujas de charla. El slice 3D (buildSlice.ts) ya NO usa diálogo
 * horneado: compone las charlas en vivo en el navegador (sin Gemini). El fallback
 * de abajo queda para el dev tool 2D.
 *
 * Integra el modelo nuevo: una sola DIFICULTAD de pueblo (createTown) compartida
 * por todos los NPC invocados, en vez de que cada uno tire la suya.
 */

import { createTown, summonInTown, Town } from '../src/engine/town';
import { createSeeder } from '../src/engine/seeder';
import { rollConversation, CONVERSATION_COOLDOWN } from '../src/engine/conversations';
import { applyConversationNudges } from '../src/engine/experience';
import { readBehavior } from '../src/engine/behavior';
import { NPC, SoulAxes } from '../src/engine/types';

export const ROLES = ['warrior', 'mage', 'rogue', 'archer'];
export const POOL_SIZE = 8;
export const INITIAL = 4;
export const TICKS = 3000;
export const TOWN_SEED = 'shrine-dev-town';

export interface DialogueLine {
  speaker: 'a' | 'b';
  text: string;
}

export interface ExchangeRecord {
  tick: number;
  aId: string; aName: string;
  bId: string; bName: string;
  topic: string;
  intensity: number;
  nudgesA: Partial<Record<string, number>>;
  nudgesB: Partial<Record<string, number>>;
  // Conducta OBSERVABLE de cada uno al momento de la charla (no se filtran ejes
  // crudos — solo lo que se vería mirando). Es la "persona" que recibe la IA.
  cuesA: string[];
  cuesB: string[];
  key: string; // clave estable para la caché de diálogo
}

export interface PreviewSim {
  town: Town;
  pool: NPC[];
  roster: NPC[];
  currentAxes: Record<string, SoulAxes>;
  log: ExchangeRecord[];
}

/** Hash estable (FNV-1a) → hex corto, para claves de caché reproducibles. */
function stableHash(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function dialogueKey(
  topic: string,
  aName: string,
  bName: string,
  cuesA: string[],
  cuesB: string[],
): string {
  return stableHash([topic, aName, bName, cuesA.join('|'), cuesB.join('|')].join('::'));
}

/** Corre la simulación determinista y devuelve pool, roster, ejes finales y log. */
export function runPreviewSim(): PreviewSim {
  // Pool: una sola dificultad de pueblo para TODOS (modelo nuevo).
  const town = createTown(TOWN_SEED);
  const pool: NPC[] = Array.from({ length: POOL_SIZE }, (_, i) => summonInTown(town, i + 1));

  const currentAxes: Record<string, SoulAxes> = {};
  pool.forEach((n) => { currentAxes[n.id] = { ...n.axes }; });

  const roster = pool.slice(0, INITIAL);
  const pairs: [number, number][] = [];
  for (let i = 0; i < roster.length - 1; i++)
    for (let j = i + 1; j < roster.length; j++)
      pairs.push([i, j]);

  const world = createSeeder('shrine-dev-preview');
  const cooldowns = new Map<string, number>();
  const log: ExchangeRecord[] = [];

  for (let t = 0; t < TICKS; t++) {
    for (const [ai, bi] of pairs) {
      const na = roster[ai], nb = roster[bi];
      const key = na.id < nb.id ? `${na.id}|${nb.id}` : `${nb.id}|${na.id}`;
      const cd = cooldowns.get(key) ?? 0;
      if (cd > 0) { cooldowns.set(key, cd - 1); continue; }

      const pa = { id: na.id, axes: currentAxes[na.id] };
      const pb = { id: nb.id, axes: currentAxes[nb.id] };
      const ex = rollConversation(world.branch(`t:${t}:${key}`), pa, pb, {
        proximity: 0.9, cooldownRemaining: 0,
      });

      if (ex) {
        cooldowns.set(key, CONVERSATION_COOLDOWN);
        const ra = applyConversationNudges(currentAxes[na.id], na.stamps, ex.nudges.a);
        const rb = applyConversationNudges(currentAxes[nb.id], nb.stamps, ex.nudges.b);
        // Conducta observable al momento (antes de aplicar el empujón de esta charla).
        const cuesA = readBehavior(createSeeder('cue:' + na.id), currentAxes[na.id], 2);
        const cuesB = readBehavior(createSeeder('cue:' + nb.id), currentAxes[nb.id], 2);
        currentAxes[na.id] = ra.axes;
        currentAxes[nb.id] = rb.axes;
        log.push({
          tick: t, aId: na.id, aName: na.name, bId: nb.id, bName: nb.name,
          topic: ex.topic, intensity: ex.intensity,
          nudgesA: ex.nudges.a as Record<string, number>,
          nudgesB: ex.nudges.b as Record<string, number>,
          cuesA, cuesB,
          key: dialogueKey(ex.topic, na.name, nb.name, cuesA, cuesB),
        });
      }
    }
  }

  return { town, pool, roster, currentAxes, log };
}

// ── Fallback de diálogo (redactado por Claude) ───────────────────────────────
// Se usa cuando NO hay GEMINI_API_KEY o la llamada falla, para que el preview
// SIEMPRE muestre charla natural. Gemini, cuando hay clave, lo sobrescribe por
// exchange. Determinista: elige variante por la clave del exchange.
// Tono de recién llegados (sin pisos/combate ni cosas no vividas): desorientación,
// el sitio, el frío, conocerse. Solo lo alimenta el dev tool 2D legacy.
const FALLBACK: Record<string, [string, string][]> = {
  training: [
    ['¿Otra vuelta al campo? No sé ni cómo se sostiene esto.', 'Nadie sabe. Lo hacemos por no quedarnos quietos.'],
    ['Me canso rápido. No estoy hecho para esto.', 'Yo tampoco. Pero algo hay que hacer mientras entendemos dónde estamos.'],
    ['¿Tú crees que sirve de algo todo esto?', 'Ni idea. Al menos entra uno en calor.'],
  ],
  survival: [
    ['Este sitio no me termina de gustar.', 'A mí tampoco. Pero estamos juntos, algo es algo.'],
    ['¿Tú recuerdas cómo llegaste?', 'No. Y eso es lo que más me inquieta.'],
    ['Si las cosas se ponen feas, ¿qué hacemos?', 'Quedarnos cerca. Solos no se aguanta.'],
  ],
  social: [
    ['Te noto distinto desde que llegamos.', 'Será que aquí uno no sabe ni quién es.'],
    ['Nunca me cuentas de dónde vienes.', 'Poco a poco. Apenas me acuerdo yo.'],
    ['¿Confías en la gente de aquí?', 'En ti, un poco más cada día.'],
  ],
  hobby: [
    ['¿Qué hacías para distraerte, antes?', 'No me acuerdo bien. Algo con las manos, creo.'],
    ['A veces me siento a mirar el fuego y ya.', 'Yo igual. Calma, aunque sea un rato.'],
    ['Cuéntame algo, lo que sea.', 'No tengo gran cosa. Pero te escucho, si quieres hablar tú.'],
  ],
  casual: [
    ['Hace frío hoy.', 'Sí. Bueno para arrimarse al fuego y callar.'],
    ['¿Otra noche en vela?', 'Eso parece. Al menos no la paso solo.'],
    ['No hace falta hablar, ¿sabes?', 'Lo sé. Se está bien así.'],
  ],
};

export function fallbackDialogue(e: ExchangeRecord): DialogueLine[] {
  const bank = FALLBACK[e.topic] ?? FALLBACK.casual;
  const idx = parseInt(e.key.slice(0, 4), 16) % bank.length;
  const [a, b] = bank[idx];
  return [{ speaker: 'a', text: a }, { speaker: 'b', text: b }];
}
