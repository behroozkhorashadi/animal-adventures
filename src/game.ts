import { Aquarium, AQUA, SEA_INFO, SEA_SPECIES, SeaSpecies, SeaRig, buildSeaCreature, animateSea } from './sealife';
import { PlayRoom, PLAYROOM, TOYS } from './playroom';
import { dressRig, dressBody, OUTFITS, CLOTHES } from './outfits';
// Game: glue for player control, combat, rewards, progression, shop & menus.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  PLAYER_ANIMALS, SPECIES_ORDER, Species, ZoneId, COMBAT, REWARDS, TIMERS, PHYSICS, ZONE_GATES, HOMES,
  SKINS, skinById, WORLD, regionBounds, OppSpecies, JUNGLE_FEATURES, GAME_MODE, MODE2, FOOD_HEAL, BAG_LIMIT, HUMAN_AI, VILLAGE, DAY_LENGTH, DINOS, DISH_HEAL, COOK_SECONDS,
} from './config';
import { SaveData, loadSave, newSave, writeSave, clearSave, getProfiles, setProfiles, activeProfile, sendCoins, takeGifts } from './save';
import { World } from './world';
import { terrainHeight, zoneAt, isMud, inPit, FISH_LAGOON } from './terrain';
import { FOOD_SPAWNS, OPP_SPAWNS, FOOD_NAMES, TUTORIAL_RING, MAP_SPOTS, FoodType, HUMAN_SPAWNS, DISHES, RECIPES, cookResult, BARN, HUMAN_HOMES, HumanHome, FRIEND_SPOTS } from './layout';
import { AnimalRig, buildPlayerAnimal, animateRig, setRigGlow, disposeRig, buildOpponent } from './animals';
import { buildHome, HomeBuild } from './homes';
import { FoodItem, makeFoodItem, CoinToken, makeCoin, removeCoin, buildMapScroll, buildBeam, buildFoodMesh } from './pickups';
import { Opponent, sparkleBurst } from './opponents';
import { Human } from './humans';
import { Interior, INTERIOR, buildPot, Seat } from './interior';
import { Barn, BARN_ROOM, FARM_ANIMALS, Pen } from './barn';
import { barnDoor, humanHomeDoors } from './village';
import { Collider } from './terrain';
import { SecretPlaces, SECRET_ROOM } from './secrets';
import { MagicZoo, ZOO, ZOO_SLOTS, ZooAnimal } from './zoo';
import { SECRET_SPOTS, SecretSpot } from './secretspots';
import { initVoice, voiceAvailable, startListening, Listening } from './voice';
import { makeDream } from './family';
import { initFamilyBrain, familyReply, familyChatter, friendChatter, smartRepliesAvailable, ChatTurn, FamilyContext } from './family';
import { plankTexture, roofTexture } from './textures';
import { buildFarmAnimal, FarmKind, addBow, sleepPose } from './animals';
import { OrbitCam } from './camera';
import { Audio } from './audio';
import { Preview } from './preview';
import { softDotTexture, ringTexture } from './textures';
import { $, el, button, toast, banner, coinPrice, confetti } from './ui';

type Selection = { kind: 'animal'; species: Species } | { kind: 'skin'; id: string } | { kind: 'home'; tier: number };
type ModalName = 'dream' | 'math' | 'rescuemap' | 'pets' | 'players' | 'shop' | 'animals' | 'pause' | 'celebrate' | 'travel' | 'bag' | 'cook' | 'fridge' | 'family' | 'notebook' | null;

const ZONE_NAMES: Record<ZoneId, string> = { forest: 'The Forest', savanna: 'The Savanna', swamp: 'The Swamp', antarctica: 'Antarctica', village: 'Human Village', jungle: 'Jungle Island' };
const ZONE_SUBS: Record<ZoneId, string> = { forest: 'Home sweet home', savanna: 'Where the lions live', swamp: 'Misty and muddy', antarctica: 'Brrr! Land of ice and penguins', village: 'Sneak in and steal their snacks!', jungle: 'Monkeys, waterfalls and a sunny beach!' };

const pick2 = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  cam!: OrbitCam;
  world!: World;
  audio = new Audio();
  preview!: Preview;
  save: SaveData = newSave();
  started = false;
  modal: ModalName = null;
  private modalCleanup: (() => void) | null = null;
  keys = new Set<string>();

  // player
  species: Species = 'chicken';
  rig!: AnimalRig;
  pos = new THREE.Vector3();
  vy = 0;
  yaw = 0;
  grounded = true;
  lastGroundedAt = 0;
  groundY = 0;
  hp = 100;
  charge = 0;
  cd = { scratch: 0, bite: 0, special: 0, jump: 0 };
  private jumpAttack: { target: Opponent | null } | null = null;
  private dustTimer = 0;
  attack: { kind: 'scratch' | 'bite' | 'special'; t: number; dur: number } | null = null;
  lunge: { dir: THREE.Vector3; time: number } | null = null;
  invuln = 0;
  hurtFlash = 0;
  lastCombat = -99;
  respawning = false;
  speedNow = 0;
  zone: ZoneId = 'forest';

  foods: FoodItem[] = [];
  beams: THREE.Mesh[] = [];
  mapItems: { zone: ZoneId; group: THREE.Group; baseY: number; x: number; z: number }[] = [];
  private minimapTick = 0;
  coins: CoinToken[] = [];
  opps: Opponent[] = [];
  humans: Human[] = [];
  dinos: Opponent[] = [];
  private wasNight = false;
  private dinoTimer = 0;
  interior!: Interior;
  doorOpen = false;
  seat: Seat | null = null;
  barn!: Barn;
  barnDoorOpen = false;
  hhouses: { home: HumanHome; interior: Interior; door: THREE.Object3D | null; open: boolean; raidDay: number; front: { x: number; z: number } }[] = [];
  dayCount = 0;
  captive: {
    house: number; caged: boolean; wiggle: number; cage: THREE.Group; cageDoor: THREE.Object3D; cols: Collider[]; front: Collider | null; cx: number; cz: number; hs: number;
    dinner: { bowl: THREE.Group; until: number; eaten: boolean } | null;
    owner: string; roomRoute: [number, number][]; timer: number; eventIdx: number; scoldAt: number;
    onWalk: boolean; walkTimer: number; nextTrick: number; trickUntil: number; leash: THREE.Line | null; tugAt: number;
  } | null = null;
  petOwner!: Human;
  /** One human per house who is sometimes at home (and sleeps in bed at night). */
  homeHumans: Human[] = [];
  private homeState: ('none' | 'awake' | 'asleep')[] = [];
  private humansAsleep = false;
  private dinnerPlates: THREE.Group | null = null;
  family: { name: string; rig: AnimalRig; x: number; z: number; dayX: number; dayZ: number; asleep: boolean; mode?: 'day' | 'dinner' | 'bed'; following?: boolean; walkingHome?: boolean; caged?: { house: number; cage: THREE.Group; x: number; z: number; open: number } | null; trick?: { kind: 'jump' | 'dance' | 'spin' | 'sit' | 'sleep'; until: number; baseY: number }; bubble: HTMLDivElement; bubbleUntil: number; col: Collider | null }[] = [];
  private chats: Record<string, ChatTurn[]> = {};
  private chatterAt = 0;
  private chatBusy = false;
  pets: { rig: AnimalRig; kind: FarmKind; name: string; emoji: string; x: number; z: number; y: number; tx: number; tz: number; wait: number; yaw: number; following: boolean; settled: boolean; asleep?: boolean; goingHome?: boolean; trick?: { kind: 'jump' | 'dance' | 'spin' | 'sit' | 'sleep'; until: number; baseY: number }; caged?: { house: number; cage: THREE.Group; x: number; z: number; open: number } | null; bubble: HTMLDivElement; tag: HTMLDivElement; bubbleUntil: number }[] = [];
  private static FRIEND_HOME = { x: 26, z: -9 };   // middle of Friends' Lane
  private friendChatterAt = 0;
  private outsideDoor: THREE.Object3D | null = null;
  private campfire!: THREE.Group;
  private action: { label: string; fn: () => void } | null = null;
  private static CAMPFIRE = { x: -8, z: 2 };
  private shoutAt = 0;
  effects: ((dt: number) => boolean)[] = [];
  timers: { at: number; fn: () => void }[] = [];
  now = 0;
  realTime = 0;
  private lastFrame = 0;

  home!: HomeBuild;
  homeColliders: ReturnType<World['collision']['add']>[] = [];
  targetRing!: THREE.Mesh;
  aura!: THREE.Sprite;
  objArrow!: THREE.Mesh;
  private thumbs = new Map<string, string>();
  private shopSel: Selection | null = null;
  private shopTab: 'animals' | 'skins' | 'homes' = 'animals';
  private shopMsg: { text: string; cls: string } | null = null;
  private notifiedUnlocks = new Set<Species>();
  private gateHintAt = 0;
  private hudCache: Record<string, string> = {};
  private specialWasReady = false;
  private lastSpecialHint = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 700);
    window.addEventListener('resize', () => this.resize());
  }

  // =========================================================================
  // Loading
  // =========================================================================
  async load(progress: (f: number, text: string) => Promise<void>) {
    await progress(0.1, 'Growing the forest…');
    this.world = new World(this.scene);
    this.secrets = new SecretPlaces(this.scene, this.world.collision);
    this.zoo = new MagicZoo(this.scene, this.world.collision, activeProfile().name);
    this.playroom = new PlayRoom(this.scene, this.world.collision);
    this.aquarium = new Aquarium(this.scene, this.world.collision);
    this.zoo.onRunAway = (i) => this.petRunsAway(i);
    this.playroom.onGame = (ev, idx) => {
      const nm = this.save.myPets[idx]?.name ?? '';
      const left = () => this.playroom.pets.filter((p) => !p.tagged && !p.hidden).length;
      if (ev === 'itPet') { this.audio.squeak(); toast(`🏃 ${nm} is IT! Everybody RUN! 🏃‍♀️💨`, 'gold', 1800); return; }
      if (ev === 'itYou') { this.audio.squeak(); toast(`😱 ${nm} tagged you! YOU'RE IT! Go tag someone!`, 'bad', 2200); return; }
      if (ev === 'tagEnd') {
        this.save.myPets.forEach((_, i) => this.cheerPet(i, 'fun', 30)); this.audio.celebrate();
        toast(idx < 0 ? '⏰ Time\'s up! You were IT at the end — so close! Play again? (G)' : `🏆 Time's up! ${this.save.myPets[idx]?.name} was IT at the end, so YOU WIN! 🎉`, idx < 0 ? 'good' : 'gold', 3200);
        return;
      }
      if (ev === 'tagged') { this.audio.squeak(); const n = this.playroom.pets.filter((p) => !p.tagged).length; toast(`🏃 Tagged ${nm}! ${n ? `${n} more to catch!` : ''}`, 'good', 1600); }
      else if (ev === 'found') { this.audio.squeak(); const n = this.playroom.pets.filter((p) => p.hidden).length; toast(`🙈 Found ${nm}! ${n ? `${n} still hiding…` : ''}`, 'good', 1800); }
      else if (ev === 'win') {
        this.audio.celebrate(); this.save.myPets.forEach((_, i) => this.cheerPet(i, 'fun', 30));
        this.effects.push(sparkleBurst(this.scene, this.pos.clone().setY(this.pos.y + 1.2), 0xffd34a, 30));
        toast('🏆 You did it! Everyone had SO much fun! 🎉', 'gold', 3000);
      } else toast(`⏰ Time's up! ${idx} ${idx === 1 ? 'pet was' : 'pets were'} too sneaky! Play again? (G)`, 'good', 2800);
      void left;
    };
    this.playroom.onFetch = (i) => {
      const q = this.save.myPets[i]; if (!q) return;
      this.cheerPet(i, 'fun', 30); this.audio.squeak();
      this.effects.push(sparkleBurst(this.scene, this.pos.clone().setY(this.pos.y + 1), 0xffe04a, 14));
      toast(`🎾 ${q.name} won the race and brought the ball back! Throw it again (T)!`, 'good', 2200);
    };
    this.zoo.onEscape = (i, pushed) => {
      const nm = this.save.myPets[i]?.name ?? 'A pet';
      if (pushed) toast(`🔓 Uh oh! ${nm} pushed the door open — you forgot to lock it!`, 'bad', 2800);
      else { toast(`😱 ${nm} ESCAPED! Run after it and press A to catch it!`, 'bad', 3200); this.audio.squeak(); }
    };
    // soft image-based lighting so fur, water and metal pick up natural reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    if (new URLSearchParams(location.search).get('quality') === 'low') this.setLowQuality();
    await progress(0.55, 'Waking up the animals…');
    this.cam = new OrbitCam(this.camera, this.renderer.domElement);
    const labels = $('labels');
    for (const s of OPP_SPAWNS) this.opps.push(new Opponent(s, this.scene, labels));
    HUMAN_SPAWNS.forEach((h, i) => this.humans.push(new Human(h, this.scene, labels, i)));
    for (const hu of this.humans) if (this.save.myPets.some((q) => q.species === 'human' && q.name === hu.spawn.name)) this.humanAway.set(hu, 1e12);
    // night-time dinosaurs start hidden; the game brings them out after dark
    for (let i = 0; i < DINOS.raptors + DINOS.trexes; i++) {
      const trex = i >= DINOS.raptors;
      const o = new Opponent({ species: trex ? 'trex' : 'raptor', tier: 'strong', x: 0, z: 30, name: trex ? '☠️ T. rex' : '☠️ Raptor', zone: 'forest', wander: 8, hunter: true }, this.scene, labels);
      o.state = 'gone'; o.rig.root.visible = false; o.respawnAt = 0;
      this.opps.push(o);
      this.dinos.push(o);
    }
    // Antarctica's night monsters: icy creatures that climb out of the freezing water
    for (let i = 0; i < 6; i++) {
      const o = new Opponent({ species: 'raptor', tier: 'strong', x: 0, z: 300, name: '🌊 Ice Monster', zone: 'antarctica', wander: 8, hunter: true, scale: 1.15 }, this.scene, labels);
      const ice = new THREE.Color(0x9fdcff);
      for (const m of o.rig.materials) m.color.lerp(ice, 0.75);
      o.state = 'gone'; o.rig.root.visible = false; o.respawnAt = 0;
      this.opps.push(o);
      this.iceMonsters.push(o);
    }
    for (const s of FOOD_SPAWNS) this.foods.push(makeFoodItem(s, this.world.collision.groundAt(s.x, s.z, 50, 0) + (s.x < -65 ? Math.max(0, -terrainHeight(s.x, s.z)) * 0 : 0), this.scene));
    // swamp food floats on the water surface if the ground is under water
    for (const f of this.foods) if (f.spawn.x < -WORLD.zoneEdge) { f.baseY = Math.max(f.baseY, 0.02); f.group.position.y = f.baseY; }
    for (const f of this.foods) {
      const b = buildBeam(f.spawn.rare);
      b.position.set(f.spawn.x, f.baseY, f.spawn.z); b.visible = false;
      this.scene.add(b); this.beams.push(b);
    }
    for (const m of MAP_SPOTS) {
      const g = buildMapScroll();
      const y = this.world.collision.groundAt(m.x, m.z, 50, 0);
      g.position.set(m.x, y, m.z);
      this.scene.add(g);
      this.mapItems.push({ zone: m.zone, group: g, baseY: y, x: m.x, z: m.z });
    }
    await progress(0.7, 'Building your home…');
    this.preview = new Preview();
    // helpers in the world
    this.targetRing = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTexture(), color: 0xffe36b, transparent: true, depthWrite: false }));
    this.targetRing.rotation.x = -Math.PI / 2; this.targetRing.visible = false; this.scene.add(this.targetRing);
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: 0xffc23a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
    this.aura.visible = false; this.scene.add(this.aura);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.55); shape.lineTo(0.42, 0); shape.lineTo(0.16, 0); shape.lineTo(0.16, -0.45); shape.lineTo(-0.16, -0.45); shape.lineTo(-0.16, 0); shape.lineTo(-0.42, 0); shape.lineTo(0, 0.55);
    const ag = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
    ag.rotateX(-Math.PI / 2);
    ag.scale(0.6, 0.6, 0.6);
    this.objArrow = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ color: 0xffd34a, transparent: true, opacity: 0.9, depthTest: false }));
    this.objArrow.renderOrder = 7; this.objArrow.visible = false; this.scene.add(this.objArrow);

    const saved = loadSave();
    if (saved) this.save = saved;
    else { const s = newSave(); s.girl = activeProfile().girl; s.bow = s.girl; this.save = s; }
    this.audio.settings = { ...this.save.audio };
    GAME_MODE.level = this.save.mode ?? 1;
    this.world.timeOfDay = this.save.timeOfDay ?? 0.08;
    this.interior = new Interior(this.scene, this.world.collision);
    this.buildLagoon();
    this.barn = new Barn(this.scene, this.world.collision, this.save.rescued);
    HUMAN_HOMES.forEach((home, i) => {
      const interior = new Interior(this.scene, this.world.collision, { x: 320 + i * 60, z: -400 });
      interior.build(home.tier, false, home.inside, home.theme);
      interior.group.visible = false;
      this.hhouses.push({ home, interior, door: humanHomeDoors[i] ?? null, open: false, raidDay: -1, front: { x: home.x, z: home.z - home.d / 2 - 1.4 } });
    });
    this.petOwner = new Human({ name: 'Owner', kind: 'farmer', route: [[0, 0], [1, 0]] }, this.scene, labels, 5);
    this.petOwner.active = false; this.petOwner.root.visible = false; this.petOwner.speedMult = 0.75;
    HUMAN_HOMES.forEach((home, i) => {
      const kind = HUMAN_SPAWNS.find((q) => q.name === home.owner)?.kind ?? (['cook', 'baker'] as const)[i % 2];
      const hh = new Human({ name: home.owner, kind, route: [[0, 0], [1, 0]] }, this.scene, labels, 6 + i);
      hh.active = false; hh.root.visible = false; hh.speedMult = 0.8; hh.label.style.display = 'none';
      this.homeHumans.push(hh); this.homeState.push('none');
    });
    void initFamilyBrain();
    void initVoice();
    for (const k of this.save.rescued) this.addPet(k as FarmKind, false);
    this.campfire = buildPot(true);
    const cf = Game.CAMPFIRE;
    this.campfire.position.set(cf.x, terrainHeight(cf.x, cf.z), cf.z);
    this.scene.add(this.campfire);
    this.world.collision.add({ kind: 'cyl', x: cf.x, z: cf.z, r: 0.85, top: 100, tall: true });
    this.setHome(this.liveTier);
    this.species = this.save.starter ? this.save.current : 'chicken';
    this.spawnPlayerRig();
    this.respawnAt(true);
    for (const s of SPECIES_ORDER) if (this.animalUnlocked(s)) this.notifiedUnlocks.add(s);
    this.refreshGates();
    await progress(0.85, 'Painting the animals…');
    for (const s of ['chicken', 'penguin', 'bunny'] as Species[]) this.thumb(s, this.save.equippedSkins[s]);
    await progress(1, 'Ready!');
    this.bindInput();
    this.lastFrame = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  // =========================================================================
  // Start screen
  // =========================================================================
  showStart() {
    $('screen-loading').hidden = true;
    const scr = $('screen-start');
    scr.hidden = false;
    const cards = $('starter-cards');
    cards.innerHTML = '';
    const sub = scr.querySelector('.start-sub') as HTMLElement;
    if (this.save.starter) {
      sub.textContent = 'Welcome back!';
      const s = this.save.current;
      const card = el('button', { class: 'starter', type: 'button' },
        el('img', { src: this.thumb(s, this.save.equippedSkins[s]), alt: PLAYER_ANIMALS[s].name }),
        el('h3', { text: 'Continue' }),
        el('p', { text: `Play as your ${PLAYER_ANIMALS[s].name}. You have ${this.save.coins} coins.` }),
        el('span', { class: 'pick', text: '▶ Play' }));
      card.addEventListener('click', () => this.beginPlay());
      cards.style.gridTemplateColumns = 'minmax(0, 320px)';
      cards.style.justifyContent = 'center';
      cards.append(card);
      setTimeout(() => card.focus(), 50);
    } else {
      sub.textContent = 'Pick your first animal. It\'s free!';
      cards.style.gridTemplateColumns = '';
      for (const s of ['chicken', 'penguin', 'bunny'] as Species[]) {
        const d = PLAYER_ANIMALS[s];
        const card = el('button', { class: 'starter', type: 'button' },
          el('img', { src: this.thumb(s, this.save.equippedSkins[s]), alt: d.name }),
          el('h3', { text: d.name }),
          el('p', { text: d.blurb }),
          el('span', { class: 'pick', text: `Choose ${d.name}` }));
        card.addEventListener('click', () => this.chooseStarter(s));
        cards.append(card);
      }
    }
  }

  chooseStarter(s: Species) {
    this.save.starter = s;
    this.save.owned = [s];
    this.save.current = s;
    this.persist();
    this.species = s;
    this.spawnPlayerRig();
    this.beginPlay();
  }

  beginPlay() {
    this.audio.start();
    $('screen-start').hidden = true;
    $('hud').hidden = false;
    this.started = true;
    this.respawnAt(true);
    this.hp = this.maxHp;
    $('controls').classList.toggle('collapsed', this.save.controlsCollapsed);
    this.updateObjective();
    banner(ZONE_NAMES.forest, ZONE_SUBS.forest);
    this.focusGame();
  }

  // =========================================================================
  // Input
  // =========================================================================
  private bindInput() {
    const gameKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3', 'Digit0', 'Numpad0', 'KeyC', 'KeyE', 'KeyB', 'KeyF', 'KeyL', 'KeyP', 'KeyA', 'KeyM', 'KeyT', 'KeyK', 'KeyG', 'KeyZ']);
    window.addEventListener('keydown', (e) => {
      const inField = (e.target as HTMLElement)?.tagName === 'INPUT';
      if (e.code === 'Escape') {
        if (!this.started) return;
        e.preventDefault();
        if (this.modal) { if (this.modal !== 'celebrate') this.closeModal(); }
        else this.openPause();
        return;
      }
      if (!this.started || this.modal) return; // menus swallow game input
      if (inField) return;
      if (gameKeys.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (this.respawning) return;
      switch (e.code) {
        case 'Space': this.tryJump(); break;
        case 'Digit1': case 'Numpad1': this.doAttack('scratch'); break;
        case 'Digit2': case 'Numpad2': this.doAttack('bite'); break;
        case 'Digit3': case 'Numpad3': this.doSpecial(); break;
        case 'Digit0': case 'Numpad0': this.doJumpAttack(); break;
        case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight': if (this.seat) this.standUp(); break;
        case 'KeyC': this.cam.reset(this.yaw); break;
        case 'KeyE': this.quickEat(); break;
        case 'KeyM': this.collectEggs(); break;
        case 'KeyT': this.throwBall(); break;
        case 'KeyK': this.keepRiddenHorse(); break;
        case 'KeyG': this.openPetGames(); break;
        case 'KeyP': if (this.swimming) this.catchFish(); else this.petNearest(); break;
        case 'KeyB': this.openBag(); break;
        case 'KeyF': { const t = this.talkTarget(); if (t) t(); else this.action?.fn(); break; }   // F talks to whoever's next to you
        case 'KeyA': this.action?.fn(); break;
        case 'KeyL':
          if (this.closeHumanDoor()) break;
          { const slot = this.nearFriendDoor(); if (slot >= 0 && this.friendHouses[slot]!.open) { this.setFriendDoor(slot, false); toast('🚪 Door closed'); break; } }
          if (this.barnDoorOpen && (this.inBarn || this.nearBarnDoor(7))) { this.setBarnDoor(false); toast('🚪 Barn door closed'); }
          else if (this.doorOpen && (this.indoors || this.nearDoorOutside(6))) { this.setDoorOpen(false); toast('🚪 Door closed'); }
          break;
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (this.started && !this.modal && gameKeys.has(e.code) && (e.target as HTMLElement)?.tagName !== 'INPUT') e.preventDefault();
    });
    window.addEventListener('blur', () => { this.keys.clear(); if (this.started && !this.modal) this.openPause(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.keys.clear(); if (this.started && !this.modal) this.openPause(); this.audio.suspend(); }
      else this.audio.resume();
    });
    // HUD buttons
    const hudBtn = (id: string, fn: () => void) => $(id).addEventListener('click', (e) => { (e.currentTarget as HTMLElement).blur(); this.audio.click(); fn(); });
    hudBtn('btn-shop', () => this.openShop());
    hudBtn('btn-animals', () => this.openAnimals());
    hudBtn('btn-travel', () => this.openTravel());
    hudBtn('btn-player', () => this.openPlayers());
    hudBtn('daytime-chip', () => this.toggleDayNight());
    $('mode-chip').hidden = GAME_MODE.level !== 2;
    hudBtn('btn-rescue-map', () => this.openRescueMap());
    hudBtn('btn-talk-owner', () => this.openOwnerChat());
    hudBtn('btn-talk-reply', () => this.replyToInvite());
    hudBtn('btn-start-player', () => this.openPlayers());
    this.showPlayerChip();
    hudBtn('btn-friends-home', () => this.friendsGoHome());
    hudBtn('btn-walk-all', () => this.openWalkPicker());
    hudBtn('btn-feed-all', () => this.feedAllPets());
    hudBtn('btn-protect', () => this.toggleProtect());
    hudBtn('btn-climb-hand', () => this.climbMove('hand'));
    hudBtn('btn-climb-foot', () => this.climbMove('foot'));
    hudBtn('btn-climb-down', () => this.endClimb());
    {
      let down: { x: number; y: number } | null = null;
      this.renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
      this.renderer.domElement.addEventListener('pointerup', (e) => { if (this.climb && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) this.climbTap(e.clientX, e.clientY); down = null; });
    }
    $('coins').addEventListener('click', () => { if (this.started && !this.modal && !this.captive) this.openSendCoins(); });
    hudBtn('btn-aquarium', () => { if (this.inAquarium) this.leaveAquarium(); else this.enterAquarium(); });
    hudBtn('btn-play-all', () => { if (this.inPlayroom) this.leavePlayroom(); else this.enterPlayroom(); });
    hudBtn('btn-bag', () => this.openBag());
    $('btn-action').addEventListener('click', (e) => { (e.currentTarget as HTMLElement).blur(); this.action?.fn(); this.focusGame(); });
    hudBtn('btn-pause', () => this.openPause());
    $('controls-toggle').addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      const c = $('controls');
      c.classList.toggle('collapsed');
      this.save.controlsCollapsed = c.classList.contains('collapsed');
      $('controls-toggle').setAttribute('aria-expanded', String(!this.save.controlsCollapsed));
      this.persist();
      this.focusGame();
    });
  }

  focusGame() {
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.renderer.domElement.focus({ preventScroll: true });
  }

  // =========================================================================
  // Player
  // =========================================================================
  get def() { return PLAYER_ANIMALS[this.species]; }
  get maxHp() { return this.def.health; }

  spawnPlayerRig() {
    const yaw = this.yaw;
    if (this.rig) disposeRig(this.rig);
    const skin = skinById(this.save.equippedSkins[this.species]) ?? SKINS.find((k) => k.species === this.species)!;
    this.rig = buildPlayerAnimal(this.species, skin, this.save.girl);
    if (this.save.girl && this.save.bow) addBow(this.rig);
    this.scene.add(this.rig.root);
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = yaw;
    this.cam.setBaseDistance(4.2 + this.rig.height * 2.2);
    if (this.interior) this.buildFamily();
  }

  respawnAt(instant: boolean) {
    const s = WORLD.spawn;
    this.pos.set(s.x, terrainHeight(s.x, s.z), s.z);
    this.vy = 0; this.yaw = 0; this.grounded = true;
    this.groundY = this.pos.y;
    this.cam.reset(this.yaw, instant);
    this.cam.update(1, this.pos.clone().setY(this.pos.y + 0.6), this.world.collision);
  }

  tryJump() {
    if (this.seat) { this.standUp(); return; }
    if (this.swimming) { if (!this.diveHint) { this.diveHint = true; toast('🫧 Hold SPACE to dive down, hold Z to swim back up!', 'good', 2600); } return; }
    const capT = this.captive;
    if (capT?.onWalk && capT.trickUntil > this.now && this.grounded) {
      capT.trickUntil = 0;
      this.hp = Math.min(this.maxHp, this.hp + 15);
      this.effects.push(sparkleBurst(this.scene, this.pos.clone().setY(this.pos.y + 1), 0xff7ab0, 16));
      setTimeout(() => toast(`🧑 ${capT.owner}: "Good pet! Here's a treat!" 🦴 +15 ❤️`, 'good', 2400), 300);
    }
    if (this.grounded || this.now - this.lastGroundedAt < 0.12) {
      this.vy = PHYSICS.jumpSpeed * this.def.jumpMult * (this.riding ? 1.15 : 1);
      this.grounded = false;
      this.lastGroundedAt = -99;
      this.audio.jump();
    }
  }

  swimming = false;
  private wasSwimming = false;
  private coldToastAt = -99;
  private lagoonFish: { mesh: THREE.Group; a: number; r: number; speed: number; y: number; golden: boolean; respawnAt: number }[] = [];
  /** The lagoon's water and the fish swimming in it. */
  private buildLagoon() {
    const L = FISH_LAGOON;
    const water = new THREE.Mesh(new THREE.CircleGeometry(L.r - 0.6, 40), new THREE.MeshStandardMaterial({ color: 0x3a8ac0, transparent: true, opacity: 0.62, roughness: 0.1, metalness: 0.2, depthWrite: false }));
    water.rotation.x = -Math.PI / 2; water.position.set(L.x, -0.05, L.z); water.renderOrder = 2;
    this.scene.add(water);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.7), new THREE.MeshBasicMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d')!; g.fillStyle = '#eef6ff'; g.beginPath(); g.roundRect(4, 4, 504, 120, 26); g.fill(); g.fillStyle = '#245a8a'; g.font = 'bold 54px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🐟 Fish Lagoon 🐧', 256, 68); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })(), transparent: true }));
    const sx = L.x - L.r - 1.2, sz = L.z;
    sign.position.set(sx, terrainHeight(sx, sz) + 1.6, sz); sign.rotation.y = -Math.PI / 2; this.scene.add(sign);
    for (let i = 0; i < 8; i++) {
      const golden = i === 7;
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: golden ? 0xffd34a : [0xf08a3a, 0xc8d4dc, 0x7ab0e0][i % 3], emissive: golden ? 0x6a4a00 : 0x000000, roughness: 0.4, metalness: 0.2 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat); body.scale.set(0.55, 0.7, 1.4); g.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 4), mat); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.3; tail.scale.set(0.3, 1, 1); g.add(tail);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), new THREE.MeshBasicMaterial({ color: 0x111111 })); eye.position.set(0.07, 0.04, 0.14); g.add(eye);
      this.scene.add(g);
      this.lagoonFish.push({ mesh: g, a: Math.random() * 6.28, r: 2 + Math.random() * (L.r - 5), speed: (0.4 + Math.random() * 0.5) * (i % 2 ? 1 : -1), y: -0.55 - Math.random() * 0.4, golden, respawnAt: 0 });
    }
  }
  /** Catch a pet that escaped from its habitat and put it back. */
  catchEscaped(i: number) {
    const q = this.save.myPets[i]; const a = this.zoo.animals[i];
    if (a) this.effects.push(sparkleBurst(this.scene, new THREE.Vector3(a.x, a.rig.height + 0.4, a.z), 0xff6a9a, 16));
    this.zoo.catchBack(i); this.audio.squeak();
    toast(`🤗 Got you, ${q?.name ?? 'silly'}! Back home you go. Now press the red button to lock the door! 🔒`, 'good', 2800);
  }
  diveY = -0.42;
  wasInPit = false;
  pitHint = false;
  trampHint = false;
  diveHint = false;
  underwater = false;
  /** Every animal can swim now! (Penguins and otters are just the fastest.) */
  get canSwim() { return !this.riding; }
  get fastSwimmer() { return this.species === 'penguin' || this.species === 'otter'; }
  /** Fish out in the open sea: a little school that swims near you while you swim. */
  private seaFish: { mesh: THREE.Group; a: number; r: number; speed: number; y: number; golden: boolean; respawnAt: number }[] = [];
  private seaAnchor: { x: number; z: number } | null = null;
  private updateSeaFish(dt: number) {
    if (!this.seaFish.length) {
      for (let i = 0; i < 9; i++) {
        const golden = i === 8, g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: golden ? 0xffd34a : [0xf08a3a, 0xc8d4dc, 0x7ab0e0, 0xe86a8a][i % 4], emissive: golden ? 0x6a4a00 : 0x000000, roughness: 0.4, metalness: 0.2 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), mat); body.scale.set(0.55, 0.7, 1.4); g.add(body);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 4), mat); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.32; tail.scale.set(0.3, 1, 1); g.add(tail);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 5), new THREE.MeshBasicMaterial({ color: 0x111111 })); eye.position.set(0.08, 0.04, 0.15); g.add(eye);
        g.visible = false; this.scene.add(g);
        this.seaFish.push({ mesh: g, a: Math.random() * 6.28, r: 2 + Math.random() * 5, speed: (0.5 + Math.random() * 0.6) * (i % 2 ? 1 : -1), y: -0.6 - Math.random() * 3.2, golden, respawnAt: 0 });
      }
    }
    const atSea = this.swimming && Math.hypot(this.pos.x - FISH_LAGOON.x, this.pos.z - FISH_LAGOON.z) > FISH_LAGOON.r;
    this.updateWildSea(dt, atSea && !!this.seaAnchor);
    if (!atSea) { if (!this.swimming) this.seaAnchor = null; for (const f of this.seaFish) f.mesh.visible = false; return; }
    // a school of fish shows up just ahead of you, and a new one when you swim far away
    if (!this.seaAnchor || Math.hypot(this.seaAnchor.x - this.pos.x, this.seaAnchor.z - this.pos.z) > 20) {
      const ax = this.pos.x + Math.sin(this.yaw) * 7, az = this.pos.z + Math.cos(this.yaw) * 7;
      this.seaAnchor = terrainHeight(ax, az) < -0.5 ? { x: ax, z: az } : { x: this.pos.x, z: this.pos.z };
      for (const f of this.seaFish) { f.respawnAt = 0; f.a = Math.random() * 6.28; }
      this.shuffleWildSea();
    }
    const A = this.seaAnchor;
    for (const f of this.seaFish) {
      if (f.respawnAt && this.now >= f.respawnAt) f.respawnAt = 0;
      f.a += (f.speed / f.r) * dt * 2;
      const x = A.x + Math.cos(f.a) * f.r, z = A.z + Math.sin(f.a) * f.r;
      f.mesh.visible = !f.respawnAt && terrainHeight(x, z) < -0.5;
      f.mesh.position.set(x, f.y + Math.sin(this.realTime * 3 + f.r) * 0.05, z);
      f.mesh.rotation.y = Math.atan2(-Math.sin(f.a) * Math.sign(f.speed), Math.cos(f.a) * Math.sign(f.speed));
    }
  }
  private updateLagoon(dt: number) {
    this.updateSeaFish(dt);
    const on = this.pos.z > 200 && Math.hypot(this.pos.x - FISH_LAGOON.x, this.pos.z - FISH_LAGOON.z) < 60;
    for (const f of this.lagoonFish) {
      if (f.respawnAt && this.now >= f.respawnAt) { f.respawnAt = 0; f.r = 2 + Math.random() * (FISH_LAGOON.r - 5); }
      f.mesh.visible = on && !f.respawnAt;
      if (!f.mesh.visible) continue;
      f.a += (f.speed / f.r) * dt * 2;
      const x = FISH_LAGOON.x + Math.cos(f.a) * f.r, z = FISH_LAGOON.z + Math.sin(f.a) * f.r;
      f.mesh.position.set(x, f.y + Math.sin(this.realTime * 3 + f.r) * 0.05, z);
      f.mesh.rotation.y = Math.atan2(-Math.sin(f.a) * Math.sign(f.speed), Math.cos(f.a) * Math.sign(f.speed));
    }
  }
  private nearestFish() {
    let best: typeof this.lagoonFish[number] | null = null, bd = 1.6;
    for (const f of [...this.lagoonFish, ...this.seaFish]) { if (!f.mesh.visible || Math.abs(f.mesh.position.y - this.pos.y) > 2) continue; const d = Math.hypot(f.mesh.position.x - this.pos.x, f.mesh.position.z - this.pos.z); if (d < bd) { bd = d; best = f; } }
    return best;
  }
  /** Who you'd talk to with F: family, friends or pets right next to you (or your owner if you're caught). */
  talkTarget(): (() => void) | null {
    if (this.respawning || this.modal) return null;
    if (this.captive) return () => this.openOwnerChat();
    const d = (x: number, z: number) => Math.hypot(this.pos.x - x, this.pos.z - z);
    const fam = this.family.filter((f) => !f.caged && !f.asleep && (f.following || this.indoors) && d(f.x, f.z) < 2.2).sort((a, b) => d(a.x, a.z) - d(b.x, b.z))[0];
    const fr = this.pets.filter((p) => !p.caged && p.rig.root.visible && d(p.x, p.z) < 2.2).sort((a, b) => d(a.x, a.z) - d(b.x, b.z))[0];
    if (fam && (!fr || d(fam.x, fam.z) <= d(fr.x, fr.z))) return () => this.openFamilyChat(fam.name);
    if (fr) return () => this.openFriendChat(fr.name);
    if (this.walker && d(this.walker.x, this.walker.z) < 2.2) { const i = this.walker.idx; return () => this.openMyPetChat(i); }
    if (this.indoors && this.interior.petRoom) {
      const i = this.interior.petPens.findIndex((pen, k) => this.save.myPets[k] && this.walker?.idx !== k && d(pen.front.x, pen.front.z) < 1.6);
      if (i >= 0) return () => this.openMyPetChat(i);
    }
    if (this.inPlayroom) { const pp = this.playroom.nearestPet(this.pos.x, this.pos.z, 2.2); if (pp) { const i = pp.idx; return () => this.openMyPetChat(i); } }
    if (this.inZoo) { const h = this.zoo.habitatAt(this.pos.x, this.pos.z); const i = h >= 0 ? h : this.zooPenNear(); if (i >= 0 && this.save.myPets[i] && this.walker?.idx !== i) return () => this.openMyPetChat(i); }
    return null;
  }
  /** Press P next to one of your pets (or a rescued friend) to give it a pat! */
  petNearest() {
    if (this.respawning) return;
    const hearts = (x: number, y: number, z: number) => this.effects.push(sparkleBurst(this.scene, new THREE.Vector3(x, y, z), 0xff6a9a, 16));
    const lines = ['loves it! 💕', 'wiggles happily! 💗', 'does a happy hop! 💞', 'snuggles up to you! 🥰'];
    const say = lines[Math.floor(Math.random() * lines.length)];
    if (this.inPlayroom) {
      const pp = this.playroom.nearestPet(this.pos.x, this.pos.z);
      if (pp) { pp.hop = 1.2; this.cheerPet(pp.idx, 'fun', 20); hearts(pp.x, pp.rig.height + 0.4, pp.z); this.audio.squeak(); toast(`💕 You petted ${this.save.myPets[pp.idx]?.name}! It ${say}`, 'good', 2000); return; }
      toast('💕 Walk up to a pet and press P to pet it!', '', 1600); return;
    }
    // a pet on a walk
    const w = this.walker;
    if (w && Math.hypot(w.x - this.pos.x, w.z - this.pos.z) < 2.2) {
      w.hop = 1.2; hearts(w.x, w.rig.root.position.y + w.rig.height + 0.3, w.z); this.audio.squeak();
      toast(`💕 You petted ${this.save.myPets[w.idx]?.name}! It ${say}`, 'good', 2200); return;
    }
    // a pet in its pen
    const I = this.interior;
    if (this.indoors && I.petRoom) {
      const i = I.petPens.findIndex((pen, k) => this.save.myPets[k] && this.walker?.idx !== k && Math.hypot(pen.front.x - this.pos.x, pen.front.z - this.pos.z) < 1.6);
      if (i >= 0) {
        const pen = I.petPens[i]; this.petHop[i] = 1.2; hearts(pen.x, I.petRoom.y + 1.2, pen.z); this.audio.squeak();
        toast(`💕 You petted ${this.save.myPets[i].name}! It ${say}`, 'good', 2200); return;
      }
    }
    if (this.inZoo) {
      const h = this.zoo.habitatAt(this.pos.x, this.pos.z), an0 = h >= 0 ? this.zoo.animals[h] : null, an = an0 && !an0.escaped && !an0.sneaking ? an0 : null;
      if (an && Math.hypot(an.x - this.pos.x, an.z - this.pos.z) < 2.5) { this.cheerPet(h, 'fun', 30); this.cuddle = { a: an, until: this.now + 1.6 }; an.busy = true; hearts(an.x, an.rig.height + 0.4, an.z); this.audio.squeak(); toast(`💕 You petted ${this.save.myPets[h].name}! It ${say}`, 'good', 2200); return; }
      const i = this.zooPenNear();
      if (i >= 0 && this.save.myPets[i]) { const p = this.zoo.pens[i]; hearts(p.x - p.side * 2, 1.8, p.z); this.audio.squeak(); toast(`💕 You waved and blew a kiss to ${this.save.myPets[i].name}! It ${say}`, 'good', 2200); return; }
    }
    // a rescued friend
    const fr = this.pets.filter((p) => p.rig.root.visible && !p.caged && Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 2.2).sort((a, b) => Math.hypot(a.x - this.pos.x, a.z - this.pos.z) - Math.hypot(b.x - this.pos.x, b.z - this.pos.z))[0];
    if (fr) {
      fr.trick = { kind: 'jump', until: this.realTime + 1.2, baseY: fr.y }; hearts(fr.x, fr.y + fr.rig.height + 0.3, fr.z); this.audio.squeak();
      this.petSay(fr, 'Hehe! That tickles! 💕', 2.5); return;
    }
    toast('💕 Walk up to one of your pets or friends and press P to pet them!', '', 2000);
  }
  /** Press P next to a fish (while swimming as a penguin) to catch it! */
  catchFish() {
    if (!this.swimming) { if (this.pos.z > 200) toast('🐟 Jump into the water and swim, then press P next to a fish!', '', 2400); return; }
    const f = this.nearestFish();
    if (!f) { toast('🐟 Swim closer to a fish, then press P!', '', 1600); return; }
    if (this.bagTotal() >= BAG_LIMIT) { toast('🎒 Your bag is full! Eat something or unpack it at home.', 'bad', 2400); return; }
    const type: FoodType = f.golden ? 'goldenFish' : 'fish';
    this.save.bag[type] = (this.save.bag[type] ?? 0) + 1;
    f.respawnAt = this.now + (this.seaFish.includes(f) ? 8 : 14);
    this.effects.push(sparkleBurst(this.scene, f.mesh.position.clone().setY(0.2), f.golden ? 0xffd34a : 0xbfe8ff, 16));
    this.audio.food(); this.persist();
    toast(f.golden ? "✨🐟 WOW! You caught a GOLDEN fish! It's in your bag." : "🐟 Gotcha! You caught a fish! It's in your bag.", 'good', 2400);
  }
  /** Riding along a path (down the slide!). */
  private scripted: { pts: THREE.Vector3[]; times: number[]; t: number } | null = null;
  rideSlide() {
    const S = TOYS.slide;
    const pts = [new THREE.Vector3(S.x, 0, S.z - 4.9), new THREE.Vector3(S.x, 3.65, S.z - 4.3), new THREE.Vector3(S.x, 3.65, S.z - 2.0), new THREE.Vector3(S.x, 3.5, S.z - 1.5), new THREE.Vector3(S.x, 0.2, S.z + 4.6), new THREE.Vector3(S.x, 0, S.z + 6)];
    this.scripted = { pts, times: [0, 1.3, 1.7, 1.8, 2.6, 2.9], t: 0 };
    this.audio.jump();
    this.later(1.8, () => { this.audio.boing(); toast('🛝 Wheeeeee!', 'good', 1400); });
    this.playroom.petsFollowPath(pts, 3.2, 2);
  }
  private updateScripted(dt: number) {
    const sc = this.scripted!; sc.t += dt;
    const T = sc.times, i = Math.max(0, Math.min(T.length - 2, T.findIndex((x, k) => k < T.length - 1 && sc.t >= x && sc.t < T[k + 1])));
    const k = Math.min(1, (sc.t - T[i]) / (T[i + 1] - T[i]));
    const a = sc.pts[i], b = sc.pts[i + 1];
    this.pos.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
    if (Math.hypot(b.x - a.x, b.z - a.z) > 0.1) this.yaw = Math.atan2(b.x - a.x, b.z - a.z);
    this.vy = 0; this.grounded = true; this.groundY = this.pos.y; this.speedNow = 3;
    if (sc.t >= T[T.length - 1]) { this.scripted = null; this.pos.y = 0; }
  }
  // ---- rock climbing! ---------------------------------------------------------------
  climb: { limbs: number[]; sel: number | null; rung: boolean } | null = null;
  private climbMarkers: THREE.Sprite[] = [];
  startClimb() {
    if (this.climb) return;
    if (this.playroom.game) this.playroom.endGame();
    this.climb = { limbs: [9, 10, 1, 2], sel: null, rung: false };   // left hand, right hand, left foot, right foot
    if (!this.climbMarkers.length) for (const e of ['✋', '✋', '🦶', '🦶']) {
      const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d')!;
      x.fillStyle = 'rgba(255,255,255,0.85)'; x.beginPath(); x.arc(48, 48, 44, 0, 7); x.fill(); x.font = '60px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, 48, 54);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.setScalar(0.45); sp.renderOrder = 5; this.scene.add(sp); this.climbMarkers.push(sp);
    }
    for (const m of this.climbMarkers) m.visible = true;
    { const b0 = this.climbBody(); this.pos.set(TOYS.wall.x + 0.75, Math.max(0, b0.y - 0.75), b0.z); }
    $('climb-panel').hidden = false;
    this.cam.reset(-Math.PI / 2, true); this.cam.dist = 8; this.cam.pitch = 0.1;
    document.body.classList.add('climbing');
    this.climbChanged();
    toast('🧗 Climb to the top and ring the bell! 🔔', 'gold', 1800);
  }
  endClimb() {
    if (!this.climb) return;
    this.climb = null; this.playroom.climbY = null;
    for (const h of this.playroom.holds) (h.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
    for (const m of this.climbMarkers) m.visible = false;
    $('climb-panel').hidden = true;
    document.body.classList.remove('climbing');
    this.pos.set(TOYS.wall.x + 1.6, 0, TOYS.wall.z); this.vy = 0; this.grounded = true; this.groundY = 0;
  }
  private climbBody() {
    const H = this.playroom.holds, L = this.climb!.limbs;
    let x = 0, y = 0, z = 0; for (const i of L) { x += H[i].x; y += H[i].y; z += H[i].z; }
    return { x: x / 4, y: y / 4, z: z / 4 };
  }
  private climbChanged() {
    const c = this.climb!, H = this.playroom.holds;
    c.limbs.forEach((hi, k) => this.climbMarkers[k].position.set(H[hi].x + 0.3, H[hi].y + 0.05, H[hi].z));
    for (let i = 0; i < H.length; i++) (H[i].mesh.material as THREE.MeshStandardMaterial).emissive.setHex(i === c.sel ? 0xffee66 : 0x000000);
    const b = this.climbBody();
    this.playroom.climbY = Math.max(0, b.y - 0.6);
    this.setText('climb-tip', c.sel === null ? 'Tap a rock, then press ✋ Hand or 🦶 Foot!' : 'Great! Now press ✋ Hand or 🦶 Foot.');
  }
  /** Move your closest hand (or foot) onto the rock you tapped. */
  climbMove(kind: 'hand' | 'foot') {
    const c = this.climb; if (!c) return;
    if (c.sel === null) { toast('👆 Tap a rock first!', '', 1400); return; }
    const H = this.playroom.holds, s = H[c.sel];
    if (c.limbs.includes(c.sel)) { toast('✋ Something is already holding that rock! Pick another one.', '', 1800); return; }
    const opts = kind === 'hand' ? [0, 1] : [2, 3];
    const limb = opts.sort((a, b) => Math.hypot(H[c.limbs[a]].y - s.y, H[c.limbs[a]].z - s.z) - Math.hypot(H[c.limbs[b]].y - s.y, H[c.limbs[b]].z - s.z))[0];
    const body = this.climbBody();
    const reach = Math.hypot(s.y - body.y, s.z - body.z);
    if (reach > 2.0) { toast('😅 Too far! Move your other hands and feet closer first.', 'bad', 2000); return; }
    if (kind === 'foot' && s.y > body.y + 0.3) { toast('🦶 Your foot can\'t go that high! Use a hand for that rock.', 'bad', 2000); return; }
    if (kind === 'hand' && s.y < body.y - 0.9) { toast('✋ That rock is low — use a foot for it!', 'bad', 2000); return; }
    c.limbs[limb] = c.sel; c.sel = null;
    this.audio.click();
    this.climbChanged();
    // reached the top? ring the bell!
    if (!c.rung && kind === 'hand' && s.y >= TOYS.wall.top - 0.1) {
      c.rung = true;
      this.playroom.bellSwing = 1; this.audio.bell();
      this.effects.push(sparkleBurst(this.scene, this.playroom.bell.getWorldPosition(new THREE.Vector3()), 0xffd34a, 40));
      this.save.coins += 5; this.persist();
      toast('🔔 DING DONG! You climbed all the way to the top! +5 coins 🏆', 'gold', 3400);
      this.later(3.5, () => this.endClimb());
    }
  }
  private climbTap(cx: number, cy: number) {
    const c = this.climb; if (!c) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
    const H = this.playroom.holds;
    const hit = ray.intersectObjects(H.map((h) => h.mesh), false)[0];
    let idx = hit ? H.findIndex((h) => h.mesh === hit.object) : -1;
    if (idx < 0) {   // forgiving taps: the rock closest to where you tapped on the screen
      let bd = 0.08;
      H.forEach((h, i) => { const v = new THREE.Vector3(h.x, h.y, h.z).project(this.camera); const d = Math.hypot(v.x - ndc.x, v.y - ndc.y); if (d < bd) { bd = d; idx = i; } });
    }
    if (idx >= 0) { c.sel = idx; this.audio.click(); this.climbChanged(); }
  }
  private updatePlayer(dt: number) {
    const def = this.def;
    const showMe = (pitch: number, speed: number) => {
      this.rig.root.rotation.order = 'YXZ';
      this.rig.root.position.copy(this.pos); this.rig.root.rotation.y = this.yaw; this.rig.root.rotation.x = pitch;
      animateRig(this.rig, dt, { speed, airborne: false, attack: null, attackT: 0, windup: 0 });
    };
    if (this.scripted) {
      this.updateScripted(dt);
      const sc = this.scripted as { pts: THREE.Vector3[]; times: number[]; t: number } | null;
      const sliding = !!sc && sc.t > sc.times[3] && sc.t < sc.times[4];
      const climbingUp = !!sc && sc.t < sc.times[1];
      showMe(sliding ? 0.45 : climbingUp ? -1.1 : 0, sliding ? 0 : 3);
      return;
    }
    if (this.climb) {
      const b = this.climbBody();
      const ty = Math.max(0, b.y - 0.75);
      // glide smoothly up (or down) the wall to where your hands and feet are
      const y = this.pos.y + (ty - this.pos.y) * Math.min(1, dt * 4);
      const moving = Math.abs(ty - this.pos.y) > 0.03 || Math.abs(b.z - this.pos.z) > 0.03;
      this.pos.set(TOYS.wall.x + 0.75, y, this.pos.z + (b.z - this.pos.z) * Math.min(1, dt * 4));
      this.yaw = -Math.PI / 2; this.vy = 0; this.grounded = true; this.groundY = this.pos.y; this.speedNow = 0;
      showMe(-1.15, moving ? 2.5 : 0);   // nose up, paws on the wall
      return;
    }
    // ---- horizontal movement relative to camera
    const { f, r } = this.cam.basis();
    const mv = new THREE.Vector3();
    if (this.seat && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some((k) => this.keys.has(k))) this.standUp();
    if (!this.respawning && !this.seat) {
      if (this.keys.has('ArrowUp')) mv.add(f);
      if (this.keys.has('ArrowDown')) mv.sub(f);
      if (this.keys.has('ArrowRight')) mv.add(r);
      if (this.keys.has('ArrowLeft')) mv.sub(r);
    }
    let speed = def.speed;
    if (this.grounded && isMud(this.pos.x, this.pos.z)) speed *= def.mudSpeedMult;
    if (this.grounded && this.pos.z > 200 && this.pos.z < 500) speed *= def.iceSpeedMult ?? 1;
    if (this.swimming) speed *= this.fastSwimmer ? 2.1 : 1.3;   // penguins and otters zoom through the water
    if (GAME_MODE.level === 2) speed *= MODE2.playerSpeed;
    if (this.riding) speed = Math.max(speed, 10.5);   // gallop!
    if (this.attack?.kind === 'special') speed *= 0.3;
    const moving = mv.lengthSq() > 0;
    if (moving) {
      mv.normalize();
      const targetYaw = Math.atan2(mv.x, mv.z);
      let d = targetYaw - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, PHYSICS.turnSpeed * dt);
      if (this.save.cameraFollow && !this.respawning) this.cam.followBehind(dt, this.yaw);
    }
    const vel = mv.multiplyScalar(speed);
    if (this.lunge) {
      vel.addScaledVector(this.lunge.dir, 7);
      this.lunge.time -= dt;
      if (this.lunge.time <= 0) this.lunge = null;
    }
    const prevX = this.pos.x, prevZ = this.pos.z;
    const p = { x: this.pos.x + vel.x * dt, z: this.pos.z + vel.z * dt };
    // keep apart from living opponents
    for (const o of this.opps) {
      if (!o.alive) continue;
      const dx = p.x - o.pos.x, dz = p.z - o.pos.z;
      const d = Math.hypot(dx, dz), min = PHYSICS.playerRadius + o.radius * 0.8;
      if (d < min && d > 1e-4 && Math.abs(this.pos.y - o.pos.y) < 1.2) { p.x = o.pos.x + (dx / d) * min; p.z = o.pos.z + (dz / d) * min; }
    }
    for (const hu of this.humans) {
      const dx = p.x - hu.pos.x, dz = p.z - hu.pos.z;
      const d = Math.hypot(dx, dz), min = PHYSICS.playerRadius + hu.radius;
      if (d < min && d > 1e-4 && Math.abs(this.pos.y - hu.pos.y) < 1.5) { p.x = hu.pos.x + (dx / d) * min; p.z = hu.pos.z + (dz / d) * min; }
    }
    this.world.collision.resolve(p, this.pos.y, PHYSICS.playerRadius, PHYSICS.stepUp);
    let B = regionBounds(this.pos.x, this.pos.z);
    if (this.canSwim && this.pos.z > 200 && !this.captive) B = { minX: B.minX - 45, maxX: B.maxX + 45, minZ: B.minZ - 45, maxZ: B.maxZ + 45 }; // the open sea!
    const capL = this.captive;
    if (capL?.onWalk) {
      const o = this.petOwner.pos, ldx = p.x - o.x, ldz = p.z - o.z, ld = Math.hypot(ldx, ldz);
      if (ld > 3.2) { p.x = o.x + (ldx / ld) * 3.2; p.z = o.z + (ldz / ld) * 3.2; }
    }
    p.x = THREE.MathUtils.clamp(p.x, B.minX + 3, B.maxX - 3);
    p.z = THREE.MathUtils.clamp(p.z, B.minZ + 3, B.maxZ - 3);
    this.pos.x = p.x; this.pos.z = p.z;
    this.speedNow = Math.hypot(this.pos.x - prevX, this.pos.z - prevZ) / Math.max(dt, 1e-4);
    this.dustTimer -= dt;
    if (this.grounded && this.speedNow > 5 && this.dustTimer <= 0) { this.dustTimer = 0.28; this.dust(2); }

    // ---- vertical
    let g = PHYSICS.gravity;
    if (this.vy < 0) g *= def.fallGravityMult;
    this.vy -= g * dt;
    if (def.fallGravityMult < 1 && this.vy < -4.5) this.vy = -4.5; // chicken flutters down
    this.pos.y += this.vy * dt;
    const ground = this.world.collision.groundAt(this.pos.x, this.pos.z, this.pos.y, PHYSICS.stepUp, PHYSICS.playerRadius);
    this.groundY = ground;
    if (this.pos.y <= ground) {
      if (!this.grounded && this.vy < -6) { this.audio.land(); this.dust(10); }
      if (this.jumpAttack) this.landJumpAttack();
      this.pos.y = ground; this.vy = 0;
      this.grounded = true;
    } else if (this.grounded && this.vy <= 0 && this.pos.y - ground < 0.45) {
      this.pos.y = ground; this.vy = 0; // follow slopes downhill
    } else this.grounded = false;
    if (this.seat) { this.pos.set(this.seat.sitX, this.seat.sitY, this.seat.sitZ); this.vy = 0; this.grounded = true; this.groundY = this.seat.sitY; this.yaw = this.seat.yaw; }
    // ---- the Fish Lagoon: penguins swim, everyone else finds it far too cold
    this.swimming = false;
    const inLagoon = this.pos.z > 200 && Math.hypot(this.pos.x - FISH_LAGOON.x, this.pos.z - FISH_LAGOON.z) < FISH_LAGOON.r - 1.6;
    const inSea = this.pos.z > 200 && terrainHeight(this.pos.x, this.pos.z) < -0.5;   // the icy sea, the iceberg pool, the jungle sea and waterfall pool
    if (inSea && this.canSwim && !inLagoon) {
      if (this.pos.y < this.diveY) { this.pos.y = this.diveY; this.vy = Math.max(this.vy, 0); this.grounded = true; this.groundY = this.diveY; }
      this.swimming = this.pos.y < -0.2;
      if (this.swimming && !this.wasSwimming) { this.audio.splash(); this.effects.push(sparkleBurst(this.scene, this.pos.clone().setY(0), 0xbfe8ff, 16)); toast(this.pos.z > 500 ? '🌊 Splash! You\'re swimming! Hold SPACE to dive, Z to come up, P to catch fish!' : '🌊 Splash! You\'re swimming in the icy sea! Hold SPACE to dive, Z to come up, P to catch fish!', 'good', 3000); }
    } else if (inLagoon) {
      if (this.canSwim) {
        if (this.pos.y < this.diveY) { this.pos.y = this.diveY; this.vy = Math.max(this.vy, 0); this.grounded = true; this.groundY = this.diveY; }
        this.swimming = this.pos.y < -0.2;
        if (this.swimming && !this.wasSwimming) { this.audio.splash(); this.effects.push(sparkleBurst(this.scene, this.pos.clone().setY(0), 0xbfe8ff, 16)); toast('🐧🌊 Splash! Swim to the fish and press P to catch them!', 'good', 3000); }
      } else {
        this.pos.x = prevX; this.pos.z = prevZ;
        if (this.now - this.coldToastAt > 4) { this.coldToastAt = this.now; toast('🥶 Brrr! The water is freezing! Only penguins and otters can swim in the icy water.', 'bad', 2600); }
      }
    }
    // diving: hold Space to swim down, Z to swim back up
    if (this.swimming) {
      const floor = Math.max(-4.6, terrainHeight(this.pos.x, this.pos.z) + 0.35);
      if (this.keys.has('Space')) this.diveY = Math.max(floor, this.diveY - 2.6 * dt);
      else if (this.keys.has('KeyZ')) this.diveY = Math.min(-0.42, this.diveY + 3.2 * dt);
      this.diveY = Math.max(this.diveY, Math.min(-0.42, floor));
      if (this.diveY < -1 && Math.random() < dt * 4) this.effects.push(sparkleBurst(this.scene, this.pos.clone().setY(this.pos.y + 0.6), 0xdff4ff, 3));
    } else this.diveY = -0.42;
    this.underwater = this.swimming && this.pos.y < -1.1;
    this.wasSwimming = this.swimming;
    // the Play Room: wade in the ball pit, bounce on the trampoline
    if (this.inPlayroom) {
      const T = TOYS;
      const inPit = Math.hypot(this.pos.x - T.pit.x, this.pos.z - T.pit.z) < T.pit.r - 0.3;
      if (inPit && this.pos.y < 0.15) { this.pos.y = -0.45; this.vy = Math.max(0, this.vy); this.grounded = true; this.groundY = -0.45; }
      if (inPit && !this.wasInPit) { this.audio.squeak(); this.effects.push(sparkleBurst(this.scene, this.pos.clone().setY(0.4), 0xff8ad8, 18)); if (!this.pitHint) { this.pitHint = true; toast('🟡🔴🔵 Splash! You\'re in the ball pit! Jump around!', 'good', 2200); } }
      this.wasInPit = inPit;
      const onTramp = Math.hypot(this.pos.x - T.tramp.x, this.pos.z - T.tramp.z) < T.tramp.r - 0.2;
      if (onTramp && this.grounded && this.pos.y > 0.3) {
        this.vy = this.keys.has('Space') ? 17 : 12.5; this.grounded = false;
        this.playroom.trampSquish = 1; this.audio.boing();
        if (!this.trampHint) { this.trampHint = true; toast('🤸 BOING! Hold SPACE to bounce extra high!', 'good', 2400); }
      }
    } else this.wasInPit = false;
    if (this.grounded) this.lastGroundedAt = this.now;

    if (this.pos.y < PHYSICS.fallDeathY) this.handleDefeat('fall');

    // ---- timers
    this.cd.scratch = Math.max(0, this.cd.scratch - dt);
    this.cd.bite = Math.max(0, this.cd.bite - dt);
    this.cd.special = Math.max(0, this.cd.special - dt);
    this.cd.jump = Math.max(0, this.cd.jump - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.attack) { this.attack.t += dt / this.attack.dur; if (this.attack.t >= 1) this.attack = null; }

    // ---- health never refills by itself: you get it back by eating (the designer's rule)
    // (TIMERS.regen* in config.ts are kept but unused)

    // ---- visuals
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.x = 0;
    if (this.pos.y < 0 && zoneAt(this.pos.x, this.pos.z) === 'swamp') this.rig.root.position.y = Math.max(this.pos.y, -0.25);
    this.rig.root.rotation.y = this.yaw;
    if (this.riding) {
      const h = this.riding.horse;
      h.root.position.copy(this.pos); h.root.rotation.y = this.yaw;
      animateRig(h, dt, { speed: this.speedNow * 0.6, airborne: !this.grounded, attack: null, attackT: 0, windup: 0 });
      this.rig.root.position.y = this.pos.y + h.height * 0.62;
      this.rig.root.position.x -= Math.sin(this.yaw) * 0.1; this.rig.root.position.z -= Math.cos(this.yaw) * 0.1;
    }
    animateRig(this.rig, dt, {
      speed: this.riding ? 0 : this.speedNow, airborne: !this.grounded && !this.riding,
      attack: this.attack?.kind ?? null, attackT: this.attack?.t ?? 0, windup: 0,
    });
    if (this.riding) for (const l of this.rig.legs) { l.pivot.rotation.x = -1.2; l.pivot.rotation.z = (l.phase ? -1 : 1) * 0.35; }   // legs astride the horse
    if (this.swimming) { this.rig.body.rotation.x = 1.25; this.rig.body.position.y = 0.15 + Math.sin(this.realTime * 4) * 0.03; } // belly-down swimming
    const ready = this.charge >= COMBAT.chargeMax;
    if (this.hurtFlash > 0) { this.hurtFlash -= dt; setRigGlow(this.rig, 0xff2020, Math.max(0, this.hurtFlash) * 2.5); }
    else if (ready) setRigGlow(this.rig, 0xffb020, 0.22 + 0.15 * Math.sin(this.realTime * 6));
    else setRigGlow(this.rig, 0x000000, 0);
    this.aura.visible = ready;
    if (ready) {
      this.aura.position.set(this.pos.x, this.pos.y + this.rig.height * 0.5, this.pos.z);
      this.aura.scale.setScalar(this.rig.height * 2.4 + Math.sin(this.realTime * 6) * 0.2);
    }
  }

  get atHome(): boolean {
    // the whole home clearing (and inside the house) counts as "home"
    if (this.indoors) return true;
    const h = WORLD.home;
    return Math.hypot(this.pos.x - h.x, this.pos.z - h.z) < 12.5 + Math.max(this.home.halfW, this.home.halfD) * 0.5;
  }

  // =========================================================================
  // Combat
  // =========================================================================
  findTarget(range: number): Opponent | null {
    let best: Opponent | null = null, bestD = Infinity;
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const cosMax = Math.cos(THREE.MathUtils.degToRad(COMBAT.frontAngleDeg));
    for (const o of this.opps) {
      if (!o.alive) continue;
      const to = new THREE.Vector3(o.pos.x - this.pos.x, 0, o.pos.z - this.pos.z);
      const d = to.length();
      if (d - o.radius - PHYSICS.playerRadius > range) continue;
      if (Math.abs(o.pos.y - this.pos.y) > 1.8) continue;
      if (d > 0.3 && to.normalize().dot(fwd) < cosMax) continue;
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  strengthOf(o: Opponent) {
    const diff = o.stats.rating - this.def.rating;
    if (diff > 0.4) return { text: 'Stronger', icon: '▲', cls: 'stronger' };
    if (diff < -0.4) return { text: 'Weaker', icon: '▼', cls: 'weaker' };
    return { text: 'Similar', icon: '●', cls: 'similar' };
  }

  doAttack(kind: 'scratch' | 'bite') {
    if (this.cd[kind] > 0 || this.attack?.kind === 'special') return;
    this.cd[kind] = kind === 'scratch' ? COMBAT.scratchCooldown : COMBAT.biteCooldown;
    this.attack = { kind, t: 0, dur: kind === 'scratch' ? 0.28 : 0.36 };
    const target = this.findTarget(COMBAT.attackRange);
    if (kind === 'scratch') this.audio.scratch(); else this.audio.bite();
    if (!target) { this.audio.miss(); return; }
    this.yaw = Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z);
    this.lastCombat = this.now;
    const won = target.takeHit(kind === 'scratch' ? this.def.scratch : this.def.bite, this.pos);
    this.audio.hit();
    this.addCharge();
    this.effects.push(sparkleBurst(this.scene, target.pos.clone().setY(target.pos.y + target.rig.height * 0.6), 0xffffff, 6));
    if (won) this.onVictory(target);
  }

  private addCharge() {
    const before = this.charge;
    this.charge = Math.min(COMBAT.chargeMax, this.charge + COMBAT.chargePerHit);
    if (before < COMBAT.chargeMax && this.charge >= COMBAT.chargeMax) {
      this.audio.specialReady();
      toast('✨ Special ready! Press 3', 'gold');
    }
  }

  /** 0: leap up and pounce onto the animal in front (or slam down if already in the air). */
  doJumpAttack() {
    if (this.cd.jump > 0 || this.attack?.kind === 'special' || this.jumpAttack) return;
    this.cd.jump = 1.2;
    const target = this.findTarget(COMBAT.attackRange + 3);
    if (target) this.yaw = Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z);
    this.attack = { kind: 'special', t: 0, dur: 0.7 };
    if (this.grounded) {
      this.vy = PHYSICS.jumpSpeed * this.def.jumpMult * 1.05;
      this.grounded = false;
      this.audio.jump();
      if (target) {
        const to = new THREE.Vector3(target.pos.x - this.pos.x, 0, target.pos.z - this.pos.z);
        const gap = Math.max(0, to.length() - target.radius - PHYSICS.playerRadius - 0.3);
        if (gap > 0.2) this.lunge = { dir: to.normalize().multiplyScalar(Math.min(1.4, gap / 4.5)), time: 0.65 };
      }
    } else {
      this.vy = -16; // slam straight down
      this.audio.miss();
    }
    this.jumpAttack = { target };
  }

  private landJumpAttack() {
    this.jumpAttack = null;
    this.dust(16);
    this.shockwave(this.pos.clone());
    // hit the closest animal near where you landed
    let best: Opponent | null = null, bestD = Infinity;
    for (const o of this.opps) {
      if (!o.alive) continue;
      const d = Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z) - o.radius - PHYSICS.playerRadius;
      if (d < 1.6 && Math.abs(o.pos.y - this.pos.y) < 1.5 && d < bestD) { bestD = d; best = o; }
    }
    if (!best) { this.audio.land(); return; }
    this.lastCombat = this.now;
    this.audio.special();
    const won = best.takeHit(Math.round(this.def.bite * 1.5), this.pos);
    this.addCharge();
    this.effects.push(sparkleBurst(this.scene, best.pos.clone().setY(best.pos.y + best.rig.height * 0.6), 0xffffff, 10));
    toast('💥 Jump attack!', 'gold', 1000);
    if (won) this.onVictory(best);
  }

  /** Little puffs of dust (snow in Antarctica, splashes in the swamp). */
  dust(n: number) {
    const zone = zoneAt(this.pos.x, this.pos.z);
    if (this.indoors) return;
    const col = zone === 'antarctica' ? 0xffffff : isMud(this.pos.x, this.pos.z) ? 0xcfe3ea : zone === 'savanna' ? 0xe2cc98 : 0xb8a58a;
    const mat = new THREE.SpriteMaterial({ map: softDotTexture(), color: col, transparent: true, opacity: 0.55, depthWrite: false });
    const parts: { s: THREE.Sprite; v: THREE.Vector3; life: number }[] = [];
    for (let i = 0; i < n; i++) {
      const sp = new THREE.Sprite(mat);
      const a = Math.random() * Math.PI * 2;
      sp.position.set(this.pos.x + Math.cos(a) * 0.3, this.pos.y + 0.1, this.pos.z + Math.sin(a) * 0.3);
      sp.scale.setScalar(0.3);
      this.scene.add(sp);
      parts.push({ s: sp, v: new THREE.Vector3(Math.cos(a) * (0.8 + Math.random()), 0.4 + Math.random() * 0.6, Math.sin(a) * (0.8 + Math.random())), life: 0.7 + Math.random() * 0.3 });
    }
    this.effects.push((dt) => {
      let alive = false;
      for (const p of parts) {
        if (p.life <= 0) continue;
        p.life -= dt;
        p.s.position.addScaledVector(p.v, dt); p.v.multiplyScalar(1 - dt * 2.5);
        p.s.scale.setScalar(0.3 + (1 - p.life) * 0.9);
        if (p.life <= 0) p.s.removeFromParent(); else alive = true;
      }
      if (!alive) mat.dispose();
      return alive;
    });
  }

  doSpecial() {
    if (this.cd.special > 0) return;
    if (this.charge < COMBAT.chargeMax) {
      if (this.now - this.lastSpecialHint > 2) { this.lastSpecialHint = this.now; toast(`Land hits to fill the special meter (${Math.round(this.charge)}/${COMBAT.chargeMax})`); }
      return;
    }
    const target = this.findTarget(COMBAT.attackRange + 1.4);
    if (!target) {
      if (this.now - this.lastSpecialHint > 2) { this.lastSpecialHint = this.now; toast('Get close to an animal and face it, then press 3!'); }
      return;
    }
    this.charge = 0;
    this.cd.special = COMBAT.specialCooldown;
    this.attack = { kind: 'special', t: 0, dur: 0.55 };
    const to = new THREE.Vector3(target.pos.x - this.pos.x, 0, target.pos.z - this.pos.z);
    this.yaw = Math.atan2(to.x, to.z);
    const gap = to.length() - target.radius - PHYSICS.playerRadius;
    if (gap > 0.3) this.lunge = { dir: to.normalize(), time: Math.min(0.3, gap / 7) };
    if (this.grounded) { this.vy = 6; this.grounded = false; }
    this.lastCombat = this.now;
    this.audio.special();
    const won = target.takeHit(this.def.bite * COMBAT.specialMultiplier, this.pos);
    this.shockwave(target.pos.clone());
    this.effects.push(sparkleBurst(this.scene, target.pos.clone().setY(target.pos.y + 0.6), 0xffc23a, 22));
    if (won) this.onVictory(target);
  }

  private shockwave(at: THREE.Vector3) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTexture(), color: 0xffd34a, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(at.x, at.y + 0.1, at.z);
    this.scene.add(m);
    let t = 0;
    this.effects.push((dt) => {
      t += dt;
      const s = 1 + t * 14; m.scale.set(s, s, 1);
      (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - t / 0.5);
      if (t > 0.5) { m.removeFromParent(); return false; }
      return true;
    });
  }

  private onStrike(o: Opponent) {
    if (this.invuln > 0 || this.respawning) return;
    this.hp -= Math.round(o.stats.damage * (GAME_MODE.level === 2 ? MODE2.oppDamage : 1));
    this.invuln = COMBAT.playerInvulnAfterHit;
    this.hurtFlash = 0.25;
    this.lastCombat = this.now;
    this.audio.hurt();
    const v = $('hurt-vignette'); v.classList.add('on'); setTimeout(() => v.classList.remove('on'), 160);
    const away = new THREE.Vector3(this.pos.x - o.pos.x, 0, this.pos.z - o.pos.z);
    if (away.lengthSq() > 0.001) this.lunge = { dir: away.normalize().multiplyScalar(0.6), time: 0.15 };
    if (this.hp <= 0) { this.hp = 0; this.handleDefeat(o.spawn.hunter ? 'dino' : 'battle'); }
  }

  private pendingDinoCoins = 0;
  /** You beat a dinosaur! Keep it as a pet, or take the coins. */
  private helpedDinos = new WeakSet<Opponent>();
  private dinoChoice(o: Opponent) {
    const kind = o.spawn.species === 'trex' ? 'T. rex' : 'Raptor', emoji = '🦖';
    const coins = o.stats.reward;
    const helped = this.helpedDinos.has(o); this.helpedDinos.delete(o);
    const full = this.save.myPets.length >= ZOO_SLOTS || helped;
    this.pendingDinoCoins = coins;   // if you just close the window, you still get the coins
    this.openModal('pets', (box) => {
      box.innerHTML = '';
      box.append(this.head(`${emoji} You beat the ${kind}!`, false));
      const body = el('div', { class: 'modal-body' });
      body.append(el('p', { text: `Wow, what a brave fight! The ${kind} is tired out and looks at you with big sorry eyes. What do you want to do?` }));
      if (helped) body.append(el('p', { class: 'preview-msg bad', text: `Your pets helped you win, so the ${kind} won't be your pet. To keep a dinosaur, you have to beat it ALL BY YOURSELF! 💪 You still get the coins.` }));
      else if (full) body.append(el('p', { class: 'preview-msg bad', text: `Your Magic Zoo is full (${ZOO_SLOTS} pets), so you can't keep it. Let a pet go free first next time!` }));
      body.append(el('div', { class: 'action-row', style: 'flex-wrap:wrap' },
        button(`${emoji} Keep it as a pet`, 'btn-green', () => {
          this.pendingDinoCoins = 0;
          this.closeModal();
          const names = o.spawn.species === 'trex' ? ['Chomper', 'Rexy', 'Stomper', 'Tiny', 'Biggie'] : ['Zippy', 'Claws', 'Speedy', 'Dash', 'Scales'];
          const used = new Set(this.save.myPets.map((q) => q.name));
          const name = names.find((n) => !used.has(n)) ?? `Dino ${this.save.myPets.length + 1}`;
          this.save.myPets.push({ species: o.spawn.species, name, fed: 0 });
          this.persist(); this.placeMyPets(); this.audio.celebrate();
          toast(`🦖 ${name} the ${kind} is your pet now! It lives in your Magic Zoo. Visit it, feed it, or take it for a walk! (${this.save.myPets.length}/${ZOO_SLOTS})`, 'gold', 4200);
        }, full),
        button(`🪙 Just take the ${coins} coins`, 'btn-shop', () => {
          this.pendingDinoCoins = 0;
          this.closeModal();
          this.spawnReward(coins, true);
          toast(`🪙 Jump to grab your +${coins} coins! The ${kind} runs off into the night.`, 'good', 2800);
        })));
      box.append(body);
    }, true);
  }
  private onVictory(o: Opponent) {
    this.save.wins += 1;
    if (o.spawn.species === 'lion') this.save.lionWins += 1;
    this.audio.victory();
    this.effects.push(sparkleBurst(this.scene, o.pos.clone().setY(o.pos.y + 0.8), 0xfff2b0, 18));
    if (o.spawn.hunter && (o.spawn.species === 'raptor' || o.spawn.species === 'trex')) { this.dinoChoice(o); if (this.save.tutorialStep === 2) this.save.tutorialStep = 3; this.persist(); this.checkProgress(); return; }
    this.spawnReward(o.stats.reward, true);
    toast(`You won against the ${o.spawn.name}! Jump to grab +${o.stats.reward}`, 'good', 2800);
    if (this.save.tutorialStep === 2) this.save.tutorialStep = 3;
    this.persist();
    this.checkProgress();
  }

  /** Shared defeat handler for losing a battle or falling out of bounds. */
  handleDefeat(reason: 'battle' | 'fall' | 'caught' | 'dino') {
    if (this.respawning) return;
    this.respawning = true;
    const penalty = Math.min(REWARDS.defeatPenalty, this.save.coins);
    this.save.coins -= penalty;
    for (const o of this.opps) if (o.aggro || o.state === 'warn') o.calmDown();
    for (const hu of this.humans) hu.calmDown();
    // clear battle rewards near the unfinished fight
    for (const c of [...this.coins]) if (c.battle && c.pos.distanceTo(this.pos) < 25) this.dropCoin(c);
    this.lunge = null; this.attack = null;
    this.audio.defeat();
    this.persist();
    const head = reason === 'fall' ? 'Oops, you fell!' : reason === 'caught' ? 'Caught in a net! They carried you home.' : reason === 'dino' ? '🦖 A dinosaur got you!' : 'Back to the clearing!';
    $('fade-text').textContent = penalty > 0 ? `${head} −${penalty} coins` : `${head} (no coins lost)`;
    $('fade').classList.add('on');
    this.later(1.5, () => {
      this.respawnAt(true);
      this.hp = this.maxHp;
      $('fade').classList.remove('on');
      toast(penalty > 0 ? `Back to the clearing! −${penalty} coins.` : 'Back to the clearing!', 'bad', 2600);
      this.later(0.4, () => { this.respawning = false; });
    });
  }

  private later(delay: number, fn: () => void) { this.timers.push({ at: this.now + delay, fn }); }

  // =========================================================================
  // Food & coins
  // =========================================================================
  private updateFood(dt: number) {
    for (const f of this.foods) {
      if (f.active) {
        f.group.rotation.y += dt * 1.2;
        f.group.position.y = f.baseY + 0.08 + Math.sin(this.realTime * 2 + f.spawn.x) * 0.06;
        if (f.sparkle) (f.sparkle.material as THREE.SpriteMaterial).opacity = 0.55 + Math.sin(this.realTime * 4 + f.spawn.z) * 0.25;
        const dx = this.pos.x - f.spawn.x, dz = this.pos.z - f.spawn.z;
        const dy = this.pos.y - f.baseY;
        if (!this.respawning && dx * dx + dz * dz < 1.0 && dy > -0.8 && dy < 1.6) this.collectFood(f);
      } else if (this.now >= f.respawnAt) {
        // respawn out of sight where possible
        const visible = this.inCameraView(f.group.position) && f.group.position.distanceTo(this.pos) < 30;
        if (visible && this.now < f.respawnAt + 20) f.respawnAt = this.now + 3;
        else { f.active = true; f.group.visible = true; }
      }
    }
  }

  private updateMaps(dt: number) {
    this.foods.forEach((f, i) => {
      const show = f.active && this.save.mapsFound.includes(zoneAt(f.spawn.x, f.spawn.z));
      const b = this.beams[i];
      b.visible = show;
      if (show) (b.material as THREE.MeshBasicMaterial).opacity = 0.2 + Math.sin(this.realTime * 2 + i) * 0.08;
    });
    for (const m of this.mapItems) {
      const found = this.save.mapsFound.includes(m.zone);
      m.group.visible = !found;
      if (found) continue;
      m.group.rotation.y += dt * 1.5;
      m.group.position.y = m.baseY + Math.sin(this.realTime * 2) * 0.1;
      const dx = this.pos.x - m.x, dz = this.pos.z - m.z;
      if (!this.respawning && dx * dx + dz * dz < 1.3 && Math.abs(this.pos.y - m.baseY) < 1.8) {
        this.save.mapsFound.push(m.zone);
        this.audio.purchase();
        this.effects.push(sparkleBurst(this.scene, m.group.position.clone().setY(m.baseY + 0.5), 0xffe9a0, 20));
        toast(`🗺️ You found the ${ZONE_NAMES[m.zone].replace('The ', '')} Map!`, 'gold', 3200);
        setTimeout(() => toast('Food now glows with light beams and shows on your mini-map!', 'good', 3600), 700);
        this.persist();
      }
    }
  }

  /** Small round map in the corner: up is the way the camera looks. */
  private drawMinimap() {
    const c = $('minimap-canvas') as HTMLCanvasElement;
    const g = c.getContext('2d')!;
    const W = c.width, R = W / 2, range = 55, k = R / range, u = W / 170; // u: canvas pixels per CSS pixel
    if (this.inHumanHouse >= 0) {
      const h = this.hhouses[this.inHumanHouse];
      g.clearRect(0, 0, W, W); g.fillStyle = '#c99a6a'; g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.fill();
      g.font = `${46 * u}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(this.captive ? '🎀' : '🏡', R, R);
      this.setText('minimap-note', this.captive ? `You're a pet! Escape!` : `Inside ${h.home.name}`); return;
    }
    if (this.inBarn) {
      g.clearRect(0, 0, W, W); g.fillStyle = '#c9a85a'; g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.fill();
      g.font = `${46 * u}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🐮', R, R);
      this.setText('minimap-note', `Inside the barn • ${this.save.rescued.length} friends rescued so far`); return;
    }
    if (this.inZoo) {
      g.clearRect(0, 0, W, W); g.fillStyle = '#6a9a3c'; g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.fill();
      g.font = `${46 * u}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🦁', R, R);
      this.setText('minimap-note', `Your Magic Zoo • ${this.save.myPets.length}/${ZOO_SLOTS} pets`); return;
    }
    if (this.inSecret) {
      g.clearRect(0, 0, W, W); g.fillStyle = '#5a3a7a'; g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.fill();
      g.font = `${46 * u}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('✨', R, R);
      this.setText('minimap-note', `Secret place: ${this.secrets.roomFor?.name ?? ''}`); return;
    }
    if (this.indoors) {
      g.clearRect(0, 0, W, W); g.fillStyle = '#a87a4c'; g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.fill();
      g.font = `${46 * u}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🏠', R, R);
      this.setText('minimap-note', 'Inside your house'); return;
    }
    const zone = zoneAt(this.pos.x, this.pos.z);
    const bg: Record<ZoneId, string> = { forest: '#4d7a33', savanna: '#c2a058', swamp: '#4c5a38', antarctica: '#dbe9f3', village: '#6a9a3c', jungle: '#2f7a34' };
    g.clearRect(0, 0, W, W);
    g.save();
    g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = bg[zone]; g.fillRect(0, 0, W, W);
    const cy = this.cam.yaw;
    // world (dx,dz) -> screen, rotated so the camera's forward points up
    const toScreen = (x: number, z: number): [number, number] => {
      const dx = x - this.pos.x, dz = z - this.pos.z;
      const fx = -Math.sin(cy), fz = -Math.cos(cy); // camera forward
      const rx = -fz, rz = fx;                      // camera right
      return [R + (dx * rx + dz * rz) * k, R - (dx * fx + dz * fz) * k];
    };
    const near = (x: number, z: number) => Math.hypot(x - this.pos.x, z - this.pos.z) < range + 5;
    // home & gates
    const icon = (txt: string, x: number, z: number, size = 13) => { if (!near(x, z)) return; const [sx, sy] = toScreen(x, z); g.font = `${size * u}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, sx, sy); };
    if (zone !== 'antarctica') {
      icon('🏠', WORLD.home.x, WORLD.home.z);
      icon('✨', -12, -7, 14);
      this.pets.forEach((p) => { const H = this.petHome(p); if (!H.roommate && this.friendHouses[H.slot]) icon(p.emoji, H.x, H.z, 14); });
      for (const gt of this.world.gates) icon(gt.open ? '⛩️' : '🔒', gt.x, 0, 20);
    }
    // food (only for areas whose map you've found)
    if (this.save.mapsFound.includes(zone)) {
      for (const f of this.foods) {
        if (!f.active || !near(f.spawn.x, f.spawn.z)) continue;
        const [sx, sy] = toScreen(f.spawn.x, f.spawn.z);
        g.beginPath(); g.arc(sx, sy, (f.spawn.rare ? 5.5 : 4) * u, 0, Math.PI * 2);
        g.fillStyle = f.spawn.rare ? '#ffd34a' : '#ffffff'; g.fill();
        g.lineWidth = 1.5 * u; g.strokeStyle = '#3a2400'; g.stroke();
      }
    }
    // animals: ▲ stronger, ● similar, ▼ weaker
    for (const o of this.opps) {
      if (!o.alive || !near(o.pos.x, o.pos.z)) continue;
      const [sx, sy] = toScreen(o.pos.x, o.pos.z);
      const st = this.strengthOf(o).cls;
      g.fillStyle = st === 'stronger' ? '#e0283c' : st === 'similar' ? '#f2b20f' : '#3fae3a';
      g.strokeStyle = '#ffffff'; g.lineWidth = 1.5 * u;
      g.beginPath();
      const a = (st === 'stronger' ? 7 : 5.5) * u;
      if (st === 'stronger') { g.moveTo(sx, sy - a); g.lineTo(sx + a * 0.9, sy + a * 0.7); g.lineTo(sx - a * 0.9, sy + a * 0.7); }
      else if (st === 'weaker') { g.moveTo(sx, sy + a); g.lineTo(sx + a * 0.9, sy - a * 0.7); g.lineTo(sx - a * 0.9, sy - a * 0.7); }
      else g.arc(sx, sy, a * 0.75, 0, Math.PI * 2);
      g.closePath(); g.fill(); g.stroke();
    }
    // humans: blue squares (red when chasing you)
    for (const hu of this.humans) {
      if (!near(hu.pos.x, hu.pos.z)) continue;
      const [sx, sy] = toScreen(hu.pos.x, hu.pos.z);
      const a = 5.5 * u;
      g.fillStyle = hu.chasing ? '#e0283c' : '#2f6fd6'; g.strokeStyle = '#ffffff'; g.lineWidth = 1.5 * u;
      g.fillRect(sx - a, sy - a, a * 2, a * 2); g.strokeRect(sx - a, sy - a, a * 2, a * 2);
    }
    // secret doors whose map you've found (❓ still locked, ✨ opened)
    for (const sp of SECRET_SPOTS) if ((this.save.secretMaps ?? []).includes(sp.id)) icon((this.save.secretsOpened ?? []).includes(sp.id) ? '✨' : '❓', sp.x, sp.z, 16);
    // where your caught friends are (an SOS over their house, or an arrow on the edge if it's far away)
    for (const q of [...this.pets, ...this.family]) {
      if (!q.caged) continue;
      const hm = this.hhouses[q.caged.house].home;
      const emo = 'emoji' in q ? q.emoji : this.def.icon;
      if (near(hm.x, hm.z)) icon(emo, hm.x, hm.z, 18);
      else {
        const [sx, sy] = toScreen(hm.x, hm.z), a = Math.atan2(sy - R, sx - R), rr = R - 14 * u;
        g.font = `${15 * u}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(emo, R + Math.cos(a) * rr, R + Math.sin(a) * rr);
      }
    }
    // player arrow
    const rel = this.yaw - (cy + Math.PI);
    g.translate(R, R); g.rotate(-rel);
    g.scale(u * 0.9, u * 0.9);
    g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 8); g.lineTo(0, 4); g.lineTo(-8, 8); g.closePath();
    g.fillStyle = '#3b8fd9'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#ffffff'; g.stroke();
    g.restore();
    g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,0.8)'; g.stroke();
    const lost = [...this.pets, ...this.family].filter((q) => q.caged).length;
    if (lost) { this.setText('minimap-note', `🆘 ${lost} caught! Tap 🗺️ Rescue map to see where`); return; }
    this.setText('minimap-note', this.save.mapsFound.includes(zone) ? `🗺️ ${ZONE_NAMES[zone].replace('The ', '')} map ✔` : '🗺️ Find this area\'s hidden map to see food!');
  }

  // ---------------- Night dinosaurs ----------------
  playerSafeFromDinos() {
    if (this.indoors || this.inBarn || this.inHumanHouse >= 0 || this.inSecret || this.pos.z < -1000) return true;
    if (Math.hypot(this.pos.x - WORLD.home.x, this.pos.z - WORLD.home.z) < DINOS.safeHomeRadius) return true;
    const z = zoneAt(this.pos.x, this.pos.z);
    return !DINOS.zones.includes(z) && z !== 'antarctica';
  }
  iceMonsters: Opponent[] = [];
  /** Village humans a unicorn has caught (they're away living in your zoo for a while). */
  private humanAway = new Map<Human, number>();
  /** Unicorn magic: catch a village human as your pet! */
  catchHuman(hu: Human) {
    if (this.save.myPets.length >= ZOO_SLOTS) { toast(`🐾 Your Magic Zoo is full (${ZOO_SLOTS} pets)! Let one go free first.`, 'bad', 3000); return; }
    this.save.myPets.push({ species: 'human', name: hu.spawn.name, fed: 0, female: /Rosa|Pat/.test(hu.spawn.name) || undefined });
    this.effects.push(sparkleBurst(this.scene, hu.pos.clone().setY(hu.pos.y + 1), 0xff9ad8, 30));
    this.effects.push(sparkleBurst(this.scene, hu.pos.clone().setY(hu.pos.y + 1.6), 0x9fd8ff, 20));
    hu.calmDown();
    this.humanAway.set(hu, this.now + 1e9);   // they live in your zoo now
    hu.root.visible = false; hu.label.style.display = 'none';
    this.audio.celebrate();
    this.persist(); this.placeMyPets();
    toast(`✨🦄 Unicorn magic! ${hu.spawn.name} is your pet now! They live in a garden habitat in your Magic Zoo. (${this.save.myPets.length}/${ZOO_SLOTS})`, 'gold', 4200);
  }
  // ---- RIDING HORSES (as a human) -------------------------------------------------------------
  riding: { horse: AnimalRig; opp: Opponent | null; petIdx: number; name: string } | null = null;
  /** A horse you could ride right now (a calm wild horse, or your pet horse on a walk). */
  private rideableNear(): { opp: Opponent | null; petIdx: number; name: string } | null {
    if (this.species !== 'human' || this.riding || (this.pos.z < -300 && !this.inZoo)) return null;
    const w = this.walker;
    if (w && this.save.myPets[w.idx]?.species === 'horse' && Math.hypot(w.x - this.pos.x, w.z - this.pos.z) < 2.6) return { opp: null, petIdx: w.idx, name: this.save.myPets[w.idx].name };
    const o = this.opps.find((q) => q.alive && q.spawn.species === 'horse' && !q.aggro && q.pos.distanceTo(this.pos) < 2.8);
    return o ? { opp: o, petIdx: -1, name: o.spawn.name } : null;
  }
  mountHorse(r: { opp: Opponent | null; petIdx: number; name: string }) {
    if (this.riding) return;
    const horse = buildOpponent('horse', 1);
    this.scene.add(horse.root);
    if (r.opp) { const o = r.opp; o.state = 'gone'; o.rig.root.visible = false; o.respawnAt = 1e12; o.label.style.display = 'none'; this.pos.set(o.pos.x, o.pos.y, o.pos.z); }
    else if (this.walker) { this.walker.rig.root.visible = false; this.pos.set(this.walker.x, this.pos.y, this.walker.z); }
    this.riding = { horse, ...r };
    this.cam.setBaseDistance(4.2 + (this.rig.height + horse.height * 0.6) * 2.2);
    this.audio.gate();
    toast(`🐴 Yee-haw! You're riding ${r.petIdx >= 0 ? r.name : 'the ' + r.name}! Gallop with the arrows, jump with Space, press A to get off${r.opp ? ', or K to keep it as your pet' : ''}.`, 'good', 4000);
  }
  /** Press K while riding a wild horse to keep it as your pet. */
  keepRiddenHorse() {
    const r = this.riding;
    if (!r?.opp) { if (this.riding) toast('🐴 This horse is already your pet!', '', 1800); return; }
    const o = r.opp;
    this.dismountHorse(true);
    o.state = 'idle'; o.rig.root.visible = true;
    this.catchWild(o);
  }
  dismountHorse(quiet = false) {
    const r = this.riding; if (!r) return;
    r.horse.root.removeFromParent(); disposeRig(r.horse);
    const sx = this.pos.x + Math.cos(this.yaw) * 1.6, sz = this.pos.z - Math.sin(this.yaw) * 1.6;
    if (r.opp) {
      const o = r.opp;
      if (this.pos.z < -300) o.respawn();
      else { o.spawn.x = sx; o.spawn.z = sz; o.respawn(); }
    } else if (this.walker) { this.walker.x = sx; this.walker.z = sz; this.walker.rig.root.visible = true; }
    this.riding = null;
    this.cam.setBaseDistance(4.2 + this.rig.height * 2.2);
    if (!quiet) toast('🐴 You hop off. Good horsey! 💛', 'good', 2000);
  }
  private hunts: { dino: Opponent; prey: Opponent; ends: number }[] = [];
  private updateHunts() {
    this.hunts = this.hunts.filter((h) => {
      if (this.now < h.ends) return true;
      const { dino, prey } = h;
      if (prey.alive && !prey.aggro && dino.alive && prey.pos.distanceTo(dino.pos) < dino.radius + prey.radius + 2.5) {
        prey.state = 'defeated'; prey.fade = 0; prey.brawl = null;           // scared off into the night (it comes back later)
      }
      return false;
    });
  }
  // ---- SECRET PLACES: 5 hidden doors in each area ----------------------------------------
  secrets!: SecretPlaces;
  zoo!: MagicZoo;
  playroom!: PlayRoom;
  aquarium!: Aquarium;
  enterAquarium() {
    if (this.respawning || this.captive) return;
    if (this.riding) this.dismountHorse(true);
    if (this.walker) this.endPetWalk(false);
    this.endClimb(); this.scripted = null;
    this.respawning = true;
    $('fade-text').textContent = '🐠 Off to your Aquarium…';
    $('fade').classList.add('on');
    this.later(0.8, () => {
      this.aquarium.fill(this.save.aquarium ?? []);
      this.pos.set(AQUA.x, 0, AQUA.z + AQUA.halfD - 5); this.vy = 0; this.yaw = Math.PI; this.grounded = true; this.groundY = 0; this.lunge = null;
      this.cam.reset(this.yaw, true);
      $('fade').classList.remove('on');
      this.later(0.3, () => { this.respawning = false; });
      const n = (this.save.aquarium ?? []).length;
      setTimeout(() => toast(n ? `🐠 Welcome to your Aquarium! ${n} sea pet${n > 1 ? 's' : ''} live${n > 1 ? '' : 's'} here. Walk up to the big tank to visit them!` : '🐠 Your Aquarium is empty! Swim in the sea (Antarctica or the Jungle), find whales, dolphins, turtles and more, and press A to make friends!', 'gold', 4200), 400);
    });
  }
  leaveAquarium() {
    if (this.respawning) return;
    this.respawning = true;
    $('fade-text').textContent = '🏠 Back to the Magic Zoo…';
    $('fade').classList.add('on');
    this.later(0.6, () => {
      this.aquarium.clear();
      const e = this.zoo.zooExit;
      this.pos.set(e.x, 0, e.z - 3); this.vy = 0; this.yaw = Math.PI; this.grounded = true; this.groundY = 0;
      this.cam.reset(this.yaw, true);
      $('fade').classList.remove('on');
      this.later(0.3, () => { this.respawning = false; });
    });
  }
  /** Visit your sea pets: feed them or let them go. */
  openAquariumPets() {
    const list = this.save.aquarium ?? [];
    this.openModal('pets', (box) => {
      const draw = () => {
        box.innerHTML = '';
        box.append(this.head('🐠 My sea pets', true));
        const body = el('div', { class: 'modal-body' });
        if (!list.length) body.append(el('p', { text: 'No sea pets yet! Swim in the sea and press A next to a whale, dolphin, turtle, octopus… to make friends.' }));
        list.forEach((q, i) => {
          const info = SEA_INFO[q.species as SeaSpecies];
          body.append(el('div', { class: 'action-row', style: 'flex-wrap:wrap;align-items:center;justify-content:flex-start' },
            el('strong', { text: `${info?.emoji ?? '🐟'} ${q.name} the ${info?.name ?? q.species}`, style: 'min-width:200px' }),
            button('🦐 Feed', 'btn-green btn-small', () => { q.fed++; this.persist(); this.audio.food(); toast(`😋 ${q.name} gobbled up the yummy shrimp! 💙`, 'good', 2000); }),
            button('🌊 Let go free', 'btn-small', () => { list.splice(i, 1); this.persist(); this.aquarium.fill(list); toast(`👋 Bye bye, ${q.name}! It swam back to the big blue sea.`, 'good', 2600); draw(); })));
        });
        box.append(body);
      };
      draw();
    }, true);
  }
  // ---- wild sea creatures you meet while swimming ----
  private wildSea: { kind: SeaSpecies; rig: SeaRig; a: number; r: number; y: number; scale: number; gone: number }[] = [];
  private updateWildSea(dt: number, atSea: boolean) {
    if (!this.wildSea.length) {
      for (let k = 0; k < 3; k++) { const rig = buildSeaCreature('dolphin'); rig.root.visible = false; this.scene.add(rig.root); this.wildSea.push({ kind: 'dolphin', rig, a: k * 2.1, r: 5, y: -1.5, scale: 1, gone: 0 }); }
    }
    const A = this.seaAnchor;
    for (const w of this.wildSea) {
      if (!atSea || !A) { w.rig.root.visible = false; continue; }
      if (w.gone && this.now < w.gone) { w.rig.root.visible = false; continue; }
      w.a += dt * (w.kind === 'jellyfish' || w.kind === 'starfish' || w.kind === 'seahorse' ? 0.15 : 0.35);
      const x = A.x + Math.cos(w.a) * w.r, z = A.z + Math.sin(w.a) * w.r;
      w.rig.root.visible = terrainHeight(x, z) < w.y - 0.3;
      w.rig.root.position.set(x, w.y + Math.sin(this.realTime + w.a) * 0.2, z);
      w.rig.root.rotation.y = Math.atan2(-Math.sin(w.a), Math.cos(w.a));
      animateSea(w.rig, this.realTime + w.a, 1);
    }
  }
  /** New sea creatures appear when you swim somewhere new. */
  private shuffleWildSea() {
    const pick = (): SeaSpecies => { const r = Math.random(); return r < 0.12 ? 'whale' : r < 0.22 ? 'narwhal' : SEA_SPECIES.filter((k) => k !== 'whale' && k !== 'narwhal')[Math.floor(Math.random() * 8)]; };
    this.wildSea.forEach((w, k) => {
      const kind = pick();
      w.rig.root.removeFromParent();
      w.rig = buildSeaCreature(kind); w.kind = kind;
      const big = kind === 'whale' || kind === 'narwhal';
      w.scale = SEA_INFO[kind].size * (big ? 1.3 : 1);
      w.rig.root.scale.setScalar(w.scale); this.scene.add(w.rig.root);
      w.r = 4 + k * 3 + (big ? 4 : 0); w.a = Math.random() * 6.28; w.y = kind === 'starfish' ? -3.2 : big ? -2.2 : -1 - Math.random() * 1.8; w.gone = 0;
    });
  }
  private seaFriendNear() {
    for (const w of this.wildSea) {
      if (!w.rig.root.visible) continue;
      const p = w.rig.root.position;
      if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < w.scale * 0.5 + 2 && Math.abs(p.y - this.pos.y) < 2.5 + w.scale * 0.3) return w;
    }
    return null;
  }
  befriendSea(w: Game['wildSea'][number]) {
    const list = (this.save.aquarium ??= []);
    if (list.length >= 15) { toast('🐠 Your Aquarium is full (15 sea pets)! Let one go free first.', 'bad', 2600); return; }
    const info = SEA_INFO[w.kind];
    const used = new Set(list.map((q) => q.name));
    const name = info.names.find((n) => !used.has(n)) ?? `${info.name} ${list.length + 1}`;
    list.push({ species: w.kind, name, fed: 0 }); this.persist();
    this.effects.push(sparkleBurst(this.scene, w.rig.root.position.clone(), 0x7ad8ff, 30));
    w.gone = this.now + 25; this.audio.celebrate();
    toast(`💙 ${name} the ${info.name} ${info.emoji} wants to be your friend! It's swimming to your Aquarium now! (${list.length}/15)`, 'gold', 4200);
  }
  /** Pets that ran off into the forest: you have to go and find them! */
  private lostRigs = new Map<object, { rig: AnimalRig; tag: THREE.Sprite; x: number; z: number; tx: number; tz: number; wait: number }>();
  private petRunsAway(i: number) {
    const q = this.save.myPets[i]; if (!q) return;
    // hide somewhere in the forest, not too close to home
    let x = 30, z = -50;
    for (let k = 0; k < 80; k++) {
      const a = Math.random() * Math.PI * 2, r = 28 + Math.random() * 55;
      const cx = WORLD.home.x + Math.cos(a) * r, cz = WORLD.home.z + Math.sin(a) * r;
      if (Math.abs(cx) > WORLD.zoneEdge - 6 || cz < WORLD.minZ + 6 || cz > 55) continue;
      if (zoneAt(cx, cz) !== 'forest' || inPit(cx, cz, 4) || this.world.collision.blocked(cx, cz, terrainHeight(cx, cz) + 0.5, 1)) continue;
      x = cx; z = cz; break;
    }
    q.lost = { x, z }; this.persist();
    this.audio.squeak();
    const dir = Math.abs(x - WORLD.home.x) > Math.abs(z - WORLD.home.z) ? (x > WORLD.home.x ? 'east' : 'west') : (z > WORLD.home.z ? 'north' : 'south');
    toast(`😱 Oh no! ${q.name} ran out of the magic door and into the FOREST! Go and find it! (It went ${dir} of your home — look for the 🐾.)`, 'bad', 5000);
  }
  private updateLostPets(dt: number) {
    const keep = new Set<object>();
    this.save.myPets.forEach((q, i) => {
      if (!q.lost) return;
      keep.add(q);
      let L = this.lostRigs.get(q);
      if (!L) {
        const rig = this.buildMyPetRig(q.species, !!q.female); dressRig(rig, q.outfit); dressBody(rig, q.clothes);
        this.scene.add(rig.root);
        const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!;
        x.fillStyle = 'rgba(255,255,255,0.9)'; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fill(); x.font = '80px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🐾', 64, 70);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
        const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); tag.scale.setScalar(0.75); this.scene.add(tag);
        L = { rig, tag, x: q.lost.x, z: q.lost.z, tx: q.lost.x, tz: q.lost.z, wait: 1 };
        this.lostRigs.set(q, L);
      }
      // it sniffs around its hiding spot
      L.wait -= dt;
      const dx = L.tx - L.x, dz = L.tz - L.z, d = Math.hypot(dx, dz);
      let speed = 0;
      if (d > 0.2 && L.wait <= 0) { const st = Math.min(d, 1.4 * dt); L.x += (dx / d) * st; L.z += (dz / d) * st; speed = 1.4; L.rig.root.rotation.y = Math.atan2(dx, dz); }
      else if (L.wait <= 0) { L.tx = q.lost.x + (Math.random() - 0.5) * 6; L.tz = q.lost.z + (Math.random() - 0.5) * 6; L.wait = 1 + Math.random() * 3; }
      const y = terrainHeight(L.x, L.z);
      L.rig.root.position.set(L.x, y, L.z);
      L.tag.position.set(L.x, y + L.rig.height + 0.9 + Math.sin(this.realTime * 3 + i) * 0.15, L.z);
      animateRig(L.rig, dt, { speed, airborne: false, attack: null, attackT: 0, windup: 0 });
    });
    for (const [q, L] of this.lostRigs) if (!keep.has(q)) { L.rig.root.removeFromParent(); disposeRig(L.rig); L.tag.removeFromParent(); this.lostRigs.delete(q); }
  }
  /** The lost pet you're standing next to (or -1). */
  private lostPetNear() {
    for (const [q, L] of this.lostRigs) if (Math.hypot(L.x - this.pos.x, L.z - this.pos.z) < 3) return this.save.myPets.indexOf(q as Game['save']['myPets'][number]);
    return -1;
  }
  private bringLostPetHome(i: number) {
    const q = this.save.myPets[i]; if (!q?.lost) return;
    const L = this.lostRigs.get(q);
    if (L) this.effects.push(sparkleBurst(this.scene, new THREE.Vector3(L.x, terrainHeight(L.x, L.z) + 1, L.z), 0xff6a9a, 22));
    delete q.lost; this.cheerPet(i, 'fun', 40); this.persist();
    this.updateLostPets(0); this.placeMyPets(); this.audio.celebrate();
    toast(`🤗 You FOUND ${q.name}! Hooray! ${q.name} is going back to its habitat in the Magic Zoo. Remember to lock the door! 🔒`, 'gold', 3600);
  }
  /** Go to the Big Play Room and play with ALL your pets at once! */
  enterPlayroom() {
    if (this.respawning || !this.save.myPets.length || this.captive) return;
    if (this.riding) this.dismountHorse(true);
    if (this.walker) this.endPetWalk(false);
    this.respawning = true;
    $('fade-text').textContent = '🎉 Off to the Big Play Room with everyone!';
    $('fade').classList.add('on');
    this.later(0.8, () => {
      this.playroom.fill(this.save.myPets.map((q, idx) => { const rig = this.buildMyPetRig(q.species, !!q.female); dressRig(rig, q.outfit); dressBody(rig, q.clothes); return { rig, idx }; }));
      this.pos.set(PLAYROOM.x, 0, PLAYROOM.z + PLAYROOM.halfD - 5); this.vy = 0; this.yaw = Math.PI; this.grounded = true; this.groundY = 0; this.lunge = null;
      this.cam.reset(this.yaw, true);
      $('fade').classList.remove('on');
      this.later(0.3, () => { this.respawning = false; });
      setTimeout(() => toast(`🎉 Welcome to the Big Play Room! All ${this.save.myPets.length} of your pets are here! Press T to throw the ball, P to pet someone, F to talk.`, 'gold', 4200), 400);
    });
  }
  leavePlayroom() {
    if (this.respawning) return;
    this.respawning = true;
    this.endClimb(); this.scripted = null;
    $('fade-text').textContent = '🏠 Back to the Magic Zoo…';
    $('fade').classList.add('on');
    this.later(0.6, () => {
      this.playroom.clear();
      const e = this.zoo.zooExit;
      this.pos.set(e.x, 0, e.z - 3); this.vy = 0; this.yaw = Math.PI; this.grounded = true; this.groundY = 0;
      this.cam.reset(this.yaw, true);
      $('fade').classList.remove('on');
      this.later(0.3, () => { this.respawning = false; });
    });
  }
  private zooReturn = false;
  enterZoo() {
    if (this.respawning) return;
    this.respawning = true;
    $('fade-text').textContent = '✨ Squeezing through the tiny magic door… whoa, it\'s HUGE in here!';
    $('fade').classList.add('on');
    this.later(0.8, () => {
      const e = this.zoo.zooExit;
      this.pos.set(e.x, 0, e.z - 3); this.vy = 0; this.yaw = Math.PI; this.grounded = true; this.groundY = 0; this.lunge = null;
      this.cam.reset(this.yaw, true);
      for (const p of this.pets) if (p.following) { p.x = this.pos.x + 1; p.z = this.pos.z + 1; }
      $('fade').classList.remove('on');
      this.later(0.3, () => { this.respawning = false; });
      setTimeout(() => toast(this.save.myPets.length ? `🦁 Welcome to your Magic Zoo! All ${this.save.myPets.length} of your pets live here in their own glass habitats.` : '🦁 Welcome to your Magic Zoo! Catch animals that are smaller than you and they\'ll live here.', 'gold', 3600), 500);
    });
  }
  exitZoo() {
    if (this.respawning) return;
    this.respawning = true;
    $('fade-text').textContent = '🏠 Back to your home clearing…';
    $('fade').classList.add('on');
    this.later(0.6, () => {
      const f = this.zoo.hutFront;
      const y = this.world.collision.groundAt(f.x, f.z + 0.6, 60, PHYSICS.stepUp);
      this.pos.set(f.x, y, f.z + 0.6); this.vy = 0; this.yaw = 0; this.grounded = true; this.groundY = y;
      this.cam.reset(this.yaw, true);
      $('fade').classList.remove('on');
      this.later(0.3, () => { this.respawning = false; });
    });
  }
  // ---- FETCH! Throw a ball (T) and your pet runs after it and brings it back -----------------
  private fetch: { ball: THREE.Mesh; vel: THREE.Vector3; flying: boolean; held: boolean; who: ZooAnimal | 'walker'; name: string; phase: 'wait' | 'chase' | 'return'; t: number; pen: number } | null = null;
  private ballMesh: THREE.Mesh | null = null;
  throwBall() {
    if (this.respawning || this.modal || this.fetch) return;
    if (this.inPlayroom) { if (this.climb) return; if (this.playroom.game) this.playroom.endGame(); if (this.playroom.throwBall(this.pos, this.yaw)) { this.audio.jump(); toast('🎾 Wheee! Everybody, GO GET IT!', 'good', 1400); } return; }
    if (this.petGame) this.endPetGame();
    let who: ZooAnimal | 'walker' | null = null, name = '', pen = -1;
    if (this.inZoo) {
      pen = this.zoo.habitatAt(this.pos.x, this.pos.z);
      const a0 = pen >= 0 ? this.zoo.animals[pen] : null, a = a0 && !a0.escaped && !a0.sneaking ? a0 : null;
      if (a) { who = a; name = this.save.myPets[pen].name; }
    } else if (this.walker) { who = 'walker'; name = this.save.myPets[this.walker.idx]?.name ?? 'your pet'; }
    if (!who) { toast('🎾 Go into one of your pets\' habitats in the Magic Zoo (or take a pet for a walk), then press T to throw the ball!', '', 3200); return; }
    if (!this.ballMesh) {
      const c = document.createElement('canvas'); c.width = 64; c.height = 32;
      const x = c.getContext('2d')!; x.fillStyle = '#d8f040'; x.fillRect(0, 0, 64, 32); x.strokeStyle = '#ffffff'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, 8); x.bezierCurveTo(20, 30, 44, 2, 64, 24); x.stroke();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      this.ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
      this.ballMesh.castShadow = true;
    }
    const ball = this.ballMesh; this.scene.add(ball);
    ball.position.set(this.pos.x + Math.sin(this.yaw) * 0.5, this.pos.y + this.rig.height * 0.8, this.pos.z + Math.cos(this.yaw) * 0.5);
    const vel = new THREE.Vector3(Math.sin(this.yaw) * 8, 5, Math.cos(this.yaw) * 8);
    this.fetch = { ball, vel, flying: true, held: false, who, name, phase: 'wait', t: 0, pen };
    if (who !== 'walker') who.busy = true;
    this.audio.jump();
    toast(`🎾 Fetch, ${name}!`, 'good', 1400);
  }
  private updateFetch(dt: number) {
    const f = this.fetch; if (!f) return;
    // stop if you leave
    if ((f.who === 'walker' && !this.walker) || (f.who !== 'walker' && !this.inZoo)) { this.endFetch(); return; }
    const ball = f.ball;
    const groundAt = (x: number, z: number) => this.inZoo ? 0 : this.world.collision.groundAt(x, z, ball.position.y + 0.5, 0.4);
    if (f.flying) {
      f.vel.y -= 18 * dt;
      ball.position.addScaledVector(f.vel, dt);
      // bounce off the habitat's glass walls
      if (f.pen >= 0) {
        const p = this.zoo.pens[f.pen], hx = p.w / 2 - 0.4, hz = p.d / 2 - 0.4;
        if (Math.abs(ball.position.x - p.x) > hx) { ball.position.x = p.x + Math.sign(ball.position.x - p.x) * hx; f.vel.x *= -0.6; }
        if (Math.abs(ball.position.z - p.z) > hz) { ball.position.z = p.z + Math.sign(ball.position.z - p.z) * hz; f.vel.z *= -0.6; }
      }
      const gy = groundAt(ball.position.x, ball.position.z) + 0.14;
      if (ball.position.y < gy) {
        ball.position.y = gy;
        if (Math.abs(f.vel.y) > 2) { f.vel.y *= -0.45; f.vel.x *= 0.7; f.vel.z *= 0.7; } else { f.vel.set(0, 0, 0); f.flying = false; }
      }
      ball.rotation.x += dt * 8;
    }
    f.t += dt;
    if (f.phase === 'wait' && f.t > 0.35) f.phase = 'chase';
    // the pet runs to the ball, picks it up, and brings it back
    const pet = f.who === 'walker' ? this.walker! : f.who;
    const px = pet.x, pz = pet.z;
    const target = f.phase === 'chase' ? ball.position : this.pos;
    const dx = target.x - px, dz = target.z - pz, d = Math.hypot(dx, dz);
    const speed = 6.5, rig = pet.rig;
    let moving = 0;
    if ((f.phase === 'chase' && d > 0.5) || (f.phase === 'return' && d > 1.3)) {
      const st = Math.min(d, speed * dt); pet.x += (dx / d) * st; pet.z += (dz / d) * st; moving = speed;
      rig.root.rotation.y = Math.atan2(dx, dz);
      if (f.who !== 'walker') f.who.yaw = rig.root.rotation.y;
    }
    if (f.who !== 'walker') { rig.root.position.set(pet.x, 0, pet.z); rig.root.rotation.y = f.who.yaw; animateRig(rig, dt, { speed: moving, airborne: false, attack: null, attackT: 0, windup: 0 }); }
    if (f.phase === 'chase' && d <= 0.6 && !f.flying) { f.phase = 'return'; f.held = true; this.audio.click(); }
    if (f.held) {
      // carried in its mouth
      const hp = new THREE.Vector3(); rig.head.getWorldPosition(hp);
      const fwd = new THREE.Vector3(Math.sin(rig.root.rotation.y), 0, Math.cos(rig.root.rotation.y));
      ball.position.copy(hp).addScaledVector(fwd, 0.18 * rig.root.scale.x + 0.08).setY(hp.y - 0.05);
    }
    if (f.phase === 'return' && d <= 1.3) {
      f.held = false;
      ball.position.set(this.pos.x + Math.sin(this.yaw) * 0.7, groundAt(this.pos.x, this.pos.z) + 0.14, this.pos.z + Math.cos(this.yaw) * 0.7);
      this.effects.push(sparkleBurst(this.scene, ball.position.clone().setY(ball.position.y + 0.6), 0xff6a9a, 14));
      this.audio.squeak();
      toast(`🎾 ${f.name} brought the ball back! Good job, ${f.name}! 💛 (press T to throw again)`, 'good', 2400);
      this.cheerPet(f.who === 'walker' ? this.walker!.idx : f.who.idx, 'fun', 35);
      if (f.who !== 'walker') f.who.busy = false;
      else this.walker!.hop = 1.0;
      setTimeout(() => { if (this.fetch === f) { ball.removeFromParent(); this.fetch = null; } }, 600);
      f.phase = 'wait'; f.t = -99;
    }
    if (f.t > 20) this.endFetch();
  }
  private endFetch() {
    const f = this.fetch; if (!f) return;
    f.ball.removeFromParent();
    if (f.who !== 'walker') f.who.busy = false;
    this.fetch = null;
  }
  // ---- MORE GAMES with your pet: Tag, Hide and Seek, Dance Party (and Fetch) ------------------
  petGame: { kind: 'tag' | 'hide' | 'dance'; a: ZooAnimal; name: string; until: number; hx: number; hz: number; found: boolean; peekAt: number } | null = null;
  openPetGames() {
    if (this.modal || this.respawning) return;
    if (this.inPlayroom) {
      if (this.climb) return;
      this.openModal('pets', (box) => {
        box.innerHTML = '';
        box.append(this.head('🎮 Play with everyone!', false));
        const body = el('div', { class: 'modal-body' });
        const card = (emoji: string, title: string, desc: string, go: () => void) => { const c = el('button', { class: 'card', type: 'button' }, el('div', { class: 'place-art jungle', text: emoji }), el('div', { class: 'name', text: title }), el('div', { class: 'desc', text: desc })); c.addEventListener('click', () => { this.closeModal(); setTimeout(go, 60); }); return c; };
        body.append(el('div', { class: 'cards' },
          card('🎾', 'Fetch', 'Throw the ball and everyone races for it! (T)', () => { this.playroom.endGame(); this.throwBall(); }),
          card('🏃', 'Tag', 'You\'re IT first! Tag someone and THEY become IT — then everyone runs from them!', () => { this.playroom.startGame('tag', this.realTime, this.pos); toast('🏃 TAG! You\'re IT! Go tag someone!', 'gold', 2400); }),
          card('🙈', 'Hide and Seek', 'Close your eyes… everyone hides! Find them all.', () => {
            $('fade-text').textContent = '🙈 Close your eyes… 10… 9… 8… 3… 2… 1… Ready or not, here I come!'; $('fade').classList.add('on');
            this.later(1.2, () => { this.playroom.startGame('hide', this.realTime, this.pos); });
            this.later(2.2, () => { $('fade').classList.remove('on'); toast('🙈 Where is everybody? Look behind the slide, in the ball pit, in the tunnel…', 'gold', 3200); });
          }),
          card('💃', 'Dance Party', 'Music on! Everyone dances around you!', () => { this.playroom.startGame('dance', this.realTime, this.pos); this.audio.celebrate(); toast('💃🕺 DANCE PARTY! 🎶', 'gold', 2400); }),
        ));
        box.append(body);
      });
      return;
    }
    const hi = this.inZoo ? this.zoo.habitatAt(this.pos.x, this.pos.z) : -1;
    const a0 = hi >= 0 ? this.zoo.animals[hi] : null, a = a0 && !a0.escaped && !a0.sneaking ? a0 : null;
    if (!a) { toast('🎮 Go into one of your pets\' habitats in the Magic Zoo to play games together!', '', 2800); return; }
    const name = this.save.myPets[hi].name;
    this.openModal('pets', (box) => {
      box.innerHTML = '';
      box.append(this.head(`🎮 Play with ${name}`, false));
      const body = el('div', { class: 'modal-body' });
      const game = (emoji: string, title: string, desc: string, go: () => void) => {
        const c = el('button', { class: 'card', type: 'button' }, el('div', { class: 'place-art jungle', text: emoji }), el('div', { class: 'name', text: title }), el('div', { class: 'desc', text: desc }));
        c.addEventListener('click', () => { this.closeModal(); setTimeout(go, 60); });
        return c;
      };
      body.append(el('div', { class: 'cards' },
        game('🎾', 'Fetch', `Throw the ball and ${name} brings it back. (T)`, () => this.throwBall()),
        game('🏃', 'Tag', `${name} runs away. Catch it before time runs out!`, () => this.startPetGame('tag', a, name)),
        game('🙈', 'Hide and Seek', `Close your eyes… ${name} hides. Can you find it?`, () => this.startPetGame('hide', a, name)),
        game('💃', 'Dance Party', `Music on! You and ${name} dance together.`, () => this.startPetGame('dance', a, name)),
      ));
      box.append(body);
    });
  }
  private startPetGame(kind: 'tag' | 'hide' | 'dance', a: ZooAnimal, name: string) {
    if (this.fetch) this.endFetch();
    a.busy = true;
    this.petGame = { kind, a, name, until: this.now + (kind === 'tag' ? 25 : kind === 'hide' ? 45 : 7), hx: a.x, hz: a.z, found: false, peekAt: 0 };
    if (kind === 'tag') toast(`🏃 Tag! ${name} is running away. Catch it! (25 seconds)`, 'gold', 2600);
    if (kind === 'dance') { toast(`💃 Dance party with ${name}! 🎶`, 'gold', 2400); this.audio.celebrate(); }
    if (kind === 'hide') {
      // close your eyes while your pet hides behind something
      $('fade-text').textContent = `🙈 Close your eyes… 3… 2… 1… Ready or not, here I come!`;
      $('fade').classList.add('on');
      const p = a.pen, corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      const [fx, fz] = corners[Math.floor(Math.random() * 4)];
      this.petGame.hx = p.x + fx * (p.w / 2 - 1.3); this.petGame.hz = p.z + fz * (p.d / 2 - 1.3);
      a.x = this.petGame.hx; a.z = this.petGame.hz; a.rig.root.position.set(a.x, 0, a.z); a.rig.root.visible = false;
      this.later(1.8, () => { $('fade').classList.remove('on'); toast(`🙈 Where is ${name}? Look carefully… walk up to its hiding spot!`, 'gold', 2800); });
    }
  }
  /** A zoo pet being petted: eyes closed, happy wiggle, facing you. */
  private cuddle: { a: ZooAnimal; until: number } | null = null;
  private updateCuddle(dt: number) {
    const c = this.cuddle; if (!c) return;
    const a = c.a, rig = a.rig;
    if (this.now > c.until || this.petGame || this.fetch) { if (!this.petGame && !(this.fetch && this.fetch.who === a)) a.busy = false; this.cuddle = null; return; }
    a.yaw = Math.atan2(this.pos.x - a.x, this.pos.z - a.z);
    rig.root.position.set(a.x, Math.abs(Math.sin(this.realTime * 8)) * 0.12, a.z); rig.root.rotation.y = a.yaw;
    animateRig(rig, dt, { speed: 0, airborne: false, attack: null, attackT: 0, windup: 0 });
    rig.body.rotation.z = Math.sin(this.realTime * 10) * 0.12;
    for (const e of rig.eyes) e.scale.y = (e.userData.sy ?? 1) * 0.15;   // happy closed eyes
    if (rig.tail) rig.tail.rotation.y = Math.sin(this.realTime * 18) * 0.7;  // wag wag
  }
  private updatePetGame(dt: number) {
    const g = this.petGame; if (!g) return;
    const a = g.a, rig = a.rig, p = a.pen;
    if (!this.inZoo || !this.zoo.animals.includes(a)) { this.endPetGame(); return; }
    const d = Math.hypot(this.pos.x - a.x, this.pos.z - a.z);
    let speed = 0;
    if (g.kind === 'tag') {
      // run away from you (staying inside the habitat)
      if (d < 6) {
        let ax = a.x - this.pos.x, az = a.z - this.pos.z; const n = Math.hypot(ax, az) || 1; ax /= n; az /= n;
        const st = 3.6 * dt; a.x += ax * st; a.z += az * st; speed = 3.6;
        const hx = p.w / 2 - 0.8, hz = p.d / 2 - 0.8;
        if (Math.abs(a.x - p.x) > hx) { a.x = p.x + Math.sign(a.x - p.x) * hx; a.z += (Math.random() < 0.5 ? 1 : -1) * st * 2; }
        if (Math.abs(a.z - p.z) > hz) { a.z = p.z + Math.sign(a.z - p.z) * hz; a.x += (Math.random() < 0.5 ? 1 : -1) * st * 2; }
        a.yaw = Math.atan2(ax, az);
      }
      if (d < 1.1) { this.winPetGame(`🏃 Tag! You caught ${g.name}! You win! 🏆`); return; }
      if (this.now > g.until) { toast(`😄 ${g.name} got away! Great running though. Play again?`, 'good', 2600); this.endPetGame(); return; }
    } else if (g.kind === 'hide') {
      if (this.now > g.peekAt) { g.peekAt = this.now + 4; this.effects.push(sparkleBurst(this.scene, new THREE.Vector3(a.x, 0.6, a.z), 0xffffff, 4)); }   // a little rustle gives you a hint
      if (d < 1.8) { rig.root.visible = true; this.winPetGame(`🙈 Found you! ${g.name} jumps out: "Peekaboo!" 🎉`); return; }
      if (this.now > g.until) { rig.root.visible = true; toast(`🙈 Here I am! ${g.name} was hiding in the corner. Play again?`, 'good', 2600); this.endPetGame(); return; }
    } else {
      // dance! your pet wiggles and spins, music notes everywhere
      const t = this.realTime;
      a.yaw += dt * 3;
      if (Math.random() < dt * 3) this.effects.push(sparkleBurst(this.scene, new THREE.Vector3(a.x, rig.height + 0.5, a.z), [0xff6a9a, 0xffd34a, 0x7ab0ff][Math.floor(Math.random() * 3)], 5));
      if (Math.random() < dt * 1.5) this.audio.squeak();
      this.rig.root.rotation.y += Math.sin(t * 6) * 0.06;
      if (this.now > g.until) { this.winPetGame(`💃 What a dance party! ${g.name} had SO much fun! 🎶`); return; }
    }
    rig.root.position.set(a.x, 0, a.z); rig.root.rotation.y = a.yaw;
    animateRig(rig, dt, { speed, airborne: false, attack: null, attackT: 0, windup: 0 });
    if (g.kind === 'dance') { rig.body.rotation.z = Math.sin(this.realTime * 9) * 0.35; rig.body.position.y = Math.abs(Math.sin(this.realTime * 9)) * 0.12; }
  }
  private winPetGame(msg: string) {
    const g = this.petGame!;
    this.cheerPet(g.a.idx, 'fun', 45);
    this.effects.push(sparkleBurst(this.scene, new THREE.Vector3(g.a.x, g.a.rig.height + 0.4, g.a.z), 0xff6a9a, 18));
    this.audio.celebrate();
    toast(msg, 'gold', 3000);
    this.endPetGame();
  }
  private endPetGame() {
    const g = this.petGame; if (!g) return;
    g.a.busy = false; g.a.rig.root.visible = true;
    this.petGame = null;
  }
  // ---- PET NEEDS: food, play and walks. Forget them and your pets get sad, then angry! ------------
  private needsTimer = 0;
  private giftCheckAt = 0;
  /** Send some of your coins to another player. */
  openSendCoins() {
    const P = getProfiles(), me = activeProfile();
    const others = P.list.filter((q) => q.id !== me.id);
    let to = others[0]?.id ?? '', amount = Math.min(5, this.save.coins);
    this.openModal('players', (box) => {
      const draw = () => {
        box.innerHTML = '';
        box.append(this.head('🪙 Send coins', true));
        const body = el('div', { class: 'modal-body' });
        if (!others.length) {
          body.append(el('p', { text: 'There\'s nobody else to send coins to yet! Add another player first: tap your name at the top-left, then "➕ Add a new player".' }));
          box.append(body); return;
        }
        body.append(el('p', { text: `You have ${this.save.coins} coins. Who do you want to send coins to?` }));
        const who = el('div', { class: 'action-row', style: 'flex-wrap:wrap' });
        for (const q of others) who.append(button(`${q.id === to ? '✅ ' : ''}${q.girl ? '👧' : '👦'} ${q.name}`, q.id === to ? 'btn-green btn-small' : 'btn-small', () => { to = q.id; draw(); }));
        body.append(who);
        body.append(el('p', { text: 'How many coins?' }));
        const amt = el('div', { class: 'action-row', style: 'flex-wrap:wrap;align-items:center' });
        amt.append(button('➖', 'btn-small', () => { amount = Math.max(1, amount - 1); draw(); }, amount <= 1));
        amt.append(el('span', { class: 'coin-amount', text: `🪙 ${amount}`, style: 'font-size:1.6rem;font-weight:900;min-width:90px;text-align:center' }));
        amt.append(button('➕', 'btn-small', () => { amount = Math.min(this.save.coins, amount + 1); draw(); }, amount >= this.save.coins));
        for (const n of [1, 5, 10, 25, 50, 100]) if (n <= this.save.coins) amt.append(button(String(n), n === amount ? 'btn-green btn-small' : 'btn-small', () => { amount = n; draw(); }));
        body.append(amt);
        const name = others.find((q) => q.id === to)?.name ?? '';
        const can = this.save.coins > 0 && amount > 0 && amount <= this.save.coins;
        body.append(el('div', { class: 'action-row' }, button(can ? `🎁 Send ${amount} coin${amount === 1 ? '' : 's'} to ${name}` : '🪙 You don\'t have any coins to send yet', 'btn-shop', () => {
          if (!can) return;
          if (!sendCoins(to, me.name, amount)) { toast('😕 Couldn\'t send the coins. Try again!', 'bad', 2000); return; }
          this.save.coins -= amount; this.persist(); this.audio.coin?.();
          this.closeModal();
          toast(`🎁 You sent ${amount} coin${amount === 1 ? '' : 's'} to ${name}! They'll get them next time they play. 💛`, 'good', 3600);
        }, !can)));
        body.append(el('p', { class: 'muted', text: 'Coins can go to any player on this computer or tablet.' }));
        box.append(body);
      };
      draw();
    }, true);
  }
  private needsSaveAt = 0;
  private moodToastAt = -99;
  private lastMood = new Map<string, string>();
  static needOf(q: { food?: number; fun?: number; walkies?: number }) { return { food: q.food ?? 80, fun: q.fun ?? 80, walkies: q.walkies ?? 80 }; }
  static moodOf(q: { food?: number; fun?: number; walkies?: number }): 'happy' | 'sad' | 'angry' {
    const n = Game.needOf(q), m = Math.min(n.food, n.fun, n.walkies);
    return m >= 55 ? 'happy' : m >= 30 ? 'sad' : 'angry';
  }
  private wantOf(q: { food?: number; fun?: number; walkies?: number }) {
    const n = Game.needOf(q);
    const low = Math.min(n.food, n.fun, n.walkies);
    return low === n.food ? 'some food 🍎' : low === n.fun ? 'to play 🎾' : 'a walk 🦮';
  }
  /** Give a pet a boost (feeding, playing, petting, walks). */
  cheerPet(i: number, what: 'food' | 'fun' | 'walkies', amount: number) {
    const q = this.save.myPets[i]; if (!q) return;
    const n = Game.needOf(q);
    q[what] = Math.min(100, n[what] + amount);
    if (q.food === undefined) q.food = n.food; if (q.fun === undefined) q.fun = n.fun; if (q.walkies === undefined) q.walkies = n.walkies;
    this.zoo.setMood(i, Game.moodOf(q));
  }
  private updateNeeds(dt: number) {
    this.needsTimer += dt;
    if (this.needsTimer < 1) return;
    const step = this.needsTimer; this.needsTimer = 0;
    // presents from other players?
    if (this.now > this.giftCheckAt) {
      this.giftCheckAt = this.now + 3;
      const gifts = this.started ? takeGifts() : [];
      if (gifts.length) {
        const total = gifts.reduce((a, g2) => a + g2.amount, 0);
        this.save.coins += total; this.persist(); this.audio.celebrate();
        const who = [...new Set(gifts.map((g2) => g2.from))].join(' and ');
        toast(`🎁 ${who} sent you ${total} coin${total === 1 ? '' : 's'}! 🪙 Say thank you!`, 'gold', 4200);
      }
    }
    if (!this.save.happyBoost) { this.save.happyBoost = true; for (const q of this.save.myPets) { q.food = Math.max(q.food ?? 80, 85); q.fun = Math.max(q.fun ?? 80, 85); q.walkies = Math.max(q.walkies ?? 80, 85); } }
    this.save.myPets.forEach((q, i) => {
      const n = Game.needOf(q);
      // needs run down quite fast: look after your pets or they get grumpy! (about 8–10 minutes from full to empty)
      q.food = Math.max(0, n.food - step * 100 / 540);
      q.fun = Math.max(0, n.fun - step * 100 / 480);
      q.walkies = Math.max(0, n.walkies - step * 100 / 600);
      if (this.walker?.idx === i || this.pack.some((m) => m.idx === i)) { q.walkies = Math.min(100, q.walkies + step * 6); q.fun = Math.min(100, q.fun + step * 1.5); }
      if (this.riding?.petIdx === i) q.fun = Math.min(100, q.fun + step * 2);
      if (this.inPlayroom) { q.fun = Math.min(100, q.fun + step * 1.5); q.walkies = Math.min(100, q.walkies + step * 1); }
      const mood = Game.moodOf(q);
      this.zoo.setMood(i, mood);
      const before = this.lastMood.get(q.name);
      this.lastMood.set(q.name, mood);
      if (before && before !== mood && mood !== 'happy' && this.now - this.moodToastAt > 12) {
        this.moodToastAt = this.now;
        toast(mood === 'angry' ? `😠 ${q.name} is getting ANGRY! It needs ${this.wantOf(q)}.` : `😢 ${q.name} is sad. It wants ${this.wantOf(q)}.`, 'bad', 3400);
      }
      if (before && before !== 'happy' && mood === 'happy') toast(`😊 ${q.name} is happy again! 💛`, 'good', 2200);
    });
    for (let i = this.save.myPets.length; i < ZOO_SLOTS; i++) this.zoo.setMood(i, null);
    if (this.now > this.needsSaveAt) { this.needsSaveAt = this.now + 15; this.persist(); }
  }
  private zooPenNear() { return this.zoo.pens.findIndex((p) => Math.hypot(p.front.x - this.pos.x, p.front.z - this.pos.z) < 2.4); }
  private secretDoorNear() { return this.secrets.doors.find((d) => Math.hypot(this.pos.x - d.front.x, this.pos.z - d.front.z) < 2.4) ?? null; }
  private updateSecrets(dt: number) {
    this.save.secretMaps ??= []; this.save.secretsOpened ??= []; this.save.secretChests ??= [];
    this.secrets.update(dt, this.realTime, this.pos, this.save.secretMaps, this.save.secretsOpened);
    this.secrets.room.visible = this.inSecret;
    if (this.respawning || this.pos.z < -300) return;
    for (const m of this.secrets.maps) {
      if (!m.group.visible) continue;
      const dx = this.pos.x - m.spot.mapX, dz = this.pos.z - m.spot.mapZ;
      if (dx * dx + dz * dz < 1.6 && Math.abs(this.pos.y - m.baseY) < 2) {
        this.save.secretMaps.push(m.spot.id);
        this.audio.purchase();
        this.effects.push(sparkleBurst(this.scene, m.group.position.clone().setY(m.baseY + 0.5), 0xb07aff, 22));
        toast(`📜 You found a SECRET MAP! It shows the way into "${m.spot.name}". Look for ❓ on your mini-map!`, 'gold', 4200);
        this.persist();
      }
    }
  }
  /** Solve 3 math problems in a row to unlock a secret door. */
  private unlockSecret(s: SecretSpot) {
    const n = 3;
    const step = (k: number) => this.mathChallenge(`🗝️ ${s.name}: problem ${k} of ${n}`, k === 1 ? 'Solve all 3 problems to open the secret door!' : k === n ? 'Last one!' : 'Great! Keep going!', () => {
      if (k < n) { setTimeout(() => step(k + 1), 150); return; }
      this.save.secretsOpened!.push(s.id); this.persist();
      this.audio.gate();
      const d = this.secrets.doors.find((q) => q.spot.id === s.id)!;
      this.effects.push(sparkleBurst(this.scene, new THREE.Vector3(d.front.x, this.pos.y + 1.2, d.front.z), 0xffe9a0, 30));
      toast(`✨ The secret door creaks open! Press A to go inside ${s.name}! (${this.save.secretsOpened!.length}/${SECRET_SPOTS.length} secret places found)`, 'gold', 4200);
    }, () => true);
    step(1);
  }
  private secretExit: { x: number; z: number; yaw: number } | null = null;
  enterSecret(s: SecretSpot) {
    if (this.respawning) return;
    const d = this.secrets.doors.find((q) => q.spot.id === s.id)!;
    this.secretExit = { x: d.front.x, z: d.front.z, yaw: s.facing };
    this.respawning = true;
    $('fade-text').textContent = `✨ Sneaking into ${s.name}…`;
    $('fade').classList.add('on');
    this.later(0.6, () => {
      this.secrets.buildRoom(s, (this.save.secretChests ?? []).includes(s.id));
      this.pos.set(SECRET_ROOM.x, 0, SECRET_ROOM.z + SECRET_ROOM.r - 4.2); this.vy = 0; this.yaw = Math.PI; this.grounded = true; this.groundY = 0; this.lunge = null;
      this.cam.reset(this.yaw, true);
      for (const p of this.pets) if (p.following) { p.x = this.pos.x; p.z = this.pos.z + 1; }
      $('fade').classList.remove('on');
      this.later(0.3, () => { this.respawning = false; });
      setTimeout(() => toast((this.save.secretChests ?? []).includes(s.id) ? `✨ ${s.name}. You've already found this treasure!` : `✨ Wow! ${s.name}! There's a treasure chest…`, 'gold', 3000), 400);
    });
  }
  exitSecret() {
    if (this.respawning || !this.secretExit) return;
    const e = this.secretExit;
    this.respawning = true;
    $('fade-text').textContent = '🌳 Back outside…';
    $('fade').classList.add('on');
    this.later(0.5, () => {
      const y = this.world.collision.groundAt(e.x, e.z, 60, PHYSICS.stepUp);
      this.pos.set(e.x, y, e.z); this.vy = 0; this.yaw = e.yaw; this.grounded = true; this.groundY = y;
      this.cam.reset(this.yaw, true);
      $('fade').classList.remove('on');
      this.later(0.3, () => { this.respawning = false; });
    });
  }
  private openSecretChest() {
    const s = this.secrets.roomFor; if (!s) return;
    (this.save.secretChests ??= []).push(s.id);
    this.secrets.openChest();
    const treats: FoodType[] = ({ forest: ['goldenApple', 'truffle'], savanna: ['starfruit', 'goldenMango'], swamp: ['lotus', 'goldenMushroom'], village: ['cake', 'applePie'], antarctica: ['goldenFish', 'goldenFish'] } as Record<string, FoodType[]>)[s.zone] ?? ['goldenApple'];
    for (const t of treats) if (this.bagTotal() < BAG_LIMIT) this.save.bag[t] = (this.save.bag[t] ?? 0) + 1;
    this.spawnReward(40, false);
    this.audio.celebrate();
    this.effects.push(sparkleBurst(this.scene, new THREE.Vector3(SECRET_ROOM.x, 1.2, SECRET_ROOM.z - 3.2), 0xffd34a, 40));
    this.persist();
    toast(`🎁 TREASURE! ${treats.map((t) => FOOD_NAMES[t]).join(' and ')} went into your bag, and 40 coins! Jump into the coin to collect it. (${this.save.secretChests!.length}/${SECRET_SPOTS.length} treasures)`, 'gold', 4600);
  }
  /** Mode 2: animals are faster and tougher, and you're faster too. */
  setMode(level: 1 | 2) {
    const was = GAME_MODE.level;
    GAME_MODE.level = level; this.save.mode = level; this.persist();
    for (const o of this.opps) if (o.alive) o.hp = Math.min(o.maxHp, Math.round(o.hp * (level === 2 && was === 1 ? MODE2.oppHealth : level === 1 && was === 2 ? 1 / MODE2.oppHealth : 1)));
    this.audio.click();
    toast(level === 2 ? '⚡ Mode 2! Animals are faster and tougher… but so are you! 💨' : '🙂 Mode 1: back to normal.', level === 2 ? 'gold' : 'good', 2600);
    $('mode-chip').hidden = level !== 2;
  }
  // ---- Animals sometimes fight each other: you can watch from a safe distance
  private brawlAt = 30;
  private brawlPair: { a: Opponent; b: Opponent; ends: number } | null = null;
  private updateBrawls() {
    if (this.brawlPair && this.now > this.brawlPair.ends) {
      const { a, b } = this.brawlPair; this.brawlPair = null;
      if (a.alive && b.alive && !a.aggro && !b.aggro && a.pos.distanceTo(this.pos) < 45) {
        const [w, l] = a.state === 'idle' ? [a, b] : [b, a];
        toast(`🏆 The ${w.spawn.name} won the fight! The ${l.spawn.name} ran away.`, 'good', 2600);
      }
    }
    if (this.now < this.brawlAt || this.brawlPair || !this.started || this.respawning || this.pos.z < -300) return;
    this.brawlAt = this.now + 25 + Math.random() * 25;
    const cands = this.opps.filter((o) => o.alive && !o.spawn.hunter && !o.aggro && !o.brawl && !o.spawn.training && o.pos.distanceTo(this.pos) < 32 && o.pos.distanceTo(this.pos) > 6);
    for (const a of cands) {
      const b = cands.find((o) => o !== a && o.spawn.zone === a.spawn.zone && o.pos.distanceTo(a.pos) < 16);
      if (!b) continue;
      const aWins = a.stats.rating > b.stats.rating || (a.stats.rating === b.stats.rating && Math.random() < 0.5);
      a.brawl = { foe: b, t: 6, hit: 0, winner: aWins };
      b.brawl = { foe: a, t: 6, hit: 0.3, winner: !aWins };
      this.brawlPair = { a, b, ends: this.now + 6.3 };
      this.audio.growl();
      toast(`👀 Look! The ${a.spawn.name} and the ${b.spawn.name} are having a fight! Watch from a safe distance…`, 'gold', 3200);
      return;
    }
  }
  private onBrawlHit(a: Opponent, b: Opponent) {
    if (a.pos.distanceTo(this.pos) > 30) return;
    if (Math.random() < 0.5) this.audio.bite(); else this.audio.scratch();
    this.effects.push(sparkleBurst(this.scene, b.pos.clone().setY(b.pos.y + b.rig.height * 0.6), 0xffffff, 6));
  }
  private fightAt = 40;
  /** Now and then a wild animal nearby decides to pick a fight with you. */
  private updateChallengers() {
    if (this.now < this.fightAt || !this.started || this.respawning || this.modal || this.captive || this.save.tutorialStep < 4) return;
    this.fightAt = this.now + 22 + Math.random() * 18;
    if (this.pos.z < -300 || Math.hypot(this.pos.x - WORLD.home.x, this.pos.z - WORLD.home.z) < DINOS.safeHomeRadius) return;
    if (this.opps.some((o) => o.engaged)) return;          // already in a fight
    const near = this.opps.filter((o) => o.alive && !o.spawn.hunter && !o.spawn.training && o.pos.distanceTo(this.pos) < 16)
      .sort((a, b) => a.pos.distanceTo(this.pos) - b.pos.distanceTo(this.pos));
    const o = near[0]; if (!o) return;
    o.pickFight();
    this.audio.growl();
    const st = this.strengthOf(o).cls;
    toast(`😠 The ${o.spawn.name} wants to fight you! ${st === 'stronger' ? "It's STRONGER than you, so maybe run! 🏃" : 'Fight back with 1 and 2, or run away!'}`, 'bad', 3200);
  }
  private updateNight(dt: number) {
    const tod = this.world.timeOfDay;
    const night = tod >= 0.6 && tod < 0.97;
    if (night && !this.wasNight) {
      this.audio.roar();
      toast('🌙 Night is here… the dinosaurs are coming out! Hide in your house!', 'bad', 4000);
      this.dinoTimer = 0;
    }
    if (!night && this.wasNight) {
      for (const d of [...this.dinos, ...this.iceMonsters]) if (d.alive) { d.calmDown(); d.state = 'defeated'; d.fade = 0; }
      toast('☀️ Morning! The night monsters ran away.', 'good', 3000);
      this.dayCount++;
    }
    this.wasNight = night;
    if (!night) return;
    this.dinoTimer -= dt;
    if (this.dinoTimer > 0) return;
    this.dinoTimer = 6;
    for (const d of this.dinos) {
      const far = d.alive && !d.engaged && d.pos.distanceTo(this.pos) > 75;
      const ready = d.state === 'gone' && this.now >= d.respawnAt;
      if (far || ready) this.placeDino(d);
    }
    // dinosaurs hunt the other animals too!
    for (const d of this.dinos) {
      if (!d.alive || d.aggro || d.brawl || d.state === 'gone') continue;
      const prey = this.opps.filter((o) => o.alive && !o.spawn.hunter && !o.aggro && !o.brawl && o.spawn.zone === d.spawn.zone && o.pos.distanceTo(d.pos) < 30)
        .sort((a, b) => a.pos.distanceTo(d.pos) - b.pos.distanceTo(d.pos))[0];
      if (!prey) continue;
      d.brawl = { foe: prey, t: 7, hit: 0, winner: true };
      prey.brawl = { foe: d, t: 7, hit: 0.4, winner: false };
      this.hunts.push({ dino: d, prey, ends: this.now + 7.2 });
    }
    if (zoneAt(this.pos.x, this.pos.z) === 'antarctica') for (const d of this.iceMonsters) {
      const far = d.alive && !d.engaged && d.pos.distanceTo(this.pos) > 75;
      if (far || (d.state === 'gone' && this.now >= d.respawnAt)) this.placeIceMonster(d);
    }
  }
  /** An ice monster climbs out of the water near you. */
  private placeIceMonster(d: Opponent) {
    for (let i = 0; i < 160; i++) {
      const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 40;
      const x = this.pos.x + Math.cos(a) * r, z = this.pos.z + Math.sin(a) * r;
      if (zoneAt(x, z) !== 'antarctica') continue;
      const B = regionBounds(x, z);
      if (x < B.minX + 3.5 || x > B.maxX - 3.5 || z < B.minZ + 3.5 || z > B.maxZ - 3.5) continue;
      const h = terrainHeight(x, z);
      if (h > -0.2 || h < -4) continue;              // IN the water (lagoon, sea or the iceberg pool) — it climbs out!
      if (this.world.collision.blocked(x, z, h + 0.5, 1.2)) continue;
      d.spawn.x = x; d.spawn.z = z;
      d.respawn();
      this.emerging.set(d, this.now);
      this.effects.push(sparkleBurst(this.scene, new THREE.Vector3(x, 0.3, z), 0x9fdcff, 34));
      this.audio.splash();
      if (this.now - this.monsterToastAt > 20) { this.monsterToastAt = this.now; toast('🌊 SPLASH! An ice monster is climbing out of the water! Run!', 'bad', 3000); this.audio.roar(); }
      return;
    }
  }
  private monsterToastAt = -99;
  /** Ice monsters rising up out of the water (they start deep under and climb out). */
  private emerging = new Map<Opponent, number>();
  private updateEmerging() {
    for (const [o, t0] of this.emerging) {
      const k = (this.now - t0) / 1.8;
      if (k >= 1 || !o.alive) { this.emerging.delete(o); continue; }
      o.pos.x = o.spawn.x; o.pos.z = o.spawn.z;            // stays put while it climbs out
      o.rig.root.position.set(o.pos.x, o.pos.y - (1 - k) * 3, o.pos.z);
      if (Math.random() < 0.25) this.effects.push(sparkleBurst(this.scene, new THREE.Vector3(o.pos.x, 0.2, o.pos.z), 0xdff4ff, 6));
    }
  }
  /** Put a dinosaur somewhere 30–50 m from you, in your area, away from your home. */
  private placeDino(d: Opponent) {
    const zone = zoneAt(this.pos.x, this.pos.z);
    if (!DINOS.zones.includes(zone) || this.indoors) return;
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 20;
      const x = this.pos.x + Math.cos(a) * r, z = this.pos.z + Math.sin(a) * r;
      const B = regionBounds(x, z);
      if (x < B.minX + 6 || x > B.maxX - 6 || z < B.minZ + 6 || z > (z > 200 ? B.maxZ : Math.min(B.maxZ, WORLD.maxZ)) - 6) continue;
      if (zoneAt(x, z) !== zone || inPit(x, z, 5) || terrainHeight(x, z) < (zone === 'jungle' ? 0.3 : -0.3)) continue;
      if (Math.hypot(x - WORLD.home.x, z - WORLD.home.z) < DINOS.safeHomeRadius + 12) continue;
      if (Math.abs(Math.abs(x) - WORLD.zoneEdge) < 5) continue;
      if (this.world.collision.blocked(x, z, terrainHeight(x, z) + 0.5, 1.5)) continue;
      d.spawn.x = x; d.spawn.z = z; d.spawn.zone = zone;
      d.respawn();
      return;
    }
  }

  // ---------------- House: door, inside, bed, fridge, pot ----------------
  /** Inside your house (the barn is a separate room). */
  get indoors() { return this.pos.z < -300 && this.pos.z > -700 && this.pos.x < 100; }
  get inBarn() { return this.pos.z < -300 && this.pos.z > -700 && this.pos.x >= 100; }
  /** Inside one of the secret places. */
  get inSecret() { return this.pos.z < -700 && this.pos.z > -1000; }
  /** Inside the Magic Zoo (it's huge in there!). */
  get inZoo() { return this.pos.z < -1000 && this.pos.z > -1400; }
  /** Inside the Big Play Room with all your pets. */
  get inPlayroom() { return this.pos.z < -1400 && this.pos.z > -1700; }
  /** Inside your Aquarium. */
  get inAquarium() { return this.pos.z < -1700; }

  /** Stairs buttons: hop to the top or bottom of the stairs. */
  useStairs(goUp: boolean) {
    if (this.respawning) return;
    const I = this.interior, t = goUp ? I.stairsTop : I.stairsBottom;
    this.respawning = true;
    $('fade-text').textContent = goUp ? '⬆️ Up the stairs…' : '⬇️ Down the stairs…';
    $('fade').classList.add('on');
    this.later(0.35, () => {
      this.pos.set(t.x, t.y ?? 0, goUp ? t.z - 0.6 : t.z + 0.4);
      this.vy = 0; this.grounded = true; this.groundY = t.y ?? 0;
      this.yaw = goUp ? -Math.PI / 2 : Math.PI;
      this.cam.reset(this.yaw, true);
      $('fade').classList.remove('on');
      this.later(0.2, () => { this.respawning = false; });
    });
  }
  houseFun(what: 'bath' | 'teeth' | 'potty' | 'toys') {
    const lines = {
      bath: ['🛁 Splish splash! You\'re squeaky clean! The rubber duck says quack! 🦆', 0x9fe8ff],
      teeth: ['🪥 Brush brush brush! Your teeth are sparkly clean! ✨', 0xffffff],
      potty: ['🚽 Flush! 🌀 Don\'t forget to wash your hands!', 0x9fd0ff],
      toys: ['🧸 Wheee! Playtime is the best! 🎈', 0xffd34a],
    } as const;
    const [text, color] = lines[what];
    this.effects.push(sparkleBurst(this.scene, this.pos.clone().setY(this.pos.y + 1), color, 18));
    ({ bath: () => this.audio.splash(), teeth: () => this.audio.brush(), potty: () => this.audio.flush(), toys: () => this.audio.squeak() })[what]();
    toast(text, 'good', 2600);
  }

  // ---- Your desk: a notebook to plan adventures and write ideas
  openNotebook() {
    this.openModal('notebook', (box) => {
      box.append(this.head('📓 My Notebook', false));
      const body = el('div', { class: 'modal-body' });
      const s = this.save;
      const zones = (['forest', 'savanna', 'swamp', 'village', 'antarctica'] as ZoneId[]).map((z) => `${s.visitedZones.includes(z) ? '✅' : '⬜'} ${ZONE_NAMES[z]}`);
      const stat = (label: string, value: string) => el('div', { class: 'nb-stat' }, el('div', { class: 'nb-val', text: value }), el('div', { class: 'nb-lbl', text: label }));
      body.append(
        el('div', { class: 'nb-goal' }, el('div', { class: 'obj-title', style: 'color:#9a6400', text: 'My goal right now' }), el('div', { style: 'font-weight:800;font-size:20px', text: this.objective().text }), el('div', { style: 'font-weight:700', text: this.objective().progress ?? '' })),
        el('div', { class: 'nb-stats' },
          stat('coins', String(s.coins)), stat('battles won', String(s.wins)), stat('lions beaten', String(s.lionWins)),
          stat('food found', String(s.foodCount)), stat('friends rescued', String(s.rescued.length)), stat('maps found', `${s.mapsFound.length}/6`), stat('secret places', `${(s.secretsOpened ?? []).length}/${SECRET_SPOTS.length}`),
          stat('animals owned', `${s.owned.length}/${SPECIES_ORDER.length}`), stat('home', HOMES[this.liveTier].name)),
        el('div', { class: 'col-title', style: 'margin-top:12px', text: '🗺️ Places I\'ve been' }),
        el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px 16px;font-weight:700' }, ...zones.map((z) => el('span', { text: z }))),
        el('div', { class: 'col-title', style: 'margin-top:12px', text: '✏️ My notes and ideas' }));
      const ta = el('textarea', { id: 'notebook-notes', rows: '6', maxlength: '2000', placeholder: 'Write your plans, ideas and secrets here…', 'aria-label': 'My notes' }) as HTMLTextAreaElement;
      ta.value = s.notes ?? '';
      ta.addEventListener('input', () => { s.notes = ta.value; this.persist(); });
      body.append(ta, el('p', { class: 'save-note', style: 'color:#4a5446;font-size:14px', text: '💾 Your notes are saved automatically.' }));
      box.append(body);
    });
  }

  // ---- Your family at home
  buildFamily() {
    for (const f of this.family) { f.rig.root.removeFromParent(); disposeRig(f.rig); f.bubble.remove(); if (f.col) this.world.collision.remove(f.col); }
    this.dinnerPlates = null;
    this.family = [];
    const B = this.interior.mainBounds;
    const mx = (B.minX + B.maxX) / 2, mz = (B.minZ + B.maxZ) / 2;
    const skins = SKINS.filter((k) => k.species === this.species);
    const members: [string, number, number, number, number][] = [
      ['Mom', mx - 0.7, mz - 1.9, 1.05, 0], ['Dad', mx - 1.8, mz - 1.1, 1.15, 1], ['Baby Pip', mx - 1.3, mz - 0.2, 0.6, 0],
    ];
    for (const [name, x, z, scale, skinIdx] of members) {
      // Mom and Baby Pip are girls too (a lion mom is a lioness, with no mane)
      const rig = buildPlayerAnimal(this.species, skins[Math.min(skinIdx, skins.length - 1)], name !== 'Dad');
      rig.root.scale.setScalar(scale); rig.height *= scale;
      rig.root.position.set(x, 0, name === 'Baby Pip' ? z + 0.1 - 0.1 : z);
      this.interior.group.add(rig.root);
      const bubble = el('div', { class: 'speech' }); bubble.style.display = 'none';
      $('labels').append(bubble);
      const col = this.world.collision.add({ kind: 'cyl', x, z, r: Math.max(0.3, rig.radius * scale * 0.8), top: 100, tall: true });
      this.family.push({ name, rig, x, z, dayX: x, dayZ: z, asleep: false, mode: 'day', bubble, bubbleUntil: 0, col });
    }
  }
  familyCtx(member: string): FamilyContext {
    return {
      species: this.def.name, member, girl: this.save.girl, playerName: activeProfile().name, hp: this.hp, maxHp: this.maxHp, coins: this.save.coins,
      night: this.world.daylight < 0.5, goal: this.objective().text, bagCount: this.bagTotal(), rescued: this.save.rescued.length, wins: this.save.wins,
    };
  }
  familySay(name: string, text: string, secs = 6) {
    const f = this.family.find((q) => q.name === name); if (!f) return;
    f.bubble.textContent = text;
    f.bubbleUntil = this.realTime + secs;
  }
  /** At night everyone goes to bed (Baby Pip sleeps in your bed); in the morning they get up. */
  /** Day: in the living room. Dinner: at the big table eating. Night: in bed (Baby Pip next to yours). */
  private familyBedtime() {
    const I = this.interior;
    const night = this.world.daylight < 0.45;
    const tod = this.world.timeOfDay;
    const dinner = !night && (this.seat === I.chair || (tod >= 0.46 && tod < 0.56));
    const mode: 'day' | 'dinner' | 'bed' = night ? 'bed' : dinner ? 'dinner' : 'day';
    let changed = false;
    for (const f of this.family) {
      if (f.following || f.caged || f.walkingHome || f.mode === mode) continue;
      f.mode = mode; f.asleep = mode === 'bed'; changed = true;
      if (f.col) { this.world.collision.remove(f.col); f.col = null; }
      if (mode === 'bed') {
        const spot = f.name === 'Mom' ? I.momBed : f.name === 'Dad' ? I.dadBed : (I.hasUpstairs ? I.babyBed : { x: I.bed.x, z: I.bed.z + 0.55, r: 1, y: 0.68 });
        f.x = spot.x; f.z = spot.z;
        f.rig.root.position.set(f.x, spot.y ?? 0.68, f.z);
        f.rig.root.rotation.y = 0;
      } else if (mode === 'dinner') {
        const seat = I.familySeats[f.name];
        f.x = seat.sitX; f.z = seat.sitZ;
        f.rig.root.position.set(f.x, seat.sitY, f.z);
        f.rig.root.rotation.y = seat.yaw;
      } else {
        f.x = f.dayX; f.z = f.dayZ;
        f.rig.root.position.set(f.x, 0, f.z);
        f.col = this.world.collision.add({ kind: 'cyl', x: f.x, z: f.z, r: Math.max(0.3, f.rig.radius * 0.8), top: 100, tall: true });
      }
    }
    // plates of food appear on the table for dinner
    if (changed || (mode === 'dinner') !== !!this.dinnerPlates) {
      if (mode === 'dinner' && !this.dinnerPlates) {
        const g = new THREE.Group();
        const dishes: FoodType[] = ['veggieStew', 'fishSoup', 'roastChicken', 'applePie', 'heartyStew', 'cake', 'sandwich'];
        for (const [who, at] of Object.entries(I.platesAt)) {
          const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.03, 18), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
          plate.position.set(at.x, 0.84, at.z); g.add(plate);
          const food = buildFoodMesh(dishes[(who.length * 7 + Math.floor(this.dayCount)) % dishes.length]);
          food.scale.setScalar(0.7); food.position.set(at.x, 0.86, at.z); g.add(food);
        }
        I.group.add(g);
        this.dinnerPlates = g;
        if (this.indoors) { this.familySay('Mom', 'Dinner time! Come sit with us! 🍽️', 4); this.audio.food(); }
      } else if (mode !== 'dinner' && this.dinnerPlates) {
        this.dinnerPlates.removeFromParent(); this.dinnerPlates = null;
      }
    }
  }

  private updateFamily(dt: number) {
    const home = this.indoors;
    this.familyBedtime();
    const w = window.innerWidth, h = window.innerHeight;
    this.family.forEach((f, k) => {
      if (f.walkingHome) {
        const door = this.doorFront();
        const dx = door.x - f.x, dz = door.z - f.z, d = Math.hypot(dx, dz);
        const far = Math.hypot(this.pos.x - f.x, this.pos.z - f.z) > 45;
        if (d < 0.8 || far || this.indoors || this.pos.z < -300) { this.finishFamilyWalk(f); return; }
        const step = Math.min(d, 3.2 * dt);
        f.x += (dx / d) * step; f.z += (dz / d) * step;
        f.rig.root.rotation.y = Math.atan2(dx, dz);
        f.rig.root.position.set(f.x, this.world.collision.groundAt(f.x, f.z, f.rig.root.position.y + 0.5, 0.4), f.z);
        f.rig.root.visible = true;
        animateRig(f.rig, dt, { speed: 3.2, airborne: false, attack: null, attackT: 0, windup: 0 });
      } else if (f.caged) {
        f.rig.root.visible = this.inHumanHouse === f.caged.house;
        if (f.rig.root.visible) {
          animateRig(f.rig, dt, { speed: 0, airborne: false, attack: null, attackT: 0, windup: 0 });
          if (this.realTime > f.bubbleUntil + 5) this.familySay(f.name, f.name === 'Baby Pip' ? 'Big sister! Help! 😢' : 'Sweetie! Over here! Open the cage! 🔓', 3);
        }
      } else if (f.following) {
        f.rig.root.visible = true;
        this.followYou(f, this.family.filter((q, j) => q.following && j < k).length, dt);
        if (f.trick) { f.trick.baseY = f.rig.root.position.y; if (this.realTime < f.trick.until) this.doTrick(f.rig, f.trick, dt); else f.trick = undefined; }
      }
      else {
      if (!home) { f.bubble.style.display = 'none'; return; }
      if (f.asleep && this.realTime > f.bubbleUntil + 4) { f.bubble.textContent = '💤'; f.bubbleUntil = this.realTime + 2.5; }
      // look at you when you're close (not while asleep)
      const d = Math.hypot(this.pos.x - f.x, this.pos.z - f.z);
      if (d < 6 && !f.asleep && f.mode !== 'dinner') {
        const target = Math.atan2(this.pos.x - f.x, this.pos.z - f.z);
        let dd = target - f.rig.root.rotation.y;
        while (dd > Math.PI) dd -= Math.PI * 2;
        while (dd < -Math.PI) dd += Math.PI * 2;
        f.rig.root.rotation.y += dd * Math.min(1, dt * 4);
      }
      animateRig(f.rig, dt, { speed: 0, airborne: false, attack: null, attackT: 0, windup: 0 });
      if (f.mode === 'dinner') {
        f.rig.head.rotation.x += Math.max(0, Math.sin(this.realTime * 5 + f.x * 3)) * 0.45; // munch munch
        if (this.realTime > f.bubbleUntil + 5 && Math.random() < dt * 0.4) this.familySay(f.name, f.name === 'Baby Pip' ? 'Nom nom nom! 😋' : ['Mmm, delicious! 😋', 'This is yummy!', 'I love family dinners! 💛'][Math.floor(Math.random() * 3)], 2.5);
      }
      if (f.name === 'Baby Pip' && !f.asleep && f.mode !== 'dinner') f.rig.root.position.y = Math.abs(Math.sin(this.realTime * 3)) * 0.06;
      if (f.asleep) sleepPose(f.rig, this.realTime + f.x);
      if (f.trick && !f.asleep) { if (this.realTime < f.trick.until) this.doTrick(f.rig, f.trick, dt); else { f.rig.root.position.y = f.trick.baseY; f.trick = undefined; } }
      if (f.asleep) { const by = f.name === 'Baby Pip' && this.interior.hasUpstairs ? (this.interior.babyBed.y ?? 0.68) : 0.68; f.rig.root.position.y = by + Math.sin(this.realTime * 1.5 + f.x) * 0.01; } // gentle sleepy breathing
      }
      const show = this.realTime < f.bubbleUntil && !this.modal;
      if (!show) { f.bubble.style.display = 'none'; return; }
      const p = new THREE.Vector3(f.x, f.rig.root.position.y + f.rig.height + 0.5, f.z).project(this.camera);
      if (p.z > 1) { f.bubble.style.display = 'none'; return; }
      f.bubble.style.display = 'block';
      f.bubble.style.transform = `translate(${(p.x * 0.5 + 0.5) * w}px, ${(-p.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
    });
    // now and then someone says something
    if (home && !this.modal && this.family.length && this.now > this.chatterAt && !this.family.every((f) => f.asleep)) {
      this.chatterAt = this.now + 16 + Math.random() * 10;
      const f = this.family[Math.floor(Math.random() * this.family.length)];
      if (!f.asleep) this.familySay(f.name, familyChatter(this.familyCtx(f.name), 'idle'));
    }
  }
  /** The animal you're fighting right now (your family and friends come and help!). */
  private fightTarget(): Opponent | null {
    let best: Opponent | null = null, bd = 16;
    for (const o of this.opps) { if (!o.engaged || o.spawn.hunter) continue; const d = o.pos.distanceTo(this.pos); if (d < bd) { bd = d; best = o; } }
    return best;
  }
  private helperCd = new WeakMap<object, number>();
  /** Where a helper should go: next to the animal you're fighting, or beside you. */
  private helperGoal(slot: number) {
    const o = this.fightTarget();
    if (!o) return { ...this.followSpot(slot), target: null as Opponent | null };
    const a = slot * 1.9 + 0.6, r = o.radius + 1.0;
    return { bx: o.pos.x + Math.cos(a) * r, bz: o.pos.z + Math.sin(a) * r, target: o };
  }
  /** A helper next to the animal you're fighting gives it a nip. */
  private helperAttack(key: object, x: number, z: number, o: Opponent | null, dmg: number, rig: AnimalRig) {
    if (!o || !o.alive) return;
    if (Math.hypot(o.pos.x - x, o.pos.z - z) > o.radius + 1.6) return;
    const cd = (this.helperCd.get(key) ?? 0) - 1 / 60;
    if (cd > this.now) return;
    this.helperCd.set(key, this.now + 1.1 + Math.random() * 0.5);
    rig.root.rotation.y = Math.atan2(o.pos.x - x, o.pos.z - z);
    if (o.spawn.hunter) this.helpedDinos.add(o);   // a dinosaur only becomes your pet if you beat it ALL BY YOURSELF
    const won = o.takeHit(dmg, new THREE.Vector3(x, o.pos.y, z));
    this.audio.bite();
    this.effects.push(sparkleBurst(this.scene, o.pos.clone().setY(o.pos.y + o.rig.height * 0.6), 0xffe0a0, 5));
    if (won) { this.onVictory(o); toast('💪 Teamwork! Your family and friends helped you win!', 'good', 2400); }
  }
  /** Where follower number `slot` walks: right beside you (left, right, then a bit further out), so you can see them. */
  private followSpot(slot: number) {
    const side = (slot % 2 ? 1 : -1) * (1.3 + Math.floor(slot / 2) * 1.0);
    const back = 0.3 + Math.floor(slot / 2) * 0.5;
    return {
      bx: this.pos.x - Math.sin(this.yaw) * back + Math.cos(this.yaw) * side,
      bz: this.pos.z - Math.cos(this.yaw) * back - Math.sin(this.yaw) * side,
    };
  }
  /** Your family and friends do what you ask! Returns their answer, or null if it wasn't something to do. */
  private obey(msg: string, who: { fam?: Game['family'][number]; pet?: Game['pets'][number] }): string | null {
    const m = ' ' + msg.toLowerCase().replace(/[^a-z' ]/g, ' ') + ' ';
    const has = (...w: string[]) => w.some((x) => m.includes(' ' + x + ' ') || m.includes(' ' + x + 's ') || (x.includes(' ') && m.includes(x)));
    const f = who.fam, p = who.pet;
    const rig = f?.rig ?? p?.rig; if (!rig) return null;
    const name = (f?.name ?? p!.name).split(' the ')[0];
    const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
    const trick = (kind: 'jump' | 'dance' | 'spin' | 'sit' | 'sleep', secs: number) => {
      const t = { kind, until: this.realTime + secs, baseY: rig.root.position.y };
      if (f) f.trick = t; else p!.trick = t;
    };
    if (p?.caged) return pick(['I can\'t, I\'m stuck in this cage! Please get me out! 😢', 'Help! Open the cage first! 🔓']);
    if (has('follow me', 'come with me', 'stay with me', 'let s go', 'lets go', 'come along', 'come on', 'follow')) {
      if (f) this.setFamilyFollow(f, true); else { p!.following = true; p!.settled = true; }
      return pick([`Okay! I'm right beside you! 🐾`, `Let's go on an adventure! 🎉`, `Coming! Wait for me! 🐾`]);
    }
    if (has('go home', 'stop following', 'stay here', 'stay', 'wait here', 'go back home')) {
      if (f) { if (f.following) this.sendFamilyHome(f); } else if (p!.following) this.sendPetHome(p!);
      return pick(['Okay! See you at home! 🏠', 'I\'ll wait for you at home! 💛', 'Bye bye! Come back soon! 👋']);
    }
    if (has('wake up', 'get up')) { if (f) f.trick = undefined; else p!.trick = undefined; return pick(['*yawn* I\'m awake! ☀️', 'Good morning! 🌞']); }
    if (has('go to sleep', 'go to bed', 'sleep', 'nap', 'take a nap', 'lie down')) { trick('sleep', 10); return pick(['Okay… zzz… 😴', 'Night night! 💤', '*yawn* Just a little nap… 💤']); }
    if (has('jump', 'hop')) { trick('jump', 3); return pick(['Boing boing! 🦘', 'Wheee! Look how high I can jump!', 'Jump jump jump! 🎉']); }
    if (has('dance', 'boogie', 'wiggle')) { trick('dance', 4); this.audio.celebrate(); return pick(['💃 Dance party! 🎶', 'Watch my moves! 🕺', 'La la la! 🎵']); }
    if (has('spin', 'turn around', 'twirl')) { trick('spin', 2.5); return pick(['Wheeee! 🌀', 'Spinny spin! I\'m dizzy! 😵‍💫']); }
    if (has('sit', 'sit down')) { trick('sit', 5); return pick(['Sitting nicely! 😊', 'Okay, I\'m sitting! 🪑']); }
    if (has('come here')) {
      const tx = this.pos.x + Math.sin(this.yaw) * 1.4, tz = this.pos.z + Math.cos(this.yaw) * 1.4;
      if (p && !p.following) { p.tx = tx; p.tz = tz; p.wait = 8; }
      else if (f && !f.following && this.indoors && f.mode === 'day') { f.dayX = tx; f.dayZ = tz; f.mode = undefined; }
      return pick(['Coming! 🏃', 'Here I am! 👋', 'What do you need? 😊']);
    }
    return null;
  }
  /** Play a trick the animal was asked to do (call after animateRig). */
  private doTrick(rig: AnimalRig, tr: NonNullable<Game['family'][number]['trick']>, dt: number) {
    const t = this.realTime;
    if (tr.kind === 'jump') rig.root.position.y = tr.baseY + Math.abs(Math.sin(t * 6)) * 0.5;
    else if (tr.kind === 'dance') { rig.body.rotation.z = Math.sin(t * 9) * 0.35; rig.body.position.y = Math.abs(Math.sin(t * 9)) * 0.08; rig.root.rotation.y += Math.sin(t * 3) * dt * 2; rig.head.rotation.z = -Math.sin(t * 9) * 0.3; }
    else if (tr.kind === 'spin') rig.root.rotation.y += dt * 9;
    else if (tr.kind === 'sit') { rig.body.position.y = -rig.height * 0.15; rig.body.rotation.x = -0.3; }
    else sleepPose(rig, t);
  }
  /** Mom, Dad or Baby Pip walking along beside you on an adventure. */
  private followYou(f: Game['family'][number], slot: number, dt: number) {
    const { bx, bz, target } = this.helperGoal(slot);
    const dx = bx - f.x, dz = bz - f.z, d = Math.hypot(dx, dz);
    let speed = 0;
    this.helperAttack(f, f.x, f.z, target, f.name === 'Baby Pip' ? 3 : 7, f.rig);
    if (d > 18 || this.respawning) { f.x = bx; f.z = bz; }
    else if (d > 0.4) {
      const v = Math.min(d * 3, 9), step = Math.min(d, v * dt);
      f.x += (dx / d) * step; f.z += (dz / d) * step; speed = v;
      f.rig.root.rotation.y = Math.atan2(dx, dz);
    }
    const y = this.world.collision.groundAt(f.x, f.z, this.pos.y + 0.5, 0.4);
    f.rig.root.position.set(f.x, y, f.z);
    animateRig(f.rig, dt, { speed: Math.min(speed, 4), airborne: false, attack: null, attackT: 0, windup: 0 });
  }
  setFamilyFollow(f: Game['family'][number], on: boolean) {
    if (!!f.following === on) return;
    f.following = on; f.asleep = false;
    if (on) {
      if (f.col) { this.world.collision.remove(f.col); f.col = null; }
      this.scene.add(f.rig.root);
      f.mode = undefined;
    } else {
      this.interior.group.add(f.rig.root);
      f.mode = undefined; // back to the right spot at home (bed, table or living room)
    }
  }
  openFamilyChat(name: string) {
    this.openModal('family', (box) => this.renderFamilyChat(box, name), true);
  }
  // ---- Family and friends sometimes start a conversation with you --------------------------
  private inviteAt = 45;
  private inviteFor: { name: string; friend: boolean; until: number } | null = null;
  private static OPENERS = [
    'Hey! Want to hear a joke? 😄', 'What was the best thing you did today?', 'Can we go on an adventure together? 🐾',
    'Guess what? I found a really shiny pebble! ✨', 'I\'m a bit hungry… are you? 🍎', 'What\'s your favourite food?',
    'Do you want to play a game? 🎲', 'I had the funniest dream last night! 😴', 'You\'re the best, did you know that? 💛',
    'What should we do next?', 'Have you seen any dinosaurs lately? 🦖', 'Tell me about your adventures!',
  ];
  private updateInvites() {
    const card = $('talk-invite');
    if (this.inviteFor && (this.realTime > this.inviteFor.until || this.modal)) { this.inviteFor = null; card.hidden = true; }
    if (this.now < this.inviteAt || this.modal || this.captive || this.respawning || !this.started || this.inviteFor) return;
    this.inviteAt = this.now + 70 + Math.random() * 50;
    const fam = this.family.filter((f) => !f.asleep && !f.caged && (f.following || this.indoors) && Math.hypot(f.x - this.pos.x, f.z - this.pos.z) < 9);
    const fr = this.pets.filter((p) => !p.caged && !p.asleep && p.rig.root.visible && Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 9);
    const all = [...fam.map((f) => ({ name: f.name, friend: false })), ...fr.map((p) => ({ name: p.name, friend: true }))];
    if (!all.length) return;
    const who = all[Math.floor(Math.random() * all.length)];
    const line = Game.OPENERS[Math.floor(Math.random() * Game.OPENERS.length)];
    (this.chats[who.name] ??= []).push({ from: 'them', text: line });
    if (who.friend) { const p = this.pets.find((q) => q.name === who.name); if (p) this.petSay(p, line, 8); } else this.familySay(who.name, line, 8);
    $('talk-invite-text').textContent = `💬 ${who.name.split(' the ')[0]}: “${line}”`;
    card.hidden = false;
    this.inviteFor = { ...who, until: this.realTime + 14 };
    this.audio.click();
  }
  private replyToInvite() {
    const w = this.inviteFor; if (!w) return;
    this.inviteFor = null; $('talk-invite').hidden = true;
    if (w.friend) this.openFriendChat(w.name); else this.openFamilyChat(w.name);
  }
  openOwnerChat() {
    const c = this.captive; if (!c) return;
    this.openModal('family', (box) => this.renderFamilyChat(box, c.owner, false, true), true);
  }
  openFriendChat(name: string) {
    this.openModal('family', (box) => this.renderFamilyChat(box, name, true), true);
  }
  private renderFamilyChat(box: HTMLElement, name: string, friends = false, human = false, petIdx = -1) {
    const myPet = petIdx >= 0 ? this.save.myPets[petIdx] : undefined;
    box.innerHTML = '';
    box.append(this.head(myPet ? `💬 Talk to ${myPet.name}` : human ? `💬 Talk to ${name}` : friends ? '💛 Talk with your friends' : '💬 Talk with your family', false));
    const people = myPet ? [{ name, icon: Game.SPECIES_EMOJI[myPet.species] ?? '🐾' }] : human ? [{ name, icon: '🧑' }] : friends ? this.pets.filter((p) => p.rig.root.visible || p.following).map((p) => ({ name: p.name, icon: p.emoji })) : this.family.map((f) => ({ name: f.name, icon: this.def.icon }));
    const iconOf = (n: string) => people.find((q) => q.name === n)?.icon ?? this.def.icon;
    const ctxOf = (n: string) => (myPet ? { ...this.familyCtx(n), petSpecies: myPet.species } : human ? { ...this.familyCtx(n), humanOwner: n } : friends ? this.friendCtx(n) : this.familyCtx(n));
    const body = el('div', { class: 'modal-body' });
    const tabs = el('div', { class: 'hud-row', style: 'flex-wrap:wrap;margin-bottom:8px' });
    for (const f of people) {
      const t = button(`${f.icon} ${f.name}`, f.name === name ? 'btn-green btn-small' : 'btn-small', () => this.renderFamilyChat(box, f.name, friends, human, petIdx));
      tabs.append(t);
    }
    body.append(tabs);
    const log = el('div', { class: 'chat-log', 'aria-live': 'polite' });
    const hist = (this.chats[name] ??= []);
    if (!hist.length) hist.push({ from: 'them', text: myPet ? `Hi! It's me, ${myPet.name}! ${myPet.fed ? 'Thanks for the yummy food! 😋' : 'I\'m a little bit hungry… 🍎'}` : human ? 'Hello, my cute little pet! Do you like your cosy room? 💕' : friends ? friendChatter(this.friendCtx(name)) : familyChatter(this.familyCtx(name), 'welcome') });
    const addLine = (turn: ChatTurn) => {
      const line = el('div', { class: 'chat-line ' + turn.from }, el('div', { class: 'chat-who', text: turn.from === 'me' ? 'You' : `${iconOf(name)} ${name}` }), el('div', { class: 'chat-text', text: turn.text }));
      log.append(line); log.scrollTop = log.scrollHeight; return line;
    };
    for (const t of hist) addLine(t);
    body.append(log);
    const send = async (msg: string) => {
      msg = msg.trim().slice(0, 300);
      if (!msg || this.chatBusy) return;
      // they really listen: "follow me", "go home", "jump", "dance", "spin", "sit", "go to sleep", "wake up", "come here"
      // asking your owner for food or a walk makes it happen soon
      if (human && this.captive && !this.captive.onWalk && !this.captive.dinner) {
        const lm = msg.toLowerCase();
        if (/walk|outside/.test(lm)) { this.captive.eventIdx = 2; this.captive.timer = Math.min(this.captive.timer, 4); }
        else if (/hungry|food|eat|dinner|snack/.test(lm)) { this.captive.eventIdx = 0; this.captive.timer = Math.min(this.captive.timer, 4); }
      }
      const did = myPet ? this.obeyMyPet(petIdx, msg) : human ? null : this.obey(msg, friends ? { pet: this.pets.find((q) => q.name === name) } : { fam: this.family.find((q) => q.name === name) });
      if (did) {
        hist.push({ from: 'me', text: msg }); addLine({ from: 'me', text: msg });
        hist.push({ from: 'them', text: did }); addLine({ from: 'them', text: did });
        if (friends) { const pf = this.pets.find((q) => q.name === name); if (pf) this.petSay(pf, did, 4); } else this.familySay(name, did, 4);
        inp.value = ''; this.audio.click();
        return;
      }
      this.chatBusy = true;
      const before = hist.slice();
      hist.push({ from: 'me', text: msg }); addLine({ from: 'me', text: msg });
      const line = addLine({ from: 'them', text: '…' });
      const textEl = line.querySelector('.chat-text') as HTMLElement;
      inp.value = ''; sendBtn.disabled = true;
      const reply = await familyReply(ctxOf(name), before, msg, (t) => { textEl.textContent = t; log.scrollTop = log.scrollHeight; });
      textEl.textContent = reply;
      hist.push({ from: 'them', text: reply });
      if (hist.length > 30) hist.splice(0, hist.length - 30);
      if (human || myPet) { /* shown in the chat */ } else if (friends) { const pf = this.pets.find((q) => q.name === name); if (pf) this.petSay(pf, reply, 7); } else this.familySay(name, reply, 7);
      this.audio.click();
      this.chatBusy = false; sendBtn.disabled = false;
      log.scrollTop = log.scrollHeight;
    };
    const quick = el('div', { class: 'quick-replies' });
    for (const q of myPet ? ['Hi! 👋', 'Are you hungry? 🍎', 'Want to go for a walk? 🦮', 'You\'re so cute! 💛', 'Do a trick! 🎉', 'Tell me a joke 😂'] : human ? ['Hi! 👋', 'Can I go home please? 🏠', "I'm hungry 🍎", 'Can we go for a walk? 🦮', 'I miss my family 💛', 'Tell me a joke 😂'] : ['Hi! 👋', 'I love you! ❤️', "I'm hungry 🍎", 'What should I do? 🤔', 'Tell me a joke 😂', 'Good night 🌙']) quick.append(button(q, 'btn-small', () => send(q)));
    body.append(quick);
    if (!friends && !human && !myPet) {
      const ff = this.family.find((q) => q.name === name);
      if (ff) body.append(el('div', { class: 'action-row', style: 'justify-content:flex-start;margin-bottom:10px' },
        ff.following ? button('🏠 Go home now', 'btn-small', () => { this.setFamilyFollow(ff, false); this.renderFamilyChat(box, name); toast(`🏠 ${ff.name} went home.`); })
          : button('🐾 Come with me!', 'btn-green btn-small', () => { this.setFamilyFollow(ff, true); this.renderFamilyChat(box, name); this.familySay(ff.name, ff.name === 'Baby Pip' ? 'Yay! Adventure with big sister! 🎉' : 'Let\'s go on an adventure together! 🐾', 4); toast(`🐾 ${ff.name} will follow you everywhere!`, 'good'); })));
    }
    if (friends && !human) {
      const pf = this.pets.find((q) => q.name === name);
      if (pf) body.append(el('div', { class: 'action-row', style: 'justify-content:flex-start;margin-bottom:10px' },
        pf.following ? button('🏠 Go home to your house', 'btn-small', () => { pf.following = false; pf.settled = true; pf.wait = 0; this.renderFamilyChat(box, name, true); toast(`${pf.emoji} ${pf.name} is heading home.`); })
          : button('🐾 Come with me!', 'btn-green btn-small', () => { pf.following = true; this.renderFamilyChat(box, name, true); toast(`${pf.emoji} ${pf.name} will follow you everywhere!`, 'good'); })));
    }
    const inp = el('input', { type: 'text', id: 'chat-input', maxlength: '300', placeholder: `Type something to ${name}…`, 'aria-label': `Message to ${name}`, autocomplete: 'off' }) as HTMLInputElement;
    const sendBtn = button('Send', 'btn-shop btn-small', () => send(inp.value));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); void send(inp.value); } });
    // 🎤 Talk button: say it out loud instead of typing. Tap to start, tap again to send.
    let listening: Listening | null = null;
    const mic = button('🎤 Talk', 'btn-green btn-small mic-btn', () => {
      if (listening) { listening.stop(); return; }
      if (this.chatBusy) return;
      const before = inp.value.trim();
      listening = startListening(
        (text) => { inp.value = (before ? before + ' ' : '') + text; },
        (text, problem) => {
          listening = null; mic.textContent = '🎤 Talk'; mic.classList.remove('listening');
          const said = ((before ? before + ' ' : '') + text).trim();
          if (said && box.isConnected) void send(said);
          else if (problem && box.isConnected) toast(problem === 'not_granted' || problem === 'not-allowed' ? '🎤 The microphone isn\'t allowed. You can still type!' : '🎤 I didn\'t hear anything. Try again!', 'bad', 2600);
          if (!voiceAvailable()) mic.hidden = true;
        });
      if (listening) { mic.textContent = '🔴 Listening… tap to send'; mic.classList.add('listening'); }
      else toast('🎤 Talking isn\'t available here. You can type instead!', 'bad', 2400);
    });
    mic.hidden = !voiceAvailable();
    const form = el('div', { class: 'chat-form' }, mic, inp, sendBtn);
    body.append(form);
    body.append(el('p', { class: 'save-note', style: 'color:#4a5446;font-size:14px', text: smartRepliesAvailable() ? '✨ Your family can answer anything you type.' : 'Tip: type anything and press Send!' }));
    box.append(body);
    setTimeout(() => inp.focus(), 50);
  }

  // ---- Human houses: open with F, close with L, raid the fridge
  get inHumanHouse(): number {
    if (this.pos.z > -300 || this.pos.x < 250) return -1;
    return this.hhouses.findIndex((h) => Math.abs(this.pos.x - h.interior.origin.x) < 25);
  }
  setHumanDoor(i: number, open: boolean) {
    const h = this.hhouses[i];
    h.open = open;
    if (h.door) h.door.rotation.y = open ? 1.4 : 0;
    h.interior.setDoor(open);
  }
  private closeHumanDoor(): boolean {
    const hi = this.inHumanHouse;
    if (hi >= 0) { if (this.hhouses[hi].open) { this.setHumanDoor(hi, false); toast('🚪 Door closed'); } return true; }
    for (let i = 0; i < this.hhouses.length; i++) {
      const h = this.hhouses[i];
      if (h.open && Math.hypot(this.pos.x - h.front.x, this.pos.z - h.front.z) < 7) { this.setHumanDoor(i, false); toast('🚪 Door closed'); return true; }
    }
    return false;
  }
  private humanHouseAction(near: (x: number, z: number, r: number) => boolean): { label: string; fn: () => void } | null {
    const hi = this.inHumanHouse;
    if (hi >= 0) {
      const h = this.hhouses[hi], I = h.interior, cap = this.captive;
      if (cap && cap.caged) {
        if (cap.dinner) {
          const b = cap.dinner.bowl.position;
          if (!cap.dinner.eaten && Math.hypot(this.pos.x - b.x, this.pos.z - b.z) < 1.2) return { label: '🍽️ Eat your dinner', fn: () => this.eatPetDinner() };
          return null;
        }
        const lx = this.pos.x - cap.cx, lz = this.pos.z - cap.cz;
        if (Math.hypot(lx, lz - cap.hs) < 1.0) return { label: '🔓 Open the gate (solve a math problem)', fn: () => this.escapeMath() };
        if (Math.hypot(lx + cap.hs - 0.5, lz + cap.hs - 0.5) < 0.8) return { label: '😴 Snuggle in your pet bed', fn: () => { this.audio.click(); toast('💤 So soft and cosy! (Go to the gate to try to escape.)', 'good', 2400); } };
        if (Math.hypot(lx - cap.hs + 0.5, lz - cap.hs + 0.6) < 0.8) return { label: '⚽ Play with your ball', fn: () => { this.audio.click(); this.effects.push(sparkleBurst(this.scene, this.pos.clone().setY(this.pos.y + 0.8), 0xe4475b, 10)); toast('⚽ Boing! Fun!', 'good', 1600); } };
        return null;
      }
      if (this.seat) return { label: '⬆️ Stand up', fn: () => this.standUp() };
      const stuck = [...this.pets, ...this.family].find((q) => q.caged?.house === hi && Math.hypot(this.pos.x - q.caged.x, this.pos.z - q.caged.z) < 1.8);
      if (stuck) return { label: `🔓 Free ${stuck.name.split(' the ')[0]} (solve a math problem)`, fn: () => this.mathChallenge(`🔓 Free ${stuck.name.split(' the ')[0]}!`, 'Solve it to open the pen.', () => { stuck.caged!.open = 100; this.openFriendCage(stuck); }, () => true) };
      const things = [
        { s: I.couch, a: { label: '🛋️ Sit on the couch', fn: () => this.sit(I.couch) } },
        { s: I.chair, a: { label: '🪑 Sit down and eat', fn: () => this.sit(I.chair) } },
        { s: I.bed, a: { label: '🛏️ Sleep in their bed', fn: () => this.sleep() } },
        { s: I.fridge, a: { label: '🧊 Raid the fridge', fn: () => this.raidFridge(hi) } },
        { s: I.stove, a: { label: '🍲 Cook food', fn: () => this.openCook() } },
        ...I.lamps.map((l) => ({ s: l, a: { label: I.lampsOn ? '💡 Turn off the lamps' : '💡 Turn on the lamps', fn: () => { I.setLamps(!I.lampsOn); this.audio.click(); } } })),
      ].map((t) => ({ ...t, d: Math.hypot(this.pos.x - t.s.x, this.pos.z - t.s.z) })).filter((t) => t.d < t.s.r).sort((a, b) => a.d - b.d);
      const di = I.doorInside;
      if (h.open && this.pos.z > I.southZ - 0.5 && Math.abs(this.pos.x - I.origin.x) < 0.8) { this.exitHumanHouse(hi); return null; }
      if (near(di.x, di.z, 2.2)) return h.open ? { label: '🌳 Go outside', fn: () => this.exitHumanHouse(hi) } : { label: '🚪 Open the door', fn: () => { this.setHumanDoor(hi, true); this.audio.click(); } };
      if (things.length) return things[0].a;
      return null;
    }
    if (this.pos.z < -300) return null;
    for (let i = 0; i < this.hhouses.length; i++) {
      const h = this.hhouses[i];
      if (!near(h.front.x, h.front.z, 3.6)) continue;
      if (h.open && near(h.front.x, h.front.z + 0.9, 1.2)) { this.enterHumanHouse(i); return null; }
      return h.open ? { label: `🏡 Go inside ${h.home.name}`, fn: () => this.enterHumanHouse(i) }
        : { label: `🚪 Open the door of ${h.home.name}`, fn: () => { this.setHumanDoor(i, true); this.audio.click(); toast('Door open! Walk in. Press L to close it.', 'good', 2200); } };
    }
    return null;
  }
  enterHumanHouse(i: number) {
    if (this.respawning) return;
    const h = this.hhouses[i];
    if (!h.open) this.setHumanDoor(i, true);
    this.respawning = true;
    $('fade-text').textContent = `🏡 Sneaking into ${h.home.name}…`;
    $('fade').classList.add('on');
    this.later(0.6, () => {
      const s = h.interior.spawnInside;
      this.pos.set(s.x, 0, s.z); this.vy = 0; this.yaw = Math.PI; this.grounded = true; this.groundY = 0; this.lunge = null;
      this.cam.reset(this.yaw, true);
      $('fade').classList.remove('on');
      this.later(0.3, () => { this.respawning = false; });
      const who = this.setupHomeHuman(i);
      if (who) { setTimeout(() => toast(who, 'bad', 3800), 450); return; }
      setTimeout(() => toast('Nobody home! Raid the fridge, nap in the bed or watch TV. L closes the door.', 'good', 3600), 400);
    });
  }
  /** At night the owner is asleep in bed; in the day they're sometimes at home. Returns a warning to show, if anyone's home. */
  private setupHomeHuman(i: number): string | null {
    const hu = this.homeHumans[i], h = this.hhouses[i], I = h.interior, B = I.mainBounds;
    for (const q of this.homeHumans) { q.active = false; q.root.visible = false; q.label.style.display = 'none'; }
    if (this.captive) { this.homeState[i] = 'none'; return null; }
    const night = this.world.daylight < 0.45;
    const outdoorsPerson = HUMAN_SPAWNS.some((q) => q.name === h.home.owner);
    const state = night ? 'asleep' : Math.random() < (outdoorsPerson ? 0.3 : 0.55) ? 'awake' : 'none';
    this.homeState[i] = state;
    const first = h.home.owner.split(' ').pop();
    if (state === 'none') return null;
    hu.root.visible = true; hu.active = true;
    hu.root.rotation.set(0, 0, 0);
    const blk = hu.root.getObjectByName('blanket'); if (blk) blk.visible = false;
    if (state === 'asleep') {
      // tucked up in bed, lying down
      hu.pos.set(I.bed.x, 0.84, I.bed.z + 1.05); hu.state = 'patrol';
      hu.root.position.copy(hu.pos); hu.root.rotation.set(-Math.PI / 2, 0, 0);
      // a cosy blanket tucked over them (head on the pillow)
      if (!hu.root.getObjectByName('blanket')) {
        const bl = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.25, 0.08), new THREE.MeshStandardMaterial({ color: 0xf2d0e0, roughness: 0.95 }));
        bl.name = 'blanket'; bl.position.set(0, 0.62, 0.2); hu.root.add(bl);
      }
      hu.root.getObjectByName('blanket')!.visible = true;
      hu.labelOverride = '💤 Sleeping… shh!';
      return `🤫 Shh! ${first} is asleep in bed. Tiptoe! (Raiding the fridge might wake them up…)`;
    }
    const mx = (B.minX + B.maxX) / 2;
    hu.place([[B.maxX - 1.6, B.minZ + 1.8], [B.maxX - 1.6, B.maxZ - 2.6], [mx + 1.2, B.maxZ - 2.6], [mx + 1.2, B.minZ + 1.8]]);
    hu.labelOverride = '';
    return `😮 Uh oh! ${first} is home! Sneak around behind them, or run back out the door!`;
  }
  /** The owner wakes up (e.g. you were noisy raiding the fridge)! */
  private wakeHomeHuman(i: number) {
    if (this.homeState[i] !== 'asleep') return;
    const hu = this.homeHumans[i], B = this.hhouses[i].interior.mainBounds;
    this.homeState[i] = 'awake';
    hu.root.rotation.set(0, 0, 0); hu.labelOverride = '';
    const blk = hu.root.getObjectByName('blanket'); if (blk) blk.visible = false;
    hu.place([[hu.pos.x + 1.4, hu.pos.z], [(B.minX + B.maxX) / 2, (B.minZ + B.maxZ) / 2]]);
    hu.alert();
    toast(`😲 ${this.hhouses[i].home.owner.split(' ').pop()} woke up! "Who's there?!" RUN!`, 'bad', 3000);
    this.audio.growl();
  }
  exitHumanHouse(i: number) {
    if (this.respawning) return;
    const h = this.hhouses[i];
    if (!h.open) this.setHumanDoor(i, true);
    const escaped = !!this.captive && this.captive.house === i;
    const hh = this.homeHumans[i]; hh.active = false; hh.root.visible = false; hh.label.style.display = 'none'; this.homeState[i] = 'none';
    if (escaped) this.endCaptivity();
    this.seat = null;
    this.respawning = true;
    $('fade-text').textContent = escaped ? '🏃 You escaped!' : '🌳 Off outside!';
    $('fade').classList.add('on');
    this.later(0.6, () => {
      const z = h.front.z - 1.6, y = this.world.collision.groundAt(h.front.x, z, 60, PHYSICS.stepUp);
      this.pos.set(h.front.x, y, z); this.vy = 0; this.yaw = Math.PI; this.grounded = true; this.groundY = y; this.lunge = null;
      this.cam.reset(this.yaw, true);
      $('fade').classList.remove('on');
      this.later(0.3, () => { this.respawning = false; });
      if (escaped) { this.audio.victory(); toast('🎉 You escaped from the humans! Run before they see you!', 'good', 3200); }
    });
  }
  raidFridge(i: number) {
    const h = this.hhouses[i];
    if (h.raidDay === this.dayCount) { toast('The fridge is empty! Come back tomorrow.'); return; }
    if (this.bagTotal() >= BAG_LIMIT) { toast('Your bag is full! Unpack it into your own fridge first.'); return; }
    h.raidDay = this.dayCount;
    if (this.homeState[i] === 'asleep' && Math.random() < 0.35) this.later(1.2, () => { if (this.inHumanHouse === i) this.wakeHomeHuman(i); });
    const pool: FoodType[] = ['drumstick', 'drumstick', 'sandwich', 'cheese', 'hotdog', 'applePie', 'cake', 'roastChicken'];
    const got: string[] = [];
    for (let k = 0; k < 2 && this.bagTotal() < BAG_LIMIT; k++) {
      const t = pool[Math.floor(Math.random() * pool.length)];
      this.save.bag[t] = (this.save.bag[t] ?? 0) + 1;
      got.push(FOOD_NAMES[t]);
    }
    this.audio.purchase(); this.persist();
    toast(`🧊 Yum! You took ${got.join(' and ')}. 🎒`, 'gold', 2800);
  }

  // ---- Caught by a human: you become their pet and must escape
  captureByHuman(h: Human) {
    if (this.respawning || this.captive) return;
    this.respawning = true;
    this.seat = null; this.lunge = null; this.attack = null;
    for (const hu of this.humans) hu.calmDown();
    for (const o of this.opps) if (o.aggro) o.calmDown();
    for (const q of this.homeHumans) { q.active = false; q.root.visible = false; q.label.style.display = 'none'; }
    this.homeState = this.homeState.map(() => 'none');
    this.sendFriendsHome(Math.max(0, this.hhouses.findIndex((x) => x.home.owner === h.spawn.name)));
    const idx = Math.max(0, this.hhouses.findIndex((x) => x.home.owner === h.spawn.name));
    const house = this.hhouses[idx];
    $('fade-text').textContent = `🎀 Caught! ${h.spawn.name} is taking you home as a pet…`;
    $('fade').classList.add('on');
    this.later(1.5, () => {
      this.setHumanDoor(idx, false);
      const B = house.interior.mainBounds;
      const cx = (B.minX + B.maxX) / 2 - 1.1, cz = (B.minZ + B.maxZ) / 2 - 0.6;
      // a cosy pet room: a big soft playpen with a bed, toys and bowls (no metal bars!)
      const hs = 1.3;
      const { group: cage, gate: cageDoor } = this.buildPen(hs * 2, Math.max(1.0, this.rig.height + 0.25), true);
      cage.position.set(cx, 0, cz);
      house.interior.group.add(cage);
      const W = this.world.collision;
      const cols = [
        W.add({ kind: 'box', minX: cx - hs - 0.1, maxX: cx - hs + 0.1, minZ: cz - hs, maxZ: cz + hs, top: 100, tall: true }),
        W.add({ kind: 'box', minX: cx + hs - 0.1, maxX: cx + hs + 0.1, minZ: cz - hs, maxZ: cz + hs, top: 100, tall: true }),
        W.add({ kind: 'box', minX: cx - hs, maxX: cx + hs, minZ: cz - hs - 0.1, maxZ: cz - hs + 0.1, top: 100, tall: true }),
        W.add({ kind: 'box', minX: cx - hs + 0.1, maxX: cx - hs + 0.9, minZ: cz - hs + 0.1, maxZ: cz - hs + 0.9, top: 0.3, tall: false }), // the pet bed (soft, you can lie on it)
      ];
      const front = W.add({ kind: 'box', minX: cx - hs, maxX: cx + hs, minZ: cz + hs - 0.1, maxZ: cz + hs + 0.1, top: 100, tall: true });
      this.captive = { house: idx, caged: true, wiggle: 0, cage, cageDoor, cols, front, cx, cz, hs, dinner: null, owner: h.spawn.name, roomRoute: [], timer: 14, eventIdx: 0, scoldAt: 0, onWalk: false, walkTimer: 0, nextTrick: 0, trickUntil: 0, leash: null, tugAt: 0 };
      this.pos.set(cx + 0.3, 0, cz + 0.3); this.vy = 0; this.yaw = 0; this.grounded = true; this.groundY = 0;
      this.cam.reset(this.yaw, true);
      // the owner walks around the other half of the room
      const mx = (B.minX + B.maxX) / 2;
      this.petOwner.setName(h.spawn.name);
      const roomRoute: [number, number][] = [[B.maxX - 1.6, B.minZ + 1.8], [B.maxX - 1.6, B.maxZ - 2.6], [mx + 1.2, B.maxZ - 2.6], [mx + 1.2, B.minZ + 1.8]];
      this.petOwner.place(roomRoute.map((q) => [q[0], q[1]] as [number, number]));
      this.captive!.roomRoute = roomRoute;
      this.petOwner.labelOverride = '🎀 Your owner';
      $('fade').classList.remove('on');
      this.later(0.3, () => { this.respawning = false; });
      this.persist();
      setTimeout(() => toast(`🎀 You're ${h.spawn.name}'s pet now! This is your cosy pet room. To escape, go to the gate when your owner isn't looking and solve a math problem to open it, then sneak out the door!`, 'bad', 4800), 300);
    });
  }
  private escapeWaitUntil = 0;
  /** Solve a math problem to open your pen's gate, but not while your owner is watching! */
  escapeMath() {
    const c = this.captive; if (!c || !c.caged) return;
    if (this.now < this.escapeWaitUntil) { toast('⏳ Wait a moment, your owner is suspicious…', 'bad', 1600); return; }
    const owner = this.petOwner;
    if (Math.hypot(owner.pos.x - c.cx, owner.pos.z - c.cz) < 3.2) { toast(`👀 ${c.owner} is watching! Wait until they walk away.`, 'bad', 2200); return; }
    this.mathChallenge('🔓 Open the gate!', 'Solve it to sneak the latch open.', () => { c.wiggle = 99; this.wiggle(); }, () => {
      this.escapeWaitUntil = this.now + 6;
      setTimeout(() => toast(`🧑 ${c.owner}: "Hmm? What was that noise?" (try again in a moment)`, 'bad', 2400), 200);
      return false;
    });
  }
  wiggle() {
    const c = this.captive; if (!c) return;
    if (c.onWalk) {
      if (this.now - c.tugAt > 2) { c.tugAt = this.now; toast("🦮 You tug the leash… it's too strong! You can only escape from your cage.", 'bad', 2400); }
      return;
    }
    if (!c.caged) return;
    c.wiggle = Math.min(100, c.wiggle + 7);
    this.audio.click();
    c.cageDoor.rotation.y = (Math.random() - 0.5) * 0.12;
    if (c.wiggle >= 100) {
      c.caged = false;
      if (c.front) { this.world.collision.remove(c.front); c.front = null; }
      c.cageDoor.rotation.y = 1.5;
      this.audio.gate();
      toast("🔓 You're out! Sneak to the door, press F to open it, and run!", 'good', 3200);
    }
  }
  /** Pet life: your owner pats you, gives treats, brushes you, sings, and takes you for walks on a leash. */
  private updateCaptivity(dt: number, hctx: Parameters<Human['update']>[1]) {
    const cap = this.captive, owner = this.petOwner;
    if (!cap || this.respawning) return;
    if (cap.onWalk) {
      cap.walkTimer -= dt;
      owner.root.visible = true; owner.active = true;
      owner.update(dt, { ...hctx, playerActive: false, onCatch: () => undefined });
      // the leash: from the owner's hand to your neck
      if (cap.leash) {
        const a = owner.pos.clone().setY(owner.pos.y + 1.0), b = this.pos.clone().setY(this.pos.y + this.rig.height * 0.7);
        const pos = cap.leash.geometry.attributes.position as THREE.BufferAttribute;
        pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, (a.x + b.x) / 2, Math.min(a.y, b.y) - 0.2, (a.z + b.z) / 2); pos.setXYZ(2, b.x, b.y, b.z);
        pos.needsUpdate = true; cap.leash.geometry.computeBoundingSphere();
      }
      // tricks for treats
      cap.nextTrick -= dt;
      if (cap.nextTrick <= 0) {
        cap.nextTrick = 11;
        cap.trickUntil = this.now + 3.5;
        toast(`🧑 ${cap.owner}: "Sit! Now jump! (Space) Jump for a treat!"`, 'gold', 3000);
      }
      if (cap.walkTimer <= 0) this.endWalk();
      return;
    }
    if (!cap.caged) return;
    if (cap.dinner) {
      const b = cap.dinner.bowl.position;
      if (!cap.dinner.eaten && Math.hypot(this.pos.x - b.x, this.pos.z - b.z) > 3.2) {
        toast(`🧑 ${cap.owner}: "Hey, silly! Your dinner's over here, not out there!"`, 'bad', 2600);
        this.endPetDinner(false);
      } else if (!cap.dinner.eaten && this.now > cap.dinner.until) this.endPetDinner(false);
      return;
    }
    // the owner tells you off if they catch you wiggling
    const near = Math.hypot(owner.pos.x - cap.cx, owner.pos.z - cap.cz) < 3.2;
    if (cap.wiggle > 15 && near && this.now > cap.scoldAt) {
      cap.scoldAt = this.now + 3;
      cap.wiggle = Math.max(0, cap.wiggle - 40);
      toast(`🧑 ${cap.owner}: "Stop wiggling, silly pet!" (wait until they look away)`, 'bad', 2400);
    }
    cap.timer -= dt;
    if (cap.timer <= 0 && cap.wiggle < 30) {
      const events = ['feed', 'pat', 'walk', 'treat', 'brush', 'feed', 'walk', 'sing'] as const;
      const ev = events[cap.eventIdx++ % events.length];
      if (ev === 'walk') this.startWalk();
      else { this.doPetThing(ev); cap.timer = 16; }
    }
  }
  /** A human caught one of your friends! They're locked in a cage at the human's house until you rescue them. */
  private catchFriend(p: Game['pets'][number] | Game['family'][number], h: Human | null, houseIdx?: number, quiet = false) {
    const idx = houseIdx ?? Math.max(0, this.hhouses.findIndex((x) => x.home.owner === h!.spawn.name));
    const house = this.hhouses[idx], B = house.interior.mainBounds;
    const taken = [...this.pets, ...this.family].filter((q) => q.caged?.house === idx).length;
    const x = (B.minX + B.maxX) / 2 + 1.6 + (taken % 3) * 1.25, z = (B.minZ + B.maxZ) / 2 + 2.3 - Math.floor(taken / 3) * 1.3;
    const size = Math.max(1.0, p.rig.radius * 2.8), hgt = Math.max(0.8, p.rig.height + 0.2);
    const { group: cage } = this.buildPen(size, hgt, false);
    cage.position.set(x, 0, z);
    house.interior.group.add(cage);
    p.following = false; p.trick = undefined;
    if ('mode' in p) { if (p.col) { this.world.collision.remove(p.col); p.col = null; } this.scene.add(p.rig.root); p.asleep = false; }
    p.caged = { house: idx, cage, x, z, open: 0 };
    p.x = x; p.z = z; p.rig.root.position.set(x, 0, z); p.rig.root.rotation.y = Math.PI;
    p.bubble.style.display = 'none';
    if (quiet) return;
    this.audio.hurt();
    h?.calmDown();
    toast(`😱 Oh no! ${h?.spawn.name ?? 'A human'} caught ${p.name} with a net! Go to ${house.home.name} and open the cage to rescue them!`, 'bad', 5200);
  }
  /** Press F at the cage to break your friend out. */
  private openFriendCage(p: Game['pets'][number] | Game['family'][number]) {
    const c = p.caged; if (!c) return;
    c.open += 14;
    c.cage.rotation.z = (Math.random() - 0.5) * 0.06;
    this.audio.click();
    if (c.open < 100) return;
    c.cage.removeFromParent();
    p.caged = null; p.following = true;
    if ('settled' in p) p.settled = true;
    this.effects.push(sparkleBurst(this.scene, new THREE.Vector3(p.x, 1, p.z), 0xfff2b0, 18));
    this.audio.purchase();
    this.spawnReward(5, false);
    if ('settled' in p) this.petSay(p, 'You saved me! Thank you! 💛 Let\'s get out of here!', 4);
    else this.familySay(p.name, p.name === 'Baby Pip' ? 'Big sister saved me! Yay! 💛' : 'You found me! Thank you, sweetie! 💛', 4);
    const left = [...this.pets, ...this.family].filter((q) => q.caged).length;
    if (left) setTimeout(() => toast(`🔎 ${left} more to find! Check the other human houses.`, 'gold', 3000), 3300);
    toast(`🎉 You rescued ${p.name}! They'll follow you again. Jump for +5!`, 'good', 3200);
  }
  /** If you get caught, your friends stop following you and run back to the Friends' House. */
  /** You got caught, so everyone following you is caught too, each taken to a DIFFERENT human house. Find them and rescue them! */
  private sendFriendsHome(captorHouse = -1) {
    if (this.walker) this.endPetWalk(false);
    const goers: (Game['pets'][number] | Game['family'][number])[] = [...this.family.filter((f) => f.following), ...this.pets.filter((p) => p.following)];
    if (!goers.length) return;
    const houses = this.hhouses.map((_, i) => i).filter((i) => i !== captorHouse).sort(() => Math.random() - 0.5);
    goers.forEach((q, k) => this.catchFriend(q, null, houses[k % houses.length], true));
    this.later(2.4, () => toast(`😱 Oh no! The humans caught ${goers.map((q) => q.name.split(' the ')[0]).join(', ')} too, and took them to different houses! Escape, then search the houses and rescue them all!`, 'bad', 5600));
  }

  /** Dinner time for the pet: your owner puts a bowl of food in your cage and you eat it all up. */
  /** Dinner time! The gate opens and your bowl is put outside the pen: walk over and press the button to eat. */
  private feedPet() {
    const cap = this.captive!; const owner = this.petOwner;
    const foods: FoodType[] = ['roastChicken', 'sandwich', 'cheese', 'veggieStew', 'drumstick', 'applePie'];
    const kind = foods[Math.floor(Math.random() * foods.length)];
    const bowl = new THREE.Group();
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.14, 16), new THREE.MeshStandardMaterial({ color: 0xe8508a, roughness: 0.5 }));
    dish.position.y = 0.09; bowl.add(dish);
    const food = buildFoodMesh(kind); food.scale.setScalar(0.65); food.position.y = 0.18; food.name = 'food'; bowl.add(food);
    bowl.position.set(cap.cx + 0.9, 0, cap.cz + cap.hs + 1.0);
    this.scene.add(bowl);
    owner.pos.set(cap.cx - 0.9, 0, cap.cz + cap.hs + 1.3); owner.yaw = Math.PI * 0.9;
    // open the gate so you can come out
    if (cap.front) { this.world.collision.remove(cap.front); cap.front = null; }
    cap.cageDoor.rotation.y = 1.5;
    cap.dinner = { bowl, until: this.now + 30, eaten: false };
    toast(`🧑 ${cap.owner}: "Dinner time, little pet! Come out and eat! 🍽️" (walk to your bowl)`, 'gold', 3400);
    this.audio.food();
  }
  /** Eat your dinner (press the button next to your bowl). */
  private eatPetDinner() {
    const cap = this.captive; if (!cap?.dinner || cap.dinner.eaten) return;
    cap.dinner.eaten = true;
    const bowl = cap.dinner.bowl, food = bowl.getObjectByName('food')!;
    let bites = 0;
    const bite = () => {
      if (!this.captive || !bowl.parent) return;
      bites++;
      this.hp = Math.min(this.maxHp, this.hp + 10);
      this.audio.food();
      food.scale.setScalar(0.65 * (1 - bites / 4));
      this.effects.push(sparkleBurst(this.scene, bowl.position.clone().setY(bowl.position.y + 0.4), 0xffd34a, 8));
      if (bites < 4) this.later(0.6, bite);
      else { toast('😋 Nom nom! You ate it all up! +40 ❤️', 'good', 2400); this.later(2.5, () => this.endPetDinner(true)); }
    };
    bite();
  }
  private endPetDinner(ate: boolean) {
    const cap = this.captive; if (!cap?.dinner) return;
    cap.dinner.bowl.removeFromParent();
    cap.dinner = null;
    this.pos.set(cap.cx + 0.3, 0, cap.cz + 0.3); this.vy = 0; this.groundY = 0; this.yaw = 0; this.seat = null;
    this.cam.reset(this.yaw, true);
    this.closePenGate();
    cap.wiggle = 0;
    toast(`🧑 ${cap.owner}: "${ate ? 'Good pet! Back to your cosy room now.' : 'Dinner time is over! Back to your room.'}" 🎀`, 'good', 2800);
  }
  private closePenGate() {
    const c = this.captive; if (!c) return;
    c.cageDoor.rotation.y = 0;
    if (!c.front) c.front = this.world.collision.add({ kind: 'box', minX: c.cx - c.hs, maxX: c.cx + c.hs, minZ: c.cz + c.hs - 0.1, maxZ: c.cz + c.hs + 0.1, top: 100, tall: true });
  }
  /** A soft playpen: low wooden walls painted with paw prints and hearts, a gate in the front. */
  private buildPen(size: number, hgt: number, furnished: boolean) {
    const g = new THREE.Group(), hs = size / 2;
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d')!;
    x.fillStyle = '#ffe3ee'; x.fillRect(0, 0, 256, 128);
    x.fillStyle = '#fff6fa'; for (let i = 0; i < 8; i++) x.fillRect(i * 32 + 2, 0, 28, 128);
    x.font = '34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    ['🐾', '💗', '🐾', '⭐'].forEach((e, i) => x.fillText(e, 32 + i * 64, 64 + (i % 2 ? 18 : -18)));
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(size / 2, 1);
    const wallM = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
    const railM = new THREE.MeshStandardMaterial({ color: 0xe86aa8, roughness: 0.5 });
    const panel = (w: number, px: number, pz: number, ry: number, parent: THREE.Object3D = g) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, 0.08), wallM); m.position.set(px, hgt / 2, pz); m.rotation.y = ry; parent.add(m);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, w, 10), railM); r.rotation.z = Math.PI / 2; r.position.set(px, hgt, pz); r.rotation.y = ry; parent.add(r);
    };
    panel(size, 0, -hs, 0);
    panel(size, -hs, 0, Math.PI / 2); panel(size, hs, 0, Math.PI / 2);
    // the front: two short walls and a gate in the middle
    const gw = Math.min(1.0, size * 0.4), side = (size - gw) / 2;
    panel(side, -hs + side / 2, hs, 0); panel(side, hs - side / 2, hs, 0);
    const gate = new THREE.Group(); gate.position.set(-gw / 2, 0, hs); g.add(gate);
    panel(gw, gw / 2, 0, 0, gate);
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf4c430, metalness: 0.4, roughness: 0.3 })); heart.position.set(gw - 0.1, hgt * 0.6, 0.06); gate.add(heart);
    for (const [px, pz] of [[-hs, -hs], [hs, -hs], [-hs, hs], [hs, hs], [-gw / 2, hs], [gw / 2, hs]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, hgt + 0.12, 10), railM); post.position.set(px, (hgt + 0.12) / 2, pz); g.add(post);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), railM); knob.position.set(px, hgt + 0.14, pz); g.add(knob);
    }
    // soft floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(size - 0.1, 0.04, size - 0.1), new THREE.MeshStandardMaterial({ color: 0xfff0d8, roughness: 1 })); floor.position.y = 0.02; g.add(floor);
    if (furnished) {
      // a round pet bed with a fluffy cushion, a blanket, bowls, a ball and a squeaky toy
      const bed = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.12, 8, 20), new THREE.MeshStandardMaterial({ color: 0x8a5ad8, roughness: 0.9 })); bed.rotation.x = Math.PI / 2; bed.position.set(-hs + 0.5, 0.14, -hs + 0.5); g.add(bed);
      const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 20), new THREE.MeshStandardMaterial({ color: 0xf6e6ff, roughness: 1 })); cushion.position.set(-hs + 0.5, 0.1, -hs + 0.5); g.add(cushion);
      const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.4), new THREE.MeshStandardMaterial({ color: 0x7ac0e8, roughness: 1 })); blanket.position.set(-hs + 0.65, 0.18, -hs + 0.65); blanket.rotation.y = 0.5; g.add(blanket);
      for (const [bx, col] of [[hs - 0.35, 0x4aa8ff], [hs - 0.8, 0xe0a040]] as const) {
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.09, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })); bowl.position.set(bx, 0.07, -hs + 0.3); g.add(bowl);
        const fill = new THREE.Mesh(new THREE.CircleGeometry(0.13, 14), new THREE.MeshStandardMaterial({ color: col })); fill.rotation.x = -Math.PI / 2; fill.position.set(bx, 0.115, -hs + 0.3); g.add(fill);
      }
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), new THREE.MeshStandardMaterial({ color: 0xe4475b, roughness: 0.5 })); ball.position.set(hs - 0.5, 0.14, hs - 0.6); g.add(ball);
      const bone = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.22, 4, 8), new THREE.MeshStandardMaterial({ color: 0xffe8a8 })); bone.rotation.z = Math.PI / 2; bone.position.set(0.1, 0.06, 0.1); g.add(bone);
    }
    return { group: g, gate };
  }
  private doPetThing(ev: 'pat' | 'treat' | 'brush' | 'sing' | 'feed') {
    if (ev === 'feed') { this.feedPet(); this.captive!.timer = 16; return; }
    const cap = this.captive!; const owner = this.petOwner;
    owner.pos.set(cap.cx + 0.4, 0, cap.cz + cap.hs + 0.8);
    owner.yaw = Math.PI;
    const lines = {
      pat: ['Who\'s a good pet? Pat pat pat! 💕', 0xff7ab0, 5],
      treat: ['Here\'s a yummy treat for you! 🦴', 0xffd34a, 15],
      brush: ['Time to brush your fur! So soft and shiny! ✨', 0xffffff, 0],
      sing: ['🎵 Rock-a-bye, little pet, in your cozy cage… 🎵', 0xb5a0ff, 0],
    } as const;
    const [text, color, heal] = lines[ev];
    this.hp = Math.min(this.maxHp, this.hp + heal);
    this.effects.push(sparkleBurst(this.scene, this.pos.clone().setY(this.pos.y + 1), color, 14));
    if (ev === 'sing') this.audio.celebrate(); else this.audio.food();
    toast(`🧑 ${cap.owner}: "${text}"${heal ? ` +${heal} ❤️` : ''}`, 'gold', 3000);
  }
  private startWalk() {
    const cap = this.captive!; const h = this.hhouses[cap.house];
    this.petOwner.labelOverride = '🦮 Taking you for a walk';
    cap.onWalk = true; cap.walkTimer = 32; cap.nextTrick = 6; cap.trickUntil = 0; cap.wiggle = 0;
    const f = h.front;
    this.petOwner.place([[f.x, f.z - 2.5], [f.x + 6, f.z - 6], [f.x, f.z - 9.5], [f.x - 6, f.z - 6]]);
    this.petOwner.speedMult = 0.75;
    const y = this.world.collision.groundAt(f.x + 1.2, f.z - 2.5, 60, PHYSICS.stepUp);
    this.pos.set(f.x + 1.2, y, f.z - 2.5); this.vy = 0; this.groundY = y; this.yaw = Math.PI;
    this.cam.reset(this.yaw, true);
    if (!cap.leash) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
      cap.leash = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xd8344a }));
      cap.leash.frustumCulled = false;
      this.scene.add(cap.leash);
    }
    cap.leash.visible = true;
    toast(`🧑 ${cap.owner}: "Walkies time! Let's go for a walk!" 🦮`, 'gold', 3000);
  }
  private endWalk() {
    const cap = this.captive!;
    this.petOwner.labelOverride = '🎀 Your owner';
    cap.onWalk = false;
    if (cap.leash) cap.leash.visible = false;
    this.pos.set(cap.cx + 0.3, 0, cap.cz + 0.3); this.vy = 0; this.groundY = 0; this.yaw = 0;
    this.cam.reset(this.yaw, true);
    cap.caged = true; cap.wiggle = 0;
    this.closePenGate();
    this.petOwner.place(cap.roomRoute.map((q) => [q[0], q[1]] as [number, number]));
    cap.timer = 22;
    toast(`🧑 ${cap.owner}: "Back in your pet room, cutie!" — Now's your chance: wiggle the gate open (F) when they're not looking!`, 'good', 3800);
  }

  /** The owner caught you inside: back in the cage. */
  recage() {
    const c = this.captive; if (!c) return;
    c.caged = true; c.wiggle = 0;
    this.closePenGate();
    this.pos.set(c.cx + 0.3, 0, c.cz + 0.3); this.vy = 0; this.seat = null;
    this.petOwner.calmDown();
    this.audio.hurt();
    toast('😮 Oops! Back in your pet room! Wiggle the gate open again (F) and be sneakier!', 'bad', 3000);
  }
  endCaptivity() {
    const c = this.captive; if (!c) return;
    for (const col of c.cols) this.world.collision.remove(col);
    if (c.front) this.world.collision.remove(c.front);
    c.cage.removeFromParent();
    c.dinner?.bowl.removeFromParent();
    if (c.leash) c.leash.removeFromParent();
    this.captive = null;
    this.petOwner.active = false; this.petOwner.root.visible = false;
  }

  // ---- The Red Barn: open the door, go in, rescue animals
  private barnFront() { return { x: BARN.x, z: BARN.z - 6.4 }; }
  nearBarnDoor(r: number) {
    const f = this.barnFront();
    return !this.inBarn && Math.hypot(this.pos.x - f.x, this.pos.z - f.z) < r;
  }
  setBarnDoor(open: boolean) {
    this.barnDoorOpen = open;
    if (barnDoor) barnDoor.rotation.y = open ? 1.4 : 0;
    this.barn.setDoor(open);
  }
  private openBarnDoorOutside() {
    this.setBarnDoor(true);
    this.audio.click();
    // the creaky door is loud: nearby humans come running
    let heard = false;
    for (const hu of this.humans) if (hu.pos.distanceTo(this.pos) < HUMAN_AI.alertRadius) { hu.alert(); heard = true; }
    toast(heard ? '🧑 "Hey! Get away from my barn!" Quick, go inside!' : 'The barn door creaks open… Walk in! (L closes it)', heard ? 'bad' : 'good', 2600);
  }
  enterBarn() {
    if (this.respawning) return;
    if (!this.barnDoorOpen) this.setBarnDoor(true);
    this.respawning = true;
    $('fade-text').textContent = '🐮 Inside the barn…';
    $('fade').classList.add('on');
    this.later(0.6, () => {
      const s = this.barn.spawnInside;
      this.pos.set(s.x, 0, s.z); this.vy = 0; this.yaw = Math.PI; this.grounded = true; this.groundY = 0; this.lunge = null;
      this.cam.reset(this.yaw, true);
      $('fade').classList.remove('on');
      this.later(0.3, () => { this.respawning = false; });
      const left = this.barn.pens.filter((p) => !p.open).length;
      setTimeout(() => toast(left ? `🐾 ${left} animals are locked in pens! Walk to a gate and press F to set them free.` : 'All the animals are free! 🎉', 'good', 3600), 400);
    });
  }
  exitBarn() {
    if (this.respawning) return;
    if (!this.barnDoorOpen) this.setBarnDoor(true);
    this.respawning = true;
    $('fade-text').textContent = '🌾 Sneaking back out…';
    $('fade').classList.add('on');
    this.later(0.6, () => {
      const f = this.barnFront();
      const z = f.z - 1.8, y = this.world.collision.groundAt(f.x, z, 60, PHYSICS.stepUp);
      this.pos.set(f.x, y, z); this.vy = 0; this.yaw = Math.PI; this.grounded = true; this.groundY = y; this.lunge = null;
      this.cam.reset(this.yaw, true);
      $('fade').classList.remove('on');
      this.later(0.3, () => { this.respawning = false; });
    });
  }
  // ---- Math problems: solve one to open locks and gates! -----------------------------------
  private makeProblem(): { text: string; answer: number; choices: number[] } {
    const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
    const kind = ri(0, 3);
    let text = '', answer = 0;
    if (kind === 0) { const a = ri(3, 15), b = ri(2, 12); text = `${a} + ${b}`; answer = a + b; }
    else if (kind === 1) { const a = ri(8, 20), b = ri(2, a - 1); text = `${a} − ${b}`; answer = a - b; }
    else if (kind === 2) { const a = ri(2, 5), b = ri(2, 10); text = `${a} × ${b}`; answer = a * b; }
    else { const a = [2, 5, 10][ri(0, 2)], b = ri(2, 9); text = `${a} × ${b}`; answer = a * b; }
    const set = new Set([answer]);
    while (set.size < 4) { const w = answer + ri(-5, 5); if (w >= 0 && w !== answer) set.add(w); }
    return { text, answer, choices: [...set].sort(() => Math.random() - 0.5) };
  }
  /** Shows a math problem. onWrong returns true to try another problem, false to give up. */
  mathChallenge(title: string, hint: string, onRight: () => void, onWrong: () => boolean) {
    this.openModal('math', (box) => {
      const render = (note = '') => {
        box.innerHTML = '';
        box.append(this.head(title, false));
        const pr = this.makeProblem();
        const body = el('div', { class: 'modal-body math-body' });
        body.append(el('p', { class: 'math-hint', text: hint }), el('div', { class: 'math-q', text: `${pr.text} = ?` }));
        if (note) body.append(el('p', { class: 'math-note', text: note }));
        const row = el('div', { class: 'math-choices' });
        for (const c of pr.choices) row.append(button(String(c), 'btn-shop math-choice', () => {
          if (c === pr.answer) { this.audio.purchase(); this.closeModal(); onRight(); }
          else { this.audio.hurt(); if (onWrong()) render(`Not quite: ${pr.text} = ${pr.answer}. Try this one!`); else this.closeModal(); }
        }));
        body.append(row);
        box.append(body);
      };
      render();
    }, true);
  }
  private lockStrikes = 0;
  /** Solve a math problem to unlock a pen. Three wrong answers make too much noise and Farmer Lee comes! */
  unlockPen(p: Pen) {
    if (p.open || this.respawning) return;
    this.mathChallenge(`🔒 Unlock the ${p.name}'s pen!`, 'Solve it to open the lock. Careful: wrong answers make noise!', () => { this.lockStrikes = 0; this.rescue(p); }, () => {
      this.lockStrikes++;
      if (this.lockStrikes >= 3) {
        this.lockStrikes = 0;
        const lee = this.humans.find((h) => h.spawn.name === 'Farmer Lee') ?? this.humans[0];
        setTimeout(() => { toast(`🧑 ${lee.spawn.name}: "Hey! Who's messing with my animals?!"`, 'bad', 2600); this.captureByHuman(lee); }, 300);
        return false;
      }
      toast(`🔊 Clank! The lock rattles… (${3 - this.lockStrikes} more noisy tries before Farmer Lee hears!)`, 'bad', 2400);
      return true;
    });
  }
  /** Mash F to break a pen's lock. It's noisy: take too long and the farmer catches you. */
  breakLock(p: Pen) {
    if (p.open || this.respawning) return;
    p.lock = Math.min(100, p.lock + 9);
    if (p.lockStart === null) { p.lockStart = this.now; this.lockWarned = false; }
    this.audio.click();
    if (p.lock >= 100) { p.lock = 0; p.lockStart = null; this.rescue(p); }
  }
  private lockWarned = false;
  private updateLocks(dt: number) {
    if (!this.inBarn || this.respawning) return;
    for (const p of this.barn.pens) {
      if (p.open) continue;
      p.lock = Math.max(0, p.lock - 8 * dt);
      if (p.lock <= 0) { p.lockStart = null; continue; }
      if (p.lockStart === null) continue;
      const t = this.now - p.lockStart;
      if (t > 4 && !this.lockWarned) { this.lockWarned = true; toast('👂 Footsteps outside… hurry!', 'bad', 1800); }
      if (t > 7.5) {
        p.lock = 0; p.lockStart = null;
        const lee = this.humans.find((h) => h.spawn.name === 'Farmer Lee') ?? this.humans[0];
        toast(`🧑 ${lee.spawn.name}: "Hey! Who's messing with my animals?!"`, 'bad', 2600);
        this.captureByHuman(lee);
        return;
      }
    }
  }

  rescue(p: Pen) {
    if (!this.barn.openPen(p)) return;
    this.save.rescued.push(p.kind);
    this.audio.purchase();
    this.effects.push(sparkleBurst(this.scene, new THREE.Vector3(p.x, 1, p.z), 0xfff2b0, 18));
    this.spawnReward(10, false);
    this.addPet(p.kind, true);
    this.persist();
    const fr = this.pets[this.pets.length - 1];
    toast(`${p.emoji} You rescued ${fr.name}! Your friend will follow you home. Jump for +10! (${this.save.rescued.length} friends saved)`, 'good', 3600);
    this.petSay(fr, 'Thank you for saving me! I\'ll follow you home! 💛', 4);
  }
  /** Friends' Lane: every rescued friend gets their very own little house next to your home. */
  private static FH = { hw: 2.2, hd: 1.8, door: 0.55, wallH: 2.2 };
  private static FRIEND_SLOTS = FRIEND_SPOTS;   // dotted all over the forest
  private static HOUSE_LOOK: Record<FarmKind, { wall: number; roof: number; door: number }> = {
    piglet: { wall: 0xffd6dc, roof: 0xe0607a, door: 0xb83a5a }, lamb: { wall: 0xf4f1ea, roof: 0x7aa8d8, door: 0x4a78b0 },
    calf: { wall: 0xffffff, roof: 0x3a3a3a, door: 0xc0464a }, goat: { wall: 0xe8d8b8, roof: 0x8a6a3a, door: 0x6a8a3a },
    chick: { wall: 0xfff0a0, roof: 0xf09a30, door: 0xe8508a }, duckling: { wall: 0xc8ecff, roof: 0xf0c030, door: 0x3a90d0 },
    puppy: { wall: 0xd8b088, roof: 0xc0464a, door: 0x3a6ab0 }, kitten: { wall: 0xe0d8f0, roof: 0x8a6ac8, door: 0xe8508a },
    pony: { wall: 0xf0e0c8, roof: 0x4a8a5a, door: 0x8a5a3a }, bunny: { wall: 0xfff4e8, roof: 0xf2a6b6, door: 0x7ac08a },
    alpaca: { wall: 0xf8e8d0, roof: 0x2fa8a0, door: 0xf08a3a },
  };
  private friendHouses: ({ x: number; z: number; y: number; owner: string; door: THREE.Object3D; open: boolean; col: Collider | null; sleeping: boolean } | null)[] = [];
  private friendGlass = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, emissive: 0xffc870, emissiveIntensity: 0, roughness: 0.15 });
  /** Where a friend's house is (houses are shared only if you rescue more than 10 friends). */
  private petHome(p: Game['pets'][number]) {
    const slot = this.pets.indexOf(p) % Game.FRIEND_SLOTS.length;
    return { slot, roommate: Math.floor(this.pets.indexOf(p) / Game.FRIEND_SLOTS.length), ...Game.FRIEND_SLOTS[slot] };
  }
  private buildFriendHouse(slot: number, owner: { name: string; emoji: string; kind: FarmKind }) {
    if (this.friendHouses[slot]) return;
    const { x, z } = Game.FRIEND_SLOTS[slot];
    const { hw, hd, door, wallH } = Game.FH;
    const look = Game.HOUSE_LOOK[owner.kind];
    let y = -Infinity;
    for (const ox of [-hw, 0, hw]) for (const oz of [-hd, 0, hd + 1]) y = Math.max(y, terrainHeight(x + ox, z + oz));
    const g = new THREE.Group(); g.position.set(x, y, z); this.scene.add(g);
    const wood = new THREE.MeshStandardMaterial({ map: plankTexture(look.wall, false), roughness: 0.9 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const box = (m: THREE.Material, w: number, h: number, d: number, px: number, py: number, pz: number, shadow = true) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(px, py, pz); b.castShadow = shadow; b.receiveShadow = true; g.add(b); return b;
    };
    const T = 0.16;
    // floor (deep, so it covers sloping ground) and a stone step
    box(new THREE.MeshStandardMaterial({ map: plankTexture(0xb0784a, true), roughness: 0.9 }), hw * 2, 1.12, hd * 2, 0, -0.44, 0, false);
    box(new THREE.MeshStandardMaterial({ color: 0x9a9088, roughness: 1 }), door * 2 + 0.4, 0.6, 0.6, 0, -0.2, hd + 0.4, false);
    // walls, with a doorway in the front
    box(wood, hw * 2 + T, wallH, T, 0, wallH / 2, -hd);
    for (const sx of [-hw, hw]) box(wood, T, wallH, hd * 2, sx, wallH / 2, 0);
    const side = hw - door;
    for (const sx of [-1, 1]) box(wood, side, wallH, T, sx * (door + side / 2), wallH / 2, hd);
    box(wood, door * 2, wallH - 1.7, T, 0, 1.7 + (wallH - 1.7) / 2, hd);
    for (const sx of [-1, 1]) box(trim, 0.08, 1.7, 0.22, sx * door, 0.85, hd);
    box(trim, door * 2 + 0.16, 0.1, 0.22, 0, 1.72, hd);
    // a colourful door, open and swung inward
    const dp = box(new THREE.MeshStandardMaterial({ color: look.door, roughness: 0.6 }), door * 2 - 0.08, 1.62, 0.07, 0, 0.82, 0);
    dp.geometry.translate(door - 0.04, 0, 0); dp.position.set(-door, 0.82, hd - 0.08); dp.rotation.y = Math.PI / 2 + 0.25;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf0c040, metalness: 0.6, roughness: 0.3 }));
    knob.position.set(door * 2 - 0.25, 0, 0.06); dp.add(knob);
    // windows with frames and flower boxes
    const flowerCols = [0xff6a8a, 0xffd34a, 0xb07aff, 0xff9a3a, 0xffffff];
    const win = (px: number, pz: number, rotY: number, flowers: boolean) => {
      const wg = new THREE.Group(); wg.position.set(px, 1.3, pz); wg.rotation.y = rotY; g.add(wg);
      for (const zz of [0.1, -0.1]) { const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.6), this.friendGlass); pane.position.z = zz; if (zz < 0) pane.rotation.y = Math.PI; wg.add(pane); }
      for (const [w, h, ox, oy] of [[0.84, 0.07, 0, 0.33], [0.84, 0.07, 0, -0.33], [0.07, 0.7, 0.39, 0], [0.07, 0.7, -0.39, 0], [0.04, 0.6, 0, 0], [0.7, 0.04, 0, 0]] as const) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), trim); f.position.set(ox, oy, 0.12); wg.add(f);
      }
      if (flowers) {
        const fb = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.2), new THREE.MeshStandardMaterial({ color: 0x8a5a3a })); fb.position.set(0, -0.44, 0.2); wg.add(fb);
        for (let k = 0; k < 4; k++) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: flowerCols[(k + slot) % 5] })); fl.position.set(-0.3 + k * 0.2, -0.33, 0.22); wg.add(fl); }
      }
    };
    win(-(door + side / 2), hd, 0, true); win(door + side / 2, hd, 0, true);
    win(-hw, 0, -Math.PI / 2, false); win(hw, 0, Math.PI / 2, false);
    // gable roof + chimney
    const rs = new THREE.Shape(); rs.moveTo(-hw - 0.4, 0); rs.lineTo(0, 1.4); rs.lineTo(hw + 0.4, 0); rs.lineTo(-hw - 0.4, 0);
    const rg = new THREE.ExtrudeGeometry(rs, { depth: hd * 2 + 0.6, bevelEnabled: false }); rg.translate(0, 0, -hd - 0.3);
    const roof = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ map: roofTexture(look.roof), roughness: 0.8 })); roof.position.y = wallH; roof.castShadow = true; g.add(roof);
    box(new THREE.MeshStandardMaterial({ color: 0xa05040, roughness: 0.9 }), 0.4, 1.0, 0.4, hw * 0.5, wallH + 1.0, -hd * 0.4);
    // inside: a cosy bed, food and water bowls, a rug
    const bx = -hw + 0.9, bz = -hd + 0.75;
    box(new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.8 }), 1.5, 0.22, 1.1, bx, 0.23, bz, false);
    box(new THREE.MeshStandardMaterial({ color: look.door, roughness: 0.95 }), 1.4, 0.12, 1.0, bx, 0.38, bz, false);
    const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
    pillow.scale.set(1, 0.4, 0.65); pillow.position.set(bx - 0.4, 0.48, bz); g.add(pillow);
    for (const [ox, col] of [[hw - 0.45, 0x4aa8ff], [hw - 0.95, 0xe0a040]] as const) {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.13, 0.1, 14), new THREE.MeshStandardMaterial({ color: look.roof })); bowl.position.set(ox, 0.17, -hd + 0.45); g.add(bowl);
      const inside = new THREE.Mesh(new THREE.CircleGeometry(0.15, 14), new THREE.MeshStandardMaterial({ color: col })); inside.rotation.x = -Math.PI / 2; inside.position.set(ox, 0.225, -hd + 0.45); g.add(inside);
    }
    const rug = new THREE.Mesh(new THREE.CircleGeometry(0.75, 20), new THREE.MeshStandardMaterial({ color: flowerCols[slot % 5], roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0.5, 0.125, 0.4); g.add(rug);
    // front garden: flower bushes by the door and a mailbox
    for (const sx of [-1, 1]) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshStandardMaterial({ color: 0x4a9a4a, roughness: 1 })); bush.position.set(sx * (door + 0.65), 0.15, hd + 0.5); bush.scale.y = 0.75; g.add(bush);
      for (let k = 0; k < 3; k++) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshStandardMaterial({ color: flowerCols[(k + slot + 2) % 5] })); fl.position.set(sx * (door + 0.65) + (k - 1) * 0.18, 0.38, hd + 0.62); g.add(fl); }
    }
    box(new THREE.MeshStandardMaterial({ color: 0x8a5a3a }), 0.08, 0.8, 0.08, hw - 0.2, 0.4, hd + 1.4);
    box(new THREE.MeshStandardMaterial({ color: look.door }), 0.32, 0.24, 0.42, hw - 0.2, 0.9, hd + 1.4);
    // name sign over the door
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const cx = c.getContext('2d')!; cx.fillStyle = '#fff4e0'; cx.beginPath(); cx.roundRect(4, 4, 504, 120, 30); cx.fill();
    cx.strokeStyle = '#' + look.door.toString(16).padStart(6, '0'); cx.lineWidth = 8; cx.stroke();
    const first = owner.name.split(' the ')[0];
    cx.fillStyle = '#5a3a2a'; cx.font = 'bold 54px Nunito, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(`${first}'s House ${owner.emoji}`, 256, 68, 480);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: t, transparent: true })); sign.position.set(0, wallH + 0.4, hd + 0.33); g.add(sign);
    // floor you stand on, and walls you bump into (the doorway stays open)
    const W = this.world.collision;
    W.add({ kind: 'box', minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, top: y + 0.12, tall: false });
    W.add({ kind: 'box', minX: x - door - 0.2, maxX: x + door + 0.2, minZ: z + hd, maxZ: z + hd + 0.7, top: y + 0.1, tall: false });
    const wall = (minX: number, maxX: number, minZ: number, maxZ: number) => W.add({ kind: 'box', minX: x + minX, maxX: x + maxX, minZ: z + minZ, maxZ: z + maxZ, top: 100, tall: true });
    wall(-hw - 0.1, hw + 0.1, -hd - 0.12, -hd + 0.12);
    wall(-hw - 0.12, -hw + 0.12, -hd, hd); wall(hw - 0.12, hw + 0.12, -hd, hd);
    wall(-hw - 0.1, -door, hd - 0.12, hd + 0.12); wall(door, hw + 0.1, hd - 0.12, hd + 0.12);
    wall(hw - 0.3, hw - 0.1, hd + 1.3, hd + 1.5); // mailbox
    W.add({ kind: 'box', minX: x + bx - 0.75, maxX: x + bx + 0.75, minZ: z + bz - 0.55, maxZ: z + bz + 0.55, top: y + 0.44, tall: false }); // the bed
    this.friendHouses[slot] = { x, z, y, owner: owner.name, door: dp, open: true, col: null, sleeping: false };
  }
  /** Open or close a friend's front door (it swings smoothly; a closed door blocks the doorway). */
  private setFriendDoor(slot: number, open: boolean) {
    const h = this.friendHouses[slot]; if (!h || h.open === open) return;
    h.open = open;
    const { hd, door } = Game.FH;
    if (!open && !h.col) h.col = this.world.collision.add({ kind: 'box', minX: h.x - door, maxX: h.x + door, minZ: h.z + hd - 0.12, maxZ: h.z + hd + 0.12, top: 100, tall: true });
    if (open && h.col) { this.world.collision.remove(h.col); h.col = null; }
    if (Math.hypot(this.pos.x - h.x, this.pos.z - h.z) < 25) this.audio.click();
  }
  /** Friends close their doors when they go to sleep, and open them in the morning. */
  private updateFriendDoors(dt: number) {
    this.friendHouses.forEach((h, slot) => {
      if (!h) return;
      const people = this.pets.filter((p) => this.petHome(p).slot === slot && !p.caged);
      const sleeping = people.length > 0 && people.every((p) => p.asleep);
      if (sleeping !== h.sleeping) {
        h.sleeping = sleeping;
        this.setFriendDoor(slot, !sleeping);
        const p = people[0];
        if (p && Math.hypot(this.pos.x - h.x, this.pos.z - h.z) < 20) this.petSay(p, sleeping ? 'Night night! *closes the door* 🚪💤' : 'Good morning! *opens the door* ☀️', 3);
      }
      const target = h.open ? Math.PI / 2 + 0.25 : 0;
      h.door.rotation.y += (target - h.door.rotation.y) * Math.min(1, dt * 5);
    });
  }
  /** The friend's door you're standing next to (inside or outside), if any. */
  private nearFriendDoor() {
    const { hd } = Game.FH;
    for (let slot = 0; slot < this.friendHouses.length; slot++) {
      const h = this.friendHouses[slot]; if (!h) continue;
      if (Math.abs(this.pos.x - h.x) < 1.4 && Math.abs(this.pos.z - (h.z + hd)) < 1.6) return slot;
    }
    return -1;
  }
  /** Friends walk through their doorway instead of through the walls. */
  private petStep(p: Game['pets'][number], tx: number, tz: number) {
    const H = this.petHome(p), { hw, hd } = Game.FH;
    const inside = (px: number, pz: number) => Math.abs(px - H.x) < hw && pz - H.z < hd && pz - H.z > -hd;
    const insideNow = inside(p.x, p.z);
    if (insideNow === inside(tx, tz)) return { tx, tz };
    if (this.friendHouses[H.slot] && !this.friendHouses[H.slot]!.open) this.setFriendDoor(H.slot, true);
    const near = { x: H.x, z: H.z + (insideNow ? hd - 0.5 : hd + 0.8) };
    const far = { x: H.x, z: H.z + (insideNow ? hd + 0.8 : hd - 0.6) };
    if (Math.abs(p.x - near.x) > 0.3) return { tx: near.x, tz: near.z };
    return { tx: far.x, tz: far.z };
  }
  /** "Friends, go home" button: everyone following you heads back to their own house. */
  friendsGoHome() {
    const fam = this.family.filter((f) => f.following);
    for (const f of fam) this.sendFamilyHome(f);
    const goers = this.pets.filter((p) => p.following);
    for (const p of goers) this.sendPetHome(p);
    this.petWalkHome();
    const names = [...fam.map((f) => f.name), ...goers.map((p) => p.name.split(' the ')[0])];
    if (names.length) toast(`🏠 ${names.join(', ')} ${names.length > 1 ? 'are' : 'is'} walking home. Bye bye! 👋`, 'good', 2600);
    this.audio.click();
  }
  /** A friend turns around and walks back to their house (you can watch them go). */
  private sendPetHome(p: Game['pets'][number]) {
    const H = this.petHome(p);
    p.following = false; p.settled = true; p.wait = 0; p.trick = undefined;
    p.tx = H.x + (H.roommate ? 0.6 : -0.3); p.tz = H.z + Game.FH.hd + 1.2;
    if (this.pos.z < -300) { p.x = p.tx; p.z = p.tz; return; }   // inside somewhere: they slip out and go home
    p.goingHome = true;
    this.petSay(p, ['Okay! See you at home! 🏠', 'Bye bye! 💛', 'Going home for a nap! 💤'][Math.floor(Math.random() * 3)], 3);
  }
  /** Mom, Dad or Baby Pip walk back to your house. */
  private sendFamilyHome(f: Game['family'][number]) {
    if (this.indoors || this.pos.z < -300) { this.setFamilyFollow(f, false); return; }
    f.following = false; f.walkingHome = true; f.trick = undefined;
    this.familySay(f.name, f.name === 'Baby Pip' ? 'Bye bye! See you at home! 👋' : 'See you at home, sweetie! 🏠', 3);
  }
  private finishFamilyWalk(f: Game['family'][number]) {
    f.walkingHome = false; f.following = true;     // so setFamilyFollow does the move-in
    this.setFamilyFollow(f, false);
  }
  private petWalkHome() { if (this.walker) this.endPetWalk(false); }

  // ---- YOUR OWN PETS: catch smaller wild animals and keep them in the upstairs Pet Room -------------
  private petRigs: (AnimalRig | null)[] = [];
  private walker: { idx: number; rig: AnimalRig; x: number; z: number; leash: THREE.Line; hop: number } | null = null;
  private petHop: number[] = [0, 0, 0, 0, 0];
  private static PET_NAMES = ['Bandit', 'Pebbles', 'Ziggy', 'Snickers', 'Biscuit', 'Sprout', 'Nibbles', 'Maple', 'Pickles', 'Doodle', 'Tofu', 'Muffin', 'Rocket', 'Peanut', 'Bubbles'];
  private static SPECIES_EMOJI: Record<string, string> = { human: '🧑', monkey: '🐒', raptor: '🦖', trex: '🦖', bunny: '🐰', chicken: '🐔', penguin: '🐧', cat: '🐱', dog: '🐶', horse: '🐴', panda: '🐼', tiger: '🐯', badger: '🦡', fox: '🦊', boar: '🐗', wolf: '🐺', warthog: '🐗', hyena: '🐕', lion: '🦁', otter: '🦦', crocodile: '🐊', seal: '🦭', elephantSeal: '🦭', leopardSeal: '🦭', bear: '🐻' };
  private petLabel(i: number) { const q = this.save.myPets[i]; return q ? `${q.name} the ${q.species === 'trex' ? 'T. rex' : q.species.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())} ${Game.SPECIES_EMOJI[q.species] ?? '🐾'}` : ''; }
  private buildMyPetRig(species: string, female = false) {
    let rig = buildOpponent(species as OppSpecies, 1, female);
    if (rig.radius > 0.6) { disposeRig(rig); rig = buildOpponent(species as OppSpecies, 0.6 / rig.radius, female); }
    return rig;
  }
  /** Put the 5 pens (and the pets in them) into the Pet Room. Called whenever the house is rebuilt. */
  placeMyPets() {
    this.zoo?.placePets(this.save.myPets, new Set([this.walker?.idx ?? -1, ...this.pack.map((m) => m.idx), ...this.save.myPets.flatMap((q, k) => (q.lost ? [k] : []))]));
    if (this.zoo) this.placeNests();
    for (const r of this.petRigs) if (r) { r.root.removeFromParent(); disposeRig(r); }
    this.petRigs = [];
    const I = this.interior, room = I.petRoom;
    if (!room) return;
    I.petPens.forEach((pen, i) => {
      const { group } = this.buildPen(1.7, 0.9, false);
      group.position.set(pen.x, room.y, pen.z); group.rotation.y = pen.ry;
      I.group.add(group);
      I.addCollider({ kind: 'box', minX: pen.x - 0.9, maxX: pen.x + 0.9, minZ: pen.z - 0.9, maxZ: pen.z + 0.9, top: 100, tall: true, bottom: room.y });
      // a name sign on the pen
      const q = this.save.myPets[i];
      const c = document.createElement('canvas'); c.width = 256; c.height = 64;
      const g = c.getContext('2d')!; g.fillStyle = '#fffaf0'; g.beginPath(); g.roundRect(2, 2, 252, 60, 14); g.fill();
      g.fillStyle = '#3f6a2a'; g.font = 'bold 30px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(q ? `${q.name} ${Game.SPECIES_EMOJI[q.species] ?? '🐾'}` : 'Empty 🐾', 128, 34, 240);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.23), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
      sign.position.set(0, 1.15, 0.9); group.add(sign);
      // a pet chicken gets a straw nest just outside her pen, where her eggs go
      if (q?.species === 'chicken') {
        const n = this.nestSpot(i);
        const nest = new THREE.Group(); nest.position.set(n.x, room.y, n.z); I.group.add(nest);
        const straw = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.1, 8, 18), new THREE.MeshStandardMaterial({ color: 0xd8b860, roughness: 1 })); straw.rotation.x = Math.PI / 2; straw.position.y = 0.1; nest.add(straw);
        const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.26, 16), new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 1 })); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.03; nest.add(bottom);
        for (let e = 0; e < (q.eggs ?? 0); e++) {
          const egg = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfaf4e6, roughness: 0.35 }));
          egg.scale.set(0.85, 1.1, 0.85); egg.position.set(Math.cos(e * 2.1) * 0.1, 0.1, Math.sin(e * 2.1) * 0.1); nest.add(egg);
        }
      }
      if (!q || this.walker?.idx === i) { this.petRigs.push(null); return; }
      const rig = this.buildMyPetRig(q.species, !!q.female);
      dressRig(rig, q.outfit); dressBody(rig, q.clothes);
    dressRig(rig, q.outfit); dressBody(rig, q.clothes);
      rig.root.position.set(pen.x, room.y, pen.z); rig.root.rotation.y = pen.ry;
      I.group.add(rig.root);
      this.petRigs.push(rig);
    });
  }
  /** Where a pet chicken's nest is: just outside her pen, beside the gate. */
  private nestSpot(i: number) {
    // inside her habitat in the Magic Zoo, just beside the glass door
    const pen = this.zoo.pens[i];
    return { x: pen.door.x + pen.side * 1.3, z: pen.door.z - 2.6 };
  }
  private nests: THREE.Group[] = [];
  private placeNests() {
    for (const n of this.nests) n.removeFromParent();
    this.nests = [];
    this.save.myPets.forEach((q, i) => {
      if (q.species !== 'chicken' || i >= this.zoo.pens.length) return;
      const n = this.nestSpot(i);
      const nest = new THREE.Group(); nest.position.set(n.x, 0, n.z); this.zoo.inside.add(nest); this.nests.push(nest);
      const straw = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.11, 8, 18), new THREE.MeshStandardMaterial({ color: 0xd8b860, roughness: 1 })); straw.rotation.x = Math.PI / 2; straw.position.y = 0.11; nest.add(straw);
      const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 1 })); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.03; nest.add(bottom);
      for (let e = 0; e < (q.eggs ?? 0); e++) {
        const egg = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfaf4e6, roughness: 0.35 }));
        egg.scale.set(0.85, 1.1, 0.85); egg.position.set(Math.cos(e * 2.1) * 0.11, 0.1, Math.sin(e * 2.1) * 0.11); nest.add(egg);
      }
    });
  }
  /** The chicken nest you're standing next to (with eggs in it), if any. */
  private nearNest() {
    if (!this.inZoo) return -1;
    return this.save.myPets.findIndex((q, i) => q.species === 'chicken' && i < this.zoo.pens.length && (q.eggs ?? 0) > 0 && (() => { const n = this.nestSpot(i); return Math.hypot(n.x - this.pos.x, n.z - this.pos.z) < 1.4; })());
  }
  /** Press M at the nest to grab the eggs. */
  collectEggs(i = this.nearNest()) {
    const q = this.save.myPets[i];
    if (!q || !(q.eggs ?? 0)) { if (this.inZoo) toast('🥚 Walk up to a chicken\'s nest with eggs in it and press M!', '', 2000); return; }
    const take = Math.min(q.eggs!, BAG_LIMIT - this.bagTotal());
    if (take <= 0) { toast('🎒 Your bag is full! Eat something or unpack it first.', 'bad', 2400); return; }
    this.save.bag.egg = (this.save.bag.egg ?? 0) + take; q.eggs = q.eggs! - take;
    this.persist(); this.placeMyPets(); this.audio.food();
    const n = this.nestSpot(i);
    this.effects.push(sparkleBurst(this.scene, new THREE.Vector3(n.x, 0.5, n.z), 0xfff6d8, 12));
    toast(`🥚 You grabbed ${take} fresh egg${take > 1 ? 's' : ''} from ${q.name}'s nest! They're in your bag.`, 'good', 2600);
  }
  private eggTimer = 0;
  private updateMyPets(dt: number) {
    // pet chickens lay an egg every little while (up to 3 waiting in the pen)
    this.eggTimer += dt;
    if (this.eggTimer > 45) {
      this.eggTimer = 0;
      let laid = '';
      for (const q of this.save.myPets) if (q.species === 'chicken' && (q.eggs ?? 0) < 3) { q.eggs = (q.eggs ?? 0) + 1; laid = q.name; }
      if (laid) { this.persist(); this.placeMyPets(); if (this.inZoo) toast(`🥚 Cluck cluck! ${laid} laid an egg in her nest! (press M at the nest to grab it)`, 'good', 2800); }
    }
    const upstairs = this.indoors && this.interior.petRoom && this.pos.y > this.interior.petRoom.y - 1;
    this.petRigs.forEach((r, i) => {
      if (!r || !upstairs) return;
      animateRig(r, dt, { speed: 0, airborne: false, attack: null, attackT: 0, windup: 0 });
      if (this.petHop[i] > 0) { this.petHop[i] -= dt; r.root.position.y = this.interior.petRoom!.y + Math.abs(Math.sin(this.petHop[i] * 9)) * 0.3; }
    });
    this.updatePack(dt);
    const w = this.walker;
    if (w) {
      const slot = this.family.filter((f) => f.following).length + this.pets.filter((p) => p.following).length;
      const foe = this.protectTarget();
      const { bx, bz, target } = foe ? { bx: foe.pos.x - foe.radius - 0.9, bz: foe.pos.z, target: foe } : this.helperGoal(slot);
      this.helperAttack(w, w.x, w.z, target, foe ? 22 : 5, w.rig);
      const dx = bx - w.x, dz = bz - w.z, d = Math.hypot(dx, dz);
      let speed = 0;
      const fetching = this.fetch?.who === 'walker';
      if (this.riding?.petIdx === w.idx) { w.x = this.pos.x; w.z = this.pos.z; }
      if (fetching) speed = Math.hypot(this.fetch!.ball.position.x - w.x, this.fetch!.ball.position.z - w.z) > 1 ? 5 : 0;
      else if (d > 18 || this.respawning) { w.x = bx; w.z = bz; }
      else if (d > 0.4) { const v = Math.min(d * 3, 9), st = Math.min(d, v * dt); w.x += (dx / d) * st; w.z += (dz / d) * st; speed = v; w.rig.root.rotation.y = Math.atan2(dx, dz); }
      const y = this.world.collision.groundAt(w.x, w.z, this.pos.y + 0.5, 0.4);
      w.rig.root.position.set(w.x, y + (w.hop > 0 ? Math.abs(Math.sin(w.hop * 9)) * 0.3 : 0), w.z);
      if (w.hop > 0) w.hop -= dt;
      animateRig(w.rig, dt, { speed: Math.min(speed, 4), airborne: false, attack: null, attackT: 0, windup: 0 });
      const a = this.pos.clone().setY(this.pos.y + this.rig.height * 0.6), b = w.rig.root.position.clone().setY(y + w.rig.height * 0.6);
      const pos = w.leash.geometry.attributes.position as THREE.BufferAttribute;
      pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, (a.x + b.x) / 2, Math.min(a.y, b.y) - 0.15, (a.z + b.z) / 2); pos.setXYZ(2, b.x, b.y, b.z);
      pos.needsUpdate = true; w.leash.geometry.computeBoundingSphere();
    }
  }
  /** Catch a wild animal that's smaller than you and take it home as a pet. */
  catchWild(o: Opponent) {
    if (this.save.myPets.length >= ZOO_SLOTS) { toast(`🐾 Your Magic Zoo is full (${ZOO_SLOTS} pets)! Let one go free first.`, 'bad', 3000); return; }
    const used = new Set(this.save.myPets.map((q) => q.name));
    const name = Game.PET_NAMES.find((n) => !used.has(n) && Math.random() < 0.5) ?? Game.PET_NAMES.find((n) => !used.has(n)) ?? 'Buddy';
    this.save.myPets.push({ species: o.spawn.species, name, fed: 0, female: /lioness/i.test(o.spawn.name) || undefined });
    o.state = 'gone'; o.rig.root.visible = false; o.respawnAt = this.now + 120; o.label.style.display = 'none';
    this.effects.push(sparkleBurst(this.scene, o.pos.clone().setY(o.pos.y + 0.8), 0x9fe870, 18));
    this.audio.purchase();
    this.persist();
    this.placeMyPets();
    toast(`🎉 You caught a ${o.spawn.name} and named it ${name}! It lives in your Magic Zoo ✨ (the tiny hut by your house). Visit it to give it a name! (${this.save.myPets.length}/${ZOO_SLOTS})`, 'good', 4200);
  }
  /** Visit a pet in the Pet Room: feed it, take it for a walk, or let it go free. */
  openMyPet(i: number) {
    const q = this.save.myPets[i]; if (!q) return;
    this.openModal('pets', (box) => {
      box.innerHTML = '';
      box.append(this.head(`🐾 ${this.petLabel(i)}`, false));
      const body = el('div', { class: 'modal-body' });
      const nd = Game.needOf(q), md = Game.moodOf(q);
      body.append(el('p', { style: 'font-weight:800', text: md === 'happy' ? `😊 ${q.name} is happy!` : md === 'sad' ? `😢 ${q.name} is sad. It wants ${this.wantOf(q)}.` : `😠 ${q.name} is ANGRY! It needs ${this.wantOf(q)}.` }));
      const bar = (label: string, v: number, col: string) => el('div', { class: 'need-row' }, el('span', { class: 'need-label', text: label }), el('div', { class: 'need-bar' }, el('div', { class: 'need-fill', style: `width:${Math.round(v)}%;background:${v < 22 ? '#e4475b' : v < 50 ? '#f2b20f' : col}` })));
      body.append(bar('🍎 Food', nd.food, '#4fae3a'), bar('🎾 Play', nd.fun, '#3b8fd9'), bar('🦮 Walks', nd.walkies, '#b07ad8'));
      // give your pet any name you like
      const nameInp = el('input', { type: 'text', maxlength: '14', value: q.name, 'aria-label': 'Pet name', autocomplete: 'off' }) as HTMLInputElement;
      const saveName = () => {
        const nn = nameInp.value.trim().slice(0, 14);
        if (!nn || nn === q.name) return;
        const old = q.name; q.name = nn; this.persist(); this.placeMyPets();
        toast(`✏️ ${old} is now called ${nn}! 💛`, 'good', 2200);
        this.closeModal(); setTimeout(() => this.openMyPet(i), 60);
      };
      nameInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveName(); } });
      body.append(el('div', { class: 'chat-form', style: 'margin-bottom:10px' }, el('span', { text: '✏️ Name:', style: 'font-weight:800;align-self:center' }), nameInp, button('Save name', 'btn-green btn-small', saveName)));
      const food = (Object.keys(this.save.bag) as FoodType[]).find((k) => (this.save.bag[k] ?? 0) > 0);
      if (q.species === 'chicken') {
        const n = q.eggs ?? 0;
        body.append(el('p', { text: n ? `🥚 There ${n > 1 ? 'are' : 'is'} ${n} egg${n > 1 ? 's' : ''} in ${q.name}'s nest, just outside the pen. Walk to the nest and press M to grab ${n > 1 ? 'them' : 'it'}!` : `🥚 ${q.name} lays eggs in her nest outside the pen. Check back soon!` }));
      }
      body.append(el('div', { class: 'action-row', style: 'flex-wrap:wrap' },
        button(food ? `🍎 Feed ${q.name} (${FOOD_NAMES[food]})` : '🍎 Feed (your bag is empty)', 'btn-green', () => {
          if (!food) return;
          this.save.bag[food] = (this.save.bag[food] ?? 1) - 1; if (!this.save.bag[food]) delete this.save.bag[food];
          q.fed++; this.cheerPet(i, 'food', 100); this.persist(); this.closeModal();
          this.petHop[i] = 1.2; this.audio.food();
          const pen = this.interior.petPens[i];
          this.effects.push(sparkleBurst(this.scene, new THREE.Vector3(pen.x, this.interior.petRoom!.y + 1, pen.z), 0xff8ac0, 16));
          toast(`😋 ${q.name} loved the ${FOOD_NAMES[food]}! Happy hops! 💛`, 'good', 2600);
        }, !food),
        ...(q.species === 'horse' && this.species === 'human' ? [button(`🐴 Ride ${q.name}`, 'btn-green', () => { this.closeModal(); if (this.walker?.idx !== i) this.startPetWalk(i); setTimeout(() => { if (this.walker?.idx === i) this.mountHorse({ opp: null, petIdx: i, name: q.name }); }, 80); })] : []),
        button(`💕 Pet ${q.name}`, 'btn-small', () => { this.closeModal(); const an = this.zoo.animals[i]; if (an && this.inZoo) { this.cuddle = { a: an, until: this.now + 1.6 }; an.busy = true; this.effects.push(sparkleBurst(this.scene, new THREE.Vector3(an.x, an.rig.height + 0.4, an.z), 0xff6a9a, 16)); } this.audio.squeak(); toast(`💕 You petted ${q.name}! It loves you! 🥰`, 'good', 2200); }),
        button(`💬 Talk to ${q.name}`, 'btn-small', () => { this.closeModal(); setTimeout(() => this.openMyPetChat(i), 50); }),
        button(`👗 Dress up ${q.name}`, 'btn-small', () => { this.closeModal(); setTimeout(() => this.openDressUp(i), 50); }),
        button(`🦮 Take ${q.name} for a walk`, 'btn-shop', () => { this.closeModal(); this.startPetWalk(i); }),
        ...(this.save.myPets.length > 1 ? [button('🐾 Walk lots of pets together', 'btn-shop', () => { this.closeModal(); setTimeout(() => this.openWalkPicker(i), 50); })] : []),
        button(`🌿 Let ${q.name} go free`, 'btn-small', () => {
          this.closeModal();
          this.save.myPets.splice(i, 1); this.persist(); this.placeMyPets();
          toast(`👋 Bye bye, ${q.name}! It ran back to the wild, happy and free.`, 'good', 3000);
        })));
      box.append(body);
    }, true);
  }
  /** Choose clothes for a pet. */
  openDressUp(i: number) {
    const q = this.save.myPets[i]; if (!q) return;
    this.openModal('family', (box) => {
      box.innerHTML = '';
      box.append(this.head(`👗 Dress up ${q.name}`, true));
      const body = el('div', { class: 'modal-body' });
      body.append(el('p', { text: `What should ${q.name} wear today? Pick something for its head AND some clothes!` }));
      const redress = () => {
        const an = this.zoo.animals[i]; if (an) { dressRig(an.rig, q.outfit); dressBody(an.rig, q.clothes); }
        if (this.walker?.idx === i) { dressRig(this.walker.rig, q.outfit); dressBody(this.walker.rig, q.clothes); }
        const pm = this.pack.find((m) => m.idx === i); if (pm) { dressRig(pm.rig, q.outfit); dressBody(pm.rig, q.clothes); }
        const pp = this.playroom.pets.find((m) => m.idx === i); if (pp) { dressRig(pp.rig, q.outfit); dressBody(pp.rig, q.clothes); }
      };
      body.append(el('h3', { text: '👕 Clothes' }));
      const crow = el('div', { class: 'action-row', style: 'flex-wrap:wrap' });
      for (const o of CLOTHES) {
        const on = (q.clothes ?? 'none') === o.id;
        crow.append(button(on ? `✅ ${o.name}` : o.name, on ? 'btn-green btn-small' : 'btn-small', () => {
          q.clothes = o.id; this.persist(); redress(); this.audio.click();
          toast(o.id === 'none' ? `${q.name} took its clothes off.` : `✨ ${q.name} looks SO cute in the ${o.name.split(' ').slice(1).join(' ')}!`, 'good', 2000);
          this.closeModal(); setTimeout(() => this.openDressUp(i), 30);
        }));
      }
      body.append(crow);
      body.append(el('h3', { text: '🎩 On its head' }));
      const row = el('div', { class: 'action-row', style: 'flex-wrap:wrap' });
      for (const o of OUTFITS) {
        const on = (q.outfit ?? 'none') === o.id;
        row.append(button(on ? `✅ ${o.name}` : o.name, on ? 'btn-green btn-small' : 'btn-small', () => {
          q.outfit = o.id; this.persist();
          redress();
          this.audio.click();
          toast(o.id === 'none' ? `${q.name} took the clothes off.` : `✨ ${q.name} looks amazing in the ${o.name.split(' ').slice(1).join(' ')}!`, 'good', 2000);
          this.closeModal(); setTimeout(() => this.openDressUp(i), 30);
        }));
      }
      body.append(row);
      box.append(body);
    }, true);
  }
  /** Chat with one of the pets you caught. */
  openMyPetChat(i: number) {
    const q = this.save.myPets[i]; if (!q) return;
    this.cheerPet(i, 'fun', 10);   // pets love it when you talk to them
    this.openModal('family', (box) => this.renderFamilyChat(box, q.name, false, false, i), true);
  }
  /** Your pet listens too: "follow me", "go home", "jump", "do a trick"… */
  private obeyMyPet(i: number, msg: string): string | null {
    const q = this.save.myPets[i]; if (!q) return null;
    const m = ' ' + msg.toLowerCase().replace(/[^a-z' ]/g, ' ') + ' ';
    const has = (...w: string[]) => w.some((x) => m.includes(' ' + x + ' ') || m.includes(' ' + x + 's ') || (x.includes(' ') && m.includes(x)));
    const hop = () => { if (this.walker?.idx === i) this.walker.hop = 1.2; else this.petHop[i] = 1.2; };
    if (has('follow me', 'come with me', 'lets go', 'let s go', 'come on')) { if (this.walker?.idx !== i) { this.closeModal(); this.startPetWalk(i); } return 'Yay, walkies! 🦮 Let\'s go!'; }
    if (has('go home', 'go back', 'back to your pen')) { if (this.walker?.idx === i) this.endPetWalk(false); return 'Okay! Back to my cosy pen! 🏠'; }
    if (has('jump', 'hop', 'trick', 'dance', 'spin')) { hop(); this.audio.squeak(); return pick2(['Boing boing! Did you see that?! 🎉', 'Ta-daa! 🌟', 'Wheee! 🌀']); }
    return null;
  }
  startPetWalk(i: number) {
    if (this.walker) this.endPetWalk(false);
    const q = this.save.myPets[i]; if (!q) return;
    const rig = this.buildMyPetRig(q.species, !!q.female);
    this.scene.add(rig.root);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    const leash = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x3fae9a })); leash.frustumCulled = false; this.scene.add(leash);
    this.walker = { idx: i, rig, x: this.pos.x + 0.8, z: this.pos.z + 0.8, leash, hop: 0 };
    this.placeMyPets();
    if (q.species === 'horse' && this.species === 'human') setTimeout(() => { if (!this.riding) toast(`🐴 Press A next to ${q.name} to ride!`, 'good', 3000); }, 4300);
    toast(`🦮 Walkies! ${q.name} is on a leash and will follow you anywhere. Press T to play fetch! Bring it back to its habitat (or press 🏠 Everyone, go home) when you're done.`, 'good', 4200);
  }
  /** The rest of your pets when you take EVERYONE for a walk (they trot along behind the one on the leash). */
  private pack: { idx: number; rig: AnimalRig; x: number; z: number }[] = [];
  protectOn = false;
  /** Your pets guard you: they come along and chase away any dinosaur or monster that comes near. */
  toggleProtect() {
    this.protectOn = !this.protectOn;
    if (this.protectOn) {
      if (!this.walker || (this.save.myPets.length > 1 && !this.pack.length)) this.startPackWalk();
      toast('🛡️ Your pets are protecting you! If a dinosaur or monster comes near, they\'ll fight it off together!', 'good', 3400);
    } else toast('🛡️ Your pets stopped guarding. They\'re still on the walk with you.', '', 2200);
  }
  /** The scary night-time creature your pets are fighting off (if protecting you). */
  private protectTarget(): Opponent | null {
    if (!this.protectOn || !this.walker) return null;
    let best: Opponent | null = null, bd = 18;
    for (const o of this.opps) { if (!o.alive || !o.spawn.hunter) continue; const d = o.pos.distanceTo(this.pos); if (d < bd) { bd = d; best = o; } }
    return best;
  }
  /** Give every pet a big bowl of pet food. */
  feedAllPets() {
    if (!this.save.myPets.length) return;
    this.save.myPets.forEach((q, i) => { q.fed++; this.cheerPet(i, 'food', 100); this.petHop[i] = 1.2; });
    if (this.walker) this.walker.hop = 1.2;
    this.audio.food(); this.persist();
    this.effects.push(sparkleBurst(this.scene, this.pos.clone().setY(this.pos.y + 1), 0xff8ac0, 22));
    toast(`😋 Yum! You gave all ${this.save.myPets.length} pet${this.save.myPets.length > 1 ? 's' : ''} a big bowl of pet food! 💛`, 'good', 2600);
  }
  /** Pick which pets come on the walk: one, two, three… or everyone! */
  openWalkPicker(first = -1) {
    const pets = this.save.myPets; if (!pets.length) return;
    const chosen = new Set<number>(first >= 0 ? [first] : []);
    const isDino = (sp: string) => sp === 'trex' || sp === 'raptor';
    this.openModal('family', (box) => {
      const draw = () => {
        box.innerHTML = '';
        box.append(this.head('🦮 Who wants to go for a walk?', true));
        const body = el('div', { class: 'modal-body' });
        body.append(el('p', { text: 'Tap the pets you want to take. Pick 1, 2, 3… or lots!' }));
        const quick = el('div', { class: 'action-row', style: 'flex-wrap:wrap' });
        quick.append(button('🐾 Everyone', 'btn-small', () => { pets.forEach((_, k) => chosen.add(k)); draw(); }));
        if (pets.some((q) => isDino(q.species))) quick.append(button('🦖 All my dinosaurs', 'btn-small', () => { chosen.clear(); pets.forEach((q, k) => { if (isDino(q.species)) chosen.add(k); }); draw(); }));
        quick.append(button('✖ Nobody', 'btn-small', () => { chosen.clear(); draw(); }));
        body.append(quick);
        const row = el('div', { class: 'action-row', style: 'flex-wrap:wrap' });
        pets.forEach((q, k) => {
          const on = chosen.has(k);
          row.append(button(`${on ? '✅' : '⬜'} ${q.name} ${Game.SPECIES_EMOJI[q.species] ?? '🐾'}`, on ? 'btn-green btn-small' : 'btn-small', () => { if (on) chosen.delete(k); else chosen.add(k); draw(); }));
        });
        body.append(row);
        const n = chosen.size;
        body.append(el('div', { class: 'action-row' }, button(n ? `🦮 Let's go! (${n} pet${n > 1 ? 's' : ''})` : '🦮 Pick at least one pet', 'btn-shop', () => {
          if (!n) return;
          this.closeModal(); this.startPackWalk([...chosen].sort((a, b) => a - b));
        }, !n)));
        box.append(body);
      };
      draw();
    }, true);
  }
  /** Take all your pets for a walk at once! */
  startPackWalk(pick?: number[]) {
    const all = this.save.myPets.map((_, i) => i);
    const list = (pick ?? all).filter((i) => this.save.myPets[i]);
    const n = list.length; if (!n) return;
    this.startPetWalk(list[0]);
    for (const i of list.slice(1)) {
      const q = this.save.myPets[i];
      const rig = this.buildMyPetRig(q.species, !!q.female); dressRig(rig, q.outfit); dressBody(rig, q.clothes);
      this.scene.add(rig.root);
      this.pack.push({ idx: i, rig, x: this.pos.x + (Math.random() - 0.5) * 3, z: this.pos.z + (Math.random() - 0.5) * 3 });
    }
    this.placeMyPets();
    if (n === 1) return;
    toast(`🦮🐾 Big walkies! ${n === all.length ? `All ${n} of your pets are` : `${list.map((i) => this.save.myPets[i].name).join(', ')} are`} coming with you! Press 🏠 Everyone, go home when you're done.`, 'good', 3600);
  }
  private updatePack(dt: number) {
    if (!this.pack.length) return;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), rx = fz, rz = -fx;
    const foe = this.protectTarget();
    this.pack.forEach((m, k) => {
      const row = 1 + Math.floor(k / 4), col = (k % 4) - 1.5;
      let bx = this.pos.x - fx * (1.6 + row * 1.5) + rx * col * 1.4, bz = this.pos.z - fz * (1.6 + row * 1.5) + rz * col * 1.4;
      if (foe) { const a = k * 1.3, r = foe.radius + 0.9; bx = foe.pos.x + Math.cos(a) * r; bz = foe.pos.z + Math.sin(a) * r; this.helperAttack(m, m.x, m.z, foe, 22, m.rig); }
      const dx = bx - m.x, dz = bz - m.z, d = Math.hypot(dx, dz);
      let speed = 0;
      if (d > 22 || this.respawning) { m.x = bx; m.z = bz; }
      else if (d > 0.4) { const v = Math.min(d * 3, 9.5), st = Math.min(d, v * dt); m.x += (dx / d) * st; m.z += (dz / d) * st; speed = v; m.rig.root.rotation.y = Math.atan2(dx, dz); }
      const y = this.world.collision.groundAt(m.x, m.z, this.pos.y + 0.5, 0.4);
      m.rig.root.position.set(m.x, y, m.z);
      animateRig(m.rig, dt, { speed: Math.min(speed, 4), airborne: false, attack: null, attackT: 0, windup: 0 });
    });
  }
  endPetWalk(atPen: boolean) {
    const w = this.walker; if (!w) return;
    w.rig.root.removeFromParent(); disposeRig(w.rig); w.leash.removeFromParent();
    const q = this.save.myPets[w.idx];
    this.walker = null;
    const had = this.pack.length;
    for (const m of this.pack) { m.rig.root.removeFromParent(); disposeRig(m.rig); }
    this.pack = []; this.protectOn = false;
    this.placeMyPets();
    if (had) { toast(`🏠 All your pets trotted back to their habitats. What a great walk! 💛`, 'good', 2600); return; }
    if (q) toast(atPen ? `🏠 ${q.name} is back in its habitat. Good walk!` : `🏠 ${q.name} trotted home to its habitat in your Magic Zoo.`, 'good', 2400);
  }



  private static FRIENDS: Record<FarmKind, { name: string; emoji: string }> = {
    piglet: { name: 'Penny the Piglet', emoji: '🐷' }, lamb: { name: 'Lulu the Lamb', emoji: '🐑' }, calf: { name: 'Coco the Calf', emoji: '🐮' },
    goat: { name: 'Gigi the Goat', emoji: '🐐' }, chick: { name: 'Chip the Chick', emoji: '🐤' },
    duckling: { name: 'Dot the Duckling', emoji: '🦆' }, puppy: { name: 'Buddy the Puppy', emoji: '🐶' }, kitten: { name: 'Mittens the Kitten', emoji: '🐱' },
    pony: { name: 'Star the Pony', emoji: '🐴' }, bunny: { name: 'Clover the Bunny', emoji: '🐰' }, alpaca: { name: 'Fuzzy the Alpaca', emoji: '🦙' },
  };
  /** A rescued animal becomes your friend. New friends follow you home from the barn. */
  addPet(kind: FarmKind, followNow: boolean) {
    const rig = buildFarmAnimal(kind);
    const base = Game.FRIENDS[kind];
    const nth = this.pets.filter((q) => q.kind === kind).length;
    const pool: Record<FarmKind, string[]> = {
      piglet: ['Penny', 'Pinky', 'Peanut', 'Petunia', 'Porky', 'Pip-Squeak'], lamb: ['Lulu', 'Luna', 'Lily', 'Fluffy', 'Snowball', 'Cotton'],
      calf: ['Coco', 'Clover', 'Daisy', 'Moo-Moo', 'Buttercup', 'Patches'], goat: ['Gigi', 'Gus', 'Ginger', 'Billy', 'Nibbles', 'Pepper'],
      chick: ['Chip', 'Chirpy', 'Sunny', 'Nugget', 'Peep', 'Lemon'],
      duckling: ['Dot', 'Puddles', 'Waddles', 'Ducky', 'Splash', 'Butter'], puppy: ['Buddy', 'Biscuit', 'Max', 'Rosie', 'Waffles', 'Scout'],
      kitten: ['Mittens', 'Whiskers', 'Luna', 'Pumpkin', 'Socks', 'Misty'], pony: ['Star', 'Twinkle', 'Maple', 'Sparkle', 'Comet', 'Honey'],
      bunny: ['Clover', 'Thumper', 'Cotton', 'Hoppy', 'Bun-Bun', 'Snowdrop'], alpaca: ['Fuzzy', 'Cloud', 'Marshmallow', 'Pablo', 'Noodle', 'Cuddles'],
    };
    const names = pool[kind];
    const first = names[nth % names.length] + (nth >= names.length ? ` ${Math.floor(nth / names.length) + 1}` : '');
    const info = { name: `${first} the ${base.name.split(' the ')[1]}`, emoji: base.emoji };
    const i = this.pets.length;
    const slot = i % Game.FRIEND_SLOTS.length, S = Game.FRIEND_SLOTS[slot];
    // their own house is built right away, so it's ready when you get home
    this.buildFriendHouse(slot, { name: info.name, emoji: info.emoji, kind });
    let x = S.x + (i >= Game.FRIEND_SLOTS.length ? 0.6 : -0.3), z = S.z + Game.FH.hd + 1.2;
    if (followNow) { x = this.pos.x + Math.sin(i) * 1.2; z = this.pos.z + 1.2; }
    this.scene.add(rig.root);
    const bubble = el('div', { class: 'speech' }); bubble.style.display = 'none'; $('labels').append(bubble);
    const tag = el('div', { class: 'nameplate' }, el('div', { class: 'np-name', text: `💛 ${info.name}` })); tag.style.display = 'none'; $('labels').append(tag);
    this.pets.push({ rig, kind, name: info.name, emoji: info.emoji, x, z, y: 0, tx: x, tz: z, wait: Math.random() * 3, yaw: 0, following: followNow, settled: !followNow, bubble, tag, bubbleUntil: 0 });
  }
  petSay(p: Game['pets'][number], text: string, secs = 5) { p.bubble.textContent = text; p.bubbleUntil = this.realTime + secs; }
  private updatePets(dt: number) {
    const fh = Game.FRIEND_HOME;
    const homeNear = Math.hypot(this.pos.x - fh.x, this.pos.z - fh.z) < 70 && this.pos.z > -300;
    const night = this.world.daylight < 0.45;
    const w = window.innerWidth, h = window.innerHeight;
    this.friendGlass.emissiveIntensity = night ? 0.9 : 0;
    $('btn-talk-owner').hidden = !this.captive || this.respawning;
    if (this.captive) $('btn-talk-owner').textContent = `💬 Talk to ${this.captive.owner}`;
    $('btn-rescue-map').hidden = ![...this.pets, ...this.family].some((q) => q.caged);
    document.body.classList.toggle('underwater', this.underwater);
    $('pet-row').hidden = !!this.captive || !!this.modal;
    for (const id of ['btn-walk-all', 'btn-feed-all', 'btn-protect', 'btn-play-all']) $(id).hidden = !this.save.myPets.length;
    this.setText('btn-aquarium', this.inAquarium ? '🚪 Leave the Aquarium' : '🐠 Aquarium');
    $('btn-protect').classList.toggle('on', this.protectOn);
    this.setText('btn-play-all', this.inPlayroom ? '🚪 Leave the Play Room' : '🎉 Play with everyone');
    this.setText('btn-protect', this.protectOn ? '🛡️ Protecting you!' : '🛡️ Protect me');
    $('btn-friends-home').hidden = !(this.pets.some((p) => p.following) || this.family.some((f) => f.following) || !!this.walker) || !!this.captive;
    this.pets.forEach((p, i) => {
      let speed = 0;
      if (p.caged) {
        // stuck in a cage at a human's house until you come and rescue them
        p.x = p.caged.x; p.z = p.caged.z;
        if (this.inHumanHouse === p.caged.house && this.realTime > p.bubbleUntil + 5) this.petSay(p, ['Help! Get me out! 😢', 'I knew you\'d come! 💛', 'Press F at the cage to open it!'][Math.floor(Math.random() * 3)], 3);
      } else if (p.following) {
        // stay a little behind you; catch up by magic if you travel far
        const { bx, bz, target } = this.helperGoal(this.family.filter((f) => f.following).length + this.pets.filter((q, j) => q.following && j < i).length);
        this.helperAttack(p, p.x, p.z, target, 4, p.rig);
        const dx = bx - p.x, dz = bz - p.z, d = Math.hypot(dx, dz);
        if (d > 18 || this.respawning) { p.x = bx; p.z = bz; }
        else if (d > 0.4) {
          const v = Math.min(d * 3, 9);
          const step = Math.min(d, v * dt);
          p.x += (dx / d) * step; p.z += (dz / d) * step; speed = v;
          p.yaw = Math.atan2(dx, dz);
        }
        // first time back home: move into the Friends' House
        if (!p.settled && Math.hypot(this.pos.x - WORLD.home.x, this.pos.z - WORLD.home.z) < 24 && this.pos.z > -300) {
          p.settled = true; p.following = false;
          const H = this.petHome(p);
          p.x = p.tx = H.x + 0.5; p.z = p.tz = H.z + Game.FH.hd + 1.2; p.wait = 0;
          toast(`${p.emoji} ${p.name} ran off to their very own house in the forest! Look for ${p.emoji} on your mini-map to visit them.`, 'good', 3800);
        }
      } else if (p.goingHome) {
        // trotting home where you can see them; once they're far away they finish the trip by magic
        const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
        if (d < 0.3 || Math.hypot(this.pos.x - p.x, this.pos.z - p.z) > 45) { p.x = p.tx; p.z = p.tz; p.goingHome = false; }
        else {
          const step = Math.min(d, 3.4 * dt);
          p.x += (dx / d) * step; p.z += (dz / d) * step; speed = 3.4;
          p.yaw = Math.atan2(dx, dz);
        }
      } else {
        p.wait -= dt;
        const { hw, hd } = Game.FH, H = this.petHome(p);
        // at night everyone sleeps in the bed in their own house
        if (night) { p.tx = H.x - hw + 0.9 + (H.roommate ? 0.3 : -0.2); p.tz = H.z - hd + 0.75 + (H.roommate ? 0.25 : 0); }
        const d = Math.hypot(p.tx - p.x, p.tz - p.z);
        if ((p.wait <= 0 || night) && d > 0.1) {
          const way = this.petStep(p, p.tx, p.tz);
          const dx = way.tx - p.x, dz = way.tz - p.z, dw = Math.max(0.001, Math.hypot(dx, dz));
          const step = Math.min(dw, 1.4 * dt);
          p.x += (dx / dw) * step; p.z += (dz / dw) * step; speed = 1.4;
          p.yaw = Math.atan2(dx, dz);
        } else if (p.wait <= 0 && !night) {
          // play inside the house or out in the front yard
          // play inside their house or out in their front garden (sometimes visiting next door)
          if (Math.random() < 0.4) { p.tx = H.x + 0.2 + Math.random() * (hw - 0.6); p.tz = H.z - hd + 0.6 + Math.random() * (hd * 2 - 1.2); }
          else { p.tx = H.x - 2.5 + Math.random() * 5 + (Math.random() < 0.2 ? (Math.random() < 0.5 ? -7 : 7) : 0); p.tz = H.z + hd + 0.9 + Math.random() * 1.6; }
          p.wait = 2 + Math.random() * 4;
        }
        p.asleep = night && d < 0.2;
        if (p.asleep && this.realTime > p.bubbleUntil + 4) this.petSay(p, '💤', 2.5);
      }
      // humans chasing you can grab a friend who's following you in the village!
      if (p.following && !this.indoors && this.inHumanHouse < 0 && !this.respawning && zoneAt(p.x, p.z) === 'village') {
        const hu = this.humans.find((q) => q.chasing && Math.hypot(q.pos.x - p.x, q.pos.z - p.z) < 1.1);
        if (hu) this.catchFriend(p, hu);
      }
      const myHome = this.petHome(p);
      const visible = p.caged ? this.inHumanHouse === p.caged.house : p.following || p.goingHome || (Math.hypot(this.pos.x - myHome.x, this.pos.z - myHome.z) < 75 && this.pos.z > -300 && !this.indoors);
      p.rig.root.visible = visible;
      if (!visible) { p.bubble.style.display = 'none'; p.tag.style.display = 'none'; return; }
      p.y = this.world.collision.groundAt(p.x, p.z, (p.following ? this.pos.y : p.y) + 0.5, 0.4);
      p.rig.root.position.set(p.x, p.y, p.z);
      p.rig.root.rotation.y = p.yaw;
      animateRig(p.rig, dt, { speed: Math.min(speed, 4), airborne: false, attack: null, attackT: 0, windup: 0 });
      if (p.asleep && !p.following) sleepPose(p.rig, this.realTime + i);
      if (p.trick) { p.trick.baseY = p.y; if (this.realTime < p.trick.until) this.doTrick(p.rig, p.trick, dt); else p.trick = undefined; }
      // name tag + speech bubble
      const dist = Math.hypot(this.pos.x - p.x, this.pos.z - p.z);
      const head = new THREE.Vector3(p.x, p.y + p.rig.height + 0.35, p.z).project(this.camera);
      const onScreen = head.z < 1 && Math.abs(head.x) < 1.1 && Math.abs(head.y) < 1.1 && !this.modal;
      const sx = (head.x * 0.5 + 0.5) * w, sy = (-head.y * 0.5 + 0.5) * h;
      const talking = this.realTime < p.bubbleUntil;
      p.bubble.style.display = onScreen && talking ? 'block' : 'none';
      if (onScreen && talking) p.bubble.style.transform = `translate(${sx}px, ${sy - 22}px) translate(-50%, -100%)`;
      p.tag.style.display = onScreen && dist < 10 && !talking ? 'block' : 'none';
      if (p.tag.style.display === 'block') p.tag.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%) scale(0.9)`;
    });
    // friends near you say hi now and then
    if (this.pets.length && this.now > this.friendChatterAt && !this.modal) {
      this.friendChatterAt = this.now + 14 + Math.random() * 10;
      const near = this.pets.filter((p) => p.rig.root.visible && Math.hypot(this.pos.x - p.x, this.pos.z - p.z) < 9);
      if (near.length) { const p = near[Math.floor(Math.random() * near.length)]; this.petSay(p, friendChatter(this.friendCtx(p.name))); }
    }
  }
  friendCtx(name: string): FamilyContext {
    const p = this.pets.find((q) => q.name === name);
    return { ...this.familyCtx(name), friendKind: p?.kind };
  }
  private doorFront() {
    const zf = [1.7, 2.7, 4.7, 6.9][Math.min(this.liveTier, 3)];
    return { x: WORLD.home.x, z: WORLD.home.z + zf };
  }
  nearDoorOutside(r: number) {
    if (this.indoors) return false;
    const d = this.doorFront();
    return Math.hypot(this.pos.x - d.x, this.pos.z - d.z) < r;
  }
  setDoorOpen(open: boolean) {
    this.doorOpen = open;
    if (this.outsideDoor) this.outsideDoor.rotation.y = open ? -1.4 : 0;
    this.interior.setDoor(open);
  }
  private updateHouse(dt: number) {
    const hi = this.inHumanHouse, hh = hi >= 0 ? this.hhouses[hi] : null;
    this.hhouses.forEach((h, i) => { h.interior.group.visible = i === hi; });
    if (hh) hh.interior.updateTV(this.realTime);
    this.cam.room = this.indoors ? this.interior.boundsFor(this.pos.y) : this.inBarn ? this.barn.bounds : hh ? hh.interior.bounds : null;
    this.barn.group.visible = this.inBarn;
    if (this.inBarn) this.barn.update(dt, this.realTime);
    this.updateLocks(dt);
    this.updatePets(dt);
    this.updateInvites();
    this.updateMyPets(dt);
    if (this.riding && ((this.pos.z < -300 && !this.inZoo) || this.captive || this.species !== 'human')) this.dismountHorse(true);
    if (this.pendingDinoCoins && !this.modal) { this.spawnReward(this.pendingDinoCoins, true); toast(`🪙 Jump to grab your +${this.pendingDinoCoins} coins!`, 'good', 2400); this.pendingDinoCoins = 0; }
    if (this.world.monkeyChatter) { this.world.monkeyChatter = false; this.audio.monkey(); }
    this.updateSecrets(dt);
    this.zoo.update(dt, this.realTime, this.inZoo, this.pos);
    this.playroom.update(dt, this.realTime, this.inPlayroom, this.pos);
    this.aquarium.update(dt, this.realTime, this.inAquarium);
    this.updateLostPets(dt);
    this.updateFetch(dt);
    this.updatePetGame(dt);
    this.updateNeeds(dt);
    this.updateCuddle(dt);
    this.updateFriendDoors(dt);
    this.updateLagoon(dt);
    this.updateChallengers();
    this.updateBrawls();
    this.updateHunts();
    this.updateFamily(dt);
    this.interior.group.visible = this.indoors; // its lamp would otherwise cost time everywhere
    if (this.indoors) this.interior.updateTV(this.realTime);
    if (this.indoors) this.interior.setNightlights(this.world.daylight < 0.45);
    this.world.indoorsDark = (this.indoors && !this.interior.lampsOn) || (!!hh && !hh.interior.lampsOn);
    // campfire flicker
    const flame = this.campfire.getObjectByName('flame');
    if (flame) { const k = 1 + Math.sin(this.realTime * 13) * 0.08 + Math.sin(this.realTime * 7.3) * 0.06; flame.scale.set(k, 1 + Math.sin(this.realTime * 9) * 0.15, k); }
    let act: { label: string; fn: () => void } | null = null;
    const near = (x: number, z: number, r: number) => Math.hypot(this.pos.x - x, this.pos.z - z) < r;
    const onLeash = !!this.captive?.onWalk;
    const hha = this.respawning || onLeash ? null : this.humanHouseAction(near);
    if (onLeash) act = { label: '🦮 On a leash… (escape only from your cage)', fn: () => this.wiggle() };
    else if (hha) act = hha;
    else if (this.swimming && !this.respawning && this.seaFriendNear()) { const w = this.seaFriendNear()!; act = { label: `💙 Make friends with the ${SEA_INFO[w.kind].name} ${SEA_INFO[w.kind].emoji}`, fn: () => this.befriendSea(w) }; }
    else if (this.inAquarium && !this.respawning) {
      const T = AQUA.tank, nearTank = Math.abs(this.pos.x - AQUA.x) < T.hw + 4.5 && Math.abs(this.pos.z - AQUA.z) < T.hd + 4.5;
      if (near(AQUA.x, AQUA.z + AQUA.halfD - 1.5, 3)) act = { label: '🚪 Leave the Aquarium', fn: () => this.leaveAquarium() };
      else if (nearTank) act = { label: '🐠 Visit your sea pets', fn: () => this.openAquariumPets() };
    }
    else if (this.pos.z > -300 && this.lostPetNear() >= 0) { const li = this.lostPetNear(); act = { label: `🤗 You found ${this.save.myPets[li].name}! Bring it home`, fn: () => this.bringLostPetHome(li) }; }
    else if (this.inPlayroom && !this.respawning) {
      const pp = this.playroom.nearestPet(this.pos.x, this.pos.z, 2.2);
      if (this.climb) act = { label: '⬇️ Climb down', fn: () => this.endClimb() };
      else if (this.scripted) act = null;
      else if (near(PLAYROOM.x, PLAYROOM.z + PLAYROOM.halfD - 1.5, 3)) act = { label: '🚪 Leave the Play Room', fn: () => this.leavePlayroom() };
      else if (near(TOYS.slide.x, TOYS.slide.z - 5, 1.8)) act = { label: '🛝 Climb up and go down the slide!', fn: () => this.rideSlide() };
      else if (near(TOYS.wall.x + 1, TOYS.wall.z, 3.2)) act = { label: '🧗 Climb the rock wall!', fn: () => this.startClimb() };
      else if (this.playroom.game) act = { label: this.playroom.game.kind === 'tag' ? (this.playroom.itPet ? `🏃 Run from ${this.save.myPets[this.playroom.itPet.idx]?.name}! (IT)` : '🏃 You\'re IT! Tag someone!') : this.playroom.game.kind === 'hide' ? '🙈 Find everyone!' : '💃 Dance!', fn: () => {} };
      else if (pp) act = { label: `💕 Pet ${this.save.myPets[pp.idx]?.name} (P)`, fn: () => this.petNearest() };
      else act = { label: '🎮 Play a game with everyone (G)', fn: () => this.openPetGames() };
    }
    else if (this.inZoo && !this.respawning) {
      const e = this.zoo.zooExit, i = this.zooPenNear(), di = this.zoo.doorAt(this.pos.x, this.pos.z), hi = this.zoo.habitatAt(this.pos.x, this.pos.z);
      const ni = this.nearNest();
      if (this.riding) act = { label: '🐴 Get off the horse', fn: () => this.dismountHorse() };
      else if (near(e.x, e.z, 2.6)) act = { label: '🚪 Go back home', fn: () => this.exitZoo() };
      else if (ni >= 0) act = { label: `🥚 Grab ${this.save.myPets[ni].eggs} egg${(this.save.myPets[ni].eggs ?? 0) > 1 ? 's' : ''} from ${this.save.myPets[ni].name}'s nest (M)`, fn: () => this.collectEggs(ni) };
      else if (this.zoo.escapedNear(this.pos.x, this.pos.z) >= 0) {
        const ei = this.zoo.escapedNear(this.pos.x, this.pos.z), nm = this.save.myPets[ei]?.name ?? 'your pet';
        act = { label: `🤗 Catch ${nm} and put it back`, fn: () => this.catchEscaped(ei) };
      }
      else if (this.zoo.buttonAt(this.pos.x, this.pos.z)) {
        const bt = this.zoo.buttonAt(this.pos.x, this.pos.z)!, dr = this.zoo.pens[bt.i].door, nm = this.save.myPets[bt.i]?.name;
        if (bt.kind === 'lock') act = dr.locked ? { label: '🔴 Already locked', fn: () => { this.zoo.pressButton(bt); this.audio.click(); toast('🔒 This door is already locked. Press the GREEN button to unlock it.', '', 2000); } }
          : { label: '🔴 Press the red button to LOCK', fn: () => {
            this.zoo.pressButton(bt); this.audio.click();
            if (dr.open) { toast('🚪 Close the door first, then press the red button to lock it!', 'bad', 2200); return; }
            this.zoo.lockDoor(bt.i, true); toast(`🔒 Click! Locked. ${nm ?? 'Nobody'} can't sneak out now.`, 'good', 2000);
          } };
        else act = !dr.locked ? { label: dr.open ? '🟢 The door is open' : '🟢 Already unlocked', fn: () => { this.zoo.pressButton(bt); this.audio.click(); toast(dr.open ? '🚪 The door is already open!' : '🔓 Already unlocked. Walk to the door and press A to open it.', '', 2000); } }
          : { label: '🟢 Press the green button to UNLOCK', fn: () => { this.zoo.pressButton(bt); this.audio.click(); this.zoo.lockDoor(bt.i, false); toast('🔓 Unlocked! Now open the door and go in.', 'good', 2000); } };
      }
      else if (di >= 0) {
        const nm = this.save.myPets[di]?.name, dr = this.zoo.pens[di].door;
        act = dr.open ? { label: '🚪 Close the habitat door', fn: () => { this.zoo.setDoor(di, false); this.audio.click(); if (nm) toast(`🚪 Door closed. Now press the RED button to lock it, or ${nm} might push it open!`, '', 2800); } }
          : dr.locked ? { label: '🔒 Locked! Press the green button', fn: () => { this.audio.click(); toast('🔒 This door is locked. Press the GREEN button next to the door to unlock it.', '', 2400); } }
          : { label: nm ? `🚪 Go into ${nm}'s habitat` : '🚪 Open the habitat door', fn: () => { this.zoo.setDoor(di, true); this.audio.click(); if (nm) toast(`🐾 Walk in and play with ${nm}! When you leave, close the door AND press the red button to lock it!`, 'good', 3400); } };
      }
      else if (hi >= 0 && this.save.myPets[hi] && !this.fetch && !this.petGame) {
        const an = this.zoo.animals[hi];
        act = an && Math.hypot(an.x - this.pos.x, an.z - this.pos.z) < 2.3 ? { label: `💕 Pet ${this.save.myPets[hi].name} (P)`, fn: () => this.petNearest() }
          : { label: `🎮 Play a game with ${this.save.myPets[hi].name} (G)`, fn: () => this.openPetGames() };
      }
      else if (i >= 0) {
        const q = this.save.myPets[i];
        act = q ? (this.walker?.idx === i ? { label: `🏠 Put ${q.name} back in its habitat`, fn: () => this.endPetWalk(true) } : { label: `🐾 Visit ${q.name}`, fn: () => this.openMyPet(i) })
          : { label: '🐾 Empty habitat (catch a smaller animal!)', fn: () => toast('🫳 Find a wild animal that\'s smaller than you and press A to catch it. It\'ll live here!', 'good', 3000) };
      }
    }
    else if (!this.respawning && !this.indoors && this.pos.z > -300 && Math.hypot(this.pos.x - this.zoo.hutFront.x, this.pos.z - this.zoo.hutFront.z) < 2) {
      act = { label: '✨ Enter the Magic Zoo', fn: () => this.enterZoo() };
    }
    else if (this.inSecret && !this.respawning) {
      const ch = this.secrets.chest, sp = this.secrets.roomFor;
      if (near(SECRET_ROOM.x, SECRET_ROOM.z + SECRET_ROOM.r - 2.2, 1.8) || this.pos.z > SECRET_ROOM.z + SECRET_ROOM.r - 1.6) act = { label: '🚪 Go back outside', fn: () => this.exitSecret() };
      else if (ch && sp && near(ch.x, ch.z, 1.6) && !(this.save.secretChests ?? []).includes(sp.id)) act = { label: '🎁 Open the treasure chest!', fn: () => this.openSecretChest() };
    }
    else if (!this.respawning && !this.indoors && this.pos.z > -300 && this.secretDoorNear()) {
      const d = this.secretDoorNear()!, s = d.spot;
      const hasMap = (this.save.secretMaps ?? []).includes(s.id), opened = (this.save.secretsOpened ?? []).includes(s.id);
      act = opened ? { label: `✨ Enter ${s.name}`, fn: () => this.enterSecret(s) }
        : hasMap ? { label: `🗝️ Unlock ${s.name} (3 math problems)`, fn: () => this.unlockSecret(s) }
        : { label: '🔒 A mysterious locked door…', fn: () => toast(`🔒 It's locked tight! Its secret map 📜 is hidden somewhere nearby in ${ZONE_NAMES[s.zone]}. Find it to learn the way in!`, '', 3600) };
    }
    else if (!this.respawning) {
      if (this.inBarn) {
        const di = this.barn.doorInside;
        const pens = this.barn.pens.filter((p) => !p.open).map((p) => ({ p, d: Math.hypot(this.pos.x - p.x, this.pos.z - p.z) })).filter((q) => q.d < 1.9).sort((a, b) => a.d - b.d);
        if (pens.length) { const p = pens[0].p; act = { label: `🔒 Unlock the pen ${p.emoji} (solve a math problem)`, fn: () => this.unlockPen(p) }; }
        else if (near(di.x, di.z, 2.4)) act = this.barnDoorOpen ? { label: '🌾 Go outside', fn: () => this.exitBarn() } : { label: '🚪 Open the barn door', fn: () => { this.setBarnDoor(true); this.audio.click(); } };
        if (this.barnDoorOpen && this.pos.z > this.barn.southZ - 0.5 && Math.abs(this.pos.x - BARN_ROOM.x) < 1.1) this.exitBarn();
      } else if (this.nearBarnDoor(4.2)) {
        const f = this.barnFront();
        act = this.barnDoorOpen ? { label: '🐮 Go inside the barn', fn: () => this.enterBarn() } : { label: '🚪 Open the barn door', fn: () => this.openBarnDoorOutside() };
        if (this.barnDoorOpen && near(f.x, f.z + 0.9, 1.2)) this.enterBarn();
      } else if (this.indoors) {
        const I = this.interior, di = I.doorInside;
        // whichever thing you're closest to
        if (this.seat) { act = { label: '⬆️ Stand up', fn: () => this.standUp() }; this.action = act; }
        const things = this.seat ? [] : [
          ...this.family.map((f) => ({ s: { x: f.x, z: f.z, r: 2.0, y: f.rig.root.position.y }, a: { label: `💬 Talk to ${f.name}`, fn: () => this.openFamilyChat(f.name) } })),
          { s: I.couch, a: { label: '🛋️ Sit on the couch', fn: () => this.sit(I.couch) } },
          { s: I.chair, a: { label: '🪑 Sit down and eat', fn: () => this.sit(I.chair) } },
          { s: I.bed, a: { label: '🛏️ Sleep until morning', fn: () => this.sleep() } },
          ...(I.hasUpstairs ? [
            { s: I.desk as { x: number; z: number; r: number; y?: number }, a: { label: '📓 Sit at your desk', fn: () => this.sit(I.desk) } },
            { s: I.stairsBottom, a: { label: '⬆️ Go upstairs', fn: () => this.useStairs(true) } },
            { s: I.stairsTop, a: { label: '⬇️ Go downstairs', fn: () => this.useStairs(false) } },
            { s: I.tub, a: { label: '🛁 Take a bath', fn: () => this.houseFun('bath') } },
            { s: I.sink, a: { label: '🪥 Brush your teeth', fn: () => this.houseFun('teeth') } },
            { s: I.toilet, a: { label: '🚽 Use the potty', fn: () => this.houseFun('potty') } },
            { s: I.toys, a: { label: '🧸 Play with toys', fn: () => this.houseFun('toys') } },
            ...this.save.myPets.map((q, i) => ({ q, i })).filter(({ q, i }) => q.species === 'chicken' && (q.eggs ?? 0) > 0 && i < I.petPens.length).map(({ q, i }) => ({ s: { ...this.nestSpot(i), r: 1.4, y: I.petRoom!.y }, a: { label: `🥚 Grab ${q.eggs} egg${(q.eggs ?? 0) > 1 ? 's' : ''} from ${q.name}'s nest (M)`, fn: () => this.collectEggs(i) } })),
            ...I.petPens.map((pen, i) => ({ s: { x: pen.front.x, z: pen.front.z, r: 1.3, y: I.petRoom!.y }, a: this.walker?.idx === i ? { label: `🏠 Put ${this.save.myPets[i]?.name} back in the pen`, fn: () => this.endPetWalk(true) } : this.save.myPets[i] ? { label: (this.save.myPets[i].eggs ?? 0) > 0 ? `🥚 Visit ${this.save.myPets[i].name} (${this.save.myPets[i].eggs} egg${(this.save.myPets[i].eggs ?? 0) > 1 ? 's' : ''}!)` : `🐾 Visit ${this.save.myPets[i].name}`, fn: () => this.openMyPet(i) } : { label: '🐾 Empty pen (catch a smaller animal!)', fn: () => toast('🫳 Find a wild animal that\'s smaller than you, walk up to it and press F to catch it!', 'good', 3200) } })),
          ] : []),
          ...I.lamps.map((l) => ({ s: l, a: { label: I.lampsOn ? '💡 Turn off the lamps' : '💡 Turn on the lamps', fn: () => { I.setLamps(!I.lampsOn); this.audio.click(); } } })),
          { s: I.fridge, a: { label: '🧊 Open the fridge', fn: () => this.openFridge() } },
          { s: I.stove, a: { label: '🍲 Cook food', fn: () => this.openCook() } },
        ].map((t) => ({ ...t, d: Math.hypot(this.pos.x - t.s.x, this.pos.z - t.s.z) })).filter((t) => t.d < t.s.r && Math.abs(this.pos.y - ((t.s as { y?: number }).y ?? 0)) < 1.8)
          .sort((a, b) => (a.d - (a.s === I.chair ? 0.8 : 0)) - (b.d - (b.s === I.chair ? 0.8 : 0)));
        if (this.seat) { /* stand-up action set above */ }
        else if (things.length) act = things[0].a;
        else if (near(di.x, di.z, 2.2)) act = this.doorOpen ? { label: '🌳 Go outside', fn: () => this.exitHouse() } : { label: '🚪 Open the door', fn: () => { this.setDoorOpen(true); this.audio.click(); toast('Door open! Press L to close it.'); } };
        // walking out through the open door
        if (this.doorOpen && this.pos.z > I.southZ - 0.5 && Math.abs(this.pos.x - INTERIOR.x) < 0.8) this.exitHouse();
      } else {
        const cf = Game.CAMPFIRE, df = this.doorFront();
        if (near(cf.x, cf.z, 3.0)) act = { label: '🍲 Cook food', fn: () => this.openCook() };
        else if (near(df.x, df.z, 3.8)) {
          if (!this.outsideDoor) act = { label: '🏠 Go inside', fn: () => this.enterHouse() };
          else act = this.doorOpen ? { label: '🏠 Go inside', fn: () => this.enterHouse() } : { label: '🚪 Open the door', fn: () => { this.setDoorOpen(true); this.audio.click(); toast('Door open! Walk in. Press L to close it.'); } };
          // walking up the steps into the open door
          if (this.doorOpen && near(df.x, df.z - 0.8, 1.3)) this.enterHouse();
        }
      }
    }
    if (!act && !this.respawning && !this.seat && !this.indoors && this.pos.z > -300) {
      const slot = this.nearFriendDoor();
      if (slot >= 0) { const h = this.friendHouses[slot]!, first = h.owner.split(' the ')[0]; act = h.open ? { label: `🚪 Close ${first}'s door (L)`, fn: () => this.setFriendDoor(slot, false) } : { label: `🚪 Open ${first}'s door`, fn: () => this.setFriendDoor(slot, true) }; }
    }
    if (!act && !this.respawning && !this.seat && this.swimming && this.nearestFish()) act = { label: '🐟 Catch the fish! (P)', fn: () => this.catchFish() };
    if (!act && !this.respawning && !this.seat) {
      const near = this.pets.filter((p) => p.rig.root.visible).map((p) => ({ p, d: Math.hypot(this.pos.x - p.x, this.pos.z - p.z) })).filter((q) => q.d < 1.8).sort((a, b) => a.d - b.d);
      if (near.length) { const p = near[0].p; act = { label: `💛 Talk to ${p.name.split(' ')[0]}`, fn: () => this.openFriendChat(p.name) }; }
      else if (this.swimming && this.nearestFish()) act = { label: '🐟 Catch the fish! (P)', fn: () => this.catchFish() };
      else if (this.walker && Math.hypot(this.walker.x - this.pos.x, this.walker.z - this.pos.z) < 1.8) { const wi = this.walker.idx; act = { label: `💬 Talk to ${this.save.myPets[wi]?.name}`, fn: () => this.openMyPetChat(wi) }; }
      else if (this.riding) act = { label: '🐴 Get off the horse', fn: () => this.dismountHorse() };
      else if (this.rideableNear()) { const r = this.rideableNear()!; act = { label: `🐴 Ride ${r.petIdx >= 0 ? r.name : 'the ' + r.name}`, fn: () => this.mountHorse(r) }; }
      else if (this.species === 'unicorn' && !this.indoors && this.inHumanHouse < 0 && this.pos.z > -300 && !this.captive && this.humans.some((h) => h.root.visible && !this.humanAway.has(h) && Math.hypot(h.pos.x - this.pos.x, h.pos.z - this.pos.z) < 2.4)) {
        const hu = this.humans.find((h) => h.root.visible && !this.humanAway.has(h) && Math.hypot(h.pos.x - this.pos.x, h.pos.z - this.pos.z) < 2.4)!;
        act = { label: `🦄 Catch ${hu.spawn.name} with unicorn magic!`, fn: () => this.catchHuman(hu) };
      }
      else if (!this.indoors && this.inHumanHouse < 0 && !this.inBarn && !this.captive) {
        const bigHorse = this.species === 'unicorn' || this.species === 'human';   // unicorns and humans can catch horses, even big ones
        const wild = this.opps.filter((o) => o.alive && !o.spawn.hunter && o.state !== 'chase' && o.state !== 'windup' && ((this.strengthOf(o).cls !== 'stronger' && o.rig.height < this.rig.height * 0.95) || (bigHorse && o.spawn.species === 'horse')) && Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z) < 2.4)
          .sort((a, b) => Math.hypot(a.pos.x - this.pos.x, a.pos.z - this.pos.z) - Math.hypot(b.pos.x - this.pos.x, b.pos.z - this.pos.z));
        if (wild.length) { const o = wild[0]; act = { label: `🫳 Catch the ${o.spawn.name} as a pet`, fn: () => this.catchWild(o) }; }
      }
      if (!act && !this.indoors) {
        const fam = this.family.filter((f) => f.following && Math.hypot(this.pos.x - f.x, this.pos.z - f.z) < 1.8);
        if (fam.length) act = { label: `💬 Talk to ${fam[0].name}`, fn: () => this.openFamilyChat(fam[0].name) };
      }
    }
    this.action = act;
    const b = $('btn-action') as HTMLButtonElement;
    b.hidden = !act || !!this.modal;
    if (act) { const html = `${act.label} <kbd>${/Talk/.test(act.label) ? 'F' : 'A'}</kbd>`; if (b.innerHTML !== html) b.innerHTML = html; }
    void dt;
  }
  sit(seat: Seat) {
    if (this.respawning) return;
    this.seat = seat;
    this.pos.set(seat.sitX, seat.sitY, seat.sitZ);
    this.yaw = seat.yaw; this.vy = 0; this.lunge = null;
    this.cam.reset(this.yaw);
    this.audio.click();
    if (seat.kind === 'chair') { toast(this.indoors ? '🍽️ Family dinner! Everyone comes to eat with you. Pick something from your bag!' : '🍽️ Dinner time! Pick something to eat.', 'good', 2600); this.openBag(); }
    else if (seat.kind === 'desk') this.openNotebook();
    else toast('📺 Watching TV… Press F or an arrow key to get up.', 'good', 2600);
  }
  standUp() {
    const s = this.seat; if (!s) return;
    this.seat = null;
    // step off the seat towards where you were facing
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
    const sy = s.kind === 'desk' ? s.sitY - 0.54 : 0;
    this.pos.set(s.sitX + fx * 1.0, sy, s.sitZ + fz * 1.0);
    this.groundY = sy;
  }

  enterHouse() {
    if (this.respawning) return;
    if (this.outsideDoor && !this.doorOpen) this.setDoorOpen(true);
    if (!this.outsideDoor) this.setDoorOpen(true);
    this.respawning = true;
    $('fade-text').textContent = '🏠 Home sweet home';
    $('fade').classList.add('on');
    this.later(0.6, () => {
      const s = this.interior.spawnInside;
      this.pos.set(s.x, 0, s.z); this.vy = 0; this.yaw = Math.PI; this.grounded = true; this.groundY = 0; this.lunge = null;
      this.cam.reset(this.yaw, true);
      $('fade').classList.remove('on');
      this.later(0.3, () => { this.respawning = false; });
      const dark = this.world.daylight < 0.5 && !this.interior.lampsOn;
      if (this.family[0]) this.familySay(this.family[0].name, familyChatter(this.familyCtx(this.family[0].name), 'welcome'), 5);
      this.chatterAt = this.now + 14;
      setTimeout(() => toast(dark ? "🌙 It's dark in here! Walk to a lamp and press F to turn it on." : 'Press L to close the door. Walk to the bed, fridge, stove, couch or chair!', 'good', 3800), 400);
    });
  }
  exitHouse() {
    if (this.respawning) return;
    this.seat = null;
    if (!this.doorOpen) this.setDoorOpen(true);
    this.respawning = true;
    $('fade-text').textContent = '🌳 Off outside!';
    $('fade').classList.add('on');
    this.later(0.6, () => {
      const df = this.doorFront();
      const z = df.z + 2.2, y = this.world.collision.groundAt(df.x, z, 60, PHYSICS.stepUp);
      this.pos.set(df.x, y, z); this.vy = 0; this.yaw = 0; this.grounded = true; this.groundY = y; this.lunge = null;
      this.cam.reset(this.yaw, true);
      $('fade').classList.remove('on');
      this.later(0.3, () => { this.respawning = false; });
    });
  }
  sleep() {
    if (this.respawning) return;
    this.respawning = true;
    $('fade-text').textContent = this.indoors ? '💤 You and Baby Pip snuggle up… Zzz' : '💤 Zzz…';
    $('fade').classList.add('on');
    this.later(1.6, () => {
      this.world.timeOfDay = 0.03;
      this.dayCount++;
      this.persist();
      $('fade').classList.remove('on');
      this.later(0.3, () => { this.respawning = false; });
      this.showDream(() => toast(this.indoors ? '☀️ Good morning! Baby Pip yawns and gives you a big hug. 🤗' : '☀️ Good morning! (Eat food to get health back.)', 'good', 3000));
    });
  }
  /** While you sleep, you have a dream! */
  private showDream(then: () => void) {
    const info = {
      name: activeProfile().name, species: this.def.name, girl: this.save.girl,
      family: this.family.map((f) => f.name), friends: this.pets.map((p) => p.name.split(' the ')[0]),
      pets: this.save.myPets.map((q) => q.name), places: this.save.visitedZones.map((z) => ZONE_NAMES[z]), coins: this.save.coins,
    };
    this.openModal('dream', (box) => {
      box.innerHTML = '';
      box.classList.add('dream-box');
      const stars = el('div', { class: 'dream-stars', 'aria-hidden': 'true', text: '✨ 🌙 ⭐ ☁️ ✨ ⭐ 🌙 ✨' });
      const text = el('p', { class: 'dream-text', text: '💤 Zzz… you\'re dreaming…' });
      const wake = button('☀️ Wake up!', 'btn-shop', () => { this.closeModal(); box.classList.remove('dream-box'); then(); });
      box.append(el('h2', { class: 'dream-title', text: '💭 Sweet dreams…' }), stars, text, el('div', { class: 'action-row' }, wake));
      void makeDream(info).then((d) => {
        if (!box.isConnected) return;
        // type the dream out a few letters at a time
        let i = 0; text.textContent = '';
        const step = () => { if (!box.isConnected) return; i = Math.min(d.length, i + 2); text.textContent = d.slice(0, i); if (i < d.length) setTimeout(step, 28); };
        step();
      });
    }, true);
    this.audio.celebrate();
  }

  // ---- Cooking pot
  private potItems: FoodType[] = [];
  private cooking = false;
  openCook() {
    this.potItems = [];
    this.cooking = false;
    this.openModal('cook', (box) => this.renderCook(box));
  }
  private renderCook(box: HTMLElement, made?: FoodType) {
    box.innerHTML = '';
    box.append(this.head('🍲 Cooking Pot', false));
    const body = el('div', { class: 'modal-body' });
    if (made) {
      body.append(el('div', { class: 'cook-result' }, el('img', { src: this.foodThumb(made), alt: '', style: 'width:150px;height:150px;border-radius:20px;display:block;margin:0 auto 8px;background:linear-gradient(#dcecf6,#eef4df)' }),
        document.createTextNode(`You made ${FOOD_NAMES[made]}! 🎉`)),
        el('p', { class: 'preview-msg good', style: 'text-align:center', text: `It's in your bag. Eat it for +${this.healOf(made)} ❤️` }),
        el('div', { class: 'action-row' },
          button('😋 Eat it now', 'btn-green', () => { this.eat(made); this.renderCook(box); }, this.hp >= this.maxHp || !(this.save.bag[made] ?? 0)),
          button('🍲 Cook more', '', () => { this.potItems = []; this.renderCook(box); })));
      box.append(body); return;
    }
    body.append(el('p', { class: 'preview-msg', style: 'text-align:center', text: 'Put 2 or 3 foods from your bag in the pot, then cook them into a meal that heals more!' }));
    const slots = el('div', { class: 'pot-slots' });
    for (let i = 0; i < 3; i++) {
      const t = this.potItems[i];
      const slot = el('button', { class: 'pot-slot', type: 'button', 'aria-label': t ? `Take out ${FOOD_NAMES[t]}` : 'Empty' });
      if (t) slot.append(el('img', { src: this.foodThumb(t), alt: '' })); else slot.textContent = '+';
      slot.addEventListener('click', () => { if (t && !this.cooking) { this.potItems.splice(i, 1); this.renderCook(box); } });
      slots.append(slot);
    }
    body.append(slots);
    const result = this.potItems.length >= 2 ? cookResult(this.potItems) : null;
    body.append(el('div', { class: 'cook-result', text: result ? `This will make: ${FOOD_NAMES[result]} (+${this.healOf(result)} ❤️)` : 'Add at least 2 foods' }));
    const bar = el('div', { class: 'cook-bar' }, el('div'));
    const cookBtn = button('🔥 Cook it!', 'btn-shop', () => {
      if (!result || this.cooking) return;
      // check the food is still in the bag
      const need: Record<string, number> = {};
      for (const t of this.potItems) need[t] = (need[t] ?? 0) + 1;
      if (Object.entries(need).some(([t, n]) => (this.save.bag[t] ?? 0) < n)) return;
      this.cooking = true; cookBtn.disabled = true;
      this.audio.food();
      const start = performance.now();
      const fill = bar.firstElementChild as HTMLElement;
      const tick = () => {
        if (this.modal !== 'cook') { this.cooking = false; return; } // closed early: nothing cooked, food kept
        const k = Math.min(1, (performance.now() - start) / (COOK_SECONDS * 1000));
        fill.style.width = `${k * 100}%`;
        if (k < 1) { requestAnimationFrame(tick); return; }
        for (const [t, n] of Object.entries(need)) { this.save.bag[t] = (this.save.bag[t] ?? 0) - n; if (this.save.bag[t]! <= 0) delete this.save.bag[t]; }
        this.save.bag[result] = (this.save.bag[result] ?? 0) + 1;
        this.cooking = false;
        this.audio.purchase();
        this.persist();
        this.potItems = [];
        this.renderCook(box, result);
      };
      requestAnimationFrame(tick);
    }, !result);
    body.append(el('div', { class: 'action-row' }, cookBtn), bar);
    // ingredients from the bag
    const avail = Object.keys(this.save.bag).filter((t) => !DISHES.includes(t as FoodType))
      .map((t) => [t, (this.save.bag[t] ?? 0) - this.potItems.filter((p) => p === t).length] as [string, number]).filter(([, n]) => n > 0);
    const cards = el('div', { class: 'cards' });
    if (!avail.length && !this.potItems.length) cards.append(el('div', { class: 'empty-note', text: 'Your bag has no food to cook. Collect some food (or take some out of the fridge) first!' }));
    for (const [t, n] of avail) {
      const c = el('button', { class: 'card', type: 'button' }, el('img', { src: this.foodThumb(t), alt: '' }), el('div', { class: 'name', text: FOOD_NAMES[t as FoodType] }), el('div', { class: 'count', text: `× ${n}` }), el('span', { class: 'status owned', text: 'Add to pot' }));
      c.addEventListener('click', () => { if (this.potItems.length < 3 && !this.cooking) { this.audio.click(); this.potItems.push(t as FoodType); this.renderCook(box); } });
      cards.append(c);
    }
    body.append(el('div', { class: 'col-title', style: 'margin-top:10px', text: '🎒 From your bag' }), cards);
    const rec = el('div', { class: 'recipes' }, el('div', { class: 'col-title', text: '📖 Recipes' }));
    for (const r of RECIPES) rec.append(el('div', { text: `${FOOD_NAMES[r.dish]} (+${this.healOf(r.dish)} ❤️): ${r.hint}` }));
    body.append(rec);
    box.append(body);
  }

  // ---- Fridge
  openFridge() { this.openModal('fridge', (box) => this.renderFridge(box)); }
  private renderFridge(box: HTMLElement) {
    box.innerHTML = '';
    const fridgeTotal = Object.values(this.save.fridge).reduce((a, b) => a + (b ?? 0), 0);
    box.append(this.head('🧊 Fridge', false));
    const body = el('div', { class: 'modal-body' });
    body.append(el('p', { class: 'preview-msg', text: 'Keep food safe in your fridge. It never gets full! Take food out when you need it.' }));
    const unpack = () => {
      for (const [t, n] of Object.entries(this.save.bag)) { this.save.fridge[t] = (this.save.fridge[t] ?? 0) + (n ?? 0); }
      this.save.bag = {};
      this.audio.purchase(); this.persist(); this.renderFridge(box);
      toast('📦 Bag unpacked! Now you can collect more food.', 'good', 2400);
    };
    body.append(el('div', { class: 'action-row', style: 'margin-bottom:12px' }, button('📦 Unpack my whole bag into the fridge', 'btn-shop', unpack, this.bagTotal() === 0)));
    const move = (t: string, from: Record<string, number>, to: Record<string, number>, all = false) => {
      const n = all ? (from[t] ?? 0) : 1;
      for (let i = 0; i < n; i++) {
        if ((from[t] ?? 0) <= 0) break;
        if (to === this.save.bag && this.bagTotal() >= BAG_LIMIT) { toast('Your bag is full!'); break; }
        from[t]--; if (from[t] <= 0) delete from[t];
        to[t] = (to[t] ?? 0) + 1;
      }
      this.audio.click(); this.persist(); this.renderFridge(box);
    };
    const col = (title: string, src: Record<string, number>, dst: Record<string, number>, verb: string, allVerb: string) => {
      const c = el('div', {}, el('div', { class: 'col-title', text: title }));
      const types = Object.keys(src).filter((t) => (src[t] ?? 0) > 0);
      if (!types.length) c.append(el('div', { class: 'empty-note', text: 'Empty' }));
      for (const t of types) c.append(el('div', { class: 'item-row' },
        el('img', { src: this.foodThumb(t), alt: '' }),
        el('div', {}, el('div', { class: 'nm', text: FOOD_NAMES[t as FoodType] }), el('div', { text: `× ${src[t]} • +${this.healOf(t)} ❤️` })),
        el('div', { class: 'hud-row' }, button(verb, 'btn-green btn-small', () => move(t, src, dst)), button(allVerb, 'btn-small', () => move(t, src, dst, true)))));
      return c;
    };
    body.append(el('div', { class: 'two-col' },
      col(`🎒 Bag (${this.bagTotal()}/${BAG_LIMIT})`, this.save.bag, this.save.fridge, 'Put in →', 'All'),
      col(`🧊 Fridge (${fridgeTotal} foods)`, this.save.fridge, this.save.bag, '← Take', 'All')));
    box.append(body);
  }

  // ---------------- Bag (food inventory) ----------------
  bagTotal() { return Object.values(this.save.bag).reduce((a, b) => a + (b ?? 0), 0); }
  private isRare(t: string) { return FOOD_SPAWNS.some((f) => f.type === t && f.rare); }
  healOf(t: string) { return DISH_HEAL[t] ?? (this.isRare(t) ? FOOD_HEAL.rare : FOOD_HEAL.common); }

  /** Eat one of this food from the bag. Returns true if eaten. */
  eat(t: string): boolean {
    const n = this.save.bag[t] ?? 0;
    if (n <= 0 || this.respawning) return false;
    if (this.hp >= this.maxHp) { toast("You're already full of health!"); return false; }
    this.save.bag[t] = n - 1;
    if (this.save.bag[t] === 0) delete this.save.bag[t];
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + this.healOf(t));
    this.audio.food();
    this.audio.specialReady();
    this.effects.push(sparkleBurst(this.scene, this.pos.clone().setY(this.pos.y + this.rig.height * 0.6), 0xff6a7a, 14));
    toast(`Yum! ${FOOD_NAMES[t as FoodType]} +${Math.round(this.hp - before)} ❤️`, 'good', 1800);
    this.persist();
    return true;
  }

  /** E key: eat the smallest snack that helps, so rare food is saved for emergencies. */
  quickEat() {
    const types = Object.keys(this.save.bag).filter((t) => (this.save.bag[t] ?? 0) > 0);
    if (!types.length) { toast('Your bag is empty. Find food to fill it! 🎒'); return; }
    if (this.hp >= this.maxHp) { toast("You're already full of health!"); return; }
    const missing = this.maxHp - this.hp;
    types.sort((a, b) => this.healOf(a) - this.healOf(b));
    const pick = types.find((t) => this.healOf(t) >= missing) ?? types[types.length - 1];
    this.eat(pick);
  }

  foodThumb(t: string): string {
    const key = 'food|' + t;
    const hit = this.thumbs.get(key); if (hit) return hit;
    const url = this.preview.snapshot(buildFoodMesh(t as FoodType), 0.7, 2.1, 0.8);
    this.thumbs.set(key, url);
    return url;
  }

  openBag() {
    this.openModal('bag', (box) => this.renderBag(box));
  }
  private renderBag(box: HTMLElement) {
    box.innerHTML = '';
    box.append(this.head(`🎒 My Bag (${this.bagTotal()}/${BAG_LIMIT})`, false));
    const body = el('div', { class: 'modal-body' });
    const pct = (this.hp / this.maxHp) * 100;
    const bar = el('div', { class: 'bar' }, el('div', { class: 'fill hp', style: `width:${pct}%` }));
    body.append(el('div', { class: 'bag-health' }, el('span', { text: '❤️ Health' }), bar, el('span', { text: `${Math.ceil(this.hp)}/${this.maxHp}` })));
    const types = Object.keys(this.save.bag).filter((t) => (this.save.bag[t] ?? 0) > 0)
      .sort((a, b) => this.healOf(a) - this.healOf(b) || FOOD_NAMES[a as FoodType].localeCompare(FOOD_NAMES[b as FoodType]));
    const cards = el('div', { class: 'cards' });
    if (!types.length) cards.append(el('div', { class: 'empty-note', text: 'Your bag is empty. Food you find goes in here. Eat it to get health back!' }));
    const full = this.hp >= this.maxHp;
    for (const t of types) {
      cards.append(el('div', { class: 'card' },
        el('img', { src: this.foodThumb(t), alt: '' }),
        el('div', { class: 'name', text: FOOD_NAMES[t as FoodType] }),
        el('div', { class: 'count', text: `× ${this.save.bag[t]}` }),
        el('div', { class: 'heal', text: `+${this.healOf(t)} ❤️ health` }),
        button(full ? 'Full!' : '😋 Eat', 'btn-green btn-small', () => { this.eat(t); this.renderBag(box); }, full)));
    }
    body.append(cards);
    body.append(el('p', { class: 'save-note', style: 'color:#4a5446', text: 'Tip: press E while playing to eat a snack without opening the bag.' }));
    box.append(body);
  }

  private collectFood(f: FoodItem) {
    f.active = false;
    f.group.visible = false;
    f.respawnAt = this.now + TIMERS.foodRespawn;
    this.save.foodCount += 1;
    const v = f.spawn.rare ? REWARDS.rareFood : REWARDS.commonFood;
    this.audio.food();
    this.spawnReward(v, false);
    // stealing in the village makes nearby humans come running
    if (zoneAt(f.spawn.x, f.spawn.z) === 'village') {
      let alerted = false;
      for (const hu of this.humans) if (hu.pos.distanceTo(this.pos) < HUMAN_AI.alertRadius) { hu.alert(); alerted = true; }
      if (alerted) setTimeout(() => toast('🧑 "Hey! That\'s my lunch!" Run!', 'bad', 2200), 300);
    }
    const name = FOOD_NAMES[f.spawn.type];
    const bagged = this.bagTotal() < BAG_LIMIT;
    if (bagged) this.save.bag[f.spawn.type] = (this.save.bag[f.spawn.type] ?? 0) + 1;
    const note = bagged ? ' 🎒 In your bag!' : ' (Bag full! Unpack it into your fridge at home.)';
    if (f.spawn.rare) toast(`🌟 Rare ${name}!${note} Jump to grab +${v}`, 'gold', 2800);
    else toast(`${name}!${note} Jump to grab +${v}`, '', 2400);
    if (bagged && this.save.foodCount === 1) setTimeout(() => toast('Press E or open 🎒 Bag to eat food for health', 'good', 3600), 1600);
    this.persist();
    this.checkProgress();
  }

  /** Spawn one floating coin token above the player (never inside trees, pits or out of bounds). */
  spawnReward(value: number, battle: boolean) {
    const base = this.groundY;
    const cands: [number, number][] = [[0, 0]];
    for (const r of [PHYSICS.coinSpacing, PHYSICS.coinSpacing * 2]) for (let i = 0; i < 8; i++) cands.push([Math.cos((i / 8) * Math.PI * 2) * r, Math.sin((i / 8) * Math.PI * 2) * r]);
    let chosen: THREE.Vector3 | null = null; let chosenGround = base;
    for (const [dx, dz] of cands) {
      const x = this.pos.x + dx, z = this.pos.z + dz;
      const B = regionBounds(x, z);
      if (x < B.minX + 4 || x > B.maxX - 4 || z < B.minZ + 4 || z > B.maxZ - 4) continue;
      if (inPit(x, z, 0.8) && !(dx === 0 && dz === 0)) continue;
      if (z < 200 && Math.abs(Math.abs(x) - WORLD.zoneEdge) < 1.6) continue;
      const gy = dx === 0 && dz === 0 ? base : this.world.collision.groundAt(x, z, this.pos.y + 0.3, PHYSICS.stepUp);
      if (Math.abs(gy - base) > 1.0) continue;
      const y = gy + PHYSICS.coinHeight;
      if (this.world.collision.blocked(x, z, y + 0.6, 0.5) || this.world.collision.blocked(x, z, gy + 0.5, 0.4)) continue;
      if (this.coins.some((c) => Math.hypot(c.pos.x - x, c.pos.z - z) < PHYSICS.coinSpacing * 0.95)) continue;
      chosen = new THREE.Vector3(x, Math.max(y, (zoneAt(x, z) === 'swamp' ? 0 : -99) + PHYSICS.coinHeight), z); chosenGround = gy;
      break;
    }
    if (!chosen) chosen = new THREE.Vector3(this.pos.x, base + PHYSICS.coinHeight, this.pos.z);
    this.coins.push(makeCoin(this.scene, chosen, Math.max(chosenGround, zoneAt(chosen.x, chosen.z) === 'swamp' ? 0 : -99), value, this.now, battle));
    if (this.save.coins === 0 && this.coins.length === 1) setTimeout(() => toast('Press Space to jump into the coin!', 'gold', 2600), 900);
  }

  private dropCoin(c: CoinToken) {
    removeCoin(c);
    this.coins = this.coins.filter((q) => q !== c);
  }

  private updateCoins(dt: number) {
    const center = new THREE.Vector3(this.pos.x, this.pos.y + 0.5, this.pos.z);
    for (const c of [...this.coins]) {
      const age = this.now - c.born;
      c.coin.rotation.y += dt * 3;
      c.group.position.y = c.pos.y + Math.sin(this.realTime * 2.5 + c.pos.x) * 0.07;
      const blink = age > TIMERS.coinLifetime - 6 ? Math.sin(age * 12) > 0 : true;
      c.group.visible = blink;
      if (age > TIMERS.coinLifetime) { this.dropCoin(c); continue; }
      if (this.respawning) continue;
      if (center.distanceTo(c.pos) < PHYSICS.coinPickupRadius) {
        this.save.coins += c.value; // credited exactly once on contact
        this.dropCoin(c);
        this.audio.coin();
        this.effects.push(sparkleBurst(this.scene, c.pos.clone(), 0xffe08a, 12));
        toast(`+${c.value} coins!`, 'gold', 1400);
        const coinEl = $('coins'); coinEl.classList.remove('bump'); void coinEl.offsetWidth; coinEl.classList.add('bump');
        if (!c.battle && this.save.tutorialStep === 1) this.save.tutorialStep = 2;
        this.persist();
        this.checkProgress();
      }
    }
  }

  // =========================================================================
  // Progression
  // =========================================================================
  animalUnlocked(s: Species): boolean {
    const u = PLAYER_ANIMALS[s].unlock;
    if (!u) return true;
    if (this.save.wins < u.wins) return false;
    if (u.zoneVisited && !this.save.visitedZones.includes(u.zoneVisited)) return false;
    return true;
  }
  unlockProgress(s: Species): string {
    const u = PLAYER_ANIMALS[s].unlock;
    if (!u) return '';
    const parts: string[] = [];
    if (u.zoneVisited) parts.push(`${u.zoneVisited === 'savanna' ? 'Visit the Savanna' : 'Visit the Swamp'} ${this.save.visitedZones.includes(u.zoneVisited) ? '✔' : '✘'}`);
    parts.push(`Battles won ${Math.min(this.save.wins, u.wins)}/${u.wins}`);
    return parts.join(' • ');
  }

  private gateReady(zone: ZoneId) {
    if (zone === 'savanna') return this.save.foodCount >= ZONE_GATES.savanna.food && this.save.wins >= ZONE_GATES.savanna.wins;
    if (zone === 'swamp') return this.save.visitedZones.includes('savanna') && this.save.wins >= ZONE_GATES.swamp.wins;
    return true;
  }
  gateProgress(zone: ZoneId) {
    if (zone === 'savanna') return `Food ${Math.min(this.save.foodCount, ZONE_GATES.savanna.food)}/${ZONE_GATES.savanna.food} • Battles ${Math.min(this.save.wins, ZONE_GATES.savanna.wins)}/${ZONE_GATES.savanna.wins}`;
    const v = this.save.visitedZones.includes('savanna');
    return `${v ? 'Savanna visited ✔' : 'Visit the Savanna'} • Battles ${Math.min(this.save.wins, ZONE_GATES.swamp.wins)}/${ZONE_GATES.swamp.wins}`;
  }

  refreshGates() {
    for (const z of ['savanna', 'swamp'] as ZoneId[]) {
      const open = this.save.unlockedZones.includes(z);
      const title = z === 'savanna' ? 'SAVANNA →' : '← SWAMP';
      this.world.setGate(z, open, open ? [title, z === 'savanna' ? 'Open! Lions live here' : 'Open! Watch for crocs'] : [title, '🔒 ' + this.gateProgress(z)]);
    }
  }

  checkProgress() {
    let changed = false;
    for (const z of ['savanna', 'swamp'] as ZoneId[]) {
      if (!this.save.unlockedZones.includes(z) && this.gateReady(z)) {
        this.save.unlockedZones.push(z);
        changed = true;
        this.audio.gate();
        toast(z === 'savanna' ? '🎉 The Savanna gate is open! Head east →' : '🎉 The Swamp gate is open! Head west ←', 'good', 3500);
      }
    }
    for (const s of SPECIES_ORDER) {
      if (!this.notifiedUnlocks.has(s) && this.animalUnlocked(s)) {
        this.notifiedUnlocks.add(s);
        if (!this.save.owned.includes(s)) toast(`New animal in the Shop: ${PLAYER_ANIMALS[s].icon} ${PLAYER_ANIMALS[s].name}!`, 'gold', 3500);
      }
    }
    if (changed) this.persist();
    this.refreshGates();
    this.updateObjective();
    const done = (['forest', 'savanna', 'swamp'] as ZoneId[]).every((z) => this.save.visitedZones.includes(z)) && this.save.lionWins > 0 && this.save.homeTier >= 3;
    if (done && !this.save.completionShown && !this.modal) {
      this.save.completionShown = true;
      this.persist();
      this.openCelebrate();
    }
  }

  private updateZone() {
    const z = zoneAt(this.pos.x, this.pos.z);
    if (z !== this.zone) {
      this.zone = z;
      this.audio.zone = z;
      banner(ZONE_NAMES[z], ZONE_SUBS[z]);
      if (!this.save.visitedZones.includes(z)) {
        this.save.visitedZones.push(z);
        toast('New area discovered!', 'good');
        this.persist();
        this.checkProgress();
      }
    }
    // hint near a locked gate
    for (const g of this.world.gates) {
      if (g.open) continue;
      if (Math.abs(this.pos.x - g.x) < 7 && Math.abs(this.pos.z) < 9 && this.now - this.gateHintAt > 4) {
        this.gateHintAt = this.now;
        toast(`🔒 ${g.zone === 'savanna' ? 'Savanna' : 'Swamp'} gate needs: ${this.gateProgress(g.zone)}`, '', 3000);
      }
    }
  }

  objective(): { text: string; progress?: string; target?: THREE.Vector3 } {
    const s = this.save;
    const gate = (zone: ZoneId) => new THREE.Vector3(zone === 'savanna' ? WORLD.zoneEdge + 2 : -WORLD.zoneEdge - 2, 0, 0);
    switch (s.tutorialStep) {
      case 0: return { text: 'Walk to the glowing ring', progress: 'Use the arrow keys ← ↑ ↓ →', target: new THREE.Vector3(TUTORIAL_RING.x, 0, TUTORIAL_RING.z) };
      case 1: return { text: 'Grab the berries, then jump into the coin', progress: 'Press Space to jump', target: new THREE.Vector3(FOOD_SPAWNS[0].x, 0, FOOD_SPAWNS[0].z) };
      case 2: {
        const b = this.opps.find((o) => o.spawn.training)!;
        return { text: 'Win a practice battle with the Young Badger', progress: 'Press 1 to scratch, 2 to bite', target: b.alive ? b.pos.clone() : undefined };
      }
      case 3: return { text: 'Click the 🛒 Shop button', progress: 'Spend coins on animals, skins and homes' };
    }
    if (!s.unlockedZones.includes('savanna')) return { text: 'Open the Savanna gate', progress: this.gateProgress('savanna') };
    if (!s.visitedZones.includes('savanna')) return { text: 'Go east through the Savanna gate →', target: gate('savanna') };
    if (!s.unlockedZones.includes('swamp')) return { text: 'Open the Swamp gate', progress: this.gateProgress('swamp') };
    if (!s.visitedZones.includes('swamp')) return { text: 'Go west through the Swamp gate ←', target: gate('swamp') };
    if (s.lionWins === 0) return { text: 'Win a battle against a lion', progress: 'Lions live near Pride Rock in the Savanna', target: this.zone === 'savanna' ? new THREE.Vector3(172, 0, 30) : gate('savanna') };
    if (s.homeTier < HOMES.length - 1) {
      const next = HOMES[s.homeTier + 1];
      return { text: `Save up for the ${next.name}`, progress: `${Math.min(s.coins, next.cost)}/${next.cost} coins` };
    }
    return { text: 'You did it! Keep exploring and collecting', progress: `Battles won: ${s.wins} • Food found: ${s.foodCount}` };
  }

  updateObjective() {
    const o = this.objective();
    this.setText('objective-text', o.text);
    this.setText('objective-progress', o.progress ?? '');
    this.world.tutorialRing.visible = this.save.tutorialStep === 0;
  }

  // =========================================================================
  // Home
  // =========================================================================
  setHome(tier: number) {
    if (this.home) this.home.group.removeFromParent();
    for (const c of this.homeColliders) this.world.collision.remove(c);
    this.homeColliders = [];
    this.home = buildHome(tier);
    this.world.homeAnchor.add(this.home.group);
    const lights: THREE.MeshStandardMaterial[] = [];
    this.home.group.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && m.emissiveIntensity > 0 && m.emissive && m.emissive.getHex() !== 0) lights.push(m);
    });
    this.world.homeLights = lights;
    // swinging front door (hinged on its left edge)
    this.outsideDoor = null;
    const doorMesh = this.home.group.getObjectByName('door') as THREE.Mesh | undefined;
    if (doorMesh) {
      const dw = (doorMesh.geometry as THREE.BoxGeometry).parameters.width;
      doorMesh.geometry.translate(dw / 2, 0, 0);
      doorMesh.position.x -= dw / 2;
      this.outsideDoor = doorMesh;
    }
    this.interior.build(tier);
    this.buildFamily();
    this.placeMyPets();
    this.setDoorOpen(this.doorOpen);
    const h = WORLD.home, y = this.world.homeAnchor.position.y;
    const add = (minX: number, maxX: number, minZ: number, maxZ: number, top: number) =>
      this.homeColliders.push(this.world.collision.add({ kind: 'box', minX: h.x + minX, maxX: h.x + maxX, minZ: h.z + minZ, maxZ: h.z + maxZ, top: y + top }));
    if (tier === 0) add(-1.4, 1.4, -1.0, 0.2, 100);
    else if (tier === 1) add(-2.1, 2.1, -1.9, 1.9, 100);
    else if (tier === 2) { add(-3.1, 3.1, -2.6, 2.6, 100); add(-1.7, 1.7, 2.5, 4.1, 0.7); }
    else { add(-4.6, 4.6, -3.6, 3.6, 100); add(-7.6, -4.4, -2.4, 2.8, 100); add(4.4, 7.6, -2.4, 2.8, 100); add(-2.6, 2.6, 3.5, 5.7, 1.23); add(-1.1, 1.1, 5.6, 6.4, 0.72); }
  }

  // =========================================================================
  // Frame loop
  // =========================================================================
  lowQuality = false;
  /** Fast graphics: no reflections or shadows (used automatically on slow computers). */
  setLowQuality() {
    this.lowQuality = true;
    this.scene.environment = null;
    this.world.sun.castShadow = false;
    this.world.hemi.intensity *= 1.0;
    console.info('Animal Adventures: switched to fast graphics for a smoother frame rate.');
  }

  private perf = { frames: 0, time: 0, ratio: Math.min(1.5, window.devicePixelRatio) };
  /** Keep the frame rate smooth on slower laptops by adjusting render resolution. */
  private adaptResolution(rawDt: number) {
    const P = this.perf;
    P.frames++; P.time += rawDt;
    if (P.time < 2) return;
    const fps = P.frames / P.time;
    P.frames = 0; P.time = 0;
    const max = Math.min(1.5, window.devicePixelRatio);
    let r = P.ratio;
    if (fps < 32 && r > 0.6) r = Math.max(0.6, r - 0.15);
    else if (fps > 55 && r < max) r = Math.min(max, r + 0.1);
    if (r !== P.ratio) { P.ratio = r; this.renderer.setPixelRatio(r); this.renderer.setSize(window.innerWidth, window.innerHeight, false); }
    // still slow at the lowest resolution: switch to fast graphics
    else if (fps < 22 && r <= 0.6 && !this.lowQuality) this.setLowQuality();
  }

  private frame(t: number) {
    const rawDt = (t - this.lastFrame) / 1000;
    const dt = Math.min(0.05, rawDt);
    this.lastFrame = t;
    if (!document.hidden && rawDt > 0 && rawDt < 1) this.adaptResolution(rawDt);
    this.realTime += dt;
    const playing = this.started && !this.modal;
    if (playing) {
      this.now += dt;
      this.world.timeOfDay = (this.world.timeOfDay + dt / DAY_LENGTH) % 1;
      if (Math.floor(this.now / 30) !== Math.floor((this.now - dt) / 30)) this.persist();
      for (const tm of [...this.timers]) if (this.now >= tm.at) { this.timers = this.timers.filter((q) => q !== tm); tm.fn(); }
      this.updatePlayer(dt);
      const ctx = {
        playerPos: this.pos, playerGroundY: this.groundY, playerAlive: !this.respawning, playerSafe: this.playerSafeFromDinos(), collision: this.world.collision,
        now: this.now, camera: this.camera,
        onStrike: (o: Opponent) => this.onStrike(o),
        onBrawlHit: (a: Opponent, b: Opponent) => this.onBrawlHit(a, b),
        onWarn: (o: Opponent) => {
          if (o.spawn.hunter) { this.audio.roar(); return; }
          this.audio.growl(); toast(`The ${o.spawn.name} says: stay back!`, 'bad', 1800);
        },
        onTelegraph: () => this.audio.telegraph(),
      };
      for (const o of this.opps) o.update(dt, ctx);
      this.updateEmerging();
      const hctx = {
        playerPos: this.pos, playerGroundY: this.groundY, playerActive: !this.respawning && this.started && !this.captive?.onWalk && this.species !== 'human',   // humans don't chase a human!
        collision: this.world.collision, now: this.now, cameraPos: this.camera.position,
        onCatch: (h: Human) => { this.audio.hurt(); this.captureByHuman(h); },
        onShout: (h: Human, text: string) => {
          if (this.now - this.shoutAt < 1.5) return;
          this.shoutAt = this.now;
          toast(`🧑 ${h.spawn.name}: "${text}"`, text.startsWith('Hey') ? 'bad' : '', 2000);
          if (text.startsWith('Hey')) this.audio.growl();
        },
      };
      // humans only need updating when you're nearby (they're far from everything else)
      const nearVillage = this.pos.z > VILLAGE.minZ - 30 && this.pos.z < 200;
      // at night the village humans go home to bed (it's safe to sneak around!)
      const humansAsleep = this.world.daylight < 0.45;
      if (humansAsleep !== this.humansAsleep) {
        this.humansAsleep = humansAsleep;
        if (nearVillage && this.started && this.inHumanHouse < 0) toast(humansAsleep ? '🌙 The humans went home to sleep. Shh!' : '☀️ Good morning! The humans are up and about again.', '', 2600);
        if (humansAsleep) for (const hu of this.humans) hu.calmDown();
      }
      for (const hu of this.humans) {
        if (this.humanAway.has(hu) && !this.save.myPets.some((q) => q.species === 'human' && q.name === hu.spawn.name)) this.humanAway.delete(hu);   // let go free: back home to the village
        hu.root.visible = nearVillage && !humansAsleep && !this.humanAway.has(hu); if (hu.root.visible) hu.update(dt, hctx);
      }
      if (this.inHumanHouse >= 0 && !this.captive) {
        const hi = this.inHumanHouse, hh = this.homeHumans[hi];
        if (this.homeState[hi] === 'awake') hh.update(dt, hctx);
      }
      // the pet owner inside their house
      const cap = this.captive;
      const ownerOn = !!cap && this.inHumanHouse === cap.house;
      this.petOwner.root.visible = ownerOn; this.petOwner.active = ownerOn;
      if (ownerOn) this.petOwner.update(dt, { ...hctx, playerActive: !this.respawning && !cap!.caged, onCatch: () => this.recage() });
      if (cap) cap.wiggle = Math.max(0, cap.wiggle - dt * 9);
      this.updateCaptivity(dt, hctx);
      this.updateFood(dt);
      this.updateCoins(dt);
      this.updateMaps(dt);
      this.updateHouse(dt);
      this.updateNight(dt);
      this.updateZone();
      if (this.save.tutorialStep === 0 && Math.hypot(this.pos.x - TUTORIAL_RING.x, this.pos.z - TUTORIAL_RING.z) < 2.2) {
        this.save.tutorialStep = 1; this.audio.food(); toast('Great walking! 🎉', 'good'); this.persist(); this.updateObjective();
      }
      this.effects = this.effects.filter((e) => e(dt));
      this.updateHelpers();
    }
    if (!this.started) {
      // gentle idle pan behind the start screen
      this.cam.yaw += dt * 0.05;
    }
    this.world.update(dt, this.realTime, this.pos);
    this.cam.update(dt, new THREE.Vector3(this.pos.x, this.pos.y + Math.max(0.6, this.rig.height * 0.75), this.pos.z), this.world.collision);
    this.audio.update(dt, !playing);
    this.renderer.render(this.scene, this.camera);
    if (this.started) { this.updateHud(); if (++this.minimapTick % 3 === 0) this.drawMinimap(); }
    if (this.modal === 'shop' || this.modal === 'animals') this.preview.render(dt);
    requestAnimationFrame((tt) => this.frame(tt));
  }

  private inCameraView(p: THREE.Vector3) {
    const v = p.clone().project(this.camera);
    return v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
  }

  private updateHelpers() {
    // target indicator
    const t = this.findTarget(COMBAT.targetHintRange);
    if (t && !this.respawning) {
      const inRange = !!this.findTarget(COMBAT.attackRange);
      this.targetRing.visible = true;
      this.targetRing.position.set(t.pos.x, t.pos.y + 0.06, t.pos.z);
      const s = t.radius * 2.6 + Math.sin(this.realTime * 6) * 0.1;
      this.targetRing.scale.set(s, s, 1);
      (this.targetRing.material as THREE.MeshBasicMaterial).color.setHex(inRange ? 0xffe36b : 0xffffff);
      (this.targetRing.material as THREE.MeshBasicMaterial).opacity = inRange ? 0.95 : 0.45;
    } else this.targetRing.visible = false;
    // objective arrow
    const o = this.objective();
    if (o.target && !this.respawning) {
      const d = Math.hypot(o.target.x - this.pos.x, o.target.z - this.pos.z);
      this.objArrow.visible = false; // no arrow over the animal (the designer asked for it to be removed)
      if (this.objArrow.visible) {
        const a = Math.atan2(o.target.x - this.pos.x, o.target.z - this.pos.z);
        this.objArrow.position.set(this.pos.x + Math.sin(a) * 1.3, this.pos.y + this.rig.height + 0.9 + Math.sin(this.realTime * 3) * 0.08, this.pos.z + Math.cos(a) * 1.3);
        this.objArrow.rotation.set(0, a, 0);
      }
    } else this.objArrow.visible = false;
    // nameplates
    const w = window.innerWidth, h = window.innerHeight;
    for (const op of this.opps) op.updateLabel(this.camera, w, h, this.strengthOf(op), this.pos);
    for (const hu of this.humans) { if (hu.root.visible) hu.updateLabel(this.camera, w, h, this.pos); else hu.label.style.display = 'none'; }
    this.homeHumans.forEach((hu, i) => { if (hu.root.visible && this.inHumanHouse === i) hu.updateLabel(this.camera, w, h, this.pos); else hu.label.style.display = 'none'; });
    if (this.petOwner.active) this.petOwner.updateLabel(this.camera, w, h, this.pos); else this.petOwner.label.style.display = 'none';
  }

  private setText(id: string, text: string) {
    if (this.hudCache[id] === text) return;
    this.hudCache[id] = text;
    $(id).textContent = text;
  }

  private updateHud() {
    const d = this.def;
    this.setText('hud-animal-icon', d.icon);
    this.setText('hud-animal-name', d.name);
    const hpPct = (this.hp / this.maxHp) * 100;
    $('hp-fill').style.width = `${hpPct}%`;
    this.setText('hp-text', `${Math.ceil(this.hp)}/${this.maxHp}`);
    $('sp-fill').style.width = `${(this.charge / COMBAT.chargeMax) * 100}%`;
    const ready = this.charge >= COMBAT.chargeMax;
    this.setText('sp-text', ready ? 'READY' : `${Math.round(this.charge)}%`);
    $('sp-row').classList.toggle('ready', ready);
    $('special-ready').hidden = !ready || !!this.modal;
    $('home-hint').hidden = this.hp > this.maxHp * 0.35 || this.bagTotal() === 0 || !!this.modal;
    this.setText('coin-count', String(this.save.coins));
    this.setText('bag-count', String(this.bagTotal()));
    const tod = this.world.timeOfDay;
    const nightNow = tod >= 0.6 && tod < 0.97;
    this.setText('daytime-chip', nightNow ? '☀️ Make it Day' : '🌙 Make it Night');
    if (ready !== this.specialWasReady) this.specialWasReady = ready;
    // keep the savings objective live
    if (this.save.tutorialStep >= 4) {
      const o = this.objective();
      this.setText('objective-progress', o.progress ?? '');
    }
  }

  persist() {
    this.save.audio = { ...this.audio.settings };
    this.save.timeOfDay = this.world.timeOfDay;
    writeSave(this.save);
  }

  // =========================================================================
  // Modals
  // =========================================================================
  private openModal(name: Exclude<ModalName, null>, build: (root: HTMLElement) => void, narrow = false) {
    this.closeModal(true);
    this.modal = name;
    this.keys.clear();
    const root = $('modal-root');
    const backdrop = el('div', { class: 'modal-backdrop' });
    const box = el('div', { class: 'modal' + (narrow ? ' narrow' : ''), role: 'dialog', 'aria-modal': 'true' });
    backdrop.append(box);
    backdrop.addEventListener('pointerdown', (e) => { if (e.target === backdrop && this.modal !== 'celebrate') this.closeModal(); });
    root.append(backdrop);
    build(box);
  }

  closeModal(silent = false) {
    if (!this.modal) return;
    this.modalCleanup?.(); this.modalCleanup = null;
    $('modal-root').innerHTML = '';
    this.modal = null;
    this.keys.clear(); // returning to play never carries over menu key presses
    this.shopMsg = null;
    if (!silent) { this.focusGame(); this.checkProgress(); }
  }

  private head(title: string, showWallet = true) {
    const h = el('div', { class: 'modal-head' }, el('h2', { text: title }));
    const right = el('div', { class: 'hud-row' });
    if (showWallet) right.append(el('div', { class: 'wallet', html: `${coinPrice(this.save.coins)}` }));
    right.append(button('✕ Close', 'close-btn', () => { this.audio.click(); this.closeModal(); }));
    h.append(right);
    return h;
  }

  thumb(species: Species, skinId: string): string {
    const key = species + '|' + skinId;
    const hit = this.thumbs.get(key);
    if (hit) return hit;
    const rig = buildPlayerAnimal(species, skinById(skinId)!);
    const url = this.preview.snapshot(rig.root, rig.height, 1.25);
    disposeRig(rig);
    this.thumbs.set(key, url);
    return url;
  }
  homeThumb(tier: number): string {
    const key = 'home|' + tier;
    const hit = this.thumbs.get(key); if (hit) return hit;
    const h = buildHome(tier);
    const sizes = [2.6, 5, 7, 10.5];
    const url = this.preview.snapshot(h.group, sizes[tier], 0.5, 1.4);
    this.thumbs.set(key, url);
    return url;
  }

  // ---------------- Shop ----------------
  openShop(tab?: 'animals' | 'skins' | 'homes') {
    if (tab) this.shopTab = tab;
    if (this.save.tutorialStep === 3) { this.save.tutorialStep = 4; this.persist(); this.updateObjective(); }
    this.openModal('shop', (box) => this.renderShop(box));
  }

  private renderShop(box: HTMLElement) {
    box.innerHTML = '';
    box.append(this.head('🛒 Shop'));
    const tabs = el('div', { class: 'tabs', role: 'tablist' });
    for (const [id, label] of [['animals', '🐾 Animals'], ['skins', '🎨 Skins'], ['homes', '🏠 Homes']] as const) {
      const t = el('button', { class: 'tab', role: 'tab', type: 'button', 'aria-selected': String(this.shopTab === id), text: label });
      t.addEventListener('click', () => { this.audio.click(); this.shopTab = id; this.shopSel = null; this.shopMsg = null; this.renderShop(box); });
      tabs.append(t);
    }
    box.append(tabs);
    const body = el('div', { class: 'modal-body' });
    const layout = el('div', { class: 'shop-layout' });
    const pane = el('div', { class: 'preview-pane' });
    const cards = el('div', { class: 'cards' });
    layout.append(pane, cards);
    body.append(layout);
    box.append(body);

    // default selection
    if (!this.shopSel || this.shopSel.kind !== this.shopTab.slice(0, -1) as string) {
      if (this.shopTab === 'animals') this.shopSel = { kind: 'animal', species: this.species };
      else if (this.shopTab === 'skins') this.shopSel = { kind: 'skin', id: this.save.equippedSkins[this.species] };
      else this.shopSel = { kind: 'home', tier: Math.min(HOMES.length - 1, this.save.homeTier + 1) };
    }
    const rerender = () => this.renderShop(box);
    const select = (s: Selection) => { this.audio.click(); this.shopSel = s; this.shopMsg = null; rerender(); };

    if (this.shopTab === 'animals') {
      for (const s of SPECIES_ORDER) {
        const d = PLAYER_ANIMALS[s];
        const owned = this.save.owned.includes(s);
        const unlocked = this.animalUnlocked(s);
        const sel = this.shopSel.kind === 'animal' && this.shopSel.species === s;
        const status = owned ? (s === this.species ? el('span', { class: 'status equipped', text: 'Playing now' }) : el('span', { class: 'status owned', text: '✔ Owned' }))
          : unlocked ? el('span', { class: 'price', html: coinPrice(d.cost) }) : el('span', { class: 'status locked', text: '🔒 Locked' });
        const card = el('button', { class: 'card' + (sel ? ' selected' : '') + (!owned && !unlocked ? ' locked' : ''), type: 'button' },
          el('img', { src: this.thumb(s, this.save.equippedSkins[s]), alt: '' }),
          el('div', { class: 'name', text: d.name }), status,
          !owned && !unlocked ? el('div', { class: 'req', text: d.unlockText }) : null);
        card.addEventListener('click', () => select({ kind: 'animal', species: s }));
        cards.append(card);
      }
    } else if (this.shopTab === 'skins') {
      cards.append(el('div', { class: 'empty-note', text: 'Skins change how your animal looks. They never change strength.' }));
      // only the skins for the animal you're playing right now
      for (const s of [this.species]) {
        cards.append(el('div', { class: 'section-title', text: `${PLAYER_ANIMALS[s].icon} Skins for your ${PLAYER_ANIMALS[s].name}` }));
        for (const k of SKINS.filter((q) => q.species === s)) {
          const owned = this.save.ownedSkins.includes(k.id);
          const equipped = this.save.equippedSkins[s] === k.id;
          const sel = this.shopSel.kind === 'skin' && this.shopSel.id === k.id;
          const status = equipped ? el('span', { class: 'status equipped', text: 'Wearing' }) : owned ? el('span', { class: 'status owned', text: '✔ Owned' }) : el('span', { class: 'price', html: coinPrice(k.cost) });
          const card = el('button', { class: 'card' + (sel ? ' selected' : ''), type: 'button' },
            el('img', { src: this.thumb(s, k.id), alt: '' }), el('div', { class: 'name', text: k.name }), status);
          card.addEventListener('click', () => select({ kind: 'skin', id: k.id }));
          cards.append(card);
        }
      }
      cards.append(el('div', { class: 'empty-note', text: '🐾 Want skins for a different animal? Switch to that animal in the 🐾 Animals panel first (at home).' }));
    } else {
      HOMES.forEach((hm, tier) => {
        const owned = this.save.homeTier >= tier;
        const next = tier === this.save.homeTier + 1;
        const sel = this.shopSel!.kind === 'home' && (this.shopSel as { tier: number }).tier === tier;
        const status = tier === this.liveTier ? el('span', { class: 'status equipped', text: 'Your home' }) : owned ? el('span', { class: 'status owned', text: '✔ Owned' })
          : el('span', { class: 'price', html: coinPrice(hm.cost) });
        const card = el('button', { class: 'card' + (sel ? ' selected' : '') + (!owned && !next ? ' locked' : ''), type: 'button' },
          el('img', { src: this.homeThumb(tier), alt: '' }), el('div', { class: 'name', text: hm.name }), status,
          !owned && !next ? el('div', { class: 'req', text: `Buy the ${HOMES[tier - 1].name} first` }) : null);
        card.addEventListener('click', () => select({ kind: 'home', tier }));
        cards.append(card);
      });
    }
    this.renderPreviewPane(pane, rerender);
  }

  private renderPreviewPane(pane: HTMLElement, rerender: () => void) {
    const sel = this.shopSel!;
    pane.append(this.preview.renderer.domElement);
    const msg = el('div', { class: 'preview-msg' + (this.shopMsg ? ' ' + this.shopMsg.cls : ''), text: this.shopMsg?.text ?? '' });
    const actions = el('div', { class: 'action-row' });
    const need = (cost: number) => `You need ${cost - this.save.coins} more coins.`;
    if (sel.kind === 'animal') {
      const s = sel.species, d = PLAYER_ANIMALS[s];
      const rig = buildPlayerAnimal(s, skinById(this.save.equippedSkins[s])!);
      this.preview.show(rig.root, rig.height);
      this.setPreviewCleanup(() => disposeRig(rig));
      pane.append(el('h3', { text: `${d.icon} ${d.name}` }), el('p', { text: d.blurb }),
        el('div', { class: 'stats', text: `Health ${d.health} • Scratch ${d.scratch} • Bite ${d.bite}` }));
      const owned = this.save.owned.includes(s);
      if (owned) {
        if (s === this.species) pane.append(el('p', { text: `You're playing as the ${d.name}!` }));
        else if (this.atHome) actions.append(button(`Play as ${d.name}`, 'btn-green', () => { this.switchAnimal(s); this.shopMsg = { text: `You're now a ${d.name}!`, cls: 'good' }; rerender(); }));
        else pane.append(el('p', { text: '🏠 Go home to switch animals.' }));
      } else if (!this.animalUnlocked(s)) {
        pane.append(el('p', { class: 'preview-msg bad', text: `🔒 To unlock: ${d.unlockText}` }), el('div', { class: 'stats', text: this.unlockProgress(s) }));
      } else {
        const can = this.save.coins >= d.cost;
        actions.append(button(`Buy for ${coinPrice(d.cost)}`, 'btn-shop', () => {
          if (this.buyAnimal(s)) this.shopMsg = { text: `The ${d.name} is yours! ${this.atHome ? 'Press "Play as" to switch.' : 'Switch at home with the Animals button.'}`, cls: 'good' };
          rerender();
        }, !can));
        if (!can) pane.append(el('p', { class: 'preview-msg bad', text: need(d.cost) }));
      }
    } else if (sel.kind === 'skin') {
      const k = skinById(sel.id)!;
      const rig = buildPlayerAnimal(k.species, k);
      this.preview.show(rig.root, rig.height);
      this.setPreviewCleanup(() => disposeRig(rig));
      pane.append(el('h3', { text: k.name }), el('p', { text: `A look for your ${PLAYER_ANIMALS[k.species].name}. Same strength, new style!` }));
      const owned = this.save.ownedSkins.includes(k.id);
      const equipped = this.save.equippedSkins[k.species] === k.id;
      if (equipped) pane.append(el('p', { class: 'preview-msg good', text: 'Wearing this skin' }));
      else if (owned) actions.append(button('Wear this skin', 'btn-green', () => { this.equipSkin(k.id); this.shopMsg = { text: 'Looking good!', cls: 'good' }; rerender(); }));
      else {
        const can = this.save.coins >= k.cost;
        actions.append(button(`Buy for ${coinPrice(k.cost)}`, 'btn-shop', () => { if (this.buySkin(k.id)) this.shopMsg = { text: 'Skin bought and equipped!', cls: 'good' }; rerender(); }, !can));
        if (!can) pane.append(el('p', { class: 'preview-msg bad', text: need(k.cost) }));
      }
    } else {
      const tier = sel.tier, hm = HOMES[tier];
      const sizes = [2.6, 5, 7, 10.5];
      const h = buildHome(tier);
      this.preview.show(h.group, sizes[tier], 1.4);
      pane.append(el('h3', { text: hm.name }), el('p', { text: hm.blurb }));
      if (tier === this.liveTier) pane.append(el('p', { class: 'preview-msg good', text: 'This is your home now!' }));
      else if (this.save.homeTier >= tier) {
        pane.append(el('p', { class: 'preview-msg good', text: 'You own this home. Want to live here?' }));
        actions.append(button('🏠 Move in here', 'btn-green', () => { this.moveHome(tier); this.shopMsg = { text: `You moved into your ${hm.name}! Your family came too. 💛`, cls: 'good' }; rerender(); }));
      }
      else if (tier > this.save.homeTier + 1) pane.append(el('p', { class: 'preview-msg bad', text: `🔒 Buy the ${HOMES[tier - 1].name} first.` }));
      else {
        const can = this.save.coins >= hm.cost;
        actions.append(button(`Buy for ${coinPrice(hm.cost)}`, 'btn-shop', () => { if (this.buyHome(tier)) this.shopMsg = { text: `Your ${hm.name} is ready at home!`, cls: 'good' }; rerender(); }, !can));
        if (!can) pane.append(el('p', { class: 'preview-msg bad', text: need(hm.cost) }));
      }
    }
    pane.append(actions, msg);
  }

  private setPreviewCleanup(fn: () => void) {
    const prev = this.modalCleanup;
    this.modalCleanup = fn;
    prev?.();
  }

  // ---------------- purchases (each deducts exactly once) ----------------
  private spend(cost: number): boolean {
    if (!Number.isFinite(cost) || cost < 0 || this.save.coins < cost) { this.audio.denied(); return false; }
    this.save.coins -= cost;
    return true;
  }
  buyAnimal(s: Species): boolean {
    if (this.save.owned.includes(s) || !this.animalUnlocked(s)) return false;
    if (!this.spend(PLAYER_ANIMALS[s].cost)) return false;
    this.save.owned.push(s);
    if (!this.save.freshAnimals.includes(s)) this.save.freshAnimals.push(s);
    this.audio.purchase(); this.persist(); this.checkProgress();
    return true;
  }
  buySkin(id: string): boolean {
    const k = skinById(id);
    if (!k || this.save.ownedSkins.includes(id) || !this.save.owned.includes(k.species)) return false;
    if (!this.spend(k.cost)) return false;
    this.save.ownedSkins.push(id);
    this.audio.purchase();
    this.equipSkin(id);
    return true;
  }
  /** The home you live in right now (any home you own). */
  get liveTier() { return Math.min(this.save.liveIn ?? this.save.homeTier, this.save.homeTier); }
  /** Move into a different home you already own. */
  moveHome(tier: number) {
    if (tier > this.save.homeTier || tier === this.liveTier) return;
    if (this.indoors) this.exitHouse();
    this.save.liveIn = tier;
    this.setHome(tier);
    this.audio.purchase(); this.persist();
  }
  buyHome(tier: number): boolean {
    if (tier !== this.save.homeTier + 1 || tier >= HOMES.length) return false;
    if (!this.spend(HOMES[tier].cost)) return false;
    this.save.homeTier = tier; this.save.liveIn = tier;
    this.setHome(tier);
    this.audio.purchase(); this.persist();
    return true;
  }
  equipSkin(id: string) {
    const k = skinById(id);
    if (!k || !this.save.ownedSkins.includes(id)) return;
    this.save.equippedSkins[k.species] = id;
    if (k.species === this.species) this.spawnPlayerRig();
    this.persist();
  }
  switchAnimal(s: Species) {
    if (!this.save.owned.includes(s) || !this.atHome || s === this.species) return;
    const frac = this.hp / this.maxHp; // keep health percentage: no free healing
    this.species = s;
    this.save.current = s;
    const fresh = this.save.freshAnimals.includes(s);
    this.save.freshAnimals = this.save.freshAnimals.filter((q) => q !== s);
    this.hp = fresh ? this.maxHp : Math.max(1, frac * this.maxHp);
    this.spawnPlayerRig();
    this.audio.purchase();
    this.persist();
  }

  // ---------------- Travel ----------------
  openTravel() {
    this.openModal('travel', (box) => {
      box.append(this.head('🧭 Travel', false));
      const body = el('div', { class: 'modal-body' });
      const fighting = this.opps.some((o) => o.engaged) || !!this.captive;
      body.append(el('p', { class: 'preview-msg ' + (fighting ? 'bad' : 'good'), text: this.captive ? "🎀 You're a pet! Escape from the house first!" : fighting ? '⚔️ Finish your battle (or run away) before you travel!' : 'Where do you want to go?' }));
      const here = zoneAt(this.pos.x, this.pos.z);
      const places: { id: ZoneId | 'home'; name: string; art: ZoneId; icon: string; desc: string; open: boolean; lock?: string }[] = [
        { id: 'home', name: 'Home Clearing', art: 'forest', icon: '🏠', desc: 'Your home in the forest.', open: true },
        { id: 'savanna', name: 'The Savanna', art: 'savanna', icon: '🦁', desc: 'Golden grass and lions.', open: this.save.unlockedZones.includes('savanna'), lock: this.gateProgress('savanna') },
        { id: 'swamp', name: 'The Swamp', art: 'swamp', icon: '🐊', desc: 'Misty water and crocodiles.', open: this.save.unlockedZones.includes('swamp'), lock: this.gateProgress('swamp') },
        { id: 'village', name: 'Human Village', art: 'village', icon: '🏡', desc: 'Over the big hill. Sneak in and steal snacks, but don\'t get caught!', open: true },
        { id: 'antarctica', name: 'Antarctica', art: 'antarctica', icon: '🐧', desc: 'Ice, penguins and seals. Only reachable by travel!', open: true },
        { id: 'jungle', name: 'Jungle Island', art: 'jungle', icon: '🏝️', desc: 'A sunny beach, monkeys, a waterfall and treetop walkways!', open: true },
      ];
      const cards = el('div', { class: 'cards' });
      for (const pl of places) {
        const isHere = pl.id === 'home' ? this.atHome : pl.id === here && pl.id !== 'forest';
        const card = el('div', { class: 'card' + (isHere ? ' selected' : '') + (pl.open ? '' : ' locked') },
          el('div', { class: 'place-art ' + pl.art, text: pl.icon }),
          el('div', { class: 'name', text: pl.name }),
          el('div', { class: 'desc', text: pl.desc }),
          isHere ? el('span', { class: 'status equipped', text: 'You are here' })
            : pl.open ? button('Go!', 'btn-green btn-small', () => this.travelTo(pl.id), fighting)
              : el('div', { class: 'req', text: '🔒 ' + (pl.lock ?? '') }));
        cards.append(card);
      }
      body.append(cards);
      box.append(body);
    });
  }

  travelTo(id: ZoneId | 'home') {
    if (this.captive) return;
    this.seat = null;
    if (this.opps.some((o) => o.engaged)) return;
    this.closeModal();
    const spots: Record<string, { x: number; z: number; yaw: number; text: string }> = {
      home: { x: WORLD.spawn.x, z: WORLD.spawn.z, yaw: 0, text: '🏠 Going home…' },
      savanna: { x: WORLD.zoneEdge + 10, z: 0, yaw: Math.PI / 2, text: '🦁 Off to the Savanna!' },
      swamp: { x: -WORLD.zoneEdge - 10, z: 0, yaw: -Math.PI / 2, text: '🐊 Off to the Swamp!' },
      antarctica: { x: WORLD.antarcticaEntry.x, z: WORLD.antarcticaEntry.z, yaw: 0, text: '🐧 Sailing to Antarctica…' },
      village: { x: 0, z: 78, yaw: 0, text: '🏡 Sneaking over the hill…' },
      jungle: { x: JUNGLE_FEATURES.entry.x, z: JUNGLE_FEATURES.entry.z, yaw: 0, text: '🏝️ Sailing to Jungle Island…' },
      forest: { x: WORLD.spawn.x, z: WORLD.spawn.z, yaw: 0, text: '🏠 Going home…' },
    };
    const s = spots[id];
    this.respawning = true; // freezes controls during the trip
    this.audio.gate();
    $('fade-text').textContent = s.text;
    $('fade').classList.add('on');
    this.later(1.1, () => {
      const y = this.world.collision.groundAt(s.x, s.z, 60, PHYSICS.stepUp);
      this.pos.set(s.x, y, s.z);
      this.vy = 0; this.yaw = s.yaw; this.grounded = true; this.groundY = y;
      this.lunge = null;
      this.cam.reset(this.yaw, true);
      $('fade').classList.remove('on');
      this.later(0.3, () => { this.respawning = false; });
    });
  }

  // ---------------- Animals panel ----------------
  openAnimals() {
    this.openModal('animals', (box) => this.renderAnimals(box));
  }
  private renderAnimals(box: HTMLElement) {
    box.innerHTML = '';
    box.append(this.head('🐾 My Animals', false));
    const body = el('div', { class: 'modal-body' });
    // who you are
    const me = el('div', { class: 'action-row', style: 'justify-content:flex-start;margin-bottom:10px' },
      el('span', { style: 'font-weight:800;align-self:center', text: 'I am a:' }),
      button('👧 Girl', this.save.girl ? 'btn-green btn-small' : 'btn-small', () => { this.save.girl = true; this.syncProfileGirl(); this.persist(); this.spawnPlayerRig(); this.renderAnimals(box); }),
      button('👦 Boy', !this.save.girl ? 'btn-green btn-small' : 'btn-small', () => { this.save.girl = false; this.syncProfileGirl(); this.persist(); this.spawnPlayerRig(); this.renderAnimals(box); }),
      this.save.girl ? button(this.save.bow ? '🎀 Bow: on' : '🎀 Bow: off', this.save.bow ? 'btn-green btn-small' : 'btn-small', () => { this.save.bow = !this.save.bow; this.persist(); this.spawnPlayerRig(); this.renderAnimals(box); }) : null);
    body.append(me);
    const home = this.atHome;
    body.append(el('p', { class: 'preview-msg ' + (home ? 'good' : 'bad'), text: home ? '🏠 You are home. Pick an animal to play as!' : '🏠 Go back to your home in the forest clearing to switch animals.' }));
    const cards = el('div', { class: 'cards' });
    for (const s of this.save.owned) {
      const d = PLAYER_ANIMALS[s];
      const cur = s === this.species;
      const card = el('div', { class: 'card' + (cur ? ' selected' : '') },
        el('img', { src: this.thumb(s, this.save.equippedSkins[s]), alt: '' }),
        el('div', { class: 'name', text: d.name }),
        el('div', { class: 'req', text: `Health ${d.health} • Bite ${d.bite}` }),
        cur ? el('span', { class: 'status equipped', text: 'Playing now' })
          : button(`Play as ${d.name}`, 'btn-green btn-small', () => { this.switchAnimal(s); this.renderAnimals(box); toast(`You're now a ${d.name}!`, 'good'); }, !home));
      cards.append(card);
    }
    body.append(cards);
    if (this.save.owned.length < SPECIES_ORDER.length) {
      body.append(el('div', { class: 'action-row' }, button('🛒 Get more animals in the Shop', 'btn-shop btn-small', () => this.openShop('animals'))));
    }
    box.append(body);
  }

  // ---------------- Pause ----------------
  openPause(view: 'main' | 'controls' | 'sound' | 'reset' = 'main') {
    if (!this.started) return;
    this.openModal('pause', (box) => {
      const title = { main: '⏸ Paused', controls: '🎮 Controls', sound: '🔊 Sound', reset: '⚠️ Reset Save' }[view];
      box.append(this.head(title, false));
      const body = el('div', { class: 'modal-body' });
      const back = () => button('← Back', '', () => { this.audio.click(); this.openPause('main'); });
      if (view === 'main') {
        body.append(el('div', { class: 'menu-list' },
          button('▶ Resume', 'btn-green', () => { this.audio.click(); this.closeModal(); }),
          button('🎮 Controls', '', () => { this.audio.click(); this.openPause('controls'); }),
          button('🔊 Sound', '', () => { this.audio.click(); this.openPause('sound'); }),
          button(GAME_MODE.level === 2 ? '⚡ Mode 2: Fast & Hard (tap for Mode 1)' : '🙂 Mode 1: Normal (tap for Mode 2)', GAME_MODE.level === 2 ? 'btn-shop' : '', () => { this.setMode(GAME_MODE.level === 2 ? 1 : 2); this.openPause('main'); }),
          button('🗑 Reset Save', 'btn-red', () => { this.audio.click(); this.openPause('reset'); })),
          el('p', { class: 'save-note', text: '💾 Progress is saved on this browser and device.' }));
      } else if (view === 'controls') {
        const rows: [string, string][] = [
          ['<kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd>', 'Move (follows where the camera looks)'], ['<kbd class="wide">Space</kbd>', 'Jump — jump into coins to collect them'],
          ['<kbd>1</kbd>', 'Scratch (quick)'], ['<kbd>2</kbd>', 'Bite (stronger, slower)'], ['<kbd>3</kbd>', 'Special move when the meter glows'],
          ['<span class="mouse">Click + drag</span>', 'Turn the camera'], ['<span class="mouse">Two-finger scroll</span>', 'Zoom in and out'],
          ['<kbd>0</kbd>', 'Jump attack: leap and pounce on an animal'], ['<kbd>E</kbd>', 'Eat a snack from your bag'], ['<kbd>B</kbd>', 'Open your bag'], ['<kbd>A</kbd>', 'Use / open (doors, beds, chests…)'], ['<kbd>F</kbd>', 'Talk to family, friends and pets next to you'], ['<kbd>P</kbd>', 'Pet your pet (or catch a fish while swimming)'], ['<kbd>M</kbd>', 'Grab eggs from a chicken\'s nest'], ['<kbd>T</kbd>', 'Throw a ball for your pet to fetch'], ['<kbd>K</kbd>', 'Keep the wild horse you\'re riding as a pet'], ['<kbd>G</kbd>', 'Play a game with your pet (in its habitat)'],
          ['<kbd>C</kbd>', 'Put the camera behind your animal'], ['<kbd class="wide">Esc</kbd>', 'Pause or close a menu'],
        ];
        const tbl = el('div', { class: 'controls-table' });
        for (const [k, v] of rows) tbl.append(el('div', { html: k }), el('div', { text: v }));
        const follow = el('div', { class: 'toggle-row' }, el('span', { text: '🎥 Camera follows behind my animal' }),
          button(this.save.cameraFollow ? 'On — turn off' : 'Off — turn on', this.save.cameraFollow ? 'btn-green' : '', () => { this.save.cameraFollow = !this.save.cameraFollow; this.persist(); this.openPause('controls'); }));
        body.append(tbl, el('div', { style: 'margin-top:16px' }, follow), el('div', { class: 'action-row' }, back()));
      } else if (view === 'sound') {
        const st = this.audio.settings;
        const mute = el('div', { class: 'toggle-row' }, el('span', { text: 'Sound' }),
          button(st.muted ? '🔇 Off — turn on' : '🔊 On — mute', st.muted ? '' : 'btn-green', () => { st.muted = !st.muted; this.audio.apply(); this.persist(); this.openPause('sound'); }));
        const slider = (label: string, key: 'music' | 'sfx') => {
          const id = 'vol-' + key;
          const inp = el('input', { type: 'range', min: '0', max: '100', id, value: String(Math.round(st[key] * 100)), 'aria-label': label });
          const out = el('span', { text: String(Math.round(st[key] * 100)) });
          inp.addEventListener('input', () => { st[key] = Number(inp.value) / 100; out.textContent = inp.value; this.audio.apply(); this.persist(); });
          return el('label', { class: 'setting', for: id }, el('span', { text: label }), inp, out);
        };
        body.append(el('div', { class: 'menu-list' }, mute, slider('🎵 Music', 'music'), slider('💥 Effects', 'sfx'), el('div', { class: 'action-row' }, back())));
      } else {
        body.append(el('p', { class: 'confirm-text', text: 'This deletes all your coins, animals, skins and homes, and starts over. Are you sure?' }),
          el('div', { class: 'action-row' },
            button('No, keep my game', 'btn-green', () => { this.audio.click(); this.openPause('main'); }),
            button('Yes, start over', 'btn-red', () => this.resetSave())));
      }
      box.append(body);
    }, true);
  }

  // ---- Players: tap your name to switch to someone else's game (or add a new player who starts fresh)
  private showPlayerChip() {
    const p = activeProfile();
    $('btn-player').textContent = `${p.girl ? '👧' : '👦'} ${p.name} ▾`;
    $('btn-start-player').textContent = `${p.girl ? '👧' : '👦'} Playing as ${p.name} • switch player ▾`;
  }
  private syncProfileGirl() {
    const P = getProfiles();
    setProfiles({ ...P, list: P.list.map((q) => (q.id === P.active ? { ...q, girl: this.save.girl } : q)) });
    this.showPlayerChip();
  }
  /** A map of the Human Village showing which house each caught friend is in. */
  openRescueMap() {
    this.openModal('rescuemap', (box) => {
      box.innerHTML = '';
      box.append(this.head('🗺️ Rescue map', false));
      const body = el('div', { class: 'modal-body' });
      const cv = el('canvas', { width: '640', height: '480', class: 'rescue-canvas', 'aria-label': 'Map of the Human Village' }) as HTMLCanvasElement;
      const g = cv.getContext('2d')!;
      const x0 = VILLAGE.minX - 4, x1 = VILLAGE.maxX + 4, z0 = VILLAGE.minZ - 4, z1 = VILLAGE.maxZ + 4;
      const sc = Math.min(640 / (x1 - x0), 480 / (z1 - z0));
      // north (towards the far end of the village) is at the top, the forest is at the bottom
      const P = (x: number, z: number): [number, number] => [(x1 - x) * sc, (z1 - z) * sc];
      g.fillStyle = '#9ccc6a'; g.fillRect(0, 0, 640, 480);
      g.fillStyle = '#d8c08a'; { const [ax, ay] = P(4, z1); const [bx] = P(-4, z1); g.fillRect(ax, 0, bx - ax, 480); }
      g.font = 'bold 16px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#2f4a1e'; g.fillText('⬇ Forest (your home)', 320, 466);
      const caught = [...this.pets, ...this.family].filter((q) => q.caged);
      this.hhouses.forEach((h, i) => {
        const hm = h.home, [cx, cy] = P(hm.x, hm.z), w = hm.w * sc, d = hm.d * sc;
        const here = caught.filter((q) => q.caged!.house === i);
        g.fillStyle = here.length ? '#ffd0d6' : '#f4ead8'; g.strokeStyle = here.length ? '#d8344a' : '#7a5a3a'; g.lineWidth = here.length ? 4 : 2;
        g.fillRect(cx - w / 2, cy - d / 2, w, d); g.strokeRect(cx - w / 2, cy - d / 2, w, d);
        g.fillStyle = '#4a3020'; g.font = 'bold 14px Nunito, sans-serif'; g.fillText(hm.name, cx, cy + d / 2 + 12);
        if (here.length) { g.font = '26px sans-serif'; g.fillText(here.map((q) => ('emoji' in q ? q.emoji : this.def.icon)).join(''), cx, cy); }
      });
      { const [bx, by] = P(BARN.x, BARN.z); g.font = '26px sans-serif'; g.fillText('🐮', bx, by); g.font = 'bold 14px Nunito, sans-serif'; g.fillStyle = '#4a3020'; g.fillText('Red Barn', bx, by + 22); }
      if (!this.indoors && this.pos.z > z0 && this.pos.z < z1 && this.inHumanHouse < 0) { const [px, py] = P(this.pos.x, this.pos.z); g.font = '22px sans-serif'; g.fillText('📍', px, py); }
      body.append(cv);
      const list = el('ul', { class: 'rescue-list' });
      for (const q of caught) list.append(el('li', { text: `${'emoji' in q ? q.emoji : this.def.icon} ${q.name} is at ${this.hhouses[q.caged!.house].home.name}` }));
      if (!caught.length) list.append(el('li', { text: 'Everyone is safe! 💛' }));
      body.append(list);
      box.append(body);
    });
  }
  /** Tap the Day/Night label at the top to switch between daytime and nighttime. */
  toggleDayNight() {
    if (this.respawning) return;
    const tod = this.world.timeOfDay;
    const night = tod >= 0.6 && tod < 0.97;
    this.world.timeOfDay = night ? 0.12 : 0.64;
    this.save.timeOfDay = this.world.timeOfDay; this.persist();
    toast(night ? '☀️ Good morning! It\'s daytime now.' : '🌙 It\'s nighttime now! Watch out for dinosaurs… (tap the button again for morning)', night ? 'good' : 'gold', 2600);
  }
  openPlayers() {
    this.openModal('players', (box) => this.renderPlayers(box), true);
  }
  private renderPlayers(box: HTMLElement, adding = false) {
    box.innerHTML = '';
    box.append(this.head('👋 Who\'s playing?', false));
    const body = el('div', { class: 'modal-body' });
    const P = getProfiles();
    const list = el('div', { class: 'player-list' });
    for (const q of P.list) {
      const me = q.id === P.active;
      list.append(button(`${q.girl ? '👧' : '👦'} ${q.name}${me ? '  (playing now)' : ''}`, me ? 'btn-green' : 'btn-shop', () => {
        if (me) { this.closeModal(); return; }
        this.persist();                                  // keep this player's game safe first
        if (!setProfiles({ ...P, active: q.id })) { toast('Sorry, this browser can\'t keep more than one saved game.', 'bad', 3000); return; }
        $('fade-text').textContent = `Hi ${q.name}! 👋 Loading your game…`; $('fade').classList.add('on');
        setTimeout(() => location.reload(), 500);
      }));
    }
    body.append(el('p', { text: 'Each player has their own animals, coins, homes and friends.' }), list);
    if (!adding) body.append(el('div', { class: 'action-row' }, button('➕ Add a new player', 'btn-small', () => this.renderPlayers(box, true)), ...(this.started ? [button('🪙 Send coins', 'btn-shop btn-small', () => { this.closeModal(); setTimeout(() => this.openSendCoins(), 50); })] : [])));
    else {
      const inp = el('input', { type: 'text', id: 'new-player', maxlength: '16', placeholder: 'Their name', 'aria-label': 'New player name', autocomplete: 'off' }) as HTMLInputElement;
      let girl = false;
      const gBtn = button('👧 Girl', 'btn-small', () => { girl = true; gBtn.className = 'btn btn-green btn-small'; bBtn.className = 'btn btn-small'; });
      const bBtn = button('👦 Boy', 'btn-green btn-small', () => { girl = false; bBtn.className = 'btn btn-green btn-small'; gBtn.className = 'btn btn-small'; });
      const add = () => {
        const name = inp.value.trim().slice(0, 16);
        if (!name) { inp.focus(); return; }
        const id = 'p' + Date.now().toString(36);
        this.persist();
        if (!setProfiles({ active: id, list: [...P.list, { id, name, girl }] })) { toast('Sorry, this browser can\'t keep more than one saved game.', 'bad', 3000); return; }
        $('fade-text').textContent = `Welcome, ${name}! 🎉 Starting a brand new game…`; $('fade').classList.add('on');
        setTimeout(() => location.reload(), 600);
      };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
      body.append(el('div', { class: 'chat-form' }, inp), el('div', { class: 'action-row', style: 'justify-content:flex-start' }, gBtn, bBtn),
        el('div', { class: 'action-row' }, button('Cancel', 'btn-small', () => this.renderPlayers(box)), button('✨ Start their game', 'btn-green', add)));
      setTimeout(() => inp.focus(), 50);
    }
    // rename the current player
    const cur = activeProfile();
    body.append(el('div', { class: 'action-row', style: 'margin-top:10px' }, button(`✏️ Change ${cur.name}'s name`, 'btn-small', () => {
      const inp = el('input', { type: 'text', maxlength: '16', value: cur.name, 'aria-label': 'New name', autocomplete: 'off' }) as HTMLInputElement;
      const done = () => { const n = inp.value.trim().slice(0, 16); if (n) setProfiles({ ...getProfiles(), list: getProfiles().list.map((q) => (q.id === cur.id ? { ...q, name: n } : q)) }); this.showPlayerChip(); this.renderPlayers(box); };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(); } });
      body.append(el('div', { class: 'chat-form' }, inp, button('Save', 'btn-green btn-small', done)));
      setTimeout(() => inp.select(), 50);
    })));
    box.append(body);
  }

  resetSave() {
    clearSave();
    const audio = { ...this.audio.settings };
    this.save = newSave();
    this.save.audio = audio;
    this.closeModal(true);
    for (const c of [...this.coins]) this.dropCoin(c);
    for (const f of this.foods) { f.active = true; f.group.visible = true; }
    for (const o of this.opps) {
      o.label.style.display = 'none';
      if (o.spawn.hunter) { o.state = 'gone'; o.rig.root.visible = false; o.respawnAt = 0; continue; }
      o.respawn();
    }
    this.wasNight = false;
    this.timers = [];
    this.respawning = false;
    $('fade').classList.remove('on');
    this.charge = 0;
    this.setHome(0);
    this.barn.reset();
    this.endCaptivity();
    this.hhouses.forEach((_, i) => this.setHumanDoor(i, false));
    this.setBarnDoor(false);
    for (const pt of this.pets) { pt.rig.root.removeFromParent(); pt.bubble.remove(); pt.tag.remove(); }
    this.pets = [];
    this.notifiedUnlocks.clear();
    for (const s of SPECIES_ORDER) if (this.animalUnlocked(s)) this.notifiedUnlocks.add(s);
    this.refreshGates();
    this.started = false;
    this.zone = 'forest';
    $('hud').hidden = true;
    this.species = 'chicken';
    this.spawnPlayerRig();
    this.respawnAt(true);
    this.thumbs.clear();
    this.showStart();
  }

  // ---------------- Celebration ----------------
  openCelebrate() {
    this.audio.celebrate();
    this.openModal('celebrate', (box) => {
      const stop = confetti($('app'));
      this.modalCleanup = stop;
      box.append(el('div', { class: 'modal-body celebrate' },
        el('h2', { text: '🎉 Amazing adventure! 🎉' }),
        el('p', { text: 'You visited the Forest, the Savanna and the Swamp, won a battle against a lion, and built the Large Animal Lodge!' }),
        el('p', { text: `Battles won: ${this.save.wins} • Food found: ${this.save.foodCount}` }),
        el('div', { class: 'action-row' }, button('Keep playing', 'btn-shop', () => this.closeModal()))));
    }, true);
  }
}
