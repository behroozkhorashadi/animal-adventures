// Versioned local save (browser localStorage).
import { Species, ZoneId, defaultSkin, SPECIES_ORDER } from './config';

export const SAVE_KEY = 'animal-adventures-save';
export const SAVE_VERSION = 1;

export interface SaveData {
  version: number;
  starter: Species | null;
  coins: number;
  owned: Species[];
  current: Species;
  equippedSkins: Record<Species, string>;
  ownedSkins: string[];
  homeTier: number;
  liveIn?: number;                // which owned home you live in (defaults to the biggest)
  unlockedZones: ZoneId[];
  visitedZones: ZoneId[];
  foodCount: number;
  wins: number;
  lionWins: number;
  tutorialStep: number;
  completionShown: boolean;
  freshAnimals: Species[]; // bought but not yet played → start at full health
  audio: { muted: boolean; music: number; sfx: number };
  controlsCollapsed: boolean;
  mapsFound: ZoneId[];       // treasure maps found (reveal that area's food)
  cameraFollow: boolean;     // camera swings behind the animal while walking
  bag: Record<string, number>; // food type -> how many you're carrying
  timeOfDay: number;
  fridge: Record<string, number>; // food kept safe in your fridge at home
  rescued: string[];              // farm animals you've freed from the barn
  happyBoost?: boolean;
  aquarium?: { species: string; name: string; fed: number }[];
  myPets: { species: string; name: string; fed: number; eggs?: number; female?: boolean; food?: number; fun?: number; walkies?: number; outfit?: string; clothes?: string; lost?: { x: number; z: number } }[];
  mode?: 1 | 2;                    // game mode 2 = fast & hard
  secretMaps?: string[];          // secret maps you've found
  secretsOpened?: string[];       // secret doors you've unlocked
  secretChests?: string[];        // treasure chests you've opened   // wild animals you caught (live in your upstairs Pet Room)
  girl: boolean;                  // you play as a girl animal
  bow: boolean;                   // wear a bow on your head
  notes: string;                  // your notebook page at the desk
}

export function newSave(): SaveData {
  const equippedSkins = {} as Record<Species, string>;
  for (const s of SPECIES_ORDER) equippedSkins[s] = defaultSkin(s);
  return {
    version: SAVE_VERSION,
    starter: null,
    coins: 0,
    owned: [],
    current: 'chicken',
    equippedSkins,
    ownedSkins: SPECIES_ORDER.map(defaultSkin),
    homeTier: 0,
    unlockedZones: ['forest'],
    visitedZones: ['forest'],
    foodCount: 0,
    wins: 0,
    lionWins: 0,
    tutorialStep: 0,
    completionShown: false,
    freshAnimals: [],
    audio: { muted: false, music: 0.5, sfx: 0.8 },
    controlsCollapsed: false,
    mapsFound: [],
    cameraFollow: true,
    bag: {},
    timeOfDay: 0.08,
    fridge: {},
    rescued: [],
    myPets: [],
    girl: true,
    bow: true,
    notes: '',
  };
}

// ---- Players: each player (e.g. two siblings) has their own separate saved game.
export interface Profile { id: string; name: string; girl: boolean }
const PROFILES_KEY = 'animal-adventures-profiles';
let memProfiles: { active: string; list: Profile[] } | null = null;
export function getProfiles(): { active: string; list: Profile[] } {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) { const d = JSON.parse(raw); if (d && Array.isArray(d.list) && d.list.length) return d; }
  } catch { /* storage unavailable */ }
  return memProfiles ?? { active: 'p0', list: [{ id: 'p0', name: 'Player 1', girl: true }] };
}
export function setProfiles(p: { active: string; list: Profile[] }): boolean {
  memProfiles = p;
  try { localStorage.setItem(PROFILES_KEY, JSON.stringify(p)); return true; } catch { return false; }
}
export function activeProfile(): Profile {
  const p = getProfiles();
  return p.list.find((q) => q.id === p.active) ?? p.list[0];
}
/** The first player keeps the original save slot, so nobody loses their progress. */
function saveKey() { const id = activeProfile().id; return id === 'p0' ? SAVE_KEY : `${SAVE_KEY}-${id}`; }

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(saveKey());
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    // migrate / fill missing fields from defaults
    const base = newSave();
    const merged: SaveData = { ...base, ...data, audio: { ...base.audio, ...(data.audio || {}) },
      equippedSkins: { ...base.equippedSkins, ...(data.equippedSkins || {}) } };
    merged.version = SAVE_VERSION;
    merged.coins = Math.max(0, Math.floor(Number(merged.coins) || 0));
    if (!merged.starter) return null;
    for (const s of SPECIES_ORDER) { const d = defaultSkin(s); if (!merged.ownedSkins.includes(d)) merged.ownedSkins.push(d); }
    if (!merged.owned.includes(merged.current)) merged.current = merged.owned[0] ?? merged.starter;
    return merged;
  } catch {
    return null;
  }
}

let storageWarned = false;
export function writeSave(data: SaveData): boolean {
  try {
    localStorage.setItem(saveKey(), JSON.stringify(data));
    return true;
  } catch {
    if (!storageWarned) { storageWarned = true; console.warn('Could not save progress (storage unavailable).'); }
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(saveKey()); } catch { /* ignore */ }
}

// ---- Sending coins to another player on this device -------------------------------------
const giftKey = (id: string) => `animal-adventures-gifts-${id}`;
/** Put coins in another player's mailbox. They get them the next time they play. */
export function sendCoins(toId: string, from: string, amount: number): boolean {
  try {
    const list = JSON.parse(localStorage.getItem(giftKey(toId)) || '[]') as { from: string; amount: number }[];
    list.push({ from, amount });
    localStorage.setItem(giftKey(toId), JSON.stringify(list));
    return true;
  } catch { return false; }
}
/** Open the mailbox of the player who's playing now. */
export function takeGifts(): { from: string; amount: number }[] {
  try {
    const k = giftKey(activeProfile().id), raw = localStorage.getItem(k);
    if (!raw) return [];
    localStorage.removeItem(k);
    return (JSON.parse(raw) as { from: string; amount: number }[]).filter((g) => g && g.amount > 0);
  } catch { return []; }
}
