# Animal Adventures

A 3D animal adventure for the browser, designed together with a young game designer. Pick a chicken, penguin or bunny, explore a forest, a savanna and a swamp, collect food, win friendly animal battles, and spend coins on new animals, skins and bigger homes.

Built with [Three.js](https://threejs.org/) and TypeScript, bundled with Vite. Every model, texture and sound is generated in code, so there are no image or audio files to download.

## Run it

You need [Node.js](https://nodejs.org/) 18 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open the address it prints (usually http://localhost:5173) in Chrome, Edge, Firefox or Safari.

### Build for sharing

```bash
npm run build
```

This writes a normal static site to `dist/`. Host that folder anywhere, or test it with `npm run preview`.

```bash
npm run build:single
```

This writes the whole game as one self-contained file, `dist-single/index.html`, that you can open by double-clicking. It also writes `dist-single/animal-adventures.html`, the same page without its outer `<html>` wrapper, for embedding.

## Controls

| Input | Action |
| --- | --- |
| Arrow keys | Move (relative to where the camera looks) |
| Space | Jump (one jump per landing). Jump into coins to collect them. |
| 1 | Scratch (quick, short cooldown) |
| 2 | Bite (stronger, slower) |
| 3 | Special move, when the meter is full and your animal glows |
| Click and drag | Orbit the camera |
| Two-finger scroll (or pinch) | Zoom |
| 0 | Jump attack: leap up and pounce on the animal in front (or slam down if you're already in the air) |
| E | Eat a snack from your bag (heals you) |
| A | Use the thing you're next to (door, bed, fridge, cooking pot) |
| F | Talk to the family member, friend or pet next to you |
| L | Close the door of your house |
| T | Throw a ball for your pet to fetch (in its habitat or on a walk) |
| G | Play a game with your pet (in its habitat) |
| K | Keep the wild horse you're riding as your pet |
| M | Grab eggs from a pet chicken's nest |
| P | Pet one of your pets or friends (or catch a fish while swimming in the Fish Lagoon) |
| B | Open your bag |
| C | Put the camera back behind the animal (it also swings behind on its own as you walk; turn this off in Menu → Controls) |
| Esc | Pause, or close a menu |
| Shop button | Open the shop |
| 🧭 Travel button | Jump straight to Home, the Savanna, the Swamp (once open) or Antarctica |

## How the game works

1. Choose a free starter: the chicken floats down slowly, the penguin moves faster through swamp water and mud, and the bunny jumps higher.
2. A short tutorial teaches four things: walk to the glowing ring, grab berries and jump into the coin, win a practice battle, and open the Shop.
3. Food and victories make a floating coin appear above your animal. Coins count only when you jump into them. Rare food (glowing gold) is worth 8 coins, common food 2.
4. Opponents show their name, a health bar and a **Weaker / Similar / Stronger** label (with an icon, not just colour). They are peaceful until you attack them. Strong animals growl a warning if you stand too close and only attack if you stay.
5. Every hit you land adds 10 to the special meter. At 100 your animal glows: press 3 for a pounce that does three times bite damage.
6. Losing a battle or falling into a pit costs 3 coins (never below zero) and sends you back to the forest clearing.
7. Open the Savanna (find 10 food and win 3 battles), then the Swamp (visit the Savanna and win 6 battles). Gate signs show your progress.
8. Spend coins in the Shop on animals (fox, wolf, lion unlock with battle wins), skins (looks only), and homes. Switch animals at home with the **Animals** button; your health percentage carries over so switching never heals you for free.
9. Press **🧭 Travel** to go somewhere instantly. **Antarctica** is a snowy island you can only reach this way, with a penguin colony, seals to battle, fish and krill to collect, and an Iceberg Hop over icy water.
10. Food you pick up also goes into your **🎒 Bag** (up to 30 items). Eat it from the bag, or press **E**, to get health back: +15 for common food, +40 for rare golden food. **Health never refills by itself; eating is the only way to heal.** (You do come back at full health after being sent home.)
11. **Cooking:** put 2 or 3 foods in a cooking pot (on the campfire in your home clearing, or the stove in your house) to make Fish Soup, Veggie Stew, Berry Jam, Hearty Stew or a Golden Feast. Meals heal much more than plain food.
12. **Your house:** walk up to your home and press the **🚪 Open the door** button (or F). Walk in, and press **L** to close the door. Inside there's a **bed** (sleep until morning), a **fridge** (no size limit) and a **stove** with a cooking pot. The room gets bigger with each home upgrade.
13. **Night dinosaurs:** when night comes, raptors and a T. rex come out in the forest, savanna and swamp and hunt you. One bite sends you home (−3 coins), but they roar and crouch before biting, so run or jump. They never come into your home clearing or your house, and they run away in the morning. Very brave players can beat one for 30–50 coins.
14. **Cosy house:** sit on the **couch** to watch the TV, or sit on the **chair** at the table to open your bag and eat (press F; press F or an arrow key to get up). At night the house is dark until you walk to a **lamp** and press F to turn the lamps on. The fridge has no size limit, and **📦 Unpack my whole bag** moves all your food into it at once.
15. **Farm rescue:** in the Human Village, walk up to the Red Barn and press **F** to open its big doors (the creak makes nearby humans come running!) and **L** to close them. Inside, 5 baby animals are locked in pens, picked from 11 kinds (piglet, lamb, calf, goat, chick, duckling, puppy, kitten, pony, baby bunny, baby alpaca), so the barn looks different every visit. Press F at a gate to rescue one: +10 coins, and it goes to live in your home clearing.
16. **Human houses:** every human home looks different (Rosa's thatched cottage, Sam's tower bakery, Lee's A-frame cabin, Pat's windmill with turning sails, Max's modern house and Joe's farmhouse), with its own colours and decorations inside. They can all be opened with **F** and closed with **L**. Inside: bed, couch and TV, chair, lamps, stove, and a fridge you can raid for the humans' food once per day.
17. **Caught = pet:** if a human catches you, they carry you to their house and lock you in a pet cage. Press F fast to wiggle free, then sneak to the door and escape. The human is inside too; if they catch you again it's back in the cage. You can't Travel while you're a pet.
18. **You're a girl 👧:** your animal wears a pink bow and your family calls you "my girl" (Baby Pip calls you "big sister"). Change it any time in the 🐾 Animals panel (Girl / Boy, bow on / off).
18c. **Nightlights:** every bed has its own nightlight (a pink moon by yours, a purple star for Mom, a blue star for Dad). They switch on by themselves at night and off in the morning.
18b. **Bedrooms:** behind the living room are **Mom's Room** and **Dad's Room**, each with its own bed and lamp. At night Mom and Dad go to bed and **Baby Pip sleeps in your bed** with you; in the morning everyone gets up.
**Math problems:** to open the farm pens, escape from your pet room, or free a caught friend, pick the right answer to a math problem (adding, taking away, times tables). In the barn, three wrong answers make so much noise that Farmer Lee comes!
**Rescue map:** when friends are caught, a 🗺️ Rescue map button shows which human house each one is in (they also show on the mini-map).
**Talk to humans:** while you're someone's pet, press 💬 Talk to chat with your owner. Ask for dinner or a walk and they'll do it soon.
**They start talking too:** now and then your family or friends say something to you first; press 💬 Reply to answer.
**Your own pets:** walk up to a wild animal that's smaller than you and press A to catch it. It lives in your **Magic Zoo**. Visit it to feed it from your bag, take it for a walk on a leash, talk to it, name it, or let it go free.
**More skins:** every animal has 3 new skins (like Bubblegum Pink, Galaxy, Tiger Stripes and Starry Night).
**Bigger world:** the forest goes much further south, and the savanna and swamp are wider, with lots more food and animals. Each rescued friend's house is somewhere in the forest (look for their emoji on the mini-map).
**Animals pick fights:** sometimes a wild animal decides to fight you. Wild animals also fight each other, so you can watch.
**Mode 2:** in Menu, switch to ⚡ Mode 2. Animals are faster and tougher, and so are you.
**Night monsters everywhere:** dinosaurs also roam the Human Village at night (the humans are asleep), and in Antarctica ice monsters climb out of the water.
**Fish Lagoon:** in Antarctica, penguins can jump into the lagoon and swim. Swim up to a fish and press **P** to catch it (golden fish are rare!).
**Sounds:** the toilet really flushes, the bath splashes, the toothbrush brushes and the toys squeak.
**Friends' doors:** your friends close their front doors when they go to sleep at night and open them in the morning. You can open or close a friend's door yourself with F (or close it with L).
**Walking home:** "Everyone, go home" makes followers walk away home where you can see them.
**14 animals to play:** besides the chicken, penguin, bunny, fox, wolf and lion, you can unlock a 🐱 Cat, 🐶 Dog, 🦦 Otter (swims and fishes in the Fish Lagoon too), 🐴 Horse (the fastest), 🐼 Panda, 🐻 Bear, 🐯 Tiger and 🦄 Unicorn (super fast, super jumpy, floats down gently). Each has 3 skins. The Shop's Skins tab shows the skins for the animal you're playing; switch animals in 🐾 Animals to see other skins.
**Animals like you:** wild bunnies, chickens, cats, dogs, pandas, horses, tigers and penguins live out in the world too.
**Talk to your pets:** visit a pet in the Magic Zoo (or walk up to it on a walk) and press F or 💬 Talk. Tell it "follow me", "go home" or "do a trick!".
**Secret places:** 25 hidden doors, 5 in each area. Each door's secret map 📜 (with a purple glow) is hidden nearby; find it and the door shows as ❓ on your mini-map. Solve 3 math problems in a row to open it, then step inside a secret room (a mossy hideout, sunstone ruins, a sunken temple, a hidden cellar or a crystal ice cave) and open the treasure chest for rare food and 40 coins.
**Eggs:** a chicken you keep as a pet lays eggs (up to 3) in a straw nest inside her zoo habitat, by the door. Walk to the nest and press **M** to grab them.
**Name your pets:** visit a pet in the Magic Zoo and type a new name in the ✏️ Name box.
**Pet your pets:** press P next to a pet or friend to give it a pat.
**Jungle Island 🏝️:** travel there for a sunny beach (palm trees, coconuts, waves, crabs and sea turtles) and a thick jungle with giant trees, vines, a waterfall and pool, parrots, and lots of monkeys (some swing upside down from vines). Climb the log steps up to the **treetop walkways** and cross the rope bridges high above the ground; there's a golden mango up there. New food: bananas, coconuts and pineapples. It has its own treasure map and 5 secret places.
**Dreams:** when you sleep in a bed you have a dream about your family, friends and pets.
**Teamwork:** family, friends and pets who are following you join in when you fight, and help you win.
**Dinosaurs hunt too:** at night dinosaurs also chase the other animals.
**Real pandas:** pandas now have black ears, eye patches, legs and shoulders.
**Magic Zoo ✨:** the tiny purple hut in your home clearing is magic: step inside and it's a HUGE zoo with your name on the welcome arch, a fountain, lampposts and 20 big glass habitats (forest, savanna, swamp, snowy or jungle, matching each animal). Every pet you catch (up to 20) lives there and roams its habitat. Walk up to a habitat to visit, feed, walk, name or talk to that pet.
**F to talk:** press F next to family, friends or pets to chat (A does everything else).
**Play in the habitats:** in the Magic Zoo, open a habitat's glass door (A) and walk in; your pet trots over to say hi. Press **T** to throw a ball and it runs to fetch it and brings it back (fetch also works with a pet on a walk). The habitats are full of trees, logs, ponds, tall grass, ice, vines and a painted scene on the back wall.
**Dinosaur pets:** beat a dinosaur and choose: keep it as a pet (it lives in a jungle habitat in your zoo) or take the coins.
**Lionesses:** lionesses have no mane, like real ones (only male lions do), and stay that way if you catch one.
**Play as a human 🧒:** unlock the Human in the Shop (win 4 battles). Girls have long hair and a skirt, boys short hair; 3 outfits. Village humans don't chase you while you're a human, and your family is a human family.
**Ride horses 🐴:** as a human, press A next to a wild horse (or your pet horse on a walk) to climb on and gallop fast; A again to get off. Press K while riding a wild horse to keep it as your pet.
**Catch horses:** unicorns and humans can catch horses as pets, even though horses are big.
**Zoo layout:** your pets fill the habitats on your right as you walk in (nearest the entrance first); empty habitats are on the left.
**Pet games:** in a pet's habitat press G (or the 🎮 button): Fetch, Tag (chase it before time runs out), Hide and Seek (close your eyes, then find it) or a Dance Party.
**Unicorn magic:** as a unicorn, walk up to a village human and press A to catch them as your pet (they live in a garden habitat in your zoo; let them go free and they go back to the village).
**Day or night, your choice:** tap the ☀️ Day / 🌙 Night label at the top to switch to nighttime straight away; tap it again for morning.
**Players:** your name is at the top of the screen (👧 Player 1 ▾). Tap it to switch players or add a new one. Every player has their own separate game, so a new player (like a brother or sister) starts from the very beginning while the first player keeps all their progress.
**They listen to you:** in the chat, tell your family or friends "follow me", "go home", "jump", "dance", "spin", "sit", "go to sleep", "wake up" or "come here" and they do it. Press **🎤 Talk** to say it out loud instead of typing (tap again to send).
**Walking beside you:** followers walk next to you, on your left and right, so you can see them.
**Captured together:** if a human catches you, everyone following you is caught too and taken to *different* human houses. Escape, then search the houses: each friend is in a little pen; press F fast at it to let them out (+5 coins). A human chasing you can also grab a friend on their own.
**Your pet room:** when you're caught, you live in a big cosy playpen (soft painted walls, a pet bed, bowls and toys) that you can walk around in. At dinnertime the gate opens: walk to your bowl and press **🍽️ Eat your dinner** (+40). To escape, press F fast at the gate when your owner isn't looking.
**Humans at home:** at night the village humans go to bed, so the village is safe; sneak into a house and they're asleep in bed (raiding the fridge might wake them!). In the day, someone is sometimes at home, so be sneaky.
**Bigger, fuller house:** the upstairs hallway is wider and the bedroom wing is deeper. Every room has more stuff: wardrobes, dressers with mirrors, armchairs, plants, teddy bears, fairy lights, a star mobile over Baby Pip's bed, a moon lamp nightlight, a tea party table, an easel, a rocking horse, a dollhouse, a toy train, a shower curtain and more.
**Sleeping:** animals lie down to sleep (on their side, or snuggled into a ball for birds and bunnies) with their eyes closed.
**Family adventures:** talk to Mom, Dad or Baby Pip and press **🐾 Come with me!** and they follow you outside on adventures. Send them home from the chat or with **🏠 Everyone, go home**.
**Lionesses:** when you play as a girl lion you're a lioness, with no mane, like real lions. Mom and Baby Pip are lionesses too; only Dad has a mane.
**Switch homes:** in the Shop's Homes tab, pick any home you've already bought and press **🏠 Move in here**. Your family moves with you.
18. **Your family:** Mom, Dad and Baby Pip live in your house and are always the same animal you're playing as. They talk in speech bubbles. Walk up to one and press **F** to talk: use quick buttons or type anything. In the published version their answers come from Claude (the viewer is asked once to allow it, and it uses the viewer's Claude account); otherwise they use built-in answers.
**Upstairs:** a stair hall next to the living room leads up to a hallway with three rooms: **My Room 🌸** (your bed, Baby Pip's little bed right next to it, a desk that opens **My Notebook**, paintings, a bookshelf, lamps and nightlights), a **Bathroom 🛁** (bath, potty, sink with mirror) and a **Playroom 🧸**. Use the ⬆️/⬇️ buttons at the stairs to hop up or down in one go. Mom and Dad have their own rooms at the back downstairs.
**Family dinner:** the big table seats the whole family. Sit on your chair, or wait for dinnertime in the afternoon, and Mom, Dad and Baby Pip sit down with you to eat.
**Friends:** rescued animals follow you home and move into **their very own house on Friends' Lane**, next to your home. Each house is built the moment you rescue them, so it's ready when you get back: walls, windows with flower boxes, an open door, a roof and chimney, a bed, food and water bowls, a garden and a mailbox, in colours that match the animal (pink for piglets, blue for ducklings…) and a sign with their name. They play inside and in the garden, visit next door, and sleep in their own bed at night. If a human catches you, any friends following you run back home safely. The **🏠 Everyone, go home** button appears whenever someone is following you. Talk to them with F; ask them to come with you on adventures. Pen gates are locked: mash F to break the lock before Farmer Lee hears you (about 7 seconds) or he takes you as his pet. A new baby animal arrives in an empty pen after a while, so there are always more to save.
**Pet life:** as a captured pet, your owner pats you, feeds you a bowl of dinner (+40 health), gives treats, brushes you, sings, and takes you for **leash walks** (you can't escape from the leash; on walks, jump when they say "Sit!" for a treat). You can only escape from the cage; wiggling is harder, and your owner tells you off if they see you.
19. **Day and night:** a full day and night takes 7 minutes. At night the sky gets dark, stars and the moon come out, and windows light up.
20. **Human Village:** climb over the big hill north of the forest (or use Travel). Humans keep their food there: roast chicken, drumsticks, sandwiches, cheese, hot dogs, apple pie and cake. If a human sees you they shout and chase you with a net or broom. Run (you're faster), jump when the net goes up, or hide in the tall corn. Getting caught sends you home and costs 3 coins. You can't fight humans.
11. Each area hides a rolled-up **treasure map**. Find it and that area's food gets glowing light beams and appears on the round **mini-map** in the corner. The mini-map always shows nearby animals: ▲ red = stronger than you, ● yellow = similar, ▼ green = weaker.
21. Visit the forest, savanna and swamp, win a battle against a lion and buy the Large Animal Lodge to see the celebration. You can keep playing afterwards.

**Pet care (v25):** every pet in the Magic Zoo has three needs: 🍎 Food, 🎾 Play and 🦮 Walks. They slowly go down. When one gets low, a 😢 (sad) or 😠 (angry) face floats above the habitat and the pet mopes or stomps. Feed it, play fetch or a game, pet it, or take it for a walk (riding a horse counts) to make it 😊 happy again. The visit window shows the three bars, a **👗 Dress up** button (bow, top hat, crown, party hat, sunglasses, scarf, flower, cowboy hat) and, for a pet horse when you're a human, a **🐴 Ride** button. Each habitat sign shows the pet's name with its animal type underneath (e.g. "Chomper / 🦖 T. rex").
**Habitat doors:** every door has a **🔴 red button** on one side (lock) and a **🟢 green button** on the other side (unlock); the lit one glows. Stand by a button and press A. A locked door won't open until you press the green button; you must close the door before the red button can lock it. If you walk away and leave the door **open**, the pet sneaks out after a few seconds; if it's closed but **not locked**, a clever pet pushes it open after about 14 seconds. Escaped pets run around the zoo path; walk up and press A to catch them and put them back.
**Pet buttons (top right):** once you have pets, three buttons appear: **🦮 Walk pets** (opens a picker: tap the pets you want, 1, 2, 3 or lots, or use *Everyone* / *All my dinosaurs*; the first is on the leash and the rest trot behind you), **🍎 Feed all** (a free bowl of pet food for everyone) and **🛡️ Protect me** (all your pets come along and gang up on any dinosaur or night monster that comes near you; together they can beat a T. rex, but a dinosaur your pets or family helped beat can't be kept: you only get the coins. To keep a dinosaur as a pet, beat it all by yourself). Needs now drop much more slowly (40–50 minutes from full to empty), pets stay happy down to 35%, and talking to a pet cheers it up too.
**🎉 Play with everyone:** a top button takes you (and every pet) to the **Big Play Room**: a huge rainbow room with a ball pit, slide, trampoline, tunnel, giant blocks and a rainbow. Press T to throw the ball and everyone races for it (the winner brings it back), P to pet, F to talk. Pets' play and walk needs go up while you're there. Walk to the glowing door (or tap the button again) to leave.
**Play Room toys:** 🛝 press A at the bottom of the slide's ladder to climb up and whoosh down (two pets follow you); 🟡 walk into the ball pit to sink in and push the balls around; 🤸 step on the trampoline to bounce (hold Space for extra-high bounces).
**Play Room games:** press G (or the button) for Fetch, **Tag** (tag every pet in 45 s), **Hide and Seek** (close your eyes while everyone hides behind the slide, in the ball pit, in the tunnel… find them all) and **Dance Party** (everyone dances in a circle around you).
**🧗 Climbing wall:** press A at the rock wall on the left side of the Play Room. Tap a rock, then press **✋ Hand** or **🦶 Foot**: your closest hand (or foot) moves onto that rock if it can reach. Feet can't go higher than your body, and hands can't reach too far. Get a hand onto the top row to ring the 🔔 bell (+5 coins). Two pets climb beside you, and you can see your own animal climbing up the wall, nose up, paws on the rocks.
**More clothes:** the Dress-up window now has two parts. **👕 Clothes:** T-shirt, stripy sweater, raincoat, pink dress, tutu, hero cape, princess cape, backpack, collar with a tag, bow tie, star pajamas. **🎩 On its head:** bow, top hat, crown, party hat, sunglasses, scarf, flower, cowboy hat, beanie, wizard hat, pirate hat, tiara. Pets wear both everywhere: in the zoo, on walks and in the Play Room.
**Everyone can swim:** every animal can now jump into the water and swim: the icy sea around Antarctica, the Fish Lagoon, the Iceberg Hop pool, the jungle sea and the jungle waterfall pool. Penguins and otters are still the fastest swimmers. Space dives, Z comes up, P catches fish.
**Ice monsters:** 6 of them now (was 2). They start deep under the water and rise up out of it with a big splash, then climb onto the ice.
**🪙 Send coins:** tap your coins (top right) or use "🪙 Send coins" in the Who's-playing window. Pick a player (e.g. Player 2), pick how many coins, and press Send. They get the coins (with a "Player 1 sent you 10 coins!" message) the next time they play. This works between players on the same computer or tablet.
**Dinosaurs fight back:** hitting a dinosaur makes it fight you, even near your home (it won't give up for 10 seconds after each hit), and it keeps its injuries. Their bites now hurt (raptor 22, T. rex 34) instead of sending you home in one bite, so you can win a real fight.
**Tag (new rules):** you start as IT. Tag a pet and *it* becomes IT (a red "IT!" sign floats over it), and everyone runs from it. Whoever IT catches becomes IT, including you. After 60 seconds, if a pet is IT, you win.
**Grumpier pets:** needs now drop from full to empty in about 8–10 minutes, and pets get sad below 55% and angry below 30%.
**🐠 Aquarium:** while swimming in the sea (Antarctica or the Jungle) you meet sea creatures: whales, narwhals (the unicorns of the sea!), dolphins, sea turtles, octopuses, clownfish, jellyfish, seahorses, friendly sharks and starfish. Swim up close and press A to make friends; they move into your **Aquarium** (up to 15). Open it with the **🐠 Aquarium** button: a big dark-blue room with a huge glass tank, sand, rocks, coral, seaweed, a treasure chest and bubbles. Walk up to the tank to feed your sea pets or let them go free.
**More homes:** three new expensive homes in the Shop: **Treehouse Mansion** (1000 coins: the lodge plus a giant tree with a treehouse and rope ladder), **Crystal Castle** (2500: four towers, flags and glowing crystals) and **Rainbow Palace** (5000: golden domes, a rainbow and a fountain).
**Runaway pets:** an escaped pet that isn't caught within about 12 seconds dashes out of the zoo's magic door and hides somewhere in the **forest**. A message tells you which way it went (north/south/east/west of home); look for the floating 🐾 above it, walk up and press A to bring it home.
**More dinosaurs:** 6 raptors and 3 T. rexes now roam at night (was 3 and 1), and a beaten dinosaur is replaced after 15 seconds instead of 60.
**Diving:** while swimming, hold **Space** to dive down (the screen turns blue and bubbles rise) and hold **Z** to swim back up. Some fish swim deep, so dive to catch them.
**Penguin seas:** penguins and otters can swim in all the icy water in Antarctica, including the open sea past the ice cliffs, and they swim fast. Fish swim near you in the sea; press P to catch them.
**Night button:** the button next to your animal's name says **🌙 Make it Night** (or **☀️ Make it Day**). T. rexes are now slower, with less health and a longer warning before they bite. The "dinosaur is hunting" pop-ups are gone (you still hear the roar).

Progress is saved automatically in this browser (localStorage). **Menu → Reset Save** starts over after a confirmation.

## Changing the balance

All prices, rewards, combat numbers, movement values, unlock rules, skins and home tiers are in [`src/config.ts`](src/config.ts). World placement (food, opponents, landmarks, platforms) is in [`src/layout.ts`](src/layout.ts).

## Project layout

| File | What it does |
| --- | --- |
| `src/config.ts` | All tunable numbers and unlock rules |
| `src/layout.ts` | Hand-placed food, opponents, landmarks and platforms |
| `src/terrain.ts` | Height map, zones, pits and the collision world |
| `src/world.ts` | Terrain mesh, sky, lighting, vegetation, landmarks, gates |
| `src/animals.ts` | Procedural animal models and their animations |
| `src/homes.ts` | The four home buildings |
| `src/pickups.ts` | Food items and floating coin tokens |
| `src/opponents.ts` | Opponent behaviour (wander, warn, telegraph, retreat) |
| `src/camera.ts` | Orbit camera with terrain and tree avoidance |
| `src/audio.ts` | Synthesised sound effects, ambience and music |
| `src/game.ts` | Player control, combat, rewards, progression, Shop and menus |
| `src/save.ts` | Versioned local save |

See [`ASSETS_AND_LICENSES.md`](ASSETS_AND_LICENSES.md) for licensing and [`VERIFICATION.md`](VERIFICATION.md) for what was tested.
