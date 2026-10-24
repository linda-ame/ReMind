import {
  useRef,
  type ReactNode,
  type TouchEvent,
} from 'react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  /** Show fixed thumb-zone arrow and allow swipe-to-advance. */
  canAdvance: boolean;
  onAdvance: () => void;
  /**
   * Low-emphasis “Izlaist” while the user has not yet submitted an answer.
   * Hidden once → is ready (Enter / dictation finished).
   */
  onSkip?: () => void;
  advanceLabel?: string;
  /** Optional progress text below the task. */
  progressLabel?: string | null;
}

const SWIPE_MIN_DX = 64;
const SWIPE_MAX_DY = 56;

/**
 * Task body + progress + Izlaist (until ready) + fixed yellow → when ready.
 * Ready state usually adds a right gutter so content clears the tall side FAB;
 * word reading uses a compact top-right → and no gutter (see CSS :has).
 * Swipe right→left advances only when canAdvance.
 */
export function TaskAdvanceChrome({
  children,
  canAdvance,
  onAdvance,
  onSkip,
  advanceLabel = 'Tālāk',
  progressLabel,
}: Props) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const advancedRef = useRef(false);

  const handleAdvance = () => {
    if (!canAdvance || advancedRef.current) return;
    advancedRef.current = true;
    onAdvance();
    // Allow another advance after navigation remounts / state settles.
    queueMicrotask(() => {
      advancedRef.current = false;
    });
  };

  const onTouchStart = (e: TouchEvent) => {
    const t = e.changedTouches[0] ?? e.touches[0];
    if (!t) return;
    startRef.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (!canAdvance || !startRef.current) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;
    startRef.current = null;
    // Finger moves left (content goes “forward”).
    if (dx <= -SWIPE_MIN_DX && Math.abs(dy) <= SWIPE_MAX_DY) {
      handleAdvance();
    }
  };

  return (
    <div
      className={`task-advance-root${canAdvance ? ' task-advance-ready' : ''}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="task-advance-body">{children}</div>

      <div className="task-advance-after">
        {progressLabel ? (
          <p className="progress-label task-advance-progress">{progressLabel}</p>
        ) : null}
        {onSkip && !canAdvance ? (
          <Button
            variant="neutral"
            className="task-skip-btn"
            onClick={onSkip}
          >
            Izlaist
          </Button>
        ) : null}
      </div>

      {canAdvance ? (
        <button
          type="button"
          className="task-advance-fab"
          aria-label={advanceLabel}
          onClick={handleAdvance}
        >
          <span aria-hidden="true">→</span>
        </button>
      ) : null}
    </div>
  );
}
