type ToneFn = (
  freq: number,
  start: number,
  dur: number,
  gain: number,
  type?: OscillatorType,
) => void;

function withAudioContext(
  play: (ctx: AudioContext, now: number, tone: ToneFn) => number,
): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const tone: ToneFn = (freq, start, dur, gain, type = 'sine') => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    };

    const closeMs = play(ctx, now, tone);
    window.setTimeout(() => {
      void ctx.close();
    }, closeMs);
  } catch {
    /* ignore */
  }
}

/**
 * Soft “correct” chime via Web Audio (no asset files).
 * Safe no-op if AudioContext is unavailable or autoplay is blocked.
 */
export function playCorrectChime(): void {
  withAudioContext((_ctx, now, tone) => {
    // Soft two-note rise
    tone(523.25, now, 0.12, 0.08); // C5
    tone(659.25, now + 0.1, 0.18, 0.07); // E5
    return 400;
  });
}

/**
 * Soft “wrong” buzz — short descending tones (no asset files).
 */
export function playWrongBuzz(): void {
  withAudioContext((_ctx, now, tone) => {
    tone(311.13, now, 0.14, 0.07, 'triangle'); // E♭4
    tone(233.08, now + 0.12, 0.2, 0.06, 'triangle'); // B♭3
    return 450;
  });
}
