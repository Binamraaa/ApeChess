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
- IndexedDB (via `idb`) for progress: stars, XP, streak. Optional cloud backup with Supabase (email code sign-in); the device copy always comes first and nobody has to sign in to play.
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
  sound/      Web Audio engine: synth cues, Bapu's murmur, music scenes
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
- `npm run verify-puzzles [-- file…]`: Stockfish checks every puzzle in `content/levels/` (or the given level/pack files) with the rules in `scripts/puzzle-check.ts`: the solution is the clear best move (no other move wins about as well), the opponent's replies aren't blunders, and the solver ends up winning. Run after editing puzzles.
- `npm run bapu`: re-export Bapu WebP/icons from `abu.png`
- `npm run puzzles`: rebuild `content/puzzles/LXX.json` from `data/raw/lichess_db_puzzle.csv.zst` (~5 min). The file is pzstd multi-frame, so the script decodes frame by frame. Per-level filters live in `PACKS`; they use Bapu's own move analysis (`src/bapu/facts.ts`) so every pack puzzle shows the level's idea, then every candidate goes through the same Stockfish check (~25 min in all; `--no-engine` skips it while trying filters).
- `npx tsx scripts/show-puzzles.ts L10 pin [ids…]`: preview Bapu's template lines for a pack (with boards when ids are given). Use it before picking featured puzzles.
- `npx tsx scripts/find-puzzles.ts castle|enPassant|promotion [maxRating] [count]`: find Stockfish-clean candidates for featured puzzles.
- `npm run theme [-- file.mid]`: rebuild `content/music/theme.json` (Bapu's theme) from a hummed MIDI (default: newest `.mid` in `content/music/`). It drives the home music and the level-complete tune.
- Daily riddle: `src/levels/riddle.ts` (pure: pool, seeded daily pick, XP), stored in IndexedDB meta `riddle` (picked once per day, so it doesn't change mid-day). Route `#/riddle`. A due rematch (`src/levels/review.ts`, meta `review`: puzzles missed in levels, back after 2 days) takes the riddle's place.
- Engagement logic is pure and tested: `src/levels/notebook.ts` (pages, ranks), `src/levels/share.ts` (share text), streak freezes in `src/progress/streak.ts`. Notebook route `#/notebook`.
- `npx tsx scripts/build-quiz.ts` (Level 3 positions), `scripts/build-openings.ts` (writes Level 7, Stockfish-checks every choice), `scripts/build-endgames.ts` (Level 18 start positions; prints them).
- Level kinds: `puzzle` (default), `drill`, `quiz`, `choice`, `endgame` (`src/levels/types.ts`); `LevelScreen` picks the player by kind. Mixed levels (L13, L20) use `mix` to draw practice from other levels' packs.
- `predev`/`prebuild` copy Stockfish (lite, single-threaded) into `public/stockfish/` (gitignored) for Level 18's Web Worker.
- Sound: `public/sounds/sounds.json` maps cues/music to recorded files in `public/sounds/`; anything unlisted uses the synth in `src/sound/synth.ts`. Brief for the music and cues: `docs/sound.md`. Sound prefs are per device (localStorage). `BapuBubble` plays its tone's cue and Bapu's voice on mount; `Board` clacks on moves.
- `?unlock=all` on the app URL opens every level on that device; `?unlock=off` resets.
- Cloud backup: `src/progress/merge.ts` (pure, tested: snapshot merge; XP per device in `profile.xpBy` so it's never counted twice), `sync.ts` (one sync round, tested with a fake cloud), `cloud.ts` (Supabase client, lazy-loaded; account state; sync triggers). Table + RLS in `supabase/migrations/`. Route `#/account`. Keys in `.env` (publishable key only). Setup, email/SMTP limits: `docs/backend.md`. Any new saved field must go into `Snapshot` and its merge rule.
- `navigator.storage.persist()` is requested after the first save each session (`src/progress/persist.ts`).
- Deploy: pushing to `main` runs `.github/workflows/deploy.yml` (tests, build with `BASE_PATH=/<repo>/`, publish to GitHub Pages)
