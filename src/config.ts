// ---------------------------------------------------------------------------
// Animal Adventures — balancing & tuning configuration.
// Every price, reward, combat number, movement value and unlock rule lives
// here so it can be tweaked without touching game code.
// ---------------------------------------------------------------------------

export type Species = 'chicken' | 'penguin' | 'bunny' | 'fox' | 'wolf' | 'lion' | 'cat' | 'dog' | 'otter' | 'horse' | 'panda' | 'bear' | 'tiger' | 'unicorn' | 'human';
export type ZoneId = 'forest' | 'savanna' | 'swamp' | 'antarctica' | 'village' | 'jungle';
export type OppSpecies =
  | 'badger' | 'fox' | 'boar' | 'wolf' | 'warthog' | 'hyena' | 'lion' | 'otter' | 'crocodile'
  | 'seal' | 'elephantSeal' | 'leopardSeal' | 'bear'
  | 'bunny' | 'chicken' | 'penguin' | 'cat' | 'dog' | 'horse' | 'panda' | 'tiger' | 'monkey' | 'human'
  | 'raptor' | 'trex';
export type Tier = 'weak' | 'medium' | 'strong';

export interface PlayerAnimalDef {
  name: string;
  starter: boolean;
  cost: number;            // shop price (starters: price for an unchosen starter)
  health: number;
  scratch: number;
  bite: number;
  speed: number;           // metres / second on firm ground
  jumpMult: number;        // multiplies CONFIG.physics.jumpSpeed
  fallGravityMult: number; // < 1 = slower fall (chicken)
  mudSpeedMult: number;    // speed multiplier in swamp water/mud
  iceSpeedMult?: number;   // speed multiplier on Antarctic ice (default 1)
  rating: number;          // used for Weaker / Similar / Stronger labels
  unlock: { wins: number; zoneVisited?: ZoneId } | null;
  unlockText: string;
  blurb: string;
  icon: string;
}

export const PLAYER_ANIMALS: Record<Species, PlayerAnimalDef> = {
  chicken: {
    name: 'Chicken', starter: true, cost: 40, health: 100, scratch: 10, bite: 18,
    speed: 7, jumpMult: 1, fallGravityMult: 0.42, mudSpeedMult: 0.65, rating: 1,
    unlock: null, unlockText: 'Starter animal', icon: '🐔',
    blurb: 'Flaps its wings to float down gently after a jump.',
  },
  penguin: {
    name: 'Penguin', starter: true, cost: 40, health: 100, scratch: 10, bite: 18,
    speed: 7, jumpMult: 1, fallGravityMult: 1, mudSpeedMult: 0.9, iceSpeedMult: 1.25, rating: 1,
    unlock: null, unlockText: 'Starter animal', icon: '🐧',
    blurb: 'Slides quickly through swamp mud and on Antarctic ice.',
  },
  bunny: {
    name: 'Bunny', starter: true, cost: 40, health: 100, scratch: 10, bite: 18,
    speed: 7, jumpMult: 1.14, fallGravityMult: 1, mudSpeedMult: 0.65, rating: 1,
    unlock: null, unlockText: 'Starter animal', icon: '🐰',
    blurb: 'Jumps a little higher than everyone else.',
  },
  fox: {
    name: 'Fox', starter: false, cost: 80, health: 125, scratch: 13, bite: 23,
    speed: 7.8, jumpMult: 1.03, fallGravityMult: 1, mudSpeedMult: 0.65, rating: 2,
    unlock: { wins: 3 }, unlockText: 'Win 3 battles', icon: '🦊',
    blurb: 'Quick and clever. Stronger than the starters.',
  },
  wolf: {
    name: 'Wolf', starter: false, cost: 160, health: 155, scratch: 16, bite: 28,
    speed: 8.2, jumpMult: 1.03, fallGravityMult: 1, mudSpeedMult: 0.65, rating: 3,
    unlock: { wins: 6, zoneVisited: 'savanna' }, unlockText: 'Enter the Savanna and win 6 battles', icon: '🐺',
    blurb: 'A strong runner with a powerful bite.',
  },
  lion: {
    name: 'Lion', starter: false, cost: 280, health: 190, scratch: 20, bite: 35,
    speed: 8, jumpMult: 1.03, fallGravityMult: 1, mudSpeedMult: 0.65, rating: 4,
    unlock: { wins: 10, zoneVisited: 'swamp' }, unlockText: 'Enter the Swamp and win 10 battles', icon: '🦁',
    blurb: 'The strongest animal of all. Very brave!',
  },
  cat: {
    name: 'Cat', starter: false, cost: 60, health: 115, scratch: 13, bite: 19,
    speed: 8.2, jumpMult: 1.12, fallGravityMult: 1, mudSpeedMult: 0.6, rating: 1.5,
    unlock: { wins: 2 }, unlockText: 'Win 2 battles', icon: '🐱',
    blurb: 'Quick paws, sharp claws and a big jump.',
  },
  dog: {
    name: 'Dog', starter: false, cost: 70, health: 125, scratch: 12, bite: 22,
    speed: 8.4, jumpMult: 1.03, fallGravityMult: 1, mudSpeedMult: 0.75, rating: 2,
    unlock: { wins: 3 }, unlockText: 'Win 3 battles', icon: '🐶',
    blurb: 'A loyal, speedy runner. Woof!',
  },
  otter: {
    name: 'Otter', starter: false, cost: 90, health: 120, scratch: 12, bite: 22,
    speed: 7.4, jumpMult: 1.03, fallGravityMult: 1, mudSpeedMult: 1.25, iceSpeedMult: 1.15, rating: 2,
    unlock: { wins: 4, zoneVisited: 'swamp' }, unlockText: 'Visit the Swamp and win 4 battles', icon: '🦦',
    blurb: 'Zooms through swamp water, and can swim and fish in the Fish Lagoon too!',
  },
  horse: {
    name: 'Horse', starter: false, cost: 150, health: 150, scratch: 14, bite: 24,
    speed: 9.6, jumpMult: 1.08, fallGravityMult: 1, mudSpeedMult: 0.7, rating: 2.6,
    unlock: { wins: 5 }, unlockText: 'Win 5 battles', icon: '🐴',
    blurb: 'The fastest runner in the whole game. Gallop!',
  },
  panda: {
    name: 'Panda', starter: false, cost: 170, health: 175, scratch: 16, bite: 27,
    speed: 7.2, jumpMult: 1, fallGravityMult: 1, mudSpeedMult: 0.7, rating: 3,
    unlock: { wins: 6 }, unlockText: 'Win 6 battles', icon: '🐼',
    blurb: 'Big, cuddly and surprisingly strong.',
  },
  bear: {
    name: 'Bear', starter: false, cost: 240, health: 205, scratch: 19, bite: 33,
    speed: 7.6, jumpMult: 1, fallGravityMult: 1, mudSpeedMult: 0.7, rating: 3.6,
    unlock: { wins: 8, zoneVisited: 'savanna' }, unlockText: 'Visit the Savanna and win 8 battles', icon: '🐻',
    blurb: 'Huge paws and lots of health. Hard to beat!',
  },
  tiger: {
    name: 'Tiger', starter: false, cost: 300, health: 195, scratch: 21, bite: 35,
    speed: 8.7, jumpMult: 1.05, fallGravityMult: 1, mudSpeedMult: 0.7, rating: 4,
    unlock: { wins: 10, zoneVisited: 'swamp' }, unlockText: 'Visit the Swamp and win 10 battles', icon: '🐯',
    blurb: 'Stripy, fast and fierce, like a lion with a sneaky pounce.',
  },
  unicorn: {
    name: 'Unicorn', starter: false, cost: 400, health: 200, scratch: 20, bite: 34,
    speed: 9.6, jumpMult: 1.22, fallGravityMult: 0.8, mudSpeedMult: 0.8, rating: 4,
    unlock: { wins: 12 }, unlockText: 'Win 12 battles', icon: '🦄',
    blurb: 'Magical! Super fast, jumps super high and floats down gently.',
  },
  human: {
    name: 'Human', starter: false, cost: 120, health: 130, scratch: 12, bite: 20,
    speed: 7.6, jumpMult: 1.05, fallGravityMult: 1, mudSpeedMult: 0.7, rating: 2,
    unlock: { wins: 4 }, unlockText: 'Win 4 battles', icon: '🧒',
    blurb: 'A kid explorer! Village humans think you\'re one of them, and you can ride horses (press A next to one).',
  },
};

export const SPECIES_ORDER: Species[] = ['chicken', 'penguin', 'bunny', 'cat', 'dog', 'fox', 'otter', 'horse', 'panda', 'wolf', 'bear', 'tiger', 'lion', 'unicorn', 'human'];

// --- Opponents ---------------------------------------------------------------
export interface TierDef { health: number; damage: number; speed: number; reward: number; rating: number; windup?: number }
export const TIERS: Record<Tier, TierDef> = {
  weak:   { health: 60,  damage: 6,  speed: 4.0, reward: 6,  rating: 0.5 },
  medium: { health: 110, damage: 10, speed: 4.8, reward: 12, rating: 1.4 },
  strong: { health: 170, damage: 14, speed: 5.4, reward: 20, rating: 2.6 },
};
// Per-species overrides (e.g. lions are a bit tougher than other strong animals).
export const OPP_OVERRIDES: Partial<Record<OppSpecies, Partial<TierDef>>> = {
  lion: { health: 210, damage: 15, rating: 3.6 },
  // Night-time dinosaurs: they bite hard (but you can fight back!). Long, loud wind-ups so you can dodge.
  raptor: { health: 150, damage: 22, speed: 6.1, reward: 30, rating: 9, windup: 0.95 },
  trex: { health: 200, damage: 34, speed: 4.2, reward: 50, rating: 10, windup: 1.7 }, // big and scary, but slow and easy to dodge
  seal: { speed: 3.2 },
  bear: { health: 200, damage: 16, rating: 3.2 },
  elephantSeal: { speed: 3.6, health: 130 },
};

export const OPPONENT_AI = {
  wanderRadius: 6,
  wanderSpeed: 1.4,
  leashDistance: 24,        // gives up when dragged this far from home
  attackRange: 1.5,         // added to both radii
  windupTime: 0.8,          // visible telegraph before a strike
  recoverTime: 1.1,         // safe window after a strike
  dodgeHeight: 0.6,         // player this far above ground avoids the strike
  territorialWarnRadius: 6, // strong animals warn when you get this close…
  territorialAttackRadius: 4, // …and only attack if you stay this close
  territorialWarnTime: 2.6,
};

// --- Combat -------------------------------------------------------------------
export const COMBAT = {
  scratchCooldown: 0.45,
  biteCooldown: 0.9,
  specialCooldown: 1.0,
  attackRange: 1.6,         // added to both radii
  frontAngleDeg: 70,        // half-angle of the attack cone in front of the player
  targetHintRange: 5,       // show target marker a little before you're in range
  chargePerHit: 10,
  chargeMax: 100,
  specialMultiplier: 3,     // × bite damage
  playerInvulnAfterHit: 0.6,
};

// --- Rewards, timers ----------------------------------------------------------
export const REWARDS = {
  commonFood: 2,
  rareFood: 8,
  defeatPenalty: 3,
};

// Food in the bag can be eaten for health.
export const FOOD_HEAL = { common: 15, rare: 40 };
export const BAG_LIMIT = 30;
export const FRIDGE_LIMIT = 100;

// Cooked meals heal more than plain food.
export const DISH_HEAL: Record<string, number> = {
  fishSoup: 55, veggieStew: 50, berryJam: 40, heartyStew: 45, goldenFeast: 100,
};
export const COOK_SECONDS = 3;

// A full day + night takes this many seconds of play.
export const DAY_LENGTH = 420;

// Dinosaurs come out at night (time of day 0.6 → 0.97) in the forest, savanna and swamp.
/** Game mode: 1 = normal, 2 = fast & hard (animals are faster and tougher, and so are you!). */
export const GAME_MODE = { level: 1 as 1 | 2 };
export const MODE2 = { oppSpeed: 1.4, oppHealth: 1.5, oppDamage: 1.35, windup: 0.7, playerSpeed: 1.3 };

export const DINOS = {
  raptors: 6,
  trexes: 3,
  huntRadius: 18,        // they start chasing you when you're this close
  safeHomeRadius: 18,    // ...but never come into your home clearing
  chaseLeash: 45,
  zones: ['forest', 'savanna', 'swamp', 'village', 'jungle'] as ZoneId[],   // dinosaurs roam everywhere at night (Antarctica has ice monsters instead)
};

export const TIMERS = {
  foodRespawn: 45,
  opponentRespawn: 60,
  coinLifetime: 90,          // must be ≥ 30 per spec
  regenDelay: 8,
  regenPerSecond: 4,
  homeRegenPerSecond: 20,
};

// --- Physics & movement -------------------------------------------------------
export const PHYSICS = {
  gravity: 26,
  jumpSpeed: 9.6,           // apex ≈ 1.77 m
  stepUp: 0.4,
  playerRadius: 0.4,
  fallDeathY: -6,
  coinHeight: 2.15,         // coin centre above the ground where it spawns
  coinPickupRadius: 1.0,    // measured from player centre (feet + 0.5)
  coinSpacing: 1.7,
  turnSpeed: 12,
};

// --- Progression --------------------------------------------------------------
export const ZONE_GATES = {
  savanna: { food: 10, wins: 3 },
  swamp: { wins: 6, visited: 'savanna' as ZoneId },
};

export const HOMES = [
  { name: 'Tiny Shelter', cost: 0, blurb: 'A cosy lean-to made of sticks and leaves.' },
  { name: 'Small Cabin', cost: 50, blurb: 'A little log cabin with a window.' },
  { name: 'Woodland House', cost: 120, blurb: 'A bigger house with a chimney and a porch.' },
  { name: 'Large Animal Lodge', cost: 240, blurb: 'A huge lodge with two floors and lanterns!' },
  { name: 'Treehouse Mansion', cost: 1000, blurb: 'The lodge PLUS a giant tree with a treehouse on top and a rope ladder!' },
  { name: 'Crystal Castle', cost: 2500, blurb: 'A real castle with four towers, flags and glowing crystals!' },
  { name: 'Rainbow Palace', cost: 5000, blurb: 'The fanciest home of all: golden domes, a rainbow and a fountain!' },
];

// --- Skins (appearance only — never change stats) ------------------------------
export interface SkinDef {
  id: string;
  species: Species;
  name: string;
  cost: number;
  colors: { primary: number; secondary: number; accent: number; extra?: number };
  pattern?: 'spots' | 'speckle' | 'patches' | 'stripes';
}

export const SKINS: SkinDef[] = [
  { id: 'chicken-classic', species: 'chicken', name: 'Classic White', cost: 0, colors: { primary: 0xf3eee2, secondary: 0xe6dccb, accent: 0xd8322a } },
  { id: 'chicken-buff', species: 'chicken', name: 'Golden Buff', cost: 15, colors: { primary: 0xd9a259, secondary: 0xc78a3f, accent: 0xcf2f25 } },
  { id: 'chicken-speckled', species: 'chicken', name: 'Speckled Black', cost: 30, colors: { primary: 0x2c2b2e, secondary: 0x45434a, accent: 0xd8322a, extra: 0xf1efe8 }, pattern: 'speckle' },
  { id: 'chicken-pink', species: 'chicken', name: 'Bubblegum Pink', cost: 40, colors: { primary: 0xf6b8d0, secondary: 0xf09ac0, accent: 0xe8508a } },
  { id: 'chicken-silkie', species: 'chicken', name: 'Fluffy Silkie', cost: 50, colors: { primary: 0xb8c4e8, secondary: 0xd0d8f4, accent: 0x6a5ad8 } },
  { id: 'chicken-rainbow', species: 'chicken', name: 'Rainbow Stripes', cost: 60, colors: { primary: 0xffd34a, secondary: 0x7ac0e8, accent: 0xe4475b, extra: 0xb07aff }, pattern: 'stripes' },

  { id: 'penguin-emperor', species: 'penguin', name: 'Emperor', cost: 0, colors: { primary: 0x23262d, secondary: 0xf4f2ec, accent: 0xf2b134 } },
  { id: 'penguin-rockhopper', species: 'penguin', name: 'Rockhopper', cost: 15, colors: { primary: 0x2f3237, secondary: 0xeeeeea, accent: 0xe6c128 } },
  { id: 'penguin-blue', species: 'penguin', name: 'Little Blue', cost: 30, colors: { primary: 0x3d5f8a, secondary: 0xf0f2f2, accent: 0x8c9aa8 } },
  { id: 'penguin-pink', species: 'penguin', name: 'Pink Party', cost: 40, colors: { primary: 0xe86aa8, secondary: 0xfff0f6, accent: 0xffd34a } },
  { id: 'penguin-galaxy', species: 'penguin', name: 'Galaxy', cost: 50, colors: { primary: 0x2a1a5a, secondary: 0xe0d8ff, accent: 0xffe066 } },
  { id: 'penguin-golden', species: 'penguin', name: 'Golden', cost: 60, colors: { primary: 0xd8a830, secondary: 0xfff4d0, accent: 0xe86a2a } },

  { id: 'bunny-brown', species: 'bunny', name: 'Wild Brown', cost: 0, colors: { primary: 0x9a7552, secondary: 0xe9dccb, accent: 0xe8a3a8 } },
  { id: 'bunny-snow', species: 'bunny', name: 'Snowy White', cost: 15, colors: { primary: 0xf4f1ec, secondary: 0xffffff, accent: 0xf0a8b0 } },
  { id: 'bunny-dutch', species: 'bunny', name: 'Spotted Dutch', cost: 30, colors: { primary: 0xf3efe8, secondary: 0xffffff, accent: 0xe8a3a8, extra: 0x3b302b }, pattern: 'patches' },
  { id: 'bunny-lilac', species: 'bunny', name: 'Lilac', cost: 40, colors: { primary: 0xc8b0e8, secondary: 0xf4ecff, accent: 0xf0a8c8 } },
  { id: 'bunny-ginger', species: 'bunny', name: 'Ginger Spots', cost: 50, colors: { primary: 0xf0a860, secondary: 0xfff2e0, accent: 0xe88a8a, extra: 0xc06a2a }, pattern: 'spots' },
  { id: 'bunny-midnight', species: 'bunny', name: 'Midnight', cost: 60, colors: { primary: 0x2e2a3a, secondary: 0x8a80a8, accent: 0xb07aff } },

  { id: 'fox-red', species: 'fox', name: 'Red Fox', cost: 0, colors: { primary: 0xc8622a, secondary: 0xf3ece2, accent: 0x2a211d } },
  { id: 'fox-arctic', species: 'fox', name: 'Arctic Fox', cost: 15, colors: { primary: 0xeeeeea, secondary: 0xffffff, accent: 0x6d6a68 } },
  { id: 'fox-silver', species: 'fox', name: 'Silver Fox', cost: 30, colors: { primary: 0x3b3a3d, secondary: 0xd9d8d5, accent: 0x1b1a1c, extra: 0xa9a7a6 }, pattern: 'speckle' },
  { id: 'fox-pink', species: 'fox', name: 'Pink Fox', cost: 40, colors: { primary: 0xf08ab8, secondary: 0xfff0f6, accent: 0x7a2a52 } },
  { id: 'fox-fennec', species: 'fox', name: 'Desert Fennec', cost: 50, colors: { primary: 0xe8c890, secondary: 0xfff6e4, accent: 0x8a6a40 } },
  { id: 'fox-blue', species: 'fox', name: 'Blue Moon', cost: 60, colors: { primary: 0x5a7ac8, secondary: 0xe0eaff, accent: 0x1e2a5a, extra: 0xb0c8ff }, pattern: 'speckle' },

  { id: 'wolf-grey', species: 'wolf', name: 'Grey Wolf', cost: 0, colors: { primary: 0x7d7a76, secondary: 0xd8d2c8, accent: 0x3a3634 } },
  { id: 'wolf-timber', species: 'wolf', name: 'Timber Wolf', cost: 15, colors: { primary: 0x7b5c3e, secondary: 0xd6c3a5, accent: 0x2f2620 } },
  { id: 'wolf-arctic', species: 'wolf', name: 'Arctic Wolf', cost: 30, colors: { primary: 0xe9e7e2, secondary: 0xffffff, accent: 0x8a8582 } },
  { id: 'wolf-black', species: 'wolf', name: 'Black Wolf', cost: 40, colors: { primary: 0x2a2a2e, secondary: 0x6a6a72, accent: 0x111114 } },
  { id: 'wolf-red', species: 'wolf', name: 'Red Wolf', cost: 50, colors: { primary: 0xa85a3a, secondary: 0xe8c8a8, accent: 0x3a2a20 } },
  { id: 'wolf-starry', species: 'wolf', name: 'Starry Night', cost: 60, colors: { primary: 0x2a3a6a, secondary: 0xc8d8ff, accent: 0x101a3a, extra: 0xffe066 }, pattern: 'spots' },

  { id: 'cat-tabby', species: 'cat', name: 'Orange Tabby', cost: 0, colors: { primary: 0xe89a4a, secondary: 0xfff2e0, accent: 0xe8a0b0, extra: 0xb8642a }, pattern: 'stripes' },
  { id: 'cat-black', species: 'cat', name: 'Midnight Black', cost: 20, colors: { primary: 0x26242a, secondary: 0x3a3840, accent: 0xe8a0b0 } },
  { id: 'cat-calico', species: 'cat', name: 'Calico', cost: 40, colors: { primary: 0xf6f2ea, secondary: 0xffffff, accent: 0xe8a0b0, extra: 0xd88a3a }, pattern: 'patches' },
  { id: 'dog-golden', species: 'dog', name: 'Golden Retriever', cost: 0, colors: { primary: 0xe0b060, secondary: 0xf4dca8, accent: 0x3a2a20 } },
  { id: 'dog-dalmatian', species: 'dog', name: 'Dalmatian', cost: 20, colors: { primary: 0xf8f8f4, secondary: 0xffffff, accent: 0x1e1e1e, extra: 0x1e1e1e }, pattern: 'spots' },
  { id: 'dog-husky', species: 'dog', name: 'Husky', cost: 40, colors: { primary: 0x6a7078, secondary: 0xf4f4f4, accent: 0x2a2a2e } },
  { id: 'otter-river', species: 'otter', name: 'River Otter', cost: 0, colors: { primary: 0x6a4a32, secondary: 0xc8a888, accent: 0x2e2018 } },
  { id: 'otter-sea', species: 'otter', name: 'Sea Otter', cost: 20, colors: { primary: 0x4a3a30, secondary: 0xe8dccc, accent: 0x1e1612 } },
  { id: 'otter-golden', species: 'otter', name: 'Sunny Gold', cost: 40, colors: { primary: 0xd8a040, secondary: 0xfff0c8, accent: 0x8a5a20 } },
  { id: 'horse-bay', species: 'horse', name: 'Bay Horse', cost: 0, colors: { primary: 0x8a5a3a, secondary: 0xc8a080, accent: 0x2a1a10 } },
  { id: 'horse-white', species: 'horse', name: 'Snow White', cost: 20, colors: { primary: 0xf4f2ee, secondary: 0xffffff, accent: 0xc8c0b8 } },
  { id: 'horse-appaloosa', species: 'horse', name: 'Spotty Appaloosa', cost: 40, colors: { primary: 0xf0e8dc, secondary: 0xffffff, accent: 0x3a2a20, extra: 0x5a4030 }, pattern: 'spots' },
  { id: 'panda-classic', species: 'panda', name: 'Giant Panda', cost: 0, colors: { primary: 0xf6f4f0, secondary: 0xffffff, accent: 0x1a1a1c } },
  { id: 'panda-red', species: 'panda', name: 'Red Panda Look', cost: 20, colors: { primary: 0xc0582a, secondary: 0xfff0e0, accent: 0x3a1a10 } },
  { id: 'panda-pink', species: 'panda', name: 'Cotton Candy', cost: 40, colors: { primary: 0xffd0e4, secondary: 0xffffff, accent: 0xb07ad8 } },
  { id: 'bear-brown', species: 'bear', name: 'Brown Bear', cost: 0, colors: { primary: 0x6a4a30, secondary: 0x8a6a48, accent: 0x2e2018 } },
  { id: 'bear-polar', species: 'bear', name: 'Polar Bear', cost: 20, colors: { primary: 0xf4f2ea, secondary: 0xffffff, accent: 0x2a2a2a } },
  { id: 'bear-black', species: 'bear', name: 'Black Bear', cost: 40, colors: { primary: 0x2a2626, secondary: 0x8a7058, accent: 0x111111 } },
  { id: 'tiger-bengal', species: 'tiger', name: 'Bengal Tiger', cost: 0, colors: { primary: 0xe8822a, secondary: 0xfff2e0, accent: 0x2a1a10, extra: 0x1e140c }, pattern: 'stripes' },
  { id: 'tiger-white', species: 'tiger', name: 'White Tiger', cost: 20, colors: { primary: 0xf4f2ee, secondary: 0xffffff, accent: 0x2a2a30, extra: 0x2a2a30 }, pattern: 'stripes' },
  { id: 'tiger-golden', species: 'tiger', name: 'Golden Tiger', cost: 40, colors: { primary: 0xf0c060, secondary: 0xfff6e0, accent: 0xb8742a, extra: 0xc87a30 }, pattern: 'stripes' },
  { id: 'unicorn-white', species: 'unicorn', name: 'Classic Unicorn', cost: 0, colors: { primary: 0xfaf8f6, secondary: 0xffffff, accent: 0xe86aa8 } },
  { id: 'unicorn-rainbow', species: 'unicorn', name: 'Rainbow Mane', cost: 20, colors: { primary: 0xfff4fa, secondary: 0xffffff, accent: 0x7ab0f0, extra: 0xffd34a }, pattern: 'stripes' },
  { id: 'unicorn-galaxy', species: 'unicorn', name: 'Galaxy Unicorn', cost: 40, colors: { primary: 0x3a2a6a, secondary: 0xc8b8ff, accent: 0xffe066 } },

  { id: 'human-classic', species: 'human', name: 'Pink & Jeans', cost: 0, colors: { primary: 0xf08ab8, secondary: 0x3a5a9a, accent: 0x6a4228 } },
  { id: 'human-explorer', species: 'human', name: 'Jungle Explorer', cost: 20, colors: { primary: 0xc8a868, secondary: 0x4a6a3a, accent: 0x1e1612 } },
  { id: 'human-rider', species: 'human', name: 'Horse Rider', cost: 40, colors: { primary: 0x8a5ad8, secondary: 0xf4f0e8, accent: 0xf0c860 } },

  { id: 'lion-golden', species: 'lion', name: 'Golden Lion', cost: 0, colors: { primary: 0xc89a5a, secondary: 0xe8d2a8, accent: 0x7a4a24 } },
  { id: 'lion-white', species: 'lion', name: 'White Lion', cost: 15, colors: { primary: 0xece2cf, secondary: 0xf8f2e6, accent: 0xd6c3a0 } },
  { id: 'lion-darkmane', species: 'lion', name: 'Dark Mane', cost: 30, colors: { primary: 0xb88a52, secondary: 0xe0c89c, accent: 0x2e2018 } },
  { id: 'lion-snow', species: 'lion', name: 'Snow Leopard Look', cost: 40, colors: { primary: 0xe8e4dc, secondary: 0xffffff, accent: 0x7a7a80, extra: 0x5a5a62 }, pattern: 'spots' },
  { id: 'lion-tiger', species: 'lion', name: 'Tiger Stripes', cost: 50, colors: { primary: 0xe88a2a, secondary: 0xfff2e0, accent: 0x3a2010, extra: 0x2a1a10 }, pattern: 'stripes' },
  { id: 'lion-pink', species: 'lion', name: 'Strawberry', cost: 60, colors: { primary: 0xf4a6c0, secondary: 0xfff0f6, accent: 0xc04a7a } },
];

export function defaultSkin(s: Species): string {
  return SKINS.find((k) => k.species === s && k.cost === 0)!.id;
}
export function skinById(id: string): SkinDef | undefined {
  return SKINS.find((k) => k.id === id);
}

// --- World layout constants -----------------------------------------------------
export const WORLD = {
  minX: -235, maxX: 235, minZ: -145, maxZ: 65,   // a big world: the forest reaches far south, the savanna and swamp are wide
  zoneEdge: 65,           // |x| where forest meets savanna (east) / swamp (west)
  gateHalfWidth: 5,
  spawn: { x: 0, z: 3 },
  antarcticaEntry: { x: 0, z: 266 },
  home: { x: 0, z: -9 },
};

// Antarctica is a separate icy island, reached only with the Travel button.
export const ANTARCTICA = { minX: -75, maxX: 75, minZ: 255, maxZ: 385 };

// Jungle Island: a sunny beach on the south side and thick jungle behind it, reached only with Travel.
export const JUNGLE = { minX: -80, maxX: 80, minZ: 600, maxZ: 760 };
export const JUNGLE_FEATURES = {
  entry: { x: 0, z: 614 },
  pool: { x: 42, z: 708, r: 7.5 },          // the waterfall pool
  plateau: { x: 44, z: 728, r: 13, h: 5.5 }, // the cliff the waterfall pours off
  treetops: [{ x: -32, z: 688, top: 4.2 }, { x: -20, z: 700, top: 4.2 }, { x: -34, z: 708, top: 4.2 }, { x: -46, z: 698, top: 4.2 }],
};

// The Human Village lies north of the forest, over the big hill.
export const VILLAGE = { minX: -63, maxX: 63, minZ: 72, maxZ: 160, ridgeZ: 69 };

/** Walkable bounds for whichever region a point is in. */
export function regionBounds(x: number, z: number) {
  if (z > 500) return JUNGLE;
  if (z > 200) return ANTARCTICA;
  if (z < -1700) return { minX: -47.5, maxX: 47.5, minZ: -1947.5, maxZ: -1852.5 }; // the Aquarium (it's huge!)
  if (z < -1400) return { minX: -31.5, maxX: 31.5, minZ: -1631.5, maxZ: -1568.5 }; // the Big Play Room
  if (z < -1000) return { minX: -34, maxX: 34, minZ: -1278, maxZ: -1122 }; // inside the Magic Zoo
  if (z < -700) return { minX: -8.2, maxX: 8.2, minZ: -908.2, maxZ: -891.8 }; // inside a secret place
  if (z < -300 && x > 250) return { minX: 250, maxX: 700, minZ: -440, maxZ: -360 }; // inside a human house
  if (z < -300) return x > 100 ? { minX: 170, maxX: 230, minZ: -440, maxZ: -360 } /* inside the barn */ : { minX: -30, maxX: 30, minZ: -440, maxZ: -360 }; // inside your house
  // the forest column (between the zone walls) continues north over the hill into the village
  if (Math.abs(x) < WORLD.zoneEdge) return { minX: WORLD.minX, maxX: WORLD.maxX, minZ: WORLD.minZ, maxZ: VILLAGE.maxZ };
  return WORLD;
}

// Humans in the village try to catch you with nets (no fighting humans).
export const HUMAN_AI = {
  walkSpeed: 1.6,
  chaseSpeed: 5.3,       // slower than every playable animal, so you can always run away
  sightRange: 11,
  sightHalfAngleDeg: 60,
  noticeTime: 0.6,       // "Huh?" pause before they chase
  catchRange: 1.5,
  windupTime: 0.65,      // net goes up: move or jump!
  recoverTime: 1.2,
  giveUpDistance: 17,
  loseSightTime: 2.5,
  alertRadius: 14,       // stealing food near a human makes them chase you
};
