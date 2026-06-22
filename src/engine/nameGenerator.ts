import { Culture, SoulAxes } from './types';
import { Seeder } from './seeder';

// Phoneme pools per culture. Prefixes + roots + suffixes chosen to sound
// like the culture without being real names.
const PHONEMES: Record<Culture, { pre: string[]; root: string[]; suf: string[] }> = {
  hispano: {
    pre:  ['Al', 'El', 'Ca', 'Mar', 'Ra', 'Sol', 'Ven', 'Bel', 'Dar', 'Gal'],
    root: ['an', 'or', 'en', 'al', 'ir', 'os', 'ar', 'ur', 'es', 'iel', 'ael'],
    suf:  ['o', 'a', 'io', 'ia', 'on', 'an', 'in', 'el', 'ez', 'ar'],
  },
  nordico: {
    pre:  ['Bjor', 'Thor', 'Sig', 'Ulf', 'Heid', 'Gur', 'Rag', 'Var', 'Frey', 'Arn'],
    root: ['nar', 'vik', 'ald', 'ulf', 'mund', 'gar', 'helm', 'bor', 'den', 'fen'],
    suf:  ['son', 'ir', 'en', 'ar', 'ur', 'ik', 'on', 'r', 'n', 'a'],
  },
  celta: {
    pre:  ['Bran', 'Cai', 'Der', 'Fio', 'Gor', 'Mor', 'Nua', 'Rhi', 'Tal', 'Eil'],
    root: ['agh', 'wyn', 'eth', 'ael', 'dhu', 'ran', 'ban', 'hir', 'wyn', 'enn'],
    suf:  ['an', 'yn', 'on', 'wen', 'ith', 'och', 'ach', 'ael', 'in', 'ion'],
  },
  eslavo: {
    pre:  ['Dra', 'Mir', 'Bog', 'Vla', 'Svet', 'Kaz', 'Rad', 'Zla', 'Yar', 'Gor'],
    root: ['imir', 'odar', 'oslav', 'adin', 'enka', 'idar', 'omir', 'ivan', 'usha', 'enka'],
    suf:  ['ov', 'ev', 'a', 'in', 'ko', 'mir', 'ski', 'ych', 'nov', 'uk'],
  },
  greco: {
    pre:  ['Alex', 'Kali', 'The', 'Dem', 'Nik', 'Pho', 'Kyr', 'Ath', 'Eos', 'Kro'],
    root: ['andr', 'istr', 'oph', 'eter', 'akis', 'ipos', 'enos', 'aros', 'iran', 'okas'],
    suf:  ['os', 'is', 'as', 'on', 'ia', 'e', 'us', 'ios', 'eos', 'anes'],
  },
  africano: {
    pre:  ['Ama', 'Kwa', 'Zub', 'Osi', 'Lek', 'Tau', 'Aya', 'Ngo', 'Eba', 'Imani'],
    root: ['inde', 'ara', 'ube', 'ole', 'abo', 'ema', 'uru', 'ike', 'enu', 'olo'],
    suf:  ['we', 'a', 'i', 'u', 'e', 'yo', 'ba', 'ko', 'si', 'tu'],
  },
  asiatico: {
    pre:  ['Ren', 'Yuki', 'Hiro', 'Min', 'Tao', 'Xia', 'Jun', 'Hana', 'Ryu', 'Mei'],
    root: ['saki', 'zen', 'taro', 'fang', 'nori', 'yama', 'haru', 'kaze', 'moto', 'shiro'],
    suf:  ['ko', 'ka', 'ki', 'ro', 'to', 'na', 'mi', 'shi', 'ra', 'yu'],
  },
};

const CULTURES: Culture[] = ['hispano', 'nordico', 'celta', 'eslavo', 'greco', 'africano', 'asiatico'];

// Axes that influence phonetic hardness:
// high aggression (low passivity) + low warmth → harder consonants
function phoneticHardness(axes: SoulAxes): number {
  return (1 - axes.passivity) * 0.5 + (1 - axes.warmth) * 0.5;
}

// Hard consonant substitutions for high-aggression souls
function hardenName(name: string, hardness: number): string {
  if (hardness < 0.55) return name;
  let result = name;
  result = result.replace(/v/gi, 'k');
  result = result.replace(/l([aeiou])/gi, 'r$1');
  result = result.replace(/[aeiou]{2}/gi, (m: string) => m[0]);
  return result;
}

export function generateCulture(seeder: Seeder): Culture {
  return seeder.branch('culture').nextChoice(CULTURES);
}

export function generateName(seeder: Seeder, culture: Culture, axes: SoulAxes): string {
  const ns = seeder.branch('name');
  const pool = PHONEMES[culture];
  const pre  = ns.nextChoice(pool.pre);
  const root = ns.nextChoice(pool.root);
  const suf  = ns.nextChoice(pool.suf);

  const raw = pre + root + suf;
  // Capitalize first letter only
  const name = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return hardenName(name, phoneticHardness(axes));
}
