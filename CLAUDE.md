# Animal Adventures: working notes

A kid-designed 3D browser game (Three.js + TypeScript + Vite). Keep everything kid-friendly.

## After every feature or fix
1. Type-check: `npx tsc -p .`
2. Test in the real game (Playwright against `npx vite --port 5173`, `?quality=low`), with screenshots for anything visual.
3. Update `README.md` (what changed, in plain words) and add rows to `VERIFICATION.md`.
4. Build the single file: `npm run build:single` → `dist-single/animal-adventures.html`.
5. Republish the claude.ai artifact from that file (same URL).
6. Commit and push to GitHub (`origin main`, public repo `behroozkhorashadi/animal-adventures`).

## Privacy
This repo is public. Never commit the children's real names (or any other personal details).
Use "Player 1", "the designer", "a brother or sister" in code, comments and docs.
