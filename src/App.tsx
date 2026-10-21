import { useCallback, useEffect, useRef, useState } from 'react';
import { LEVELS } from './levels/curriculum';
import { displayStreak, getAllLevelProgress, getProfile, type LevelProgress, type Profile } from './progress/store';
import { Home } from './ui/Home';
import { LevelScreen } from './ui/level/LevelScreen';

/** Hash routes keep the PWA's back button working without a router: #/ and #/level/L08. */
function levelFromHash(): string | null {
  const m = location.hash.match(/^#\/level\/(L\d+)$/);
  return m && LEVELS[m[1]] ? m[1] : null;
}

export default function App() {
  const [levelId, setLevelId] = useState<string | null>(levelFromHash);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<Record<string, LevelProgress>>({});

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
    return (
      <div className="app">
        <LevelScreen key={levelId} level={LEVELS[levelId]} onExit={exit} />
      </div>
    );
  }

  return (
    <div className="app">
      {profile && <Home profile={profile} streak={displayStreak(profile)} progress={progress} onStart={start} />}
    </div>
  );
}
