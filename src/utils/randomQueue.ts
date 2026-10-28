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

type SentenceCreationMode = 'fixed' | 'keywords';

/**
 * Order the two modes so either one can come first, they keep alternating,
 * and the extra tasks of the larger pool are folded in as occasional pairs
 * (never more than two in a row, while that is possible).
 */
function sentenceCreationModeOrder(
  nFixed: number,
  nKeywords: number,
): SentenceCreationMode[] {
  const start: SentenceCreationMode = Math.random() < 0.5 ? 'fixed' : 'keywords';
  const majority: SentenceCreationMode =
    nKeywords >= nFixed ? 'keywords' : 'fixed';
  const minorityCount = Math.min(nFixed, nKeywords);
  const extra = Math.abs(nKeywords - nFixed);
  const doubleAt = new Set(
    shuffleIds(Array.from({ length: minorityCount }, (_, i) => String(i)))
      .slice(0, Math.min(extra, minorityCount))
      .map(Number),
  );

  const pattern: SentenceCreationMode[] = [];
  const push = (mode: SentenceCreationMode, count: number) => {
    for (let i = 0; i < count; i++) pattern.push(mode);
  };
  const other: SentenceCreationMode = start === 'fixed' ? 'keywords' : 'fixed';

  for (let i = 0; i < minorityCount; i++) {
    const startCount =
      majority === start && doubleAt.has(i) ? SENTENCE_CREATION_MAX_RUN : 1;
    const otherCount =
      majority === other && doubleAt.has(i) ? SENTENCE_CREATION_MAX_RUN : 1;
    push(start, startCount);
    push(other, otherCount);
  }

  const overflow = extra - minorityCount;
  if (overflow > 0) push(majority, overflow);
  return pattern;
}

/**
 * Mix the two “Veido teikumu” modes. Either mode can open the session,
 * and the same mode does not appear more than twice in a row while both
 * still have tasks.
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

  const pools: Record<SentenceCreationMode, Task[]> = { fixed, keywords };
  return sentenceCreationModeOrder(fixed.length, keywords.length).map(
    (mode) => pools[mode].shift()!,
  );
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
