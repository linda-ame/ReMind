const LATVIAN = /^lv([_-]|$)/i;

export function pickLatvianVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  const latvian = voices.filter((voice) => LATVIAN.test(voice.lang));
  if (latvian.length === 0) return null;
  return latvian.find((voice) => voice.localService) ?? latvian[0]!;
}

export function latvianSpeechAvailable(): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  return pickLatvianVoice(window.speechSynthesis.getVoices()) != null;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function speakOne(
  text: string,
  voice: SpeechSynthesisVoice,
  generation: { cancelled: boolean },
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (generation.cancelled) {
      resolve();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'lv-LV';
    utterance.voice = voice;
    utterance.rate = 0.9;
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error('speech-failed'));
    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Speak segments with a Latvian voice only.
 * Resolves false when playback was cancelled or no lv-LV voice exists.
 * Never falls back to another language.
 */
export async function speakLatvianSegments(
  segments: string[],
  generation: { cancelled: boolean },
  onStart?: () => void,
): Promise<boolean> {
  const synth = window.speechSynthesis;
  if (!synth) return false;
  const voice = pickLatvianVoice(synth.getVoices());
  if (!voice) return false;
  onStart?.();
  const pause = segments.every((segment) => /^\d$/.test(segment.trim()))
    ? 700
    : 850;
  try {
    for (let i = 0; i < segments.length; i++) {
      if (generation.cancelled) return false;
      await speakOne(segments[i]!.trim(), voice, generation);
      if (i < segments.length - 1) await wait(pause);
    }
    return !generation.cancelled;
  } catch {
    synth.cancel();
    return false;
  }
}

export function stopLatvianSpeech(): void {
  window.speechSynthesis?.cancel();
}
