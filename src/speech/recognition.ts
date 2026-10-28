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
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return true;
  // iPadOS can report itself as a Mac. Touch points tell those iPads apart.
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

let micPromptAccepted = false;

/** True after this page has passed the iOS system microphone prompt. */
export function hasMicrophonePrompt(): boolean {
  return micPromptAccepted;
}

export type MicrophoneRequestResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Must be called directly from a tap. This is what makes Safari appear under
 * Settings → Privacy & Security → Microphone and shows the system Allow sheet.
 */
export function requestMicrophoneFromGesture(): Promise<MicrophoneRequestResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return Promise.resolve({ ok: false, reason: 'nav' });
  }
  return navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      for (const track of stream.getTracks()) track.stop();
      micPromptAccepted = true;
      return { ok: true as const };
    })
    .catch((error: unknown) => ({
      ok: false as const,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
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
