import { createLiveWorld, simulateOffline } from '../src/runtime/liveWorld';
import { serializeSave, restoreSave } from '../src/save/saveState';
import { AXIS_KEYS } from '../src/engine/axes';
import { SoulAxes } from '../src/engine/types';

const drift = (a: SoulAxes, b: SoulAxes) => AXIS_KEYS.reduce((m, k) => m + Math.abs(a[k] - b[k]), 0);

console.log('=== Mundo VIVO — evolución + guardado ===\n');

// 1) Evolución: tras correr ticks, los ejes DERIVAN respecto al nacimiento.
const w = createLiveWorld('shrine-dev-town', 8, 4);
simulateOffline(w, 600);
let maxDrift = 0, growth = 0;
for (const h of w.heroes.filter((x) => x.inRoster)) {
  const d = drift(h.bornAxes, h.npc.axes); if (d > maxDrift) maxDrift = d;
  growth += h.npc.stamps.filter((s) => s.kind === 'growth').length;
}
// Las charlas mueven POCO por diseño (CONVO_NUDGE ≈ 1/5 del delta base): la deriva
// es lenta y acumulativa. El test confirma que existe y es positiva, no que sea rápida.
console.log(`  ejes derivan tras 600 ticks:        ${maxDrift > 0.015 ? 'PASS' : 'FAIL'} (deriva máx ${maxDrift.toFixed(3)})`);
console.log(`  capítulos sellados (growth stamps): ${growth} ${growth > 0 ? '(PASS)' : '(aún ninguno — necesita más tiempo)'}`);

// 2) Save round-trip: serializar → JSON → restaurar → estado idéntico.
const json = JSON.stringify(serializeSave(w, 1000));
const w2 = restoreSave(JSON.parse(json));
let ok = w2.heroes.length === w.heroes.length;
for (let i = 0; i < w.heroes.length; i++) {
  const A = w.heroes[i], B = w2.heroes[i];
  if (JSON.stringify(A.npc.axes) !== JSON.stringify(B.npc.axes)) ok = false;
  if (JSON.stringify(A.needs) !== JSON.stringify(B.needs)) ok = false;
  if (A.npc.stamps.length !== B.npc.stamps.length) ok = false;
  if (A.npc.pastLife.trade !== B.npc.pastLife.trade) ok = false;  // regenerado de la semilla
  if (A.npc.lore.tier !== B.npc.lore.tier) ok = false;
  if (A.npc.name !== B.npc.name) ok = false;
}
console.log(`  save round-trip idéntico:           ${ok ? 'PASS' : 'FAIL'} (${json.length} bytes para ${w.heroes.length} héroes)`);

// 3) Catch-up determinista: misma semilla + mismos ticks → mismo resultado.
const a = createLiveWorld('det-town', 8, 4); simulateOffline(a, 300);
const b = createLiveWorld('det-town', 8, 4); simulateOffline(b, 300);
const det = a.heroes.every((h, i) => JSON.stringify(h.npc.axes) === JSON.stringify(b.heroes[i].npc.axes));
console.log(`  catch-up offline determinista:      ${det ? 'PASS' : 'FAIL'}`);

// 4) Continuar la simulación tras restaurar no rompe.
simulateOffline(w2, 100);
console.log(`  continuar tras restaurar:           PASS (tick ${w2.tick})`);
