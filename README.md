# ApeChess

**Learn chess the clever way: Bapu the ape shows you *why* every move works.**

ApeChess is a free, open-source chess course that runs in your browser and installs on your phone (it works offline). Every lesson is short: one idea, a demo, a few guided puzzles, then practice. After every move, Bapu (an ape in a suit and glasses) explains the idea behind it, not just whether it was right.

It's built for smart adults who never really learned chess, and later for school kids, starting with schools in Nepal.

## Status

**All 20 MVP levels are playable**, from "how does the knight move?" to a timed boss exam.

- five kinds of activity: puzzles, move drills (Level 1), a check/mate/stalemate quiz (Level 3), pick-the-best-opening-move (Level 7) and mating a lone king against Stockfish in the browser (Level 18)
- every level: concept card → animated demo → guided steps with hints → practice → summary
- practice is drawn from ~40 puzzles per level, picked from the Lichess database and checked with Stockfish, so replays feel fresh
- Bapu explains every move: hand-written for featured puzzles, generated from the position for the rest
- a checkpoint (Level 13) and a boss (Level 20) that mix every earlier theme with no hints
- an intro page with two doors: "I'm new to chess" or "I know how the pieces move"
- a level map with unlocking, stars, XP and a daily streak; progress saved on your device, no account needed
- optional cloud backup: sign in with an emailed code and your progress follows you to any device (Supabase; the device copy stays first, so it all still works offline). See [`docs/backend.md`](docs/backend.md)
- **Bapu's daily riddle**: one puzzle a day from the levels you've passed. It earns XP and keeps your streak alive. Puzzles you missed come back as rematches
- **Bapu's notebook**: every level's rule becomes a page you keep, and finishing units earns ranks (Pawn Apprentice to Silverback)
- streak freezes (one per 7-day streak, up to two) so a missed day doesn't wipe out a long streak
- share your result: a spoiler-free square grid for levels and riddles
- sound: Bapu's theme (hummed, then arranged in code from its MIDI notes), wooden move clacks, gentle right/wrong cues, a combo for first-try solves in a row, star chimes, and Bapu "speaking" each line in a murmur (or read aloud). Recorded music and sounds drop in through [`docs/sound.md`](docs/sound.md)

The full plan lives in [`docs/curriculum-mvp.md`](docs/curriculum-mvp.md).

## Roadmap

1. **Done:** the 20-level MVP, the Lichess puzzle pipeline, the level map and the intro page
2. **Next:** a recorded arrangement of Bapu's theme, Bapu's recorded voice, a "deep dive" on featured puzzles
3. **Later:** the school edition (simpler copy, Nepali), teacher accounts with class codes, Phase 1 levels beyond 20

## Run it

Needs Node 20+.

```bash
npm install
npm run dev            # http://localhost:5173 (also on your LAN, for phone testing)
npm test               # unit tests (Vitest)
npm run build          # production build + service worker in dist/
npm run verify-puzzles # check every hand-made puzzle with Stockfish (slow)
npm run puzzles        # rebuild content/puzzles/ from the Lichess database (see below)
npx tsx scripts/build-quiz.ts       # rebuild the Level 3 quiz set
npx tsx scripts/build-openings.ts   # rebuild Level 7, checking each choice with Stockfish
npx tsx scripts/build-endgames.ts   # find Level 18 start positions
npm run bapu           # re-export Bapu images from abu.png into public/bapu/
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`. In the repo settings, set **Pages → Source** to **GitHub Actions** once.

### Puzzle packs

`content/puzzles/LXX.json` are built from the [Lichess puzzle database](https://database.lichess.org/#puzzles) (CC0). To rebuild them, download `lichess_db_puzzle.csv.zst` (~300 MB) into `data/raw/` (never committed) and run `npm run puzzles` (about 5 minutes). The filters in `scripts/build-puzzles.ts` keep popular puzzles in each level's rating range, and only those where Bapu's own analysis finds the level's idea, so he can always explain them. Each candidate is then checked with Stockfish: the solution must be the only good move, and the opponent's replies must be real defences, not blunders. `npx tsx scripts/show-puzzles.ts L10 pin` previews what Bapu says for every puzzle in a pack.

Level 18 runs Stockfish (the single-threaded lite build, GPL-3.0) in a Web Worker. `npm run dev` and `npm run build` copy it into `public/stockfish/` first.

Open the app with `?unlock=all` to open every level on that device (for testing); `?unlock=off` turns it off.

## How it's built

- Vite + React + TypeScript, `vite-plugin-pwa` for install and offline use
- [`chess.js`](https://github.com/jhlywa/chess.js) for the rules, [`chessground`](https://github.com/lichess-org/chessground) (Lichess's board) for the UI
- Pure, tested level logic in `src/levels/` (no React), Bapu's templates in `src/bapu/`
- Puzzles use the Lichess puzzle format: the FEN is the position *before* the opponent's move, and `moves[0]` is that move

```
src/board/     chessground wrapper
src/levels/    puzzle checking, level runner, star scoring (pure TS)
src/bapu/      explanation templates + speech bubble
src/progress/  IndexedDB store, streak, cloud sync (merge + Supabase)
src/sound/     sound effects, Bapu's murmur, music (built-in synth, recorded files override)
src/ui/        screens
content/levels/  levels: concept, demo, guided puzzles and Bapu's hand-written lines
content/puzzles/ practice packs built from the Lichess puzzle database
scripts/       image export, puzzle pipeline, Stockfish verifier
supabase/      the progress table (migration) and the sign-in email
```

## Contributing

Ideas for levels, fixes to Bapu's explanations and bug reports are all welcome. Please open an issue first for anything big.

## License

[GPL-3.0-or-later](LICENSE). ApeChess uses chessground and Stockfish, which are GPL-3.0.

## Acknowledgements

- [Lichess](https://lichess.org) for chessground and the open puzzle database (CC0)
- [Stockfish](https://stockfishchess.org) for checking that the puzzles are sound
- Colin M.L. Burnett for the chess piece set
- Fraunces and Nunito fonts (SIL Open Font License)
- Built with help from [Claude](https://claude.ai) by Anthropic, as a coding assistant
