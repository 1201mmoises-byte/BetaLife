import { StarRating } from './types';
import { Seeder } from './seeder';
import { OriginArchetype } from './archetypes';

// The origin narrative now comes from the archetype (master rule:
// historia → ejes ponderados → estampa). Here we only compose the chosen
// archetype's fragment with a star-context line.

const STAR_CONTEXT: Record<StarRating, string[]> = {
  1: ['Apenas sobrevivió al viaje.', 'No tiene clase ni nombre dentro de la torre.', 'Nadie esperaba gran cosa de él.'],
  2: ['Mostró destellos de algo más en su primer combate.', 'Sobrevivió cuando otros no lo hicieron.', 'Llegó sin reputación; aún no la tiene.'],
  3: ['Su clase emergió en algún momento que ya es leyenda menor.', 'Los más viejos del roster lo notaron antes de que él mismo lo hiciera.', 'Cruzó un umbral que pocos describen igual.'],
  4: ['Hay cicatrices que los del pueblo conocen de memoria.', 'Su nombre se pronuncia diferente dependiendo de a quién le preguntes.', 'Llegó formado. Sigue formándose.'],
  5: ['Los bardos ya tienen canciones suyas aunque ninguna esté terminada.', 'Su presencia cambia la temperatura de una sala.', 'Leyenda que aún respira.'],
};

export function generateHistory(
  seeder: Seeder,
  archetype: OriginArchetype,
  stars: StarRating,
): string {
  const hs = seeder.branch('history');

  const fragment = hs.nextChoice(archetype.fragments);
  const starLine = hs.nextChoice(STAR_CONTEXT[stars]);

  return `${fragment} ${starLine}`;
}

// Observation moved to behavior.ts (Fase 2): the axes are read as observable
// behavior there. Use `firstImpression` / `readBehavior` instead.
