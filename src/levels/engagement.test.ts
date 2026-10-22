import { describe, expect, it } from 'vitest';
import { RANKS, notebookPages, rankFor, type NotebookUnit } from './notebook';
import { REVIEW_LIMIT, dueReview, updateReview } from './review';
import type { PuzzleOutcome } from './scoring';
import { grid, levelShareText, mark, riddleShareText } from './share';
import type { LevelDef } from './types';

const o = (firstTry: boolean, hintUsed = false, revealed = false): PuzzleOutcome => ({ puzzleId: 'x', firstTry, hintUsed, revealed });

describe('share text', () => {
  it('marks each puzzle without giving anything away', () => {
    expect([o(true), o(true, true), o(false), o(false, false, true)].map(mark)).toEqual(['🟩', '🟨', '🟨', '⬜']);
  });

  it('lays squares out in rows of five', () => {
    expect(grid(Array.from({ length: 7 }, () => o(true)))).toBe('🟩🟩🟩🟩🟩\n🟩🟩');
  });

  it('writes a level result', () => {
    const text = levelShareText({ number: 8, title: 'Knight Forks', stars: 2, outcomes: [o(true), o(false)], url: 'https://x.test/' });
    expect(text).toBe('ApeChess · Level 8: Knight Forks\n★★☆ 1/2 first try\n🟩🟨\nhttps://x.test/');
  });

  it('adds the time on timed levels', () => {
    expect(levelShareText({ number: 20, title: 'Boss', stars: 3, outcomes: [o(true)], seconds: 125, url: 'u' })).toContain('1/1 first try · 2:05');
  });

  it('writes a riddle result, with the streak once it is going', () => {
    expect(riddleShareText({ number: 12, outcome: o(true), streak: 5, url: 'u' })).toBe('ApeChess · Bapu’s riddle #12\n🟩 Solved first try · 🔥 5\nu');
    expect(riddleShareText({ number: 1, outcome: o(false, false, true), streak: 1, url: 'u' })).toContain('⬜ Learned a new trick\n');
  });
});

const units: NotebookUnit[] = [
  { number: 1, title: 'A', levels: [{ id: 'L01', number: 1, title: 'One' }, { id: 'L02', number: 2, title: 'Two' }] },
  { number: 2, title: 'B', levels: [{ id: 'L03', number: 3, title: 'Three', checkpoint: true }, { id: 'L99', number: 4, title: 'Not built' }] },
];
const levels = {
  L01: { summary: 'Rule one', glossary: { term: 'Fork', definition: 'Two at once' } },
  L02: { summary: 'Rule two' },
  L03: { summary: 'Rule three' },
} as unknown as Record<string, LevelDef>;

describe('notebook', () => {
  it('has a page per built level, earned once played', () => {
    const pages = notebookPages(units, levels, (id) => (id === 'L01' ? 1 : 0));
    expect(pages.map((p) => [p.levelId, p.earned])).toEqual([['L01', true], ['L02', false], ['L03', false]]);
    expect(pages[0]).toMatchObject({ rule: 'Rule one', term: { term: 'Fork' }, unit: 1 });
  });
});

describe('rankFor', () => {
  it('starts everyone as a newcomer, with the levels left to the next rank', () => {
    expect(rankFor(units, levels, () => 0)).toEqual({ units: 0, title: RANKS[0], next: { title: RANKS[1], levelsLeft: 2 } });
  });

  it('rises with each finished unit (checkpoints need two stars)', () => {
    const best: Record<string, number> = { L01: 1, L02: 3, L03: 1 };
    expect(rankFor(units, levels, (id) => best[id] ?? 0)).toMatchObject({ units: 1, title: RANKS[1], next: { levelsLeft: 1 } });
    best.L03 = 2;
    expect(rankFor(units, levels, (id) => best[id] ?? 0)).toEqual({ units: 2, title: RANKS[2] });
  });
});

describe('review', () => {
  it('remembers misses, newest first, and forgets puzzles solved first try', () => {
    let items = updateReview([], 'L08', ['a', 'b'], [], '2026-10-20');
    items = updateReview(items, 'L09', ['c'], ['a'], '2026-10-21');
    expect(items.map((i) => i.puzzleId)).toEqual(['c', 'b']);
  });

  it('moves a repeat miss to today', () => {
    const items = updateReview(updateReview([], 'L08', ['a'], [], '2026-10-20'), 'L08', ['a'], [], '2026-10-22');
    expect(items).toEqual([{ puzzleId: 'a', levelId: 'L08', missedOn: '2026-10-22' }]);
  });

  it('keeps a bounded list', () => {
    const many = Array.from({ length: 40 }, (_, i) => `p${i}`);
    expect(updateReview([], 'L08', many, [], '2026-10-20')).toHaveLength(REVIEW_LIMIT);
  });

  it('brings back the oldest miss once two days have passed', () => {
    const items = [
      { puzzleId: 'new', levelId: 'L08', missedOn: '2026-10-21' },
      { puzzleId: 'old', levelId: 'L08', missedOn: '2026-10-18' },
      { puzzleId: 'mid', levelId: 'L08', missedOn: '2026-10-19' },
    ];
    expect(dueReview(items, '2026-10-22')?.puzzleId).toBe('old');
    expect(dueReview(items, '2026-10-19')).toBeUndefined();
  });
});
