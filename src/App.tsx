import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LEVELS, ORDER, isPlayable } from './levels/curriculum';
import { nextLevel, unlockedLevels } from './levels/unlock';
import { displayStreak, getAllLevelProgress, getProfile, type LevelProgress, type Profile } from './progress/store';
import { Home } from './ui/Home';
import { LevelScreen } from './ui/level/LevelScreen';

/** Hash routes keep the PWA's back button working without a router: #/ and #/level/L08. */
function levelFromHash(): string | null {
  const m = location.hash.match(/^#\/level\/(L\d+)$/);
  return m && LEVELS[m[1]] ? m[1] : null;
}

/**
 * Opening the app with ?unlock=all opens every built level on this device (handy for testing);
 * ?unlock=off turns it back off.
 */
function unlockAll(): boolean {
  try {
    const flag = new URLSearchParams(location.search).get('unlock');
    if (flag === 'all') localStorage.setItem('apechess.unlockAll', '1');
    if (flag === 'off') localStorage.removeItem('apechess.unlockAll');
    return localStorage.getItem('apechess.unlockAll') === '1';
  } catch {
    return false;
  }
}

export default function App() {
  const [levelId, setLevelId] = useState<string | null>(levelFromHash);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<Record<string, LevelProgress>>({});
  const [all] = useState(unlockAll);

  const refresh = useCallback(async () => {
    const [p, levels] = await Promise.all([getProfile(), getAllLevelProgress()]);
    setProfile(p);
    setProgress(Object.fromEntries(levels.map((l) => [l.id, l])));
  }, []);

  useEffect(() => {
    const onHash = () => setLevelId(levelFromHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  // Reload progress whenever we come back to the home screen.
  useEffect(() => {
    if (!levelId) refresh().catch((e) => console.error('Could not load progress', e));
  }, [levelId, refresh]);

  const open = useMemo(
    () => unlockedLevels(ORDER, isPlayable, (id) => progress[id]?.bestStars ?? 0, all),
    [progress, all],
  );

  // Leaving a level pops history if we pushed it from home, so the back stack stays tidy.
  const cameFromHome = useRef(false);

  const start = (id: string) => {
    cameFromHome.current = true;
    location.hash = `#/level/${id}`;
  };

  const exit = () => {
    if (cameFromHome.current) history.back();
    else location.hash = '#/';
    cameFromHome.current = false;
  };

  if (levelId) {
    const next = nextLevel(ORDER, levelId, isPlayable);
    // Replace the route so Back from the next level still goes home.
    const goNext = next ? () => location.replace(`#/level/${next}`) : undefined;
    return (
      <div className="app">
        <LevelScreen key={levelId} level={LEVELS[levelId]} onExit={exit} onNext={goNext} />
      </div>
    );
  }

  return (
    <div className="app">
      {profile && <Home profile={profile} streak={displayStreak(profile)} progress={progress} open={open} onStart={start} />}
    </div>
  );
}
