# Assets and licenses

## Art and sound

Animal Adventures contains **no third-party image, model or audio files**.

| Asset | Source |
| --- | --- |
| Animal models (chicken, penguin, bunny, fox, wolf, lion, badger, boar, warthog, hyena, otter, crocodile) | Built in code from primitive shapes (`src/animals.ts`) |
| Fur, feather, scale, bark, plank, roof, stone, rock and ground textures | Drawn at runtime on HTML canvas (`src/textures.ts`) |
| Trees, grass, ferns, reeds, rocks, landmarks, homes, food, coins | Built in code (`src/world.ts`, `src/homes.ts`, `src/pickups.ts`) |
| Sound effects, ambience and music | Synthesised at runtime with the Web Audio API (`src/audio.ts`) |

All of these were written for this project and carry no attribution requirement.

## Code libraries

| Library | Version | License | Use |
| --- | --- | --- | --- |
| [three](https://github.com/mrdoob/three.js) | 0.187 | MIT | 3D rendering (bundled into the build) |
| [vite](https://github.com/vitejs/vite) | 6.x | MIT | Development server and bundler (build tool only) |
| [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile) | 2.x | MIT | Optional single-file build (build tool only) |
| [typescript](https://github.com/microsoft/TypeScript) | 7.x | Apache-2.0 | Type checking (build tool only) |

The MIT license requires keeping the Three.js copyright notice with copies of the library. The bundled JavaScript keeps the library's license comment; if you redistribute the game, include this file or the Three.js `LICENSE`.

## Fonts

| Font | License | Use |
| --- | --- | --- |
| [Baloo 2](https://fonts.google.com/specimen/Baloo+2) | SIL Open Font License 1.1 | Headings |
| [Nunito](https://fonts.google.com/specimen/Nunito) | SIL Open Font License 1.1 | Body text |

Both load from Google Fonts at runtime. If they can't load (for example offline), the game falls back to system fonts and still works.

## Emoji

The interface uses the operating system's own emoji font (for example 🐔 🛒 ❤️). No emoji images are bundled.
