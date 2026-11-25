// Hand-placed world layout: landmarks, platforms, food and opponent spawns.
import { OppSpecies, Tier, ZoneId } from './config';
import { terrainHeight, PITS } from './terrain';
import { JUNGLE_FEATURES } from './config';

export type FoodType =
  | 'berries' | 'carrot' | 'apple' | 'seeds' | 'mushroom' | 'melon' | 'fig' | 'cranberries'
  | 'honeycomb' | 'truffle' | 'starfruit' | 'goldenMango' | 'goldenApple' | 'lotus' | 'goldenMushroom'
  | 'fish' | 'krill' | 'goldenFish'
  | 'egg' | 'banana' | 'coconut' | 'pineapple'
  | 'drumstick' | 'sandwich' | 'cheese' | 'hotdog' | 'roastChicken' | 'applePie' | 'cake'
  | 'fishSoup' | 'veggieStew' | 'berryJam' | 'heartyStew' | 'goldenFeast';

export const FOOD_NAMES: Record<FoodType, string> = {
  berries: 'Berries', carrot: 'Carrot', apple: 'Apple', seeds: 'Seeds', mushroom: 'Mushroom',
  melon: 'Melon', fig: 'Fig', cranberries: 'Cranberries',
  fish: 'Fish', krill: 'Krill', goldenFish: 'Golden Fish',
  egg: 'Fresh Egg', banana: 'Banana', coconut: 'Coconut', pineapple: 'Pineapple', drumstick: 'Chicken Drumstick', sandwich: 'Sandwich', cheese: 'Cheese', hotdog: 'Hot Dog',
  roastChicken: 'Roast Chicken', applePie: 'Apple Pie', cake: 'Birthday Cake',
  fishSoup: 'Fish Soup', veggieStew: 'Veggie Stew', berryJam: 'Berry Jam', heartyStew: 'Hearty Stew', goldenFeast: 'Golden Feast',
  honeycomb: 'Golden Honeycomb', truffle: 'Forest Truffle', starfruit: 'Star Fruit',
  goldenMango: 'Golden Mango', goldenApple: 'Golden Apple', lotus: 'Lotus Fruit', goldenMushroom: 'Glow Mushroom',
};

export interface FoodSpawn { x: number; z: number; type: FoodType; rare: boolean; note?: 'hidden' | 'risky'; tutorial?: boolean }
export interface OppSpawn { species: OppSpecies; tier: Tier; x: number; z: number; name: string; zone: ZoneId; wander?: number; scale?: number; training?: boolean; hunter?: boolean }
export interface Platform { x: number; z: number; r: number; top: number; bottom: number; look: 'mossy' | 'red' | 'swamp' | 'grey' | 'ice' }

const R = (t: FoodType) => ['honeycomb', 'truffle', 'starfruit', 'goldenMango', 'goldenApple', 'lotus', 'goldenMushroom', 'goldenFish', 'roastChicken', 'applePie', 'cake'].includes(t);
function f(x: number, z: number, type: FoodType, note?: 'hidden' | 'risky', tutorial = false): FoodSpawn {
  return { x, z, type, rare: R(type), note, tutorial };
}

export const TUTORIAL_RING = { x: 0, z: 12 };

export const FOOD_SPAWNS: FoodSpawn[] = [
  // Forest — common
  f(4, 17, 'berries', undefined, true),
  f(-14, 22, 'carrot'), f(24, 6, 'apple'), f(-40, -18, 'berries'), f(30, -44, 'seeds'),
  f(-6, 44, 'berries'), f(52, -8, 'carrot'), f(12, -50, 'apple'), f(22, -22, 'mushroom'), f(-22, -34, 'carrot'),
  // Forest — rare
  f(41.5, 42.5, 'honeycomb', 'risky'),   // top of the Mossy Rock Stack, wolf nearby
  f(-50, 45, 'truffle', 'hidden'),       // inside the hidden clearing
  // Savanna — common
  f(84, 12, 'seeds'), f(100, -12, 'fig'), f(112, 22, 'melon'), f(134, -2, 'seeds'),
  f(96, -38, 'fig'), f(142, 44, 'melon'), f(176, -50, 'seeds'), f(170, 5, 'fig'),
  // Savanna — rare
  f(173, 39, 'starfruit', 'risky'),      // top of Pride Rock in lion territory
  f(156, -28.5, 'goldenMango', 'risky'), // mesa in the middle of the canyon
  f(119, -37.8, 'goldenApple', 'hidden'),// tucked behind the Great Baobab
  // Swamp — common
  f(-84, -8, 'cranberries'), f(-98, 12, 'mushroom'), f(-122, -8, 'cranberries'), f(-138, 48, 'mushroom'),
  f(-118, 50, 'berries'), f(-176, 2, 'cranberries'), f(-150, -48, 'mushroom'),
  // Swamp — rare
  f(-158.5, 30, 'lotus', 'risky'),       // island in the Sinking Bog
  f(-183.5, -34, 'goldenMushroom', 'hidden'), // behind the Hollow Stump in the reeds
  f(-131, -34, 'goldenApple'),           // end of the old boardwalk
  // Forest & savanna — a few extra spots
  f(40, 15, 'apple'), f(-36, 54, 'mushroom'), f(150, 32, 'melon'), f(-165, -30, 'cranberries'),
  // Antarctica — common
  f(8, 285, 'fish'), f(-15, 305, 'krill'), f(30, 310, 'fish'), f(-55, 320, 'krill'),
  f(55, 300, 'fish'), f(0, 360, 'krill'), f(-20, 372, 'fish'),
  // Antarctica — rare
  f(-40.5, 292, 'goldenFish', 'risky'),  // biggest iceberg in the Iceberg Hop
  f(48, 362, 'goldenFish', 'hidden'),    // inside the Ice Hollow
  // Human Village — the humans' food (sneak in and steal it!)
  f(-6, 95, 'drumstick'), f(6, 98, 'sandwich'), f(16, 101, 'hotdog'), f(22, 126, 'cheese'),
  f(-40, 100, 'drumstick', 'hidden'),    // dropped picnic in the corn field
  f(40, 97, 'cheese', 'hidden'),         // in the east corn field
  f(0, 106, 'roastChicken', 'risky'),    // on the big picnic table, right by the cook
  f(-22, 121, 'applePie', 'risky'),      // cooling on a crate by the farmhouse
  f(-8, 145.4, 'cake', 'risky'),         // on the bakery stall counter
];

/** Treasure maps: find one to reveal that area's food on your map. */
export const MAP_SPOTS: { zone: ZoneId; x: number; z: number }[] = [
  { zone: 'forest', x: -56, z: -52 },
  { zone: 'savanna', x: 184, z: -42 },
  { zone: 'swamp', x: -186, z: 10 },
  { zone: 'antarctica', x: -62, z: 372 },
  { zone: 'village', x: 48, z: 150 },
  { zone: 'jungle', x: -62, z: 744 },
];

export const OPP_SPAWNS: OppSpawn[] = [
  // Forest (weaker near the clearing)
  { species: 'badger', tier: 'weak', x: 8, z: 27, name: 'Young Badger', zone: 'forest', wander: 3, scale: 0.9, training: true },
  { species: 'fox', tier: 'weak', x: -32, z: 30, name: 'Wild Fox', zone: 'forest' },
  { species: 'badger', tier: 'weak', x: 38, z: -28, name: 'Badger', zone: 'forest' },
  { species: 'boar', tier: 'medium', x: -42, z: -42, name: 'Wild Boar', zone: 'forest' },
  { species: 'wolf', tier: 'strong', x: 50, z: 48, name: 'Grey Wolf', zone: 'forest', wander: 4 },
  { species: 'fox', tier: 'weak', x: 20, z: 42, name: 'Red Fox', zone: 'forest' },
  { species: 'badger', tier: 'weak', x: -15, z: -52, name: 'Badger', zone: 'forest' },
  { species: 'boar', tier: 'medium', x: 50, z: 22, name: 'Wild Boar', zone: 'forest' },
  { species: 'wolf', tier: 'strong', x: -46, z: 14, name: 'Timber Wolf', zone: 'forest', wander: 4 },
  { species: 'bear', tier: 'strong', x: -53, z: -26, name: 'Brown Bear', zone: 'forest', wander: 4 },
  // Savanna
  { species: 'warthog', tier: 'weak', x: 90, z: 25, name: 'Warthog', zone: 'savanna' },
  { species: 'warthog', tier: 'weak', x: 104, z: -26, name: 'Warthog', zone: 'savanna' },
  { species: 'hyena', tier: 'medium', x: 128, z: 12, name: 'Hyena', zone: 'savanna' },
  { species: 'hyena', tier: 'medium', x: 145, z: -52, name: 'Hyena', zone: 'savanna', wander: 4 },
  { species: 'lion', tier: 'strong', x: 181, z: 20, name: 'Lioness', zone: 'savanna', scale: 0.9 },
  { species: 'lion', tier: 'strong', x: 184, z: 50, name: 'Lion', zone: 'savanna', wander: 4 },
  { species: 'warthog', tier: 'weak', x: 115, z: 45, name: 'Warthog', zone: 'savanna' },
  { species: 'hyena', tier: 'medium', x: 166, z: -4, name: 'Hyena', zone: 'savanna' },
  { species: 'hyena', tier: 'medium', x: 110, z: 52, name: 'Hyena', zone: 'savanna', wander: 4 },
  { species: 'lion', tier: 'strong', x: 136, z: -46, name: 'Lion', zone: 'savanna', wander: 4 },
  // Swamp
  { species: 'otter', tier: 'weak', x: -90, z: 24, name: 'River Otter', zone: 'swamp' },
  { species: 'otter', tier: 'weak', x: -102, z: -48, name: 'River Otter', zone: 'swamp' },
  { species: 'boar', tier: 'medium', x: -128, z: 8, name: 'Swamp Boar', zone: 'swamp' },
  { species: 'crocodile', tier: 'strong', x: -145, z: -16, name: 'Crocodile', zone: 'swamp' },
  { species: 'crocodile', tier: 'strong', x: -176, z: 48, name: 'Crocodile', zone: 'swamp', wander: 4 },
  { species: 'otter', tier: 'weak', x: -116, z: 22, name: 'River Otter', zone: 'swamp' },
  { species: 'boar', tier: 'medium', x: -166, z: -6, name: 'Swamp Boar', zone: 'swamp' },
  { species: 'crocodile', tier: 'strong', x: -122, z: -19, name: 'Crocodile', zone: 'swamp', wander: 4 },
  // Antarctica
  { species: 'seal', tier: 'weak', x: 15, z: 300, name: 'Weddell Seal', zone: 'antarctica' },
  { species: 'seal', tier: 'weak', x: -5, z: 350, name: 'Weddell Seal', zone: 'antarctica' },
  { species: 'seal', tier: 'weak', x: -55, z: 352, name: 'Fur Seal', zone: 'antarctica' },
  { species: 'elephantSeal', tier: 'medium', x: 56, z: 335, name: 'Elephant Seal', zone: 'antarctica' },
  { species: 'elephantSeal', tier: 'medium', x: 25, z: 372, name: 'Elephant Seal', zone: 'antarctica', wander: 4 },
  { species: 'leopardSeal', tier: 'strong', x: -58, z: 272, name: 'Leopard Seal', zone: 'antarctica', wander: 4 },
  { species: 'leopardSeal', tier: 'strong', x: 60, z: 268, name: 'Leopard Seal', zone: 'antarctica', wander: 4 },
];

// ---- The bigger world: extra food and animals spread through the new parts of each area -----------
/** Where rescued friends build their houses: dotted all over the forest (not right next to your home). */
export const FRIEND_SPOTS: { x: number; z: number }[] = [
  { x: 28, z: -34 }, { x: -34, z: -70 }, { x: 40, z: -88 }, { x: -12, z: -96 }, { x: 18, z: -128 },
  { x: -48, z: -118 }, { x: 52, z: -58 }, { x: -24, z: -132 }, { x: 46, z: -114 }, { x: -50, z: -88 },
];
{
  let seed = 1234567;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const clear = (x: number, z: number) => FRIEND_SPOTS.every((p) => Math.hypot(p.x - x, p.z - z) > 10)
    && FOOD_SPAWNS.every((p) => Math.hypot(p.x - x, p.z - z) > 5) && OPP_SPAWNS.every((p) => Math.hypot(p.x - x, p.z - z) > 9);
  const area = (zone: ZoneId, x0: number, x1: number, z0: number, z1: number, foods: FoodType[], rares: FoodType[], nFood: number,
    opps: [OppSpawn['species'], OppSpawn['tier'], string][], nOpp: number) => {
    for (let i = 0, tries = 0; i < nFood && tries < 500; tries++) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
      if (!clear(x, z)) continue;
      FOOD_SPAWNS.push(f(Math.round(x), Math.round(z), i % 6 === 5 ? pick(rares) : pick(foods), i % 6 === 5 ? 'hidden' : undefined)); i++;
    }
    for (let i = 0, tries = 0; i < nOpp && tries < 500; tries++) {
      const x = x0 + 4 + rnd() * (x1 - x0 - 8), z = z0 + 4 + rnd() * (z1 - z0 - 8);
      if (!clear(x, z)) continue;
      const [species, tier, name] = opps[i % opps.length];
      OPP_SPAWNS.push({ species, tier, x: Math.round(x), z: Math.round(z), name, zone, wander: rnd() < 0.4 ? 4 : undefined }); i++;
    }
  };
  // the deep south forest
  area('forest', -58, 58, -138, -68, ['berries', 'carrot', 'apple', 'seeds', 'mushroom'], ['honeycomb', 'truffle', 'goldenApple'], 18,
    [['badger', 'weak', 'Badger'], ['fox', 'weak', 'Wild Fox'], ['boar', 'medium', 'Wild Boar'], ['badger', 'weak', 'Young Badger'], ['wolf', 'strong', 'Grey Wolf'], ['fox', 'weak', 'Red Fox'], ['bear', 'strong', 'Brown Bear'], ['boar', 'medium', 'Wild Boar']], 12);
  // the savanna stretches further east and south
  area('savanna', 72, 228, -138, -66, ['melon', 'fig', 'seeds'], ['starfruit', 'goldenMango'], 14,
    [['warthog', 'weak', 'Warthog'], ['hyena', 'medium', 'Hyena'], ['warthog', 'weak', 'Warthog'], ['lion', 'strong', 'Lion']], 9);
  area('savanna', 198, 228, -60, 58, ['melon', 'fig'], ['starfruit'], 5, [['warthog', 'weak', 'Warthog'], ['hyena', 'medium', 'Hyena']], 3);
  // the swamp stretches further west and south
  area('swamp', -228, -72, -138, -66, ['cranberries', 'mushroom'], ['lotus', 'goldenMushroom'], 14,
    [['otter', 'weak', 'River Otter'], ['boar', 'medium', 'Swamp Boar'], ['otter', 'weak', 'River Otter'], ['crocodile', 'strong', 'Crocodile']], 9);
  area('swamp', -228, -198, -60, 58, ['cranberries', 'mushroom'], ['lotus'], 5, [['otter', 'weak', 'River Otter'], ['boar', 'medium', 'Swamp Boar']], 3);
  // and more animals everywhere in the older parts too (none too close to your home clearing or the Fish Lagoon)
  const homeOK = (x0: number, z0: number) => Math.hypot(x0 - 0, z0 + 9) > 28 && Math.hypot(x0 - 55, z0 - 315) > 16;
  const more = (zone: ZoneId, x0: number, x1: number, z0: number, z1: number, opps: [OppSpawn['species'], OppSpawn['tier'], string][], n: number) => {
    for (let i = 0, tries = 0; i < n && tries < 600; tries++) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
      if (!clear(x, z) || !homeOK(x, z)) continue;
      if (zone === 'antarctica' && terrainHeight(x, z) < 0.3) continue;   // not in the icy water
      const [species, tier, name] = opps[i % opps.length];
      OPP_SPAWNS.push({ species, tier, x: Math.round(x), z: Math.round(z), name, zone, wander: rnd() < 0.5 ? 4 : undefined }); i++;
    }
  };
  more('forest', -58, 58, -62, 55, [['fox', 'weak', 'Red Fox'], ['badger', 'weak', 'Badger'], ['boar', 'medium', 'Wild Boar'], ['fox', 'weak', 'Wild Fox'], ['wolf', 'strong', 'Grey Wolf']], 10);
  more('savanna', 74, 190, -58, 58, [['warthog', 'weak', 'Warthog'], ['hyena', 'medium', 'Hyena'], ['warthog', 'weak', 'Warthog'], ['lion', 'strong', 'Lioness']], 10);
  more('swamp', -190, -74, -58, 58, [['otter', 'weak', 'River Otter'], ['boar', 'medium', 'Swamp Boar'], ['otter', 'weak', 'River Otter'], ['crocodile', 'strong', 'Crocodile']], 10);
  // animals just like you live in the wild too!
  more('forest', -58, 58, -140, 55, [['bunny', 'weak', 'Wild Bunny'], ['bunny', 'weak', 'Wild Bunny'], ['cat', 'weak', 'Wild Cat'], ['dog', 'medium', 'Stray Dog'], ['panda', 'medium', 'Panda'], ['chicken', 'weak', 'Wild Chicken']], 14);
  more('savanna', 74, 228, -140, 58, [['horse', 'medium', 'Wild Horse'], ['tiger', 'strong', 'Tiger'], ['horse', 'medium', 'Wild Horse']], 7);
  more('swamp', -228, -74, -140, 58, [['otter', 'weak', 'River Otter'], ['bunny', 'weak', 'Marsh Bunny']], 5);
  more('antarctica', -62, 62, 268, 372, [['penguin', 'weak', 'Wild Penguin']], 5);
  // Jungle Island: monkeys everywhere, tigers, jungle boars, pandas in the bamboo, crocodiles by the pool
  const JF = JUNGLE_FEATURES;
  const jungleOK = (x: number, z: number) => terrainHeight(x, z) > 0.45 && Math.hypot(x - JF.pool.x, z - JF.pool.z) > JF.pool.r + 3 && Math.hypot(x - JF.plateau.x, z - JF.plateau.z) > JF.plateau.r + 2
    && JF.treetops.every((t) => Math.hypot(x - t.x, z - t.z) > 6) && Math.hypot(x - JF.entry.x, z - JF.entry.z) > 10;
  for (let i = 0, tries = 0; i < 22 && tries < 800; tries++) {
    const x = -72 + rnd() * 144, z = 606 + rnd() * 146;
    if (!jungleOK(x, z) || !clear(x, z)) continue;
    const beach = z < 632;
    const type: FoodType = i % 7 === 6 ? pick(['goldenMango', 'starfruit'] as FoodType[]) : beach ? 'coconut' : pick(['banana', 'banana', 'pineapple', 'mushroom'] as FoodType[]);
    FOOD_SPAWNS.push(f(Math.round(x), Math.round(z), type, i % 7 === 6 ? 'hidden' : undefined)); i++;
  }
  for (let i = 0, tries = 0; i < 22 && tries < 800; tries++) {
    const x = -70 + rnd() * 140, z = 640 + rnd() * 112;
    if (!jungleOK(x, z) || !clear(x, z)) continue;
    const opts: [OppSpawn['species'], OppSpawn['tier'], string][] = [['monkey', 'weak', 'Cheeky Monkey'], ['monkey', 'weak', 'Monkey'], ['monkey', 'weak', 'Baby Monkey'], ['boar', 'medium', 'Jungle Boar'], ['monkey', 'weak', 'Monkey'], ['tiger', 'strong', 'Tiger'], ['panda', 'medium', 'Panda'], ['monkey', 'medium', 'Big Monkey']];
    const [species, tier, name] = opts[i % opts.length];
    OPP_SPAWNS.push({ species, tier, x: Math.round(x), z: Math.round(z), name, zone: 'jungle', wander: rnd() < 0.5 ? 4 : undefined, scale: name === 'Baby Monkey' ? 0.75 : name === 'Big Monkey' ? 1.3 : undefined }); i++;
  }
  for (const [x, z] of [[JF.pool.x - JF.pool.r - 3, JF.pool.z - 3], [JF.pool.x + JF.pool.r + 3, JF.pool.z - 5]]) OPP_SPAWNS.push({ species: 'crocodile', tier: 'strong', x, z, name: 'River Crocodile', zone: 'jungle' });
  // a golden treat waiting up on the treetop walkway
  FOOD_SPAWNS.push(f(JF.treetops[2].x + 1.2, JF.treetops[2].z, 'goldenMango', 'risky'));
  more('antarctica', -62, 62, 268, 372, [['seal', 'weak', 'Weddell Seal'], ['elephantSeal', 'medium', 'Elephant Seal'], ['seal', 'weak', 'Fur Seal']], 6);
}

// ---- platforms (walkable rock tops) ---------------------------------------------
function rim(p: { x: number; z: number; r: number }) {
  let h = -Infinity;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) h = Math.max(h, terrainHeight(p.x + Math.cos(a) * (p.r + 1.5), p.z + Math.sin(a) * (p.r + 1.5)));
  return h;
}
const forestStackBase = terrainHeight(36, 36);
const prideBase = Math.max(terrainHeight(165, 32), terrainHeight(172, 38));
const savPit = PITS[0], swampPit = PITS[1];
const savRim = rim(savPit) + 0.3;
const swampRim = Math.max(rim(swampPit), 0) + 0.35;

export const PLATFORMS: Platform[] = [
  // Mossy Rock Stack (forest)
  { x: 33.5, z: 33, r: 1.5, top: forestStackBase + 1.1, bottom: forestStackBase - 2, look: 'mossy' },
  { x: 36, z: 36.5, r: 1.3, top: forestStackBase + 2.2, bottom: forestStackBase - 2, look: 'mossy' },
  { x: 38.5, z: 39.5, r: 1.3, top: forestStackBase + 3.3, bottom: forestStackBase - 2, look: 'mossy' },
  { x: 41.5, z: 42.5, r: 2.0, top: forestStackBase + 4.3, bottom: forestStackBase - 2, look: 'mossy' },
  // Pride Rock raised path (savanna)
  { x: 161, z: 30, r: 1.4, top: prideBase + 1.1, bottom: prideBase - 3, look: 'red' },
  { x: 163.5, z: 33, r: 1.3, top: prideBase + 2.2, bottom: prideBase - 3, look: 'red' },
  { x: 165, z: 36.4, r: 1.3, top: prideBase + 3.3, bottom: prideBase - 3, look: 'red' },
  { x: 172, z: 38, r: 5.0, top: prideBase + 4.4, bottom: prideBase - 3, look: 'red' },
  // Canyon pillars (savanna pit)
  { x: 147, z: -28, r: 1.2, top: savRim, bottom: -30, look: 'red' },
  { x: 151.5, z: -26, r: 1.1, top: savRim, bottom: -30, look: 'red' },
  { x: 156, z: -28.5, r: 2.2, top: savRim, bottom: -30, look: 'red' },
  // Sinking Bog stepping stones (swamp pit)
  { x: -150.5, z: 29, r: 1.1, top: swampRim, bottom: -30, look: 'swamp' },
  { x: -154.5, z: 31, r: 1.1, top: swampRim, bottom: -30, look: 'swamp' },
  { x: -158.5, z: 30, r: 2.2, top: swampRim, bottom: -30, look: 'swamp' },
  // Iceberg Hop (Antarctica)
  { x: -32.5, z: 291, r: 1.3, top: 1.15, bottom: -30, look: 'ice' },
  { x: -36.5, z: 293, r: 1.2, top: 1.15, bottom: -30, look: 'ice' },
  { x: -40.5, z: 292, r: 2.3, top: 1.15, bottom: -30, look: 'ice' },
];

export const BOARDWALK = { minX: -132.5, maxX: -91, minZ: -35.3, maxZ: -32.7, top: 0.6 };

export interface Landmark { name: string; x: number; z: number; signX: number; signZ: number; zone: ZoneId }
export const LANDMARKS: Landmark[] = [
  { name: 'Home Clearing', x: 0, z: 0, signX: 6, signZ: -4, zone: 'forest' },
  { name: 'Giant Old Oak', x: -28, z: 8, signX: -23, signZ: 11, zone: 'forest' },
  { name: 'Mossy Rock Stack', x: 40, z: 40, signX: 29, signZ: 29, zone: 'forest' },
  { name: 'Fallen Log', x: -22, z: -34, signX: -22, signZ: -29, zone: 'forest' },
  { name: 'Mushroom Ring', x: 22, z: -22, signX: 18, signZ: -16, zone: 'forest' },
  { name: 'Pride Rock', x: 172, z: 38, signX: 156, signZ: 26, zone: 'savanna' },
  { name: 'Great Baobab', x: 118, z: -34, signX: 113, signZ: -28, zone: 'savanna' },
  { name: 'Canyon Pit', x: 155, z: -28, signX: 140, signZ: -20, zone: 'savanna' },
  { name: 'Sunken Dead Tree', x: -108, z: 32, signX: -102, signZ: 27, zone: 'swamp' },
  { name: 'Old Boardwalk', x: -110, z: -34, signX: -88, signZ: -30, zone: 'swamp' },
  { name: 'Sinking Bog', x: -158, z: 30, signX: -145, signZ: 23, zone: 'swamp' },
  { name: 'Hollow Stump', x: -180, z: -30, signX: -173, signZ: -24, zone: 'swamp' },
  { name: 'Human Village', x: 0, z: 80, signX: 4, signZ: 82, zone: 'village' },
  { name: 'Picnic Meadow', x: 0, z: 100, signX: -12, signZ: 88, zone: 'village' },
  { name: 'Farmhouse', x: -28, z: 128, signX: -14, signZ: 116, zone: 'village' },
  { name: 'Red Barn', x: 28, z: 135, signX: 15, signZ: 120, zone: 'village' },
  { name: 'Bakery Stall', x: -8, z: 147, signX: 4, signZ: 141, zone: 'village' },
  { name: 'Antarctica Landing', x: 0, z: 262, signX: 6, signZ: 268, zone: 'antarctica' },
  { name: 'Research Station', x: 35, z: 282, signX: 27, signZ: 277, zone: 'antarctica' },
  { name: 'Iceberg Hop', x: -40, z: 292, signX: -26, signZ: 283, zone: 'antarctica' },
  { name: 'Penguin Colony', x: -30, z: 340, signX: -19, signZ: 332, zone: 'antarctica' },
  { name: 'Ice Arch', x: 20, z: 340, signX: 13, signZ: 332, zone: 'antarctica' },
];

export const SPECIAL_TREES = {
  oak: { x: -28, z: 8 },
  baobab: { x: 118, z: -34 },
  deadTree: { x: -108, z: 32 },
  stump: { x: -180, z: -30 },
};
export const HIDDEN_CLEARING = { x: -50, z: 45, r: 6.5, gapAngle: -Math.PI / 4 };
export const MUSHROOM_RING = { x: 22, z: -22, r: 3.2 };
export const FALLEN_LOG = { x0: -28, x1: -16, z: -34 };
export const TERMITES = [{ x: 98, z: 42 }, { x: 132, z: 52 }, { x: 88, z: -48 }, { x: 140, z: 15 }];

/** Walking paths from the clearing to each gate (z offset as a function of x). */
export function pathZ(x: number): number {
  const E = 65;
  if (Math.abs(x) <= E) return Math.sin((x / E) * Math.PI) * 7;
  const s = Math.sign(x), d = Math.abs(x) - E;
  return Math.sin(d * 0.045) * 9 * s * (d < 100 ? 1 : 1);
}

// ---- Human Village -------------------------------------------------------------
export type HumanKind = 'farmer' | 'cook' | 'baker';
export interface HumanSpawn { name: string; kind: HumanKind; route: [number, number][] }
export const HUMAN_SPAWNS: HumanSpawn[] = [
  { name: 'Farmer Joe', kind: 'farmer', route: [[-38, 117], [-16, 117], [-16, 139], [-38, 139]] },
  { name: 'Cook Rosa', kind: 'cook', route: [[-11, 91], [13, 91], [21, 109], [-9, 111]] },
  { name: 'Baker Sam', kind: 'baker', route: [[-17, 140], [3, 140], [3, 152], [-17, 152]] },
  { name: 'Farmer Lee', kind: 'farmer', route: [[15, 123], [41, 123], [41, 147], [15, 147]] },
];
/** Tall corn: humans can't see you in here unless they're right next to you. */
export const CORN_FIELDS = [
  { minX: -52, maxX: -30, minZ: 88, maxZ: 112 },
  { minX: 30, maxX: 52, minZ: 86, maxZ: 110 },
];
export function inCorn(x: number, z: number): boolean {
  return CORN_FIELDS.some((f) => x > f.minX && x < f.maxX && z > f.minZ && z < f.maxZ);
}
export const PICNIC_TABLES = [{ x: -6, z: 95 }, { x: 6, z: 98 }, { x: 0, z: 106 }];
export const FARMHOUSE = { x: -28, z: 128 };
export const BARN = { x: 28, z: 135 };
export const BAKERY = { x: -8, z: 147 };
export const GRILL = { x: 16, z: 104 };
export const WELL = { x: 8, z: 125 };

// ---- Cooking ---------------------------------------------------------------------
export const DISHES: FoodType[] = ['fishSoup', 'veggieStew', 'berryJam', 'heartyStew', 'goldenFeast'];
const SEA: FoodType[] = ['fish', 'krill', 'goldenFish'];
const BERRY: FoodType[] = ['berries', 'cranberries'];
const VEG: FoodType[] = ['carrot', 'mushroom', 'seeds', 'melon', 'apple', 'fig', 'truffle', 'goldenMushroom'];
export const RECIPES = [
  { dish: 'goldenFeast' as FoodType, hint: 'Any golden or rare food + 2 more' },
  { dish: 'fishSoup' as FoodType, hint: '2 or more fish or krill' },
  { dish: 'berryJam' as FoodType, hint: '2 or more berries' },
  { dish: 'veggieStew' as FoodType, hint: '2 or more veggies, fruit or mushrooms' },
  { dish: 'heartyStew' as FoodType, hint: 'Anything else' },
];
/** Work out which dish 3 ingredients make. */
export function cookResult(items: FoodType[]): FoodType {
  const count = (list: FoodType[]) => items.filter((t) => list.includes(t)).length;
  if (items.length >= 3 && items.some((t) => R(t))) return 'goldenFeast';
  if (count(SEA) >= 2) return 'fishSoup';
  if (count(BERRY) >= 2) return 'berryJam';
  if (count(VEG) >= 2) return 'veggieStew';
  return 'heartyStew';
}

/** Human houses you can go inside (the Farmhouse plus five cottages). Doors face south. */
export type HouseStyle = 'farmhouse' | 'thatch' | 'tower' | 'aframe' | 'windmill' | 'modern';
export type HouseTheme = 'farm' | 'kitchen' | 'bakery' | 'cabin' | 'garden' | 'fun';
export interface HumanHome {
  name: string; owner: string; x: number; z: number; w: number; d: number; color: number; roof: number; tier: number; farmhouse?: boolean;
  style: HouseStyle; theme: HouseTheme;
  inside: { wall: number; floor: number; rug: number; sofa: number };
}
export const HUMAN_HOMES: HumanHome[] = [
  { name: "Joe's Farmhouse", owner: 'Farmer Joe', x: -28, z: 128, w: 10, d: 8, color: 0xe8e0cc, roof: 0x8a3a2a, tier: 3, farmhouse: true, style: 'farmhouse', theme: 'farm',
    inside: { wall: 0xf3e6c4, floor: 0x7a5232, rug: 0x5a7a3a, sofa: 0x8a3a2a } },
  { name: "Rosa's Cottage", owner: 'Cook Rosa', x: 16, z: 84, w: 7, d: 6, color: 0xb8b0a2, roof: 0xd8b85a, tier: 1, style: 'thatch', theme: 'kitchen',
    inside: { wall: 0xfff1d8, floor: 0xc8a070, rug: 0xe8742a, sofa: 0xd8452e } },
  { name: "Sam's House", owner: 'Baker Sam', x: -18, z: 82, w: 6, d: 5, color: 0x9fbfd8, roof: 0x3d4a6a, tier: 2, style: 'tower', theme: 'bakery',
    inside: { wall: 0xfde8f0, floor: 0xe0c8a0, rug: 0xf4a6c0, sofa: 0xf2c14e } },
  { name: "Lee's Cabin", owner: 'Farmer Lee', x: 52, z: 128, w: 7, d: 7, color: 0x6a4a30, roof: 0x5a3a24, tier: 1, style: 'aframe', theme: 'cabin',
    inside: { wall: 0xc89a6a, floor: 0x5a3a24, rug: 0x9a2a2a, sofa: 0x3d5a3a } },
  { name: "Pat's Windmill", owner: 'Pat', x: -52, z: 132, w: 6, d: 6, color: 0xf2ece0, roof: 0x7a3a5a, tier: 2, style: 'windmill', theme: 'garden',
    inside: { wall: 0xe2f2d6, floor: 0xa8b890, rug: 0x6ab04a, sofa: 0xb56be0 } },
  { name: "Max's House", owner: 'Max', x: -10, z: 130, w: 8, d: 6, color: 0xf8f8f6, roof: 0x30343a, tier: 1, style: 'modern', theme: 'fun',
    inside: { wall: 0xe6eef8, floor: 0xd8dde4, rug: 0x3b8fd9, sofa: 0xf4b532 } },
];
