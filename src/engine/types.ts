export interface SoulAxes {
  caution: number;        // 0=reckless, 1=cautious
  passivity: number;      // 0=aggressive, 1=passive
  submission: number;     // 0=dominant, 1=submissive
  warmth: number;         // 0=cold, 1=warm
  trust: number;          // 0=distrustful, 1=trusting
  altruism: number;       // 0=selfish, 1=altruistic
  sociability: number;    // 0=solitary, 1=social
  integrity: number;      // 0=convenient, 1=principled
  loyalty: number;        // 0=disloyal, 1=loyal
  optimism: number;       // 0=pessimistic, 1=optimistic
  discipline: number;     // 0=impulsive, 1=disciplined
  curiosity: number;      // 0=closed, 1=curious
  confidence: number;     // 0=insecure, 1=confident
  forgiveness: number;    // 0=resentful, 1=forgiving
}

export type Culture = 'hispano' | 'nordico' | 'celta' | 'eslavo' | 'greco' | 'africano' | 'asiatico';

export type StarRating = 1 | 2 | 3 | 4 | 5;

export interface Stamp {
  kind: 'birth' | 'growth'; // birth = acento de origen; growth = banda cruzada después
  axisKey: keyof SoulAxes;
  bandValue: number;  // 0.0 | 0.25 | 0.5 | 0.75 | 1.0
  sealedAt: number;   // timestamp ms (0 in pure generation)
}

// ── Mundo perdido (por SEMILLA, no por NPC) ──────────────────────────────────
// Cada semilla engendra un mundo con su propia caída; el misterio del juego es
// cómo terminó. Texto = canon del mundo (identidad), generado en world.ts.
export interface WorldStory {
  id: string;          // tipo de catástrofe (grieta/guerra/ruina/olvido/marea/sol-muerto)
  name: string;        // nombre del mundo perdido
  nature: string;      // qué clase de mundo era (una línea)
  cataclysm: string;   // cómo terminó (el misterio central, una frase)
  beats: string[];     // la "verdad" ordenada que la Torre revelará piso a piso
  // Fragmentos impresionistas por profundidad de la catástrofe (de qué tan
  // adentro estuvo el héroe, según sus estrellas).
  shards: { core: string[]; secondary: string[]; peripheral: string[] };
}

// ── Identidad civil + lugar del héroe en la historia del mundo ───────────────
export interface PastLife {
  trade: string;   // oficio civil de antes (obrero, leñador, cocinero…)
  place: string;   // de dónde venía (humilde, sembrado por semilla)
}

// Un recuerdo OLVIDADO del mundo perdido; aflora en sueños (dreams.ts).
export interface Memory {
  text: string;            // fragmento impresionista (no la verdad literal)
  axis: keyof SoulAxes;    // eje del alma que ese recuerdo "remueve"
  weight: number;          // 0..1: qué tan central/insistente es
  surfaced: boolean;       // ¿ya afloró en un sueño?
}

// El lugar del héroe en la caída del mundo, derivado de sus estrellas.
export interface HeroLore {
  tier: 'core' | 'secondary' | 'peripheral' | 'mundane'; // 5★/4★/3★/1-2★
  role: string;            // su papel en la historia (explica su saber de batalla)
  memories: Memory[];      // fragmentos olvidados (vacío de "verdad" para fillers)
}

export interface NPC {
  id: string;
  seed: string;
  name: string;
  culture: Culture;
  originArchetypeId: string; // root of the soul (derived from seed, not persisted)
  stars: StarRating;
  difficulty: number;   // 1-1000, never shown to player; comes from the TOWN (shared), not rolled per-NPC. Persisted so stars regenerate deterministically.
  rosterFloorAtSummon: number; // global roster progress when summoned; persisted so stars regenerate deterministically
  worldSeed: string;    // semilla del MUNDO del que proviene (= town.seed). Persisted so el mundo (y su lore) se reproduce en regen.
  axes: SoulAxes;
  stamps: Stamp[]; // sealed chapters; stamps[0] is the birth stamp (acento de origen)
  history: string;
  observation: string;
  pastLife: PastLife;   // quién era antes (vida civil, oculta tras el olvido)
  lore: HeroLore;       // su lugar en la caída del mundo (por estrellas) + recuerdos
  level: number;
  floorReached: number;
  isAlive: boolean;
  createdAt: number;
}

export interface GenerationOptions {
  seed: string;
  stars?: StarRating;
  difficulty?: number;
  rosterFloor?: number; // deepest floor the roster has reached at summon time (meta-progression)
  world?: WorldStory;   // mundo compartido del pueblo (de summonInTown); si falta se deriva de worldSeed
  worldSeed?: string;   // semilla del mundo (= town.seed); por defecto = seed del NPC (mundo propio)
}
