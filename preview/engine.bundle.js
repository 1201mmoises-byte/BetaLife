// src/engine/seeder.ts
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = h * 16777619 >>> 0;
  }
  return h;
}
function createSeeder(seed) {
  let state = hashString(seed);
  function next() {
    state += 1831565813;
    let z = state;
    z = Math.imul(z ^ z >>> 15, z | 1);
    z ^= z + Math.imul(z ^ z >>> 7, z | 61);
    z = (z ^ z >>> 14) >>> 0;
    return z / 4294967296;
  }
  function nextFloat(min = 0, max = 1) {
    return min + next() * (max - min);
  }
  function nextInt(min, max) {
    return Math.floor(nextFloat(min, max + 1));
  }
  function nextChoice(arr) {
    return arr[nextInt(0, arr.length - 1)];
  }
  function branch(suffix) {
    return createSeeder(seed + ":" + suffix);
  }
  return { next, nextFloat, nextInt, nextChoice, branch };
}

// src/engine/axes.ts
var AXIS_KEYS = [
  "caution",
  "passivity",
  "submission",
  "warmth",
  "trust",
  "altruism",
  "sociability",
  "integrity",
  "loyalty",
  "optimism",
  "discipline",
  "curiosity",
  "confidence",
  "forgiveness"
];
function generateAxisValue(seeder) {
  const raw = seeder.nextFloat(0.05, 0.95);
  return raw < 0.5 ? 0.5 * Math.pow(raw / 0.5, 0.7) : 1 - 0.5 * Math.pow((1 - raw) / 0.5, 0.7);
}
function generateAxes(seeder, archetype) {
  const axisSeed = seeder.branch("axes");
  return AXIS_KEYS.reduce((acc, key) => {
    const range = archetype?.signature[key];
    const value = range ? axisSeed.nextFloat(range[0], range[1]) : generateAxisValue(axisSeed);
    acc[key] = parseFloat(value.toFixed(4));
    return acc;
  }, {});
}
function readEmergentTraits(axes) {
  const traits = [];
  if (axes.integrity > 0.7 && axes.loyalty > 0.7 && axes.altruism > 0.6) traits.push("honor");
  if (axes.caution > 0.65 && axes.discipline > 0.65 && axes.curiosity > 0.5) traits.push("estratega");
  if (axes.warmth > 0.75 && axes.altruism > 0.65) traits.push("nobleza");
  if (axes.passivity < 0.3 && axes.confidence > 0.7) traits.push("hero\xEDsmo");
  if (axes.caution < 0.3 && axes.discipline < 0.35) traits.push("imprudencia extrema");
  if (axes.trust < 0.25 && axes.forgiveness < 0.3) traits.push("rencor");
  if (axes.submission > 0.8 && axes.confidence < 0.3) traits.push("ingenuidad");
  if (axes.optimism > 0.75 && axes.trust > 0.65 && axes.warmth > 0.6) traits.push("sabidur\xEDa benevolente");
  return traits;
}

// src/engine/archetypes.ts
var ARCHETYPES = [
  {
    id: "honor",
    weight: 1,
    signature: {
      integrity: [0.72, 0.93],
      loyalty: [0.72, 0.95],
      altruism: [0.62, 0.88]
    },
    primaryAxis: "integrity",
    fragments: [
      "Creci\xF3 en una familia que pon\xEDa el honor por encima de la supervivencia.",
      "Aprendi\xF3 desde joven que romper una promesa era peor que morir.",
      "Su linaje carg\xF3 verg\xFCenzas ajenas durante generaciones; jur\xF3 no a\xF1adir m\xE1s."
    ]
  },
  {
    id: "imprudente",
    weight: 1,
    signature: {
      caution: [0.05, 0.28],
      discipline: [0.05, 0.33],
      passivity: [0.05, 0.35]
    },
    primaryAxis: "caution",
    fragments: [
      "Nunca termin\xF3 nada que empez\xF3, pero eso nunca le fren\xF3 de intentarlo.",
      "Fue expulsado de tres gremios por insubordinaci\xF3n, y est\xE1 orgulloso de ello.",
      "Sus cicatrices cuentan historias que su memoria ya no puede."
    ]
  },
  {
    id: "calido",
    weight: 1,
    signature: {
      warmth: [0.76, 0.96],
      altruism: [0.66, 0.9],
      sociability: [0.55, 0.9]
    },
    primaryAxis: "warmth",
    fragments: [
      "Recogi\xF3 a mendigos en invierno cuando nadie m\xE1s lo hac\xEDa.",
      "Su puerta nunca estuvo cerrada para los que llegaban con hambre.",
      "Perdi\xF3 su fortuna ayudando a extra\xF1os; nunca lo lament\xF3 del todo."
    ]
  },
  {
    id: "rencoroso",
    weight: 1,
    signature: {
      trust: [0.05, 0.24],
      forgiveness: [0.05, 0.29],
      warmth: [0.1, 0.45]
    },
    primaryAxis: "trust",
    fragments: [
      "Alguien a quien amaba lo traicion\xF3. No olvid\xF3. No perdon\xF3.",
      "Aprendi\xF3 que la confianza es un lujo que los ingenuos pagan caro.",
      "Guarda cada deuda como monedas en un bolso que nunca vac\xEDa."
    ]
  },
  {
    id: "erudito",
    weight: 1,
    signature: {
      curiosity: [0.76, 0.97],
      discipline: [0.62, 0.9],
      caution: [0.55, 0.85]
    },
    primaryAxis: "curiosity",
    fragments: [
      "Llen\xF3 cuadernos enteros antes de cumplir doce a\xF1os.",
      "Viaj\xF3 a lugares donde el mapa terminaba solo para ver qu\xE9 hab\xEDa m\xE1s all\xE1.",
      "Su maestro dijo que sab\xEDa demasiado para su propio bien. Ten\xEDa raz\xF3n."
    ]
  },
  {
    id: "difuso",
    weight: 1.5,
    // slightly more common: many souls carry no defining origin
    signature: {},
    // no primaryAxis → birth stamp seals whichever axis emerged most extreme
    fragments: [
      "Su pasado es difuso, como arena que el viento remodela continuamente.",
      "No habla de d\xF3nde vino. Nadie ha insistido lo suficiente.",
      "Lleg\xF3 al pueblo sin m\xE1s pertenencias que lo puesto y una historia a medias."
    ]
  }
];
function pickArchetype(seeder) {
  const as = seeder.branch("archetype");
  const total = ARCHETYPES.reduce((sum, a) => sum + a.weight, 0);
  let roll = as.nextFloat(0, total);
  for (const a of ARCHETYPES) {
    roll -= a.weight;
    if (roll < 0) return a;
  }
  return ARCHETYPES[ARCHETYPES.length - 1];
}

// src/engine/behavior.ts
var T_MILD = 0.15;
var T_STRONG = 0.3;
var AXIS_CUES = [
  {
    axis: "caution",
    low: {
      mild: ["A veces cruza un umbral sin mirar lo que hay detr\xE1s."],
      strong: ["Entra a cualquier lugar sin revisar las salidas.", "Se lanza antes de medir la ca\xEDda."]
    },
    high: {
      mild: ["Hace una pausa breve antes de avanzar."],
      strong: ["Escanea la sala antes de cruzar cualquier umbral.", "Tantea cada paso como si el suelo pudiera ceder."]
    }
  },
  {
    axis: "passivity",
    low: {
      mild: ["Responde r\xE1pido cuando algo lo desaf\xEDa."],
      strong: ["Da el primer golpe en cuanto huele tensi\xF3n.", "Avanza hacia el conflicto en vez de rodearlo."]
    },
    high: {
      mild: ["Deja que otros tomen la iniciativa."],
      strong: ["Espera a que la tormenta pase antes de moverse.", "Cede el paso aunque tenga la raz\xF3n."]
    }
  },
  {
    axis: "submission",
    low: {
      mild: ["Reacomoda al grupo a su alrededor sin pedir permiso."],
      strong: ["Habla \xFAltimo y todos esperan a que termine.", "Ocupa el centro de la sala como si le correspondiera."]
    },
    high: {
      mild: ["Busca aprobaci\xF3n con la mirada antes de actuar."],
      strong: ["Baja la voz cuando alguien con m\xE1s peso entra.", "Acomoda sus planes a los de cualquiera que insista."]
    }
  },
  {
    axis: "warmth",
    low: {
      mild: ["Rara vez sostiene el contacto visual."],
      strong: ["Trata a los dem\xE1s como obst\xE1culos o herramientas.", "Su saludo es un tr\xE1mite, no un gesto."]
    },
    high: {
      mild: ["Sus ojos encuentran a los dem\xE1s con facilidad."],
      strong: ["Recuerda detalles peque\xF1os de quienes acaba de conocer.", "Toca el hombro del que pasa a su lado."]
    }
  },
  {
    axis: "trust",
    low: {
      mild: ["Tarda en aceptar lo que le ofrecen."],
      strong: ["Cuenta las monedas dos veces aunque se las d\xE9 un amigo.", "Busca el motivo oculto detr\xE1s de cada favor."]
    },
    high: {
      mild: ["Acepta la palabra de otros sin mucho rodeo."],
      strong: ["Entrega su espalda a quien apenas conoce.", "Cree primero y comprueba despu\xE9s, si acaso."]
    }
  },
  {
    axis: "altruism",
    low: {
      mild: ["Calcula lo que gana antes de mover un dedo."],
      strong: ["Toma su parte primero y la de nadie m\xE1s le importa.", "Pasa de largo ante quien necesita ayuda."]
    },
    high: {
      mild: ["Comparte sin que se lo pidan."],
      strong: ["Cede su raci\xF3n al que tiene menos.", "Se interpone cuando alguien m\xE1s va a salir herido."]
    }
  },
  {
    axis: "sociability",
    low: {
      mild: ["Prefiere los bordes de la plaza a su centro."],
      strong: ["Desaparece de las reuniones sin que nadie lo note.", "Busca el rinc\xF3n m\xE1s lejano de cualquier multitud."]
    },
    high: {
      mild: ["Se mueve hacia el grupo, no lejos de \xE9l."],
      strong: ["Hila conversaci\xF3n con cualquiera que se cruce.", "Se marchita cuando pasa demasiado tiempo solo."]
    }
  },
  {
    axis: "integrity",
    low: {
      mild: ["Acomoda la verdad seg\xFAn le convenga."],
      strong: ["Promete con facilidad y olvida con la misma.", "Toma el atajo aunque sepa que no le toca."]
    },
    high: {
      mild: ["Cumple lo que dice incluso cuando estorba."],
      strong: ["Devuelve de m\xE1s antes que quedarse con lo ajeno.", "Sostiene su palabra aunque le cueste caro."]
    }
  },
  {
    axis: "loyalty",
    low: {
      mild: ["Cambia de bando si el viento cambia."],
      strong: ["Abandona al aliado en cuanto deja de servirle.", "Mide cada lealtad por lo que rinde hoy."]
    },
    high: {
      mild: ["Defiende a los suyos incluso ausentes."],
      strong: ["Se queda junto al que cae aunque ardan los puentes.", "No traiciona ni cuando traicionarlo ser\xEDa sensato."]
    }
  },
  {
    axis: "optimism",
    low: {
      mild: ["Espera lo peor de cada plan."],
      strong: ["Cuenta las formas en que algo puede salir mal.", "Ve la ruina antes que la oportunidad."]
    },
    high: {
      mild: ["Encuentra un resquicio de luz en lo torcido."],
      strong: ["Da por hecho que ma\xF1ana ir\xE1 mejor.", "Se levanta de cada golpe como si esperara el siguiente con ganas."]
    }
  },
  {
    axis: "discipline",
    low: {
      mild: ["Rara vez termina lo que empieza en el orden que plane\xF3."],
      strong: ["Salta de un impulso a otro sin acabar ninguno.", "Rompe su propia rutina al primer antojo."]
    },
    high: {
      mild: ["Mantiene su horario sin que nadie se lo pida."],
      strong: ["Repite el mismo gesto mil veces hasta que sale perfecto.", "No cede al antojo aunque nadie lo est\xE9 mirando."]
    }
  },
  {
    axis: "curiosity",
    low: {
      mild: ["Deja sin abrir lo que no le concierne."],
      strong: ["Aparta la mirada de lo desconocido.", "Prefiere lo de siempre a cualquier puerta nueva."]
    },
    high: {
      mild: ["Pregunta una vez m\xE1s de lo que har\xEDa falta."],
      strong: ["Abre cada caja solo para ver qu\xE9 guarda.", "Sigue el ruido extra\xF1o en vez de alejarse de \xE9l."]
    }
  },
  {
    axis: "confidence",
    low: {
      mild: ["Hace pausas largas antes de opinar en grupo."],
      strong: ["Retira lo que dijo en cuanto alguien frunce el ce\xF1o.", "Pide perd\xF3n por ocupar espacio."]
    },
    high: {
      mild: ["Sostiene su postura sin buscar respaldo."],
      strong: ["Habla como si sus palabras ya hubieran sido aprobadas.", "No se inmuta cuando la sala entera lo contradice."]
    }
  },
  {
    axis: "forgiveness",
    low: {
      mild: ["Guarda los desaires m\xE1s de la cuenta."],
      strong: ["Lleva la cuenta de cada agravio sin olvidar uno.", "Devuelve el golpe aunque tarde a\xF1os en hacerlo."]
    },
    high: {
      mild: ["Suelta las ofensas peque\xF1as con un encogimiento."],
      strong: ["Tiende la mano al que ayer lo hiri\xF3.", "Olvida la deuda antes de que pese."]
    }
  }
];
function scoreAxes(axes) {
  const byAxis = new Map(AXIS_CUES.map((c) => [c.axis, c]));
  return AXIS_KEYS.map((axis) => {
    const cue = byAxis.get(axis);
    const v = axes[axis];
    const dist = Math.abs(v - 0.5);
    const pole = v < 0.5 ? cue.low : cue.high;
    return { axis, dist, pole };
  }).filter((s) => s.dist >= T_MILD).sort((a, b) => b.dist - a.dist);
}
function readBehavior(seeder, axes, maxCues = 3) {
  const top = scoreAxes(axes).slice(0, maxCues);
  return top.map((s) => {
    const tier = s.dist >= T_STRONG ? s.pole.strong : s.pole.mild;
    return seeder.branch("behavior").branch(s.axis).nextChoice(tier);
  });
}
function firstImpression(seeder, axes) {
  const cues = readBehavior(seeder, axes, 2);
  if (cues.length === 0) return "No hay nada inmediatamente llamativo en c\xF3mo se mueve.";
  return cues.join(" ");
}

// src/engine/conversations.ts
var BASE_RATE = 0.06;
var CONVERSATION_COOLDOWN = 40;
var CONVO_NUDGE = 8e-3;
var TOPICS = ["training", "survival", "social", "hobby", "casual"];
function chattiness(axes) {
  return axes.sociability * 0.6 + axes.curiosity * 0.4;
}
function pairKey(a, b) {
  return a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
}
function conversationAffinity(a, b) {
  return chattiness(a.axes) * chattiness(b.axes);
}
function conversationChance(a, b, proximity) {
  return BASE_RATE * conversationAffinity(a, b) * clamp01(proximity);
}
function topicWeights(a, b) {
  const avg = (k) => (a[k] + b[k]) / 2;
  return {
    training: (avg("curiosity") + avg("discipline")) / 2,
    survival: (1 - avg("optimism")) * 0.5 + avg("caution") * 0.3,
    social: (avg("warmth") + avg("sociability")) / 2 * 0.8,
    hobby: avg("optimism") * 0.4,
    casual: 0.3
    // siempre posible
  };
}
function pickTopic(seeder, a, b) {
  const w = topicWeights(a, b);
  const total = TOPICS.reduce((s, t) => s + w[t], 0);
  let roll = seeder.nextFloat(0, total);
  for (const t of TOPICS) {
    roll -= w[t];
    if (roll < 0) return t;
  }
  return "casual";
}
function toward(self, other) {
  if (other > self) return 1;
  if (other < self) return -1;
  return 0;
}
function buildNudges(topic, a, b, intensity) {
  const step2 = CONVO_NUDGE * intensity;
  const na = {};
  const nb = {};
  const converge = (k, scale = 1) => {
    na[k] = (na[k] ?? 0) + toward(a[k], b[k]) * step2 * scale;
    nb[k] = (nb[k] ?? 0) + toward(b[k], a[k]) * step2 * scale;
  };
  const liftToHigher = (k, scale = 1) => {
    const target = Math.max(a[k], b[k]);
    na[k] = (na[k] ?? 0) + toward(a[k], target) * step2 * scale;
    nb[k] = (nb[k] ?? 0) + toward(b[k], target) * step2 * scale;
  };
  const bumpBoth = (k, scale = 1) => {
    na[k] = (na[k] ?? 0) + step2 * scale;
    nb[k] = (nb[k] ?? 0) + step2 * scale;
  };
  switch (topic) {
    case "training":
      converge("curiosity");
      converge("discipline");
      liftToHigher("caution", 0.5);
      break;
    case "survival":
      converge("caution");
      liftToHigher("confidence", 0.8);
      break;
    case "social":
      liftToHigher("warmth", 0.8);
      liftToHigher("optimism", 0.5);
      bumpBoth("trust", 0.4);
      break;
    case "hobby":
      bumpBoth("curiosity", 0.5);
      bumpBoth("optimism", 0.5);
      break;
    case "casual":
      bumpBoth("warmth", 0.4);
      bumpBoth("trust", 0.4);
      break;
  }
  return { a: na, b: nb };
}
function rollConversation(seeder, a, b, ctx) {
  if (ctx.cooldownRemaining > 0) return null;
  const chance = conversationChance(a, b, ctx.proximity);
  const cs = seeder.branch(pairKey(a, b));
  if (cs.nextFloat() >= chance) return null;
  const intensity = parseFloat((0.2 + cs.nextFloat() * 0.5).toFixed(3));
  const topic = pickTopic(cs, a.axes, b.axes);
  const nudges = buildNudges(topic, a.axes, b.axes, intensity);
  return { participants: [a.id, b.id], topic, intensity, nudges, sealedAt: 0 };
}
function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// src/engine/stamps.ts
var BANDS = [0, 0.25, 0.5, 0.75, 1];
var BAND_BOUNDARIES = [0.125, 0.375, 0.625, 0.875];
function bandOf(value) {
  let i = 0;
  while (i < BAND_BOUNDARIES.length && value >= BAND_BOUNDARIES[i]) i++;
  return i;
}
function nearestBand(value) {
  return BANDS.reduce(
    (prev, curr) => Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
}
function sealBirthStamp(axes, archetype, sealedAt = 0) {
  let key;
  if (archetype?.primaryAxis) {
    key = archetype.primaryAxis;
  } else {
    let maxDist = -1;
    key = "caution";
    for (const k of AXIS_KEYS) {
      const dist = Math.abs(axes[k] - 0.5);
      if (dist > maxDist) {
        maxDist = dist;
        key = k;
      }
    }
  }
  return { kind: "birth", axisKey: key, bandValue: nearestBand(axes[key]), sealedAt };
}
function sealIfBandCrossed(axisKey, oldValue, newValue, sealedAt = 0) {
  if (bandOf(newValue) === bandOf(oldValue)) return null;
  return { kind: "growth", axisKey, bandValue: nearestBand(newValue), sealedAt };
}
function softCeiling(value, delta) {
  const headroom = delta > 0 ? 1 - value : value;
  const damping = Math.pow(headroom / 0.5, 2);
  const next = value + delta * Math.min(1, damping);
  return next < 0 ? 0 : next > 1 ? 1 : next;
}

// src/engine/debug.ts
var isProd = typeof process !== "undefined" && !!process.env && false;
var DEV_MODE = !isProd;
function setDevMode(on) {
  DEV_MODE = on;
}
var AXIS_LABELS = {
  caution: ["imprudente", "cauto"],
  passivity: ["combativo", "pasivo"],
  submission: ["dominante", "sumiso"],
  warmth: ["fr\xEDo", "c\xE1lido"],
  trust: ["desconfiado", "confiado"],
  altruism: ["ego\xEDsta", "altruista"],
  sociability: ["solitario", "sociable"],
  integrity: ["acomodaticio", "\xEDntegro"],
  loyalty: ["desleal", "leal"],
  optimism: ["pesimista", "optimista"],
  discipline: ["impulsivo", "disciplinado"],
  curiosity: ["cerrado", "curioso"],
  confidence: ["inseguro", "seguro"],
  forgiveness: ["rencoroso", "indulgente"]
};
function bar(value, cells = 10) {
  const filled = Math.round(value * cells);
  return "\u2588".repeat(filled) + "\u2591".repeat(cells - filled);
}
function describeAxis(key, value) {
  const [low, high] = AXIS_LABELS[key];
  const label = value < 0.5 ? low : high;
  return `${label.padEnd(13)} ${value.toFixed(2)} ${bar(value)} banda${bandOf(value)}`;
}
function inspectNPC(npc) {
  if (!DEV_MODE) return "";
  const stamps = npc.stamps.map((s) => `${s.kind} ${s.axisKey}@${s.bandValue}`).join(", ");
  const emergent = readEmergentTraits(npc.axes);
  const axesSorted = [...AXIS_KEYS].sort(
    (a, b) => Math.abs(npc.axes[b] - 0.5) - Math.abs(npc.axes[a] - 0.5)
  );
  const axesLines = axesSorted.map((k) => `     ${describeAxis(k, npc.axes[k])}`).join("\n");
  return [
    `\u{1F527} [DEV] ${npc.name} \u2014 ${npc.id}`,
    `   origen     : ${npc.originArchetypeId.padEnd(12)} dificultad: ${npc.difficulty}/1000   estrellas: ${npc.stars}\u2605 (piso ${npc.rosterFloorAtSummon})`,
    `   estampas   : ${stamps}`,
    `   emergente  : ${emergent.length ? emergent.join(", ") : "(ninguno a\xFAn)"}`,
    `   ejes (14, de m\xE1s a menos definitorio):`,
    axesLines
  ].join("\n");
}
var TOPIC_REVEAL = {
  training: "comparan t\xE9cnicas y lo aprendido en los pisos",
  survival: "calculan riesgos y c\xF3mo seguir vivos",
  social: "algo personal \u2014 alguien del pueblo, un v\xEDnculo",
  hobby: "un pasatiempo en com\xFAn, sin urgencia",
  casual: "ch\xE1chara sin agenda, solo acompa\xF1arse"
};
function formatNudges(n) {
  const entries = Object.entries(n).filter(([, v]) => v);
  if (entries.length === 0) return "\u2014";
  return entries.map(([k, v]) => `${k} ${v >= 0 ? "+" : ""}${v.toFixed(3)}`).join(", ");
}
function revealExchange(ex, nameOf) {
  if (!DEV_MODE) return "";
  const a = nameOf ? nameOf(ex.participants[0]) : ex.participants[0];
  const b = nameOf ? nameOf(ex.participants[1]) : ex.participants[1];
  return `[${a} \u2194 ${b}] ${ex.topic} \u2014 ${TOPIC_REVEAL[ex.topic]} (intensidad ${ex.intensity}).
    nudges ${a}: ${formatNudges(ex.nudges.a)}
    nudges ${b}: ${formatNudges(ex.nudges.b)}`;
}

// src/engine/experience.ts
var BASE_DELTA = 0.04;
function starProgressionMultiplier(stars) {
  return 1 + (stars - 1) * 0.15;
}
var BIRTH_AXIS_RESISTANCE = 0.6;
function birthAxis(stamps) {
  const birth = stamps.find((s) => s.kind === "birth");
  return birth ? birth.axisKey : null;
}
function resistanceFactor(axisKey, stamps) {
  return axisKey === birthAxis(stamps) ? BIRTH_AXIS_RESISTANCE : 1;
}
function moveAxis(axisKey, axes, stamps, rawDelta) {
  const delta = rawDelta * resistanceFactor(axisKey, stamps);
  const oldValue = axes[axisKey];
  const newValue = parseFloat(softCeiling(oldValue, delta).toFixed(4));
  const stamp = sealIfBandCrossed(axisKey, oldValue, newValue);
  return { newValue, stamp };
}
function applyExperience(seeder, axes, stamps, event, stars) {
  const updated = { ...axes };
  const newStamps = [];
  const es = seeder.branch("experience");
  const jitter = 0.85 + es.nextFloat() * 0.3;
  const intensity = Math.min(1, event.intensity * jitter);
  const starMul = stars ? starProgressionMultiplier(stars) : 1;
  const delta = BASE_DELTA * intensity * starMul;
  function apply(axisKey, rawDelta) {
    const { newValue, stamp } = moveAxis(axisKey, updated, stamps, rawDelta);
    updated[axisKey] = newValue;
    if (stamp) newStamps.push(stamp);
  }
  if (event.kind === "combat") {
    const sign = event.outcome === "failure" ? -1 : 1;
    const magnitude = event.outcome === "partial" ? 0.5 : 1;
    const confFilter = 1 + (0.5 - axes.confidence) * 0.8;
    apply("confidence", sign * delta * magnitude * confFilter);
    const passFilter = 0.5 + axes.passivity * 0.8;
    apply("passivity", -sign * delta * magnitude * 0.6 * passFilter);
    if (event.outcome === "failure") {
      apply("caution", delta * 0.5);
    } else {
      apply("caution", (0.5 - axes.caution) * delta * 0.3);
    }
  } else if (event.kind === "scout") {
    const sign = event.outcome === "failure" ? -1 : 1;
    const discFilter = 0.7 + axes.discipline * 0.6;
    apply("curiosity", sign * delta * discFilter);
    if (event.outcome === "success") {
      apply("caution", -delta * 0.3);
    } else if (event.outcome === "failure") {
      apply("caution", delta * 0.3);
    }
  } else if (event.kind === "rest") {
    const recover = event.outcome === "failure" ? 0.4 : 1;
    apply("confidence", delta * 0.5 * recover);
    apply("optimism", delta * 0.6 * recover);
    apply("caution", (0.5 - axes.caution) * delta * 0.2 * recover);
  }
  return { axes: updated, newStamps };
}
function applyConversationNudges(axes, stamps, nudges) {
  const updated = { ...axes };
  const newStamps = [];
  for (const [key, delta] of Object.entries(nudges)) {
    if (!delta) continue;
    const { newValue, stamp } = moveAxis(key, updated, stamps, delta);
    updated[key] = newValue;
    if (stamp) newStamps.push(stamp);
  }
  return { axes: updated, newStamps };
}

// src/engine/gacha.ts
var BASE_WEIGHTS = {
  1: 0.6,
  2: 0.25,
  3: 0.1,
  4: 0.04,
  5: 0.01
};
var PENALTY_STRENGTH = 3;
var DIFFICULTY_MIN = 1;
var DIFFICULTY_MAX = 1e3;
var M_CAP = 1.25;
var FLOORS_PER_STEP = 10;
var FLOORS_TO_CAP_EASY = 90;
var FLOORS_TO_CANCEL_MAX = 100;
var PER_STEP_EASY = M_CAP / (FLOORS_TO_CAP_EASY / FLOORS_PER_STEP);
var PER_STEP_HARD = PENALTY_STRENGTH / (FLOORS_TO_CANCEL_MAX / FLOORS_PER_STEP);
var STAR_TIERS = [1, 2, 3, 4, 5];
function rollDifficulty(seeder) {
  return seeder.branch("difficulty").nextInt(DIFFICULTY_MIN, DIFFICULTY_MAX);
}
function computeExponent(difficulty, rosterFloor) {
  const norm = clamp012((difficulty - DIFFICULTY_MIN) / (DIFFICULTY_MAX - DIFFICULTY_MIN));
  const difficultyPenalty = PENALTY_STRENGTH * norm;
  const perStep = PER_STEP_EASY + (PER_STEP_HARD - PER_STEP_EASY) * norm;
  const steps = Math.floor(Math.max(0, rosterFloor) / FLOORS_PER_STEP);
  const floorBonus = perStep * steps;
  return Math.min(M_CAP, floorBonus - difficultyPenalty);
}
function starProbabilities(difficulty, rosterFloor = 0) {
  const m = computeExponent(difficulty, rosterFloor);
  const weights = STAR_TIERS.map((s) => BASE_WEIGHTS[s] * Math.exp(m * (s - 1)));
  const total = weights.reduce((a, b) => a + b, 0);
  return STAR_TIERS.reduce((acc, s, i) => {
    acc[s] = weights[i] / total;
    return acc;
  }, {});
}
function rollStars(seeder, difficulty, rosterFloor = 0) {
  const probs = starProbabilities(difficulty, rosterFloor);
  const roll = seeder.branch("stars").nextFloat();
  let cumulative = 0;
  for (const s of STAR_TIERS) {
    cumulative += probs[s];
    if (roll < cumulative) return s;
  }
  return 1;
}
function clamp012(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// src/engine/mediator.ts
var FEAR_CONF_MAX = 0.35;
var FEAR_OPT_MAX = 0.35;
var FEAR_MIN_FRAC = 0.5;
var CONFLICT_FORG_MAX = 0.25;
var CONFLICT_TRST_MAX = 0.25;
var CONFLICT_WARM_MAX = 0.3;
var ISOLATION_SOC_MAX = 0.18;
var ISOLATION_WARM_MAX = 0.22;
var TOPIC_REPORT = {
  training: "entrenan juntos",
  survival: "hablan de c\xF3mo seguir vivos",
  social: "pasan tiempo cerca; algo personal",
  hobby: "comparten un pasatiempo",
  casual: "se acompa\xF1an sin m\xE1s"
};
var RULES = {
  difficulty: "La dificultad no multiplica fuerza: obliga a desbloquear m\xE1s para sobrevivir. No la ver\xE1s; la intuir\xE1s.",
  promotion: "Promover tiene riesgo real: \xE9xito, parcial, corrupci\xF3n o muerte. Los recursos son escasos.",
  death: "La muerte es permanente. Quien cae no vuelve.",
  start: "Todos empiezan en el piso 1, sin importar la dificultad de su mundo.",
  growth: "Crecen por exposici\xF3n, filtrada por qui\xE9nes son. La misma experiencia forja almas distintas."
};
function briefRoster(npcs) {
  if (npcs.length === 0) return "El roster est\xE1 vac\xEDo. Invoca para empezar.";
  const alive = npcs.filter((n) => n.isAlive);
  const dead = npcs.length - alive.length;
  const top = alive.reduce((m, n) => n.floorReached > m ? n.floorReached : m, 0);
  const parts = [`Roster: ${alive.length} ${alive.length === 1 ? "vivo" : "vivos"}`];
  if (dead) parts.push(`${dead} ${dead === 1 ? "ca\xEDdo" : "ca\xEDdos"}`);
  parts.push(`el m\xE1s alto en piso ${top}`);
  return parts.join(". ") + ".";
}
function describeNPC(seeder, npc) {
  const status = npc.isAlive ? `piso ${npc.floorReached}` : "ca\xEDdo";
  const seen = firstImpression(seeder.branch("observe:" + npc.id), npc.axes);
  return `${npc.name} (${npc.stars}\u2605, ${status}). ${seen}`;
}
function reportActivity(exchanges, npcs) {
  if (exchanges.length === 0) return "Nada que reportar. El roster ha estado quieto.";
  const nameOf = new Map(npcs.map((n) => [n.id, n.name]));
  const resolve = (id) => nameOf.get(id) ?? id;
  const byPair = /* @__PURE__ */ new Map();
  for (const e of exchanges) {
    const key = `${resolve(e.participants[0])} y ${resolve(e.participants[1])}`;
    const rec = byPair.get(key) ?? { count: 0, topics: {} };
    rec.count++;
    rec.topics[e.topic] = (rec.topics[e.topic] ?? 0) + 1;
    byPair.set(key, rec);
  }
  const lines = [];
  for (const [pair, rec] of byPair) {
    const dominant = Object.entries(rec.topics).sort((x, y) => y[1] - x[1])[0][0];
    lines.push(`${pair}: ${TOPIC_REPORT[dominant]} (${rec.count}).`);
  }
  return lines.join("\n");
}
function explainRule(key) {
  return RULES[key] ?? "No tengo esa regla registrada. S\xE9 m\xE1s espec\xEDfico.";
}
function relay(npc, instruction) {
  return `Transmitido a ${npc.name}: "${instruction}". Lo interpretar\xE1 a su manera.`;
}
function checkRosterFear(alive) {
  if (alive.length < 2) return null;
  const fearful = alive.filter(
    (n) => n.axes.confidence < FEAR_CONF_MAX && n.axes.optimism < FEAR_OPT_MAX
  );
  if (fearful.length / alive.length < FEAR_MIN_FRAC) return null;
  return "Hay miedo en el roster. No el tuyo \u2014 el de ellos. Pregunta si quieres saber m\xE1s.";
}
function checkConflict(alive) {
  for (let i = 0; i < alive.length - 1; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i];
      const b = alive[j];
      if (a.axes.forgiveness < CONFLICT_FORG_MAX && b.axes.forgiveness < CONFLICT_FORG_MAX && a.axes.trust < CONFLICT_TRST_MAX && b.axes.trust < CONFLICT_TRST_MAX && (a.axes.warmth < CONFLICT_WARM_MAX || b.axes.warmth < CONFLICT_WARM_MAX)) {
        return `Entre ${a.name} y ${b.name} hay algo que no se dice. Podr\xEDa volverse problema.`;
      }
    }
  }
  return null;
}
function checkIsolation(alive) {
  const isolated = alive.find(
    (n) => n.axes.sociability < ISOLATION_SOC_MAX && n.axes.warmth < ISOLATION_WARM_MAX
  );
  if (!isolated) return null;
  return `${isolated.name} se ha apartado del grupo. Nadie lo not\xF3 todav\xEDa.`;
}
function rareWhisper(npcs) {
  const alive = npcs.filter((n) => n.isAlive);
  if (alive.length === 0) return null;
  return checkRosterFear(alive) ?? checkConflict(alive) ?? checkIsolation(alive);
}

// src/engine/needs.ts
var SATIETY_DECAY = 0.012;
var ENERGY_DECAY = 0.01;
var EAT_RECOVER = 0.14;
var REST_RECOVER = 0.05;
var HEALTH_REGEN = 6e-3;
var HEALTH_DRAIN = 0.02;
var CRITICAL = 0.12;
var clamp013 = (v) => Math.max(0, Math.min(1, v));
var round = (n) => ({
  satiety: parseFloat(n.satiety.toFixed(4)),
  energy: parseFloat(n.energy.toFixed(4)),
  health: parseFloat(n.health.toFixed(4))
});
function effortOf(a) {
  return a === "fight" ? 2.6 : a === "train" ? 2 : a === "work" ? 1.4 : 1;
}
function appetiteOf(a) {
  return a === "fight" || a === "train" ? 1.4 : a === "work" ? 1.2 : 1;
}
function createNeeds(seeder, axes) {
  const s = seeder.branch("needs");
  const j = () => 0.82 + s.nextFloat() * 0.18;
  return round({
    satiety: clamp013(0.65 * j() + 0.25),
    energy: clamp013(0.65 * j() + 0.25 + (axes.discipline - 0.5) * 0.1),
    health: clamp013(0.85 + s.nextFloat() * 0.15)
  });
}
function step(n, axes, activity) {
  const drainMul = 1.1 - axes.discipline * 0.3;
  const recovMul = 0.85 + axes.discipline * 0.3;
  let satiety = n.satiety;
  if (activity === "eat") satiety += EAT_RECOVER * recovMul;
  else satiety -= SATIETY_DECAY * drainMul * appetiteOf(activity);
  let energy = n.energy;
  if (activity === "rest") energy += REST_RECOVER * recovMul;
  else energy -= ENERGY_DECAY * drainMul * effortOf(activity);
  satiety = clamp013(satiety);
  energy = clamp013(energy);
  let health = n.health;
  const starving = satiety <= CRITICAL;
  const exhausted = energy <= CRITICAL;
  if (starving || exhausted) {
    const deficit = (starving ? CRITICAL - satiety : 0) + (exhausted ? CRITICAL - energy : 0);
    health -= HEALTH_DRAIN * (0.5 + deficit / CRITICAL);
  } else if (satiety > 0.5 && energy > 0.5) {
    health += HEALTH_REGEN * recovMul;
  }
  health = clamp013(health);
  return { satiety, energy, health };
}
function tickNeeds(needs, axes, activity, ticks = 1) {
  let n = needs;
  for (let i = 0; i < ticks; i++) n = step(n, axes, activity);
  return round(n);
}
function needsStatus(n) {
  const out = [];
  if (n.energy <= CRITICAL) out.push("est\xE1 al borde del colapso por agotamiento");
  else if (n.energy < 0.3) out.push("se le ve agotado, arrastra los pies");
  else if (n.energy < 0.5) out.push("anda algo cansado");
  if (n.satiety <= CRITICAL) out.push("se muere de hambre");
  else if (n.satiety < 0.3) out.push("est\xE1 hambriento");
  else if (n.satiety < 0.5) out.push("le vendr\xEDa bien comer");
  if (n.health < 0.3) out.push("se le ve d\xE9bil, como enfermo");
  if (out.length === 0) out.push("se le ve entero");
  return out;
}
function criticalNeed(n) {
  if (n.health <= 0.02) return "collapse";
  if (n.satiety <= 0) return "starvation";
  if (n.energy <= 0) return "exhaustion";
  return null;
}

// src/engine/world.ts
var NAME_PRE = ["Vael", "Orn", "Sel", "Thar", "Mire", "Cael", "Dun", "Ys", "Brae", "Lethe", "Var", "Ner", "Sund", "Aeg", "Corv", "Hal"];
var NAME_SUF = ["oria", "mar", "heim", "wyn", "dor", "eth", "gard", "is", "une", "arr", "ovia", "ane", "orne", "ys", "aith", "oss"];
function coin(s) {
  const raw = s.nextChoice(NAME_PRE) + s.nextChoice(NAME_SUF);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
var CATACLYSMS = [
  {
    id: "grieta",
    nature: (n) => `${n.land} fue un mundo de ciudades altas y ferias largas, hasta que el cielo sobre ${n.feature} se raj\xF3.`,
    cataclysm: (n) => `De la grieta abierta sobre ${n.feature} sali\xF3 algo que no ten\xEDa nombre, y se lo comi\xF3 todo.`,
    beats: (n) => [
      `Primero fueron las luces extra\xF1as sobre ${n.feature}; nadie quiso leer el augurio.`,
      `La grieta se abri\xF3 una noche sin luna y de ella baj\xF3 el fr\xEDo.`,
      `${n.north} cay\xF3 en tres d\xEDas; los que huyeron hablaban de sombras con demasiados brazos.`,
      `${n.south} cerr\xF3 sus puertas y aun as\xED entraron, como si la piedra no existiera.`,
      `Al final no qued\xF3 quien encendiera las farolas de ${n.land}.`
    ],
    shards: (n) => ({
      core: [
        `una grieta en el cielo que respiraba`,
        `el momento exacto en que ${n.feature} dej\xF3 de existir`,
        `haber gritado una orden que nadie lleg\xF3 a obedecer`
      ],
      secondary: [
        `correr por las murallas de ${n.north} con algo detr\xE1s`,
        `el olor a quemado que ven\xEDa de ${n.feature}`,
        `una puerta que cerraste sabiendo que no bastar\xEDa`
      ],
      peripheral: [
        `rumores de luces raras sobre ${n.feature}`,
        `gente de ${n.north} que lleg\xF3 sin equipaje y sin hablar`,
        `un fr\xEDo que entr\xF3 de golpe una noche de mercado`
      ]
    })
  },
  {
    id: "guerra",
    nature: (n) => `${n.land} era dos coronas vecinas, ${n.north} y ${n.south}, que llevaban un siglo midi\xE9ndose sin tocarse.`,
    cataclysm: (n) => `La guerra entre ${n.north} y ${n.south} no dej\xF3 vencedor: solo ceniza donde estuvo ${n.land}.`,
    beats: (n) => [
      `Un heraldo de ${n.north} muri\xF3 cruzando ${n.feature}; nadie supo de qu\xE9 lado vino la flecha.`,
      `Las dos coronas llamaron a sus hijos a las armas el mismo invierno.`,
      `${n.feature} ardi\xF3 tantas veces que dej\xF3 de tener nombre.`,
      `Cuando se acabaron los soldados, ${n.south} mand\xF3 a los labradores.`,
      `No hubo tratado: solo dej\xF3 de haber a qui\xE9n matar en ${n.land}.`
    ],
    shards: (n) => ({
      core: [
        `firmar algo con la mano temblando`,
        `la cara de quien te jur\xF3 lealtad antes de ${n.feature}`,
        `una orden de avanzar que sab\xEDas que era el final`
      ],
      secondary: [
        `marchar de noche hacia ${n.feature}`,
        `repartir pan que ya no alcanzaba en ${n.south}`,
        `un estandarte cayendo en el barro`
      ],
      peripheral: [
        `levas que se llevaban a los muchachos de ${n.north}`,
        `el precio del grano subiendo cada semana`,
        `tambores lejos, siempre del lado de ${n.feature}`
      ]
    })
  },
  {
    id: "ruina",
    nature: (n) => `${n.land} prosper\xF3 sobre las ruinas de ${n.feature}, sin preguntarse qui\xE9n las hab\xEDa dejado vac\xEDas.`,
    cataclysm: (n) => `Algo dorm\xEDa bajo ${n.feature}, y ${n.land} cav\xF3 demasiado hondo.`,
    beats: (n) => [
      `Los mineros de ${n.feature} encontraron una puerta que no abr\xEDa hacia ning\xFAn lado.`,
      `Quien la toc\xF3 empez\xF3 a so\xF1ar lo mismo todas las noches.`,
      `${n.north} mand\xF3 eruditos; ninguno volvi\xF3 a explicarse del todo.`,
      `La cosa bajo ${n.feature} no atac\xF3: solo hizo que todo se pudriera al rev\xE9s.`,
      `${n.land} se vaci\xF3 sin una sola batalla, como una casa que se deja.`
    ],
    shards: (n) => ({
      core: [
        `una puerta de piedra que no abr\xEDa a ninguna parte`,
        `el mismo sue\xF1o repetido bajo ${n.feature}`,
        `haber escrito algo que despu\xE9s no pudiste leer`
      ],
      secondary: [
        `bajar a ${n.feature} con una l\xE1mpara que no iluminaba`,
        `compa\xF1eros que dejaron de reconocerte`,
        `un eco que respond\xEDa antes de que hablaras`
      ],
      peripheral: [
        `historias de mineros que no volv\xEDan de ${n.feature}`,
        `la comida que se echaba a perder demasiado r\xE1pido`,
        `gente de ${n.north} mirando al suelo al pasar`
      ]
    })
  },
  {
    id: "olvido",
    nature: (n) => `${n.land} era un mundo de archivos y memoria larga; cada familia guardaba su nombre desde el principio.`,
    cataclysm: (n) => `Una plaga del olvido cruz\xF3 ${n.land}: primero los nombres, despu\xE9s las caras, al final el camino a casa.`,
    beats: (n) => [
      `En ${n.south} empezaron a olvidar palabras peque\xF1as, y le restaron importancia.`,
      `Luego nadie recordaba el camino entre ${n.north} y ${n.feature}.`,
      `Los archivos de ${n.land} amanecieron en blanco, sin que nadie los tocara.`,
      `Madres que no reconoc\xEDan a sus hijos; hijos que no preguntaban por qu\xE9.`,
      `El \xFAltimo en olvidar apag\xF3 la luz sin saber ya para qu\xE9 serv\xEDa.`
    ],
    shards: (n) => ({
      core: [
        `un nombre en la punta de la lengua que nunca llega`,
        `mirar un archivo en blanco que t\xFA hab\xEDas llenado`,
        `haber sido el \xFAltimo en recordar algo importante`
      ],
      secondary: [
        `repetir una palabra para no perderla, y perderla igual`,
        `caras de ${n.south} que se volv\xEDan lisas`,
        `escribir tu propio nombre en la mano`
      ],
      peripheral: [
        `vecinos de ${n.north} que se perd\xEDan de camino a casa`,
        `cartas que llegaban sin remitente y sin sentido`,
        `un mercado donde nadie sab\xEDa ya los precios`
      ]
    })
  },
  {
    id: "marea",
    nature: (n) => `${n.land} viv\xEDa del mar: ${n.north} y ${n.south} eran puertos gemelos unidos por el muelle de ${n.feature}.`,
    cataclysm: (n) => `El mar subi\xF3 y no volvi\xF3 a bajar; ${n.land} est\xE1 bajo el agua desde entonces.`,
    beats: (n) => [
      `Las mareas de ${n.feature} empezaron a llegar m\xE1s alto cada luna.`,
      `${n.south} levant\xF3 diques; el agua entr\xF3 por debajo igual.`,
      `Una noche el muelle de ${n.feature} amaneci\xF3 a brazadas de profundidad.`,
      `${n.north} mand\xF3 barcos a buscar tierra seca; ninguno encontr\xF3 orilla.`,
      `${n.land} termin\xF3 siendo un techo de olas sobre las casas.`
    ],
    shards: (n) => ({
      core: [
        `el agua entrando por debajo de la puerta sin prisa`,
        `el muelle de ${n.feature} desapareciendo en una noche`,
        `haber decidido a qui\xE9n sub\xEDa al \xFAltimo bote`
      ],
      secondary: [
        `achicar agua sabiendo que no serv\xEDa`,
        `el sabor a sal en todo, hasta en el pan`,
        `barcos que sal\xEDan de ${n.north} y no volv\xEDan`
      ],
      peripheral: [
        `mareas cada vez m\xE1s altas en ${n.feature}`,
        `pescadores que dejaron de salir`,
        `el ruido del mar acerc\xE1ndose por las noches`
      ]
    })
  },
  {
    id: "sol-muerto",
    nature: (n) => `${n.land} med\xEDa el tiempo por su sol p\xE1lido; en ${n.feature} levantaban relojes para todo el reino.`,
    cataclysm: (n) => `El sol de ${n.land} se fue apagando, y con \xE9l el calor, las cosechas y al final las ganas.`,
    beats: (n) => [
      `Los relojeros de ${n.feature} notaron que los d\xEDas ven\xEDan m\xE1s cortos.`,
      `${n.north} quem\xF3 sus bosques para no congelarse el primer invierno largo.`,
      `Las cosechas de ${n.south} no salieron; la tierra se qued\xF3 dura.`,
      `La gente empez\xF3 a dormir de m\xE1s, como si el fr\xEDo diera sue\xF1o.`,
      `Nadie vio el \xFAltimo amanecer de ${n.land}; ya casi nadie miraba.`
    ],
    shards: (n) => ({
      core: [
        `un sol que cada d\xEDa daba menos`,
        `haber racionado el \xFAltimo calor de ${n.feature}`,
        `decidir qu\xE9 se quemaba para pasar la noche`
      ],
      secondary: [
        `cosechas que sal\xEDan negras en ${n.south}`,
        `dormir de m\xE1s sin poder evitarlo`,
        `cerrar casas vac\xEDas una a una`
      ],
      peripheral: [
        `d\xEDas que se acortaban en ${n.feature}`,
        `el precio de la le\xF1a que no paraba de subir`,
        `vecinos de ${n.north} que ya no abr\xEDan las ventanas`
      ]
    })
  }
];
function generateWorld(seeder) {
  const ws = seeder.branch("world");
  const names = {
    land: coin(ws),
    north: coin(ws),
    south: coin(ws),
    feature: coin(ws)
  };
  const kind = ws.nextChoice(CATACLYSMS);
  const shards = kind.shards(names);
  return {
    id: kind.id,
    name: names.land,
    nature: kind.nature(names),
    cataclysm: kind.cataclysm(names),
    beats: kind.beats(names),
    shards
  };
}

// src/engine/dreams.ts
function dreamChance(npc) {
  return 0.12 + (npc.stars - 1) * 0.06;
}
function surfaceDream(seeder, npc) {
  const pending = npc.lore.memories.filter((m) => !m.surfaced);
  if (!pending.length) return null;
  const ds = seeder.branch("dream:" + npc.id);
  if (ds.nextFloat() >= dreamChance(npc)) return null;
  const total = pending.reduce((sum, m) => sum + m.weight, 0);
  let roll = ds.nextFloat(0, total);
  let picked = pending[pending.length - 1];
  for (const m of pending) {
    roll -= m.weight;
    if (roll < 0) {
      picked = m;
      break;
    }
  }
  picked.surfaced = true;
  return picked;
}

// src/engine/nameGenerator.ts
var PHONEMES = {
  hispano: {
    pre: ["Al", "El", "Ca", "Mar", "Ra", "Sol", "Ven", "Bel", "Dar", "Gal", "Cor", "Ser", "Tan", "Lun", "Vel", "Bra", "Cas", "Fer", "Nor", "Sal", "Tor", "Mer"],
    root: ["an", "or", "en", "al", "ir", "os", "ar", "ur", "es", "iel", "ael", "and", "eri", "ond", "ial", "uel", "anz", "erm", "ost", "ind", "alv", "ern"],
    mid: ["a", "e", "i", "o", "ri", "li", "na", "se", "ta", "va", "ra", "le", "mi", "no", "da", "ne", "lo", "sa", "te", "vi", "ro", "ca"],
    suf: ["o", "a", "io", "ia", "on", "an", "in", "el", "ez", "ar", "os", "eo", "un", "il", "az", "or", "ano", "ina", "eno", "ius", "alo", "eria"]
  },
  nordico: {
    pre: ["Bjor", "Thor", "Sig", "Ulf", "Heid", "Gur", "Rag", "Var", "Frey", "Arn", "Eir", "Hak", "Sten", "Grim", "Hald", "Sval", "Orm", "Tyr", "Skar", "Volk", "Gunn", "Rurik"],
    root: ["nar", "vik", "ald", "ulf", "mund", "gar", "helm", "bor", "den", "fen", "rik", "stein", "grim", "vald", "skog", "thal", "norn", "gisl", "rond", "hild", "svein", "falk"],
    mid: ["a", "e", "i", "o", "u", "da", "ne", "la", "ri", "va", "sa", "to", "ke", "no", "ga", "me", "lo", "se", "ta", "vi", "do", "ru"],
    suf: ["son", "ir", "en", "ar", "ur", "ik", "on", "r", "n", "a", "dr", "ulf", "ald", "mir", "gar", "vid", "rok", "nir", "helm", "stad", "und", "borg"]
  },
  celta: {
    pre: ["Bran", "Cai", "Der", "Fio", "Gor", "Mor", "Nua", "Rhi", "Tal", "Eil", "Aed", "Bre", "Cael", "Dun", "Ferg", "Gwyn", "Lugh", "Niamh", "Oran", "Sael", "Teag", "Caw"],
    root: ["agh", "wyn", "eth", "ael", "dhu", "ran", "ban", "hir", "enn", "mor", "lyr", "wen", "tach", "gwel", "nith", "arod", "beth", "cael", "duin", "fael", "goch", "lain"],
    mid: ["a", "e", "i", "y", "o", "ai", "we", "ru", "na", "li", "dy", "ce", "ma", "ne", "lo", "ri", "sa", "te", "vi", "do", "el", "in"],
    suf: ["an", "yn", "on", "wen", "ith", "och", "ach", "ael", "in", "ion", "wyn", "dd", "ek", "rys", "agh", "ven", "lyn", "mor", "gan", "ed", "ys", "aith"]
  },
  eslavo: {
    pre: ["Dra", "Mir", "Bog", "Vla", "Svet", "Kaz", "Rad", "Zla", "Yar", "Gor", "Bor", "Lud", "Sta", "Tom", "Ves", "Woj", "Zor", "Bran", "Dmi", "Ksen", "Mst", "Rus"],
    root: ["imir", "odar", "oslav", "adin", "enka", "idar", "omir", "ivan", "usha", "olan", "eslav", "omil", "aros", "imko", "enko", "oryn", "astan", "evod", "islav", "omash", "uril", "azek"],
    mid: ["a", "e", "i", "o", "u", "ya", "ne", "ri", "lo", "va", "sa", "do", "ze", "na", "mi", "to", "le", "ro", "se", "vi", "da", "ko"],
    suf: ["ov", "ev", "a", "in", "ko", "mir", "ski", "ych", "nov", "uk", "enko", "slav", "omir", "ek", "ina", "oslav", "ich", "an", "ar", "el", "osh", "yna"]
  },
  greco: {
    pre: ["Alex", "Kali", "The", "Dem", "Nik", "Pho", "Kyr", "Ath", "Eos", "Kro", "Lys", "Mel", "Orph", "Pan", "Sel", "Tha", "Xen", "Zeph", "Arist", "Diog", "Hera", "Leon"],
    root: ["andr", "istr", "oph", "eter", "akis", "ipos", "enos", "aros", "iran", "okas", "andro", "ekle", "imen", "ophan", "ister", "agor", "edon", "ophil", "arch", "eides", "olaos", "ythen"],
    mid: ["a", "e", "i", "o", "io", "ia", "es", "os", "an", "el", "on", "er", "al", "is", "or", "en", "ar", "ne", "ro", "ti", "le", "me"],
    suf: ["os", "is", "as", "on", "ia", "e", "us", "ios", "eos", "anes", "ides", "andros", "ikos", "enes", "ator", "okles", "iton", "aios", "eus", "oros", "ipos", "ymos"]
  },
  africano: {
    pre: ["Ama", "Kwa", "Zub", "Osi", "Lek", "Tau", "Aya", "Ngo", "Eba", "Ima", "Bara", "Chid", "Dala", "Femi", "Jabu", "Kofi", "Mosi", "Nuru", "Obi", "Sade", "Thabo", "Zola"],
    root: ["inde", "ara", "ube", "ole", "abo", "ema", "uru", "ike", "enu", "olo", "andi", "eshe", "iola", "unde", "abeo", "imba", "okon", "esha", "ulum", "anke", "ireh", "oseh"],
    mid: ["a", "e", "i", "o", "u", "na", "we", "lo", "mi", "ba", "ya", "se", "ko", "ru", "da", "le", "ni", "to", "sa", "wo", "ma", "zu"],
    suf: ["we", "a", "i", "u", "e", "yo", "ba", "ko", "si", "tu", "la", "na", "di", "mba", "nde", "ola", "esi", "ayo", "umi", "eke", "oro", "isha"]
  },
  asiatico: {
    pre: ["Ren", "Yuki", "Hiro", "Min", "Tao", "Xia", "Jun", "Hana", "Ryu", "Mei", "Kai", "Lin", "Nao", "Qing", "Sora", "Wei", "Yi", "Zhen", "Akio", "Daiki", "Feng", "Haru"],
    root: ["saki", "zen", "taro", "fang", "nori", "yama", "haru", "kaze", "moto", "shiro", "jian", "kawa", "long", "mura", "sora", "tian", "waka", "xing", "yoshi", "zhao", "hoshi", "inu"],
    mid: ["a", "e", "i", "o", "u", "no", "ka", "mi", "ra", "shi", "ko", "na", "to", "ya", "ki", "ru", "sa", "chi", "ma", "wa", "zu", "ne"],
    suf: ["ko", "ka", "ki", "ro", "to", "na", "mi", "shi", "ra", "yu", "ji", "sho", "taro", "hito", "ren", "sei", "long", "feng", "lan", "wei", "ying", "hua"]
  }
};
var CULTURES = ["hispano", "nordico", "celta", "eslavo", "greco", "africano", "asiatico"];
function phoneticHardness(axes) {
  return (1 - axes.passivity) * 0.5 + (1 - axes.warmth) * 0.5;
}
function hardenName(name, hardness) {
  if (hardness < 0.55) return name;
  let result = name;
  result = result.replace(/v/gi, "k");
  result = result.replace(/l([aeiou])/gi, "r$1");
  result = result.replace(/[aeiou]{2}/gi, (m) => m[0]);
  return result;
}
function generateCulture(seeder) {
  return seeder.branch("culture").nextChoice(CULTURES);
}
function nameNamespaceSize() {
  const uniq = (a) => new Set(a).size;
  return CULTURES.reduce((total, c) => {
    const p = PHONEMES[c];
    return total + uniq(p.pre) * uniq(p.root) * uniq(p.mid) * uniq(p.suf);
  }, 0);
}
function generateName(seeder, culture, axes) {
  const ns = seeder.branch("name");
  const pool = PHONEMES[culture];
  const pre = ns.nextChoice(pool.pre);
  const root = ns.nextChoice(pool.root);
  const mid = ns.nextChoice(pool.mid);
  const suf = ns.nextChoice(pool.suf);
  const raw = pre + root + mid + suf;
  const name = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return hardenName(name, phoneticHardness(axes));
}

// src/engine/historyGenerator.ts
var STAR_CONTEXT = {
  1: ["Apenas sobrevivi\xF3 al viaje.", "No tiene clase ni nombre dentro de la torre.", "Nadie esperaba gran cosa de \xE9l."],
  2: ["Mostr\xF3 destellos de algo m\xE1s en su primer combate.", "Sobrevivi\xF3 cuando otros no lo hicieron.", "Lleg\xF3 sin reputaci\xF3n; a\xFAn no la tiene."],
  3: ["Su clase emergi\xF3 en alg\xFAn momento que ya es leyenda menor.", "Los m\xE1s viejos del roster lo notaron antes de que \xE9l mismo lo hiciera.", "Cruz\xF3 un umbral que pocos describen igual."],
  4: ["Hay cicatrices que los del pueblo conocen de memoria.", "Su nombre se pronuncia diferente dependiendo de a qui\xE9n le preguntes.", "Lleg\xF3 formado. Sigue form\xE1ndose."],
  5: ["Los bardos ya tienen canciones suyas aunque ninguna est\xE9 terminada.", "Su presencia cambia la temperatura de una sala.", "Leyenda que a\xFAn respira."]
};
function generateHistory(seeder, archetype, stars) {
  const hs = seeder.branch("history");
  const fragment = hs.nextChoice(archetype.fragments);
  const starLine = hs.nextChoice(STAR_CONTEXT[stars]);
  return `${fragment} ${starLine}`;
}
var TRADES = {
  honor: ["guardia de la muralla", "herrero", "juez de paz", "capit\xE1n de la ronda"],
  imprudente: ["minero", "marinero", "domador de bestias", "buscavidas"],
  calido: ["cocinero", "posadero", "partera", "panadero"],
  rencoroso: ["prestamista", "recaudador", "tasador", "cobrador de deudas"],
  erudito: ["escriba", "maestro de ni\xF1os", "cart\xF3grafo", "boticario"],
  difuso: ["jornalero", "le\xF1ador", "pastor", "mozo de cuadra"]
};
var PLACE_KIND = ["una aldea junto al r\xEDo", "un barrio de las afueras", "el puerto viejo", "las tierras altas", "un caser\xEDo de monta\xF1a", "el arrabal", "una granja a las afueras", "la villa baja"];
var PLACE_NAME = ["Almena", "Robledo", "Vado", "Sercal", "Oteros", "Marenca", "Hondura", "Cardal", "Espino", "Bruma"];
function generatePastLife(seeder, archetypeId) {
  const ps = seeder.branch("pastlife");
  const trades = TRADES[archetypeId] ?? TRADES.difuso;
  const trade = ps.nextChoice(trades);
  const place = `${ps.nextChoice(PLACE_KIND)} de ${ps.nextChoice(PLACE_NAME)}`;
  return { trade, place };
}
function pastLifeLine(pl) {
  return `Antes de todo esto era ${pl.trade}, de ${pl.place} \u2014 o eso es lo que a\xFAn recuerda.`;
}
function tierOf(stars) {
  return stars === 5 ? "core" : stars === 4 ? "secondary" : stars === 3 ? "peripheral" : "mundane";
}
var ROLE_BY_TIER = {
  core: () => "Estuvo en el coraz\xF3n mismo del fin de su mundo. Las manos a\xFAn recuerdan pelear aunque la cabeza lo haya enterrado.",
  secondary: () => "Fue figura secundaria de aquella ca\xEDda: la vio de cerca y sobrevivi\xF3 por poco. Algo de oficio le qued\xF3.",
  peripheral: () => "Apenas roz\xF3 la historia \u2014 intu\xEDa que algo iba muy mal, sin estar nunca dentro. De pelear sabe lo justo.",
  mundane: (pl) => `Era gente com\xFAn de aquel mundo, ${pl.trade} y nada m\xE1s. De batalla no sabe casi nada; est\xE1 aqu\xED casi por accidente.`
};
var TIER_AXES = {
  core: ["confidence", "optimism", "caution", "trust"],
  secondary: ["confidence", "caution", "loyalty", "optimism"],
  peripheral: ["curiosity", "caution", "optimism"],
  mundane: ["warmth", "curiosity", "sociability", "optimism"]
};
var TIER_WEIGHT = {
  core: [0.8, 1],
  secondary: [0.6, 0.8],
  peripheral: [0.4, 0.6],
  mundane: [0.2, 0.4]
};
var TIER_COUNT = { core: 3, secondary: 2, peripheral: 2, mundane: 2 };
var MUNDANE_SHARDS = [
  "las manos recordando el oficio de {trade}",
  "el olor de {place} al amanecer",
  "una jornada de {trade} igual a la anterior",
  "volver a {place} con el cuerpo cansado"
];
function pickDistinct(s, pool, n) {
  const copy = pool.slice();
  const out = [];
  for (let i = 0; i < n && copy.length; i++) out.push(copy.splice(s.nextInt(0, copy.length - 1), 1)[0]);
  return out;
}
function generateHeroLore(seeder, world, stars, pastLife) {
  const ls = seeder.branch("lore");
  const tier = tierOf(stars);
  const axes = TIER_AXES[tier];
  const [wlo, whi] = TIER_WEIGHT[tier];
  const texts = tier === "mundane" ? pickDistinct(ls, MUNDANE_SHARDS, TIER_COUNT[tier]).map((t) => t.replace("{trade}", pastLife.trade).replace("{place}", pastLife.place)) : pickDistinct(ls, world.shards[tier], TIER_COUNT[tier]);
  const memories = texts.map((text) => ({
    text,
    axis: ls.nextChoice(axes),
    weight: parseFloat(ls.nextFloat(wlo, whi).toFixed(3)),
    surfaced: false
  }));
  return { tier, role: ROLE_BY_TIER[tier](pastLife), memories };
}

// src/engine/npcGenerator.ts
function generateNPC(options) {
  const { seed } = options;
  const seeder = createSeeder(seed);
  const rosterFloor = options.rosterFloor ?? 0;
  const difficulty = options.difficulty ?? rollDifficulty(seeder);
  const stars = options.stars ?? rollStars(seeder, difficulty, rosterFloor);
  const culture = generateCulture(seeder);
  const worldSeed = options.worldSeed ?? seed;
  const world = options.world ?? generateWorld(createSeeder(worldSeed));
  const archetype = pickArchetype(seeder);
  const axes = generateAxes(seeder, archetype);
  const birthStamp = sealBirthStamp(axes, archetype);
  const pastLife = generatePastLife(seeder, archetype.id);
  const lore = generateHeroLore(seeder, world, stars, pastLife);
  const history = `${generateHistory(seeder, archetype, stars)} ${pastLifeLine(pastLife)}`;
  const observation = firstImpression(seeder, axes);
  const name = generateName(seeder, culture, axes);
  return {
    id: `npc-${seed}`,
    seed,
    name,
    culture,
    originArchetypeId: archetype.id,
    stars,
    difficulty,
    rosterFloorAtSummon: rosterFloor,
    worldSeed,
    axes,
    stamps: [birthStamp],
    history,
    observation,
    pastLife,
    lore,
    level: 1,
    floorReached: 0,
    isAlive: true,
    createdAt: 0
    // assigned by the persistence layer on first summon
  };
}
function regenerateNPC(seed, storedAxes, partial) {
  const seeder = createSeeder(seed);
  const rosterFloorAtSummon = partial.rosterFloorAtSummon ?? 0;
  const difficulty = partial.difficulty ?? rollDifficulty(seeder);
  const stars = rollStars(seeder, difficulty, rosterFloorAtSummon);
  const culture = generateCulture(seeder);
  const archetype = pickArchetype(seeder);
  const worldSeed = partial.worldSeed ?? seed;
  const world = generateWorld(createSeeder(worldSeed));
  const pastLife = generatePastLife(seeder, archetype.id);
  const lore = generateHeroLore(seeder, world, stars, pastLife);
  const history = `${generateHistory(seeder, archetype, stars)} ${pastLifeLine(pastLife)}`;
  const observation = firstImpression(seeder, storedAxes);
  const name = generateName(seeder, culture, storedAxes);
  return {
    id: `npc-${seed}`,
    seed,
    name,
    culture,
    originArchetypeId: archetype.id,
    stars,
    difficulty,
    rosterFloorAtSummon,
    worldSeed,
    axes: storedAxes,
    // Stored stamps accumulate over a life; default to just the birth stamp.
    stamps: partial.stamps ?? [sealBirthStamp(storedAxes, archetype)],
    history,
    observation,
    pastLife,
    lore,
    level: partial.level ?? 1,
    floorReached: partial.floorReached ?? 0,
    isAlive: partial.isAlive ?? true,
    createdAt: 0
  };
}

// src/engine/town.ts
function createTown(seed, rosterFloor = 0) {
  const seeder = createSeeder(seed);
  const difficulty = rollDifficulty(seeder);
  const world = generateWorld(seeder);
  return { id: seed, seed, difficulty, rosterFloor, world };
}
function summonInTown(town, index) {
  return generateNPC({
    seed: `${town.seed}:npc:${index}`,
    difficulty: town.difficulty,
    rosterFloor: town.rosterFloor,
    world: town.world,
    // todos los héroes del pueblo comparten el MISMO mundo
    worldSeed: town.seed
    // persistido en el NPC para reproducir el mundo en regen
  });
}

// src/engine/stats.ts
var HP_BASE = 40;
var HP_SPAN = 60;
var ATK_BASE = 12;
var ATK_SPAN = 28;
var DEF_BASE = 8;
var DEF_SPAN = 24;
var SPD_BASE = 10;
var SPD_SPAN = 20;
var STAR_STAT_SLOPE = 0.15;
var LEVEL_STAT_SLOPE = 0.08;
function blend(...pairs) {
  let acc = 0, wsum = 0;
  for (const [value, weight] of pairs) {
    acc += value * weight;
    wsum += weight;
  }
  return wsum === 0 ? 0.5 : acc / wsum;
}
function starStatFactor(stars) {
  return 1 + (stars - 1) * STAR_STAT_SLOPE;
}
function levelStatFactor(level) {
  return 1 + Math.max(0, level - 1) * LEVEL_STAT_SLOPE;
}
function deriveStats(npc) {
  const a = npc.axes;
  const starF = starStatFactor(npc.stars);
  const lvlF = levelStatFactor(npc.level);
  const hpMix = blend([a.confidence, 1], [a.caution, 0.7]);
  const atkMix = blend([1 - a.passivity, 1], [a.confidence, 0.6]);
  const defMix = blend([a.caution, 1], [a.discipline, 0.8]);
  const spdMix = blend([1 - a.caution, 1], [a.curiosity, 0.5]);
  const maxHp = Math.round((HP_BASE + HP_SPAN * hpMix) * starF * lvlF);
  const atk = Math.round((ATK_BASE + ATK_SPAN * atkMix) * starF * lvlF);
  const def = Math.round((DEF_BASE + DEF_SPAN * defMix) * starF * lvlF);
  const spd = Math.round((SPD_BASE + SPD_SPAN * spdMix) * starF);
  return { maxHp, hp: maxHp, atk, def, spd };
}
function fullHeal(stats) {
  return { ...stats, hp: stats.maxHp };
}

// src/engine/skills.ts
var AXIS_SKILLS = [
  {
    id: "intimidar",
    name: "Intimidar",
    kind: "offensive",
    power: 0.55,
    observation: "Se planta de frente y obliga a la amenaza a fijarse en \xE9l.",
    when: (a) => a.confidence > 0.75
  },
  {
    id: "proteger",
    name: "Proteger",
    kind: "defensive",
    power: 0.6,
    observation: "Se interpone para que el golpe lo reciba \xE9l y no su aliado.",
    when: (a) => a.altruism > 0.7
  },
  {
    id: "explorar",
    name: "Explorar",
    kind: "support",
    power: 0.4,
    observation: "Lee el terreno antes que nadie y se\xF1ala lo que otros no ven.",
    when: (a) => a.curiosity > 0.7
  },
  {
    id: "tecnica-perfecta",
    name: "T\xE9cnica perfecta",
    kind: "passive",
    power: 0.5,
    observation: "Cada movimiento repite al anterior, sin un gesto de m\xE1s.",
    when: (a) => a.discipline > 0.75
  },
  {
    id: "galvanizar",
    name: "Galvanizar",
    kind: "support",
    power: 0.5,
    observation: "Su sola presencia levanta el \xE1nimo de quienes pelean a su lado.",
    when: (a) => a.warmth > 0.75
  },
  {
    id: "escudo-lealtad",
    name: "Escudo de lealtad",
    kind: "defensive",
    power: 0.65,
    observation: "Se vuelve inquebrantable cuando cubre a alguien de los suyos.",
    when: (a) => a.loyalty > 0.75
  },
  {
    id: "rencor-acumulado",
    name: "Rencor acumulado",
    kind: "offensive",
    power: 0.7,
    observation: "Golpea m\xE1s fuerte a quien ya lo hiri\xF3 antes; no olvida una herida.",
    when: (a) => a.forgiveness < 0.25
  }
];
var STAMP_MASTERIES = {
  discipline: {
    id: "maestria-tecnica",
    name: "Maestr\xEDa: t\xE9cnica sellada",
    kind: "passive",
    power: 0.65,
    observation: "Hay una calma de oficio en c\xF3mo se mueve, ganada y ya imborrable."
  },
  confidence: {
    id: "maestria-aplomo",
    name: "Maestr\xEDa: aplomo sellado",
    kind: "offensive",
    power: 0.7,
    observation: "Ya no duda al avanzar; lo aprendi\xF3 a golpes y se le qued\xF3."
  },
  altruism: {
    id: "maestria-guardian",
    name: "Maestr\xEDa: guardi\xE1n sellado",
    kind: "defensive",
    power: 0.75,
    observation: "Cubrir a otro le sale antes que pensar; es parte de qui\xE9n es ahora."
  },
  curiosity: {
    id: "maestria-rastreador",
    name: "Maestr\xEDa: rastreador sellado",
    kind: "support",
    power: 0.6,
    observation: "Nada del entorno se le escapa; ese ojo ya no se apaga."
  }
};
var HIGH_BANDS = [0.75, 1];
function deriveSkills(npc) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const def of AXIS_SKILLS) {
    if (def.when(npc.axes)) {
      out.push({ id: def.id, name: def.name, kind: def.kind, observation: def.observation, power: def.power, source: "axis" });
      seen.add(def.id);
    }
  }
  for (const stamp of npc.stamps) {
    if (stamp.kind !== "growth") continue;
    if (!HIGH_BANDS.includes(stamp.bandValue)) continue;
    const m = STAMP_MASTERIES[stamp.axisKey];
    if (m && !seen.has(m.id)) {
      out.push({ id: m.id, name: m.name, kind: m.kind, observation: m.observation, power: m.power, source: "stamp" });
      seen.add(m.id);
    }
  }
  return out;
}
function bestOffensive(skills) {
  return skills.filter((s) => s.kind === "offensive").reduce((best, s) => !best || s.power > best.power ? s : best, null);
}
function bestDefensive(skills) {
  return skills.filter((s) => s.kind === "defensive").reduce((best, s) => !best || s.power > best.power ? s : best, null);
}

// src/engine/equipment.ts
var TYPE_SLOT = {
  "weapon-heavy": "mainHand",
  "weapon-light": "mainHand",
  "staff": "mainHand",
  "shield": "offHand",
  "trinket": "trinket"
};
var ARCHETYPE_AFFINITY = {
  honor: ["weapon-heavy", "shield"],
  imprudente: ["weapon-light"],
  calido: ["trinket", "staff"],
  rencoroso: ["weapon-heavy", "weapon-light"],
  erudito: ["staff", "trinket"],
  difuso: ["weapon-heavy", "weapon-light", "staff", "shield", "trinket"]
};
var ALL_TYPES = ["weapon-heavy", "weapon-light", "staff", "shield", "trinket"];
var TYPE_NAMES = {
  "weapon-heavy": ["Mandoble", "Hacha de guerra", "Maza pesada"],
  "weapon-light": ["Daga", "Estoque", "Par de cuchillas"],
  "staff": ["Bast\xF3n r\xFAnico", "Cayado tallado", "Vara de sa\xFAco"],
  "shield": ["Escudo torre", "Broquel", "\xC9gida abollada"],
  "trinket": ["Amuleto gastado", "Anillo deslustrado", "Talism\xE1n de hueso"]
};
var QUALITY_WORD = ["", "tosco", "s\xF3lido", "fino", "magistral", "legendario"];
function maxQualityForStars(stars) {
  return Math.max(1, Math.min(5, stars));
}
function unlockedSlots(level) {
  const slots = ["mainHand"];
  if (level >= 5) slots.push("offHand");
  if (level >= 10) slots.push("trinket");
  return slots;
}
function affinityFor(archetypeId) {
  return ARCHETYPE_AFFINITY[archetypeId] ?? ALL_TYPES;
}
function equippableBy(item, npc) {
  return item.quality <= maxQualityForStars(npc.stars) && unlockedSlots(npc.level).includes(item.slot);
}
function statModsFor(type, quality) {
  const q = quality;
  switch (type) {
    case "weapon-heavy":
      return { atk: 4 * q, spd: -q };
    case "weapon-light":
      return { atk: 2 * q, spd: 2 * q };
    case "staff":
      return { atk: 3 * q, maxHp: 2 * q };
    case "shield":
      return { def: 4 * q, spd: -q };
    case "trinket":
      return { maxHp: 5 * q, def: q };
  }
}
function generateEquipment(townSeed, floor, difficulty) {
  const s = createSeeder(`town:${townSeed}:floor:${floor}:loot`);
  const type = s.branch("type").nextChoice(ALL_TYPES);
  const diffNorm = Math.max(0, Math.min(1, (difficulty - 1) / 999));
  const base = 1 + floor / 12 + diffNorm * 2;
  const jitter = s.branch("q").nextInt(-1, 1);
  const quality = Math.max(1, Math.min(5, Math.round(base) + jitter));
  const name = s.branch("name").nextChoice(TYPE_NAMES[type]);
  const observation = `${name} ${QUALITY_WORD[quality]}.`;
  return {
    id: `eq-${townSeed}-${floor}-${type}-${quality}`,
    name,
    type,
    slot: TYPE_SLOT[type],
    quality,
    mods: statModsFor(type, quality),
    observation
  };
}
function applyLoadout(base, npc, items) {
  const out = { ...base };
  const usedSlots = /* @__PURE__ */ new Set();
  for (const item of items) {
    if (!equippableBy(item, npc)) continue;
    if (usedSlots.has(item.slot)) continue;
    usedSlots.add(item.slot);
    out.maxHp += item.mods.maxHp ?? 0;
    out.atk += item.mods.atk ?? 0;
    out.def += item.mods.def ?? 0;
    out.spd += item.mods.spd ?? 0;
  }
  out.maxHp = Math.max(1, out.maxHp);
  out.atk = Math.max(0, out.atk);
  out.def = Math.max(0, out.def);
  out.spd = Math.max(1, out.spd);
  out.hp = out.maxHp;
  return out;
}

// src/engine/monsters.ts
var PREFIX = ["Acechador", "Devorador", "Centinela", "Carro\xF1ero", "Heraldo", "Resto", "Aullido", "Sombra"];
var OF = ["del Foso", "de Ceniza", "sin Nombre", "de la Grieta", "Hueco", "de Sal", "del Umbral", "Marchito"];
var TRAITS = [
  { id: "feroz", observation: "Carga sin medir el riesgo, todo dientes y avance." },
  { id: "acorazado", observation: "Avanza despacio, como si nada pudiera atravesarlo." },
  { id: "veloz", observation: "Se mueve a tirones, demasiado r\xE1pido para seguirlo." },
  { id: "tenaz", observation: "No cae cuando deber\xEDa; se levanta una vez m\xE1s." }
];
function scaledStats(s, difficulty, floor, rosterFloor, trait) {
  const diffNorm = Math.max(0, Math.min(1, (difficulty - 1) / 999));
  const power = 1 + diffNorm * 1.5 + floor * 0.12 + Math.floor(rosterFloor / 10) * 0.05;
  const roll = (min, max) => s.branch("hp").nextFloat(min, max);
  let maxHp = Math.round((30 + roll(0, 30)) * power);
  let atk = Math.round((8 + s.branch("atk").nextFloat(0, 8)) * power);
  let def = Math.round((4 + s.branch("def").nextFloat(0, 6)) * power);
  let spd = Math.round((9 + s.branch("spd").nextFloat(0, 10)) * power);
  if (trait === "feroz") {
    atk = Math.round(atk * 1.35);
    def = Math.round(def * 0.8);
  }
  if (trait === "acorazado") {
    def = Math.round(def * 1.6);
    spd = Math.round(spd * 0.7);
  }
  if (trait === "veloz") {
    spd = Math.round(spd * 1.5);
    maxHp = Math.round(maxHp * 0.8);
  }
  if (trait === "tenaz") {
    maxHp = Math.round(maxHp * 1.4);
    atk = Math.round(atk * 0.9);
  }
  return { maxHp: Math.max(1, maxHp), hp: Math.max(1, maxHp), atk: Math.max(1, atk), def: Math.max(0, def), spd: Math.max(1, spd) };
}
function monsterCountForFloor(floor) {
  return Math.min(5, 1 + Math.floor(floor / 4));
}
function generateFloorMonsters(town, floor) {
  const root = createSeeder(`town:${town.seed}:floor:${floor}:monsters`);
  const count = monsterCountForFloor(floor);
  const monsters = [];
  for (let i = 0; i < count; i++) {
    const s = root.branch(String(i));
    const trait = s.branch("trait").nextChoice(TRAITS);
    const name = `${s.branch("p").nextChoice(PREFIX)} ${s.branch("o").nextChoice(OF)}`;
    monsters.push({
      id: `mon-${town.seed}-${floor}-${i}`,
      name,
      stats: scaledStats(s, town.difficulty, floor, town.rosterFloor, trait.id),
      trait: trait.id,
      observation: trait.observation
    });
  }
  return monsters;
}

// src/engine/combat.ts
var MAX_ROUNDS = 60;
function clone(c) {
  return { ...c, stats: { ...c.stats }, hp: c.stats.hp, guarding: false };
}
function damage(s, atk, def, skillMul, defenderGuarding) {
  const effDef = defenderGuarding ? def * 2 : def;
  const jitter = 0.9 + s.nextFloat() * 0.2;
  return Math.max(1, Math.round((atk * skillMul - effDef * 0.6) * jitter));
}
function chooseNpcAction(f) {
  const a = f.axes;
  const lowHp = f.hp < f.stats.maxHp * 0.3;
  const off = bestOffensive(f.skills);
  const def = bestDefensive(f.skills);
  if (lowHp && a.caution > 0.55) return { kind: "guard" };
  if (!lowHp && a.passivity > 0.7 && a.confidence < 0.45) return { kind: "guard" };
  if (lowHp && def && (a.loyalty > 0.7 || a.altruism > 0.7)) return { kind: "guard" };
  const useSkill = off && (a.confidence > 0.6 || a.forgiveness < 0.25);
  return { kind: "attack", skill: useSkill ? off : null };
}
function chooseMonsterAction(f) {
  if (f.trait === "acorazado" && f.hp < f.stats.maxHp * 0.4) return { kind: "guard" };
  return { kind: "attack", skill: null };
}
function pickTarget(attacker, foes) {
  const alive = foes.filter((f) => f.hp > 0);
  if (alive.length === 0) return null;
  if (attacker.isNpc) {
    const a = attacker.axes;
    if (a.discipline > 0.6) return alive.reduce((w, f) => f.hp < w.hp ? f : w);
    if (a.passivity < 0.4) return alive.reduce((w, f) => f.stats.atk > w.stats.atk ? f : w);
    return alive[0];
  }
  return alive.reduce((w, f) => f.hp < w.hp ? f : w);
}
function resolveCombat(seed, party, monsters) {
  const root = createSeeder(`combat:${seed}`);
  const npcs = party.map(clone);
  const mobs = monsters.map(clone);
  const narration = [];
  const fallenNpcIds = [];
  const order = [...npcs, ...mobs].sort((x, y) => {
    if (y.stats.spd !== x.stats.spd) return y.stats.spd - x.stats.spd;
    return root.branch("tie").branch(x.id + y.id).next() < 0.5 ? -1 : 1;
  });
  const npcStart = npcs.length;
  let round2 = 0;
  const alive = (arr) => arr.some((f) => f.hp > 0);
  while (alive(npcs) && alive(mobs) && round2 < MAX_ROUNDS) {
    round2++;
    const rs = root.branch("round").branch(String(round2));
    for (const actor of order) {
      if (actor.hp <= 0) continue;
      if (!alive(npcs) || !alive(mobs)) break;
      actor.guarding = false;
      const foes = actor.isNpc ? mobs : npcs;
      const action = actor.isNpc ? chooseNpcAction(actor) : chooseMonsterAction(actor);
      if (action.kind === "guard") {
        actor.guarding = true;
        continue;
      }
      const target = pickTarget(actor, foes);
      if (!target) continue;
      const skillMul = action.skill ? 1 + action.skill.power : 1;
      const dmg = damage(rs.branch(actor.id), actor.stats.atk, target.stats.def, skillMul, target.guarding);
      target.hp = Math.max(0, target.hp - dmg);
      if (target.hp === 0 && !target.isNpc) {
        narration.push(`${target.name} se desploma y no vuelve a moverse.`);
      }
      if (target.hp === 0 && target.isNpc) {
        fallenNpcIds.push(target.id);
        narration.push(`${target.name} cae. Esta vez no se levanta.`);
      }
    }
  }
  const npcsAlive = alive(npcs);
  const outcome = npcsAlive ? "victory" : "defeat";
  if (outcome === "victory") {
    const standing = npcs.filter((f) => f.hp > 0).map((f) => f.name);
    narration.unshift(`El piso queda en silencio. Vuelven ${listNames(standing)}.`);
  } else {
    narration.unshift("El piso se los traga a todos. No vuelve nadie.");
  }
  const intensity = Math.min(1, 0.4 + round2 / MAX_ROUNDS);
  const npcEvents = {};
  const survivorHp = {};
  for (const f of npcs) {
    const fell = f.hp <= 0;
    npcEvents[f.id] = {
      kind: "combat",
      intensity,
      outcome: fell ? "failure" : outcome === "victory" ? "success" : "partial"
    };
    if (!fell) survivorHp[f.id] = f.hp;
  }
  return { outcome, rounds: round2, narration, fallenNpcIds, npcEvents, survivorHp };
}
function listNames(names) {
  if (names.length === 0) return "nadie";
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(", ") + " y " + names[names.length - 1];
}

// src/engine/progression.ts
function levelUp(npc) {
  return { ...npc, level: npc.level + 1 };
}
function levelCap(floorReached) {
  return floorReached + 1;
}
function applyFloorCleared(npc, floor) {
  const floorReached = Math.max(npc.floorReached, floor);
  let next = { ...npc, floorReached };
  if (next.level < levelCap(floorReached)) {
    next = levelUp(next);
  }
  return next;
}

// src/engine/expedition.ts
function toCombatant(npc, loadout) {
  const base = fullHeal(deriveStats(npc));
  const stats = applyLoadout(base, npc, loadout);
  return {
    id: npc.id,
    name: npc.name,
    stats,
    skills: deriveSkills(npc),
    isNpc: true,
    axes: npc.axes
  };
}
function runExpedition(town, floor, party, loadouts = {}) {
  const living = party.filter((n) => n.isAlive);
  const npcCombatants = living.map((n) => toCombatant(n, loadouts[n.id] ?? []));
  const monsterCombatants = generateFloorMonsters(town, floor).map((m) => ({
    id: m.id,
    name: m.name,
    stats: m.stats,
    skills: [],
    isNpc: false,
    trait: m.trait
  }));
  const result = resolveCombat(`${town.seed}:f${floor}`, npcCombatants, monsterCombatants);
  const fallen = new Set(result.fallenNpcIds);
  const updated = party.map((npc) => {
    if (!npc.isAlive) return npc;
    if (fallen.has(npc.id)) return { ...npc, isAlive: false };
    const ev = result.npcEvents[npc.id];
    const es = createSeeder(`expedition:${town.seed}:f${floor}:${npc.id}`);
    const { axes, newStamps } = applyExperience(es, npc.axes, npc.stamps, ev, npc.stars);
    let evolved = { ...npc, axes, stamps: [...npc.stamps, ...newStamps] };
    if (result.outcome === "victory") {
      evolved = applyFloorCleared(evolved, floor);
    }
    return evolved;
  });
  const drops = result.outcome === "victory" ? [generateEquipment(town.seed, floor, town.difficulty)] : [];
  return { floor, result, party: updated, drops };
}

// src/runtime/liveWorld.ts
function createLiveWorld(seed, poolSize = 8, initialRoster = 0) {
  const town = createTown(seed);
  const heroes = [];
  for (let i = 0; i < poolSize; i++) {
    const npc = summonInTown(town, i + 1);
    heroes.push({
      npc,
      bornAxes: { ...npc.axes },
      needs: createNeeds(createSeeder("needs:" + npc.id), npc.axes),
      inRoster: i < initialRoster,
      alive: true
    });
  }
  return { town, heroes, tick: 0 };
}
function applyConversation(world, ai, bi, seederKey) {
  const A = world.heroes[ai], B = world.heroes[bi];
  if (!A || !B || !A.alive || !B.alive) return null;
  const ex = rollConversation(
    createSeeder(seederKey),
    { id: A.npc.id, axes: A.npc.axes },
    { id: B.npc.id, axes: B.npc.axes },
    { proximity: 0.9, cooldownRemaining: 0 }
  );
  if (!ex) return null;
  const ra = applyConversationNudges(A.npc.axes, A.npc.stamps, ex.nudges.a);
  const rb = applyConversationNudges(B.npc.axes, B.npc.stamps, ex.nudges.b);
  A.npc.axes = ra.axes;
  if (ra.newStamps.length) A.npc.stamps = [...A.npc.stamps, ...ra.newStamps];
  B.npc.axes = rb.axes;
  if (rb.newStamps.length) B.npc.stamps = [...B.npc.stamps, ...rb.newStamps];
  return ex.topic;
}
function tickHeroNeeds(h, activity, n = 1) {
  if (!h.alive) return;
  h.needs = tickNeeds(h.needs, h.npc.axes, activity, n);
}
function tryDream(h, seederKey) {
  const m = surfaceDream(createSeeder(seederKey), h.npc);
  return m ? m.text : null;
}
function simulateOffline(world, ticks) {
  for (let t = 0; t < ticks; t++) {
    world.tick++;
    const s = createSeeder(world.town.seed + ":off:" + world.tick);
    const roster = world.heroes.filter((h) => h.inRoster && h.alive);
    if (roster.length >= 2) {
      const i = s.nextInt(0, roster.length - 1);
      let j = s.nextInt(0, roster.length - 1);
      if (j === i) j = (j + 1) % roster.length;
      applyConversation(
        world,
        world.heroes.indexOf(roster[i]),
        world.heroes.indexOf(roster[j]),
        world.town.seed + ":offc:" + world.tick
      );
    }
    for (const h of roster) tickHeroNeeds(h, "idle", 1);
  }
}

// src/save/saveState.ts
var SAVE_VERSION = 1;
function serializeSave(world, lastSeen = Date.now()) {
  return {
    v: SAVE_VERSION,
    townSeed: world.town.seed,
    difficulty: world.town.difficulty,
    rosterFloor: world.town.rosterFloor,
    tick: world.tick,
    lastSeen,
    heroes: world.heroes.map((h) => ({
      seed: h.npc.seed,
      axes: h.npc.axes,
      stamps: h.npc.stamps,
      needs: h.needs,
      surfaced: h.npc.lore.memories.map((m, i) => m.surfaced ? i : -1).filter((i) => i >= 0),
      bornAxes: h.bornAxes,
      inRoster: h.inRoster,
      alive: h.alive
    })),
    expedition: world.expedition ? { partyIds: world.expedition.partyIds, floor: world.expedition.floor, returnAt: world.expedition.returnAt } : void 0
  };
}
function restoreSave(save) {
  const town = createTown(save.townSeed, save.rosterFloor);
  const heroes = save.heroes.map((sh) => {
    const npc = regenerateNPC(sh.seed, sh.axes, {
      stamps: sh.stamps,
      difficulty: save.difficulty,
      rosterFloorAtSummon: save.rosterFloor,
      worldSeed: save.townSeed
    });
    sh.surfaced.forEach((i) => {
      if (npc.lore.memories[i]) npc.lore.memories[i].surfaced = true;
    });
    return { npc, bornAxes: sh.bornAxes, needs: sh.needs, inRoster: sh.inRoster, alive: sh.alive };
  });
  return { town, heroes, tick: save.tick, expedition: save.expedition };
}
export {
  ARCHETYPES,
  AXIS_KEYS,
  BANDS,
  CONVERSATION_COOLDOWN,
  DEV_MODE,
  SAVE_VERSION,
  affinityFor,
  applyConversation,
  applyConversationNudges,
  applyExperience,
  applyFloorCleared,
  applyLoadout,
  bandOf,
  bestDefensive,
  bestOffensive,
  briefRoster,
  conversationAffinity,
  conversationChance,
  createLiveWorld,
  createNeeds,
  createSeeder,
  createTown,
  criticalNeed,
  deriveSkills,
  deriveStats,
  describeNPC,
  dreamChance,
  equippableBy,
  explainRule,
  firstImpression,
  fullHeal,
  generateAxes,
  generateCulture,
  generateEquipment,
  generateFloorMonsters,
  generateHeroLore,
  generateHistory,
  generateNPC,
  generateName,
  generatePastLife,
  generateWorld,
  inspectNPC,
  levelCap,
  levelStatFactor,
  levelUp,
  maxQualityForStars,
  monsterCountForFloor,
  nameNamespaceSize,
  nearestBand,
  needsStatus,
  pastLifeLine,
  pickArchetype,
  rareWhisper,
  readBehavior,
  readEmergentTraits,
  regenerateNPC,
  relay,
  reportActivity,
  resolveCombat,
  restoreSave,
  revealExchange,
  rollConversation,
  rollDifficulty,
  rollStars,
  runExpedition,
  sealBirthStamp,
  sealIfBandCrossed,
  serializeSave,
  setDevMode,
  simulateOffline,
  softCeiling,
  starProbabilities,
  starProgressionMultiplier,
  starStatFactor,
  summonInTown,
  surfaceDream,
  tickHeroNeeds,
  tickNeeds,
  tryDream,
  unlockedSlots
};
