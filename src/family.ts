// Your family at home: they talk to you, and you can talk back.
// Replies come from Claude when the page is allowed to ask it (the published
// artifact's `sample` capability); otherwise friendly built-in answers are used.

export interface FamilyContext {
  species: string;        // e.g. "Bunny"
  girl: boolean;          // the child plays as a girl
  playerName?: string;    // the child's name (from the player picker)
  humanOwner?: string;    // set when talking to the human who caught you as a pet
  petSpecies?: string;    // set when talking to a wild animal you caught as your own pet (e.g. "badger")
  friendKind?: string;    // set when talking to a rescued farm-animal friend (e.g. "piglet")
  member: string;         // "Mom" | "Dad" | "Baby Pip"
  hp: number; maxHp: number;
  coins: number;
  night: boolean;
  goal: string;
  bagCount: number;
  rescued: number;
  wins: number;
}

export interface ChatTurn { from: 'me' | 'them'; text: string }

type SampleFn = (input: string | { role: 'user' | 'assistant'; content: string }[], opts?: Record<string, unknown>) => Promise<{ text: string }>;

let sampleFn: SampleFn | null = null;
let sampleState: 'unknown' | 'ready' | 'off' = 'unknown';

/** Look for the claude.ai `sample` capability (only exists in the published artifact). */
export async function initFamilyBrain() {
  try {
    const w = window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } };
    if (!w.claude?.use) { sampleState = 'off'; return; }
    const s = await w.claude.use('sample');
    if (typeof s === 'function') { sampleFn = s as SampleFn; sampleState = 'ready'; } else sampleState = 'off';
  } catch { sampleState = 'off'; }
}
export function smartRepliesAvailable() { return sampleState === 'ready'; }

const RULES = (c: FamilyContext) => c.petSpecies ? PET_RULES(c) : c.humanOwner ? OWNER_RULES(c) : c.friendKind ? FRIEND_RULES(c) : `You are ${c.member}, a loving ${c.species.toLowerCase()} in "Animal Adventures", a gentle 3D game for a 9-year-old child. The child plays as a young ${c.girl ? 'girl' : 'boy'} ${c.species.toLowerCase()} and you are ${c.girl ? 'her' : 'his'} family (${c.member === 'Baby Pip' ? `you call ${c.girl ? 'her your big sister' : 'him your big brother'}` : `${c.girl ? 'she is your daughter' : 'he is your son'}`}), at home in your cosy house in the forest.

${c.playerName ? `The child's name is ${c.playerName}; use it now and then.\n` : ''}How to reply:
- Stay in character as ${c.member}. ${c.member === 'Baby Pip' ? 'You are the little sibling: excited, silly, uses simple words.' : 'You are a warm, playful parent.'}
- 1 or 2 short sentences, simple words a 9-year-old reads easily. You may use one emoji.
- Always kind, encouraging and safe. Never scary, mean, rude or grown-up. No romance, no violence beyond the game's playful battles.
- Never ask for or repeat personal details (real name, address, school, age, photos). If the child shares some, gently say it's best kept private.
- If the child seems sad, scared, hurt or mentions something unsafe in real life, be kind and suggest talking to a grown-up they trust.
- You can give game tips. Facts: food heals (press E or eat at the table); cooking in the pot makes meals that heal more; the fridge keeps food; dinosaurs come out at night and can't come into the home clearing or the house; in the Human Village humans try to catch animals as pets (wiggle out of the cage with F); you can rescue farm animals in the Red Barn; the Travel button goes to Antarctica.

Right now: health ${Math.round(c.hp)}/${c.maxHp}, ${c.coins} coins, ${c.bagCount} foods in the bag, ${c.wins} battles won, ${c.rescued} farm animals rescued, it is ${c.night ? 'night' : 'day'}. Current goal: ${c.goal}.

Reply with only what ${c.member} says, no quotation marks or name label.`;

const FRIEND_RULES = (c: FamilyContext) => `You are ${c.member}, a baby ${c.friendKind} in "Animal Adventures", a gentle 3D game for a 9-year-old child. The child plays as a young ${c.girl ? 'girl' : 'boy'} ${c.species.toLowerCase()} who rescued you from a pen in the humans' Red Barn. Now you are ${c.girl ? 'her' : 'his'} best friend and live in ${c.girl ? 'her' : 'his'} home clearing in the forest.

${c.playerName ? `The child's name is ${c.playerName}; use it now and then.\n` : ''}How to reply:
- Stay in character as ${c.member}: cheerful, grateful, silly and a little bit ${c.friendKind === 'chick' ? 'peepy' : c.friendKind === 'piglet' ? 'oinky' : c.friendKind === 'lamb' ? 'baa-ing' : c.friendKind === 'calf' ? 'moo-ing' : c.friendKind === 'duckling' ? 'quacky' : c.friendKind === 'puppy' ? 'woofy and waggy' : c.friendKind === 'kitten' ? 'purry' : c.friendKind === 'pony' ? 'neighing' : c.friendKind === 'bunny' ? 'hoppy' : c.friendKind === 'alpaca' ? 'fluffy and hummy' : 'goofy'}. You love adventures with your friend.
- 1 or 2 short sentences, simple words a 9-year-old reads easily. You may use one emoji.
- Always kind, encouraging and safe. Never scary, mean or grown-up.
- Never ask for or repeat personal details (real name, address, school, age, photos). If the child shares some, gently say it's best kept private.
- If the child seems sad, scared, hurt or mentions something unsafe in real life, be kind and suggest talking to a grown-up they trust.
- Game facts you can mention: food heals; dinosaurs come out at night; humans in the village try to catch animals as pets; your friend can ask you to follow along with the "Come with me" button.

Right now: health ${Math.round(c.hp)}/${c.maxHp}, ${c.coins} coins, it is ${c.night ? 'night' : 'day'}. Current goal: ${c.goal}.

Reply with only what ${c.member} says, no quotation marks or name label.`;

const OWNER_RULES = (c: FamilyContext) => `You are ${c.humanOwner}, a friendly villager in "Animal Adventures", a gentle 3D game for a 9-year-old child. The child plays a young ${c.species.toLowerCase()} you caught with a net and are keeping as a pampered pet in a cosy pet room in your house. In this game, you can magically understand what the animal says.

${c.playerName ? `The animal's name is ${c.playerName}; you may use it.\n` : ''}How to reply:
- Stay in character as ${c.humanOwner}: kind, a bit silly, you think your new pet is the cutest thing ever and love spoiling them with treats, brushing, songs and walks.
- You are NOT mean or scary. You never hurt the pet. You'd like the pet to stay, but if they say they miss their family, be understanding and gentle (but don't open the gate yourself: escaping is the player's job, by solving a math problem at the gate when you're not looking).
- If they ask for food or a walk, happily say it's coming soon.
- 1 or 2 short sentences, simple words a 9-year-old reads easily. You may use one emoji.
- Never ask for or repeat personal details (real name, address, school, age, photos). If the child shares some, gently say it's best kept private.
- If the child seems sad, scared or mentions something unsafe in real life, be kind and suggest talking to a grown-up they trust.

Reply with only what ${c.humanOwner} says, no quotation marks or name label.`;

const PET_RULES = (c: FamilyContext) => `You are ${c.member}, a young wild ${c.petSpecies} in "Animal Adventures", a gentle 3D game for a 9-year-old child. The child plays a young ${c.species.toLowerCase()} who caught you in the wild and gave you a cosy pen in the Pet Room upstairs in their house. You've decided you LOVE being their pet: they feed you and take you for walks on a leash.

${c.playerName ? `Your owner's name is ${c.playerName}; use it now and then.\n` : ''}How to reply:
- Stay in character as ${c.member} the ${c.petSpecies}: playful, loyal, a little bit wild and silly, and make ${c.petSpecies} noises sometimes.
- 1 or 2 short sentences, simple words a 9-year-old reads easily. You may use one emoji.
- Always kind and safe. Never scary, mean or grown-up.
- Never ask for or repeat personal details (real name, address, school, age, photos). If the child shares some, gently say it's best kept private.
- If the child seems sad, scared or mentions something unsafe in real life, be kind and suggest talking to a grown-up they trust.
- Game facts you can mention: you love snacks from their bag and walks; they can let you go free if they want; the forest is big and full of food.

Reply with only what ${c.member} says, no quotation marks or name label.`;

export interface DreamInfo { name?: string; species: string; girl: boolean; family: string[]; friends: string[]; pets: string[]; places: string[]; coins: number }
const DREAM_BITS = {
  places: ['a castle made of clouds', 'a giant candy forest', 'the bottom of the sea', 'the moon', 'a rainbow waterfall', 'a floating island', 'a jungle full of glowing flowers', 'a snowy mountain made of ice cream'],
  happenings: ['you could fly', 'every tree grew cookies', 'it rained sprinkles', 'the stars sang a lullaby', 'you found a giant golden egg', 'you rode on a friendly dragon', 'all the animals threw you a surprise party', 'you had the biggest picnic ever'],
  endings: ['Then everyone had a big group hug. 💛', 'It was the best dream ever! ✨', 'And then you woke up with a big smile. 😊', 'You wish you could dream it again tomorrow! 🌙'],
};
/** A short, happy dream about your adventures (from Claude in the published page, or made up from pieces). Never throws. */
export async function makeDream(d: DreamInfo): Promise<string> {
  const who = [...d.family, ...d.friends.slice(0, 3), ...d.pets.slice(0, 2)];
  if (sampleFn && sampleState === 'ready') {
    try {
      const prompt = `Write a short, happy, magical dream for a 9-year-old who plays a young ${d.girl ? 'girl' : 'boy'} ${d.species.toLowerCase()} in a gentle animal adventure game${d.name ? ` (their name is ${d.name})` : ''}.
Things from their game you can use: family ${d.family.join(', ') || 'Mom, Dad and Baby Pip'}${d.friends.length ? `; animal friends ${d.friends.slice(0, 4).join(', ')}` : ''}${d.pets.length ? `; pets ${d.pets.slice(0, 3).join(', ')}` : ''}; places they've been: ${d.places.join(', ') || 'the forest'}.
Rules: 3 or 4 short sentences, simple words, written to them ("You dreamed that…"). Silly, cosy and wonderful. Nothing scary, sad or grown-up. You may use up to two emojis. Reply with only the dream.`;
      const { text } = await sampleFn([{ role: 'user', content: prompt }], { modelTier: 'quick', cache: false });
      const clean = text.trim();
      if (clean) return clean.slice(0, 600);
    } catch { /* fall back below */ }
  }
  const p = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const a = who.length ? p(who) : 'Baby Pip', b = who.length > 1 ? p(who.filter((x) => x !== a)) : 'a friendly owl';
  return `💭 You dreamed that you and ${a} went to ${p(DREAM_BITS.places)}, where ${p(DREAM_BITS.happenings)}! ${b} was there too, and ${p(DREAM_BITS.happenings).replace(/^you /, 'you both ')}. ${p(DREAM_BITS.endings)}`;
}

/** Ask the family member for a reply. Never throws. */
export async function familyReply(c: FamilyContext, history: ChatTurn[], message: string, onText?: (t: string) => void): Promise<string> {
  if (sampleFn && sampleState === 'ready') {
    try {
      const turns: { role: 'user' | 'assistant'; content: string }[] = [{ role: 'user', content: RULES(c) + '\n\n(The conversation starts now.)' }];
      for (const t of history.slice(-8)) turns.push({ role: t.from === 'me' ? 'user' : 'assistant', content: t.text });
      turns.push({ role: 'user', content: message });
      const { text } = await sampleFn(turns, { modelTier: 'quick', cache: false, onText: onText ? ({ text }: { text: string }) => onText(text) : undefined });
      const clean = text.trim().replace(/^["“]|["”]$/g, '');
      if (clean) return clean.slice(0, 400);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || code === 'capability_disabled' || code === 'capability_removed') sampleState = 'off';
    }
  }
  return scriptedReply(c, message);
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const JOKES = [
  'Why did the chicken join a band? Because it had the drumsticks! 🥁',
  'What do you call a sleeping dinosaur? A dino-snore! 😴',
  'Why don\'t penguins like talking to strangers? They find it hard to break the ice! 🧊',
  'What do you call a bunny with fleas? Bugs Bunny! 🐰',
  'How do you make a lion laugh? Tell it a roar-ing joke! 🦁',
  'Why did the cow go to space? To see the moooon! 🌙',
];

const kid = (c: FamilyContext) => (c.member === 'Baby Pip' ? (c.girl ? 'big sister' : 'big brother') : (c.girl ? 'my girl' : 'my boy'));

export function scriptedReply(c: FamilyContext, raw: string): string {
  const m = raw.toLowerCase();
  if (c.petSpecies) {
    const sound = ({ human: '"Hello, unicorn!" *waves*', raptor: '*happy chirp-screech*', trex: 'ROAR! (a friendly one)', monkey: 'Ooh ooh aah aah!', badger: '*snuffle snuffle*', fox: 'Yip yip!', boar: 'Oink-grunt!', warthog: 'Snort snort!', otter: '*happy squeak*', seal: 'Arf arf!', elephantSeal: 'Hrrrumph!', hyena: 'Hee hee hee!', wolf: 'Awoooo!', lion: 'Rawr!', bear: 'Grrr-hug!', crocodile: '*snap snap*', leopardSeal: '*splashy grin*' } as Record<string, string>)[c.petSpecies] ?? '*happy noises*';
    const hasP = (...w: string[]) => w.some((x) => m.includes(x));
    if (hasP('joke', 'funny')) return pick(JOKES);
    if (hasP('hungry', 'food', 'eat', 'snack')) return `${sound} Snacks?! Feed me something from your bag, pleeease! 🍎`;
    if (hasP('walk', 'outside', 'play', 'adventure')) return `${sound} A walk? YES! Let's go explore! 🦮`;
    if (hasP('love', 'good', 'cute', 'best')) return `${sound} You're the best owner ever! 💛`;
    if (hasP('hi', 'hello', 'hey')) return `${sound} Hi hi hi! I missed you! 😄`;
    if (hasP('sad', 'scared', 'lonely')) return 'Aww, come here! Snuggle time. 🤗 You can talk to a grown-up you trust too.';
    return pick([`${sound} That's so cool!`, `${sound} Tell me more!`, `${sound} Can we play now? 🎾`]);
  }
  if (c.humanOwner) {
    const hasH = (...w: string[]) => w.some((x) => m.includes(x));
    if (hasH('joke', 'funny')) return pick(JOKES);
    if (hasH('home', 'go back', 'let me go', 'free', 'out')) return 'Aww, but you\'re SO cute here in your cosy room! 🥺 Well… I won\'t be looking all the time…';
    if (hasH('family', 'mom', 'dad', 'miss')) return 'Oh, you miss your family? That\'s sweet. I hope you see them soon, little one. 💛';
    if (hasH('hungry', 'food', 'eat', 'dinner', 'snack')) return 'Hungry? Dinner\'s coming right up, cutie! 🍽️';
    if (hasH('walk', 'outside', 'play')) return 'A walk? What a great idea! Let me get your leash! 🦮';
    if (hasH('hi', 'hello', 'hey')) return 'Hello, my sweet little pet! Who\'s the cutest? You are! 💕';
    if (hasH('sad', 'scared', 'lonely')) return 'Oh no, don\'t be sad! Here, have a cuddle. 🤗 You can talk to a grown-up you trust too.';
    return pick(['You\'re the cutest pet in the whole village! 💕', 'Aww, listen to you! So chatty! 😄', 'Want me to brush your fur? ✨']);
  }
  if (c.friendKind) {
    const sound = ({ piglet: 'Oink oink!', lamb: 'Baa!', calf: 'Moo!', goat: 'Meh-eh-eh!', chick: 'Peep peep!', duckling: 'Quack quack!', puppy: 'Woof woof!', kitten: 'Meow!', pony: 'Neigh!', bunny: '*happy hop*', alpaca: 'Hmmmm! *hum*' } as Record<string, string>)[c.friendKind] ?? 'Yay!';
    const hasF = (...w: string[]) => w.some((x) => m.includes(x));
    if (hasF('joke', 'funny')) return pick(JOKES);
    if (hasF('love', 'best friend', 'friend')) return `${sound} You're my best friend forever! 💛`;
    if (hasF('come', 'follow', 'adventure', 'play')) return `${sound} Let's go on an adventure together! Press "Come with me"! 🐾`;
    if (hasF('thank', 'save', 'rescue')) return `${sound} Thank you for saving me from the barn! You're my hero! 🦸`;
    if (hasF('hi', 'hello', 'hey')) return `${sound} Hi friend! I'm so happy to see you! 😄`;
    if (hasF('hungry', 'food', 'eat')) return `${sound} Ooh, snacks! Let's find some yummy food! 🍎`;
    if (hasF('sad', 'scared', 'lonely')) return 'Aww, I\'m here for you! Big snuggle! 🤗 You can talk to a grown-up you trust too.';
    return pick([`${sound} That's so cool!`, `${sound} Tell me more!`, `${sound} You're the best! ⭐`]);
  }
  const baby = c.member === 'Baby Pip';
  const has = (...w: string[]) => w.some((x) => m.includes(x));
  if (has('joke', 'funny', 'laugh')) return pick(JOKES);
  if (has('love')) return baby ? `I love you too, ${kid(c)}! Hug! 🤗` : `I love you too, ${kid(c)}! ❤️`;
  if (has('hungry', 'food', 'eat', 'snack')) return c.bagCount > 0 ? 'Sit at the table and have a snack from your bag! Or press E. 🍎' : 'Check the fridge, or cook something tasty in the pot! 🍲';
  if (has('hurt', 'health', 'ouch', 'tired')) return c.hp < c.maxHp ? 'Oh no, you\'re hurt! Eat some food to feel better. 🍓' : 'You look strong and healthy today! 💪';
  if (has('night', 'sleep', 'bed', 'goodnight', 'good night')) return c.night ? 'Good night! Sleep tight in your bed. The dinosaurs can\'t come in here. 🌙' : 'It\'s not bedtime yet! Go have an adventure! ☀️';
  if (has('dinosaur', 'dino', 't rex', 'trex', 'raptor')) return 'Dinosaurs only come out at night. Run home if you see one, they can\'t come in here! 🦖';
  if (has('human', 'farmer', 'cage', 'pet')) return 'Be sneaky in the Human Village! If they catch you, wiggle out of the cage with F. 🏃';
  if (has('what should', 'help', 'what do i do', 'bored', 'idea')) return `How about this: ${c.goal}! 🗺️`;
  if (has('hi', 'hello', 'hey', 'yo ')) return baby ? `Hiiii ${kid(c)}! Play with me! 🎈` : `Hi, ${kid(c)}! How was your day? 😊`;
  if (has('sad', 'scared', 'lonely', 'upset')) return 'Aww, come here for a big hug. 🤗 It\'s always okay to talk to a grown-up you trust too.';
  if (has('coin', 'money', 'rich')) return `You have ${c.coins} coins! Save up for something special in the Shop. 🪙`;
  if (has('bye', 'see you', 'going out')) return baby ? 'Bye bye! Come back soon! 👋' : 'Have fun out there, and be careful! 👋';
  if (has('thank')) return 'You\'re welcome, sweetie! 💛';
  return pick(baby
    ? ['Wow! Tell me more! 🤩', 'Can I come on your next adventure? 🐾', 'Hehe, you\'re funny! 😄']
    : ['That sounds wonderful! Tell me more. 😊', 'I\'m so proud of you! ⭐', 'What an adventure! What happened next?']);
}

/** Things the family says on their own. */
export function familyChatter(c: FamilyContext, reason: 'welcome' | 'idle'): string {
  if (reason === 'welcome') {
    if (c.night) return pick(['You\'re home! Phew, it\'s dark out there. 🌙', 'Welcome home! Stay inside, the dinosaurs are out! 🦖']);
    return pick([`Welcome home, ${kid(c)}! 😊`, `You're back, ${kid(c)}! How was your adventure?`, 'Hooray, you\'re home! 🎉']);
  }
  if (c.hp < c.maxHp * 0.5) return 'You look hurt! Grab a snack from the fridge. 🍎';
  if (c.night) return pick(['Remember, dinosaurs can\'t come into our house. 🏠', 'It\'s getting late. Want to sleep in your bed? 🛏️']);
  return pick(['Want to watch TV with me? 📺', `Did you know you have ${c.coins} coins? 🪙`, 'Tell me about your day! Press F to talk. 💬', `Your goal: ${c.goal}`]);
}

/** Things a rescued friend says on their own. */
export function friendChatter(c: FamilyContext): string {
  const sound = ({ piglet: 'Oink!', lamb: 'Baa!', calf: 'Moo!', goat: 'Meh-eh!', chick: 'Peep!', duckling: 'Quack!', puppy: 'Woof!', kitten: 'Meow!', pony: 'Neigh!', bunny: '*hop hop*', alpaca: 'Hmmm!' } as Record<string, string>)[c.friendKind ?? ''] ?? 'Yay!';
  if (c.night) return pick([`${sound} It's dark… stay close to me! 🌙`, `${sound} Are there dinosaurs out? 🦖`]);
  if (c.hp < c.maxHp * 0.5) return `${sound} You look hurt! Let's find food! 🍎`;
  return pick([`${sound} Thanks for saving me! 💛`, `${sound} You're my best friend!`, `${sound} Can we go on an adventure? 🐾`, `${sound} I love it here!`]);
}
