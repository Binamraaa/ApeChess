import type { LevelDef, PuzzleDef } from './types';

// Every content/levels/LXX.json is a playable level; content/puzzles/LXX.json is its practice pack.
// JSON shapes are checked by content/levels/levels.test.ts, hence the casts.
const levelFiles = import.meta.glob('../../content/levels/L*.json', { eager: true, import: 'default' });
const packFiles = import.meta.glob('../../content/puzzles/L*.json', { eager: true, import: 'default' });

const idOf = (path: string) => path.match(/(L\d+)\.json$/)![1];
const packs = Object.fromEntries(
  Object.entries(packFiles).map(([path, pack]) => [idOf(path), (pack as { puzzles: PuzzleDef[] }).puzzles]),
);

/** Playable levels, keyed by id. */
export const LEVELS: Record<string, LevelDef> = Object.fromEntries(
  Object.entries(levelFiles).map(([path, level]) => {
    const id = idOf(path);
    return [id, { ...(level as LevelDef), pack: packs[id] ?? [] }];
  }),
);

export interface MapEntry {
  id: string;
  number: number;
  title: string;
  checkpoint?: boolean;
}

export interface UnitInfo {
  number: number;
  title: string;
  levels: MapEntry[];
}

/** The MVP map (docs/curriculum-mvp.md). Grouped by unit so it can grow to 100+ levels. */
export const UNITS: UnitInfo[] = [
  {
    number: 1,
    title: 'Foundations',
    levels: [
      { id: 'L01', number: 1, title: 'How Pieces Move' },
      { id: 'L02', number: 2, title: "What's It Worth?" },
      { id: 'L03', number: 3, title: 'Check, Mate & Stalemate' },
      { id: 'L04', number: 4, title: 'Special Moves' },
    ],
  },
  {
    number: 2,
    title: 'Finishing the Game',
    levels: [
      { id: 'L05', number: 5, title: 'Mate in One' },
      { id: 'L06', number: 6, title: 'Back-Rank Mate' },
      { id: 'L07', number: 7, title: 'Opening Principles' },
    ],
  },
  {
    number: 3,
    title: 'The Big Five Tactics',
    levels: [
      { id: 'L08', number: 8, title: 'Knight Forks' },
      { id: 'L09', number: 9, title: 'Queen & Pawn Forks' },
      { id: 'L10', number: 10, title: 'Pins' },
      { id: 'L11', number: 11, title: 'Skewers' },
      { id: 'L12', number: 12, title: 'Discovered Attacks' },
      { id: 'L13', number: 13, title: 'Checkpoint: Tactic Spotter', checkpoint: true },
    ],
  },
  {
    number: 4,
    title: 'Sharper Tactics',
    levels: [
      { id: 'L14', number: 14, title: 'Remove the Defender' },
      { id: 'L15', number: 15, title: 'Deflection & Attraction' },
      { id: 'L16', number: 16, title: 'Trapped Pieces' },
      { id: 'L17', number: 17, title: 'Mate in Two' },
    ],
  },
  {
    number: 5,
    title: 'Converting the Win',
    levels: [
      { id: 'L18', number: 18, title: 'Mate with Queen or Rook' },
      { id: 'L19', number: 19, title: 'King & Pawn Basics' },
      { id: 'L20', number: 20, title: 'Boss: The Checklist', checkpoint: true },
    ],
  },
];

/** All map entries in order. */
export const ORDER: MapEntry[] = UNITS.flatMap((u) => u.levels);

export const isPlayable = (id: string) => Boolean(LEVELS[id]);
