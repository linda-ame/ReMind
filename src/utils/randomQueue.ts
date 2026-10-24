import type { TaskAttempt } from '../types/progress';
import type { Task } from '../types/task';
import { isTaskCompletedCurrent } from './attempts';
import {
  isSkippedToday,
  type TaskSkip,
} from './taskSkips';

/** Fisher–Yates shuffle (copy). */
export function shuffleIds(ids: string[]): string[] {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export type PracticeQueueMode = 'available' | 'skipped_today';

/**
 * Incomplete tasks for a section, in random order.
 * - `available` (default): exclude completed + skipped today
 * - `skipped_today`: only incomplete tasks skipped today
 */
export function buildRandomPracticeQueue(
  tasks: Task[],
  attempts: TaskAttempt[],
  skips: TaskSkip[] = [],
  mode: PracticeQueueMode = 'available',
): string[] {
  const filtered = tasks.filter((t) => {
    if (isTaskCompletedCurrent(attempts, t)) return false;
    const skipped = isSkippedToday(t.id, skips);
    if (mode === 'skipped_today') return skipped;
    return !skipped;
  });
  return shuffleIds(filtered.map((t) => t.id));
}

/** Incomplete tasks that were skipped today (for empty-pool UI). */
export function countSkippedTodayIncomplete(
  tasks: Task[],
  attempts: TaskAttempt[],
  skips: TaskSkip[],
): number {
  return tasks.filter(
    (t) =>
      !isTaskCompletedCurrent(attempts, t) && isSkippedToday(t.id, skips),
  ).length;
}
