/** Google Cloud Text-to-Speech (Latvian Standard) — Vercel `/api/tts` + Vite dev. */

export const TTS_MAX_CHARS = 2500;
/** Standard voice = larger free tier than WaveNet/Neural. */
export const GOOGLE_LV_VOICE = 'lv-LV-Standard-A';

export function getGoogleTtsConfig(): { apiKey: string } | null {
  const apiKey =
    process.env.GOOGLE_TTS_API_KEY?.trim() ||
    process.env.GOOGLE_CLOUD_API_KEY?.trim() ||
    '';
  if (!apiKey) return null;
  return { apiKey };
}

/** Blanks → short pause; collapse whitespace. */
export function prepareTtsText(raw: string): string {
  return raw
    .replace(/___+/g, ' … ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type GoogleTtsResult =
  | { ok: true; audio: Buffer; contentType: string }
  | { ok: false; status: number; error: string };

/**
 * Synthesize Latvian speech via Google Cloud Text-to-Speech REST API.
 * @see https://cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize
 */
export async function synthesizeGoogleMp3(
  text: string,
  config = getGoogleTtsConfig(),
): Promise<GoogleTtsResult> {
  if (!config) {
    return {
      ok: false,
      status: 503,
      error: 'Noklausīšanās nav iestatīta (trūkst Google TTS atslēgas).',
    };
  }

  const prepared = prepareTtsText(text);
  if (!prepared) {
    return { ok: false, status: 400, error: 'Tukšs teksts.' };
  }
  if (prepared.length > TTS_MAX_CHARS) {
    return {
      ok: false,
      status: 400,
      error: `Teksts ir pārāk garš (maks. ${TTS_MAX_CHARS} rakstzīmes).`,
    };
  }

  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(config.apiKey)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: prepared },
        voice: {
          languageCode: 'lv-LV',
          name: GOOGLE_LV_VOICE,
        },
        audioConfig: {
          audioEncoding: 'MP3',
          // Slightly slow for clearer rehab listening (1.0 = normal).
          speakingRate: 0.7,
        },
      }),
    });
  } catch {
    return {
      ok: false,
      status: 502,
      error: 'Neizdevās savienoties ar runas pakalpojumu.',
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: 502,
      error: `Runas pakalpojuma kļūda (${response.status}).`,
    };
  }

  let payload: { audioContent?: string };
  try {
    payload = (await response.json()) as { audioContent?: string };
  } catch {
    return { ok: false, status: 502, error: 'Nederīga atbilde no runas pakalpojuma.' };
  }

  if (!payload.audioContent) {
    return { ok: false, status: 502, error: 'Saņemts tukšs audio.' };
  }

  const audio = Buffer.from(payload.audioContent, 'base64');
  if (audio.byteLength === 0) {
    return { ok: false, status: 502, error: 'Saņemts tukšs audio.' };
  }

  return { ok: true, audio, contentType: 'audio/mpeg' };
}
