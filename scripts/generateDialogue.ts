/**
 * DEV TOOL — Genera el diálogo IA de las charlas de fondo y lo cachea.
 *
 * Corre la MISMA simulación que devPreview (previewSim) y, por cada charla única,
 * pide a Gemini (gratis) un diálogo natural entre los dos NPC. El resultado se
 * guarda en preview/dialogue-cache.json (se commitea) para que:
 *   - los rebuilds NO vuelvan a llamar a la API (gratis + reproducible), y
 *   - devPreview solo lea la caché y hornee el texto en el HTML (estático).
 *
 * IA: la clave vive SOLO como variable de entorno; nunca entra al repo ni al HTML.
 * Solo el TEXTO generado se cachea. Si no hay GEMINI_API_KEY (o la llamada falla),
 * se usa el fallback redactado en previewSim, así el build nunca se rompe.
 *
 * La llamada HTTP usa `curl` (respeta el proxy del entorno; el fetch global de
 * Node no honra HTTPS_PROXY y undici no está disponible aquí).
 *
 * Uso:
 *   GEMINI_API_KEY=xxxx npx ts-node --project tsconfig.json scripts/generateDialogue.ts
 *   (añade --force para regenerar todo ignorando la caché)
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { runPreviewSim, fallbackDialogue, DialogueLine, ExchangeRecord } from './previewSim';

const MODEL = 'gemini-2.0-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const CACHE_PATH = path.join(__dirname, '..', 'preview', 'dialogue-cache.json');

const TOPIC_DESC: Record<string, string> = {
  training: 'entrenamiento: técnicas y lo que han aprendido subiendo los pisos',
  survival: 'sobrevivir: miedos y el riesgo del próximo tramo',
  social:   'algo personal: un vínculo, alguien que les importa',
  hobby:    'un pasatiempo en común, algo ligero y sin urgencia',
  casual:   'cháchara sin agenda, solo acompañarse',
};

function buildPrompt(e: ExchangeRecord): string {
  return [
    'Dos personas de un mundo de fantasía conversan en privado, sin nadie más escuchando.',
    `PERSONA A (${e.aName}) se comporta así: ${e.cuesA.join(' ')}`,
    `PERSONA B (${e.bName}) se comporta así: ${e.cuesB.join(' ')}`,
    `Tema de la charla: ${TOPIC_DESC[e.topic] ?? TOPIC_DESC.casual}.`,
    'Escribe una conversación BREVE y natural entre A y B, como hablarían humanos reales:',
    '- 3 o 4 réplicas en total, alternando A y B (empieza A).',
    '- Frases cortas, coloquiales, coherentes con la personalidad de cada uno.',
    '- Sin narración, sin acotaciones, sin comillas alrededor. Solo lo que dicen.',
    'Devuelve SOLO un arreglo JSON con esta forma exacta:',
    '[{"speaker":"a","text":"..."},{"speaker":"b","text":"..."}]',
  ].join('\n');
}

function callGemini(apiKey: string, prompt: string): DialogueLine[] | null {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.95 },
  });
  let raw: string;
  try {
    raw = execFileSync(
      'curl',
      ['-sS', '-X', 'POST',
        '-H', 'Content-Type: application/json',
        '-H', `x-goog-api-key: ${apiKey}`,
        '--data-binary', '@-',
        ENDPOINT],
      { input: body, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
    );
  } catch (err: any) {
    console.warn('  curl falló:', err.message?.split('\n')[0]);
    return null;
  }
  try {
    const res = JSON.parse(raw);
    if (res.error) { console.warn('  API error:', res.error.message); return null; }
    const text = res?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) return null;
    const lines: DialogueLine[] = arr
      .map((l: any): DialogueLine => ({
        speaker: l.speaker === 'b' ? 'b' : 'a',
        text: String(l.text ?? '').trim(),
      }))
      .filter((l) => l.text.length > 0);
    return lines.length ? lines : null;
  } catch {
    return null;
  }
}

async function main() {
  const force = process.argv.includes('--force');
  const apiKey = process.env.GEMINI_API_KEY;

  const { log } = runPreviewSim();

  // Claves únicas (varias charlas comparten persona+tema → un solo diálogo).
  const byKey = new Map<string, ExchangeRecord>();
  for (const e of log) if (!byKey.has(e.key)) byKey.set(e.key, e);

  const cache: Record<string, DialogueLine[]> =
    !force && fs.existsSync(CACHE_PATH)
      ? JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
      : {};

  let viaGemini = 0, viaFallback = 0, cached = 0;

  if (!apiKey) {
    console.warn('⚠ Sin GEMINI_API_KEY — se usará el fallback redactado para todo.');
  }

  for (const [key, e] of byKey) {
    if (cache[key] && !force) { cached++; continue; }

    let lines: DialogueLine[] | null = null;
    if (apiKey) {
      lines = callGemini(apiKey, buildPrompt(e));
      if (lines) viaGemini++;
      // Respeta el límite del free tier (~15 RPM): pausa breve entre llamadas.
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!lines) { lines = fallbackDialogue(e); viaFallback++; }
    cache[key] = lines;
  }

  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');

  console.log(`✓ Charlas únicas: ${byKey.size}`);
  console.log(`  · Gemini   : ${viaGemini}`);
  console.log(`  · Fallback : ${viaFallback}`);
  console.log(`  · Ya en caché: ${cached}`);
  console.log(`✓ Caché: ${CACHE_PATH}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
