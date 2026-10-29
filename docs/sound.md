# Sound

ApeChess ships with built-in sounds made in code (`src/sound/synth.ts`): wooden clacks for the board, a soft marimba for good moves, and Bapu's murmur. Recorded audio replaces any of them without code changes.

## Bapu's theme (from a hum)

The theme is a hummed tune turned into notes: `content/music/hum-B-major.mid`, a Surilo hum-to-notes export (B major, 100 BPM, melody over B · F#7 · E · B · E). `npm run theme` reads the newest `.mid` in `content/music/` (or the file you pass) and writes `content/music/theme.json`. From that data the app:

- plays the theme as looping home music, built in code. Each pass changes the arrangement (mallets, then reed and brushes, then mallets an octave up, then chords and bass alone) so the 12-second loop doesn't wear thin;
- plays the theme's first bar as the level-complete tune;
- keeps every cue in B major, the theme's key.

To change the theme, hum a new one, drop the `.mid` into `content/music/` and run `npm run theme`. Surilo's track names "Melody" and "Chords" are used when present. A recorded `music.home` in `sounds.json` (below) replaces the built-in arrangement.

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
| Home theme | `music.home` | 60–90 s, seamless loop | An arrangement of the hummed theme above (B major, 100 BPM). Gentle and curious. Plays on the home screen and the path. |
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
| `solved` | puzzle solved on the first try | < 800 ms | rising arpeggio; the app pitches it up for each one in a row, so record it starting on B (the theme key) |
| `wrong` | a mistake | < 400 ms | gentle "hmm, no", never a buzzer |
| `hint` | Bapu gives a hint | < 700 ms | a small bell: a lightbulb going on |
| `star` | each star on the summary | < 800 ms | a chime; the app raises it for star 2 and 3 |
| `complete` | level finished | 1–3 s | the theme's first bar as a short stinger (built in already) |

## Bapu's voice

Settings offer three voices:

- **Voice** (default): the device reads each line aloud in the most natural English voice it has (`src/sound/voices.ts` ranks them). Neural voices come first (Edge's "Natural" voices, Apple's "Enhanced" ones), then Chrome's Google voices, then the older built-in ones; a man's voice and a British or Indian accent are preferred, and joke voices are never used. Online-only voices are skipped offline, and a voice that fails is passed over. A device with no usable voice gets the murmur instead.
- **Murmur:** one sung syllable per word, shaped by the word's vowel (`src/sound/murmur.ts`). Works offline, and in any language.
- **Off.**

The synth murmur is a stand-in. The plan for a real voice is below: a recorded person, not a cloned or generated one.

## Recording checklist

What to record, most important first. Name the files as shown and send them over; wiring the voice clips in needs a small code change (the cues and music drop in through `sounds.json` already).

**Whose voice:** one person for all of Bapu: low, warm, a little amused, an older gentleman who enjoys his tea. Get their clear OK, in writing, that the recordings ship in an open-source (AGPL-3.0) app. The recordings themselves are brand assets, not AGPL (see `TRADEMARK.md`).

**How:** a quiet, soft-furnished room (a wardrobe full of clothes is perfect), the phone about 20 cm from the mouth, no music or fan. Record each take three times; the best one gets used. WAV or high-quality MP3, mono is fine. Leave half a second of silence around each take; the trimming happens later.

### 1. Bapu's voice (replaces the murmur) — 20 clips

**Vowel syllables (5).** The murmur sings one syllable per word; with these it uses his real voice instead of the synth. Say each one short and relaxed, like a syllable in the middle of a sentence, all at the same pitch and volume:

| File | Say |
|---|---|
| `voice-a.mp3` | "ah" (as in *father*) |
| `voice-e.mp3` | "eh" (as in *bed*) |
| `voice-i.mp3` | "ee" (as in *see*) |
| `voice-o.mp3` | "oh" (as in *go*) |
| `voice-u.mp3` | "oo" (as in *food*) |

**Reactions (15).** Short sounds and words that play at the start of Bapu's lines, with the murmur carrying the rest. They give him a personality without recording every sentence (his lines are generated from the position, so there are thousands).

| File | When | Say (or similar) |
|---|---|---|
| `voice-brilliant.mp3` | puzzle solved first try | "Brilliant!" |
| `voice-aha.mp3` | a good move | "Aha!" |
| `voice-very-good.mp3` | solved after a mistake | "Very good." |
| `voice-hmm-no.mp3` | a wrong move | a gentle "Hmm, no…" |
| `voice-careful.mp3` | a blunder against him | "Ooh. Careful." |
| `voice-hint.mp3` | a hint | "Here's a thought…" |
| `voice-thinking.mp3` | Bapu thinking in the final | a thoughtful "Hmmm…" |
| `voice-check.mp3` | Bapu gives check | "Check." |
| `voice-checkmate.mp3` | Bapu mates | "Checkmate." (kind, not gloating) |
| `voice-good-game.mp3` | end of the final | "Good game." |
| `voice-well-played.mp3` | the learner wins or draws | "Well played. Very well played." |
| `voice-chuckle.mp3` | jokes, the free-piece line | a warm chuckle |
| `voice-welcome.mp3` | home screen | "Welcome back!" |
| `voice-hello.mp3` | the very first visit | "Hello! I'm Bapu." |
| `voice-eyebrow.mp3` | Bapu raises an eyebrow | a curious "Hm?" |

### 2. Music — 1 track (2 optional)

See the music brief above: the home theme (`home-theme.mp3`, needed for a richer sound than the built-in one), and optionally a lesson bed (`lesson-bed.mp3`) and a slower, more focused version for the final game against Bapu (`game-bed.mp3`).

### 3. Sound effects — optional

The ten cues in the table above already have built-in sounds. Record any that sound thin to you; `move`, `capture` (wood on wood) and `solved` make the most difference. One addition for the final:

| File | When | Length | Feel |
|---|---|---|---|
| `game-over.mp3` | the final game ends | 1–2 s | a short, warm cadence on B: respectful, not a "you lose" sound |
