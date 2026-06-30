import { SoulAxes } from './types';
import { createSeeder, Seeder } from './seeder';
import { CombatStats } from './stats';
import { Skill, bestOffensive, bestDefensive } from './skills';
import { ExperienceEvent } from './experience';

/**
 * RPG — Resolutor de COMBATE (el corazón que une todas las capas).
 *
 * Reglas de diseño que este módulo encarna:
 *   · Arquitecto, no controlador: el jugador NO ordena acciones. Cada NPC elige
 *     filtrado por su alma (agresivo ataca, cauto se cubre, altruista protege).
 *   · Muerte permanente: un NPC que llega a 0 de vida CAE. No revive aquí ni
 *     nunca. El caller marcará isAlive:false.
 *   · La entidad es la única voz: el jugador solo recibe `narration` (conducta
 *     observable, SIN números). Los stats y el daño viven dentro del motor.
 *   · Determinismo total: todo sale de un seeder; ningún Math.random.
 *   · Puro: resolveCombat copia los combatientes; no muta lo que recibe.
 *
 * El resultado entrega `npcEvents` listos para alimentar applyExperience: así el
 * bucle se cierra — bajar al piso mueve el alma de quien vuelve.
 */

export interface Combatant {
  id: string;
  name: string;
  stats: CombatStats;
  skills: Skill[];
  isNpc: boolean;
  axes?: SoulAxes;  // presente en NPCs: filtra la elección de acción
  trait?: string;   // presente en monstruos: sesga su conducta
}

export interface CombatResult {
  outcome: 'victory' | 'defeat';
  rounds: number;
  narration: string[];                         // jugador-facing, sin números
  fallenNpcIds: string[];                       // permadeath
  npcEvents: Record<string, ExperienceEvent>;   // para applyExperience
  survivorHp: Record<string, number>;           // interno
}

const MAX_ROUNDS = 60;

interface Fighter extends Combatant {
  hp: number;
  guarding: boolean;
}

function clone(c: Combatant): Fighter {
  return { ...c, stats: { ...c.stats }, hp: c.stats.hp, guarding: false };
}

/** Daño tras defensa y guardia, con jitter determinista ±10%; mínimo 1. */
function damage(s: Seeder, atk: number, def: number, skillMul: number, defenderGuarding: boolean): number {
  const effDef = defenderGuarding ? def * 2 : def;
  const jitter = 0.9 + s.nextFloat() * 0.2;
  return Math.max(1, Math.round((atk * skillMul - effDef * 0.6) * jitter));
}

type Action = { kind: 'attack'; skill: Skill | null } | { kind: 'guard' };

/** Un NPC decide su acción según su alma (no por orden del jugador). */
function chooseNpcAction(f: Fighter): Action {
  const a = f.axes!;
  const lowHp = f.hp < f.stats.maxHp * 0.3;
  const off = bestOffensive(f.skills);
  const def = bestDefensive(f.skills);

  // Herido + cauto → se cubre. Cuanto más cauto, antes lo hace.
  if (lowHp && a.caution > 0.55) return { kind: 'guard' };
  // Pasivo y no urgido → tantea con guardia en vez de exponerse.
  if (!lowHp && a.passivity > 0.7 && a.confidence < 0.45) return { kind: 'guard' };
  // Defensor de alma (alta defensa/lealtad) bajo presión → guardia protectora.
  if (lowHp && def && (a.loyalty > 0.7 || a.altruism > 0.7)) return { kind: 'guard' };
  // Por defecto ataca; si tiene golpe ofensivo y aplomo, lo usa.
  const useSkill = off && (a.confidence > 0.6 || a.forgiveness < 0.25);
  return { kind: 'attack', skill: useSkill ? off : null };
}

/** Un monstruo decide su acción según su rasgo. */
function chooseMonsterAction(f: Fighter): Action {
  if (f.trait === 'acorazado' && f.hp < f.stats.maxHp * 0.4) return { kind: 'guard' };
  return { kind: 'attack', skill: null };
}

/** Objetivo de un atacante entre los vivos del bando rival. */
function pickTarget(attacker: Fighter, foes: Fighter[]): Fighter | null {
  const alive = foes.filter((f) => f.hp > 0);
  if (alive.length === 0) return null;

  if (attacker.isNpc) {
    const a = attacker.axes!;
    // Disciplinado/estratega → remata al más débil (foco eficiente).
    if (a.discipline > 0.6) return alive.reduce((w, f) => (f.hp < w.hp ? f : w));
    // Agresivo → va por la mayor amenaza (más ataque).
    if (a.passivity < 0.4) return alive.reduce((w, f) => (f.stats.atk > w.stats.atk ? f : w));
    return alive[0];
  }
  // Monstruos: depredan al NPC más débil (la permadeath pesa de verdad).
  // 'feroz' es aún más implacable con el herido (mismo objetivo, lectura distinta).
  return alive.reduce((w, f) => (f.hp < w.hp ? f : w));
}

/**
 * Resuelve un combate completo entre una party de NPCs y los monstruos de un
 * piso. Determinista por `seed`. No muta a los combatientes recibidos.
 */
export function resolveCombat(seed: string, party: Combatant[], monsters: Combatant[]): CombatResult {
  const root = createSeeder(`combat:${seed}`);
  const npcs = party.map(clone);
  const mobs = monsters.map(clone);

  const narration: string[] = [];
  const fallenNpcIds: string[] = [];

  // Orden de turno por velocidad (desc); empates rotos de forma determinista.
  const order = [...npcs, ...mobs].sort((x, y) => {
    if (y.stats.spd !== x.stats.spd) return y.stats.spd - x.stats.spd;
    return root.branch('tie').branch(x.id + y.id).next() < 0.5 ? -1 : 1;
  });

  const npcStart = npcs.length;
  let round = 0;

  const alive = (arr: Fighter[]) => arr.some((f) => f.hp > 0);

  while (alive(npcs) && alive(mobs) && round < MAX_ROUNDS) {
    round++;
    const rs = root.branch('round').branch(String(round));

    for (const actor of order) {
      if (actor.hp <= 0) continue;
      if (!alive(npcs) || !alive(mobs)) break;

      actor.guarding = false; // la guardia del turno previo expira al actuar
      const foes = actor.isNpc ? mobs : npcs;
      const action = actor.isNpc ? chooseNpcAction(actor) : chooseMonsterAction(actor);

      if (action.kind === 'guard') {
        actor.guarding = true;
        continue;
      }

      const target = pickTarget(actor, foes);
      if (!target) continue;

      const skillMul = action.skill ? 1 + action.skill.power : 1;
      const dmg = damage(rs.branch(actor.id), actor.stats.atk, target.stats.def, skillMul, target.guarding);
      target.hp = Math.max(0, target.hp - dmg);

      if (target.hp === 0 && !target.isNpc) {
        narration.push(`${target.name} se desploma y no vuelve a moverse.`);
      }
      if (target.hp === 0 && target.isNpc) {
        fallenNpcIds.push(target.id);
        narration.push(`${target.name} cae. Esta vez no se levanta.`);
      }
    }
  }

  const npcsAlive = alive(npcs);
  const outcome: CombatResult['outcome'] = npcsAlive ? 'victory' : 'defeat';

  if (outcome === 'victory') {
    const standing = npcs.filter((f) => f.hp > 0).map((f) => f.name);
    narration.unshift(`El piso queda en silencio. Vuelven ${listNames(standing)}.`);
  } else {
    narration.unshift('El piso se los traga a todos. No vuelve nadie.');
  }

  // Eventos para applyExperience: caer = fracaso; sobrevivir una victoria = éxito.
  // La intensidad sube con lo dura que fue la pelea (rondas usadas / tope).
  const intensity = Math.min(1, 0.4 + round / MAX_ROUNDS);
  const npcEvents: Record<string, ExperienceEvent> = {};
  const survivorHp: Record<string, number> = {};
  for (const f of npcs) {
    const fell = f.hp <= 0;
    npcEvents[f.id] = {
      kind: 'combat',
      intensity,
      outcome: fell ? 'failure' : outcome === 'victory' ? 'success' : 'partial',
    };
    if (!fell) survivorHp[f.id] = f.hp;
  }

  return { outcome, rounds: round, narration, fallenNpcIds, npcEvents, survivorHp };
}

function listNames(names: string[]): string {
  if (names.length === 0) return 'nadie';
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(', ') + ' y ' + names[names.length - 1];
}
