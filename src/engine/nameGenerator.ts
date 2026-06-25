import { Culture, SoulAxes } from './types';
import { Seeder } from './seeder';

// Phoneme pools per culture. A name is composed as pre + root + mid + suf, each
// drawn from a curated, per-culture pool so every syllable "sounds right" by hand.
// Four components × ~22 unique entries each × 7 cultures gives a theoretical
// namespace of ~22^4 × 7 ≈ 1.6M distinct names. Keep entries UNIQUE within each
// pool: a duplicate silently shrinks the combinatorial space. `mid` is a short
// connective syllable (1-2 chars) so the extra component does not over-lengthen names.
const PHONEMES: Record<Culture, { pre: string[]; root: string[]; mid: string[]; suf: string[] }> = {
  hispano: {
    pre:  ['Al', 'El', 'Ca', 'Mar', 'Ra', 'Sol', 'Ven', 'Bel', 'Dar', 'Gal', 'Cor', 'Ser', 'Tan', 'Lun', 'Vel', 'Bra', 'Cas', 'Fer', 'Nor', 'Sal', 'Tor', 'Mer'],
    root: ['an', 'or', 'en', 'al', 'ir', 'os', 'ar', 'ur', 'es', 'iel', 'ael', 'and', 'eri', 'ond', 'ial', 'uel', 'anz', 'erm', 'ost', 'ind', 'alv', 'ern'],
    mid:  ['a', 'e', 'i', 'o', 'ri', 'li', 'na', 'se', 'ta', 'va', 'ra', 'le', 'mi', 'no', 'da', 'ne', 'lo', 'sa', 'te', 'vi', 'ro', 'ca'],
    suf:  ['o', 'a', 'io', 'ia', 'on', 'an', 'in', 'el', 'ez', 'ar', 'os', 'eo', 'un', 'il', 'az', 'or', 'ano', 'ina', 'eno', 'ius', 'alo', 'eria'],
  },
  nordico: {
    pre:  ['Bjor', 'Thor', 'Sig', 'Ulf', 'Heid', 'Gur', 'Rag', 'Var', 'Frey', 'Arn', 'Eir', 'Hak', 'Sten', 'Grim', 'Hald', 'Sval', 'Orm', 'Tyr', 'Skar', 'Volk', 'Gunn', 'Rurik'],
    root: ['nar', 'vik', 'ald', 'ulf', 'mund', 'gar', 'helm', 'bor', 'den', 'fen', 'rik', 'stein', 'grim', 'vald', 'skog', 'thal', 'norn', 'gisl', 'rond', 'hild', 'svein', 'falk'],
    mid:  ['a', 'e', 'i', 'o', 'u', 'da', 'ne', 'la', 'ri', 'va', 'sa', 'to', 'ke', 'no', 'ga', 'me', 'lo', 'se', 'ta', 'vi', 'do', 'ru'],
    suf:  ['son', 'ir', 'en', 'ar', 'ur', 'ik', 'on', 'r', 'n', 'a', 'dr', 'ulf', 'ald', 'mir', 'gar', 'vid', 'rok', 'nir', 'helm', 'stad', 'und', 'borg'],
  },
  celta: {
    pre:  ['Bran', 'Cai', 'Der', 'Fio', 'Gor', 'Mor', 'Nua', 'Rhi', 'Tal', 'Eil', 'Aed', 'Bre', 'Cael', 'Dun', 'Ferg', 'Gwyn', 'Lugh', 'Niamh', 'Oran', 'Sael', 'Teag', 'Caw'],
    root: ['agh', 'wyn', 'eth', 'ael', 'dhu', 'ran', 'ban', 'hir', 'enn', 'mor', 'lyr', 'wen', 'tach', 'gwel', 'nith', 'arod', 'beth', 'cael', 'duin', 'fael', 'goch', 'lain'],
    mid:  ['a', 'e', 'i', 'y', 'o', 'ai', 'we', 'ru', 'na', 'li', 'dy', 'ce', 'ma', 'ne', 'lo', 'ri', 'sa', 'te', 'vi', 'do', 'el', 'in'],
    suf:  ['an', 'yn', 'on', 'wen', 'ith', 'och', 'ach', 'ael', 'in', 'ion', 'wyn', 'dd', 'ek', 'rys', 'agh', 'ven', 'lyn', 'mor', 'gan', 'ed', 'ys', 'aith'],
  },
  eslavo: {
    pre:  ['Dra', 'Mir', 'Bog', 'Vla', 'Svet', 'Kaz', 'Rad', 'Zla', 'Yar', 'Gor', 'Bor', 'Lud', 'Sta', 'Tom', 'Ves', 'Woj', 'Zor', 'Bran', 'Dmi', 'Ksen', 'Mst', 'Rus'],
    root: ['imir', 'odar', 'oslav', 'adin', 'enka', 'idar', 'omir', 'ivan', 'usha', 'olan', 'eslav', 'omil', 'aros', 'imko', 'enko', 'oryn', 'astan', 'evod', 'islav', 'omash', 'uril', 'azek'],
    mid:  ['a', 'e', 'i', 'o', 'u', 'ya', 'ne', 'ri', 'lo', 'va', 'sa', 'do', 'ze', 'na', 'mi', 'to', 'le', 'ro', 'se', 'vi', 'da', 'ko'],
    suf:  ['ov', 'ev', 'a', 'in', 'ko', 'mir', 'ski', 'ych', 'nov', 'uk', 'enko', 'slav', 'omir', 'ek', 'ina', 'oslav', 'ich', 'an', 'ar', 'el', 'osh', 'yna'],
  },
  greco: {
    pre:  ['Alex', 'Kali', 'The', 'Dem', 'Nik', 'Pho', 'Kyr', 'Ath', 'Eos', 'Kro', 'Lys', 'Mel', 'Orph', 'Pan', 'Sel', 'Tha', 'Xen', 'Zeph', 'Arist', 'Diog', 'Hera', 'Leon'],
    root: ['andr', 'istr', 'oph', 'eter', 'akis', 'ipos', 'enos', 'aros', 'iran', 'okas', 'andro', 'ekle', 'imen', 'ophan', 'ister', 'agor', 'edon', 'ophil', 'arch', 'eides', 'olaos', 'ythen'],
    mid:  ['a', 'e', 'i', 'o', 'io', 'ia', 'es', 'os', 'an', 'el', 'on', 'er', 'al', 'is', 'or', 'en', 'ar', 'ne', 'ro', 'ti', 'le', 'me'],
    suf:  ['os', 'is', 'as', 'on', 'ia', 'e', 'us', 'ios', 'eos', 'anes', 'ides', 'andros', 'ikos', 'enes', 'ator', 'okles', 'iton', 'aios', 'eus', 'oros', 'ipos', 'ymos'],
  },
  africano: {
    pre:  ['Ama', 'Kwa', 'Zub', 'Osi', 'Lek', 'Tau', 'Aya', 'Ngo', 'Eba', 'Ima', 'Bara', 'Chid', 'Dala', 'Femi', 'Jabu', 'Kofi', 'Mosi', 'Nuru', 'Obi', 'Sade', 'Thabo', 'Zola'],
    root: ['inde', 'ara', 'ube', 'ole', 'abo', 'ema', 'uru', 'ike', 'enu', 'olo', 'andi', 'eshe', 'iola', 'unde', 'abeo', 'imba', 'okon', 'esha', 'ulum', 'anke', 'ireh', 'oseh'],
    mid:  ['a', 'e', 'i', 'o', 'u', 'na', 'we', 'lo', 'mi', 'ba', 'ya', 'se', 'ko', 'ru', 'da', 'le', 'ni', 'to', 'sa', 'wo', 'ma', 'zu'],
    suf:  ['we', 'a', 'i', 'u', 'e', 'yo', 'ba', 'ko', 'si', 'tu', 'la', 'na', 'di', 'mba', 'nde', 'ola', 'esi', 'ayo', 'umi', 'eke', 'oro', 'isha'],
  },
  asiatico: {
    pre:  ['Ren', 'Yuki', 'Hiro', 'Min', 'Tao', 'Xia', 'Jun', 'Hana', 'Ryu', 'Mei', 'Kai', 'Lin', 'Nao', 'Qing', 'Sora', 'Wei', 'Yi', 'Zhen', 'Akio', 'Daiki', 'Feng', 'Haru'],
    root: ['saki', 'zen', 'taro', 'fang', 'nori', 'yama', 'haru', 'kaze', 'moto', 'shiro', 'jian', 'kawa', 'long', 'mura', 'sora', 'tian', 'waka', 'xing', 'yoshi', 'zhao', 'hoshi', 'inu'],
    mid:  ['a', 'e', 'i', 'o', 'u', 'no', 'ka', 'mi', 'ra', 'shi', 'ko', 'na', 'to', 'ya', 'ki', 'ru', 'sa', 'chi', 'ma', 'wa', 'zu', 'ne'],
    suf:  ['ko', 'ka', 'ki', 'ro', 'to', 'na', 'mi', 'shi', 'ra', 'yu', 'ji', 'sho', 'taro', 'hito', 'ren', 'sei', 'long', 'feng', 'lan', 'wei', 'ying', 'hua'],
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

// Theoretical size of the curated name namespace = Σ_culture (|pre|·|root|·|mid|·|suf|),
// counting only UNIQUE entries per pool (duplicates do not add reachable names).
// `hardenName` only permutes letters of an already-reachable name, so it is not
// counted here. Exposed for tests/diagnostics.
export function nameNamespaceSize(): number {
  const uniq = (a: string[]) => new Set(a).size;
  return CULTURES.reduce((total, c) => {
    const p = PHONEMES[c];
    return total + uniq(p.pre) * uniq(p.root) * uniq(p.mid) * uniq(p.suf);
  }, 0);
}

export function generateName(seeder: Seeder, culture: Culture, axes: SoulAxes): string {
  const ns = seeder.branch('name');
  const pool = PHONEMES[culture];
  const pre  = ns.nextChoice(pool.pre);
  const root = ns.nextChoice(pool.root);
  const mid  = ns.nextChoice(pool.mid);
  const suf  = ns.nextChoice(pool.suf);

  const raw = pre + root + mid + suf;
  // Capitalize first letter only
  const name = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return hardenName(name, phoneticHardness(axes));
}
