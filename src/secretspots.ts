// Where the 25 secret places are: 5 in each area. Each has a locked door and a secret map hidden nearby.
import { ZoneId, JUNGLE_FEATURES } from './config';
import { FOOD_SPAWNS, OPP_SPAWNS, MAP_SPOTS, FRIEND_SPOTS, LANDMARKS, PLATFORMS, pathZ } from './layout';
import { terrainHeight, inPit, FISH_LAGOON } from './terrain';

export interface SecretSpot { id: string; zone: ZoneId; name: string; x: number; z: number; mapX: number; mapZ: number; facing: number }

const NAMES: Record<string, string[]> = {
  forest: ['Hollow Oak Hideout', 'Mossy Stone Grotto', 'Fairy Mushroom Den', 'Old Owl Burrow', 'Whispering Root Cave'],
  savanna: ['Sunstone Ruins', 'Pride Rock Cave', 'Termite Tower Vault', 'Golden Dune Tomb', 'Baobab Secret Room'],
  swamp: ['Sunken Frog Temple', 'Firefly Cavern', 'Witchy Willow Hollow', 'Lily Pad Palace', 'Bog Treasure Vault'],
  village: ['Hidden Cellar', 'Old Well Tunnel', 'Secret Bakery Basement', "Scarecrow's Hideaway", 'Mouse Hole Mansion'],
  jungle: ['Monkey Temple', 'Hidden Waterfall Cave', 'Vine Tunnel Hideout', 'Parrot Lookout Den', 'Pirate Cove'],
  antarctica: ['Crystal Ice Cave', 'Frozen Pirate Hold', 'Aurora Grotto', 'Snowflake Palace', "Penguin King's Vault"],
};
// hand-picked quiet corners of the village (checked to be clear of houses, fields and paths)
const VILLAGE_SPOTS: [number, number][] = [[-56, 88], [56, 92], [-56, 152], [54, 112], [-58, 120]];
const VILLAGE_MAPS: [number, number][] = [[-44, 81], [40, 83], [-42, 152], [38, 128], [-46, 142]];

let seed = 424242;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const taken: { x: number; z: number }[] = [];
function clearAt(x: number, z: number, zone: ZoneId) {
  if (zone !== 'village') {
    if (FOOD_SPAWNS.some((p) => Math.hypot(p.x - x, p.z - z) < 4)) return false;
    if (OPP_SPAWNS.some((p) => Math.hypot(p.x - x, p.z - z) < 6)) return false;
    if (MAP_SPOTS.some((p) => Math.hypot(p.x - x, p.z - z) < 5)) return false;
    if (LANDMARKS.some((p) => Math.hypot(p.signX - x, p.signZ - z) < 8)) return false;
    if (PLATFORMS.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 5)) return false;
  }
  if (FRIEND_SPOTS.some((p) => Math.hypot(p.x - x, p.z - z) < 12)) return false;
  if (taken.some((p) => Math.hypot(p.x - x, p.z - z) < 14)) return false;
  if (inPit(x, z, 6)) return false;
  if (zone === 'jungle') {
    const F = JUNGLE_FEATURES;
    if (terrainHeight(x, z) < 0.6 || Math.hypot(x - F.pool.x, z - F.pool.z) < F.pool.r + 5 || Math.hypot(x - F.plateau.x, z - F.plateau.z) < F.plateau.r + 4 || F.treetops.some((t) => Math.hypot(x - t.x, z - t.z) < 9) || Math.hypot(x - F.entry.x, z - F.entry.z) < 14) return false;
  } else if (zone === 'antarctica') { if (terrainHeight(x, z) < 0.45 || Math.hypot(x - FISH_LAGOON.x, z - FISH_LAGOON.z) < FISH_LAGOON.r + 5) return false; }
  else if (terrainHeight(x, z) < 0.12) return false;          // not in water
  if (zone !== 'antarctica' && zone !== 'village' && Math.abs(z - pathZ(x)) < 5) return false;
  if (Math.hypot(x, z + 9) < 30) return false;                 // not in your home clearing
  return true;
}
const AREAS: Record<string, [number, number, number, number]> = {
  jungle: [-72, 72, 612, 752], forest: [-56, 56, -138, 50], savanna: [76, 226, -138, 56], swamp: [-226, -76, -138, 56], antarctica: [-60, 60, 270, 370],
};
export const SECRET_SPOTS: SecretSpot[] = [];
const ZONES = ['forest', 'savanna', 'swamp', 'village', 'antarctica', 'jungle'] as ZoneId[];
// first place all the doors…
const doorsAt: { zone: ZoneId; i: number; x: number; z: number }[] = [];
for (const zone of ZONES) {
  for (let i = 0; i < 5; i++) {
    let x = 0, z = 0;
    if (zone === 'village') [x, z] = VILLAGE_SPOTS[i];
    else {
      const [x0, x1, z0, z1] = AREAS[zone];
      for (let t = 0; t < 2000; t++) { x = x0 + rnd() * (x1 - x0); z = z0 + rnd() * (z1 - z0); if (clearAt(x, z, zone)) break; }
    }
    taken.push({ x, z });
    doorsAt.push({ zone, i, x, z });
  }
}
// …then hide each door's secret map 14–24 m away, in the same area, away from every door and other map
const mapsAt: { x: number; z: number }[] = [];
for (const d of doorsAt) {
  let mx = d.x, mz = d.z;
  if (d.zone === 'village') [mx, mz] = VILLAGE_MAPS[d.i];
  else for (let t = 0; t < 600; t++) {
    const a = rnd() * Math.PI * 2, r = 14 + rnd() * 10;
    mx = d.x + Math.cos(a) * r; mz = d.z + Math.sin(a) * r;
    const A = AREAS[d.zone];
    if (mx < A[0] || mx > A[1] || mz < A[2] || mz > A[3]) continue;
    if (doorsAt.some((q) => Math.hypot(q.x - mx, q.z - mz) < 8) || mapsAt.some((q) => Math.hypot(q.x - mx, q.z - mz) < 8)) continue;
    const save = taken.splice(0); const ok = clearAt(mx, mz, d.zone); taken.push(...save);   // (doors already checked above)
    if (ok) break;
  }
  mapsAt.push({ x: mx, z: mz });
  SECRET_SPOTS.push({ id: `${d.zone}-${d.i}`, zone: d.zone, name: NAMES[d.zone][d.i], x: Math.round(d.x * 10) / 10, z: Math.round(d.z * 10) / 10, mapX: Math.round(mx * 10) / 10, mapZ: Math.round(mz * 10) / 10, facing: rnd() * Math.PI * 2 });
}
/** Keep trees and props away from the secret doors and their maps. */
export function nearSecret(x: number, z: number, extra = 0) {
  return SECRET_SPOTS.some((s) => Math.hypot(x - s.x, z - s.z) < 4.5 + extra || Math.hypot(x - s.mapX, z - s.mapZ) < 2 + extra);
}
