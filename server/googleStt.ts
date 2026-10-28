import { getGoogleTtsConfig } from './googleTts.js';

const RECOGNIZE_URL = 'https://speech.googleapis.com/v1/speech:recognize';

/** 16 kHz mono, 16-bit. About 20 seconds. */
const MAX_PCM_BYTES = 16_000 * 2 * 20;

export type SttResult =
  | { ok: true; text: string }
  | { ok: false; status: number; error: string };

/**
 * One short Latvian recognition. The phone sends the audio so far,
 * so the answer field can fill while the person is still speaking.
 * Same Google key as Klausīties; Speech-to-Text must be enabled on it.
 */
export async function recognizeLatvianPcm(
  pcm: Buffer,
  sampleRateHertz = 16_000,
): Promise<SttResult> {
  const cfg = getGoogleTtsConfig();
  if (!cfg) {
    return {
      ok: false,
      status: 503,
      error: 'Runas atpazīšana nav nokonfigurēta.',
    };
  }
  if (pcm.length < 2 || pcm.length % 2 !== 0) {
    return { ok: false, status: 400, error: 'Tukšs ieraksts.' };
  }
  if (pcm.length > MAX_PCM_BYTES) {
    return { ok: false, status: 400, error: 'Ieraksts ir par garu.' };
  }

  const url = `${RECOGNIZE_URL}?key=${encodeURIComponent(cfg.apiKey)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz,
          languageCode: 'lv-LV',
          enableAutomaticPunctuation: false,
        },
        audio: { content: pcm.toString('base64') },
      }),
    });
  } catch {
    return { ok: false, status: 502, error: 'Neizdevās sasniegt runas atpazīšanu.' };
  }

  const raw = await response.text();
  let data: {
    results?: { alternatives?: { transcript?: string }[] }[];
    error?: { message?: string; status?: string };
  } = {};
  try {
    data = raw ? (JSON.parse(raw) as typeof data) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const status = data.error?.status ?? '';
    if (response.status === 403 || status === 'PERMISSION_DENIED') {
      return {
        ok: false,
        status: 403,
        error:
          'Google kontā jāieslēdz Cloud Speech-to-Text. Klausīšanās atslēga viena pati to nedara.',
      };
    }
    return {
      ok: false,
      status: response.status,
      error: 'Runas atpazīšana neizdevās.',
    };
  }

  const text = (data.results ?? [])
    .map((result) => result.alternatives?.[0]?.transcript ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { ok: true, text };
}
