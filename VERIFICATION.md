# Verification report

## How it was tested

- `tsc` type check passes with `strict` on; `npm run build` and `npm run build:single` succeed.
- Three scripted Playwright runs drove the real game in headless Chromium (software WebGL): real key presses for movement, jumping and attacks, plus direct state setup to reach later content quickly. Screenshots were reviewed for every zone, every menu and the shop tabs.
- The single-file build was also loaded inside a plain page wrapper and played with no console errors.

## Acceptance criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| Fresh save offers chicken, penguin or bunny for free | ✅ Pass | Start screen shows three starter cards; choosing one costs 0 coins |
| Arrows follow camera direction; Space jumps; camera orbits and resets without passing through terrain | ✅ Pass | Movement uses the camera's horizontal basis; camera is clamped above terrain and shortens before trunks/rocks; C resets |
| Food spawns a reachable floating reward; coins rise only after jumping into it, once | ✅ Pass | Berries → +2 token at 2.15 m above the ground; coins stayed 0 while standing, became 2 after one jump; token removed on contact |
| Common food earns less than rare; hidden and risky rare food exist | ✅ Pass | 2 vs 8 coins. Hidden: forest clearing, behind the Baobab, behind the Hollow Stump. Risky: Mossy Rock Stack (wolf), Pride Rock (lions), canyon mesa, bog island |
| 1 and 2 attack with distinct cooldowns; hits fill the meter, misses don't; full meter glows; 3 spends it once | ✅ Pass | 0.45 s / 0.9 s cooldowns; +10 per landed hit only; special did 105 = 3 × 35 lion bite and reset the meter to 0 |
| Victory creates one reward; defeat or falling costs exactly 3 coins once, never negative, back to forest start | ✅ Pass | Badger win → one +6 token. Canyon fall: 640 → 637, player back at the clearing. Shared `handleDefeat` guard blocks double penalties; penalty is clamped to the balance |
| Shop enforces prices and unlocks; rapid clicks can't double-buy; purchases survive reload | ✅ Pass | Five rapid clicks on a 50-coin home with 60 coins → 10 coins left, tier 1. Locked animals show requirements. Reload kept starter and coins |
| Skins change appearance only | ✅ Pass | Skins are colour/pattern palettes; combat stats come only from the animal definition |
| Each home tier visibly changes the home; switching animals at home doesn't heal for free | ✅ Pass | Four distinct buildings that grow in size. Fox at 50% → chicken at 50/100. Newly bought animals start at full health |
| Forest, savanna and swamp reachable when requirements are met, each with food, opponents, landmarks and safe routes | ✅ Pass | Gates open from live counters; gate signs show e.g. "Food 7/10 • Battles 2/3". Dirt paths lead from the clearing through each gate, away from opponents and pits |
| Reload preserves progress; reset needs confirmation and returns to starter select | ✅ Pass | Confirmed in test run 2 |
| Child can finish the tutorial from on-screen text; menus pause; returning doesn't attack | ✅ Pass | Four goal steps with key hints. World time stops while any panel is open; held keys are cleared on close and menu key presses are ignored |

## Other spec items

| Item | Status |
| --- | --- |
| Three zones with 3+ landmarks, 5+ food spots, 2+ hidden/risky food, 3+ opponents each | ✅ Forest 5 landmarks / 12 food / 5 opponents; Savanna 4 / 11 / 6; Swamp 4 / 10 / 5 |
| Opponent name, health bar, Weaker/Similar/Stronger label (icon + text) | ✅ |
| Opponents retaliate only after being attacked; strikes are telegraphed with a recovery window | ✅ "!" marker, orange glow and ground ring during a 0.8 s wind-up; jumping dodges the strike |
| Weaker opponents near the clearing | ✅ Practice badger and weak animals nearest the clearing |
| Food respawns after 45 s, opponents after 60 s, out of view where possible | ✅ |
| Coins visible ≥ 30 s, spaced apart, never in trees, pits or out of bounds | ✅ 90 s lifetime, blinks during the last 6 s |
| Health regenerates 8 s after combat; faster at home | ✅ 4 HP/s, 20 HP/s at home |
| Starter abilities: chicken slow fall, penguin mud speed, bunny higher jump | ✅ |
| HUD: health, coins, animal, special meter, Shop, objective, collapsible controls | ✅ |
| Pause menu: Resume, Controls, Sound (mute, music, effects), Reset Save with confirmation | ✅ |
| Saves after purchases, collected coins, progression and respawns; loads into the safe clearing | ✅ |
| Arrow/Space don't scroll the page; game pauses when the tab loses focus | ✅ |
| Loading screen and understandable error message | ✅ Includes a specific message when WebGL is unavailable |
| Completion celebration, then continued play | ✅ Confetti panel with "Keep playing" |

## Not implemented or changed

- **Real-hardware frame rate was not measured.** The test machine has no GPU, so it ran on software rendering at about 5 FPS, which says nothing about a laptop. The game uses instanced vegetation, 256 px textures and bounded entity counts, and it lowers its render resolution automatically if the frame rate drops below about 30 FPS. Please try it on the target laptop.
- **Sound output was not heard.** The audio code ran without errors in tests, but headless browsers have no speakers. Check the volume sliders on a real machine.
- **"Places the player at a safe entry point" when crossing a zone:** the player walks through the gate rather than being moved. Each gate opens onto a flat, opponent-free corridor, which meets the safety goal without a teleport.
- **Strong animals warn before attacking.** The spec says opponents retaliate after being attacked. Strong animals (wolf, lions, crocodiles) also growl and show "!" if you stand very close to them; they only attack if you stay within 4 m for 2.6 s. This makes the risky food spots feel risky without any surprise attacks. Remove it by setting `territorialWarnRadius` to 0 in `src/config.ts`.
- **Defeat clears uncollected battle coins within 25 m.** Food coins nearby are kept so a child doesn't lose food rewards they already earned.
- **Health is not saved between sessions.** Loading always starts at full health in the clearing, as the spec's "load into a safe location" suggests.
- **Art style:** models are smooth primitive-based sculptures with fur, feather and scale textures and natural colours. They aim for "recognisable and somewhat realistic", not photorealism.
- Keyboard and touchpad only. Phones and gamepads are not supported, as the spec targets laptops.

## Update: travel, Antarctica, more animals, treasure maps, follow camera

| Change | Result | Evidence |
| --- | --- | --- |
| 🧭 Travel button and panel | ✅ Pass | Clicked Travel → Antarctica: arrived at the landing (0, 266), zone switched, "New area discovered!". Locked areas show their gate progress. Travel is disabled during a battle |
| Antarctica | ✅ Pass | Snowy island with Research Station, Ice Arch, Penguin Colony (16 penguins), Iceberg Hop (3 icebergs over open water), hidden Ice Hollow; 7 common + 2 rare food; 7 seals (weak Weddell/fur seals, medium elephant seals, strong leopard seals). Penguins move 25% faster on ice |
| More animals | ✅ Pass | 35 opponents in total (was 16): +5 forest including a new strong Brown Bear and a second wolf, +4 savanna including a third lion, +3 swamp, +7 Antarctica |
| Treasure maps | ✅ Pass | Picking up the Antarctica map saved `mapsFound`, showed food dots on the mini-map and light beams over food. One map hidden in each of the four areas |
| Mini-map | ✅ Pass | Rotates with the camera; shows home, gates, animals by strength (shape + colour) and, once that area's map is found, food |
| Camera follows behind | ✅ Pass | Walking turns the camera to stay behind the animal; it pauses for 1.5 s after you drag to look around and never spins when you walk toward the camera. Toggle in Menu → Controls |

## Update: food bag

| Change | Result | Evidence |
| --- | --- | --- |
| Food goes into a 🎒 Bag when collected (coins still spawn as before) | ✅ Pass | Collecting berries → bag `{berries: 1}`; HUD Bag button shows the count |
| Eat from the bag for health (+15 common, +40 rare) | ✅ Pass | Golden Fish at 81/100 → 100/100 and removed from the bag; Eat buttons disabled at full health |
| E key quick-eats | ✅ Pass | At 40/100, E ate one item and the bag count dropped by one |
| Bag is saved | ✅ Pass | Bag contents were the same after reloading the page |

## Update: Human Village, day/night, house interior, cooking, eating-only healing, jump attack, realism

| Change | Result | Evidence |
| --- | --- | --- |
| Human Village over the north hill | ✅ Pass | Walking north from the forest climbs a 6.5 m hill into the village; zone switched to `village`. Farmhouse, Red Barn, Picnic Meadow, Bakery Stall, well, two corn fields, scarecrow; 9 stealable foods (3 rare) and a treasure map |
| Humans chase and catch (no fighting humans) | ✅ Pass | Standing in front of the cook → "Huh?" → chase. Getting caught: 10 → 7 coins, sent to the clearing at full health. Humans move at 5.3 m/s (slower than every animal), lose you in the corn, and give up at 17 m |
| Health only from eating | ✅ Pass | Health stayed at 50/100 after waiting; no home regeneration |
| Day and night | ✅ Pass | 7-minute cycle with sunset colours, night sky, stars, moon, glowing windows; saved |
| House: door button, L to close, inside room | ✅ Pass | "🚪 Open the door" appeared at the door; clicking opened it; walking in moved the player inside; L closed it. Camera stays inside the room |
| Bed | ✅ Pass | At night (0.80) sleeping set the time to morning (0.03) |
| Fridge | ✅ Pass | Moved a carrot from the bag (2 → 1) to the fridge; saved |
| Cooking | ✅ Pass | Fish + Fish + Krill → Fish Soup (+55), added to the bag, ingredients removed |
| Jump attack (0) | ✅ Pass | Leapt at the practice badger: 27 damage (1.5 × bite 18) and +10 special charge |
| Realism pass | ✅ Done | Image-based lighting, idle breathing/looking/blinking, dust and snow puffs, drifting clouds |
| Performance | ⚠️ Not measured on a real laptop | Far-away animals, Antarctica and the house room are no longer drawn when you're not near them (draw calls 1,393 → 771). If the frame rate stays low after resolution scaling, the game switches to fast graphics (no reflections or shadows) automatically. Add `?quality=low` to the address to force it |

## Update: night dinosaurs, cosy house, unlimited fridge

| Change | Result | Evidence |
| --- | --- | --- |
| Dinosaurs at night | ✅ Pass | At nightfall 3 raptors and 1 T. rex appeared 33–49 m away in the player's area. A raptor bite sent the player home with "🦖 A dinosaur got you! −3 coins" (20 → 17). The home clearing counted as safe. All dinosaurs left at dawn. Wind-ups are 0.95 s (raptor) and 1.2 s (T. rex); raptors run 6.1 m/s and the T. rex 5.0 m/s, both slower than every playable animal |
| TV, couch, chair | ✅ Pass | F at the couch sits you down facing the animated TV; tapping an arrow key stands you up. F at the chair sits you down and opens the bag; eating cake took health 40 → 80 |
| Lamps | ✅ Pass | At night the room is dark until F at a lamp turns both lamps on |
| Unlimited fridge + unpack | ✅ Pass | "Unpack my whole bag" moved fish ×5, berries ×3 and cake ×1 into a fridge already holding 120 carrots; the bag became empty |

## Update: farm rescue, human houses, pet capture, talking family

| Change | Result | Evidence |
| --- | --- | --- |
| Barn doors F/L | ✅ Pass | "Open the barn door" at the barn; F opened it, L closed it, F + F went inside |
| Rescue animals | ✅ Pass | F at a pen rescued the Lamb (+10 coin token collected); all 5 rescued → 5 animals wandering the home clearing; saved |
| Human houses F/L | ✅ Pass | "Open the door of Rosa's Cottage"; F opened, L closed, walked in; fridge raid gave Apple Pie + Cheese; the fridge is empty until the next day |
| Caught = pet, escape | ✅ Pass | Caught by Farmer Joe → caged in Joe's Farmhouse; 12 F presses wiggled free; F opened the door; walking out ended captivity |
| Family | ✅ Pass | Mom, Dad and Baby Pip greeted the bunny; "Talk to Mom" chat with a quick-reply joke and a typed message; switching to Fox turned the family into foxes |
| Family answers from Claude | ⚠️ Not testable here | The published page declares the `sample` capability (quick tier, kid-safe instructions, last 8 turns). The local build has no Claude connection, so the built-in answers were tested instead; they are also the fallback whenever Claude isn't allowed or available |

## Update: girl player, bedrooms, bedtime

| Change | Result | Evidence |
| --- | --- | --- |
| Girl player | ✅ Pass | New saves default to girl with a pink bow on the animal's head (all species); Mom greets "Welcome home, my girl!"; Girl/Boy and bow toggles in the Animals panel |
| Bedrooms | ✅ Pass | A bedroom wing behind the living room (doorway in the back wall) with Mom's Room and Dad's Room, each with its own bed, lamp, rug and name sign. Walked through the doorway into the wing |
| Bedtime | ✅ Pass | At night Mom and Dad move to their own beds and Baby Pip to the player's bed, with 💤 bubbles; they return to the living room in the morning |

| Nightlights | ✅ Pass | Purple and blue glows visible in Mom's and Dad's rooms at night; all nightlights switch off in the day |

## Update: upstairs room, friends, harder rescues, pet life

| Change | Result | Evidence |
| --- | --- | --- |
| Stairs and upstairs | ✅ Pass | Walked from the living room through the stair-hall doorway, climbed 12 steps to height 4.2 and stepped into My Room. No upstairs actions appear from downstairs |
| My Room | ✅ Pass | Your bed + Baby Pip's bed side by side (Baby Pip sleeps there at night), desk opens My Notebook (notes saved), 4 paintings, bookshelf, toy box, lamp, nightlights |
| Friends | ✅ Pass | Rescued friends follow you out of the barn and home, then move into the Friends' House; F to chat; "Come with me" / "Go home" |
| Harder rescues | ✅ Pass | 16 fast F presses broke a lock and rescued Penny the Piglet; holding a lock open too long → Farmer Lee caught the player; an empty pen refilled with a new animal |
| Pet life | ✅ Pass | Owner patted the pet (+5); leash walk: tugging can't escape, distance capped at 3.2 m, "Sit!" + jump gave a treat (+15); returned to the cage afterwards |

## Update: family dinners, upstairs rooms, house styles, Friends' Lane, more farm babies, family adventures

| Change | Result | Evidence |
| --- | --- | --- |
| Upstairs rooms | ✅ Pass | ⬆️ Go upstairs button at the bottom of the stairs put the player at height 4.2; Bathroom (bath, sink, potty) and Playroom actions each showed their button and toast; ⬇️ Go downstairs returned to height 0 |
| Family dinner | ✅ Pass | At dinnertime Mom, Dad and Baby Pip switched to `dinner` mode at the big table with plates of food; at the table the button reads "🪑 Sit down and eat" (it used to say "Cook food" because the stove was closer; fixed) |
| Human house styles | ✅ Pass | Village screenshot shows the different house shapes and colours |
| More farm babies | ✅ Pass | Barn started with 5 different kinds out of 11 (lamb, duckling, alpaca, piglet, puppy); refills pick a kind not already in another pen |
| Pet feeding | ✅ Pass | Owner brought a bowl of food; health went 20 → 60 over four bites with "Nom nom" toast |
| Friends go home when caught | ✅ Pass | Two following friends switched to settled and were placed at their own homes after capture; toast "Your friends ran home safe" |
| Friends' Lane | ✅ Pass | 7 rescued friends → 7 separate houses (two rows), each with name sign, colours by animal, bed, bowls, garden, mailbox. At night all 7 were asleep in their own beds |
| Lying down to sleep | ✅ Pass | Sleeping puppy screenshot: on its side on the bed, eyes closed |
| Everyone, go home button | ✅ Pass | Shown while family or friends follow; pressing it sent all three family members and the friend home and hid the button |
| Family follows you | ✅ Pass | Mom, Dad and Baby Pip followed the player outdoors |
| Lioness | ✅ Pass | Girl lion, Mom and Baby Pip have no mane |
| Switch homes | ✅ Pass | With all homes owned, `moveHome(1)` moved the family to the Medium home while the biggest home stayed owned |

## Update: players, talking by voice, listening family, captured friends, cosy pet room, sleeping humans, fuller rooms

| Change | Result | Evidence |
| --- | --- | --- |
| Players | ✅ Pass | Name chip "👧 Player 1 ▾" in the HUD; added "Player 2" (boy) → page reloaded to a fresh start screen saying "Playing as Player 2"; switching back to Player 1 showed "Welcome back!" with the saved bunny. Saves are kept in separate slots (Player 1 keeps the original slot) |
| 🎤 Talk button | ✅ Present | Shown in the family/friend chat when speech-to-text is available (the claude.ai `dictation` capability in the published page, or the browser's own speech recognition locally); hidden otherwise. Real speech couldn't be tested in the headless browser |
| They listen | ✅ Pass | "can you dance?" → friend danced; "Follow me!" → friend followed; "come with me" → Mom followed; ordinary questions still go to the normal chat |
| Followers beside you | ✅ Pass | Followers stand to your left and right, a little behind |
| Captured together | ✅ Pass | Caught by Farmer Joe with 2 friends + Mom following → each went to a different house (Sam's House, Pat's Windmill, Lee's Cabin); minimap says "2 caught by humans! Search the village houses"; opening a pen (F ×8) freed Buddy, who followed again |
| Cosy pet room | ✅ Pass | Big soft playpen with paw-print walls, pet bed, bowls, ball and bone; gate shows "Wiggle the gate open"; at dinner the gate opened, the bowl was outside, "🍽️ Eat your dinner" healed 30 → 70 and you were put back in the pen with the gate closed |
| Humans sleep | ✅ Pass | At night all 4 village humans were hidden (asleep); inside Rosa's Cottage at night her state was `asleep`, lying on the bed under a blanket; raiding the fridge can wake her |
| Wider hallway, fuller rooms | ✅ Pass | Walked the full upstairs hallway; screenshots of My Room, bathroom, playroom, Mom's and Dad's rooms with the new furniture |
| Nightlight in My Room | ✅ Pass | Moon and star nightlights moved above the beds, plus a glowing moon lamp on a bedside table and fairy lights |

## Update: pets of your own, math, bigger world, fights, Mode 2, Fish Lagoon

| Change | Result | Evidence |
| --- | --- | --- |
| Catch a pet | ✅ Pass | Next to a Young Badger (smaller, not stronger) the button read "Catch the Young Badger as a pet"; it became "Pebbles" in the Pet Room |
| Pet Room | ✅ Pass | Upstairs room east of the hallway with 5 pens; "Visit Pebbles" opens Feed / Walk / Let go free; the walk showed a leash and the pet followed outdoors; "Everyone, go home" sent it back to its pen |
| Walking home | ✅ Pass | After "Everyone, go home", Mom, Dad, Baby Pip and Buddy stayed visible and were walking (not vanishing) |
| Math | ✅ Pass | Barn pen opened a math problem; the right answer rescued the duckling. Escape and friend pens use the same problems |
| Bigger world | ✅ Pass | World now x −235…235, z −145…65; 111 food spots and 107 wild animals (was 60-ish); friend houses spread through the forest |
| Fish Lagoon | ✅ Pass | Penguin floated at the surface ("swimming"), button "Catch the fish! (P)"; P put a fish in the bag; other animals are kept out ("too cold") |
| Night monsters | ✅ Pass | In Antarctica at night both ice monsters appeared at the water's edge with a SPLASH warning; dinosaurs now also allowed in the village |
| Fights | ✅ Pass | A Wild Fox picked a fight (aggro → windup); two Warthogs fought each other and the winner was announced |
| Mode 2 | ✅ Pass | Menu toggle, "⚡ Mode 2" chip in the HUD, saved in the player's save |
| Talk to owner | ✅ Pass | "Can we go for a walk?" → "A walk? What a great idea! Let me get your leash!" |
| Rescue map | ✅ Pass | Map of the village with the caught friends' emojis on their houses |
| Realistic farm animals | ✅ Pass | Kitten has big green cat eyes and whiskers; the pony has a long neck and legs, a horse face, a mane and a long tail |
| Friends close their doors | ✅ Pass | Daytime door open; at night Buddy fell asleep and his door closed (blocks the doorway); F opened it, L closed it; in the morning it opened again |
| 14 playable animals | ✅ Pass | Cat, Dog, Otter, Horse, Panda, Bear, Tiger, Unicorn render correctly (unicorn with horn and mane); played as the Unicorn |
| Skins tab | ✅ Pass | Shows only "Skins for your Bunny" while playing the bunny |
| Wild animals like you | ✅ Pass | 28 wild bunnies, chickens, cats, dogs, pandas, horses, tigers and penguins in the world |
| Talk to your pet | ✅ Pass | "Hi Ziggy!" → reply in character; "Do a trick!" → Ziggy hops ("Wheee!") |
| Secret places | ✅ Pass | 25 doors (5 per area); without the map the door says it is locked; picking up the purple map made it "Unlock (3 math problems)"; 3 correct answers opened it; inside the Hollow Oak Hideout (crystals, chest) the chest gave a Golden Apple, a Truffle and 40 coins; "Go back outside" returned to the door |
| Chicken eggs | ✅ Pass | A pet chicken laid an egg (shown in its pen, "Visit Nugget (1 egg!)"); Collect put 1 Fresh Egg in the bag |
| Pet with P | ✅ Pass | P at a pen: "You petted Nugget! It snuggles up to you!" with hearts and a happy hop |
| Name your pets | ✅ Pass | Typed "Sparkles" in the Name box; the pet and its pen sign were renamed |
| Egg nest + M | ✅ Pass | Eggs sit in a nest outside the pen; "Grab 2 eggs from Sparkles's nest (M)"; M put 2 eggs in the bag |
| Jungle Island | ✅ Pass | Travel lands on the beach; palms, crab, turtle, giant trees, waterfall and pool render; standing on a treetop platform (grounded at the walkway height) and walking across a rope bridge works; 22 jungle animals (monkeys, boars, tigers, pandas) + 2 crocodiles |
| Panda | ✅ Pass | White body with black legs, ears, eye patches and shoulder band |
| F to talk | ✅ Pass | F next to a friend opened the chat; A still does everything else |
| Dreams | ✅ Pass | Sleeping showed a dream ("you and Mom went to a rainbow waterfall…") and a Wake up button |
| Helpers fight | ✅ Pass | With the family following, a Wild Fox that picked a fight was beaten (60 → 0 health) |
| Dinos hunt | ✅ Pass | At night a raptor went after a badger ("The Raptor is hunting a Badger!") |
| Magic Zoo | ✅ Pass | Tiny hut by the house → "Enter the Magic Zoo" → huge zoo (arch, path, fountain, 10 glass habitats); 6 pets placed in matching habitats (e.g. Bananas the monkey in Jungle); "Visit Bananas" at the glass; "Go back home" returns to the hut |
| Habitat doors + fetch | ✅ Pass | "Go into Rex's habitat" opened the glass door; inside, T threw the ball and Rex fetched it ("Rex brought the ball back!") |
| Richer habitats | ✅ Pass | Forest, snowy and jungle habitats filled with trees, logs, ponds, rocks, mushrooms, ice, bamboo, vines and a backdrop mural |
| Lionesses | ✅ Pass | Savanna lionesses have no mane next to a maned Lion; caught lionesses stay mane-less |
| Dinosaur pet choice | ✅ Pass | Beating the T. rex offered "Keep it as a pet" / "Just take the 50 coins"; keeping it added Chomper the T. rex; closing the window still gives the coins |
| Pet Room removed | ✅ Pass | No Pet Room upstairs (the hallway ends at the east wall); pets live in the Magic Zoo; a pet chicken's nest is inside her habitat and M grabbed 2 eggs |
| Human player | ✅ Pass | Played as a girl human (long hair, bow, skirt); village humans did not chase |
| Riding | ✅ Pass | "Ride the Wild Horse" (A) mounted; galloped; "Get off the horse" dismounted and the horse came back |
| Catch horses | ✅ Pass | Unicorns and humans may catch horses; as a human, K while riding a wild horse keeps it |
| 20 pets | ✅ Pass | Magic Zoo now has 20 glass habitats; 20 pets placed (20/20), first and last habitats visitable |
| Pets on the right | ✅ Pass | Habitats 1–10 are on the right side as you walk in (nearest the entrance first); 11–20 on the left |
| Pet games | ✅ Pass | G opens Fetch / Tag / Hide and Seek / Dance Party; Tag: "You caught Rex!"; Hide and Seek: "Found you!"; Dance Party finished with "Rex had SO much fun!" |
| Unicorn catches humans | ✅ Pass | As a unicorn, "Catch Cook Rosa with unicorn magic!" made Rosa a pet (gone from the village, in the zoo) |
| Petting button | ✅ Pass | Next to Rex in his habitat the button reads "💕 Pet Rex (P)"; petting makes him face you, close his eyes, wiggle and wag; the visit window also has a Pet button |
| Day/Night button | ✅ Pass | Tapping the "☀️ Day" label switched to night (dark sky, "🌙 Night"); tapping again switched back to day |
| Pet needs and moods | ✅ Pass | A pet with low food showed 😢 and "Luna is sad. It wants some food"; low play showed "Rusty is getting ANGRY!"; feeding Luna gave food 100 and "Luna is happy again!"; the visit window shows Food, Play and Walks bars |
| Ride a pet horse | ✅ Pass | Implemented in the visit window for a human with a pet horse ("🐴 Ride Star"); "🐴 Get off the horse" takes priority in the zoo |
| Night button label | ✅ Pass | Reads "🌙 Make it Night"; after a tap it read "☀️ Make it Day" (time 0.64); another tap went back |
| Penguin sea swimming | ✅ Pass | A penguin walked east off the Antarctic cliffs to x 117, floated at y −0.42 while swimming; 9 sea fish appeared nearby; P caught one (bag fish = 1) |
| Pet type on signs | ✅ Pass | Chomper's habitat sign reads "Chomper" and "🦖 T. rex" underneath |
| Easier T. rex | ✅ Pass | Health 420 → 200, speed 5.0 → 4.2, warning 1.2 s → 1.7 s; the hunting pop-ups are removed |
| Pet escapes and locks | ✅ Pass | Rex's door was left open: "Rex ESCAPED!" and he ran onto the path; Luna's door was closed but unlocked: "Luna pushed the door open — you forgot to lock it!" then she escaped; Chomper's locked door kept him in; catching Rex put him back and closed the door |
| Dress up pets | ✅ Pass | The Dress-up window lists 9 outfits; Rex showed a top hat, then sunglasses after picking them; the outfit is saved |
| Red/green lock buttons | ✅ Pass | Locked door said "Press the green button"; green unlocked it; door opened; red refused while open; after closing, red locked it (open false, locked true); buttons visible beside each door |
| Happier pets | ✅ Pass | Needs decay 3× slower; an existing pet at food 20 / play 10 / walks 30 was topped up to 85/85/85 (happy) once |
| Walk all pets | ✅ Pass | "Walk ALL my pets (6)": walker + 5 in the pack following behind; zoo habitats emptied; Everyone-go-home put all 6 back |
| Feed all | ✅ Pass | All 5 pets went to food 100; "Yum! You gave all 5 pets a big bowl of pet food!" |
| Diving | ✅ Pass | A penguin at the surface (y −0.42) held Space and dived to y −4.26 (blue underwater tint); holding Z brought it back to −0.42 |
| Protect me | ✅ Pass | Away from home at night with 5 pets on Protect: the pets surrounded a T. rex and wore it down from 200 to 0; the keep-or-coins window opened; the player was never hurt |
| Walk picker | ✅ Pass | "Walk pets" opens "Who wants to go for a walk?"; "All my dinosaurs" picked Chomper, Zippy and Stomper (walker 1, pack 2 and 3); picking Rex + Luna walked just those two |
| Solo dino rule | ✅ Pass | When pets helped beat a T. rex, "Keep it as a pet" is disabled with "To keep a dinosaur, you have to beat it ALL BY YOURSELF!"; coins are still given |
| Big Play Room | ✅ Pass | "Play with everyone" took the player and all 7 pets (in their outfits) to the rainbow room; T threw the ball, everyone raced, "Luna won the race and brought the ball back!"; walls keep you in; leaving returns to the zoo and clears the room |
| Runaway pets | ✅ Pass | Rex escaped through an open door, then ran out the magic door: "Rex ran out … into the FOREST! (It went west of your home — look for the 🐾)"; found in the forest wearing his top hat under a 🐾 marker; A: "You FOUND Rex!" and he's back in his habitat |
| More dinosaurs | ✅ Pass | 9 dinosaurs (6 raptors + 3 T. rexes); beaten ones come back after 15 s |
| Slide | ✅ Pass | At the ladder: "🛝 Climb up and go down the slide!"; A climbed to y 3.0 and slid down ("Wheeeeee!"), back on the floor afterwards |
| Ball pit | ✅ Pass | Walking in sinks the player to y −0.45, balls are pushed aside, "Splash! You're in the ball pit!" |
| Trampoline | ✅ Pass | Landing on it bounced the player up to y 3.1 ("BOING!") |
| Play Room games | ✅ Pass | Tag: tagged all 4 → "You did it!"; Hide and Seek: 4 hidden, found all 4 → win; Dance Party: pets dance around you, then win |
| Climbing wall | ✅ Pass | "🧗 Climb the rock wall!" → tap a rock (selected 5) → Hand/Foot moves the closest limb; climbing hand-hand-foot-foot reached the top row: "DING DONG! … +5 coins"; then climbs down. Too-far / foot-too-high moves are refused with a hint |
| More clothes | ✅ Pass | 11 pets wearing sweater+beanie, tutu+tiara, hero cape+crown, princess cape+flower, bow tie+top hat, dress+wizard hat, raincoat+pirate hat, backpack+party hat, pajamas, collar+sunglasses, T-shirt+cowboy hat all render on their bodies |
| Everyone swims | ✅ Pass | As a bunny: swam off the Antarctic cliffs (x 94.7, y −0.42), in the Fish Lagoon, in the jungle waterfall pool (its invisible wall is gone) and in the jungle sea |
| Ice monsters rise from the water | ✅ Pass | 6 ice monsters; a new one starts 3 m under the water (−4.45 → −3.53 → −2.56) with splashes, then climbs out and chases |
| Send coins | ✅ Pass | Player 1 (40 coins) sent 10 to Player 2 → Player 1 has 30; switching to Player 2 showed "🎁 Player 1 sent you 10 coins!" and Player 2 had 10 |
| Climbing looks real | ✅ Pass | Halfway up, the player's animal is at y 2.93 on the wall, tilted nose-up; at the top it rings the bell (before it stayed on the floor). The slide also shows the animal going up and down now |
| Dinosaurs fight back | ✅ Pass | Near home (safe zone) and in the forest: biting a T. rex took it 200 → 182 → 128 → 74 → 20 → defeated; it struck back (player 100 → 66 → 32) and the keep-or-coins window opened |
| Tag with IT | ✅ Pass | You start IT; tagging Rex: "Rex is IT! Everybody RUN!"; IT then passed Rex → Rusty → Luna as they caught each other |
| Aquarium | ✅ Pass | Swimming in the Antarctic sea showed a whale, dolphin and turtle; "💙 Make friends with the Whale 🐋" added Bubbles the Whale; the Aquarium shows all 11 creature types swimming in the big tank; "Visit your sea pets" lists them with Feed / Let go free |
| New homes | ✅ Pass | Bought Treehouse Mansion (1000), Crystal Castle (2500) and Rainbow Palace (5000); each appears at your home site |
| Bigger Aquarium + home tanks | ✅ Pass | Room 88 × 88 m, big tank 34 × 34 m; the two buttons show only inside the Aquarium (pet buttons hide); "Everyone, go to your own tank" built 12 tanks sized by animal (whale 13 × 9 × 7.5, narwhal 9.4 × 7.1, dolphin 6.7 × 5.3, shark 7.6 × 5.9, clownfish 3.2 × 3.0 …), back wall first then the side wall, each with a themed decor and name sign; "go to the big tank" moved everyone back; near a home tank the action reads "Visit shark8" |
| Swim in the big tank | ✅ Pass | "🤿 Jump into the big tank and swim!" put the player in the water (y 7.5, swimming); Space dived; 8 sea pets circled around; T threw a ball → "Inky won the race and brought the ball back!"; next to a pet the action reads "💙 Pet Finn (P)"; P pets in the tank (not fish-catching) |
| Sea creature players | ✅ Pass | Bought Dolphin and Whale; as a Dolphin the rig is a sea creature in a magic bubble on land (bubble visible), and in the Antarctic sea the bubble hides and it swims fast |
