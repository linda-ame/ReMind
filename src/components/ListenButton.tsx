import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import { Button } from './Button';

interface ListenButtonProps {
  /** Exact text to speak — not the whole page. */
  text: string;
  /** Visible label when idle (ignored when compact). */
  label?: string;
  /** Accessible name when idle. */
  ariaLabel?: string;
  className?: string;
  fullWidth?: boolean;
  /**
   * Icon-only large control (e.g. beside each odd-one-out word).
   * Still uses a clear aria-label.
   */
  compact?: boolean;
  /** Hide the error banner (use when many compact buttons share a row). */
  hideError?: boolean;
  /** Called when the user starts playback (not when they stop it). */
  onStart?: () => void;
  /** 1 is normal. Omit to keep the usual rehab pace. */
  speakingRate?: number;
}

function SpeakerIcon() {
  return (
    <svg
      className="listen-btn-icon"
      viewBox="0 0 24 24"
      width="1.35em"
      height="1.35em"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg
      className="listen-btn-icon"
      viewBox="0 0 24 24"
      width="1.35em"
      height="1.35em"
      aria-hidden="true"
      focusable="false"
    >
      <path fill="currentColor" d="M6 6h12v12H6z" />
    </svg>
  );
}

/**
 * Icon + short label — helps when reading is hard; text still clarifies meaning.
 * Cloud Latvian TTS for a specific string.
 */
export function ListenButton({
  text,
  label = 'Klausīties',
  ariaLabel,
  className = '',
  fullWidth = true,
  compact = false,
  hideError = false,
  onStart,
  speakingRate,
}: ListenButtonProps) {
  const {
    supported,
    ready,
    speaking,
    loading,
    error,
    clearError,
    toggle,
    stop,
  } = useSpeechSynthesis();

  if (!text.trim()) return null;

  const busy = speaking || loading;
  const disabled = ready && !supported;

  const visibleLabel = loading
    ? 'Ielādē…'
    : speaking
      ? 'Apturēt'
      : label;

  return (
    <div
      className={`listen-control${compact ? ' listen-control-compact' : ''}`}
    >
      <Button
        variant={busy ? 'danger' : 'help'}
        fullWidth={compact ? false : fullWidth}
        className={`listen-btn${compact ? ' listen-btn-compact' : ''}${speaking ? ' is-speaking' : ''}${className ? ` ${className}` : ''}`}
        aria-pressed={speaking}
        aria-busy={loading || undefined}
        aria-label={
          loading
            ? 'Ielādē skaņu'
            : speaking
              ? 'Apturēt klausīšanos'
              : (ariaLabel ?? label)
        }
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          clearError();
          if (busy) stop();
          else {
            onStart?.();
            toggle(text, speakingRate);
          }
        }}
      >
        <span className="listen-btn-inner">
          {speaking ? <StopIcon /> : <SpeakerIcon />}
          {!compact ? (
            <span className="listen-btn-text">{visibleLabel}</span>
          ) : null}
        </span>
      </Button>

      {!hideError && error ? (
        <p className="listen-status listen-status-warn" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
