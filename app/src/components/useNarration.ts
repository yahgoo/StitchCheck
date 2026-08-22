/* ── useNarration — local browser narration hook ──
 * Wraps the Web Speech API (speechSynthesis) with:
 *   - Single active utterance (no overlap).
 *   - Cancel-before-speak queue safety.
 *   - Graceful fallback when speechSynthesis is unavailable.
 *   - Deterministic narration strings.
 *   - No external network calls.
 *   - Never throws an uncaught error.
 *
 * This is purely a browser-local feature. It does not call, imply,
 * or represent any external provider (Gemini, Nosana, Atlas, OpenRouter).
 */

import { useState, useCallback, useRef, useEffect } from 'react';

/* ── Narration scene definitions ──
 * Deterministic text sourced from the presenter script.
 * Each key maps to a step in the demo flow.
 */
export const NARRATION_SCENES: Record<string, string> = {
  'safety-notice':
    'StitchCheck helps budget travelers understand the hidden risk of stitching two separately purchased flight tickets. This is a fictional demo with a fictional itinerary; live provider processing is used where explicitly labelled.',
  'upload':
    'The user starts with a fictional test itinerary. Select a fixture to populate the itinerary fields. The extraction label reads: Direct Gemini — live validated.',
  'review':
    'Extracted fields are displayed for human review. Every field is editable. The traveler confirms only what they have personally reviewed.',
  'confirmed':
    'The user clicks Confirm. The panels activate. The status banner states that no external service call was made. This confirmation gate keeps the traveler in control at every step.',
};

export type NarrationMode = 'off' | 'captions-only' | 'voice';
export type NarrationStatus = 'idle' | 'speaking' | 'unsupported' | 'error';

interface UseNarrationReturn {
  mode: NarrationMode;
  status: NarrationStatus;
  currentText: string;
  isSupported: boolean;
  setMode: (mode: NarrationMode) => void;
  speak: (sceneKey: string) => void;
  stop: () => void;
}

function getSpeechSynthesis(): SpeechSynthesis | null {
  try {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      return window.speechSynthesis;
    }
  } catch {
    /* speechSynthesis access can throw in some environments */
  }
  return null;
}

export function useNarration(): UseNarrationReturn {
  const [mode, setModeState] = useState<NarrationMode>('off');
  const [status, setStatus] = useState<NarrationStatus>('idle');
  const [currentText, setCurrentText] = useState<string>('');

  const synthRef = useRef<SpeechSynthesis | null>(getSpeechSynthesis());
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isSupported = synthRef.current !== null;

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => {
      try {
        synthRef.current?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, []);

  /* ── Stop speaking and reset ── */
  const stop = useCallback(() => {
    try {
      synthRef.current?.cancel();
    } catch {
      /* ignore */
    }
    utteranceRef.current = null;
    setStatus('idle');
    setCurrentText('');
  }, []);

  /* ── Mode setter with cleanup ── */
  const setMode = useCallback(
    (newMode: NarrationMode) => {
      if (newMode !== 'voice') {
        stop();
      }
      setModeState(newMode);
    },
    [stop],
  );

  /* ── Speak a scene ── */
  const speak = useCallback(
    (sceneKey: string) => {
      const text = NARRATION_SCENES[sceneKey];
      if (!text) return;

      setCurrentText(text);

      /* If mode is not voice, just show caption — don't speak */
      if (mode !== 'voice') return;

      const synth = synthRef.current;
      if (!synth) {
        setStatus('unsupported');
        return;
      }

      try {
        /* Cancel any in-progress speech to prevent overlap */
        synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;

        /* Try to pick an English voice if available */
        try {
          const voices = synth.getVoices();
          const enVoice = voices.find(
            (v) => v.lang.startsWith('en') && v.localService,
          );
          if (enVoice) {
            utterance.voice = enVoice;
          }
        } catch {
          /* getVoices can fail in some environments */
        }

        utterance.onstart = () => setStatus('speaking');
        utterance.onend = () => {
          setStatus('idle');
          utteranceRef.current = null;
        };
        utterance.onerror = () => {
          setStatus('error');
          utteranceRef.current = null;
          /* Recover to idle after a brief moment */
          setTimeout(() => setStatus('idle'), 1000);
        };

        utteranceRef.current = utterance;
        synth.speak(utterance);
      } catch {
        setStatus('error');
        setTimeout(() => setStatus('idle'), 1000);
      }
    },
    [mode],
  );

  return {
    mode,
    status,
    currentText,
    isSupported,
    setMode,
    speak,
    stop,
  };
}
