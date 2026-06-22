// Mulberry32 — fast, deterministic, 32-bit PRNG seeded with a string hash
function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
}

export function createSeeder(seed: string) {
  let state = hashString(seed);

  function next(): number {
    state += 0x6d2b79f5;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    z = (z ^ (z >>> 14)) >>> 0;
    return z / 0x100000000;
  }

  function nextFloat(min = 0, max = 1): number {
    return min + next() * (max - min);
  }

  function nextInt(min: number, max: number): number {
    return Math.floor(nextFloat(min, max + 1));
  }

  function nextChoice<T>(arr: T[]): T {
    return arr[nextInt(0, arr.length - 1)];
  }

  // Derives a child seeder for a sub-domain without consuming parent state unpredictably
  function branch(suffix: string) {
    return createSeeder(seed + ':' + suffix);
  }

  return { next, nextFloat, nextInt, nextChoice, branch };
}

export type Seeder = ReturnType<typeof createSeeder>;
