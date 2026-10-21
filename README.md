# ApeChess

**Learn chess the clever way: Bapu the ape shows you *why* every move works.**

ApeChess is a free, open-source chess course that runs in your browser and installs on your phone (it works offline). Every lesson is short: one idea, a demo, a few guided puzzles, then practice. After every move, Bapu (an ape in a suit and glasses) explains the idea behind it, not just whether it was right.

It's built for smart adults who never really learned chess, and later for school kids, starting with schools in Nepal.

## Status

Early days. **Level 8: Knight Forks** is fully playable end to end:

- concept card → animated demo → 3 guided puzzles (with hints) → 7 practice puzzles → summary
- stars (★ complete, ★★ 7/10 first try, ★★★ 9/10 first try with no hints), XP and a daily streak
- progress saved on your device (IndexedDB), no account needed

The full 20-level plan lives in [`docs/curriculum-mvp.md`](docs/curriculum-mvp.md).

## Roadmap

1. **Now:** one level, done properly (Level 8)
2. **Next:** Lichess puzzle pipeline (`scripts/build-puzzles.ts`), then Units 1–3 (Levels 1–13)
3. **Then:** a scrollable level map that scales to 100+ levels, badges, Stockfish-powered endgame levels (L18)
4. **Later:** the school edition (simpler copy, Nepali), teacher view, cloud sync

## Run it

Needs Node 20+.

```bash
npm install
npm run dev            # http://localhost:5173 (also on your LAN, for phone testing)
npm test               # unit tests (Vitest)
npm run build          # production build + service worker in dist/
npm run verify-puzzles # check every hand-made puzzle with Stockfish (slow)
npm run bapu           # re-export Bapu images from abu.png into public/bapu/
```

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
content/levels/  hand-authored levels (L08.json)
scripts/       image export, Stockfish puzzle verifier
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
