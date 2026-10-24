import { prepareSpeakableText } from './synthesis';

export interface TtsStatus {
  configured: boolean;
  provider?: string;
  voice?: string;
}

let statusCache: TtsStatus | null = null;
const audioCache = new Map<string, Blob>();

/** Only one listen clip at a time across multiple ListenButtons. */
type StopFn = () => void;
let stopActivePlayback: StopFn | null = null;

export function claimCloudPlayback(stop: StopFn): void {
  const prev = stopActivePlayback;
  if (prev && prev !== stop) {
    stopActivePlayback = null;
    prev();
  }
  stopActivePlayback = stop;
}

export function releaseCloudPlayback(stop: StopFn): void {
  if (stopActivePlayback === stop) {
    stopActivePlayback = null;
  }
}

export async function fetchTtsStatus(): Promise<TtsStatus> {
  if (statusCache) return statusCache;
  try {
    const res = await fetch('/api/tts', { method: 'GET' });
    if (!res.ok) {
      statusCache = { configured: false };
      return statusCache;
    }
    const data = (await res.json()) as TtsStatus;
    statusCache = {
      configured: Boolean(data.configured),
      provider: data.provider,
      voice: data.voice,
    };
    return statusCache;
  } catch {
    statusCache = { configured: false };
    return statusCache;
  }
}

export function clearTtsStatusCache(): void {
  statusCache = null;
}

/**
 * Request Latvian MP3 for exact `text` (not the whole page).
 * Uses a short in-memory cache for repeated listens in the same session.
 */
export async function fetchCloudSpeech(text: string): Promise<Blob> {
  const prepared = prepareSpeakableText(text);
  if (!prepared) {
    throw new Error('Tukšs teksts.');
  }

  const cached = audioCache.get(prepared);
  if (cached) return cached;

  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: prepared }),
  });

  if (!res.ok) {
    let message = 'Neizdevās ielādēt skaņu.';
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  if (blob.size === 0) {
    throw new Error('Saņemts tukšs audio.');
  }

  // Bound cache size (approx. last ~40 clips)
  if (audioCache.size > 40) {
    const first = audioCache.keys().next().value;
    if (first != null) audioCache.delete(first);
  }
  audioCache.set(prepared, blob);
  return blob;
}
