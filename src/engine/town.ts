import { NPC, WorldStory } from './types';
import { createSeeder } from './seeder';
import { rollDifficulty } from './gacha';
import { generateWorld } from './world';
import { generateNPC } from './npcGenerator';

/**
 * El PUEBLO / MUNDO.
 *
 * La dificultad es una propiedad del MUNDO, no de cada NPC. Antes, cada NPC
 * tiraba su propia dificultad desde su semilla, así que un roster mezclaba
 * mundos fáciles y brutales. Aquí la dificultad se decide UNA vez por pueblo y
 * todos los NPC invocados ahí la comparten. Las estrellas siguen siendo la
 * propiedad por-NPC (su rareza, y más adelante su facilidad de progreso).
 *
 * `difficulty` nunca se le muestra al jugador; la intuye por lo que cuesta
 * sobrevivir y desbloquear (ver mediator.RULES.difficulty).
 */
export interface Town {
  id: string;
  seed: string;
  difficulty: number;   // 1-1000, única para el pueblo; oculta al jugador
  rosterFloor: number;  // piso más profundo que el roster ha alcanzado (meta-progresión)
  world: WorldStory;    // el mundo perdido del que vienen TODOS los héroes del pueblo
}

/**
 * Crea un pueblo desde una semilla. La dificultad se rueda una sola vez aquí y
 * pasa a ser la dificultad de TODAS las invocaciones del pueblo. `rosterFloor`
 * arranca en 0 y la capa de persistencia lo va subiendo conforme el roster sube.
 */
export function createTown(seed: string, rosterFloor = 0): Town {
  const seeder = createSeeder(seed);
  const difficulty = rollDifficulty(seeder);
  const world = generateWorld(seeder);   // rama 'world' aislada → no perturba la dificultad
  return { id: seed, seed, difficulty, rosterFloor, world };
}

/**
 * Invoca al NPC número `index` del pueblo. Inyecta la dificultad compartida del
 * pueblo (no se rueda por-NPC) y el progreso global del roster, de modo que el
 * gacha de estrellas reaccione al mundo y a lo que el roster ha escalado.
 */
export function summonInTown(town: Town, index: number): NPC {
  return generateNPC({
    seed: `${town.seed}:npc:${index}`,
    difficulty: town.difficulty,
    rosterFloor: town.rosterFloor,
    world: town.world,      // todos los héroes del pueblo comparten el MISMO mundo
    worldSeed: town.seed,   // persistido en el NPC para reproducir el mundo en regen
  });
}
