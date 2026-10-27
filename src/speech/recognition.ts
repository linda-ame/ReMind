/** Minimal Web Speech API typings (not in all TS DOM libs). */

export interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: { transcript: string };
}

export interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}

export interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechDictationSupported(): boolean {
  return getSpeechRecognitionCtor() != null;
}

/** Normalize a dictation transcript for a short rehab answer field. */
export function normalizeDictationTranscript(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export type MicrophonePermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

/**
 * Remember a successful dictation in this page load.
 * Safari often cannot answer permissions.query for the microphone,
 * so the in-app prompt would otherwise return before every answer.
 */
let micGrantedInPage = false;

export function markMicrophoneGrantedInPage(): void {
  micGrantedInPage = true;
}

export function microphoneGrantedInPage(): boolean {
  return micGrantedInPage;
}

export function clearMicrophoneGrantedInPage(): void {
  micGrantedInPage = false;
}

export function isMicrophonePermissionError(code: string | null): boolean {
  return code === 'not-allowed' || code === 'service-not-allowed';
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

/** `unknown` when the browser has no microphone entry in the Permissions API (Safari). */
export async function queryMicrophonePermission(): Promise<MicrophonePermissionState> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unknown';
  }
  try {
    const status = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });
    if (
      status.state === 'granted' ||
      status.state === 'denied' ||
      status.state === 'prompt'
    ) {
      return status.state;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export function dictationErrorMessage(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Mikrofona atļauja nav dota. Atļaujiet mikrofonu pārlūkā.';
    case 'no-speech':
      return 'Nekas netika sadzirdēts. Mēģiniet vēlreiz.';
    case 'audio-capture':
      return 'Mikrofons nav pieejams.';
    case 'network':
      return 'Nav savienojuma ar runas atpazīšanu. Pārbaudiet internetu.';
    case 'aborted':
      return '';
    default:
      return 'Runas atpazīšana neizdevās. Mēģiniet vēlreiz.';
  }
}
