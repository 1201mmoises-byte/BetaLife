/**
 * BetaLife — RPG layer validation.
 *
 * Comprueba que la capa RPG (stats, skills, equipo, monstruos, combate,
 * progresión, expedición) respeta las reglas de diseño innegociables:
 * determinismo, pureza, muerte permanente, "ningún número al jugador", y que
 * los tres scaffolds (estrellas, nivel, rest) quedaron activos.
 *
 * Correr: npx ts-node scripts/testRpg.ts
 */
import { createTown, summonInTown, Town } from '../src/engine/town';
import { generateNPC } from '../src/engine/npcGenerator';
import { NPC, SoulAxes, StarRating } from '../src/engine/types';
import { createSeeder } from '../src/engine/seeder';
import { deriveStats, starStatFactor, levelStatFactor } from '../src/engine/stats';
import { deriveSkills } from '../src/engine/skills';
import {
  maxQualityForStars, unlockedSlots, equippableBy, affinityFor,
  generateEquipment, applyLoadout, Equipment,
} from '../src/engine/equipment';
import { generateFloorMonsters, monsterCountForFloor } from '../src/engine/monsters';
import { resolveCombat, Combatant } from '../src/engine/combat';
import { levelUp, applyFloorCleared, levelCap } from '../src/engine/progression';
import { runExpedition } from '../src/engine/expedition';
import { applyExperience } from '../src/engine/experience';

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail = '') {
  console.log(`  ${cond ? 'PASS' : 'FAIL'} — ${label}${detail ? `  (${detail})` : ''}`);
  cond ? pass++ : fail++;
}
const hasDigit = (s: string) => /\d/.test(s);

/** NPC con ejes forzados, para pruebas deterministas de derivación. */
function npcWith(axes: Partial<SoulAxes>, stars: StarRating = 3, level = 1): NPC {
  const base = generateNPC({ seed: 'rpg-fixture', stars, difficulty: 100 });
  const full = { ...base.axes };
  for (const k of Object.keys(axes) as (keyof SoulAxes)[]) full[k] = axes[k]!;
  return { ...base, axes: full, stars, level };
}

console.log('=== BetaLife — RPG Layer Validation ===\n');

// --- 1. STATS derivan del alma -------------------------------------------
console.log('--- 1. Stats se derivan de los ejes (ejes ≠ stats, pero stats salen del alma) ---');
{
  const tankAxes = { confidence: 0.95, caution: 0.95 };
  const glassAxes = { confidence: 0.05, caution: 0.05 };
  const tank = deriveStats(npcWith(tankAxes));
  const glass = deriveStats(npcWith(glassAxes));
  check('alma resiliente+cauta tiene más HP que la frágil', tank.maxHp > glass.maxHp, `${tank.maxHp} > ${glass.maxHp}`);

  const aggro = deriveStats(npcWith({ passivity: 0.05, confidence: 0.95 }));
  const meek = deriveStats(npcWith({ passivity: 0.95, confidence: 0.1 }));
  check('alma agresiva+segura pega más fuerte', aggro.atk > meek.atk, `${aggro.atk} > ${meek.atk}`);

  const fast = deriveStats(npcWith({ caution: 0.05, curiosity: 0.95 }));
  const slow = deriveStats(npcWith({ caution: 0.95, curiosity: 0.05 }));
  check('alma imprudente+curiosa es más veloz', fast.spd > slow.spd, `${fast.spd} > ${slow.spd}`);

  const s1 = deriveStats(npcWith({ confidence: 0.7 }, 1));
  const s5 = deriveStats(npcWith({ confidence: 0.7 }, 5));
  check('más estrellas → más stats', s5.maxHp > s1.maxHp, `5★ hp ${s5.maxHp} > 1★ hp ${s1.maxHp}`);
  check('starStatFactor 5★ = 1.60', Math.abs(starStatFactor(5) - 1.6) < 1e-9);
  check('levelStatFactor sube con nivel', levelStatFactor(10) > levelStatFactor(1));
  check('deriveStats es pura (hp arranca lleno)', s5.hp === s5.maxHp);
}

// --- 2. SKILLS emergen de ejes y stamps ----------------------------------
console.log('\n--- 2. Habilidades emergen del alma; observación sin números ---');
{
  const bold = deriveSkills(npcWith({ confidence: 0.9 }));
  check('confidence alta → Intimidar emerge', bold.some((s) => s.id === 'intimidar'));

  const kind = deriveSkills(npcWith({ altruism: 0.85 }));
  check('altruism alta → Proteger emerge', kind.some((s) => s.id === 'proteger'));

  const closed = deriveSkills(npcWith({ confidence: 0.5, altruism: 0.5, curiosity: 0.5, discipline: 0.5, warmth: 0.5, loyalty: 0.5, forgiveness: 0.5 }));
  check('alma centrada → sin habilidades de umbral', closed.length === 0, `${closed.length} skills`);

  // Maestría sellada por growth stamp permanece aunque el eje recaiga.
  const withStamp = npcWith({ discipline: 0.2 });
  withStamp.stamps = [...withStamp.stamps, { kind: 'growth', axisKey: 'discipline', bandValue: 1.0, sealedAt: 0 }];
  const mastered = deriveSkills(withStamp);
  check('growth stamp alto ancla maestría permanente pese a eje bajo', mastered.some((s) => s.id === 'maestria-tecnica' && s.source === 'stamp'));

  const allObs = [...bold, ...kind, ...mastered];
  check('ninguna observación de habilidad contiene números', allObs.every((s) => !hasDigit(s.observation)));
}

// --- 3. EQUIPMENT: gateo por estrellas, slots por nivel, afinidad ---------
console.log('\n--- 3. Equipamiento gateado por estrellas / nivel / arquetipo ---');
{
  check('maxQuality 1★ = 1', maxQualityForStars(1) === 1);
  check('maxQuality 5★ = 5', maxQualityForStars(5) === 5);
  check('nivel 1 → solo mainHand', unlockedSlots(1).length === 1);
  check('nivel 10 → 3 slots', unlockedSlots(10).length === 3);

  const item: Equipment = { id: 'x', name: 'X', type: 'weapon-heavy', slot: 'mainHand', quality: 4, mods: { atk: 10 }, observation: 'Algo pesado.' };
  check('1★ no puede empuñar calidad 4', !equippableBy(item, { stars: 1, level: 9 }));
  check('4★ sí puede empuñar calidad 4', equippableBy(item, { stars: 4, level: 9 }));
  check('arquetipo erudito favorece staff', affinityFor('erudito').includes('staff'));

  // applyLoadout es pura y respeta gateo + un objeto por slot.
  const npc = npcWith({}, 5, 10);
  const base = deriveStats(npc);
  const trinket: Equipment = { id: 't', name: 'T', type: 'trinket', slot: 'trinket', quality: 3, mods: { maxHp: 15 }, observation: 'Un dije.' };
  const loaded = applyLoadout(base, npc, [item, trinket]);
  check('loadout suma mods (HP sube con dije)', loaded.maxHp > base.maxHp);
  check('applyLoadout no muta el base', base.maxHp !== loaded.maxHp || base.atk !== loaded.atk);
}

// --- 4. MONSTERS deterministas y escalan con dificultad/piso --------------
console.log('\n--- 4. Monstruos deterministas, escalan con dificultad y piso ---');
{
  const easy = createTown('mundo-facil');     // dif rodada de la semilla
  const a = generateFloorMonsters(easy, 5);
  const b = generateFloorMonsters(easy, 5);
  check('mismo pueblo+piso → mismo encuentro', JSON.stringify(a) === JSON.stringify(b));
  check('conteo de monstruos crece con el piso', monsterCountForFloor(20) > monsterCountForFloor(1));

  const tEasy: Town = { ...createTown('e'), difficulty: 1, rosterFloor: 0 };
  const tHard: Town = { ...createTown('e'), id: 'h', difficulty: 1000, rosterFloor: 0 };
  const mEasy = generateFloorMonsters(tEasy, 10)[0];
  const mHard = generateFloorMonsters(tHard, 10)[0];
  check('misma semilla, mayor dificultad → monstruo más fuerte', mHard.stats.maxHp > mEasy.stats.maxHp, `${mHard.stats.maxHp} > ${mEasy.stats.maxHp}`);

  const deep = generateFloorMonsters(tEasy, 30)[0];
  check('piso profundo → monstruo más fuerte que piso somero', deep.stats.maxHp > mEasy.stats.maxHp);
  const allMon = [...a, ...b];
  check('observación de monstruo sin números', allMon.every((m) => !hasDigit(m.observation)));
}

// --- 5. COMBATE: determinista, permadeath, narración sin números, puro ----
console.log('\n--- 5. Combate determinista, muerte permanente, voz observable ---');
{
  const hero = npcWith({ confidence: 0.9, passivity: 0.1, caution: 0.4 }, 5, 8);
  const ally = npcWith({ altruism: 0.85, loyalty: 0.85, caution: 0.7 }, 3, 5);
  const party: Combatant[] = [hero, ally].map((n) => ({
    id: n.id + ':' + n.stars, name: n.name, stats: deriveStats(n), skills: deriveSkills(n), isNpc: true, axes: n.axes,
  }));
  const weakMobs: Combatant[] = generateFloorMonsters({ ...createTown('soft'), difficulty: 1, rosterFloor: 0 }, 1)
    .map((m) => ({ id: m.id, name: m.name, stats: m.stats, skills: [], isNpc: false, trait: m.trait }));

  const r1 = resolveCombat('battle-seed', party, weakMobs);
  const r2 = resolveCombat('battle-seed', party, weakMobs);
  check('mismo seed+combatientes → mismo resultado', JSON.stringify(r1) === JSON.stringify(r2));
  check('narración no contiene números (voz de la entidad)', r1.narration.every((l) => !hasDigit(l)));
  check('resolveCombat no muta los stats de entrada', party[0].stats.hp === party[0].stats.maxHp);
  check('genera un evento de combate por NPC', Object.keys(r1.npcEvents).length === party.length);

  // Pelea imposible: party debilísima vs monstruos brutales → caídas reales.
  const doomed: Combatant[] = [{ id: 'doomed', name: 'El Novato', stats: { maxHp: 10, hp: 10, atk: 1, def: 0, spd: 5 }, skills: [], isNpc: true, axes: hero.axes }];
  const brutal: Combatant[] = generateFloorMonsters({ ...createTown('brutal'), difficulty: 1000, rosterFloor: 90 }, 40)
    .map((m) => ({ id: m.id, name: m.name, stats: m.stats, skills: [], isNpc: false, trait: m.trait }));
  const rd = resolveCombat('doom', doomed, brutal);
  check('un NPC sin opciones CAE (permadeath registrada)', rd.outcome === 'defeat' && rd.fallenNpcIds.includes('doomed'));
  check('caída → evento de fracaso', rd.npcEvents['doomed'].outcome === 'failure');
}

// --- 6. SCAFFOLDS activados (estrellas, nivel, rest) ----------------------
console.log('\n--- 6. Scaffolds activados: estrellas, nivel, descanso ---');
{
  // Estrellas: misma exposición, un 5★ mueve más que un 1★.
  const axes = npcWith({ confidence: 0.5 }).axes;
  const stamps = npcWith({}).stamps;
  const ev = { kind: 'combat' as const, intensity: 1.0, outcome: 'success' as const };
  const move1 = applyExperience(createSeeder('s'), axes, stamps, ev, 1).axes.confidence - axes.confidence;
  const move5 = applyExperience(createSeeder('s'), axes, stamps, ev, 5).axes.confidence - axes.confidence;
  check('5★ progresa más rápido que 1★ (misma exposición)', Math.abs(move5) > Math.abs(move1), `${move5.toFixed(4)} vs ${move1.toFixed(4)}`);
  check('sin pasar stars, equivale a stars=1 (opt-in, multiplicador 1.0)',
    JSON.stringify(applyExperience(createSeeder('s'), axes, stamps, ev)) ===
    JSON.stringify(applyExperience(createSeeder('s'), axes, stamps, ev, 1)));

  // Rest ya recupera (antes era no-op).
  const tired = npcWith({ confidence: 0.3, optimism: 0.3 });
  const rested = applyExperience(createSeeder('r'), tired.axes, tired.stamps, { kind: 'rest', intensity: 1, outcome: 'success' });
  check('descanso recupera confianza (rest dejó de ser no-op)', rested.axes.confidence > tired.axes.confidence);
  check('descanso recupera optimismo', rested.axes.optimism > tired.axes.optimism);

  // Nivel: levelUp puro; tope ligado al piso.
  const lv = generateNPC({ seed: 'lvl', stars: 3, difficulty: 100 });
  const lifted = levelUp(lv);
  check('levelUp es puro (no muta) y suma 1', lv.level === 1 && lifted.level === 2);
  check('levelCap = floorReached + 1', levelCap(7) === 8);
  const cleared = applyFloorCleared({ ...lv, floorReached: 0 }, 1);
  check('superar piso sube floorReached y nivel dentro del tope', cleared.floorReached === 1 && cleared.level === 2);
  const capped = applyFloorCleared({ ...lv, level: 1, floorReached: 0 }, 0);
  check('no se puede subir nivel por encima del tope del piso', capped.level === 1);
}

// --- 7. EXPEDICIÓN: el bucle completo, puro y determinista ----------------
console.log('\n--- 7. Expedición: cierra el bucle (combate → alma evoluciona) ---');
{
  const town = createTown('shrine-dev-town');
  const party = [0, 1, 2].map((i) => summonInTown(town, i));
  const before = JSON.parse(JSON.stringify(party));

  const e1 = runExpedition(town, 1, party);
  const e2 = runExpedition(town, 1, party);
  check('expedición determinista (mismo town/piso/party)', JSON.stringify(e1.result) === JSON.stringify(e2.result));
  check('runExpedition no muta la party de entrada', JSON.stringify(party) === JSON.stringify(before));
  check('jugador solo ve narración observable (sin números)', e1.result.narration.every((l) => !hasDigit(l)));

  // Tras una victoria, al menos un superviviente cambió de alma o subió piso.
  if (e1.result.outcome === 'victory') {
    const survivor = e1.party.find((n) => n.isAlive && n.floorReached >= 1);
    check('victoria → superviviente registra piso/nivel', !!survivor, survivor ? `${survivor.name} lv${survivor.level} piso${survivor.floorReached}` : 'ninguno');
    check('victoria suelta botín', e1.drops.length === 1, e1.drops[0]?.observation);
  } else {
    check('derrota → caídos quedan isAlive:false', e1.party.some((n) => !n.isAlive));
  }

  // Escalar de verdad: bajar pisos crecientes evoluciona y eventualmente cobra vidas.
  let roster = party;
  let cleared = 0, anyFell = false;
  for (let floor = 1; floor <= 25; floor++) {
    const exp = runExpedition(town, floor, roster);
    roster = exp.party;
    if (exp.result.outcome === 'victory') cleared++;
    if (exp.result.fallenNpcIds.length) anyFell = true;
    if (!roster.some((n) => n.isAlive)) break;
  }
  check('una corrida de pisos progresa (limpia algunos pisos)', cleared > 0, `${cleared} pisos limpiados`);
  const maxFloor = Math.max(...roster.map((n) => n.floorReached));
  const maxLevel = Math.max(...roster.map((n) => n.level));
  check('el roster sube de nivel descendiendo', maxLevel > 1, `nivel máx ${maxLevel}, piso máx ${maxFloor}`);
  console.log(`     (corrida: ${cleared} pisos limpiados, ${anyFell ? 'hubo caídas' : 'sin caídas'}, vivos: ${roster.filter((n) => n.isAlive).length}/${roster.length})`);
}

console.log(`\n=== RPG validation: ${pass} PASS / ${fail} FAIL ===`);
if (fail > 0) process.exit(1);
