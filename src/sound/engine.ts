import theme from '../../content/music/theme.json';
import { EMPTY_MANIFEST, parseManifest, type Cue, type SoundManifest, type Track } from './manifest';
import { playTheme, type MusicHandle } from './music';
import { murmurPlan, planLength, type Mood } from './murmur';
import { loadPrefs, savePrefs, type SoundPrefs } from './prefs';
import { synthCue, synthMurmur } from './synth';
import type { Theme } from './theme';

/**
 * The app's one audio graph: sound effects, Bapu's voice and music, each on its own bus.
 * Browsers only allow audio after a tap, so nothing plays until the first one.
 */

const LEVELS = { sfx: 0.8, voice: 0.8, music: 0.35 };
const TRACK_VOLUME: Record<Track, number> = { home: 1, level: 0.4 };
const SOUNDS = `${import.meta.env.BASE_URL}sounds/`;

let ctx: AudioContext | null = null;
let bus: { sfx: GainNode; voice: GainNode; music: GainNode } | null = null;
let manifest: SoundManifest = EMPTY_MANIFEST;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

let prefs = loadPrefs();
const listeners = new Set<() => void>();

export const getPrefs = () => prefs;

export function setPrefs(p: SoundPrefs) {
  prefs = p;
  savePrefs(p);
  if (p.voice !== 'read' && canReadAloud()) speechSynthesis.cancel();
  if (p.voice === 'off') hush();
  syncMusic();
  listeners.forEach((l) => l());
}

/** For useSyncExternalStore. */
export function onPrefs(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function running(): AudioContext | null {
  return ctx && ctx.state === 'running' && bus ? ctx : null;
}

function load(file: string): Promise<AudioBuffer | null> {
  let p = buffers.get(file);
  if (!p) {
    p = fetch(SOUNDS + file)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
      .then((b) => ctx!.decodeAudioData(b))
      .catch((e) => {
        console.warn(`Could not load sound ${file}`, e);
        return null;
      });
    buffers.set(file, p);
  }
  return p;
}

/* ---------- Sound effects ---------- */

const lastPlayed: Partial<Record<Cue, number>> = {};

/**
 * Plays a cue. A cue repeated within a moment is dropped (double taps, React's dev double
 * effects), and a small "correct" right after a "solved" is swallowed by it.
 */
export function play(cue: Cue, opts: { step?: number } = {}) {
  const c = running();
  if (!c || !prefs.sfx) return;
  const now = c.currentTime;
  if (now - (lastPlayed[cue] ?? -1) < 0.06) return;
  if (cue === 'correct' && now - (lastPlayed.solved ?? -1) < 0.4) return;
  lastPlayed[cue] = now;

  const file = manifest.cues[cue];
  if (!file) return synthCue(c, bus!.sfx, cue, opts.step);
  load(file).then((buf) => {
    if (!buf) return synthCue(c, bus!.sfx, cue, opts.step);
    const src = c.createBufferSource();
    src.buffer = buf;
    // A recorded success sound climbs with the run too.
    if (opts.step) src.playbackRate.value = 2 ** (Math.min(opts.step, 7) / 12);
    src.connect(bus!.sfx);
    src.start();
  });
}

/* ---------- Bapu's voice ---------- */

let line: GainNode | null = null;

/** Fades out whatever Bapu is saying. */
function hush() {
  if (!line || !ctx) return;
  line.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
  const old = line;
  setTimeout(() => old.disconnect(), 200);
  line = null;
}

let readVoice: SpeechSynthesisVoice | null | undefined;
function pickVoice(): SpeechSynthesisVoice | null {
  if (readVoice !== undefined) return readVoice;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null; // not loaded yet; try again next line
  const english = voices.filter((v) => v.lang.startsWith('en'));
  readVoice =
    english.find((v) => v.localService && /en-(GB|IN)/.test(v.lang)) ??
    english.find((v) => v.localService) ??
    english[0] ??
    null;
  return readVoice;
}

export const canReadAloud = () => typeof speechSynthesis !== 'undefined';

/**
 * Bapu says a line in the chosen voice. `delay` (seconds) lets a cue land first.
 * Returns roughly how long he'll talk, in ms, so his avatar can move along.
 */
export function speak(text: string, mood: Mood = 'neutral', delay = 0): number {
  if (!text || prefs.voice === 'off') return 0;

  if (prefs.voice === 'read') {
    if (!canReadAloud() || !ctx) return 0; // still needs the first tap
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = pickVoice();
    u.rate = 0.95;
    u.pitch = 0.8;
    speechSynthesis.speak(u);
    return text.split(/\s+/).length * 330;
  }

  const c = running();
  if (!c) return 0;
  hush();
  line = c.createGain();
  line.connect(bus!.voice);
  const plan = murmurPlan(text, mood);
  synthMurmur(c, line, plan, c.currentTime + delay + 0.01);
  return (planLength(plan) + delay) * 1000;
}

/* ---------- Music ---------- */

let scene: Track | null = null;
let playing: { track: Track; file: string | null; handle: MusicHandle } | null = null;
let manifestLoaded = false;

/** Sets which music fits the screen; it plays if the learner wants music and there's a track for it. */
export function setScene(track: Track | null) {
  scene = track;
  syncMusic();
}

/** A recorded track wins; with none, the home screen plays Bapu's theme from its hummed notes. */
function musicFor(track: Track): string | null | undefined {
  return manifest.music[track] ?? (track === 'home' ? null : undefined);
}

function stopMusic() {
  playing?.handle.stop();
  playing = null;
}

function syncMusic() {
  const c = running();
  if (!c || !manifestLoaded) return;
  const track = scene && prefs.music ? scene : null;
  const file = track ? musicFor(track) : undefined;
  if (!track || file === undefined) return stopMusic();
  if (playing?.track === track && playing.file === file) return;
  stopMusic();

  if (file === null) {
    playing = { track, file, handle: playTheme(c, bus!.music, theme as Theme, TRACK_VOLUME[track]) };
    return;
  }
  load(file).then((buf) => {
    // The screen may have changed while the file loaded.
    if (!buf || scene !== track || playing || !prefs.music) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.setTargetAtTime(TRACK_VOLUME[track], c.currentTime, 0.4);
    src.connect(gain).connect(bus!.music);
    src.start();
    playing = {
      track,
      file,
      handle: {
        stop(fade = 0.8) {
          gain.gain.setTargetAtTime(0, c.currentTime, fade / 3);
          src.stop(c.currentTime + fade + 0.1);
        },
      },
    };
  });
}

/* ---------- Start-up ---------- */

function unlock() {
  if (!ctx) {
    ctx = new AudioContext();
    const make = (v: number) => {
      const g = ctx!.createGain();
      g.gain.value = v;
      g.connect(ctx!.destination);
      return g;
    };
    bus = { sfx: make(LEVELS.sfx), voice: make(LEVELS.voice), music: make(LEVELS.music) };
    fetch(SOUNDS + 'sounds.json')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((j) => {
        manifest = parseManifest(j);
        manifestLoaded = true;
        Object.values(manifest.cues).forEach(load);
        syncMusic();
      })
      .catch(() => {});
  }
  if (ctx.state !== 'running') ctx.resume().then(syncMusic, () => {});
}

/** Wires up audio once, from main.tsx. */
export function initSound() {
  // iOS: respect the silent switch and mix with the learner's own music.
  const session = (navigator as { audioSession?: { type: string } }).audioSession;
  if (session) session.type = 'ambient';

  for (const ev of ['pointerdown', 'keydown'] as const) addEventListener(ev, unlock, { capture: true, passive: true });

  // A soft tick on every button, unless it opts out with data-sound="off".
  addEventListener(
    'click',
    (e) => {
      const el = (e.target as Element | null)?.closest?.('button, a[href]');
      if (el && !el.matches(':disabled, [data-sound="off"]')) play('tap');
    },
    { capture: true },
  );

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) {
      if (canReadAloud()) speechSynthesis.cancel();
      ctx.suspend().catch(() => {});
    } else ctx.resume().catch(() => {});
  });
}
