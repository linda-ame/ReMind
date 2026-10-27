import type { TaskAttempt } from '../types/progress';
import type { Task } from '../types/task';
import { isTaskCompletedCurrent } from './attempts';
import {
  isSkippedToday,
  type TaskSkip,
} from './taskSkips';

const SENTENCE_CREATION_MAX_RUN = 2;

function shuffleTasks(tasks: Task[]): Task[] {
  const ids = shuffleIds(tasks.map((t) => t.id));
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return ids.map((id) => byId.get(id)!);
}

/**
 * Mix the two “Veido teikumu” modes so a session does not show more than
 * two tasks of the same mode in a row, while both modes still have tasks.
 */
export function interleaveSentenceCreation(tasks: Task[]): Task[] {
  const fixed = shuffleTasks(
    tasks.filter(
      (t) =>
        t.type === 'sentence_creation' && t.mode === 'fixed_word_position',
    ),
  );
  const keywords = shuffleTasks(
    tasks.filter(
      (t) => t.type === 'sentence_creation' && t.mode === 'include_keywords',
    ),
  );
  if (fixed.length === 0 || keywords.length === 0) return shuffleTasks(tasks);

  const out: Task[] = [];
  let runMode: 'fixed' | 'keywords' | null = null;
  let run = 0;
  while (fixed.length > 0 && keywords.length > 0) {
    let takeFixed = fixed.length >= keywords.length;
    if (runMode === 'fixed' && run >= SENTENCE_CREATION_MAX_RUN) takeFixed = false;
    if (runMode === 'keywords' && run >= SENTENCE_CREATION_MAX_RUN) {
      takeFixed = true;
    }
    const next = (takeFixed ? fixed : keywords).shift();
    if (!next) break;
    const mode: 'fixed' | 'keywords' = takeFixed ? 'fixed' : 'keywords';
    if (mode === runMode) run += 1;
    else {
      runMode = mode;
      run = 1;
    }
    out.push(next);
  }
  out.push(...fixed, ...keywords);
  return out;
}

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
  const mixesSentenceCreation =
    filtered.length > 0 &&
    filtered.every((t) => t.type === 'sentence_creation') &&
    filtered.some(
      (t) =>
        t.type === 'sentence_creation' && t.mode === 'fixed_word_position',
    ) &&
    filtered.some(
      (t) =>
        t.type === 'sentence_creation' && t.mode === 'include_keywords',
    );
  if (mixesSentenceCreation) {
    return interleaveSentenceCreation(filtered).map((t) => t.id);
  }
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
