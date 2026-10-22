import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { canReadAloud, getPrefs, onPrefs, setPrefs, speak } from '../sound/engine';
import type { SoundPrefs, VoiceMode } from '../sound/prefs';
import { Speaker } from './icons';
import './sound.css';

const VOICES: { mode: VoiceMode; label: string }[] = [
  { mode: 'murmur', label: 'Murmur' },
  { mode: 'read', label: 'Read aloud' },
  { mode: 'off', label: 'Off' },
];

function Switch({ label, note, on, onChange }: { label: string; note?: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="sound-row">
      <span>
        {label}
        {note && <small>{note}</small>}
      </span>
      <input type="checkbox" role="switch" className="switch" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** The speaker chip on the home bar, and its settings panel. */
export function SoundSettings() {
  const prefs = useSyncExternalStore(onPrefs, getPrefs);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const update = (p: Partial<SoundPrefs>) => setPrefs({ ...prefs, ...p });
  const silent = !prefs.sfx && !prefs.music && prefs.voice === 'off';

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    addEventListener('pointerdown', away);
    addEventListener('keydown', esc);
    return () => {
      removeEventListener('pointerdown', away);
      removeEventListener('keydown', esc);
    };
  }, [open]);

  const voices = VOICES.filter((v) => v.mode !== 'read' || canReadAloud());

  return (
    <div className="sound" ref={root}>
      <button
        className="chip chip-sound"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Sound settings"
      >
        <Speaker size={18} muted={silent} />
      </button>
      {open && (
        <div className="sound-panel" role="dialog" aria-label="Sound settings">
          <Switch label="Sound effects" on={prefs.sfx} onChange={(sfx) => update({ sfx })} />
          <Switch label="Music" note="Bapu’s theme, on the home screen" on={prefs.music} onChange={(music) => update({ music })} />
          <div className="sound-row sound-voice">
            <span>Bapu’s voice</span>
            <div className="segmented" role="radiogroup" aria-label="Bapu’s voice">
              {voices.map((v) => (
                <button
                  key={v.mode}
                  role="radio"
                  aria-checked={prefs.voice === v.mode}
                  className={prefs.voice === v.mode ? 'on' : ''}
                  onClick={() => {
                    setPrefs({ ...prefs, voice: v.mode });
                    speak(v.mode === 'read' ? 'Like this. Shall we play?' : 'Hello there! Shall we play?');
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
