import { useEffect, useRef, type RefObject } from 'react';
import { useSpeechDictation } from '../hooks/useSpeechDictation';
import { Button } from './Button';

interface AnswerFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /**
   * Enter key, or final speech dictation result.
   * Use to reveal answers / give feedback. Value is the submitted text.
   */
  onSubmit?: (value: string) => void;
  placeholder?: string;
  label?: string;
  /** Accessible name when no visible label */
  ariaLabel?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
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
}: AnswerFieldProps) {
  const localInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef ?? localInputRef;
  const valueRef = useRef(value);
  valueRef.current = value;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const finish = (text: string) => {
    if (readOnly) return;
    inputRef.current?.blur();
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

  const { listening, stop } = dictation;
  // Stop listening if the field becomes read-only mid-session
  useEffect(() => {
    if (readOnly && listening) stop();
  }, [readOnly, listening, stop]);

  return (
    <div className="answer-field">
      {label ? (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      ) : null}

      <div className="answer-field-row">
        <input
          ref={inputRef}
          id={id}
          className="text-input text-input-answer answer-field-input"
          type="text"
          value={value}
          placeholder={placeholder}
          aria-label={label ? undefined : (ariaLabel ?? 'Atbilde')}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          readOnly={readOnly}
          aria-readonly={readOnly || undefined}
          onChange={(e) => {
            if (readOnly) return;
            if (dictation.listening) dictation.stop();
            onChange(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (dictation.listening) dictation.stop();
            finish(valueRef.current);
          }}
        />

        {dictation.supported ? (
          <Button
            variant={dictation.listening ? 'danger' : 'help'}
            fullWidth={false}
            className={`answer-dictate-btn${dictation.listening ? ' is-listening' : ''}`}
            aria-pressed={dictation.listening}
            aria-label={
              dictation.listening ? 'Apturēt ierunāšanu' : 'Ierunāt atbildi'
            }
            onClick={() => {
              dictation.clearError();
              dictation.toggle();
            }}
          >
            {dictation.listening ? 'Apturēt' : 'Ierunāt'}
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
          : (dictation.error ?? '')}
      </p>
    </div>
  );
}
