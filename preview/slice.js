import * as THREE from 'three';
// Motor determinista empaquetado (esbuild → engine.bundle.js): permite correr el
// mundo EN VIVO y persistirlo. Si fallara la carga, el slice sigue con los datos
// horneados (modo foto), así nunca se rompe.
let BL = null;
try { BL = await import('betalife-engine'); } catch(e){ console.warn('engine.bundle no cargó; modo horneado', e); }

// ─────────────────────────────────────────────────────────────────────────────
// Datos del MOTOR. Arranque: snapshot horneado por buildSlice; si BL cargó, lo
// volvemos VIVO (los ejes/needs evolucionan y se guardan), conservando el snapshot
// como respaldo.
// ─────────────────────────────────────────────────────────────────────────────
const DATA = window.BL_DATA;
// La semilla del pueblo. Si hay save, viene del save (restoreSave la reconstruye).
// Si es partida nueva, se genera ALEATORIA → cada partida tiene héroes y nombres
// distintos (antes era una constante, por eso siempre salían los mismos 8). El
// horneado DATA.town.seed queda solo como respaldo (modo horneado sin motor vivo).
function freshSeed(){
  const r = (window.crypto && crypto.getRandomValues)
    ? Array.from(crypto.getRandomValues(new Uint32Array(2))).join('')
    : (Date.now().toString(36) + Math.random().toString(36).slice(2));
  return 'town-' + r;
}
let TOWN_SEED = (DATA.town && DATA.town.seed) || 'shrine-dev-town';   // se reasigna al pueblo activo

// ── Reloj de doble tasa: pueblo 10× tiempo real, misión 1:1 ──────────────────
// 1 día de juego (24h) a 10× = 2.4 h reales = 8640 s. El ciclo visual día/noche
// usa este mismo valor, así "Día N" y el drenaje de necesidades quedan acoplados.
const DAY_LENGTH = 8640;
// Tick de necesidades: escala con DAY_LENGTH para que el hambre dure ~4 días de
// juego siempre. HAMBRE_DECAY=0.012/tick, 83.3 ticks para vaciar →
// NEEDS_TICK = DAY_LENGTH × 4 días × 0.012 ≈ 415 s.
const NEEDS_TICK = DAY_LENGTH * 0.048;

// ── Mundo VIVO + persistencia (device) ───────────────────────────────────────
const SAVE_KEY = 'betalife_save_v1';
let LIVE = null;
function loadSave(){ try{ const s=localStorage.getItem(SAVE_KEY); return s?JSON.parse(s):null; }catch(e){ return null; } }
let _saveT = 0;
function doSave(){ if(!LIVE||!BL) return; try{ localStorage.setItem(SAVE_KEY, JSON.stringify(BL.serializeSave(LIVE, Date.now()))); }catch(e){} }
function saveThrottled(){ const n=Date.now(); if(n-_saveT<4000) return; _saveT=n; doSave(); }

// Vuelve VIVO un héroe horneado `d`: sus campos dinámicos pasan a leer del NPC vivo.
function bindLive(d, lh){
  d._live = lh;
  const defun = (k, get, set) => Object.defineProperty(d, k, { get, set, configurable:true });
  defun('axesNow', ()=>lh.npc.axes);
  defun('needs', ()=>lh.needs, (v)=>{ lh.needs=v; });
  defun('needsStatus', ()=> BL.needsStatus(lh.needs));
  defun('emergent', ()=> BL.readEmergentTraits(lh.npc.axes));
  defun('memories', ()=> lh.npc.lore.memories.map(m=>m.text));
  defun('inRoster', ()=>lh.inRoster, (v)=>{ lh.inRoster=!!v; });
  defun('alive', ()=>lh.alive, (v)=>{ lh.alive=!!v; });
  // Identidad: leerla del NPC vivo (no del horneado) para que el roster refleje la
  // semilla aleatoria de la partida. `role` se queda posicional (no depende de semilla).
  defun('id',         ()=> lh.npc.id);   // así las reports horneadas (semilla vieja) caen a liveReading
  defun('name',       ()=> lh.npc.name);
  defun('stars',      ()=> lh.npc.stars);
  defun('trade',      ()=> lh.npc.pastLife.trade);
  defun('place',      ()=> lh.npc.pastLife.place);
  defun('tier',       ()=> lh.npc.lore.tier);
  defun('impression', ()=> lh.npc.observation);
}
// Lectura cualitativa de la Hada compuesta EN VIVO (sin números). Para héroes cuya
// semilla aleatoria no tiene reporte horneado: usa lo observable (impresión, rasgos
// emergentes, estado de necesidades). Sirve igual en modo horneado (lee los baked).
function liveReading(d){
  const imp = (d.impression||'nada salta a la vista todavía').replace(/\.+$/,'');
  const out = ['Veo a '+d.name+': '+imp+'.'];
  const em = d.emergent || [];
  if(em.length) out.push('Por dentro asoma '+em.slice(0,2).join(' y ')+'.');
  const ns = d.needsStatus || [];
  if(ns.length) out.push(ns.join('; ')+'.');
  return out.join(' ');
}
let HAS_SAVE = false;
if(BL){
  try{
    const saved = loadSave();
    HAS_SAVE = !!(saved && saved.heroes && saved.heroes.length);
    LIVE = HAS_SAVE ? BL.restoreSave(saved) : BL.createLiveWorld(freshSeed(), DATA.heroes.length, 0);
    TOWN_SEED = LIVE.town.seed;   // semilla activa: la del save o la nueva aleatoria
    if(HAS_SAVE){
      // catch-up offline: el mundo no paró mientras no estabas (determinista, acotado).
      // 10× tiempo real → segs de juego = secs*10; ticks = segs_de_juego / NEEDS_TICK.
      const secs = Math.max(0, (Date.now() - (saved.lastSeen||Date.now()))/1000);
      const ticks = Math.min(2000, Math.floor(secs*10/NEEDS_TICK));
      if(ticks>0){ BL.simulateOffline(LIVE, ticks); window.__catchupMins = Math.floor(secs/60); }
    }
    // enlazar cada héroe horneado con su NPC vivo (mismo orden/semilla)
    DATA.heroes.forEach((d,i)=>{ if(LIVE.heroes[i]) bindLive(d, LIVE.heroes[i]); });
    // If a page reload happened mid-expedition, recompute the result(s).
    // `teams` no se persiste en el guardado: tras recargar cae a una resolución
    // combinada (un solo equipo = todos los partyIds). Aceptable como respaldo.
    if(LIVE.expedition && !LIVE.expedition.resolvedResults && !LIVE.expedition.resolvedResult){
      try{
        const groups = (LIVE.expedition.teams && LIVE.expedition.teams.length)
          ? LIVE.expedition.teams : [LIVE.expedition.partyIds];
        LIVE.expedition.resolvedResults = groups.map(ids=>
          BL.runExpedition(LIVE.town, LIVE.expedition.floor,
            LIVE.heroes.filter(h=>ids.includes(h.npc.id)).map(h=>h.npc)));
        // Heroes are hidden (they're inside); hide their 3D groups after spawn
        window.__pendingHiddenIds = LIVE.expedition.partyIds.slice();
      }catch(e){ console.warn('expedition restore failed', e); LIVE.expedition=undefined; }
    }
  }catch(e){ console.warn('mundo vivo no inicializó; modo horneado', e); LIVE=null; }
}

// Paleta visual por rol (espejo de ROLE_VIS en devPreview.ts).
const ROLE_VIS = {
  warrior:{ skin:'#c09060', armor:'#3a4860', leg:'#22223a', accent:'#8fa6c8', kind:'helm' },
  mage:{    skin:'#b08868', armor:'#2a1f6e', leg:'#161046', accent:'#b48cff', kind:'hood' },
  rogue:{   skin:'#c09a74', armor:'#3a2f1c', leg:'#1a1510', accent:'#caa15a', kind:'bandana' },
  archer:{  skin:'#b07850', armor:'#2a3820', leg:'#1a2012', accent:'#8fc88c', kind:'plain' },
};
const hx = (c)=>new THREE.Color(c);

// Textura de grama (mota verde) para el piso exterior no jugable.
function grassTexture(){
  const c=document.createElement('canvas'); c.width=c.height=256;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#36502a'; ctx.fillRect(0,0,256,256);
  const tones=['#3e5e2a','#314c22','#476b30','#2c441f','#52753a'];
  for(let i=0;i<2200;i++){ ctx.fillStyle=tones[i%tones.length];
    const x=Math.random()*256, y=Math.random()*256, s=Math.random()*3+1; ctx.fillRect(x,y,s,s); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(22,22);
  return t;
}
// Resplandor radial (para el halo del sol).
function radialTexture(){
  const c=document.createElement('canvas'); c.width=c.height=128;
  const ctx=c.getContext('2d');
  const g=ctx.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.28,'rgba(255,240,200,0.55)');
  g.addColorStop(1,'rgba(255,220,170,0)');
  ctx.fillStyle=g; ctx.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(c);
}

// ── Escena, cámara isométrica, renderer ──────────────────────────────────────
const app = document.getElementById('app');
const scene = new THREE.Scene();
scene.background = hx('#05050d');
scene.fog = new THREE.FogExp2(0x05050d, 0.014);

const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

// Ortográfica = look isométrico. Encadrada por un "frustum size" que controla zoom.
let frustum = 27;
const cam = new THREE.OrthographicCamera(-1,1,1,-1,0.1,200);
function framedCamera(){
  const a = window.innerWidth / window.innerHeight;
  cam.left=-frustum*a/2; cam.right=frustum*a/2; cam.top=frustum/2; cam.bottom=-frustum/2;
  cam.updateProjectionMatrix();
}
framedCamera();
// Vista del jugador: ángulo plano (mira un pelín hacia arriba, no picado),
// pensado para que la visión se mantenga si el mundo se expande.
let camAzimuth = Math.PI*0.25;     // rotación horizontal (drag de un dedo)
let camPitch   = 0.34;             // ~19° desde el horizonte → ángulo bajo
let camDist    = 30;               // distancia al objetivo
const camTarget = new THREE.Vector3(0, 2.4, 0);   // mira a media altura (estructuras, no el suelo)
function placeCamera(){
  const h = Math.sin(camPitch)*camDist;
  const r = Math.cos(camPitch)*camDist;
  cam.position.set(
    camTarget.x + Math.cos(camAzimuth)*r,
    camTarget.y + h,
    camTarget.z + Math.sin(camAzimuth)*r
  );
  cam.lookAt(camTarget);
}
function focusOn(pos){   // centra la vista en algo sin bajar el ángulo (mantiene la altura del objetivo)
  camTarget.x += (pos.x - camTarget.x)*0.6;
  camTarget.z += (pos.z - camTarget.z)*0.6;
  placeCamera();
}
placeCamera();

// ── Ciclo día/noche: sol cálido de día, luna y luces de noche ────────────────
const ambient = new THREE.AmbientLight(0x4a4470, 1.0); scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffe6b0, 1.5);
sun.castShadow = true; sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-22; sun.shadow.camera.right=22;
sun.shadow.camera.top=22; sun.shadow.camera.bottom=-22; sun.shadow.camera.far=120;
scene.add(sun);
const moon = new THREE.DirectionalLight(0x9fb0e0, 0.45); scene.add(moon);
const fill = new THREE.HemisphereLight(0x8a7ac0, 0x0c0a18, 0.6); scene.add(fill);
// discos del sol y la luna en el cielo
const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(2.4,16,16),
  new THREE.MeshBasicMaterial({ color:0xffe2a0 }));
scene.add(sunDisc);
// halo del sol (reflejo/resplandor) — sigue al disco
let sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map:radialTexture(), color:0xffe0a0,
  transparent:true, opacity:0.5, blending:THREE.AdditiveBlending, depthWrite:false, depthTest:false }));
sunGlow.scale.set(26,26,1); sunDisc.add(sunGlow);
const moonDisc = new THREE.Mesh(new THREE.SphereGeometry(1.6,16,16),
  new THREE.MeshBasicMaterial({ color:0xd8dcf0 }));
scene.add(moonDisc);

const SKY_NIGHT = new THREE.Color(0x070613);
const SKY_DAY   = new THREE.Color(0x2a4a78);
const FOG_NIGHT = new THREE.Color(0x070613);
const FOG_DAY   = new THREE.Color(0x35517e);
let NIGHT = 0;                 // 0 = pleno día, 1 = plena noche (lo usan antorchas/fogata)
let starMat = null;            // se asigna abajo
let skyMat = null;             // domo de cielo (gradiente), se asigna abajo
const SKYTOP_DAY=new THREE.Color(0x2563a8), SKYTOP_NIGHT=new THREE.Color(0x05050f);
const SKYBOT_DAY=new THREE.Color(0xa6c4e0), SKYBOT_NIGHT=new THREE.Color(0x130f2a);
function updateSky(tod){       // tod 0..1
  const ang = tod * Math.PI * 2;          // 0 = amanecer
  const el  = Math.sin(ang);              // elevación del sol -1..1
  const day = THREE.MathUtils.smoothstep(el, -0.18, 0.30);  // 0 noche .. 1 día
  NIGHT = 1 - day;
  // posiciones en el cielo
  sunDisc.position.set(Math.cos(ang)*44, el*46, -22);
  moonDisc.position.set(Math.cos(ang+Math.PI)*44, Math.sin(ang+Math.PI)*46, -22);
  sun.position.copy(sunDisc.position).multiplyScalar(0.5).add(new THREE.Vector3(0,4,6));
  moon.position.copy(moonDisc.position).multiplyScalar(0.4);
  // intensidades (un poco más de luz en general)
  sun.intensity = 2.1*day + 0.08; moon.intensity = 0.75*NIGHT;
  ambient.intensity = 0.85 + 0.8*day; fill.intensity = 0.6 + 0.55*day;
  sunDisc.visible = el > -0.25; moonDisc.visible = Math.sin(ang+Math.PI) > -0.25;
  if(sunGlow) sunGlow.material.opacity = 0.55*day;
  // cielo y niebla
  scene.background = SKY_NIGHT.clone().lerp(SKY_DAY, day);
  if(scene.fog) scene.fog.color.copy(FOG_NIGHT.clone().lerp(FOG_DAY, day));
  if(skyMat){
    skyMat.uniforms.top.value.copy(SKYTOP_NIGHT).lerp(SKYTOP_DAY, day);
    skyMat.uniforms.bottom.value.copy(SKYBOT_NIGHT).lerp(SKYBOT_DAY, day);
  }
  if(starMat) starMat.opacity = 0.03 + 0.85*NIGHT;
}

// ── Estrellas en el cielo ────────────────────────────────────────────────────
(function stars(){
  const g = new THREE.BufferGeometry();
  const N = 600, pos = new Float32Array(N*3);
  for(let i=0;i<N;i++){
    const r = 70 + Math.random()*40;
    const th = Math.random()*Math.PI*2, ph = Math.random()*Math.PI*0.5;
    pos[i*3]   = Math.cos(th)*Math.sin(ph+0.2)*r;
    pos[i*3+1] = Math.cos(ph)*r*0.6 + 8;
    pos[i*3+2] = Math.sin(th)*Math.sin(ph+0.2)*r;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const m = new THREE.PointsMaterial({ color:0xffffff, size:0.35, sizeAttenuation:true,
    transparent:true, opacity:0.85 });
  starMat = m;
  scene.add(new THREE.Points(g, m));
})();

// ── Cielo: domo con gradiente (horizonte → cenit), transiciona día/noche ──────
(function skyDome(){
  skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite:false, fog:false,
    uniforms:{ top:{ value:new THREE.Color(0x2563a8) }, bottom:{ value:new THREE.Color(0xa6c4e0) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*0.55 + 0.35, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }',
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(170, 32, 16), skyMat);
  dome.renderOrder = -1; scene.add(dome);
})();

// ── Suelo: grama exterior (no jugable) + piso del pueblo dentro de la muralla ─
(function ground(){
  // grama que se extiende a los lados, fuera de la torre y la muralla
  const grass = new THREE.Mesh(new THREE.CircleGeometry(130, 80),
    new THREE.MeshStandardMaterial({ map:grassTexture(), color:0x86a861, roughness:1, metalness:0 }));
  grass.rotation.x = -Math.PI/2; grass.position.y = -0.05; grass.receiveShadow = true; scene.add(grass);
  // piso del pueblo (dentro de la muralla, radio ~18). Leve metalness = un reflejo del sol.
  const inner = new THREE.Mesh(new THREE.CircleGeometry(18, 64),
    new THREE.MeshStandardMaterial({ color:0x18141f, roughness:0.85, metalness:0.12 }));
  inner.rotation.x = -Math.PI/2; inner.position.y = 0; inner.receiveShadow = true; scene.add(inner);
  // anillo tenue alrededor del Shrine
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.0, 3.4, 48),
    new THREE.MeshBasicMaterial({ color:0x5a3aa0, transparent:true, opacity:0.18, side:THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI/2; ring.position.set(-6, 0.02, 3);
  scene.add(ring);
})();

// Sprite de etiqueta (nombre de estructura / héroe) generado por canvas.
function makeLabel(text, color){
  const c = document.createElement('canvas'); c.width=256; c.height=64;
  const ctx = c.getContext('2d');
  ctx.font = '600 30px Georgia, serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.fillStyle = color;
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, depthTest:false }));
  spr.scale.set(4.2, 1.05, 1);
  return spr;
}

// ── Estructuras (las 5) ──────────────────────────────────────────────────────
const PLACES = {};   // nombre → { group, pos }
function place(name, x, z){ const p = new THREE.Vector3(x, 0, z); PLACES[name] = { pos:p }; return p; }

// posiciones en el suelo
const P_TORRE  = place('torre',  0,  -8);
const P_SHRINE = place('shrine', -6,  3);
const P_POSADA = place('posada', 7,  -2);
const P_CAMPO  = place('campo',  6,   5);
const P_FUSION = place('fusion', -7, -4);
const P_PLAZA  = place('plaza',  0,   1);

// Torre — ancla visual dominante, NO enterable
(function torre(){
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(2.0, 2.8, 13, 6),
    new THREE.MeshStandardMaterial({ color:0x141026, roughness:.9, flatShading:true }));
  body.position.y = 6.5; body.castShadow = true; g.add(body);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(2.6, 3, 6),
    new THREE.MeshStandardMaterial({ color:0x0e0b1c, roughness:.9, flatShading:true }));
  roof.position.y = 14.5; g.add(roof);
  // ventanas que brillan (emisivas)
  for(let i=0;i<5;i++){
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.7,0.2),
      new THREE.MeshStandardMaterial({ color:0x6a4aa0, emissive:0x9060e0, emissiveIntensity:1.2 }));
    w.position.set(0, 3+i*2.2, 2.1); g.add(w);
  }
  const tip = new THREE.PointLight(0xb080ff, 12, 22, 1.5); tip.position.set(0,15,0); g.add(tip);
  PLACES.torre.tipLight = tip;
  g.position.copy(P_TORRE); scene.add(g);
  const lbl = makeLabel('La Torre', '#b080ff'); lbl.position.set(0, 17, 0); g.add(lbl);
  PLACES.torre.group = g;
})();

// Shrine — Hada + invocación
(function shrine(){
  const g = new THREE.Group();
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.9,0.5,8),
    new THREE.MeshStandardMaterial({ color:0x1a1430, roughness:.8, flatShading:true }));
  dais.position.y=0.25; dais.castShadow=true; dais.receiveShadow=true; g.add(dais);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.7),
    new THREE.MeshStandardMaterial({ color:0xc8a8ff, emissive:0x9060e0, emissiveIntensity:1.6, flatShading:true }));
  crystal.position.y=1.8; g.add(crystal);
  const cl = new THREE.PointLight(0xc0a0ff, 10, 14, 1.6); cl.position.y=1.8; g.add(cl);
  g.position.copy(P_SHRINE); scene.add(g);
  const lbl = makeLabel('Shrine', '#c8a8ff'); lbl.position.set(0,3.4,0); g.add(lbl);
  PLACES.shrine.group = g; PLACES.shrine.crystal = crystal;
})();

// Posada — viven / descansan / socializan
(function posada(){
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2,2.2,2.6),
    new THREE.MeshStandardMaterial({ color:0x241a30, roughness:.95, flatShading:true }));
  body.position.y=1.1; body.castShadow=true; g.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6,1.4,4),
    new THREE.MeshStandardMaterial({ color:0x3a2030, roughness:.9, flatShading:true }));
  roof.position.y=2.9; roof.rotation.y=Math.PI/4; g.add(roof);
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.7,0.1),
    new THREE.MeshStandardMaterial({ color:0xd0a050, emissive:0xf0b040, emissiveIntensity:1 }));
  win.position.set(0,1.1,1.35); g.add(win);
  const wl = new THREE.PointLight(0xf0b040, 8, 11, 1.7); wl.position.set(0,1.2,2); g.add(wl);
  g.position.copy(P_POSADA); scene.add(g);
  const lbl = makeLabel('Posada', '#f0c87a'); lbl.position.set(0,4.1,0); g.add(lbl);
  PLACES.posada.group = g;
})();

// Campo de Entrenamiento — crecimiento observable (amplio)
(function campo(){
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CircleGeometry(4.4,40),
    new THREE.MeshStandardMaterial({ color:0x16170e, roughness:1 }));
  pad.rotation.x=-Math.PI/2; pad.position.y=0.02; pad.receiveShadow=true; g.add(pad);
  // valla baja alrededor del campo
  const fenceMat = new THREE.MeshStandardMaterial({ color:0x3a2a18, roughness:.9, flatShading:true });
  for(let i=0;i<18;i++){
    const a=(i/18)*Math.PI*2;
    const post=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.7,5), fenceMat);
    post.position.set(Math.cos(a)*4.3, 0.35, Math.sin(a)*4.3); g.add(post);
  }
  // varios muñecos de entrenamiento repartidos
  for(const [dx,dz] of [[-2,1.2],[2,1.2],[-1.6,-1.8],[1.6,-1.8],[0,2.6]]){
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.15,1.7,6),
      new THREE.MeshStandardMaterial({ color:0x4a3420, roughness:.9, flatShading:true }));
    post.position.set(dx,0.85,dz); post.castShadow=true; g.add(post);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34,8,8),
      new THREE.MeshStandardMaterial({ color:0x6a5038, roughness:.9, flatShading:true }));
    head.position.set(dx,1.8,dz); g.add(head);
  }
  g.position.copy(P_CAMPO); scene.add(g);
  const lbl = makeLabel('Campo de Entrenamiento', '#9fc88c'); lbl.position.set(0,3.6,0); lbl.scale.set(5.6,1.4,1); g.add(lbl);
  PLACES.campo.group = g;
})();

// Cámara de los Ecos — Merger (un "chamber" cerrado con eco interior)
const echoRings = [];
(function chamber(){
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color:0x231425, roughness:.9, flatShading:true });
  // piso elevado
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.7,0.5,6), stoneMat);
  floor.position.y=0.25; floor.castShadow=true; floor.receiveShadow=true; g.add(floor);
  // muros hexagonales con UNA abertura: la entrada mira al centro del pueblo
  const R=2.0, H=2.6, doorAngle=Math.atan2(-P_FUSION.z, -P_FUSION.x);
  for(let i=0;i<6;i++){
    const a=(i/6)*Math.PI*2 + Math.PI/6;
    const da=Math.atan2(Math.sin(a-doorAngle), Math.cos(a-doorAngle));
    if(Math.abs(da) < 0.6) continue;   // deja el hueco de la puerta
    const wall=new THREE.Mesh(new THREE.BoxGeometry(2.2,H,0.35), stoneMat);
    wall.position.set(Math.cos(a)*R, H/2+0.5, Math.sin(a)*R);
    wall.lookAt(0,H/2+0.5,0); wall.castShadow=true; g.add(wall);
  }
  // techo cónico hexagonal
  const roof=new THREE.Mesh(new THREE.ConeGeometry(2.8,1.7,6),
    new THREE.MeshStandardMaterial({ color:0x1a0f1e, roughness:.9, flatShading:true }));
  roof.position.y=H+0.5+0.85; roof.rotation.y=Math.PI/6; roof.castShadow=true; g.add(roof);
  // cristal del eco (flota dentro) + luz pulsante
  const echo=new THREE.Mesh(new THREE.OctahedronGeometry(0.5),
    new THREE.MeshStandardMaterial({ color:0xe0a0c0, emissive:0xc0506a, emissiveIntensity:1.7, flatShading:true }));
  echo.position.y=1.6; g.add(echo);
  const gl=new THREE.PointLight(0xc0506a, 9, 12, 1.6); gl.position.y=1.6; g.add(gl);
  // anillos de eco en el piso (ondean hacia afuera)
  for(let i=0;i<2;i++){
    const ring=new THREE.Mesh(new THREE.RingGeometry(0.55,0.72,40),
      new THREE.MeshBasicMaterial({ color:0xc0506a, transparent:true, opacity:0.45, side:THREE.DoubleSide, depthWrite:false }));
    ring.rotation.x=-Math.PI/2; ring.position.y=0.52; g.add(ring);
    echoRings.push({ ring, phase:i*0.5 });
  }
  g.position.copy(P_FUSION); scene.add(g);
  const lbl = makeLabel('Cámara de los Ecos', '#ff7090'); lbl.position.set(0,H+3.0,0); lbl.scale.set(5.2,1.3,1); g.add(lbl);
  PLACES.fusion.group = g; PLACES.fusion.echo = echo;
})();

// ── La Hada — pequeña hada luminosa (cuerpo + alas) que vaga por todo el mundo ─
const hada = new THREE.Group();
const fairyWings = [];
(function buildFairy(){
  // cuerpo luminoso
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.26, 4, 8),
    new THREE.MeshStandardMaterial({ color:0xfff2ff, emissive:0xd2a6ff, emissiveIntensity:1.8 }));
  body.position.y = 0.05; hada.add(body);
  // cabecita
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12),
    new THREE.MeshStandardMaterial({ color:0xffe8dc, emissive:0xc0a0f0, emissiveIntensity:0.7 }));
  head.position.y = 0.3; hada.add(head);
  // halo (sprite, siempre de frente)
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map:radialTexture(), color:0xc8a8ff,
    transparent:true, opacity:0.7, blending:THREE.AdditiveBlending, depthWrite:false, depthTest:false }));
  halo.scale.set(2.0, 2.0, 1); halo.position.y = 0.1; hada.add(halo);
  // alas: dos pares translúcidos que aletean
  const wingMat = new THREE.MeshStandardMaterial({ color:0xd6c0ff, emissive:0x9866e0,
    emissiveIntensity:0.6, transparent:true, opacity:0.55, side:THREE.DoubleSide, depthWrite:false });
  function wing(sideSign, up){
    const pivot = new THREE.Group();
    const geo = new THREE.CircleGeometry(0.28, 14); geo.translate(0.28, 0, 0); geo.scale(1, up?1.4:1.0, 1);
    pivot.add(new THREE.Mesh(geo, wingMat.clone()));
    pivot.position.set(0, 0.12 + (up?0.04:-0.06), -0.02); pivot.scale.x = sideSign;
    hada.add(pivot); fairyWings.push({ pivot, up });
  }
  wing(1,true); wing(-1,true); wing(1,false); wing(-1,false);
})();
const hadaLight = new THREE.PointLight(0xc8a8ff, 8, 13, 1.6); hada.add(hadaLight);
hada.position.set(P_SHRINE.x+1.6, 2.8, P_SHRINE.z+0.5);
scene.add(hada);

// Vaga por todo el mundo: elige puntos (estructuras, plaza, a veces fuera sobre la grama)
let hadaBaseY = 2.8, hadaTimer = 0;
const hadaTarget = new THREE.Vector3(P_PLAZA.x, 2.9, P_PLAZA.z);
const HADA_SPOTS = [P_PLAZA, P_SHRINE, P_POSADA, P_CAMPO, P_FUSION, P_TORRE];
function hadaRoam(dt){
  hadaTimer -= dt;
  if(hadaTimer <= 0){
    hadaTimer = 4 + Math.random()*5;
    if(Math.random() < 0.22){    // a veces sale sobre la grama, fuera de la muralla
      const a = Math.random()*Math.PI*2;
      hadaTarget.set(Math.cos(a)*22, 3.0 + Math.random()*1.6, Math.sin(a)*22);
    } else {
      const q = HADA_SPOTS[Math.floor(Math.random()*HADA_SPOTS.length)];
      hadaTarget.set(q.x + (Math.random()-0.5)*3, 2.7 + Math.random()*1.5, q.z + (Math.random()-0.5)*3);
    }
  }
  hada.position.x += (hadaTarget.x - hada.position.x) * dt*0.5;
  hada.position.z += (hadaTarget.z - hada.position.z) * dt*0.5;
  hadaBaseY += (hadaTarget.y - hadaBaseY) * dt*0.5;
  hada.position.y = hadaBaseY + Math.sin(worldT*1.7)*0.06;
  hada.lookAt(cam.position.x, hada.position.y, cam.position.z);   // de frente a la cámara
  // aleteo
  for(const w of fairyWings){
    w.pivot.rotation.y = (w.up?0.5:0.35) + Math.sin(worldT*16 + (w.up?0:0.4)) * (w.up?0.5:0.35);
  }
}

// ── Antorchas y fuegos (se encienden de noche) ───────────────────────────────
const fires = [];   // { light, flame, base, mat }
function makeFire(x, y, z, scale, baseInt, color){
  const g = new THREE.Group();
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.18*scale, 0.62*scale, 7),
    new THREE.MeshBasicMaterial({ color: color||0xffb050, transparent:true, opacity:0.95,
      blending:THREE.AdditiveBlending, depthWrite:false }));
  flame.position.y = 0.32*scale; g.add(flame);
  // halo suave alrededor del fuego
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.34*scale, 10, 10),
    new THREE.MeshBasicMaterial({ color: color||0xffa040, transparent:true, opacity:0.25,
      blending:THREE.AdditiveBlending, depthWrite:false }));
  halo.position.y = 0.34*scale; g.add(halo);
  // luz real: decay bajo + buen alcance para que ilumine de verdad
  const light = new THREE.PointLight(color||0xffa040, baseInt, 16*scale, 1.6);
  light.position.y = 0.5*scale; g.add(light);
  g.position.set(x, y, z); scene.add(g);
  fires.push({ light, flame, base:baseInt, mat:flame.material, hmat:halo.material, phase:Math.random()*9 });
  return g;
}
function makeTorch(x, z){
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.09,1.5,6),
    new THREE.MeshStandardMaterial({ color:0x3a2a1a, roughness:.9, flatShading:true }));
  post.position.set(x, 0.75, z); post.castShadow=true; scene.add(post);
  makeFire(x, 1.55, z, 0.8, 16, 0xffb050);
}

// Muralla circular de fondo, en SEGMENTOS para poder desvanecer los de enfrente
// (así la vista del jugador "pasa a través" del muro al moverse). R amplio para
// dejar sitio si el mundo crece más adelante.
const WALL_R = 17;
const wallPieces = [];   // piezas con material propio (opacidad independiente)
(function wall(){
  const H = 2.8, N = 48;
  const panelW = (2*Math.PI*WALL_R/N)*1.12;
  for(let i=0;i<N;i++){
    const a = (i/N)*Math.PI*2, x = Math.cos(a)*WALL_R, z = Math.sin(a)*WALL_R;
    const mat = new THREE.MeshStandardMaterial({ color:0x241d34, roughness:.95, flatShading:true, transparent:true, depthWrite:false });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(panelW, H, 0.5), mat);
    panel.position.set(x, H/2, z); panel.lookAt(0, H/2, 0);
    panel.castShadow = true; panel.receiveShadow = true; scene.add(panel); wallPieces.push(panel);
    if(i % 2 === 0){
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(panelW*0.42, 0.6, 0.56), mat);
      merlon.position.set(x, H+0.3, z); merlon.lookAt(0, H+0.3, 0); scene.add(merlon); wallPieces.push(merlon);
    }
  }
  // torreones + antorchas repartidas por la muralla
  for(let i=0;i<8;i++){
    const a = (i/8)*Math.PI*2, tx = Math.cos(a)*WALL_R, tz = Math.sin(a)*WALL_R;
    const tmat = new THREE.MeshStandardMaterial({ color:0x1e1830, roughness:.95, flatShading:true, transparent:true, depthWrite:false });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.9,1.0,H+1.6,8), tmat);
    tower.position.set(tx, (H+1.6)/2, tz); tower.castShadow=true; scene.add(tower); wallPieces.push(tower);
    makeFire(tx, H+1.7, tz, 0.9, 11, 0xffa840);
  }
})();

// Antorchas junto a cada sitio
[P_SHRINE, P_POSADA, P_CAMPO, P_FUSION].forEach(p=>{
  makeTorch(p.x+1.6, p.z+1.2); makeTorch(p.x-1.6, p.z-1.2);
});

// Fogata central en la plaza (el corazón del pueblo de noche)
(function bonfire(){
  const g = new THREE.Group();
  for(let i=0;i<5;i++){
    const a=(i/5)*Math.PI*2;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,1.1,6),
      new THREE.MeshStandardMaterial({ color:0x3a2818, roughness:.9, flatShading:true }));
    log.position.set(Math.cos(a)*0.3, 0.15, Math.sin(a)*0.3);
    log.rotation.z = 0.5; log.rotation.y = a; g.add(log);
  }
  g.position.copy(P_PLAZA); scene.add(g);
  makeFire(P_PLAZA.x, 0.45, P_PLAZA.z, 1.8, 48, 0xff8a30);
})();

// ── Héroes ───────────────────────────────────────────────────────────────────
function buildHero(role){
  const v = ROLE_VIS[role] || ROLE_VIS.archer;
  const g = new THREE.Group();
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.34,0.5,0.24),
    new THREE.MeshStandardMaterial({ color:hx(v.leg), roughness:.9, flatShading:true }));
  legs.position.y=0.25; legs.castShadow=true; g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.6,0.32),
    new THREE.MeshStandardMaterial({ color:hx(v.armor), roughness:.85, flatShading:true }));
  torso.position.y=0.78; torso.castShadow=true; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24,10,10),
    new THREE.MeshStandardMaterial({ color:hx(v.skin), roughness:.8, flatShading:true }));
  head.position.y=1.25; head.castShadow=true; g.add(head);
  // toque de clase
  if(v.kind==='helm'){
    const h=new THREE.Mesh(new THREE.SphereGeometry(0.26,10,10,0,Math.PI*2,0,Math.PI/2),
      new THREE.MeshStandardMaterial({color:hx(v.accent),metalness:.4,roughness:.5,flatShading:true}));
    h.position.y=1.30; g.add(h);
  } else if(v.kind==='hood'){
    const h=new THREE.Mesh(new THREE.ConeGeometry(0.30,0.5,8),
      new THREE.MeshStandardMaterial({color:hx(v.armor),roughness:.9,flatShading:true}));
    h.position.y=1.40; g.add(h);
  } else if(v.kind==='bandana'){
    const h=new THREE.Mesh(new THREE.TorusGeometry(0.24,0.05,6,12),
      new THREE.MeshStandardMaterial({color:hx('#6a2030'),roughness:.8,flatShading:true}));
    h.position.y=1.28; h.rotation.x=Math.PI/2; g.add(h);
  }
  return g;
}

const ACTIVITY_SPOTS = ['campo','posada','plaza','shrine'];
const heroes = [];   // { data, group, state, target, timer, speed, phase, alive }
function spawnHero(data, atIndex){
  const role = data.role;
  const group = buildHero(role);
  // dispersión inicial alrededor de la plaza
  const ang = (atIndex/4)*Math.PI*2;
  group.position.set(P_PLAZA.x+Math.cos(ang)*2.5, 0, P_PLAZA.z+Math.sin(ang)*2.5);
  scene.add(group);
  const lbl = makeLabel(data.name, '#c8b8f0'); lbl.position.y=2.0; lbl.scale.set(2.4,0.6,1);
  group.add(lbl);
  const h = { data, group, state:'idle', target:null, timer:1+Math.random()*2,
              speed:0.9+Math.random()*0.5, phase:Math.random()*Math.PI*2, alive:true, partner:null };
  heroes.push(h);
  return h;
}

// estado de actividad por héroe — derivado de necesidades reales + personalidad
function pickActivity(h){
  const nd = h.data._live ? h.data._live.needs : h.data.needs;
  if(nd){
    // Iniciativa graduada: probabilidad escala con la urgencia, no un umbral fijo.
    // A hambre=0.65 ya se nota el apetito (~20%); a 0.38 casi siempre (~85%); a 0 = 100%.
    const hUrg = Math.max(0, (0.70 - nd.hambre) / 0.70);
    const dUrg = Math.max(0, (0.60 - nd.descanso) / 0.60);
    if(nd.hambre < 0.70 && Math.random() < hUrg * 0.9 && h.state !== 'eat'){
      h.target='posada'; h._nextState='eat'; h.state='walking'; return;
    }
    if(nd.descanso < 0.60 && Math.random() < dUrg * 0.8 && h.state !== 'rest'){
      h.target='posada'; h._nextState='rest'; h.state='walking'; return;
    }
  }
  // Procesar orden de la Hada si hay una activa
  if(h._order && h._orderT > 0){
    const orderTarget = { eat:'posada', rest:'posada', train:'campo', cheer:'plaza' }[h._order];
    if(orderTarget){
      const obeyed = obeyChance(h, h._order);
      if(obeyed){
        h.target = orderTarget;
        h._nextState = (h._order==='eat')?'eat':(h._order==='rest')?'rest':(h._order==='train')?'train':'idle';
        h.state = 'walking';
        markObeyed(h);
        return;
      }
    }
    h._order = null; h._orderT = 0;
  }
  // Comportamiento libre
  const r = Math.random();
  let spot;
  if(r < 0.38) spot = 'plaza';
  else if(h.data.role==='warrior' || h.data.role==='archer') spot = r<0.7?'campo':'posada';
  else if(h.data.role==='mage') spot = r<0.68?'shrine':'campo';
  else spot = r<0.7?'posada':'campo';
  h.target = spot;
  h._nextState = null;
  h.state = 'walking';
}

// ── Catch-up offline: el mundo no para ───────────────────────────────────────
// El catch-up real (ticks de necesidades + charlas) ya corre arriba vía
// saved.lastSeen + BL.simulateOffline (10× tiempo real, NEEDS_TICK). Esto solo
// mantiene LS_KEY como respaldo de timestamp para modo horneado (sin save).
const LS_KEY = 'betalife_slice_lastSeen';
(function offline(){
  const now = Date.now();
  const last = parseInt(localStorage.getItem(LS_KEY)||'0', 10);
  if(last && !HAS_SAVE){
    const mins = Math.floor((now-last)/60000);
    if(mins >= 1) window.__catchupMins = mins;
  }
  localStorage.setItem(LS_KEY, String(now));
})();

// ── Picking (raycaster): clic en Hada / estructuras / héroes ─────────────────
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
function pointerToScene(ev){
  const x = (ev.clientX/window.innerWidth)*2-1;
  const y = -(ev.clientY/window.innerHeight)*2+1;
  ptr.set(x,y); ray.setFromCamera(ptr, cam);
}
function pickHero(){
  for(const h of heroes){ if(!h.alive) continue;
    if(ray.intersectObject(h.group, true).length) return h; }
  return null;
}
function pickPlace(){
  const dist = {};
  for(const k of ['shrine','fusion','torre','posada','campo']){
    const grp = PLACES[k].group; if(!grp) continue;
    if(ray.intersectObject(grp, true).length) return k;
  }
  return null;
}

// ── Navegación: 1 dedo = rotar · 2 dedos = zoom + desplazar · rueda = zoom ────
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const pointers = new Map();
let moved=false, downX=0, downY=0, pinchPrev=0;
function pinchDist(){ const a=[...pointers.values()]; return Math.hypot(a[0].x-a[1].x, a[0].y-a[1].y); }
function panBy(sx, sy){
  // mueve el objetivo por el plano del suelo según la orientación de la cámara
  const right = new THREE.Vector3(Math.sin(camAzimuth), 0, -Math.cos(camAzimuth));
  const fwd   = new THREE.Vector3(-Math.cos(camAzimuth), 0, -Math.sin(camAzimuth));
  const k = frustum / window.innerHeight;     // mundo por píxel (aprox)
  camTarget.addScaledVector(right, -sx*k);
  camTarget.addScaledVector(fwd,    sy*k);
  // por ahora el mundo es el pueblo: límite suave (crecerá si el mundo se expande)
  const maxR = WALL_R - 3, d = Math.hypot(camTarget.x, camTarget.z);
  if(d > maxR){ camTarget.x *= maxR/d; camTarget.z *= maxR/d; }
  placeCamera();
}
function doPick(e){
  pointerToScene(e);
  if(TUTORIAL){
    // sólo responde la estructura que el tutorial pide que TOQUES tú mismo
    if(tutStep==='summon' && pickPlace()==='shrine'){ tutDoSummon(); return; }
    if(tutStep==='fusion' && pickPlace()==='fusion'){ tutHintClear(); clearHighlight(); openSheet('sheet-merge'); return; }
    // tocar la Hada en pasos de "ve y toca" sólo recuerda la indicación
    if(ray.intersectObject(hada, true).length){
      if(tutStep==='summon' || tutStep==='fusion') tutHintPulse(); else openSheet('sheet-hada');
      return;
    }
    return;
  }
  if(ray.intersectObject(hada, true).length){ openHada(); return; }
  const h = pickHero(); if(h){ heroReading(h); return; }
  const p = pickPlace(); if(p){ onPlace(p); return; }
}
const dom = renderer.domElement;
dom.addEventListener('pointerdown', (e)=>{
  dom.setPointerCapture && dom.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if(pointers.size===1){ moved=false; downX=e.clientX; downY=e.clientY; }
  if(pointers.size===2){ pinchPrev = pinchDist(); }
});
dom.addEventListener('pointermove', (e)=>{
  const p = pointers.get(e.pointerId); if(!p) return;
  const dx = e.clientX-p.x, dy = e.clientY-p.y;
  p.x=e.clientX; p.y=e.clientY;
  if(pointers.size===1){
    if(Math.abs(e.clientX-downX)+Math.abs(e.clientY-downY) > 5) moved=true;
    camAzimuth -= dx*0.005; placeCamera();
  } else if(pointers.size===2){
    moved=true;
    const d = pinchDist();
    if(pinchPrev){ frustum = clamp(frustum*(pinchPrev/d), 12, 46); framedCamera(); }
    pinchPrev = d;
    panBy(dx*0.5, dy*0.5);
  }
});
function endPointer(e){
  const wasOne = pointers.size===1;
  pointers.delete(e.pointerId);
  if(wasOne && !moved) doPick(e);
  if(pointers.size<2) pinchPrev=0;
}
dom.addEventListener('pointerup', endPointer);
dom.addEventListener('pointercancel', endPointer);
dom.addEventListener('wheel', (e)=>{
  e.preventDefault();
  frustum = clamp(frustum + Math.sign(e.deltaY)*1.6, 12, 46); framedCamera();
}, { passive:false });

window.addEventListener('resize', ()=>{ renderer.setSize(innerWidth,innerHeight); framedCamera(); });

// ─────────────────────────────────────────────────────────────────────────────
// OVERLAYS (HTML) — la Hada conversación, roster, merger
// ─────────────────────────────────────────────────────────────────────────────
const SHEETS = ['sheet-hada','sheet-roster','sheet-merge','sheet-dev','sheet-torre'];
function openSheet(id){ SHEETS.forEach(s=>document.getElementById(s).classList.toggle('open', s===id)); }
function closeSheets(){ SHEETS.forEach(s=>document.getElementById(s).classList.remove('open')); }
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeSheets()));

// toast de estructura
let toastT=null;
function toast(html){
  const t = document.getElementById('place-toast');
  t.innerHTML = html; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(()=>t.classList.remove('show'), 3400);
}

// ── La Hada: conversación ramificada (pocas opciones, como hablar) ───────────
const thread = document.getElementById('hada-thread');
const intentsEl = document.getElementById('hada-intents');
function bub(side, html){
  const row = document.createElement('div'); row.className='row '+side;
  row.innerHTML = (side==='left'?'<span class="ava">✦</span>':'') + '<div class="bubble '+(side==='left'?'fairy':'me')+'">'+html+'</div>';
  thread.appendChild(row);
  const body = thread.closest('.sheet-body'); if(body) body.scrollTop = body.scrollHeight;
}
function fairySays(html, after){
  // burbuja "escribiendo" → reemplaza por el texto
  const row = document.createElement('div'); row.className='row left';
  row.innerHTML = '<span class="ava">✦</span><div class="bubble fairy"><span class="typing"><span></span><span></span><span></span></span></div>';
  thread.appendChild(row);
  const body = thread.closest('.sheet-body'); if(body) body.scrollTop = body.scrollHeight;
  setTimeout(()=>{ row.querySelector('.bubble').innerHTML = html; if(after) after(); if(body) body.scrollTop=body.scrollHeight; }, 520);
}
function setIntents(list){
  intentsEl.innerHTML='';
  list.forEach(it=>{
    const b=document.createElement('button');
    b.className='intent '+(it.cls||'soft'); b.innerHTML=it.label;
    b.addEventListener('click', it.act); intentsEl.appendChild(b);
  });
}
// ── Sistema de órdenes de la Hada ─────────────────────────────────────────────
const orderStats = {};   // h.id → { given:n, obeyed:n }
function obeyChance(h, type){
  const ax = h.data.axesNow || h.data.axes || {};
  if(type==='train') return Math.random() < (0.4 + (ax.confidence||0.5)*0.6);
  if(type==='cheer') return Math.random() < (0.3 + (ax.sociability||0.5)*0.7);
  if(type==='eat')   return Math.random() < 0.85;
  if(type==='rest')  return Math.random() < 0.75;
  return Math.random() < 0.6;
}
function markObeyed(h){
  if(!orderStats[h.data.id]) orderStats[h.data.id]={given:0,obeyed:0};
  orderStats[h.data.id].obeyed++;
}
function issueOrder(type){
  const ORDER_FAIRY = {
    eat:   'Id a la Posada — es una orden. Un cuerpo vacío no aprende ni lucha.',
    rest:  'Descansad. El agotamiento mata más lento que la espada, pero igual de seguro.',
    train: 'Al Campo, todos. El músculo sin uso es músculo perdido. Moved.',
    cheer: 'Id a la plaza. Un pueblo que no se conoce no resiste. Acercaos.',
  };
  fairySays(ORDER_FAIRY[type], ()=>{
    heroes.filter(h=>h.alive).forEach(h=>{
      if(!orderStats[h.data.id]) orderStats[h.data.id]={given:0,obeyed:0};
      orderStats[h.data.id].given++;
      h._order=type; h._orderT=30;
    });
    setIntents([{label:'Volver', cls:'back', act:hadaRoot}]);
  });
}
function obedienceLabel(id){
  const s = orderStats[id]; if(!s || s.given===0) return null;
  const r = s.obeyed / s.given;
  if(r >= 0.8) return 'siempre obedece';
  if(r >= 0.5) return 'a veces lo hace';
  return 'hace lo que quiere';
}

// lista EN VIVO (incluye héroes recién invocados; excluye a los que ya no están)
function liveRoster(){ return DATA.heroes.filter(h=>h.inRoster && h.alive!==false); }
function heroPickIntents(then){
  setIntents(liveRoster().map(h=>({ label:h.name, act:()=>{ bub('right', h.name); then(h); } }))
    .concat([{ label:'volver', cls:'back', act:hadaRoot }]));
}
function hadaRoot(){
  setIntents([
    { label:'Saber cómo van', act:()=>{ bub('right','Saber cómo van'); askKnow(); } },
    { label:'Pedirte algo',   act:()=>{ bub('right','Pedirte algo'); askRequest(); } },
    { label:'Explícame algo', act:()=>{ bub('right','Explícame algo'); askExplain(); } },
  ]);
}
function askKnow(){
  fairySays('¿De qué quieres que te hable?', ()=> setIntents([
    { label:'Del pueblo', act:()=>{ bub('right','Del pueblo'); fairySays(DATA.hada.situation, hadaRoot); } },
    { label:'De alguien', act:()=>heroPickIntents(h=>{
        const rep = DATA.hada.reports[h.id] || liveReading(h);
        const obe = obedienceLabel(h.id);
        const full = obe ? rep+' Las órdenes: '+obe+'.' : rep;
        fairySays(full, hadaRoot);
      }) },
    { label:'¿Qué hay arriba?', cls:'back', act:()=>{ bub('right','¿Qué hay en la Torre?'); fairySays('La Torre llama. Si hay almas dispuestas a subir, puedes enviarlas desde ella. Yo estaré aquí cuando vuelvan — o cuando no.', hadaRoot); } },
    { label:'volver', cls:'back', act:hadaRoot },
  ]));
}
function askRequest(){
  fairySays('Doy la orden. Obedecerán... o no. Eso me dice quiénes son.', ()=> setIntents([
    { label:'Que coman',          act:()=>{ bub('right','Que coman');          issueOrder('eat');   } },
    { label:'Que descansen',      act:()=>{ bub('right','Que descansen');      issueOrder('rest');  } },
    { label:'Que entrenen',       act:()=>{ bub('right','Que entrenen');       issueOrder('train'); } },
    { label:'Animar al pueblo',   act:()=>{ bub('right','Animar al pueblo');   issueOrder('cheer'); } },
    { label:'El Eco…', cls:'danger', act:()=>{ bub('right','Un Eco'); fairySays('Eso es la única orden que nadie puede rechazar. Ven a la Cámara.', ()=>{ setTimeout(()=>{ openSheet('sheet-merge'); }, 400); }); } },
    { label:'volver', cls:'back', act:hadaRoot },
  ]));
}
function askExplain(){
  fairySays('¿El qué?', ()=> setIntents(
    DATA.hada.rules.map(r=>({ label:r.label, act:()=>{ bub('right',r.label); fairySays(r.text, hadaRoot); } }))
    .concat([{ label:'volver', cls:'back', act:hadaRoot }])
  ));
}
let hadaOpened=false;
function openHada(){
  openSheet('sheet-hada');
  if(TUTORIAL) return;
  if(pendingReport){ deliverReport(); return; }
  if(!hadaOpened){
    hadaOpened=true;
    if(window.__catchupMins){
      fairySays('Volviste. Mientras no estabas, el pueblo siguió: '+(DATA.catchup[0]||'la vida continuó, sin pausa.')+' Nada se detiene aquí.', hadaRoot);
    } else {
      fairySays('Aquí estoy. ¿Qué deseas hacer… o quieres que te explique algo?', hadaRoot);
    }
  }
}

// ── Lectura de un héroe (clic directo) — la Hada lo interpreta ───────────────
function heroReading(h){
  focusOn(h.group.position);
  openSheet('sheet-hada');
  bub('right','¿Cómo está '+h.data.name+'?');
  fairySays(DATA.hada.reports[h.data.id] || liveReading(h.data), hadaRoot);
  if(!hadaOpened) hadaOpened=true;
}

// ── Torre: forma la expedición por EQUIPOS (el Master elige; el alma manda) ────
// Fiel al manga/novela: se sube por EQUIPOS de 2 a 5. Según la misión (el piso),
// la Torre puede pedir VARIOS equipos. El jugador arma cada equipo eligiendo del
// roster vivo; el que se NIEGA no puede ir (su alma manda); cada héroe va en un
// solo equipo. El reto (piso) lo marca el progreso del roster, no a quién metas.
const PARTY_MIN = 2, PARTY_MAX = 5;
const DISP_LABEL = { listo:'listo', dudoso:'dudoso', niega:'se niega' };

function volunteerAxes(h){
  return (h.data._live && h.data._live.npc.axes) || h.data.axesNow || {};
}
// Disposición del alma ante la Torre: 'listo' | 'dudoso' | 'niega'.
function disposition(h){
  const ax = volunteerAxes(h);
  const conf = (ax.confidence==null?0.5:ax.confidence);
  const pass = (ax.passivity==null?0.5:ax.passivity);
  const opt  = (ax.optimism==null?0.5:ax.optimism);
  if(conf < 0.30 || pass > 0.80) return 'niega';
  if(conf > 0.60 && pass < 0.55 && opt > 0.45) return 'listo';
  return 'dudoso';
}

function torreTypeLine(text){
  const el = document.getElementById('torre-fairy-line');
  el.textContent = '';
  let i = 0;
  const iv = setInterval(()=>{ el.textContent += text[i++]; if(i>=text.length) clearInterval(iv); }, 18);
}

// El reto de la Torre va por el progreso del roster (su altura no cambia según a
// quién subas). Piso de la misión = piso más profundo alcanzado + 1.
function missionFloor(){
  const living = heroes.filter(h=>h.alive);
  const deepest = living.reduce((m,h)=>{
    const f = (h.data._live ? h.data._live.npc.floorReached : (h.data.floorReached||0)) || 0;
    return f>m?f:m;
  }, 0);
  return Math.max(1, deepest + 1);
}
// Cuántos equipos pide la misión: crece en pisos hito (cada 5 y cada 10).
function missionTeams(floor){
  let n = 1;
  if(floor % 5 === 0) n++;
  if(floor % 10 === 0) n++;
  return n;
}
// Mínimo por equipo (2; pero si solo queda un alma viva, 1 con advertencia).
function teamMin(){ return heroes.filter(h=>h.alive).length <= 1 ? 1 : PARTY_MIN; }

function teamOf(id){ for(let i=0;i<torreTeams.length;i++){ if(torreTeams[i].has(id)) return i; } return -1; }
function totalChosen(){ return torreTeams.reduce((s,t)=>s+t.size,0); }
function teamsValid(){ const m=teamMin(); return torreTeams.length>0 && torreTeams.every(t=>t.size>=m && t.size<=PARTY_MAX); }

function renderTeamTabs(){
  const bar = document.getElementById('torre-party'); if(!bar) return;
  const plural = torreTeams.length>1;
  let html = '<div class="party-count">Piso '+torreFloor+' · la misión pide '+torreTeams.length+
    ' equipo'+(plural?'s':'')+' · '+teamMin()+'–'+PARTY_MAX+' por equipo</div><div class="team-tabs">';
  torreTeams.forEach((t,i)=>{
    const ok = t.size>=teamMin() && t.size<=PARTY_MAX;
    html += '<button class="team-tab'+(i===torreActive?' active':'')+(ok?' done':'')+'" data-team="'+i+'">'+
      'Equipo '+(i+1)+' · '+t.size+'/'+PARTY_MAX+'</button>';
  });
  html += '</div>';
  bar.innerHTML = html;
  bar.querySelectorAll('.team-tab').forEach(b=>b.addEventListener('click',()=>{ torreActive = +b.dataset.team; refreshTorre(); }));
}

function renderRosterCards(){
  const living = heroes.filter(h=>h.alive);
  const grid = document.getElementById('torre-volunteers'); grid.innerHTML='';
  living.forEach(h=>{
    const disp = disposition(h);
    const t = teamOf(h.data.id);
    const card = document.createElement('div');
    card.className = 'hero-card' + (disp==='niega'?' refuses':'') + (t>=0?' in-party':'');
    const badge = t>=0 ? '<div class="team-badge">E'+(t+1)+'</div>' : '';
    const lv2 = h.data._live ? h.data._live.npc.level : (h.data.level||1);
    card.innerHTML = badge + '<div class="portrait">'+bustHTML(h.data)+'</div>'+
      '<div class="hero-name">'+h.data.name+'</div>'+
      '<div class="hero-stars">'+('★'.repeat(h.data.stars))+'</div>'+
      '<div class="hero-level">Lv. '+lv2+'</div>'+
      heroStatsHTML(h.data, lv2)+
      '<div class="hero-volunteer-label disp-'+disp+'">'+DISP_LABEL[disp]+'</div>';
    if(disp!=='niega') card.addEventListener('click',()=>toggleHeroTeam(h));
    grid.appendChild(card);
  });
}

function updateSendButton(){
  const btn = document.getElementById('btn-send-tower');
  if(teamsValid()){
    btn.classList.add('ready'); btn.disabled = false;
    btn.textContent = torreTeams.length>1
      ? 'Enviar '+torreTeams.length+' equipos ('+totalChosen()+') →'
      : (torreTeams[0].size===1 ? 'Enviar a uno solo →' : 'Enviar expedición ('+totalChosen()+') →');
  } else {
    btn.classList.remove('ready'); btn.disabled = true;
    btn.textContent = 'Completa los equipos ('+teamMin()+'–'+PARTY_MAX+')';
  }
}

function reactLine(){
  const living = heroes.filter(h=>h.alive);
  const chosen = living.filter(h=>teamOf(h.data.id)>=0);
  if(chosen.length===0){ torreTypeLine('Arma '+(torreTeams.length>1?'los equipos':'el equipo')+'. La Torre devora a quien sube solo.'); return; }
  if(chosen.length===1 && living.length<=1){
    torreTypeLine('Solo queda un alma con vida. Si sube sola, puede que no baje. Es tu decisión.'); return;
  }
  const dud = chosen.filter(h=>disposition(h)==='dudoso').length;
  if(dud===0){ torreTypeLine(chosen.length+' suben con paso firme. Se cuidarán entre ellos.'); return; }
  if(dud===chosen.length){ torreTypeLine('Todos dudan. Suben con miedo — y el miedo pesa arriba.'); return; }
  torreTypeLine(chosen.length+' suben; '+dud+' con reservas. Que los firmes cuiden a los que tiemblan.');
}

function refreshTorre(){ renderTeamTabs(); renderRosterCards(); updateSendButton(); reactLine(); }

function toggleHeroTeam(h){
  if(disposition(h)==='niega') return;        // su alma manda: no puede ir
  const id = h.data.id, t = teamOf(id);
  if(t>=0){ torreTeams[t].delete(id); }       // ya estaba en un equipo → lo saco
  else {
    if(torreTeams[torreActive].size >= PARTY_MAX) return;  // equipo activo lleno
    torreTeams[torreActive].add(id);
  }
  refreshTorre();
}

function openTowerSheet(){
  if(TUTORIAL) return;
  // Block if expedition already running
  if(LIVE && LIVE.expedition){ toast('<b>La Torre</b> — ya hay almas dentro. Espera a que vuelvan.'); return; }
  const living = heroes.filter(h=>h.alive);
  if(!living.length){ toast('<b>La Torre</b> — no queda nadie con vida para subir.'); return; }
  torreFloor = missionFloor();
  let need = missionTeams(torreFloor);
  // No pedir más equipos de los que el roster puede formar (mín. 2 por equipo).
  const feasible = Math.max(1, Math.floor(living.length / PARTY_MIN));
  need = Math.min(need, feasible);
  torreTeams = []; for(let i=0;i<need;i++){ torreTeams.push(new Set()); }
  torreActive = 0;
  refreshTorre();
  openSheet('sheet-torre');
}

function walkHeroToTower(h, onArrival){
  const g = h.group;
  const iv = setInterval(()=>{
    const dx=P_TORRE.x-g.position.x, dz=P_TORRE.z-g.position.z;
    const d=Math.hypot(dx,dz);
    if(d<1.2){ clearInterval(iv); onArrival(); }
    else { const sp=0.08; g.position.x+=dx/d*sp; g.position.z+=dz/d*sp; g.rotation.y=Math.atan2(dx,dz); }
  },16);
}

function launchExpedition(){
  if(!LIVE||!BL){ toast('El motor no está disponible.'); return; }
  const floor = torreFloor;
  const teams = torreTeams.map(t=>[...t]).filter(ids=>ids.length>0);
  const partyIds = teams.flat();
  if(!partyIds.length) return;

  // Misión 'standard': cada equipo libra su propia pelea contra el piso (su propia
  // suerte/bajas). Gancho futuro: tipos como 'asedio' (todos sobreviviendo oleadas
  // en coordinación) requerirán sistema de oleadas en el motor — aún no existe.
  const resolvedResults = teams.map(ids=>{
    const party = ids.map(id=>{ const lh=LIVE.heroes.find(h=>h.npc.id===id); return lh?lh.npc:null; }).filter(Boolean);
    return BL.runExpedition(LIVE.town, floor, party);
  });

  const duration = Math.min((floor + 1) * 90, 480);
  const returnAt = Math.floor(Date.now() / 1000) + duration;
  // `partyIds` (plano) lo usan render/guardado; `teams`+`resolvedResults` viven en
  // memoria (si recargas a mitad, cae a una resolución combinada — ver restauración).
  LIVE.expedition = { teams, partyIds, floor, returnAt, resolvedResults };
  doSave();

  // Salida: frase por personalidad + caminan a la Torre y desaparecen.
  const DEPART_LINES = {
    optimista:'Será rápido.', cauto:'No tengo otra opción.',
    inseguro:'Ojalá.', sombrío:'Así termina todo.',
    sereno:'Vuelvo.', cálido:'Cuidaos mientras.', curioso:'Quiero ver qué hay arriba.',
  };
  const confirmedHeroes = heroes.filter(h=>partyIds.includes(h.data.id));
  confirmedHeroes.forEach((h,idx)=>{
    h.state = 'tower';
    setTimeout(()=>{ if(h.alive) say(h, DEPART_LINES[toneOf(h)]||'Vuelvo.'); }, idx*400);
    setTimeout(()=>{
      walkHeroToTower(h, ()=>{ h.group.visible=false; });
    }, idx*300);
  });

  // Tower tip pulse
  const tip = PLACES.torre.tipLight;
  if(tip){ tip.intensity=22; setTimeout(()=>{ tip.intensity=12; },2000); }

  // HUD
  const sub = document.getElementById('hud-sub');
  if(sub && !TUTORIAL) sub.textContent='esperando noticias…';
}

// ── Estructuras ──────────────────────────────────────────────────────────────
function onPlace(k){
  if(k==='shrine'){ invoke(); }
  else if(k==='fusion'){ openSheet('sheet-merge'); }
  else if(k==='torre'){ openTowerSheet(); }
  else if(k==='posada'){ toast('<b>Posada</b> — aquí descansan, comen y se cuentan cosas.'); }
  else if(k==='campo'){ toast('<b>Campo de Entrenamiento</b> — crecen practicando. Tiene su techo y su riesgo.'); }
}

// ── Invocación (Shrine) — ritual con coste, héroe sin desarrollar ────────────
function summonNext(){
  const d = DATA.heroes.find(h=>!h.inRoster);   // siguiente del pool sin invocar
  if(!d) return null;
  d.inRoster = true;
  const cr = PLACES.shrine.crystal;             // destello del cristal
  if(cr){ cr.material.emissiveIntensity = 4; setTimeout(()=>cr.material.emissiveIntensity=1.6, 350); }
  spawnHero(d, heroes.length);
  return d;
}
function invoke(){
  if(TUTORIAL) return;   // durante el tutorial la invocación la guía la Hada
  const d = summonNext();
  if(!d){ toast('<b>Shrine</b> — no queda esencia para invocar por ahora.'); return; }
  toast('<b>Ritual</b> — llega <b>'+d.name+'</b> ('+('★'.repeat(d.stars))+'). Cuesta esencia; vendrá sin desarrollar.');
  // la Hada se entera en el acto: si su chat está abierto, lo anuncia
  if(document.getElementById('sheet-hada').classList.contains('open')){
    fairySays('Llegó alguien nuevo: '+d.name+'. Aún sin pulir, pero ya respira con nosotros — pregúntame por él cuando quieras.', hadaRoot);
  }
}

// ── Roster ───────────────────────────────────────────────────────────────────
function depthBlocks(level){
  const filled=Math.min(level||1,5);
  return '<span class="depth-blocks">'+'▪'.repeat(filled)+'▫'.repeat(5-filled)+'</span>';
}

function readinessLabel(d){
  if (d.alive === false) return '<span class="readiness caido">caído</span>';
  return '<span class="readiness en-forma">en forma</span>';
}

/** Stats de combate compactos para el jugador — para armar estrategia, no microgestión. */
function heroStatsHTML(d, lv){
  if(!BL || !BL.deriveStats) return '';
  const axes = d._live ? d._live.npc.axes : d.axesNow;
  if(!axes) return '';
  const st = BL.deriveStats({axes, stars:d.stars, level:lv});
  // HP bar: color bands 100-70 green · 69-40 yellow · 39-10 red · 9-0 all-red warning
  const nd = d._live ? d._live.needs : d.needs;
  const hp = nd ? Math.max(0, nd.health) : 1;
  const hpPct = Math.round(hp * 100);
  const hpCol = hp <= 0.09 ? '#b05050' : hp <= 0.39 ? '#b05050' : hp <= 0.69 ? '#b0903a' : '#5a8868';
  const hpClass = hp <= 0.09 ? 'hp-crit' : hp <= 0.39 ? 'hp-low' : hp <= 0.69 ? 'hp-mid' : 'hp-ok';
  const hpBar = '<div class="hero-hp-wrap '+hpClass+'"><div class="hero-hp-label"><b>HP</b><span>'+hpPct+'%</span></div>'+
    '<div class="hero-hp-track"><div class="hero-hp-fill" style="width:'+hpPct+'%;background:'+hpCol+'"></div></div></div>';
  return hpBar+'<div class="hero-stats">'+
    '<span class="hs atk"><b>ATK</b>'+st.atk+'</span>'+
    '<span class="hs def"><b>DEF</b>'+st.def+'</span>'+
    '<span class="hs spd"><b>VEL</b>'+st.spd+'</span>'+
    '<span class="hs hp-max"><b>HP máx</b>'+st.maxHp+'</span>'+
  '</div>';
}

function bustHTML(d){
  const v = ROLE_VIS[d.role]||ROLE_VIS.archer;
  let cap='';
  if(v.kind==='helm') cap='<div class="b-helm"></div>';
  else if(v.kind==='hood') cap='<div class="b-hood" style="--robe:'+v.armor+'"></div>';
  else if(v.kind==='bandana') cap='<div class="b-bandana"></div>';
  return '<div class="bust" style="--skin:'+v.skin+';--armor:'+v.armor+'"><div class="b-glow"></div>'+cap+
    '<div class="b-head"><span class="b-eye l"></span><span class="b-eye r"></span></div><div class="b-torso"></div></div>';
}
const CLASS_ES = { warrior:'guerrero', mage:'mago', rogue:'pícaro', archer:'arquero' };
function renderRoster(){
  const grid = document.getElementById('roster-grid'); grid.innerHTML='';
  DATA.heroes.filter(h=>h.inRoster).forEach(d=>{
    const lv  = d._live ? d._live.npc.level       : (d.level||1);
    const flr = d._live ? d._live.npc.floorReached : (d.floorReached||0);
    const card = document.createElement('div'); card.className='hero-card';
    card.innerHTML = '<div class="portrait">'+bustHTML(d)+'</div>'+
      '<div class="hero-name">'+d.name+'</div>'+
      '<div class="hero-class">'+(CLASS_ES[d.role]||d.role)+'</div>'+
      '<div class="hero-stars">'+('★'.repeat(d.stars))+'</div>'+
      '<div class="hero-level">Lv. '+lv+(flr>0?' · piso '+flr:'')+'</div>'+
      heroStatsHTML(d, lv)+
      depthBlocks(lv) +
      readinessLabel(d);
    card.addEventListener('click', ()=>{
      const h = heroes.find(x=>x.data.id===d.id);
      closeSheets();
      if(h){ focusOn(h.group.position); setTimeout(()=>heroReading(h),260); }
    });
    grid.appendChild(card);
  });
}
document.getElementById('btn-roster').addEventListener('click', ()=>{ renderRoster(); openSheet('sheet-roster'); });
document.getElementById('btn-send-tower').addEventListener('click',()=>{
  if(!teamsValid()) return;
  closeSheets();
  launchExpedition();
});

// ── Merger / Cámara de Fusión ────────────────────────────────────────────────
let sac=null, rec=null;
function renderPicker(){
  const pk = document.getElementById('merge-picker'); pk.innerHTML='';
  DATA.heroes.filter(h=>h.inRoster && h.alive!==false).forEach(d=>{
    const c=document.createElement('button'); c.className='pick-chip';
    c.innerHTML=d.name+'<span class="ps">'+('★'.repeat(d.stars))+'</span>';
    c.addEventListener('click', ()=>{
      if(!sac || (sac && rec)){ sac=d; rec=null; }   // reinicia ciclo
      else if(d.id!==sac.id){ rec=d; }
      paintMerge();
    });
    pk.appendChild(c);
  });
}
function slotFill(elId, emptyId, d, kind){
  const slot=document.getElementById(elId), empty=document.getElementById(emptyId);
  slot.querySelectorAll('.slot-name,.slot-stars,.bust-wrap').forEach(n=>n.remove());
  if(d){ slot.classList.add('filled'); empty.style.display='none';
    const w=document.createElement('div'); w.className='bust-wrap'; w.style.transform='scale(.8)'; w.innerHTML=bustHTML(d);
    const nm=document.createElement('div'); nm.className='slot-name'; nm.textContent=d.name;
    const st=document.createElement('div'); st.className='slot-stars'; st.textContent='★'.repeat(d.stars);
    slot.appendChild(w); slot.appendChild(nm); slot.appendChild(st);
  } else { slot.classList.remove('filled'); empty.style.display='block'; }
}
function paintMerge(){
  slotFill('slot-sac','sac-empty',sac,'s');
  slotFill('slot-rec','rec-empty',rec,'r');
  const rx=document.getElementById('merge-reaction'), btn=document.getElementById('btn-do-merge');
  if(sac && rec){
    rx.innerHTML='<b>'+rec.name+'</b> guardará el eco de <b>'+sac.name+'</b> — un impulso <em>leve</em>, transferido a pérdida. La comunidad lo sentirá: los leales callan, los rebeldes lo resienten, los temerosos obedecen.';
    btn.classList.add('ready');
  } else {
    rx.innerHTML='Elige a quién sacrificas y quién recibe. El valor se transfiere <em>a pérdida</em>: un impulso leve, nunca un atajo.';
    btn.classList.remove('ready');
  }
}
function executeFusion(sacData, recData, onDone){
  const victim = heroes.find(x=>x.data.id===sacData.id);
  const recH   = heroes.find(x=>x.data.id===recData.id);
  // víctima: camina hacia la Cámara y se desvanece
  if(victim){
    victim.alive=false; victim.data.alive=false;
    const vg=victim.group;
    // mueve hacia P_FUSION
    const moveV = setInterval(()=>{
      const dx=P_FUSION.x-vg.position.x, dz=P_FUSION.z-vg.position.z;
      const d=Math.hypot(dx,dz); if(d<0.2){ clearInterval(moveV); return; }
      vg.position.x+=dx/d*0.07; vg.position.z+=dz/d*0.07;
      vg.rotation.y=Math.atan2(dx,dz);
    }, 16);
    setTimeout(()=>{
      clearInterval(moveV);
      let o=1; const fade=setInterval(()=>{ o-=0.06;
        vg.traverse(m=>{ if(m.material){ m.material.transparent=true; m.material.opacity=Math.max(0,o); } });
        if(o<=0){ clearInterval(fade); scene.remove(vg); } }, 40);
    }, 1000);
  }
  // receptor: pulsa y sale de la Cámara
  if(recH){
    const rg=recH.group;
    const moveR = setInterval(()=>{
      const dx=P_FUSION.x-rg.position.x, dz=P_FUSION.z-rg.position.z;
      const d=Math.hypot(dx,dz); if(d<0.2){ clearInterval(moveR); return; }
      rg.position.x+=dx/d*0.07; rg.position.z+=dz/d*0.07;
      rg.rotation.y=Math.atan2(dx,dz);
    }, 16);
    setTimeout(()=>{
      clearInterval(moveR);
      rg.scale.set(1.22,1.22,1.22); setTimeout(()=>rg.scale.set(1,1,1), 600);
    }, 1400);
  }
  sacData.inRoster=false;
  recentLoss = { name: sacData.name, timer: 180 };
  hadaState.solemnity = Math.min(1, hadaState.solemnity + 0.12);
  if(onDone) setTimeout(onDone, 500);
}
function echoCeremony(sacData, recData, afterCb){
  closeSheets();
  window._echoAccel = true;
  // testigos giran hacia la Cámara
  const witnessLines = {
    inseguro:'¿Qué... qué le pasa a '+sacData.name+'?',
    curioso: '¿Qué hay dentro?',
    cálido:  'Que descanse en paz.',
    frío:    '',
    optimista:'Esto no lo olvidaré.',
    cauto:   '¿Eso es seguro?',
    sombrío: 'Todos tenemos un final.',
    default: '…',
  };
  heroes.filter(h=>h.alive && h.data.id!==sacData.id && h.data.id!==recData.id).forEach(h=>{
    h.group.rotation.y = Math.atan2(P_FUSION.x-h.group.position.x, P_FUSION.z-h.group.position.z);
  });
  // overlay con texto dramático
  const overlay = document.getElementById('echo-overlay');
  const textEl  = document.getElementById('echo-text');
  textEl.innerHTML = '<b>'+sacData.name+'</b> y <b>'+recData.name+'</b> entran a la Cámara.<br><em>El pueblo se detiene.</em>';
  overlay.classList.add('show');
  // tras 1.5s: testigos hablan
  setTimeout(()=>{
    heroes.filter(h=>h.alive && h.data.id!==sacData.id && h.data.id!==recData.id).forEach(h=>{
      const line = witnessLines[toneOf(h)] || witnessLines.default;
      if(line) setTimeout(()=>say(h, line), Math.random()*800);
    });
  }, 1500);
  // tras 2.5s: ejecutar, ocultar overlay, burbuja del receptor
  setTimeout(()=>{
    overlay.classList.remove('show');
    window._echoAccel = false;
    executeFusion(sacData, recData, ()=>{
      const recH = heroes.find(x=>x.data.id===recData.id);
      if(recH) setTimeout(()=>say(recH, 'Cargo con ello ahora.'), 800);
      toast('<b>Eco</b> — '+recData.name+' guarda el eco de '+sacData.name+'. El pueblo calló.');
      if(afterCb) afterCb();
    });
  }, 2600);
}
document.getElementById('btn-do-merge').addEventListener('click', ()=>{
  if(!sac||!rec) return;
  const sacCopy=sac, recCopy=rec;
  sac=null; rec=null;
  echoCeremony(sacCopy, recCopy, ()=>{
    if(TUTORIAL) tutAfterFusion();
  });
});
// abrir picker al abrir la Cámara
const mergeSheet = document.getElementById('sheet-merge');
new MutationObserver(()=>{ if(mergeSheet.classList.contains('open')){ renderPicker(); paintMerge(); } })
  .observe(mergeSheet, { attributes:true, attributeFilter:['class'] });

// ── Panel de dev: charlas (con diálogo) + estadísticas (14 ejes) ─────────────
const AXIS_LABELS = {
  caution:['imprudente','cauto'], passivity:['agresivo','pasivo'], submission:['dominante','sumiso'],
  warmth:['frío','cálido'], trust:['desconfiado','confiado'], altruism:['egoísta','altruista'],
  sociability:['solitario','social'], integrity:['acomodaticio','íntegro'], loyalty:['desleal','leal'],
  optimism:['pesimista','optimista'], discipline:['impulsivo','disciplinado'], curiosity:['cerrado','curioso'],
  confidence:['inseguro','seguro'], forgiveness:['rencoroso','indulgente'],
};
const AXIS_ORDER = ['caution','passivity','submission','warmth','trust','altruism','sociability','integrity','loyalty','optimism','discipline','curiosity','confidence','forgiveness'];
function barColor(v){ if(v<0.25)return '#604060'; if(v<0.5)return '#504880'; if(v<0.75)return '#406088'; return '#5a8868'; }

let lastExpeditionResult = null;   // stored by resolveExpedition for the dev panel

function renderExpedition(){
  const box = document.getElementById('dev-expedition');
  if(!lastExpeditionResult && !(LIVE && LIVE.expedition)){
    box.innerHTML='<div class="dev-count">sin expedición aún en esta sesión.</div>'; return;
  }
  // Active expedition
  if(LIVE && LIVE.expedition){
    const secs = Math.max(0, Math.floor((LIVE.expedition.returnAt-Date.now()/1000)));
    const mins = Math.floor(secs/60), s=secs%60;
    box.innerHTML='<div class="dev-count">Expedición activa — piso '+LIVE.expedition.floor+
      ' — vuelven en '+(mins?mins+'m ':'')+s+'s</div>'+
      '<div class="dev-count" style="margin-top:6px">party: '+LIVE.expedition.partyIds.join(', ')+'</div>';
    return;
  }
  // Last result
  const { result, floor, drops } = lastExpeditionResult;
  let html='<div class="dev-count">Última expedición — piso '+floor+' — '+result.outcome+'</div>';
  html+='<div class="exp-result"><div class="exp-narration">';
  html+=result.narration.map(l=>'<div class="log-line">'+l+'</div>').join('');
  html+='</div>';
  if(result.fallenNpcIds.length) html+='<div class="log-line" style="color:var(--danger-soft)">Caídos: '+result.fallenNpcIds.join(', ')+'</div>';
  if(drops && drops.length) html+='<div class="log-line" style="color:var(--gold)">Botín: '+drops.map(d=>d.slot+' ('+d.rarity+')').join(', ')+'</div>';
  html+='</div>';
  box.innerHTML=html;
}

function renderCharlas(){
  const box=document.getElementById('dev-charlas');
  if(!liveChats.length){
    box.innerHTML='<div class="dev-count">aún no han hablado — espera a que se junten (sobre todo en la plaza)</div>';
    return;
  }
  let html='<div class="dev-count">charlas en vivo de esta sesión: '+liveChats.length+' — pasan en tiempo real frente a ti</div>';
  for(const c of liveChats){
    const lines=c.lines.map(l=>'<div class="log-line"><span class="who">'+l.who+':</span> '+l.text+'</div>').join('');
    html+='<div class="log-item"><div class="log-meta"><span>'+c.a+' ✦ '+c.b+'</span><span class="tk">'+c.topic+'</span></div>'+lines+'</div>';
  }
  box.innerHTML=html;
}
function renderStats(){
  const box=document.getElementById('dev-stats');
  box.innerHTML='<div class="stat-hint">vista de dev (rayos-X) — el jugador nunca ve esto; solo lo percibe por la Hada y la conducta. barra = ahora · marca = al nacer.</div>';
  // La "verdad" del mundo perdido (oculta al jugador; se filtra por sueños).
  if(DATA.world){
    box.insertAdjacentHTML('beforeend',
      '<div class="stat-hero" style="border-color:#5a3aa0">'+
      '<div class="stat-name">El mundo perdido: '+DATA.world.name+'</div>'+
      '<div class="needs-read">'+DATA.world.nature+'</div>'+
      '<div class="needs-read" style="color:#c8a8ff">'+DATA.world.cataclysm+'</div>'+
      '<div class="stat-sub">cómo cayó (lo revelará la Torre)</div>'+
      (DATA.world.beats||[]).map((b,i)=>'<div class="log-line"><span class="who">'+(i+1)+'.</span> '+b+'</div>').join('')+
      '</div>');
  }
  DATA.heroes.filter(h=>h.inRoster).forEach(h=>{
    let rows='';
    AXIS_ORDER.forEach(k=>{
      const now=h.axesNow[k], orig=h.axesOrig[k], lab=AXIS_LABELS[k];
      rows+='<div class="ax"><span class="ax-lo">'+lab[0]+'</span>'+
        '<span class="ax-bar"><span class="ax-fill" style="width:'+(now*100).toFixed(0)+'%;background:'+barColor(now)+'"></span>'+
        '<span class="ax-orig" style="left:'+(orig*100).toFixed(0)+'%"></span></span>'+
        '<span class="ax-hi">'+lab[1]+'</span></div>';
    });
    const em=(h.emergent&&h.emergent.length)?h.emergent.join(' · '):'sin rasgos marcados aún';
    // necesidades vitales (base Fase 2)
    const nb=(label,v,col)=>'<div class="ax"><span class="ax-lo">'+label+'</span><span class="ax-bar"><span class="ax-fill" style="width:'+Math.round(v*100)+'%;background:'+col+'"></span></span><span class="ax-hi"></span></div>';
    const nd=h.needs||{hambre:1,descanso:1,energia:1,health:1};
    const hCol=nd.health<0.3?'#b05050':nd.health<0.6?'#b0903a':'#5a8868';
    const needsHtml='<div class="stat-sub">necesidades — 4 medidores</div>'+
      nb('hambre',Math.max(0,nd.hambre),'#c08a3a')+nb('descanso',Math.max(0,nd.descanso),'#7a6ab0')+
      nb('energía',Math.max(0,nd.energia),'#3a78b0')+nb('salud',nd.health,hCol)+
      '<div class="needs-read">'+((h.needsStatus||[]).join(' · '))+'</div>';
    // RPG: nivel, piso alcanzado y stats de combate derivados del alma
    const lv  = h._live ? h._live.npc.level       : (h.level||1);
    const flr = h._live ? h._live.npc.floorReached : (h.floorReached||0);
    let rpgHtml = '<div class="stat-sub">rpg — nivel y combate</div>'+
      '<div class="stat-rpg-row"><span class="rpg-lv">Lv. '+lv+'</span>'+
      (flr>0?'<span class="rpg-floor">piso '+flr+'</span>':'')+'</div>';
    if(BL && BL.deriveStats){
      const st = BL.deriveStats({axes:h.axesNow, stars:h.stars, level:lv});
      rpgHtml += '<div class="stat-rpg-grid">'+
        '<span class="rpg-stat rpg-hp"><b>HP</b> '+st.maxHp+'</span>'+
        '<span class="rpg-stat rpg-atk"><b>ATK</b> '+st.atk+'</span>'+
        '<span class="rpg-stat rpg-def"><b>DEF</b> '+st.def+'</span>'+
        '<span class="rpg-stat rpg-spd"><b>VEL</b> '+st.spd+'</span>'+
      '</div>';
    }
    box.insertAdjacentHTML('beforeend',
      '<div class="stat-hero"><div class="stat-name">'+h.name+'<span class="st">'+('★'.repeat(h.stars))+'</span><span class="cl">'+(CLASS_ES[h.role]||h.role)+'</span></div>'+
      '<div class="stat-emergent">'+em+'</div>'+rows+needsHtml+rpgHtml+'</div>');
  });
}
let devCurrent='charlas';
function devTab(which){
  devCurrent=which;
  document.getElementById('tab-charlas').classList.toggle('active', which==='charlas');
  document.getElementById('tab-stats').classList.toggle('active', which==='stats');
  document.getElementById('tab-expedition').classList.toggle('active', which==='expedition');
  document.getElementById('dev-charlas').style.display = which==='charlas'?'block':'none';
  document.getElementById('dev-stats').style.display = which==='stats'?'block':'none';
  document.getElementById('dev-expedition').style.display = which==='expedition'?'block':'none';
}
document.getElementById('tab-charlas').addEventListener('click', ()=>devTab('charlas'));
document.getElementById('tab-stats').addEventListener('click', ()=>devTab('stats'));
document.getElementById('tab-expedition').addEventListener('click', ()=>{ renderExpedition(); devTab('expedition'); });
document.getElementById('btn-dev').addEventListener('click', ()=>{ renderCharlas(); renderStats(); openSheet('sheet-dev'); });
document.getElementById('btn-reset').addEventListener('click', ()=>{
  try{ localStorage.removeItem(SAVE_KEY); localStorage.removeItem(LS_KEY); }catch(e){}
  location.reload();
});

// ─────────────────────────────────────────────────────────────────────────────
// Charlas EN VIVO entre héroes: se juntan y hablan en tiempo real, con burbujas.
// El texto se COMPONE aquí, en el navegador, a partir de la voz real de cada uno
// (oficio de antes, sueños del mundo perdido, hambre, sitio). Sin Gemini, sin pool
// previo: un micro-planner elige de qué hablan según su estado del momento.
// ─────────────────────────────────────────────────────────────────────────────
const speechLayer = document.getElementById('speech-layer');
const speeches = [];
function say(hero, text){
  const el = document.createElement('div'); el.className='speech'; el.textContent=text;
  speechLayer.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('show'));
  speeches.push({ el, hero, ttl:3.0 });
}
const _sv = new THREE.Vector3();
function updateSpeeches(dt){
  for(let i=speeches.length-1;i>=0;i--){
    const sp=speeches[i]; sp.ttl-=dt;
    _sv.copy(sp.hero.group.position); _sv.y+=2.1; _sv.project(cam);
    sp.el.style.left=((_sv.x*0.5+0.5)*window.innerWidth)+'px';
    sp.el.style.top=((-_sv.y*0.5+0.5)*window.innerHeight)+'px';
    if(sp.ttl<=0){ sp.el.classList.remove('show'); const e=sp.el; setTimeout(()=>e.remove(),250); speeches.splice(i,1); }
  }
}

// Comida pobre del pueblo (para las quejas de hambre).
const FOODS = ['papas','papa hervida','pan duro','sopa aguada','raíces','gachas frías'];
// Tono dominante de un héroe, leído de sus ejes REALES (axesNow). Hace que cada uno
// hable EN SU VOZ y que el planner elija de qué hablar según quién es.
function toneOf(h){
  const ax = h.data.axesNow || {};
  const g = (k)=> (ax[k]==null?0.5:ax[k]);
  const cands = [
    ['inseguro', 0.5-g('confidence')], ['curioso', g('curiosity')-0.5],
    ['cálido', g('warmth')-0.5],       ['frío', 0.5-g('warmth')],
    ['cauto', g('caution')-0.5],       ['solitario', 0.5-g('sociability')],
    ['optimista', g('optimism')-0.5],  ['sombrío', 0.5-g('optimism')],
  ];
  let best='sereno', bv=0.12;   // si nada destaca lo suficiente, queda sereno
  for(const [t,d] of cands){ if(d>bv){ bv=d; best=t; } }
  return best;
}
// Cómo se ve ese tono al observarlo (para que se "lean" entre ellos = conocimiento propio).
const TONE_OBS = {
  inseguro:'dudando de ti mismo, sin razón', curioso:'preguntándolo todo, sin parar quieto',
  'cálido':'fácil de tratar, te acercas sin esfuerzo', 'frío':'reservado, cuesta llegarte',
  cauto:'siempre alerta, como si el suelo fuera a ceder', solitario:'en tu rincón, apartado',
  optimista:'con el ánimo en alto, pese a todo', 'sombrío':'cargando algo que no sueltas',
  sereno:'tranquilo, ni arriba ni abajo',
};
// Bancos por "beat". Cada beat TRAZA a un dato real (estado, pasado, sueño,
// personalidad, entorno) — nada inventado ni vivido fuera de aquí. Alternan hablante
// 1 y 2. Huecos: {1t}/{2t}=oficio de antes · {1p}/{2p}=lugar · {food}=comida ·
// {frag}=sueño real aflorado · {2obs}=cómo se ve el otro (su personalidad real).
const BANKS = {
  arrival: [
    ['¿Tú entiendes este sitio? Desperté aquí y no recuerdo cómo.','Yo igual. Como si me faltara un pedazo de ayer.','¿Y esa torre de ahí?','Ni idea. No me da buena espina.'],
    ['¿Sabes qué es este lugar?','Un pueblo, dicen. Antes yo no estaba aquí, eso seguro.','¿No te inquieta no recordar?','Un poco. Intento no escarbar.'],
    ['Hay algo raro aquí, ¿lo notas?','Lo noto. Pero prefiero no preguntar tanto.','A mí no saber me pesa más que la verdad.','Allá cada quien con lo suyo.'],
  ],
  pastlife: [
    ['Yo era {1t}, ¿sabes? Antes. Creo.','¿{1t}? Las manos lo recuerdan más que la cabeza.','¿Y tú?','{2t}, me parece. De {2p}. O eso quiero creer.'],
    ['¿Tú de dónde venías?','De {1p}. Era {1t} ahí. ¿Tú?','{2t}. Lo siento lejos, como ajeno.','Sé bien lo que es eso.'],
  ],
  hunger: [
    ['Tengo un hambre… y solo hay {food}.','Otra vez {food}. Cómo extraño comer de verdad.','En {1p} al menos había de sobra.','No te tortures recordándolo.'],
    ['¿Comiste algo?','{food}, lo de siempre. Ya ni sabe a nada.','Hay que aguantar, no queda otra.','Aguantar. La palabra de este sitio.'],
    ['Me está fallando el cuerpo. No comí bien.','Yo lo noto. Tienes cara de eso.','¿Se nota tanto?','Aquí todo se nota. Mejor come algo.'],
    ['¿Cuánto llevas sin comer?','Demasiado. Con {food} lo que haya, ya.','Antes en {1p} había más opciones.','Menos mal que no recuerdas el sabor.'],
  ],
  hunger_invite: [
    ['Oye, tengo mucha hambre. ¿Me acompañas?','Yo también. Vamos a la posada.','Menos mal. No me apetece ir solo.','Vamos.'],
    ['¿No tienes hambre tú también?','Bastante. ¿Vamos?','Sí, anda. Ya no aguanto más.','Tampoco yo.'],
    ['Voy a buscar algo de comer. ¿Vienes?','Ahora que lo dices… sí. Espérame.','No tardes, que me desmayo.','Ya voy, ya.'],
    ['Hay {food} en la posada, creo.','Cualquier cosa. Acompáñame.','¿Tan hambriento estás?','Más de lo que aparento.'],
  ],
  tired: [
    ['Estoy molido y casi no hice nada.','Aquí cansa hasta el aire. Y los sueños no dejan dormir.','¿Tú también sueñas raro?','Mejor no hablemos de eso.'],
    ['No doy más. Las piernas me fallan.','Descansa. Nadie te va a reprochar nada.','¿Y si se necesita algo?','Nada tan urgente como tu cuerpo ahora mismo.'],
  ],
  tired_invite: [
    ['Oye, ¿tú también estás agotado? ¿Nos sentamos un rato?','Llevo horas con ganas de parar. Sí.','A la posada, anda.','Vamos.'],
    ['¿Cuándo fue la última vez que dormiste bien?','No sé. Hace mucho.','Yo tampoco. Descansemos juntos, al menos no es tan solo.','Buena idea.'],
    ['Me caigo de sueño. ¿Me acompañas a descansar?','Te acompaño. Yo también necesito parar.','Gracias. Aquí solo da más pereza.','Vamos antes de que se nos pasen las ganas.'],
  ],
  dream: [
    ['Anoche soñé… {frag}.','¿Otra vez con eso? Yo no quiero soñar nada.','No lo elijo. Llega y ya.','Tú descansa. Yo me quedo despierto un rato.'],
    ['Soñé algo que no viví. {frag}.','…a veces a mí también. No se lo cuento a nadie.','¿Será de antes?','Quién sabe. Mejor no escarbar.'],
  ],
  bond: [
    ['Te he estado mirando: {2obs}.','¿Tan claro se ve?','Aquí cada quien es como es. No pasa nada.','…gracias. No esperaba que alguien se fijara.'],
    ['Llevas días así: {2obs}.','¿Y eso te molesta?','Para nada. Me hace fiarme un poco más.','Es mutuo, entonces.'],
  ],
  environment: [
    ['Cae la noche otra vez.','Sí. Me acerco al fuego, ¿vienes?','Voy. Al menos da algo de calor.','Y compañía. No es poco aquí.'],
    ['Hace frío esta noche.','Siempre, cuando uno no recuerda de dónde viene.','Qué cosa más triste dijiste.','Perdona. Se me escapó.'],
  ],
  idle: [
    ['No hace falta hablar, ¿sabes?','No.','…','Se está bien así.'],
  ],
  loss: [
    ['{1t} lleva tiempo sin salir… ¿Sabes qué pasó?', 'Entró a la Cámara. Solo salió {2t}.'],
    ['El sitio donde dormía {lost} está vacío.', 'Lo noté esta mañana. El pueblo es más callado.'],
    ['¿Crees que {lost} sabía lo que iba a pasar?', 'Nadie sabe. Pero fue rápido.'],
  ],
  tower: [
    ['¿Cuánto tardan?','No lo sé. Nadie sabe lo que hay ahí arriba.'],
    ['¿Y si no vuelven?','…Esperamos.'],
    ['El silencio de la Torre me pesa.','A todos.'],
    ['¿Crees que están bien?','Pregúntale a la Hada. Yo no me atrevo a pensar en eso.'],
  ],
};
function fillTokens(t,s1,s2,food,frag){
  return t.split('{1t}').join(s1.data.trade||'alguien').split('{2t}').join(s2.data.trade||'alguien')
          .split('{1p}').join(s1.data.place||'su tierra').split('{2p}').join(s2.data.place||'su tierra')
          .split('{2obs}').join(TONE_OBS[toneOf(s2)]||'difícil de leer')
          .split('{1obs}').join(TONE_OBS[toneOf(s1)]||'difícil de leer')
          .split('{food}').join(food).split('{frag}').join(frag||'algo que no entendía')
          .split('{lost}').join(recentLoss ? recentLoss.name : 'aquel');
}
// Micro-planner: elige de qué hablan según su ESTADO real y su PERSONALIDAD (idea
// minada de AutoChatManager). Anti-repetición de beat y plantilla.
const TIER_W = { core:4, secondary:3, peripheral:2, mundane:1 };
let lastBeat=null, lastTmpl='';
function composeExchange(A,B){
  // Lee necesidades VIVAS (no el snapshot horneado)
  const getNd = h => h.data._live ? h.data._live.needs : h.data.needs;
  const ndA = getNd(A), ndB = getNd(B);
  const hungryVal = h => { const nd=getNd(h); return nd ? Math.max(0, 0.70-nd.hambre)/0.70 : 0; };
  const tiredVal  = h => { const nd=getNd(h); return nd ? Math.max(0, 0.60-nd.descanso)/0.60 : 0; };
  const hungry = h => hungryVal(h) > 0.15;  // hambre < ~0.59
  const tired  = h => tiredVal(h)  > 0.20;  // descanso < ~0.48
  const disor  = h => (h.data.axesNow ? h.data.axesNow.confidence : 0.5) < 0.45;
  const dreamy = h => h.data.memories && h.data.memories.length;
  const tA = toneOf(A), tB = toneOf(B);
  const isTone = (t)=> tA===t || tB===t;

  // urgencia máxima de hambre/descanso entre los dos
  const hUrgMax = Math.max(hungryVal(A), hungryVal(B));
  const dUrgMax = Math.max(tiredVal(A),  tiredVal(B));

  const cands=[]; const add=(b,w)=>{ if(w>0) cands.push([b,w]); };
  // sueño: un recuerdo REAL aflorado
  let dreamer=null;
  if(dreamy(A)||dreamy(B)){
    dreamer = !dreamy(A)?B : !dreamy(B)?A : ((TIER_W[A.data.tier]||1)>=(TIER_W[B.data.tier]||1)?A:B);
    add('dream', TIER_W[dreamer.data.tier]||1);
  }
  // estado real de necesidades — peso proporcional a la urgencia
  add('hunger',        (hungry(A)||hungry(B)) ? Math.round(3 + hUrgMax*5) : 0);
  add('hunger_invite', (hungry(A)||hungry(B)) ? Math.round(2 + hUrgMax*6) : 0);
  add('tired',         (tired(A)||tired(B))   ? Math.round(2 + dUrgMax*4) : 0);
  add('tired_invite',  (tired(A)||tired(B))   ? Math.round(1 + dUrgMax*4) : 0);
  // recién llegados: desorientación (sube con inseguros/curiosos)
  add('arrival', 3 + ((disor(A)||disor(B))?2:0) + (isTone('curioso')?1:0) + (isTone('inseguro')?1:0));
  // su propio pasado (sube con curiosos)
  add('pastlife', 2 + (isTone('curioso')?1:0));
  // leerse entre ellos (vínculo): sube si alguien es cálido
  add('bond', isTone('cálido')?3:1);
  // entorno: solo pesa de noche (dato real del ciclo día/noche)
  add('environment', (NIGHT>0.5)?2:1);
  // silencio: para solitarios
  add('idle', isTone('solitario')?2:1);
  // pérdida reciente: testigos recuerdan al sacrificado
  if(recentLoss) add('loss', 5);
  const inTower = LIVE && LIVE.expedition && LIVE.expedition.partyIds.length>0;
  add('tower', inTower ? 6 : 0);

  // anti-repetición: castiga repetir el último beat
  for(const c of cands){ if(c[0]===lastBeat) c[1]*=0.25; }
  const total=cands.reduce((s,c)=>s+c[1],0);
  let r=Math.random()*total, beat='arrival';
  for(const [b,w] of cands){ r-=w; if(r<0){ beat=b; break; } }

  let s1=A, s2=B;
  if(beat==='dream' && dreamer===B){ s1=B; s2=A; }
  const frag = beat==='dream' ? dreamer.data.memories[Math.floor(Math.random()*dreamer.data.memories.length)] : null;
  const food = FOODS[Math.floor(Math.random()*FOODS.length)];
  const arr = BANKS[beat] || BANKS.arrival;
  let tmpl = arr[Math.floor(Math.random()*arr.length)];
  if(arr.length>1 && tmpl[0]===lastTmpl){ tmpl = arr[(arr.indexOf(tmpl)+1)%arr.length]; }
  lastBeat=beat; lastTmpl=tmpl[0];
  const lines = tmpl.map((t,i)=>({ hero:(i%2===0)?s1:s2, text:fillTokens(t,s1,s2,food,frag) }));
  return { beat, lines };
}
const liveChats = [];
let socialTimer = 0.6;
function socialDirector(dt){
  socialTimer -= dt;
  if(socialTimer > 0) return;
  socialTimer = 0.5 + Math.random()*0.7;
  const idle = heroes.filter(h=>h.alive && h.state==='idle' && !h.partner);
  for(let i=0;i<idle.length;i++) for(let j=i+1;j<idle.length;j++){
    if(idle[i].group.position.distanceTo(idle[j].group.position) < 3.6){ startConversation(idle[i], idle[j]); return; }
  }
}
function faceEachOther(A,B){
  const dx=B.group.position.x-A.group.position.x, dz=B.group.position.z-A.group.position.z;
  A.group.rotation.y=Math.atan2(dx,dz); B.group.rotation.y=Math.atan2(-dx,-dz);
}
function startConversation(A,B){
  A.state=B.state='talk'; A.partner=B; B.partner=A;
  faceEachOther(A,B);
  // EVOLUCIÓN VIVA: hablar empuja de verdad los ejes de ambos (el motor decide cuánto).
  if(LIVE && BL && A.data._live && B.data._live){
    try{
      const ai=LIVE.heroes.indexOf(A.data._live), bi=LIVE.heroes.indexOf(B.data._live);
      BL.applyConversation(LIVE, ai, bi, TOWN_SEED+':live:'+LIVE.tick+':'+(A.data.id)+(B.data.id)+':'+Math.floor(Math.random()*1e9));
    }catch(e){}
  }
  const { beat, lines } = composeExchange(A,B);
  liveChats.unshift({ a:A.data.name, b:B.data.name, topic:beat, lines: lines.map(l=>({who:l.hero.data.name,text:l.text})) });
  if(liveChats.length>40) liveChats.pop();
  if(document.getElementById('sheet-dev').classList.contains('open') && devCurrent==='charlas') renderCharlas();
  // reproducir turno por turno (~1.6s cada uno), liberar tras la última
  const STEP=1650;
  lines.forEach((l,idx)=>{
    setTimeout(()=>{ if(l.hero.alive && l.hero.state==='talk') say(l.hero, l.text); }, idx*STEP);
  });
  const postDelay = lines.length*STEP + 700;
  setTimeout(()=>{ endConversation(A); endConversation(B); }, postDelay);
  // Si la charla fue sobre hambre o cansancio, los dos van juntos a la posada
  if(beat==='hunger_invite' || beat==='hunger'){
    setTimeout(()=>{
      [A,B].forEach(h=>{ if(h.alive && h.state==='idle'){ h.target='posada'; h._nextState='eat'; h.state='walking'; } });
    }, postDelay + 200);
  } else if(beat==='tired_invite' || beat==='tired'){
    setTimeout(()=>{
      [A,B].forEach(h=>{ if(h.alive && h.state==='idle'){ h.target='posada'; h._nextState='rest'; h.state='walking'; } });
    }, postDelay + 200);
  }
}
function endConversation(h){
  if(h.state==='talk'){ h.state='idle'; h.timer=1.5+Math.random()*2.5; }
  h.partner=null;
}

// ── El héroe le pregunta a la Hada (guía, SOLO si preguntan) ──────────────────
// La Hada tiene su propio estado aprendido: confianza (sube con obediencia),
// solemnidad (sube con cada fusión), sabiduría (sube cada amanecer).
// No habla espontáneamente — solo cuando el jugador la solicita, o rarísima vez.
let musingTimer = 900 + Math.random()*300;   // 1 monólogo por partida, no cada minuto
const hadaSpeaker = { group: hada, alive:true, data:{ name:'La Hada' } };
const hadaState = { confidence: 0.55, solemnity: 0.1, wisdom: 0.0 };

// Monólogos de la Hada: MUY raros (1 por partida larga). Solo si el jugador no está mirando.
const HADA_MUSINGS = [
  'Survived another day. Good.',
  'La Torre no espera a los impacientes.',
  'Hay una verdad en este pueblo. No soy yo quien os la dará — pero ayudo a merecerla.',
];

function guidanceDirector(dt){
  if(TUTORIAL) return;
  // Monólogo rarísimo — 1 por partida larga, sin interrumpir al jugador. La Hada NO
  // busca héroes por sí sola: solo habla si el jugador la abre, o este aparte rarísimo.
  musingTimer -= dt;
  if(musingTimer <= 0 && !document.getElementById('sheet-hada').classList.contains('open')){
    musingTimer = 999999;   // no vuelve a sonar hasta que se recargue
    const msg = HADA_MUSINGS[Math.floor(Math.random()*HADA_MUSINGS.length)];
    say(hadaSpeaker, msg);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TUTORIAL — el pueblo arranca VACÍO. La Hada conduce: invocar 4 héroes, explicar
// cómo funciona ella (única voz, sin números) y obligar a sentir un Eco (Merger)
// una vez. Es el onboarding: sustituye a "tener héroes ya puestos al iniciar".
// ─────────────────────────────────────────────────────────────────────────────
let TUTORIAL = false, tutStep = null, tutSummoned = 0;

// resalte en el suelo (anillo dorado pulsante) que señala dónde mirar
const hlRing = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.1, 40),
  new THREE.MeshBasicMaterial({ color:0xf0c040, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false }));
hlRing.rotation.x = -Math.PI/2; hlRing.position.y = 0.06; hlRing.visible = false; scene.add(hlRing);
function highlightPlace(key){ const p = PLACES[key].pos; hlRing.position.set(p.x, 0.06, p.z); hlRing.visible = true; }
function clearHighlight(){ hlRing.visible = false; }

// cartel-guía: dice qué TOCAR en el mundo. El jugador hace la acción, no la Hada.
const tutHintEl = document.getElementById('tut-hint');
function tutHint(html){ tutHintEl.innerHTML = html; tutHintEl.classList.add('show'); }
function tutHintPulse(){ tutHintEl.classList.remove('show'); requestAnimationFrame(()=>tutHintEl.classList.add('show')); }
function tutHintClear(){ tutHintEl.classList.remove('show'); }

const TUT_SUMMON_LINES = [
  'Ahí está — <b>{n}</b>. Un alma recién llamada, sin pulir, pero ya respira con nosotros.',
  '<b>{n}</b> se les une. Fíjate: cada uno carga su propia manera de ser.',
  'Y <b>{n}</b>. Van tres. Ninguno siente el mundo igual que otro.',
  'Con <b>{n}</b> ya son cuatro. Suficiente para empezar un pueblo.',
];
function startTutorial(){
  TUTORIAL = true; tutStep = 'intro'; tutSummoned = 0;
  document.body.classList.add('tut');
  thread.innerHTML = '';
  const sub = document.getElementById('hud-sub'); if(sub) sub.textContent = 'la Hada te guía';
  openSheet('sheet-hada');
  fairySays('Despiertas como una presencia sobre este pueblo. No eres su héroe ni su titiritero — eres quien lo observa y lo moldea.', ()=>{
    fairySays('Yo soy <b>la Hada</b>: tu única voz hacia ellos. Pero mira… el pueblo está vacío. Hay que llamar a los primeros — y eso lo haces <b>tú</b>.', ()=>{
      setIntents([{ label:'¿Cómo? ✦', act:tutBeginSummon }]);
    });
  });
}
// Muestra DÓNDE se invoca (el Shrine) y deja que el jugador lo toque él mismo.
function tutBeginSummon(){
  tutStep = 'summon';
  closeSheets();                 // libera la vista: el mundo queda tocable
  highlightPlace('shrine');
  tutHint('✦ Toca el <b>Shrine</b> para llamar a tu primer héroe');
}
function tutDoSummon(){
  if(tutStep !== 'summon') return;
  const d = summonNext(); if(!d) return;
  tutSummoned++;
  if(tutSummoned < 4){
    tutHint('✦ <b>'+d.name+'</b> despierta. Toca el <b>Shrine</b> otra vez — faltan '+(4-tutSummoned));
  } else {
    tutHintClear(); clearHighlight();
    tutStep = 'explain';
    setTimeout(tutExplain, 2800);  // deja ver al cuarto aparecer ~3s antes de que el chat reaparezca
  }
}
function tutExplain(){
  tutStep = 'explain'; clearHighlight(); openSheet('sheet-hada');
  fairySays('Ahora lo importante: <b>yo soy tu única voz hacia ellos</b>. No les hablas directamente — pasas por mí. <b>Mis órdenes</b> llegan a todos; ellos deciden si las siguen o no.', ()=>{
    fairySays('Conmigo puedes <b>saber cómo van</b>, <b>darme órdenes</b> (comer, entrenar, animarse) o que te <b>explique</b> las reglas. Nunca verás números: solo lo que se observa.', ()=>{
      setIntents([{ label:'Pregúntame por uno ✦', act:tutTryAsk }]);
    });
  });
}
function tutTryAsk(){
  fairySays('Adelante. ¿Por quién preguntas?', ()=> setIntents(
    liveRoster().map(h=>({ label:h.name, act:()=>{
      bub('right','¿Cómo está '+h.name+'?');
      fairySays(DATA.hada.reports[h.id] || liveReading(h), ()=>{
        fairySays('¿Lo ves? Ni un solo número. Así te hablaré siempre de ellos.', ()=>{
          setIntents([{ label:'Entiendo. Sigue.', act:tutFusionIntro }]);
        });
      });
    }}))
  ));
}
function tutFusionIntro(){
  tutStep = 'fusion'; openSheet('sheet-hada');
  fairySays('Queda lo más pesado. <b>El Eco</b>, en la Cámara de los Ecos: mi <b>única orden que nadie puede rechazar</b>. Un héroe se pierde para que otro guarde su eco. No es un atajo — el valor se transfiere <em>a pérdida</em>.', ()=>{
    fairySays('Debes sentir su peso al menos una vez. Ve <b>tú misma</b> a la Cámara de los Ecos — está al otro lado del pueblo.', ()=>{
      setIntents([{ label:'Muéstrame dónde ❖', cls:'danger', act:tutGoFusion }]);
    });
  });
}
// Muestra DÓNDE está la Cámara de los Ecos y deja que el jugador entre él mismo.
function tutGoFusion(){
  closeSheets();                 // libera la vista hacia la Cámara
  highlightPlace('fusion');
  tutHint('❖ Toca la <b>Cámara de los Ecos</b> para entrar');
}
function tutAfterFusion(){
  clearHighlight(); openSheet('sheet-hada');
  fairySays('Lo sentiste. El pueblo calló un momento — todos lo notan, cada uno a su modo. Esa es la autoridad que cargas; úsala pocas veces.', ()=>{
    fairySays('Ya está. El pueblo es tuyo para observar y guiar. Tócame siempre que quieras hablar.', ()=>{
      setIntents([{ label:'Comenzar', act:tutDone }]);
    });
  });
}
function tutDone(){
  TUTORIAL = false; tutStep = null;
  document.body.classList.remove('tut'); clearHighlight(); tutHintClear(); closeSheets();
  thread.innerHTML = ''; hadaOpened = false; window.__catchupMins = 0;
  const sub = document.getElementById('hud-sub'); if(sub) sub.textContent = 'el pueblo vive';
}

// ─────────────────────────────────────────────────────────────────────────────
// Bucle: tiempo real. El mundo vive (los héroes se mueven solos).
// ─────────────────────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let worldT = 0;
const START_TOD  = 0.18;    // arranca de mañana (no en lo oscuro)
const SPOT_RADIUS = { campo:3.0, posada:1.8, plaza:2.2, shrine:1.6 };
function spotPos(k){ const p=PLACES[k].pos; return p; }

function updateHero(h, dt){
  h.phase += dt*2.4;
  // respiración / bob
  h.group.position.y = Math.abs(Math.sin(h.phase))*0.06;
  if(h.state==='talk'){ return; }   // parado, hablando (lo libera el timeout)
  if(h.state==='idle' || h.state==='train' || h.state==='rest' || h.state==='eat'){
    h.timer -= dt;
    if(h.state==='train'){ h.group.rotation.y += dt*0.6; }   // gira practicando
    if(h.state==='eat'){ h.group.position.y = Math.abs(Math.sin(h.phase*1.8))*0.04; }  // mordisco suave
    if(h._orderT > 0){ h._orderT -= dt; if(h._orderT <= 0){ h._order=null; h._orderT=0; } }
    if(h._fairyCooldown > 0) h._fairyCooldown -= dt;
    if(h.timer<=0) pickActivity(h);
    return;
  }
  if(h.state==='walking'){
    const dest = spotPos(h.target);
    const r = SPOT_RADIUS[h.target]||1.6;
    const tx = dest.x + Math.cos(h.phase*0.3 + h.speed)*r*0.6;
    const tz = dest.z + Math.sin(h.phase*0.5 + h.speed)*r*0.6;
    const dx = tx-h.group.position.x, dz = tz-h.group.position.z;
    const d = Math.hypot(dx,dz);
    if(d < 0.25){
      const def = (h.target==='campo')?'train':(h.target==='posada')?'rest':'idle';
      h.state = h._nextState || def;
      h._nextState = null;
      h.timer = 1.2 + Math.random()*1.6;
    } else {
      const sp = h.speed*dt*1.6;
      h.group.position.x += dx/d*sp;
      h.group.position.z += dz/d*sp;
      h.group.rotation.y = Math.atan2(dx,dz);
    }
  }
}

let lastTod = -1;
let gameDay = 1, prevTod = START_TOD;
let recentLoss = null;  // { name, timer } — testigos recuerdan al sacrificado ~3 min
let torreTeams = [];   // array de Set<data.id>, un Set por equipo de la misión
let torreActive = 0;   // índice del equipo que se está llenando en el menú
let torreFloor = 1;    // piso de la misión activa en el menú
let pendingReport = null;    // Fairy report text queued while sheets were open

function composeTowerReport(results, towerHeroes, preLevels){
  const fallen = new Set(results.flatMap(r=>r.result.fallenNpcIds));
  const allDefeat = results.every(r=>r.result.outcome==='defeat');
  const survivors = towerHeroes.filter(h=>!fallen.has(h.data.id));
  const dead      = towerHeroes.filter(h=> fallen.has(h.data.id));
  const lines = [];
  if(allDefeat && survivors.length===0){
    lines.push('No volvió nadie. El pueblo los recuerda.');
  } else if(dead.length===0){
    lines.push(survivors.length===1
      ? survivors[0].data.name+' vuelve. Solo, pero vuelve.'
      : (results.length>1
          ? 'Volvieron todos. Subieron en '+results.length+' equipos y bajaron juntos.'
          : 'Volvieron. '+survivors[0].data.name+' marcó el camino; los demás lo siguieron.'));
  } else {
    const survNames = survivors.map(h=>h.data.name).join(' y ');
    const deadNames = dead.map(h=>h.data.name).join(' y ');
    lines.push((survivors.length?'Volvió '+survNames+'. ':'')+deadNames+' no. La Torre se lo quedó.');
  }
  // Level-up (qualitative: "salió distinto"), en cualquier equipo
  results.forEach(r=> r.party.forEach(n=>{
    if(!fallen.has(n.id) && n.level>(preLevels[n.id]||1)){
      const h = towerHeroes.find(x=>x.data.id===n.id);
      if(h) lines.push(h.data.name+' salió distinto. No sé explicarlo bien, pero lo noto.');
    }
  }));
  if(results.some(r=>r.drops && r.drops.length)) lines.push('Trajeron algo de allá dentro. No sé qué significa aún.');
  return lines.join(' ');
}

function walkHeroFromTower(h){
  const g = h.group;
  g.position.set(P_TORRE.x+(Math.random()-0.5)*1.5, 0, P_TORRE.z+(Math.random()-0.5)*1.5);
  g.visible = true;
  const iv = setInterval(()=>{
    const dx=P_PLAZA.x-g.position.x, dz=P_PLAZA.z-g.position.z;
    const d=Math.hypot(dx,dz);
    if(d<2.0){ clearInterval(iv); h.state='idle'; h.timer=2+Math.random()*2; }
    else { const sp=0.07; g.position.x+=dx/d*sp; g.position.z+=dz/d*sp; g.rotation.y=Math.atan2(dx,dz); }
  },16);
}

function resolveExpedition(){
  if(!LIVE||!LIVE.expedition) return;
  window.__pendingHiddenIds = null;   // defuse the reload-hide timeout if it hasn't fired yet
  const { partyIds, floor, teams } = LIVE.expedition;
  // Compat: una o varias resoluciones (multi-equipo). Si faltan, recomputa por equipo.
  let results = LIVE.expedition.resolvedResults
    || (LIVE.expedition.resolvedResult ? [LIVE.expedition.resolvedResult] : null);
  LIVE.expedition = undefined;

  // Save pre-levels for level-up detection
  const preLevels = {};
  LIVE.heroes.forEach(lh=>{ preLevels[lh.npc.id]=lh.npc.level; });

  if(!results){
    const groups = (teams && teams.length) ? teams : [partyIds];
    results = groups.map(ids=>
      BL.runExpedition(LIVE.town, floor, LIVE.heroes.filter(h=>ids.includes(h.npc.id)).map(h=>h.npc)));
  }

  // Apply updated NPCs back to the live world (de todos los equipos)
  results.forEach(r=> r.party.forEach(updatedNpc=>{
    const lh = LIVE.heroes.find(h=>h.npc.id===updatedNpc.id);
    if(lh){ lh.npc=updatedNpc; lh.alive=updatedNpc.isAlive; }
  }));
  doSave();
  lastExpeditionResult = { ...results[0], floor };

  const fallen = new Set(results.flatMap(r=>r.result.fallenNpcIds));
  const towerHeroes = heroes.filter(h=>partyIds.includes(h.data.id));

  towerHeroes.forEach(h=>{
    if(fallen.has(h.data.id)){
      h.state='idle'; h.alive=false; h.data.alive=false;  // sync baked data so readinessLabel shows "caído"
      if(h.data._live) h.data._live.alive=false;
      scene.remove(h.group);
      recentLoss = { name:h.data.name, timer:180 };
    } else {
      walkHeroFromTower(h);
    }
  });

  // Queue Fairy report
  pendingReport = composeTowerReport(results, towerHeroes, preLevels);
  const sub = document.getElementById('hud-sub');
  if(sub && !TUTORIAL) sub.textContent = heroes.some(h=>h.alive)?'el pueblo vive':'silencio';

  // Auto-deliver if no sheet open
  if(SHEETS.every(s=>!document.getElementById(s).classList.contains('open'))){
    setTimeout(deliverReport, 800);
  }
}

function deliverReport(){
  if(!pendingReport) return;
  const report = pendingReport; pendingReport = null;
  openSheet('sheet-hada');
  if(!hadaOpened) hadaOpened=true;
  fairySays(report, hadaRoot);
}

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  worldT += dt;
  // ciclo día/noche
  const tod = ((worldT / DAY_LENGTH) + START_TOD) % 1;
  // detectar amanecer: tod cruza de ~1 a 0
  if(prevTod > 0.85 && tod < 0.15){
    gameDay++;
    hadaState.wisdom = Math.min(1, hadaState.wisdom + 0.08);
    const el = document.getElementById('hud-day');
    if(el) el.firstChild.textContent = 'Día ' + gameDay;
  }
  prevTod = tod;
  if(recentLoss){ recentLoss.timer -= dt; if(recentLoss.timer <= 0) recentLoss = null; }
  updateSky(tod);
  // fuegos: parpadean; SIEMPRE iluminan algo, mucho más de noche
  for(const f of fires){
    const flick = 0.8 + Math.sin(worldT*9 + f.phase)*0.14 + Math.random()*0.06;
    f.light.intensity = f.base * (0.35 + 0.65*NIGHT) * flick;
    f.mat.opacity = (0.55 + 0.45*NIGHT) * flick;
    if(f.hmat) f.hmat.opacity = (0.15 + 0.3*NIGHT) * flick;
    f.flame.scale.set(1, 0.85+0.3*flick, 1);
  }
  // etiqueta del HUD (día / anochece / noche)
  if(Math.abs(tod-lastTod) > 0.02){
    lastTod = tod;
    const sub = document.getElementById('hud-sub');
    if(sub && !window.__catchupMins && !TUTORIAL){
      sub.textContent = NIGHT > 0.6 ? 'cae la noche' : NIGHT > 0.25 ? 'atardece' : 'el pueblo vive';
    }
  }
  // la vista "pasa a través" de la muralla: las piezas entre la cámara y el
  // centro se desvanecen; las del fondo quedan opacas (enmarcando el pueblo).
  const camSide = new THREE.Vector3().subVectors(cam.position, camTarget).setY(0).normalize();
  for(const w of wallPieces){
    const toP = new THREE.Vector3().subVectors(w.position, camTarget).setY(0).normalize();
    const dot = toP.dot(camSide);   // ~1 = justo delante de la cámara
    const tgt = dot > 0.3 ? THREE.MathUtils.mapLinear(Math.min(dot,1), 0.3, 1, 0.78, 0.06) : 0.92;
    w.material.opacity += (tgt - w.material.opacity) * 0.18;
  }
  // la Hada vaga por el mundo y aletea
  hadaRoam(dt);
  // resalte de tutorial: anillo dorado que respira en el sitio a tocar
  if(hlRing.visible){ const pl=0.45+0.4*Math.sin(worldT*4); hlRing.material.opacity=pl; hlRing.scale.setScalar(1+0.1*Math.sin(worldT*4)); }
  // cristal del shrine pulsa
  const cr = PLACES.shrine.crystal; if(cr){ cr.rotation.y += dt*0.5; cr.position.y = 1.8 + Math.sin(worldT*1.6)*0.06; }
  // Cámara de los Ecos: cristal gira/flota y los anillos ondean hacia afuera
  const ce = PLACES.fusion.echo; if(ce){ ce.rotation.y += dt*0.7; ce.position.y = 1.6 + Math.sin(worldT*1.4)*0.08; }
  let echoSpeed = window._echoAccel ? 1.65 : 0.55;
  for(const e of echoRings){
    const t = (worldT*echoSpeed + e.phase) % 1;
    e.ring.scale.set(1 + t*2.4, 1 + t*2.4, 1);
    e.ring.material.opacity = (window._echoAccel?0.8:0.5) * (1 - t);
  }
  for(const h of heroes){ if(h.alive) updateHero(h, dt); }
  socialDirector(dt);      // los héroes se juntan y charlan en vivo
  guidanceDirector(dt);    // un recién llegado confundido va a preguntarle a la Hada
  liveTick(dt);            // motor vivo: necesidades por actividad + autoguardado
  updateSpeeches(dt);      // burbujas de diálogo flotando sobre ellos
  renderer.render(scene, cam);
}

// El motor corre EN VIVO: cada ~2s avanza las necesidades de cada héroe según lo que
// está haciendo (entrenar gasta, descansar recupera) y autoguarda. Las charlas mueven
// los ejes aparte (ver startConversation). Si no hay mundo vivo, no hace nada.
let _engineAccum = 0;
function liveTick(dt){
  if(!LIVE || !BL) return;
  // Expedición: resolución a ritmo de frame (misión 1:1, tiempo real) — no acotada por NEEDS_TICK.
  if(LIVE.expedition && Date.now()/1000 >= LIVE.expedition.returnAt) resolveExpedition();
  _engineAccum += dt;
  if(_engineAccum < NEEDS_TICK) return;  // escala con DAY_LENGTH → hambre dura ~4 días de juego
  _engineAccum = 0; LIVE.tick++;
  for(const h of heroes){
    const lh = h.data && h.data._live; if(!lh || !lh.alive) continue;
    // Misiones: tiempo 1:1 (no 10×) → los héroes en la Torre no drenan necesidades
    if(h.state === 'tower') continue;
    const act = h.state==='train' ? 'train' : h.state==='rest' ? 'rest' : h.state==='eat' ? 'eat' : 'idle';
    BL.tickHeroNeeds(lh, act, 1);
  }
  saveThrottled();
}

// ── Arranque ─────────────────────────────────────────────────────────────────
function start(){
  document.getElementById('hud-day').firstChild.textContent = 'Día 1';
  if(HAS_SAVE){
    // Partida guardada: el pueblo RECUERDA. Restaura el roster y omite el tutorial.
    // Los héroes caídos se incluyen en el array (para el roster/display) pero no en la escena 3D.
    DATA.heroes.forEach((d,i)=>{
      if(!d.inRoster) return;
      const h = spawnHero(d, heroes.length);
      if(d.alive === false){ h.alive=false; scene.remove(h.group); }
    });
    // Hide heroes that were inside the Tower when the page reloaded
    if(window.__pendingHiddenIds && window.__pendingHiddenIds.length){
      setTimeout(()=>{
        heroes.forEach(h=>{ if(window.__pendingHiddenIds.includes(h.data.id)){ h.group.visible=false; h.state='tower'; } });
        window.__pendingHiddenIds=null;
      }, 200);
    }
    if(window.__catchupMins){ const sub=document.getElementById('hud-sub'); if(sub) sub.textContent='siguió sin ti'; }
  } else {
    // Primera vez: el pueblo arranca VACÍO y el tutorial guía la invocación.
    DATA.heroes.forEach(h=>{ h.inRoster = false; });
  }
  animate();
  setTimeout(()=>document.getElementById('loader').classList.add('hide'), 500);
  // persistencia: guarda al salir (estado vivo) y de respaldo el timestamp legacy
  window.addEventListener('beforeunload', ()=>{ doSave(); localStorage.setItem(LS_KEY, String(Date.now())); });
  if(!HAS_SAVE) setTimeout(startTutorial, 750);   // tutorial solo en partida nueva
}
start();
