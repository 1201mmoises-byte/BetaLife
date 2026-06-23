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

export interface NPC {
  id: string;
  seed: string;
  name: string;
  culture: Culture;
  originArchetypeId: string; // root of the soul (derived from seed, not persisted)
  stars: StarRating;
  difficulty: number;   // 1-1000, never shown to player
  rosterFloorAtSummon: number; // global roster progress when summoned; persisted so stars regenerate deterministically
  axes: SoulAxes;
  stamps: Stamp[]; // sealed chapters; stamps[0] is the birth stamp (acento de origen)
  history: string;
  observation: string;
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
}
