// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import { describe, expect, it } from 'vitest';
import { bestVoice, voiceScore, voiceTuning, type VoiceInfo } from './voices';

const v = (name: string, lang = 'en-US', localService = true): VoiceInfo => ({ name, lang, localService });

// Roughly what Windows Chrome, Edge, an iPhone and an Android phone offer.
const chrome = [
  v('Microsoft David - English (United States)'),
  v('Microsoft Zira - English (United States)'),
  v('Google US English', 'en-US', false),
  v('Google UK English Female', 'en-GB', false),
  v('Google UK English Male', 'en-GB', false),
  v('Google हिन्दी', 'hi-IN', false),
];
const edge = [...chrome.slice(0, 2), v('Microsoft Ryan Online (Natural) - English (United Kingdom)', 'en-GB', false), v('Microsoft Aria Online (Natural) - English (United States)', 'en-US', false)];
const iphone = [v('Albert'), v('Bad News'), v('Samantha'), v('Daniel', 'en-GB'), v('Daniel (Enhanced)', 'en-GB'), v('Rishi', 'en-IN')];

describe('choosing Bapu’s reading voice', () => {
  it('prefers natural voices, then Google’s, over the robotic built-in ones', () => {
    expect(bestVoice(edge)?.name).toMatch(/Ryan Online \(Natural\)/);
    expect(bestVoice(chrome)?.name).toBe('Google UK English Male');
    expect(bestVoice(iphone)?.name).toBe('Daniel (Enhanced)');
  });

  it('falls back to voices on the device when offline', () => {
    expect(bestVoice(chrome, false)?.name).toBe('Microsoft David - English (United States)');
    expect(bestVoice(edge, false)?.name).toMatch(/^Microsoft (David|Zira)/);
  });

  it('skips voices that failed', () => {
    expect(bestVoice(chrome, true, new Set(['Google UK English Male']))?.name).toBe('Google UK English Female');
  });

  it('never picks joke voices, eSpeak or other languages', () => {
    expect(voiceScore(v('Bad News'))).toBeNull();
    expect(voiceScore(v('eSpeak English', 'en'))).toBeNull();
    expect(voiceScore(v('Google हिन्दी', 'hi-IN', false))).toBeNull();
    expect(bestVoice([v('Zarvox'), v('Thomas', 'fr-FR')])).toBeUndefined();
  });

  it('leaves natural voices at their own pitch', () => {
    expect(voiceTuning(edge[2]).pitch).toBe(1);
    expect(voiceTuning(chrome[0]).pitch).toBeLessThan(1);
  });
});
