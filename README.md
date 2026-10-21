# ApeChess

**Learn chess the clever way: Bapu the ape shows you *why* every move works.**

ApeChess is a free, open-source chess course that runs in your browser and installs on your phone (it works offline). Every lesson is short: one idea, a demo, a few guided puzzles, then practice. After every move, Bapu (an ape in a suit and glasses) explains the idea behind it, not just whether it was right.

It's built for smart adults who never really learned chess, and later for school kids, starting with schools in Nepal.

## Status

Early days. **9 of the 20 MVP levels are playable**: What's It Worth?, Special Moves, Mate in One, Back-Rank Mate, Knight Forks, Queen & Pawn Forks, Pins, Skewers and Discovered Attacks.

- every level: concept card → animated demo → 3 guided puzzles (with hints) → 7 practice puzzles → summary
- practice is drawn from ~40 hand-picked Lichess puzzles per level, so replays feel fresh
- Bapu explains every move: hand-written for featured puzzles, generated from the position for the rest
- a level map with unlocking (★ opens the next level), stars, XP and a daily streak
- progress saved on your device (IndexedDB), no account needed

The full 20-level plan lives in [`docs/curriculum-mvp.md`](docs/curriculum-mvp.md).

## Roadmap

1. **Done:** Level 8, the Lichess puzzle pipeline, the level map, and the puzzle levels of Units 1–3
2. **Next:** the levels that need new activity types: L1 (how pieces move), L3 (check, mate or stalemate?), L7 (opening principles), L13 (checkpoint)
3. **Then:** Units 4–5, badges, Stockfish-powered endgame levels (L18)
4. **Later:** the school edition (simpler copy, Nepali), teacher view, cloud sync

## Run it

Needs Node 20+.

```bash
npm install
npm run dev            # http://localhost:5173 (also on your LAN, for phone testing)
npm test               # unit tests (Vitest)
npm run build          # production build + service worker in dist/
npm run verify-puzzles # check every hand-made puzzle with Stockfish (slow)
npm run puzzles        # rebuild content/puzzles/ from the Lichess database (see below)
npm run bapu           # re-export Bapu images from abu.png into public/bapu/
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`. In the repo settings, set **Pages → Source** to **GitHub Actions** once.

### Puzzle packs

`content/puzzles/LXX.json` are built from the [Lichess puzzle database](https://database.lichess.org/#puzzles) (CC0). To rebuild them, download `lichess_db_puzzle.csv.zst` (~300 MB) into `data/raw/` (never committed) and run `npm run puzzles` (about 5 minutes). The filters in `scripts/build-puzzles.ts` keep popular puzzles in each level's rating range, and only those where Bapu's own analysis finds the level's idea, so he can always explain them. `npx tsx scripts/show-puzzles.ts L10 pin` previews what Bapu says for every puzzle in a pack.

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
src/progress/  IndexedDB store, streak
src/ui/        screens
content/levels/  levels: concept, demo, guided puzzles and Bapu's hand-written lines
content/puzzles/ practice packs built from the Lichess puzzle database
scripts/       image export, puzzle pipeline, Stockfish verifier
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
