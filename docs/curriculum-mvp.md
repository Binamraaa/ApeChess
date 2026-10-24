# ApeChess MVP Curriculum: 20 Levels

**Learner:** a smart adult (and later a school kid) who knows the rules loosely but can't *see* tactics and doesn't know *why* a move is good.
**Promise:** finish 20 levels and you stop hanging pieces, spot basic tactics, and can checkmate with an extra queen or rook.
**Rough rating band:** ~400 → ~1200 (Lichess puzzle rating).

Bapu's job in every level is to explain **why** a move works, not just to say "correct".

---

## Level anatomy

Every level has the same five parts:

1. **Concept card** (≤ 2 sentences, Bapu speaking)
2. **Demo board**: one hand-picked position, animated, with Bapu narrating each move
3. **Guided puzzles** (3): hints allowed, Bapu explains after every move
4. **Practice set** (7): no auto-hints, explanation after solve or fail
5. **Summary card**: the one-line rule to remember ("Before every move: checks, captures, threats.")

**Stars**
- ★ complete the level (any accuracy)
- ★★ ≥ 7/10 correct on first try
- ★★★ ≥ 9/10 correct on first try, no hints

The next level unlocks at ★. Checkpoints (L13, L20) need ★★.

**Puzzle sources**
- `lichess:<themes>`: pulled from the Lichess puzzle DB (CC0), filtered by theme tags and rating range
- `custom`: hand-authored positions (FEN + solution + explanation) in `content/levels/`
- `engine`: play a position out against Stockfish at a capped strength

---

## Unit 1: Foundations (L1–L4)

| # | Level | Concept (Bapu) | Source | Rating |
|---|-------|----------------|--------|--------|
| 1 | **How Pieces Move** | "Every piece has its own way of walking. Learn the walk before the dance." | custom drills: move a piece to every star on the board (rook, bishop, queen, knight, king, pawn) | — |
| 2 | **What's It Worth?** | "Pawn 1, knight 3, bishop 3, rook 5, queen 9. Don't trade a banana for a peanut." | custom (good vs. bad trades) + `lichess:hangingPiece` | 400–900 |
| 3 | **Check, Mate & Stalemate** | "Check means the king is attacked. Mate means it can't escape. Stalemate means nobody wins, so don't do it when you're winning!" | custom (identify: check / mate / stalemate / none) | — |
| 4 | **Special Moves** | "Castling, en passant, promotion: three secret handshakes." | `lichess:castling`, `lichess:enPassant`, `lichess:promotion` | 400–1000 |

## Unit 2: Finishing the Game (L5–L7)

| # | Level | Concept | Source | Rating |
|---|-------|---------|--------|--------|
| 5 | **Mate in One** | "Look at every check first. One of them might end the game." | `lichess:mateIn1` | 400–1000 |
| 6 | **Back-Rank Mate** | "A king hiding behind its own pawns can get locked in its own house." | `lichess:backRankMate` + `mateIn1` | 500–1100 |
| 7 | **Opening Principles** | "Control the center, develop knights and bishops, castle early, don't move the queen out too soon." | custom: choose the best of 3 moves in early positions; explain why the others are worse | — |

## Unit 3: The Big Five Tactics (L8–L13)

| # | Level | Concept | Source | Rating |
|---|-------|---------|--------|--------|
| 8 | **Knight Forks** | "One knight, two targets. The knight is the sneakiest fork in the jungle." | `lichess:fork`, filter: first solver move is a knight move | 500–1100 |
| 9 | **Queen & Pawn Forks** | "Anything can fork. A cheap pawn attacking two expensive pieces is the best kind." | `lichess:fork`, filter: first solver move is queen or pawn | 600–1200 |
| 10 | **Pins** | "A pinned piece can't move without exposing something more valuable behind it. Attack it again!" | `lichess:pin` | 600–1200 |
| 11 | **Skewers** | "A pin in reverse: the big piece is in front and has to move, then you take what's behind." | `lichess:skewer` | 700–1200 |
| 12 | **Discovered Attacks & Double Check** | "Move one piece to unleash another. Two attacks from one move." | `lichess:discoveredAttack`, `lichess:doubleCheck` | 700–1300 |
| 13 | **Checkpoint: Tactic Spotter** | "No hints about which tactic it is. You find it." | mixed: themes from L5–L12, shuffled, theme name hidden | 600–1200 |

## Unit 4: Sharper Tactics (L14–L17)

| # | Level | Concept | Source | Rating |
|---|-------|---------|--------|--------|
| 14 | **Remove the Defender** | "If one piece is guarding everything, capture or chase the guard." | `lichess:capturingDefender` | 800–1300 |
| 15 | **Deflection & Attraction** | "Drag a defender away, or lure the king onto a bad square." | `lichess:deflection`, `lichess:attraction` | 900–1400 |
| 16 | **Trapped Pieces** | "A piece with no safe squares is already lost. Go hunting." | `lichess:trappedPiece` | 800–1400 |
| 17 | **Mate in Two** | "Check, then check again. Forcing moves leave no time to escape." Includes smothered mate. | `lichess:mateIn2`, `lichess:smotheredMate` | 800–1400 |

## Unit 5: Converting the Win (L18–L20)

| # | Level | Concept | Source | Rating |
|---|-------|---------|--------|--------|
| 18 | **Mate with Queen or Rook** | "Box the king in, shrink the box, bring your own king to help." | `engine`: K+Q vs K, then K+R vs K. Must mate within N moves vs Stockfish (Q: 10, R: 20) | — |
| 19 | **King & Pawn Basics** | "The square rule and opposition: when kings face off, whoever *doesn't* have to move wins." | custom (square rule, opposition) + `lichess:pawnEndgame` | 700–1300 |
| 20 | **Boss: The Checklist** | "Before every move: checks, captures, threats, for you AND your opponent." | mixed timed exam: 15 puzzles across all themes, includes 3 "defend" puzzles (`lichess:defensiveMove`) where the right move is to stop a threat | 700–1400 |

## Unit 6: The Final (L21)

| # | Level | Concept | Source | Rating |
|---|-------|---------|--------|--------|
| 21 | **Final: Play Bapu** | "Now a real game, against me. Play carefully, and run the checklist before every move." | `engine`: a whole game against Stockfish at `UCI_Elo` 2100, about a second a move | — |

The final breaks the level anatomy on purpose: a concept card, one game, then Bapu's review. Nobody at this level is expected to beat a 2100 player, so stars measure careful play, not results:

- ★ last 25 moves without resigning (a win or a draw counts sooner)
- ★★ two blunders or fewer
- ★★★ no blunders at all, or a draw or a win

A full-strength search judges every learner move. A **blunder** loses at least 0.3 of the winning chances on a −1…1 scale (a mistake: 0.2), the same yardstick Lichess uses, so slipping further in a position that was already lost doesn't count. Bapu accepts a draw offer only after 25 moves, in a position he isn't better in.

During the game Bapu names the idea behind his own moves (forks, pins, free pieces). After a blunder he raises an eyebrow, with no take-backs. Afterwards he shows the three worst moments: what the learner played, the reply that punished it, and the better move. Blunders with one clear punishing reply come back as rematch riddles, where the learner plays Bapu's side. Colours alternate between games, and an unfinished game is saved after every move.

XP: the level bonus for the stars (20/40/60), 2 per move that wasn't a blunder (up to 40 moves), +100 for a win, +50 for a draw.

---

## Writing Bapu's explanations

- **Featured puzzles** (demo + guided, about 4 per level): hand-written, 1–3 sentences each, naming the idea and the target. Example: "Nf7+ hits the king AND the rook on h8. The king must move, so the rook falls."
- **Practice puzzles**: generated from per-theme templates plus move facts (piece moved, pieces attacked, material won). Example template for fork: "Your {piece} on {square} attacks {targetA} and {targetB} at once. Only one can escape."
- **On a wrong move**: show the refutation if there is one ("If Bxe5, then Qxh7#"), otherwise "That's legal, but it doesn't win anything. Look for a forcing move first."
- **Voice**: warm, witty, short. No jargon without a one-line definition the first time it appears.

## Phase 1 features: in or out of the MVP

| Phase 1 feature | MVP? | How |
|---|---|---|
| Levels, one concept each | ✅ | 20 levels above (out of the planned 100–150) |
| XP | ✅ | 10 XP per puzzle solved first try, 5 with a hint; level bonus 20/40/60 for ★/★★/★★★. Shown on the home screen ("You've earned N XP"). |
| Stars | ✅ | As defined above |
| Streak counter | ✅ | Days in a row with ≥ 1 level session; shown on the home screen |
| Skill-tree / map | ✅ (simple) | Vertical path of level nodes grouped by unit; locked, current and starred states |
| Badges | ✅ (minimal) | One badge per unit completed (5) plus "Boss Beaten" |
| Bapu intro + summary per level | ✅ | Concept card + summary card |
| Optional "technical deep-dive" | ✅ (light) | A "Bapu's deep dive" expander on featured puzzles: the longer explanation, alternative lines, the engine eval |
| Avatar evolves with progress | ⏳ later | Needs extra art. Idea: small accessories per unit (pocket square, chess-piece pin, fancy hat) |
| Daily reminders | ⏳ later | PWA notifications are unreliable on iOS. Revisit with a native wrapper. |
| Cloud sync | ⏳ later | Local-only progress for now, with export/import JSON as a stopgap |
| Educators & clubs view | ⏳ later | Comes with the school edition |
| Kids 8–16 | ⏳ later | The MVP copy targets adults. The school edition gets simpler copy plus Nepali. |
| Openings (Italian, Ruy Lopez), pawn structure, tempo | ⏳ later | Phase 1 Levels 11–30. The MVP only has opening *principles* (L7). |

## Out of scope for the MVP

Opening theory lines (Italian, Ruy Lopez, etc.), positional play, full games vs. AI, accounts and sync, leaderboards, and the Nepali/school edition. These come after the MVP proves the loop works.
