import { useCallback, useEffect, useRef, useState } from 'react';
import {
  dictationErrorMessage,
  getSpeechRecognitionCtor,
  isSpeechDictationSupported,
  normalizeDictationTranscript,
  type SpeechRecognitionLike,
} from '../speech/recognition';

export interface UseSpeechDictationOptions {
  /** BCP 47 language tag. Default Latvian. */
  lang?: string;
  /** Called with interim (partial) transcript while listening. */
  onInterim?: (text: string) => void;
  /** Called with final transcript when a phrase is recognized. */
  onResult: (text: string) => void;
  enabled?: boolean;
}

export interface UseSpeechDictationResult {
  supported: boolean;
  listening: boolean;
  error: string | null;
  errorCode: string | null;
  clearError: () => void;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

/**
 * Browser speech-to-text (Web Speech API) for short answer dictation.
 * Best support: Chromium. Safari varies. Firefox often unsupported.
 */
export function useSpeechDictation(
  options: UseSpeechDictationOptions,
): UseSpeechDictationResult {
  const { lang = 'lv-LV', onInterim, onResult, enabled = true } = options;
  const [supported] = useState(() => isSpeechDictationSupported());
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onInterimRef = useRef(onInterim);
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onInterimRef.current = onInterim;
    onResultRef.current = onResult;
  }, [onInterim, onResult]);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) {
      setListening(false);
      return;
    }
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
  }, []);

  const start = useCallback(() => {
    if (!enabled || !supported) return;
    setError(null);
    setErrorCode(null);

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    // One session at a time
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onend = () => {
      setListening(false);
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
    };

    recognition.onerror = (ev) => {
      const msg = dictationErrorMessage(ev.error);
      setErrorCode(ev.error);
      if (msg) setError(msg);
      else setError(null);
      setListening(false);
    };

    recognition.onresult = (ev) => {
      let interim = '';
      let finalText = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i];
        const piece = result[0]?.transcript ?? '';
        if (result.isFinal) finalText += piece;
        else interim += piece;
      }

      if (interim) {
        const normalized = normalizeDictationTranscript(interim);
        if (normalized) onInterimRef.current?.(normalized);
      }
      if (finalText) {
        const normalized = normalizeDictationTranscript(finalText);
        if (normalized) onResultRef.current(normalized);
      }
    };

    try {
      recognition.start();
    } catch {
      setErrorCode('start-failed');
      setError('Neizdevās sākt ierunāšanu.');
      setListening(false);
      recognitionRef.current = null;
    }
  }, [enabled, supported, lang]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  const clearError = useCallback(() => {
    setError(null);
    setErrorCode(null);
  }, []);

  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (!rec) return;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!enabled && listening) stop();
  }, [enabled, listening, stop]);

  return {
    supported: supported && enabled,
    listening,
    error,
    errorCode,
    clearError,
    start,
    stop,
    toggle,
  };
}
