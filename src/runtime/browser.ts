/**
 * ENTRY del bundle para el navegador (esbuild → preview/engine.bundle.js).
 * Re-exporta el motor determinista + la capa de mundo vivo + el guardado, para que
 * el slice los importe por importmap ("betalife-engine") y corra el mundo EN VIVO.
 */
export * from '../engine/index';
export * from './liveWorld';
export * from '../save/saveState';
