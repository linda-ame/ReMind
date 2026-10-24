/** Shared text prep for TTS (cloud or local). */

/** Make blanks speakable as a short pause, not “underscore underscore”. */
export function prepareSpeakableText(raw: string): string {
  return raw
    .replace(/___+/g, ' … ')
    .replace(/\s+/g, ' ')
    .trim();
}
