import { StarRating, SoulAxes, PastLife, HeroLore, Memory, WorldStory } from './types';
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

// ── Vida civil (pasado) ──────────────────────────────────────────────────────
// Quiénes eran ANTES de la caída de su mundo: gente común con un oficio. Esto da
// "vidas propias" y, para los fillers (1-2★), es casi todo lo que recuerdan.
// Oficios sesgados por arquetipo (coherentes con su alma), lugar humilde sembrado.
const TRADES: Record<string, string[]> = {
  honor:      ['guardia de la muralla', 'herrero', 'juez de paz', 'capitán de la ronda'],
  imprudente: ['minero', 'marinero', 'domador de bestias', 'buscavidas'],
  calido:     ['cocinero', 'posadero', 'partera', 'panadero'],
  rencoroso:  ['prestamista', 'recaudador', 'tasador', 'cobrador de deudas'],
  erudito:    ['escriba', 'maestro de niños', 'cartógrafo', 'boticario'],
  difuso:     ['jornalero', 'leñador', 'pastor', 'mozo de cuadra'],
};
const PLACE_KIND = ['una aldea junto al río', 'un barrio de las afueras', 'el puerto viejo', 'las tierras altas', 'un caserío de montaña', 'el arrabal', 'una granja a las afueras', 'la villa baja'];
const PLACE_NAME = ['Almena', 'Robledo', 'Vado', 'Sercal', 'Oteros', 'Marenca', 'Hondura', 'Cardal', 'Espino', 'Bruma'];

export function generatePastLife(seeder: Seeder, archetypeId: string): PastLife {
  const ps = seeder.branch('pastlife');
  const trades = TRADES[archetypeId] ?? TRADES.difuso;
  const trade = ps.nextChoice(trades);
  const place = `${ps.nextChoice(PLACE_KIND)} de ${ps.nextChoice(PLACE_NAME)}`;
  return { trade, place };
}

/** Frase del pasado civil, para tejer en el `history` del NPC. */
export function pastLifeLine(pl: PastLife): string {
  return `Antes de todo esto era ${pl.trade}, de ${pl.place} — o eso es lo que aún recuerda.`;
}

// ── Lugar del héroe en la caída del mundo (por estrellas) ────────────────────
// Las estrellas dicen a qué profundidad de la catástrofe estuvo: 5★ en el núcleo
// (y por eso su cuerpo aún sabe pelear), 1-2★ ajenos (fillers, casi sin pericia).
type Tier = HeroLore['tier'];
function tierOf(stars: StarRating): Tier {
  return stars === 5 ? 'core' : stars === 4 ? 'secondary' : stars === 3 ? 'peripheral' : 'mundane';
}

const ROLE_BY_TIER: Record<Tier, (pl: PastLife) => string> = {
  core:       () => 'Estuvo en el corazón mismo del fin de su mundo. Las manos aún recuerdan pelear aunque la cabeza lo haya enterrado.',
  secondary:  () => 'Fue figura secundaria de aquella caída: la vio de cerca y sobrevivió por poco. Algo de oficio le quedó.',
  peripheral: () => 'Apenas rozó la historia — intuía que algo iba muy mal, sin estar nunca dentro. De pelear sabe lo justo.',
  mundane:    (pl) => `Era gente común de aquel mundo, ${pl.trade} y nada más. De batalla no sabe casi nada; está aquí casi por accidente.`,
};

// Ejes del alma que cada profundidad de recuerdo "remueve".
const TIER_AXES: Record<Tier, (keyof SoulAxes)[]> = {
  core:       ['confidence', 'optimism', 'caution', 'trust'],
  secondary:  ['confidence', 'caution', 'loyalty', 'optimism'],
  peripheral: ['curiosity', 'caution', 'optimism'],
  mundane:    ['warmth', 'curiosity', 'sociability', 'optimism'],
};
const TIER_WEIGHT: Record<Tier, [number, number]> = {
  core: [0.8, 1.0], secondary: [0.6, 0.8], peripheral: [0.4, 0.6], mundane: [0.2, 0.4],
};
const TIER_COUNT: Record<Tier, number> = { core: 3, secondary: 2, peripheral: 2, mundane: 2 };

// Recuerdos mundanos de los fillers: su vida civil, apenas rozando la catástrofe.
const MUNDANE_SHARDS = [
  'las manos recordando el oficio de {trade}',
  'el olor de {place} al amanecer',
  'una jornada de {trade} igual a la anterior',
  'volver a {place} con el cuerpo cansado',
];

/** Elige `n` elementos distintos de `pool` de forma determinista. */
function pickDistinct<T>(s: Seeder, pool: T[], n: number): T[] {
  const copy = pool.slice();
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) out.push(copy.splice(s.nextInt(0, copy.length - 1), 1)[0]);
  return out;
}

export function generateHeroLore(
  seeder: Seeder,
  world: WorldStory,
  stars: StarRating,
  pastLife: PastLife,
): HeroLore {
  const ls = seeder.branch('lore');
  const tier = tierOf(stars);
  const axes = TIER_AXES[tier];
  const [wlo, whi] = TIER_WEIGHT[tier];

  const texts = tier === 'mundane'
    ? pickDistinct(ls, MUNDANE_SHARDS, TIER_COUNT[tier]).map((t) =>
        t.replace('{trade}', pastLife.trade).replace('{place}', pastLife.place))
    : pickDistinct(ls, world.shards[tier], TIER_COUNT[tier]);

  const memories: Memory[] = texts.map((text) => ({
    text,
    axis: ls.nextChoice(axes),
    weight: parseFloat(ls.nextFloat(wlo, whi).toFixed(3)),
    surfaced: false,
  }));

  return { tier, role: ROLE_BY_TIER[tier](pastLife), memories };
}
