import { WorldStory } from './types';
import { Seeder } from './seeder';

/**
 * EL MUNDO PERDIDO — una historia única por SEMILLA (no por NPC).
 *
 * Cada semilla de pueblo engendra un mundo entero con su propia caída: el
 * misterio central del juego es **cómo terminó** ese mundo. Los héroes provienen
 * de él; al ser traídos al pueblo lo OLVIDAN (de ahí el misterio), y solo algunos
 * sueños devuelven fragmentos (ver dreams.ts). La Torre, más adelante, revelará la
 * "verdad" (los `beats`) piso a piso.
 *
 * PURO + determinista: todo sale de `seeder.branch('world')`, así que la misma
 * semilla produce SIEMPRE el mismo mundo, y dos pueblos con la misma semilla
 * comparten exactamente la misma catástrofe. El texto aquí es CANON del mundo
 * (identidad), no la cháchara de los NPC (esa vive en la capa de preview).
 *
 * Las estrellas de un héroe deciden a qué profundidad de esta historia estuvo:
 * 5★ en el núcleo, 4★ secundarios, 3★ en la periferia, 1-2★ ajenos (fillers).
 * Por eso `shards` separa los recuerdos por profundidad (core/secondary/peripheral);
 * los fillers recuerdan su vida civil, no la catástrofe (se arma en historyGenerator).
 */

// Nombres propios del mundo perdido (evocadores, no atados a ninguna cultura real).
const NAME_PRE  = ['Vael', 'Orn', 'Sel', 'Thar', 'Mire', 'Cael', 'Dun', 'Ys', 'Brae', 'Lethe', 'Var', 'Ner', 'Sund', 'Aeg', 'Corv', 'Hal'];
const NAME_SUF  = ['oria', 'mar', 'heim', 'wyn', 'dor', 'eth', 'gard', 'is', 'une', 'arr', 'ovia', 'ane', 'orne', 'ys', 'aith', 'oss'];
function coin(s: Seeder): string {
  const raw = s.nextChoice(NAME_PRE) + s.nextChoice(NAME_SUF);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

interface WorldNames { land: string; north: string; south: string; feature: string; }

interface CataclysmKind {
  id: string;
  nature: (n: WorldNames) => string;     // qué clase de mundo era
  cataclysm: (n: WorldNames) => string;  // cómo terminó (el misterio, una frase)
  beats: (n: WorldNames) => string[];    // la "verdad" ordenada (omen → fin)
  // Fragmentos IMPRESIONISTAS por profundidad (lo que un héroe podría recordar).
  shards: (n: WorldNames) => { core: string[]; secondary: string[]; peripheral: string[] };
}

const CATACLYSMS: CataclysmKind[] = [
  {
    id: 'grieta',
    nature: (n) => `${n.land} fue un mundo de ciudades altas y ferias largas, hasta que el cielo sobre ${n.feature} se rajó.`,
    cataclysm: (n) => `De la grieta abierta sobre ${n.feature} salió algo que no tenía nombre, y se lo comió todo.`,
    beats: (n) => [
      `Primero fueron las luces extrañas sobre ${n.feature}; nadie quiso leer el augurio.`,
      `La grieta se abrió una noche sin luna y de ella bajó el frío.`,
      `${n.north} cayó en tres días; los que huyeron hablaban de sombras con demasiados brazos.`,
      `${n.south} cerró sus puertas y aun así entraron, como si la piedra no existiera.`,
      `Al final no quedó quien encendiera las farolas de ${n.land}.`,
    ],
    shards: (n) => ({
      core: [
        `una grieta en el cielo que respiraba`,
        `el momento exacto en que ${n.feature} dejó de existir`,
        `haber gritado una orden que nadie llegó a obedecer`,
      ],
      secondary: [
        `correr por las murallas de ${n.north} con algo detrás`,
        `el olor a quemado que venía de ${n.feature}`,
        `una puerta que cerraste sabiendo que no bastaría`,
      ],
      peripheral: [
        `rumores de luces raras sobre ${n.feature}`,
        `gente de ${n.north} que llegó sin equipaje y sin hablar`,
        `un frío que entró de golpe una noche de mercado`,
      ],
    }),
  },
  {
    id: 'guerra',
    nature: (n) => `${n.land} era dos coronas vecinas, ${n.north} y ${n.south}, que llevaban un siglo midiéndose sin tocarse.`,
    cataclysm: (n) => `La guerra entre ${n.north} y ${n.south} no dejó vencedor: solo ceniza donde estuvo ${n.land}.`,
    beats: (n) => [
      `Un heraldo de ${n.north} murió cruzando ${n.feature}; nadie supo de qué lado vino la flecha.`,
      `Las dos coronas llamaron a sus hijos a las armas el mismo invierno.`,
      `${n.feature} ardió tantas veces que dejó de tener nombre.`,
      `Cuando se acabaron los soldados, ${n.south} mandó a los labradores.`,
      `No hubo tratado: solo dejó de haber a quién matar en ${n.land}.`,
    ],
    shards: (n) => ({
      core: [
        `firmar algo con la mano temblando`,
        `la cara de quien te juró lealtad antes de ${n.feature}`,
        `una orden de avanzar que sabías que era el final`,
      ],
      secondary: [
        `marchar de noche hacia ${n.feature}`,
        `repartir pan que ya no alcanzaba en ${n.south}`,
        `un estandarte cayendo en el barro`,
      ],
      peripheral: [
        `levas que se llevaban a los muchachos de ${n.north}`,
        `el precio del grano subiendo cada semana`,
        `tambores lejos, siempre del lado de ${n.feature}`,
      ],
    }),
  },
  {
    id: 'ruina',
    nature: (n) => `${n.land} prosperó sobre las ruinas de ${n.feature}, sin preguntarse quién las había dejado vacías.`,
    cataclysm: (n) => `Algo dormía bajo ${n.feature}, y ${n.land} cavó demasiado hondo.`,
    beats: (n) => [
      `Los mineros de ${n.feature} encontraron una puerta que no abría hacia ningún lado.`,
      `Quien la tocó empezó a soñar lo mismo todas las noches.`,
      `${n.north} mandó eruditos; ninguno volvió a explicarse del todo.`,
      `La cosa bajo ${n.feature} no atacó: solo hizo que todo se pudriera al revés.`,
      `${n.land} se vació sin una sola batalla, como una casa que se deja.`,
    ],
    shards: (n) => ({
      core: [
        `una puerta de piedra que no abría a ninguna parte`,
        `el mismo sueño repetido bajo ${n.feature}`,
        `haber escrito algo que después no pudiste leer`,
      ],
      secondary: [
        `bajar a ${n.feature} con una lámpara que no iluminaba`,
        `compañeros que dejaron de reconocerte`,
        `un eco que respondía antes de que hablaras`,
      ],
      peripheral: [
        `historias de mineros que no volvían de ${n.feature}`,
        `la comida que se echaba a perder demasiado rápido`,
        `gente de ${n.north} mirando al suelo al pasar`,
      ],
    }),
  },
  {
    id: 'olvido',
    nature: (n) => `${n.land} era un mundo de archivos y memoria larga; cada familia guardaba su nombre desde el principio.`,
    cataclysm: (n) => `Una plaga del olvido cruzó ${n.land}: primero los nombres, después las caras, al final el camino a casa.`,
    beats: (n) => [
      `En ${n.south} empezaron a olvidar palabras pequeñas, y le restaron importancia.`,
      `Luego nadie recordaba el camino entre ${n.north} y ${n.feature}.`,
      `Los archivos de ${n.land} amanecieron en blanco, sin que nadie los tocara.`,
      `Madres que no reconocían a sus hijos; hijos que no preguntaban por qué.`,
      `El último en olvidar apagó la luz sin saber ya para qué servía.`,
    ],
    shards: (n) => ({
      core: [
        `un nombre en la punta de la lengua que nunca llega`,
        `mirar un archivo en blanco que tú habías llenado`,
        `haber sido el último en recordar algo importante`,
      ],
      secondary: [
        `repetir una palabra para no perderla, y perderla igual`,
        `caras de ${n.south} que se volvían lisas`,
        `escribir tu propio nombre en la mano`,
      ],
      peripheral: [
        `vecinos de ${n.north} que se perdían de camino a casa`,
        `cartas que llegaban sin remitente y sin sentido`,
        `un mercado donde nadie sabía ya los precios`,
      ],
    }),
  },
  {
    id: 'marea',
    nature: (n) => `${n.land} vivía del mar: ${n.north} y ${n.south} eran puertos gemelos unidos por el muelle de ${n.feature}.`,
    cataclysm: (n) => `El mar subió y no volvió a bajar; ${n.land} está bajo el agua desde entonces.`,
    beats: (n) => [
      `Las mareas de ${n.feature} empezaron a llegar más alto cada luna.`,
      `${n.south} levantó diques; el agua entró por debajo igual.`,
      `Una noche el muelle de ${n.feature} amaneció a brazadas de profundidad.`,
      `${n.north} mandó barcos a buscar tierra seca; ninguno encontró orilla.`,
      `${n.land} terminó siendo un techo de olas sobre las casas.`,
    ],
    shards: (n) => ({
      core: [
        `el agua entrando por debajo de la puerta sin prisa`,
        `el muelle de ${n.feature} desapareciendo en una noche`,
        `haber decidido a quién subía al último bote`,
      ],
      secondary: [
        `achicar agua sabiendo que no servía`,
        `el sabor a sal en todo, hasta en el pan`,
        `barcos que salían de ${n.north} y no volvían`,
      ],
      peripheral: [
        `mareas cada vez más altas en ${n.feature}`,
        `pescadores que dejaron de salir`,
        `el ruido del mar acercándose por las noches`,
      ],
    }),
  },
  {
    id: 'sol-muerto',
    nature: (n) => `${n.land} medía el tiempo por su sol pálido; en ${n.feature} levantaban relojes para todo el reino.`,
    cataclysm: (n) => `El sol de ${n.land} se fue apagando, y con él el calor, las cosechas y al final las ganas.`,
    beats: (n) => [
      `Los relojeros de ${n.feature} notaron que los días venían más cortos.`,
      `${n.north} quemó sus bosques para no congelarse el primer invierno largo.`,
      `Las cosechas de ${n.south} no salieron; la tierra se quedó dura.`,
      `La gente empezó a dormir de más, como si el frío diera sueño.`,
      `Nadie vio el último amanecer de ${n.land}; ya casi nadie miraba.`,
    ],
    shards: (n) => ({
      core: [
        `un sol que cada día daba menos`,
        `haber racionado el último calor de ${n.feature}`,
        `decidir qué se quemaba para pasar la noche`,
      ],
      secondary: [
        `cosechas que salían negras en ${n.south}`,
        `dormir de más sin poder evitarlo`,
        `cerrar casas vacías una a una`,
      ],
      peripheral: [
        `días que se acortaban en ${n.feature}`,
        `el precio de la leña que no paraba de subir`,
        `vecinos de ${n.north} que ya no abrían las ventanas`,
      ],
    }),
  },
];

/**
 * Genera el mundo de una semilla. Determinista: misma semilla → mismo mundo.
 * Recibe el seeder del pueblo y ramifica 'world' por su cuenta, de modo que
 * añadir esta corriente no perturba las tiradas de dificultad/estrellas/NPC.
 */
export function generateWorld(seeder: Seeder): WorldStory {
  const ws = seeder.branch('world');
  const names: WorldNames = {
    land: coin(ws), north: coin(ws), south: coin(ws), feature: coin(ws),
  };
  const kind = ws.nextChoice(CATACLYSMS);
  const shards = kind.shards(names);
  return {
    id: kind.id,
    name: names.land,
    nature: kind.nature(names),
    cataclysm: kind.cataclysm(names),
    beats: kind.beats(names),
    shards,
  };
}
