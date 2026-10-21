import type { Move, PieceSymbol } from 'chess.js';
import type { PuzzleDef } from '../levels/types';
import { PIECE_NAME, PIECE_VALUE, adjacent, isFork, type LineInsights, type LineTactic, type MoveFacts, type Target } from './facts';
import { THEMES, type Theme } from './themes';

export { PIECE_NAME, PIECE_VALUE, isFork, lineInsights, moveFacts, material, type LineInsights, type MoveFacts } from './facts';

function targetName(t: Target): string {
  return t.type === 'k' ? 'the king' : `the ${PIECE_NAME[t.type]} on ${t.square}`;
}

function list(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return names.slice(0, -1).join(', ') + ' AND ' + names[names.length - 1];
}

function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}

/** The moving piece's name, as it stands after the move (a promoted pawn is its new piece). */
const pieceName = (f: MoveFacts) => PIECE_NAME[f.promotion ?? f.piece];

const forkNames = (f: MoveFacts) => list(f.forkTargets.filter((t) => t.type !== 'p').map(targetName));

/** The ideas a move can show. Templates try them in order, the level's own idea first. */
type Pattern = 'fork' | 'double' | 'discovered' | 'line' | 'special' | 'free';
const ORDER: Pattern[] = ['fork', 'double', 'discovered', 'line', 'special', 'free'];
const LEADS: Partial<Record<Theme, Pattern[]>> = {
  knightFork: ['fork'],
  fork: ['fork'],
  hanging: ['free'],
  special: ['special'],
  pin: ['line'],
  skewer: ['line'],
  discovered: ['double', 'discovered'],
};
const patterns = (theme: Theme) => {
  const lead = LEADS[theme] ?? [];
  return [...lead, ...ORDER.filter((p) => !lead.includes(p))];
};

/**
 * The most telling pin or skewer: one made by the moved piece (unless it can simply be taken for free),
 * else an existing pin on a piece the move attacks.
 */
export function keyLine(f: MoveFacts): LineTactic | undefined {
  const free = f.hanging && f.defenders.length === 0;
  return (
    f.lines.find((l) => l.by.square === f.to && !free) ??
    f.lines.find((l) => l.kind === 'pin' && l.by.square !== f.to && f.targets.some((t) => t.square === l.front.square))
  );
}

const behindName = (l: LineTactic) => (l.behind.type === 'k' ? 'the king' : `the ${PIECE_NAME[l.behind.type]}`);

/** Bapu's line right after the solver plays a correct move that isn't the last one. */
export function explainCorrect(f: MoveFacts, theme: Theme = 'knightFork'): string {
  const piece = pieceName(f);
  if (theme === 'mateIn2') {
    return f.check
      ? 'Check! The king has very few choices now. Find the finishing blow.'
      : 'A quiet move, with a deadly threat. Now find the finish.';
  }
  if (f.opposition && theme === 'pawnEndgame') {
    return 'You take the opposition! The kings face off with one square between, and the other king has to give way.';
  }
  for (const p of patterns(theme)) {
    if (p === 'fork' && isFork(f)) {
      if (f.check) return `Check! Your ${piece} on ${f.to} hits ${forkNames(f)}. The king must move first, so something gets left behind.`;
      return `Your ${piece} on ${f.to} attacks ${forkNames(f)} at once. Only one can escape.`;
    }
    if (p === 'double' && f.doubleCheck) {
      return 'Double check! Two of your pieces attack the king at once. Nothing can block both, so the king has to run.';
    }
    if (p === 'discovered' && f.discovered.length) {
      const d = f.discovered[0];
      return `Your ${piece} steps aside, and your ${PIECE_NAME[d.by.type]} on ${d.by.square} suddenly hits ${targetName(d.target)}.${f.check ? ' Two threats at once!' : ''}`;
    }
    const line = p === 'line' ? keyLine(f) : undefined;
    if (line) {
      if (line.by.square !== f.to) return `The ${PIECE_NAME[line.front.type]} is pinned, so it can’t run away. Your ${piece} piles on.`;
      if (line.kind === 'pin') {
        return `Your ${piece} pins the ${PIECE_NAME[line.front.type]} on ${line.front.square} to ${behindName(line)}. It can’t move away without exposing what’s behind it.`;
      }
      const front = line.front.type === 'k' ? 'The king' : `The ${PIECE_NAME[line.front.type]}`;
      return `Skewer! ${front} is in the way of the ${PIECE_NAME[line.behind.type]} on ${line.behind.square}. When it steps aside, you take what’s behind it.`;
    }
    if (p === 'special' && f.special === 'castle') return 'Castling! Your king tucks away and the rook jumps into the game, all in one move.';
    if (p === 'special' && f.special === 'promotion') return 'Promotion! Your pawn reached the last row and became a queen.';
    if (p === 'special' && f.special === 'enPassant') return 'En passant! You take the pawn that tried to sneak past.';
    if (p === 'free' && f.captured && f.capturedFree) return `Free ${PIECE_NAME[f.captured]}! Nobody was guarding it.`;
  }
  if (f.check) return 'Check! Keep the pressure on.';
  if (f.captured) return `You take the ${PIECE_NAME[f.captured]}. Keep going!`;
  if (f.piece === 'p' && (f.to[1] === '7' || f.to[1] === '2') && (f.to[1] === '7') === (f.from[1] < f.to[1])) {
    return 'One step from the last row! Can anyone stop it?';
  }
  return 'Good move. Keep going!';
}

function explainMate(f: MoveFacts, smothered = false): string {
  const piece = pieceName(f);
  if (smothered) return 'Smothered mate! The king is walled in by its own pieces, and your knight jumps in for the kill.';
  if (f.doubleCheck) return 'Checkmate by double check! Two attackers at once, and the king has nowhere to go.';
  if (f.promotion) return `Your pawn becomes a ${piece}, and it’s checkmate! A brand-new piece, straight into action.`;
  if (f.special === 'castle') return 'Castling with checkmate! The rook slides out next to your king, and the enemy king has nowhere to go.';
  if (f.special === 'enPassant') return 'Checkmate by en passant! The rarest handshake in chess, and it ends the game.';
  if (f.backRank) {
    return f.to[1] === f.king[1]
      ? `Back-rank mate! The king is locked in by its own pieces, and your ${piece} owns the back row.`
      : 'Back-rank mate! The king is locked in by its own pieces, and its back row is under fire.';
  }
  if (f.piece !== 'n' && adjacent(f.to, f.king) && f.defenders.length) {
    return `Checkmate! Your ${piece} goes right next to the king, and your ${PIECE_NAME[f.defenders[0].type]} protects it, so the king can’t take it. No escape squares, no blocks.`;
  }
  return `Checkmate! The king is in check, every escape square is covered, and nothing can block or safely capture your ${piece}.`;
}

const pieceWord = (t: PieceSymbol) => (t === 'k' ? 'king' : PIECE_NAME[t]);

/** Lines for the multi-move ideas of Unit 4, when the line shows them. */
function explainInsight(theme: Theme, i: LineInsights, final: MoveFacts): string | undefined {
  const finish = final.mate ? 'checkmate followed' : final.captured ? `the ${PIECE_NAME[final.captured]} was yours` : 'you won';
  if ((theme === 'removeDefender' || theme === 'deflection') && i.removedDefender) {
    const { defender: d, target: t } = i.removedDefender;
    return `The ${PIECE_NAME[d.type]} on ${d.square} was guarding the ${PIECE_NAME[t.type]} on ${t.square}. Take the guard, and what it guarded falls.`;
  }
  if (theme === 'deflection' && i.attracted) {
    const lured = i.attracted.piece === 'k' ? 'the king' : `the ${PIECE_NAME[i.attracted.piece]}`;
    return `Your sacrifice on ${i.attracted.to} lured ${lured} onto a bad square, and ${finish}.`;
  }
  if ((theme === 'deflection' || theme === 'removeDefender') && i.deflected) {
    const { piece, from, guarded } = i.deflected;
    return `You dragged the ${pieceWord(piece)} away from ${from}, where it was guarding ${guarded}. With the guard gone, ${finish}.`;
  }
  if (theme === 'trapped' && i.trapped) {
    return `The ${PIECE_NAME[i.trapped.type]} had nowhere safe to go: every square it could reach was covered. A trapped piece is a lost piece.`;
  }
  return undefined;
}

/**
 * Bapu's line when the puzzle is solved (used when the puzzle has no hand-written explanation).
 * `moves` are the solver's moves in order; `insights` describe the whole line (see lineInsights).
 */
export function explainSolved(moves: MoveFacts[], theme: Theme = 'knightFork', insights: LineInsights = {}): string {
  const f = moves[0];
  const final = moves[moves.length - 1];
  const insight = explainInsight(theme, insights, final);
  // In Unit 4 the idea matters more than the finish, even when the finish is mate.
  if (insight && final.mate) return insight;
  if (final.mate) {
    const mate = explainMate(final, insights.smothered);
    if (moves.length < 2) return mate;
    const opener = f.check ? 'First a check that forced the reply, then the finish.' : 'A quiet first move, then mate: the hardest kind to see!';
    return `${mate} ${opener}`;
  }
  if (insight) return insight;
  if (theme === 'pawnEndgame' && moves.some((m) => m.opposition)) {
    return 'Taking the opposition made the other king give way, and that opened the road for your pawn. In pawn endings, the king that doesn’t have to move wins.';
  }
  if (theme === 'pawnEndgame' && !moves.some((m) => m.special === 'promotion') && moves.some((m) => m.captured === 'p')) {
    return 'You won a pawn, and in a pawn ending one extra pawn is usually enough: it marches on and becomes a queen.';
  }
  if (theme === 'defend') {
    // These puzzles stop a threat, and often win something on the way: say both.
    return `Threat handled! ${explainSolved(moves, 'mixed', insights)}`;
  }

  const prize = final.captured ? `the ${PIECE_NAME[final.captured]}` : 'the prize';
  const piece = pieceName(f);

  for (const p of patterns(theme)) {
    // A fork only gets the credit if the prize was one of the forked pieces.
    if (p === 'fork' && isFork(f) && f.forkTargets.some((t) => t.square === final.to)) {
      return `${capitalize(piece)} to ${f.to} forked ${forkNames(f)}. Only one could escape, so you collect ${prize}.`;
    }
    if (p === 'double' && f.doubleCheck) return `Double check forced the king to move, and that left ${prize} for you.`;
    if (p === 'discovered' && f.discovered.length) {
      const d = f.discovered[0];
      return `Moving your ${piece} uncovered your ${PIECE_NAME[d.by.type]}. Two threats from one move, and they could only answer one.`;
    }
    const line = p === 'line' ? keyLine(f) : undefined;
    if (line?.kind === 'skewer') {
      return `The skewer forced the ${PIECE_NAME[line.front.type]} to step aside, and the ${PIECE_NAME[line.behind.type]} behind it fell.`;
    }
    if (line?.kind === 'pin') {
      const front = PIECE_NAME[line.front.type];
      return final.captured === line.front.type
        ? `The ${front} was pinned to ${behindName(line)}, so it couldn’t escape. You collect it.`
        : `The ${front} was pinned to ${behindName(line)}, so it couldn’t help. That’s how you won ${prize}.`;
    }
    const special = p === 'special' ? moves.find((m) => m.special) : undefined;
    if (special?.special === 'promotion') {
      return 'Your pawn made it to the last row and became a queen. The cheapest piece just turned into the strongest.';
    }
    if (special?.special === 'enPassant') {
      return 'En passant: a pawn that rushes two squares past yours can still be taken, as if it had moved only one. You have to do it right away, though.';
    }
    if (special?.special === 'castle') {
      const file = special.to[0] === 'g' ? 'f' : 'd';
      return `Castling did two jobs at once: your king got safe and your rook landed on the ${file}-file, ready to strike.`;
    }
    if (p === 'free' && f.captured && f.capturedFree) {
      return `That ${PIECE_NAME[f.captured]} had no defender, so it was free. Before every move, check what’s unguarded: yours and theirs.`;
    }
  }
  return `Nicely done, you won ${prize}.`;
}

/**
 * Bapu's line after a wrong move. Uses the puzzle's hand-written refutation if there is one,
 * otherwise a nudge based on what the move did.
 */
export function explainWrong(p: PuzzleDef, uci: string, f: MoveFacts, step: number, theme: Theme = 'knightFork'): string {
  const copy = THEMES[theme];
  const custom = p.wrong?.[uci];
  if (custom && step === 0) return custom;
  if (step > 0) return copy.followUp;

  const piece = PIECE_NAME[f.piece];

  if (theme === 'mate' || theme === 'backRank') {
    if (!f.check) return copy.nudge;
    if (f.escapes.length) return `That’s check, but the king slips away to ${f.escapes[0]}. Find a check that leaves it no squares.`;
    if (f.stoppedBy === 'capture') return `That’s check, but your ${piece} can just be captured. Find a check they can’t answer.`;
    return 'That’s check, but they can block it. Find a check nothing can get in the way of.';
  }

  if (copy.focus && !copy.focus.includes(f.piece)) {
    const names = copy.focus.map((t) => PIECE_NAME[t]).join(' or ');
    return `That's legal, but this level is all about the ${names}. Find the square where it attacks two things at once.`;
  }
  if (isFork(f) && f.hanging && copy.focus) {
    return `Nice fork shape, but your ${piece} can just be captured on ${f.to}. A fork has to land on a safe square.`;
  }
  if (f.captured && f.hanging && PIECE_VALUE[f.piece] > PIECE_VALUE[f.captured]) {
    return `The ${PIECE_NAME[f.captured]} was guarded, so you’d lose your ${piece} for it. Look for something that’s truly free.`;
  }
  if (f.hanging && !f.captured && PIECE_VALUE[f.piece] >= 3) {
    if (copy.focus) return `Right piece, but your ${piece} can just be taken on ${f.to}. Find a safe square that hits two things.`;
    return `Careful: your ${piece} can just be taken on ${f.to}. ${copy.nudge}`;
  }
  return copy.nudge;
}

/** Plain-English description of the opponent's move, e.g. "Black moved the bishop to c5." */
export function describeMove(m: Pick<Move, 'color' | 'piece' | 'to' | 'captured' | 'san'>): string {
  const who = m.color === 'w' ? 'White' : 'Black';
  const piece = PIECE_NAME[m.piece];
  const check = m.san.endsWith('+') ? ' Check!' : '';
  if (m.san.startsWith('O-O')) return `${who} castled.${check}`;
  if (m.captured) return `${who}'s ${piece} took your ${PIECE_NAME[m.captured]} on ${m.to}.${check}`;
  return `${who} moved the ${piece} to ${m.to}.${check}`;
}
