import { useCallback, useEffect, useRef, useState } from 'react';
import {
  claimCloudPlayback,
  fetchCloudSpeech,
  fetchTtsStatus,
  releaseCloudPlayback,
} from '../speech/cloudTts';

export interface UseSpeechSynthesisResult {
  /** Cloud TTS endpoint reachable / configured. */
  supported: boolean;
  ready: boolean;
  speaking: boolean;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  speak: (text: string) => void;
  stop: () => void;
  toggle: (text: string) => void;
}

/**
 * Cloud Latvian TTS (Google via `/api/tts`) — plays returned MP3.
 * Does not use device voices (avoids English mispronunciation).
 */
export function useSpeechSynthesis(): UseSpeechSynthesisResult {
  const [supported, setSupported] = useState(true);
  const [ready, setReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const activeTextRef = useRef<string | null>(null);
  const requestGen = useRef(0);
  const stopSelfRef = useRef<() => void>(() => undefined);

  const cleanupAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    audioRef.current = null;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    requestGen.current += 1;
    releaseCloudPlayback(stopSelfRef.current);
    cleanupAudio();
    activeTextRef.current = null;
    setSpeaking(false);
    setLoading(false);
  }, [cleanupAudio]);

  stopSelfRef.current = stop;

  useEffect(() => {
    let cancelled = false;
    void fetchTtsStatus().then((status) => {
      if (cancelled) return;
      setSupported(status.configured);
      setReady(true);
      if (!status.configured) {
        setError(
          'Noklausīšanās vēl nav ieslēgta šajā vidē (trūkst Google TTS atslēgas).',
        );
      }
    });
    return () => {
      cancelled = true;
      requestGen.current += 1;
      releaseCloudPlayback(stopSelfRef.current);
      cleanupAudio();
    };
  }, [cleanupAudio]);

  const speak = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Stops any other ListenButton, then reset this instance for a new clip.
      claimCloudPlayback(stopSelfRef.current);
      requestGen.current += 1;
      cleanupAudio();

      setError(null);
      setLoading(true);
      setSpeaking(false);
      activeTextRef.current = trimmed;
      const gen = requestGen.current;

      void (async () => {
        try {
          const blob = await fetchCloudSpeech(trimmed);
          if (gen !== requestGen.current) return;

          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;
          const audio = new Audio(url);
          audioRef.current = audio;

          audio.onended = () => {
            if (gen !== requestGen.current) return;
            releaseCloudPlayback(stopSelfRef.current);
            cleanupAudio();
            activeTextRef.current = null;
            setSpeaking(false);
            setLoading(false);
          };
          audio.onerror = () => {
            if (gen !== requestGen.current) return;
            releaseCloudPlayback(stopSelfRef.current);
            cleanupAudio();
            activeTextRef.current = null;
            setSpeaking(false);
            setLoading(false);
            setError('Neizdevās atskaņot skaņu.');
          };

          setLoading(false);
          setSpeaking(true);
          await audio.play();
        } catch (err) {
          if (gen !== requestGen.current) return;
          releaseCloudPlayback(stopSelfRef.current);
          cleanupAudio();
          activeTextRef.current = null;
          setSpeaking(false);
          setLoading(false);
          setError(
            err instanceof Error
              ? err.message
              : 'Neizdevās ielādēt noklausīšanos.',
          );
        }
      })();
    },
    [cleanupAudio],
  );

  const toggle = useCallback(
    (text: string) => {
      if (
        (speaking || loading) &&
        activeTextRef.current === text.trim()
      ) {
        stop();
        return;
      }
      speak(text);
    },
    [speaking, loading, speak, stop],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    supported,
    ready,
    speaking,
    loading,
    error,
    clearError,
    speak,
    stop,
    toggle,
  };
}
