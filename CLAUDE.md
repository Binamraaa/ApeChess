# ApeChess

A chess tutor that teaches the reasoning behind moves, for adults who are smart but weak at chess, and later for school kids. It's an open-source, offline-first PWA. The mascot is **Bapu**, an ape in a suit, tie and spectacles, and his job is to explain *why* a move works. Explaining the why is what sets ApeChess apart from beginner-only chess apps. Never describe it as "Duolingo for chess" or by reference to a competitor.

Owner: Binamra Bhusal. The goals are (1) learn chess himself, (2) a future curriculum for schools in Nepal, and (3) a portfolio project.

## Key docs
- `docs/curriculum-mvp.md`: **source of truth for what to build**: 20 levels, level anatomy, stars, puzzle sources
- `Phase1_Docs.md`: original long-term vision (150 levels). Its tech stack (Kivy/Django) is **superseded** by the stack below.
- `abu.png`: **Bapu's master artwork** (see Design below)
- `figma_ss.PNG`: old Phase 2 Figma wireframes. **Outdated**, not a design reference.

## Stack (decided)
- Vite + React + TypeScript, `vite-plugin-pwa` (installable, works fully offline)
- `chess.js` for rules and move validation
- `chessground` for the board UI (Lichess's board)
- Stockfish WASM (single-threaded "lite" build, so no COOP/COEP headers are needed) in a Web Worker, used only for engine levels and refutations
- IndexedDB (via `idb` or Dexie) for progress: stars, XP, streak. No backend and no accounts in the MVP.
- Vitest for unit tests

## License
`chessground` and Stockfish are GPL-3.0, so the project is **GPL-3.0**. Don't add MIT-only claims, and don't pull in libraries whose licenses are incompatible with GPL-3.0.

## Content pipeline
- Puzzles come from the Lichess puzzle DB (CC0): https://database.lichess.org/#puzzles
- CSV columns: `PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags`
- **Gotcha:** `FEN` is the position *before* the opponent's move. `Moves[0]` is the opponent's move, which you animate first. The solver plays `Moves[1]`, `Moves[3]`, and so on. Moves are UCI.
- `scripts/build-puzzles.ts` filters the CSV by theme, rating, popularity (> 80) and NbPlays (> 500) into small packs: `content/puzzles/L08.json` and so on, about 40 per level so practice sets can rotate.
- Never commit the raw CSV, because it's huge. Add `data/raw/` to `.gitignore`.
- Hand-authored levels and featured explanations live in `content/levels/LXX.json`.

## Suggested layout
```
src/
  board/      chessground wrapper, move input, arrows/highlights
  engine/     stockfish worker + typed API
  levels/     level runner (concept → demo → guided → practice → summary)
  bapu/       explanation templates + speech bubble UI
  progress/   IndexedDB store, stars, XP, streak
content/levels/ content/puzzles/ scripts/ docs/
```

## Design (from existing assets)
- **Bapu (`abu.png`)**: a chimp in a dark brown suit, white shirt, rust-brown tie and thick black glasses. The style is a vintage hand-drawn illustration with grain, on a cream background. The source file is 3.3 MB 1024×1536, so export WebP variants (about 512 px and 256 px, plus a circular head crop for the avatar slot) into `public/bapu/`. Keep the original as the master. Bapu stays in this style, not cartoonish.
- **Palette** (a starting point taken from the art): cream background (~#F3E3C8 / off-white #F7F7F7), dark brown text (~#3B2F27), rust accent (~#7A3B1E), pale amber primary button (~#F9DFA0), deep teal bottom nav (~#006060). Put these in CSS variables so they can be tuned.
- **UI direction**: the old Figma is outdated, so the UI is free to be creative. It must appeal to **both kids and adults**: playful and warm, never babyish. Bapu's vintage art style anchors the look.
- **Level map**: a simple path is fine for now, but it must eventually scale to 100+ levels (Phase 1 vision), so don't lock in a layout that only works for 20.

## Conventions
- Mobile-first: design at 393×852 and make sure it still works at 360px wide. Touch-friendly board.
- Keep the level logic pure and testable (no React in `levels/` core). Unit-test move checking and star scoring.
- Bapu's copy is warm, witty and short (1–3 sentences). Define any jargon the first time it appears.
- Build vertically: make one level fully playable end to end before going wide.

## Open-source housekeeping (from Phase 1 plan)
- Add CONTRIBUTING.md, GitHub issue templates (bug, level idea, content fix) and a README with the roadmap.
- Initial issues: Project Setup & Licensing, Design System & UI Style Guide, Level Curriculum Drafts, Technical Architecture.

## Git / credits (owner preference, must follow)
- The repo isn't initialized yet. Run `git init` when scaffolding.
- **Never** add `Co-Authored-By: Claude` (or any Claude/Anthropic co-author or contributor trailer) to commits or PRs.
- Credit Claude only in an "Acknowledgements" section of the README.

## Commands
- `npm run dev`: dev server on :5173, exposed on the LAN (`server.host`) for phone testing
- `npm test`: Vitest (level logic, scoring, streak, IndexedDB store, content validation)
- `npm run build`: type-check + production build with service worker
- `npm run verify-puzzles`: Stockfish checks every puzzle in `content/levels/` (solution is the clear best move, solver ends up winning). Run after editing puzzles.
- `npm run bapu`: re-export Bapu WebP/icons from `abu.png`
- `npm run puzzles`: not built yet (Lichess pipeline)
