import { useSyncExternalStore } from 'react';
import { BAPU } from '../bapu/BapuBubble';
import { LEVELS, UNITS } from '../levels/curriculum';
import { RANKS, notebookPages, rankFor } from '../levels/notebook';
import { getAccount, onAccount } from '../progress/cloud';
import type { LevelProgress } from '../progress/store';
import { Close, Cloud, Lock } from './icons';
import './level/level.css';
import './notebook.css';

interface Props {
  progress: Record<string, LevelProgress>;
  onExit: () => void;
  onBackup: () => void;
}

/** Every rule Bapu has taught, one page per finished level, and the learner's rank. */
export function Notebook({ progress, onExit, onBackup }: Props) {
  const account = useSyncExternalStore(onAccount, getAccount);
  const best = (id: string) => progress[id]?.bestStars ?? 0;
  const pages = notebookPages(UNITS, LEVELS, best);
  const rank = rankFor(UNITS, LEVELS, best);
  const earned = pages.filter((p) => p.earned).length;

  return (
    <div className="level notebook">
      <header className="level-bar">
        <button className="icon-btn" onClick={onExit} aria-label="Close notebook">
          <Close size={22} />
        </button>
        <span className="riddle-title">Bapu’s notebook</span>
        <span className="level-phase">
          {earned}/{pages.length} pages
        </span>
      </header>

      <main className="level-main notebook-main">
        <section className="rank-card" aria-label="Your rank">
          <img src={BAPU.head} alt="" width={56} height={56} />
          <div>
            <span className="rank-tag">Your rank</span>
            <strong>{rank.title}</strong>
            <small>
              {rank.next
                ? `${rank.next.levelsLeft} more level${rank.next.levelsLeft === 1 ? '' : 's'} to ${rank.next.title}`
                : 'The top of the tree. Bapu tips his spectacles to you.'}
            </small>
          </div>
          <ol className="rank-ladder" aria-hidden="true">
            {RANKS.map((r, i) => (
              <li key={r} className={i <= rank.units ? 'on' : ''} title={r} />
            ))}
          </ol>
        </section>

        {UNITS.map((u) => {
          const unitPages = pages.filter((p) => p.unit === u.number);
          if (!unitPages.length) return null;
          return (
            <section key={u.number} className="notebook-unit">
              <h2>
                <span>Unit {u.number}</span> {u.title}
              </h2>
              {unitPages.map((p) => (
                <article key={p.levelId} className={`page ${p.earned ? '' : 'page-locked'}`}>
                  <span className="page-head">
                    Level {p.number} · {p.title}
                  </span>
                  {p.earned ? (
                    <>
                      <p className="page-rule">{p.rule}</p>
                      {p.term && (
                        <p className="page-term">
                          <strong>{p.term.term}:</strong> {p.term.definition}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="page-rule">
                      <Lock size={16} /> Finish Level {p.number} to add this page.
                    </p>
                  )}
                </article>
              ))}
            </section>
          );
        })}

        {account.status !== 'off' && (
          <button className="notebook-backup" onClick={onBackup}>
            <Cloud size={20} />
            <span>
              {account.status === 'signed-in' ? `Backed up to ${account.email}` : 'This notebook lives on this device. Back it up?'}
            </span>
          </button>
        )}
      </main>
    </div>
  );
}
