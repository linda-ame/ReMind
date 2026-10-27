import { useCallback, useEffect, useRef } from 'react';
import type { TaskAttempt } from '../types/progress';

const MAX_ACTIVE_MS = 2_000_000_000;
const FLUSH_EVERY_MS = 20_000;

function clampMs(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.min(MAX_ACTIVE_MS, Math.round(ms));
}

/**
 * Counts how long a task stays on screen while the tab is visible.
 * The total is stored on the attempt and is not shown in the UI.
 */
export function useTaskActiveTime(
  attemptId: string | null,
  initialMs: number,
  enabled: boolean,
  onFlush?: (attemptId: string, activeMs: number) => void,
): <T extends TaskAttempt>(attempt: T) => T {
  const baseRef = useRef(0);
  const runningSinceRef = useRef<number | null>(null);
  const initialRef = useRef(initialMs);
  const onFlushRef = useRef(onFlush);
  const enabledRef = useRef(enabled);
  initialRef.current = initialMs;
  onFlushRef.current = onFlush;
  enabledRef.current = enabled;

  const commit = useCallback(() => {
    if (runningSinceRef.current == null) return;
    baseRef.current = clampMs(
      baseRef.current + (Date.now() - runningSinceRef.current),
    );
    runningSinceRef.current = null;
  }, []);

  const read = useCallback(() => {
    const extra =
      runningSinceRef.current != null
        ? Date.now() - runningSinceRef.current
        : 0;
    return clampMs(baseRef.current + extra);
  }, []);

  useEffect(() => {
    baseRef.current = clampMs(initialRef.current);
    runningSinceRef.current = null;
    if (!enabled || !attemptId) return;

    const id = attemptId;
    const start = () => {
      if (document.visibilityState !== 'visible') return;
      if (runningSinceRef.current == null) {
        runningSinceRef.current = Date.now();
      }
    };
    const flush = () => {
      commit();
      onFlushRef.current?.(id, baseRef.current);
      if (document.visibilityState === 'visible') start();
    };

    start();
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
      else start();
    };
    document.addEventListener('visibilitychange', onVis);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      flush();
    }, FLUSH_EVERY_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(interval);
      commit();
      onFlushRef.current?.(id, baseRef.current);
    };
  }, [attemptId, enabled, commit]);

  return useCallback(
    (attempt) => {
      if (!enabledRef.current) return attempt;
      const ms = read();
      baseRef.current = ms;
      runningSinceRef.current =
        document.visibilityState === 'visible' ? Date.now() : null;
      return { ...attempt, activeMs: ms };
    },
    [read],
  );
}
