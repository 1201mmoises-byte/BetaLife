import { SoulAxes, StarRating } from './types';
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

export function generateObservation(seeder: Seeder, axes: SoulAxes): string {
  const os = seeder.branch('observation');

  const lines: string[] = [];

  // Body language cues — inferred from axes, never explained
  if (axes.caution > 0.65) lines.push('Escanea la sala antes de cruzar cualquier umbral.');
  if (axes.caution < 0.3)  lines.push('Entra a cualquier lugar sin mirar a los lados.');
  if (axes.warmth > 0.7)   lines.push('Sus ojos encuentran a los demás con facilidad.');
  if (axes.warmth < 0.3)   lines.push('Rara vez establece contacto visual.');
  if (axes.sociability > 0.7) lines.push('Se mueve hacia el grupo, no lejos de él.');
  if (axes.sociability < 0.3) lines.push('Prefiere los bordes de la plaza a su centro.');
  if (axes.discipline > 0.7)  lines.push('Mantiene el mismo horario sin que nadie se lo pida.');
  if (axes.discipline < 0.3)  lines.push('Rara vez termina lo que empieza en el orden que lo planeó.');
  if (axes.confidence > 0.75) lines.push('Habla como si sus palabras ya hubieran sido aprobadas.');
  if (axes.confidence < 0.3)  lines.push('Hace pausas largas antes de opinar en grupo.');

  // Guarantee at least one observation
  if (lines.length === 0) lines.push('No hay nada inmediatamente llamativo en cómo se mueve.');

  // Pick 1-2 lines to keep it mysterious
  const count = os.nextInt(1, Math.min(2, lines.length));
  const shuffled = [...lines].sort(() => os.next() - 0.5);
  return shuffled.slice(0, count).join(' ');
}
