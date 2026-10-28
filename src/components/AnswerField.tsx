import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { useSpeechDictation } from '../hooks/useSpeechDictation';
import {
  clearMicrophoneGrantedInPage,
  isIosDevice,
  isMicrophonePermissionError,
  markMicrophoneGrantedInPage,
  microphoneGrantedInPage,
  queryMicrophonePermission,
  type MicrophonePermissionState,
} from '../speech/recognition';
import type { AnswerInputFeedback } from '../utils/answers';
import { Button } from './Button';

interface AnswerFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /**
   * Keyboard Enter, the green Pārbaudīt button while the keyboard is open,
   * or a final speech dictation result.
   * Checks the answer and stays on the task. Value is the submitted text.
   */
  onSubmit?: (value: string) => void;
  placeholder?: string;
  label?: string;
  /** Accessible name when no visible label */
  ariaLabel?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  /** Soft field tint after submit; omit / null keeps white. */
  feedback?: AnswerInputFeedback | null;
  /**
   * When false, Pārbaudīt looks quiet until the answer is complete.
   * Enter and the button still run, so the task can show why it waited.
   */
  submitReady?: boolean;
  /** Tall wrapping box. Enter still confirms; the text wraps on its own. */
  multiline?: boolean;
  rows?: number;
  className?: string;
  inputClassName?: string;
}

/**
 * Typed answer field with optional “Ierunāt” speech-to-text control.
 * Hidden when the browser has no SpeechRecognition support.
 */
export function AnswerField({
  id,
  value,
  onChange,
  onSubmit,
  placeholder = 'Ierakstiet atbildi…',
  label,
  ariaLabel,
  readOnly = false,
  autoFocus = false,
  inputRef: externalInputRef,
  feedback = null,
  submitReady = true,
  multiline = false,
  rows = 4,
  className = '',
  inputClassName = '',
}: AnswerFieldProps) {
  const localInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef ?? localInputRef;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const finish = (text: string) => {
    if (readOnly) return;
    inputRef.current?.blur();
    textareaRef.current?.blur();
    onSubmitRef.current?.(text);
  };

  const dictation = useSpeechDictation({
    lang: 'lv-LV',
    enabled: !readOnly,
    onInterim: (text) => {
      onChange(text);
    },
    onResult: (text) => {
      onChange(text);
      // Same as Enter: dismiss keyboard path + reveal answers
      finish(text);
    },
  });

  useEffect(() => {
    if (autoFocus && !readOnly) inputRef.current?.focus();
  }, [autoFocus, readOnly, inputRef]);

  const [fieldFocused, setFieldFocused] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  /** In-app step before the browser/OS microphone prompt. */
  const [micDialog, setMicDialog] = useState<
    null | 'ask' | 'asking' | 'again' | 'blocked' | 'speech'
  >(null);
  const allowMicRef = useRef<HTMLButtonElement>(null);
  const micTitleId = useId();
  const [knownPerm, setKnownPerm] = useState<MicrophonePermissionState | null>(
    null,
  );

  useEffect(() => {
    let cancel = false;
    void queryMicrophonePermission().then((perm) => {
      if (!cancel) setKnownPerm(perm);
    });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setKeyboardOpen(root.classList.contains('keyboard-open'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const { listening, stop } = dictation;
  const showEnter =
    keyboardOpen && fieldFocused && !listening && !readOnly;
  const waiting = showEnter && !submitReady;

  useEffect(() => {
    if (!dictation.listening) return;
    markMicrophoneGrantedInPage();
    setMicDialog(null);
  }, [dictation.listening]);

  useEffect(() => {
    if (!isMicrophonePermissionError(dictation.errorCode)) return;
    clearMicrophoneGrantedInPage();
    setMicDialog(isIosDevice() ? 'speech' : 'blocked');
  }, [dictation.errorCode]);

  useEffect(() => {
    if (!micDialog || !dictation.errorCode) return;
    if (isMicrophonePermissionError(dictation.errorCode)) return;
    if (dictation.errorCode === 'aborted') return;
    setMicDialog(null);
  }, [dictation.errorCode, micDialog]);

  useEffect(() => {
    if (!micDialog) return;
    allowMicRef.current?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMicDialog(null);
      dictation.clearError();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [micDialog, dictation.clearError]);

  const closeMicDialog = () => {
    setMicDialog(null);
    dictation.clearError();
    if (dictation.listening) dictation.stop();
  };

  const allowMicrophone = () => {
    dictation.clearError();
    if (micDialog !== 'again') setMicDialog('asking');
    dictation.start();
  };

  const onDictate = () => {
    if (dictation.listening) {
      dictation.stop();
      return;
    }
    dictation.clearError();
    if (isIosDevice()) {
      // iPhone records and fills the field from the cloud while speaking.
      // The microphone request has to start inside this tap.
      dictation.start();
      return;
    }
    // start() has to run inside this tap. Waiting for the permission check
    // first makes iOS Safari ignore the microphone even when it is Allow.
    if (microphoneGrantedInPage() || knownPerm === 'granted') {
      dictation.start();
      return;
    }
    if (knownPerm === 'denied') {
      clearMicrophoneGrantedInPage();
      setMicDialog('blocked');
      return;
    }
    setMicDialog('ask');
  };
  // Stop listening if the field becomes read-only mid-session
  useEffect(() => {
    if (readOnly && listening) stop();
  }, [readOnly, listening, stop]);

  const fieldClass = [
    'text-input',
    'text-input-answer',
    'answer-field-input',
    inputClassName,
    feedback ? `text-input-answer-${feedback}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const onFieldChange = (next: string) => {
    if (readOnly) return;
    if (dictation.listening) dictation.stop();
    onChange(next);
  };

  const onFieldKeyDown = (
    e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (dictation.listening) dictation.stop();
    finish(valueRef.current);
  };

  return (
    <div className={['answer-field', className].filter(Boolean).join(' ')}>
      {label ? (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      ) : null}

      <div className="answer-field-row">
        {multiline ? (
          <textarea
            ref={textareaRef}
            id={id}
            className={fieldClass}
            value={value}
            rows={rows}
            placeholder={placeholder}
            aria-label={label ? undefined : (ariaLabel ?? 'Atbilde')}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            readOnly={readOnly || dictation.listening}
            aria-readonly={readOnly || dictation.listening || undefined}
            lang="lv"
            onFocus={() => setFieldFocused(true)}
            onBlur={() => setFieldFocused(false)}
            onChange={(e) => onFieldChange(e.target.value)}
            onKeyDown={onFieldKeyDown}
          />
        ) : (
          <input
            ref={inputRef}
            id={id}
            className={fieldClass}
            type="text"
            value={value}
            placeholder={placeholder}
            aria-label={label ? undefined : (ariaLabel ?? 'Atbilde')}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            readOnly={readOnly || dictation.listening}
            aria-readonly={readOnly || dictation.listening || undefined}
            onFocus={() => setFieldFocused(true)}
            onBlur={() => setFieldFocused(false)}
            onChange={(e) => onFieldChange(e.target.value)}
            onKeyDown={onFieldKeyDown}
          />
        )}

        {dictation.supported || showEnter ? (
          <Button
            variant={dictation.listening ? 'danger' : 'help'}
            fullWidth={false}
            className={`answer-dictate-btn${dictation.listening ? ' is-listening' : ''}${waiting ? ' is-idle' : ''}`}
            aria-disabled={waiting || undefined}
            aria-pressed={dictation.listening}
            aria-label={
              dictation.listening
                ? 'Apturēt ierunāšanu'
                : showEnter
                  ? 'Pārbaudīt atbildi'
                  : 'Ierunāt atbildi'
            }
            onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
              // Keep the field focused so the keyboard stays open until submit.
              if (showEnter) event.preventDefault();
            }}
            onClick={() => {
              if (showEnter) {
                finish(valueRef.current);
                return;
              }
              onDictate();
            }}
          >
            {dictation.listening ? 'Apturēt' : showEnter ? 'Pārbaudīt' : 'Ierunāt'}
          </Button>
        ) : null}
      </div>

      <p
        className="answer-dictate-status"
        aria-live="polite"
        aria-atomic="true"
      >
        {dictation.listening
          ? 'Klausos… runājiet skaļi.'
          : micDialog
            ? ''
            : (dictation.error ?? '')}
      </p>

      {micDialog ? (
        <div
          className="mic-permission-backdrop"
          onClick={closeMicDialog}
        >
          <div
            className="mic-permission-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={micTitleId}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={micTitleId} className="mic-permission-title">
              {micDialog === 'again'
                ? 'Mikrofons ir atļauts'
                : micDialog === 'speech'
                  ? 'iPhone neprot ierunāt latviski'
                  : micDialog === 'blocked'
                    ? 'Mikrofons ir bloķēts'
                    : 'Mikrofons'}
            </h2>
            <p className="mic-permission-text">
              {micDialog === 'again'
                ? 'Nospiediet Ierunāt vēlreiz un runājiet.'
                : micDialog === 'speech'
                  ? 'Safari mikrofonu jau drīkst. Latviešu ierunāšanu iPhone nepiedāvā. Atbildi ieraksti ar tastatūru.'
                  : micDialog === 'blocked'
                  ? 'Atļaujas logs vairs neatveras. Ierīces iestatījumos atļaujiet mikrofonu šai lapai un nospiediet vēlreiz.'
                  : micDialog === 'asking'
                    ? 'Atveras atļaujas logs. Nospiediet Atļaut.'
                    : 'Lai ierunātu atbildi, atļaujiet mikrofonu. Pēc tam parādīsies ierīces logs.'}
            </p>
            <div className="mic-permission-actions">
              <Button
                ref={allowMicRef}
                variant="primary"
                disabled={micDialog === 'asking'}
                onClick={
                  micDialog === 'speech' ? closeMicDialog : allowMicrophone
                }
              >
                {micDialog === 'again'
                  ? 'Ierunāt'
                  : micDialog === 'speech'
                    ? 'Aizvērt'
                    : micDialog === 'blocked'
                      ? 'Mēģināt vēlreiz'
                      : 'Atļaut mikrofonu'}
              </Button>
              {micDialog === 'speech' ? null : (
              <Button variant="neutral" onClick={closeMicDialog}>
                {micDialog === 'blocked' || micDialog === 'again'
                  ? 'Aizvērt'
                  : 'Atcelt'}
              </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
