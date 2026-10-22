# Sound

ApeChess ships with built-in sounds made in code (`src/sound/synth.ts`): wooden clacks for the board, a soft marimba for good moves, and Bapu's murmur. Recorded audio replaces any of them without code changes.

## Dropping in recorded audio

1. Put the files in `public/sounds/` (plain names like `home-theme.mp3`, no folders).
2. List them in `public/sounds/sounds.json`:

```json
{
  "cues": { "move": "move.mp3", "complete": "level-complete.mp3" },
  "music": { "home": "home-theme.mp3", "level": "lesson-bed.mp3" }
}
```

Anything not listed keeps its built-in sound. Unknown names and paths are ignored. Files are precached by the service worker, so they work offline (up to 8 MB each).

**Format:** MP3 (plays everywhere, including iPhones). Trim silence from the start of every cue. Keep peaks under -1 dBFS.

## Music brief (for Surilo)

The mood is Bapu: a well-read old gentleman in a tweed suit. Warm, witty, a little vintage, never babyish and never "video game". Think upright piano, clarinet, pizzicato strings, brushed drums, upright bass. A light Nepali touch (a madal groove, a bansuri phrase) would make it ours.

| Track | Key | Length | Notes |
|---|---|---|---|
| Home theme | `music.home` | 60–90 s, seamless loop | The tune people hum. Medium tempo (~95 BPM), gentle and curious. Plays on the home screen and the path. |
| Lesson bed | `music.level` | 2–3 min, seamless loop | Optional. Very sparse and calm, no melody that competes with thinking. Played quietly under puzzles. |

**Seamless loop:** the last bar must lead straight back into the first, with no fade-out and no reverb tail cut off. Export at about -16 LUFS.

## Sound effects (cues)

Optional: the built-in ones work. Replace any you want to sound richer. Keep cues short and all in one family (same instruments, same room).

| Cue | When | Length | Feel |
|---|---|---|---|
| `tap` | any button | < 50 ms | soft wooden tick, very quiet |
| `move` | a piece is played | < 100 ms | wooden piece set on a wooden board |
| `capture` | a piece is taken | < 150 ms | heavier double clack |
| `check` | a move gives check | < 300 ms | two-note alert, plays with the clack |
| `correct` | a good move mid-puzzle, or solved after a mistake | < 400 ms | two rising marimba notes |
| `solved` | puzzle solved on the first try | < 800 ms | rising arpeggio; the app pitches it up for each one in a row, so record it in C |
| `wrong` | a mistake | < 400 ms | gentle "hmm, no", never a buzzer |
| `hint` | Bapu gives a hint | < 700 ms | a small bell: a lightbulb going on |
| `star` | each star on the summary | < 800 ms | a chime; the app raises it for star 2 and 3 |
| `complete` | level finished | 1–3 s | short fanfare / stinger in the home theme's style |

## Bapu's voice

Settings offer three voices:

- **Murmur** (default): one sung syllable per word, shaped by the word's vowel (`src/sound/murmur.ts`). It follows every line Bapu's templates write, works offline, and will work for Nepali too.
- **Read aloud:** the device's own text-to-speech, for young readers.
- **Off.**

To give the murmur a real voice later, record a person saying "ah, eh, ee, oh, oo" in a low, warm, amused voice. The murmur can then play those clips instead of synth syllables.
