import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LEVELS, ORDER, isPlayable } from './levels/curriculum';
import { nextLevel, unlockedLevels } from './levels/unlock';
import { localDay } from './progress/streak';
import { displayStreak, finishIntro, getAllLevelProgress, getProfile, type LevelProgress, type Profile } from './progress/store';
import { setScene } from './sound/engine';
import { Home } from './ui/Home';
import { RiddleScreen } from './ui/riddle/RiddleScreen';
import { loadTodaysRiddle, type TodaysRiddle } from './ui/riddle/today';
import { Intro } from './ui/Intro';
import { LevelScreen } from './ui/level/LevelScreen';

/** Hash routes keep the PWA's back button working without a router: #/ and #/level/L08. */
function levelFromHash(): string | null {
  const m = location.hash.match(/^#\/level\/(L\d+)$/);
  return m && LEVELS[m[1]] ? m[1] : null;
}

/**
 * Goes back a page, or home if that does nothing (e.g. an installed app opened straight onto a level,
 * or a page that reloaded itself after an update).
 */
function goBackHome() {
  const from = location.hash;
  history.back();
  window.setTimeout(() => {
    if (location.hash === from) location.replace('#/');
  }, 300);
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
  const [welcome, setWelcome] = useState(() => location.hash === '#/welcome');
  const [riddleRoute, setRiddleRoute] = useState(() => location.hash === '#/riddle');
  const [riddle, setRiddle] = useState<TodaysRiddle | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<Record<string, LevelProgress>>({});
  const [all] = useState(unlockAll);

  const refresh = useCallback(async () => {
    const [p, levels] = await Promise.all([getProfile(), getAllLevelProgress()]);
    setProfile(p);
    setProgress(Object.fromEntries(levels.map((l) => [l.id, l])));
    // After progress, so a level passed just now can feed tomorrow's pick.
    setRiddle(await loadTodaysRiddle().catch(() => null));
  }, []);

  useEffect(() => {
    const onHash = () => {
      setLevelId(levelFromHash());
      setWelcome(location.hash === '#/welcome');
      setRiddleRoute(location.hash === '#/riddle');
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  // Music follows the screen: the theme at home, something quieter in a lesson.
  useEffect(() => setScene(levelId || riddleRoute ? 'level' : 'home'), [levelId, riddleRoute]);

  // Reload progress whenever we come back to the home screen.
  useEffect(() => {
    if (!levelId && !riddleRoute) refresh().catch((e) => console.error('Could not load progress', e));
  }, [levelId, riddleRoute, refresh]);

  const open = useMemo(
    () => unlockedLevels(ORDER, isPlayable, (id) => progress[id]?.bestStars ?? 0, all, profile?.startAt),
    [progress, all, profile?.startAt],
  );

  // Leaving a level pops history if we pushed it from home, so the back stack stays tidy.
  const cameFromHome = useRef(false);

  const start = (id: string) => {
    cameFromHome.current = true;
    location.hash = `#/level/${id}`;
  };

  const exit = () => {
    const back = cameFromHome.current;
    cameFromHome.current = false;
    if (back) goBackHome();
    else location.hash = '#/';
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

  if (riddleRoute) {
    return (
      <div className="app">
        <RiddleScreen onExit={exit} />
      </div>
    );
  }

  if (!profile) return <div className="app" />;

  // First visit (or opened from the home screen): the intro page.
  if (welcome || (!profile.introSeen && !profile.started)) {
    const begin = async (startAt?: string) => {
      setProfile(await finishIntro(startAt));
      start(startAt ?? ORDER.find((l) => isPlayable(l.id))!.id);
    };
    return <Intro returning={profile.introSeen || profile.started} onStart={begin} onBack={goBackHome} />;
  }

  return (
    <div className="app">
      <Home
        profile={profile}
        streak={displayStreak(profile)}
        progress={progress}
        open={open}
        riddle={riddle}
        streakAtRisk={displayStreak(profile) > 0 && profile.streak.lastDay !== localDay(new Date())}
        onStart={start}
        onRiddle={() => {
          cameFromHome.current = true;
          location.hash = '#/riddle';
        }}
      />
    </div>
  );
}
