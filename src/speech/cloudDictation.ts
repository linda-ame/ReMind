/**
 * iPhone / iPad cannot dictate Latvian with Safari.
 * This records the microphone and, about once a second, sends everything
 * said so far to /api/stt. The latest transcript is written into the field
 * while the person is still speaking.
 */

const TARGET_RATE = 16_000;
const MIN_SECONDS = 0.55;
const POLL_MS = 900;
const MAX_SECONDS = 18;
const SILENCE_RMS = 0.012;
const SILENCE_MS = 1400;

export interface CloudDictationHandlers {
  onInterim: (text: string) => void;
  onResult: (text: string) => void;
  onError: (message: string) => void;
}

export interface CloudDictationSession {
  /** Stop the microphone and submit whatever was recognized. */
  finish: () => void;
  /** Stop and discard. Used when the screen goes away. */
  abort: () => void;
}

export function startCloudDictation(
  handlers: CloudDictationHandlers,
): CloudDictationSession {
  const chunks: Int16Array[] = [];
  let samples = 0;
  let mode: 'live' | 'finish' | 'dead' = 'live';
  let lastText = '';
  let inFlight = false;
  let dirty = false;
  let sentSamples = 0;
  let quietSince = 0;
  let heardSpeech = false;
  let timer = 0;
  let failures = 0;
  let released = false;

  const streamPromise = navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new AudioContext();
  void audioContext.resume();

  let stream: MediaStream | null = null;
  let processor: ScriptProcessorNode | null = null;

  const session: CloudDictationSession = {
    finish: () => {
      if (mode !== 'live') return;
      mode = 'finish';
      releaseMic();
      void pump(true);
    },
    abort: () => {
      mode = 'dead';
      releaseMic();
    },
  };

  void streamPromise
    .then((media) => {
      if (mode === 'dead') {
        media.getTracks().forEach((track) => track.stop());
        void audioContext.close();
        return;
      }
      stream = media;
      const source = audioContext.createMediaStreamSource(media);
      processor = audioContext.createScriptProcessor(4096, 1, 1);
      const mute = audioContext.createGain();
      mute.gain.value = 0;
      source.connect(processor);
      processor.connect(mute);
      mute.connect(audioContext.destination);
      processor.onaudioprocess = (event) => {
        if (mode !== 'live') return;
        const channel = event.inputBuffer.getChannelData(0);
        noteLevel(channel);
        const pcm = downsample(channel, audioContext.sampleRate, TARGET_RATE);
        if (pcm.length === 0) return;
        chunks.push(pcm);
        samples += pcm.length;
        if (samples / TARGET_RATE >= MAX_SECONDS) {
          session.finish();
        }
      };
      timer = window.setInterval(() => {
        if (mode === 'live') void pump(false);
      }, POLL_MS);
    })
    .catch((err: unknown) => {
      mode = 'dead';
      void audioContext.close();
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        handlers.onError(
          'Mikrofona atļauja nav dota. Pieskarieties adreses joslai un iestatiet Mikrofons → Atļaut.',
        );
        return;
      }
      handlers.onError('Neizdevās ieslēgt mikrofonu.');
    });

  return session;

  function releaseMic() {
    if (released) return;
    released = true;
    window.clearInterval(timer);
    timer = 0;
    try {
      processor?.disconnect();
    } catch {
      /* already stopped */
    }
    processor = null;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    void audioContext.close().catch(() => undefined);
  }

  function noteLevel(channel: Float32Array) {
    let sum = 0;
    for (let i = 0; i < channel.length; i++) sum += channel[i] * channel[i];
    const rms = Math.sqrt(sum / Math.max(1, channel.length));
    const now = performance.now();
    if (rms >= SILENCE_RMS) {
      heardSpeech = true;
      quietSince = 0;
      return;
    }
    if (!heardSpeech) return;
    if (!quietSince) quietSince = now;
    if (lastText && now - quietSince >= SILENCE_MS) session.finish();
  }

  function ended() {
    return mode === 'dead';
  }

  async function pump(finalPass: boolean) {
    if (ended()) return;
    if (inFlight) {
      dirty = true;
      return;
    }
    if (samples < TARGET_RATE * MIN_SECONDS) {
      if (finalPass) finishWith(lastText);
      return;
    }
    if (!finalPass && samples === sentSamples) return;

    inFlight = true;
    dirty = false;
    const snapshot = samples;
    const audio = concatPcm(chunks, snapshot);
    try {
      const text = await postPcm(audio);
      if (ended()) return;
      sentSamples = Math.max(sentSamples, snapshot);
      failures = 0;
      if (text && text !== lastText) {
        lastText = text;
        if (mode === 'live') handlers.onInterim(text);
      }
    } catch (err) {
      if (ended()) return;
      failures += 1;
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Runas atpazīšana neizdevās.';
      const fatal =
        finalPass ||
        mode === 'finish' ||
        failures >= 3 ||
        message.includes('Speech-to-Text');
      if (fatal) {
        mode = 'dead';
        releaseMic();
        handlers.onError(message);
        return;
      }
    } finally {
      inFlight = false;
    }

    if (ended()) return;
    if (mode === 'finish') {
      if (dirty || samples > sentSamples) {
        void pump(true);
        return;
      }
      finishWith(lastText);
      return;
    }
    if (dirty) void pump(false);
  }

  function finishWith(text: string) {
    if (mode === 'dead') return;
    mode = 'dead';
    releaseMic();
    if (text) handlers.onResult(text);
    else handlers.onError('Nekas netika sadzirdēts. Runājiet tuvāk mikrofonam.');
  }
}

async function postPcm(pcm: Int16Array): Promise<string> {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const response = await fetch('/api/stt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio: bytesToBase64(bytes),
      sampleRate: TARGET_RATE,
    }),
  });
  const data = (await response.json().catch(() => null)) as {
    text?: unknown;
    error?: unknown;
  } | null;
  if (!response.ok) {
    const message =
      data && typeof data.error === 'string' && data.error
        ? data.error
        : 'Runas atpazīšana neizdevās.';
    throw new Error(message);
  }
  return data && typeof data.text === 'string' ? data.text.trim() : '';
}

function concatPcm(chunks: Int16Array[], sampleCount: number): Int16Array {
  const out = new Int16Array(sampleCount);
  let offset = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.length, sampleCount - offset);
    if (take <= 0) break;
    out.set(take === chunk.length ? chunk : chunk.subarray(0, take), offset);
    offset += take;
  }
  return out;
}

function downsample(
  input: Float32Array,
  inRate: number,
  outRate: number,
): Int16Array {
  if (inRate <= outRate) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = floatToInt16(input[i]);
    return out;
  }
  const ratio = inRate / outRate;
  const length = Math.floor(input.length / ratio);
  const out = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += input[j];
      count++;
    }
    out[i] = floatToInt16(count ? sum / count : 0);
  }
  return out;
}

function floatToInt16(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}
