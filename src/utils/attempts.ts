import type {
  ReadingComprehensionProgress,
  ReadingQuestionProgress,
  SelfAssessment,
  TaskAttempt,
  TaskAttemptStatus,
} from '../types/progress';
import type { ReadingComprehensionTask, Task } from '../types/task';

export function createAttempt(task: Task): TaskAttempt {
  const base: TaskAttempt = {
    id: crypto.randomUUID(),
    taskId: task.id,
    contentVersion: task.contentVersion,
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: 'viewed',
    enteredAnswer: null,
    usedHint: false,
    viewedAnswers: false,
    selfAssessment: null,
    activeMs: 0,
  };

  if (task.type === 'reading_comprehension') {
    base.reading = createReadingProgress(task);
  }

  return base;
}

export function createReadingProgress(
  task: ReadingComprehensionTask,
): ReadingComprehensionProgress {
  return {
    phase: 'passage',
    questionIndex: 0,
    questions: task.questions.map((q) => createReadingQuestionProgress(q.id)),
  };
}

export function createReadingQuestionProgress(
  questionId: string,
): ReadingQuestionProgress {
  return {
    questionId,
    enteredAnswer: null,
    viewedAnswers: false,
    rereadCount: 0,
    selfAssessment: null,
    status: 'viewed',
    completedAt: null,
  };
}

/** Archived rows are history from an earlier cycle, not the current run. */
export function isArchivedAttempt(attempt: TaskAttempt): boolean {
  return attempt.archivedAt != null && attempt.archivedAt !== '';
}

export function currentAttempts(attempts: TaskAttempt[]): TaskAttempt[] {
  return attempts.filter((a) => !isArchivedAttempt(a));
}

/** Higher = more meaningful progress (completed wins over a newer empty “viewed”). */
function attemptRank(a: TaskAttempt): number {
  if (a.status === 'completed') return 3;
  if (a.status === 'attempted') return 2;
  return 1; // viewed
}

/**
 * Best attempt for a task: prefer completed > attempted > viewed, then newest.
 * When contentVersion is set, only matching-version attempts are considered
 * (older versions stay in history but are not resumed).
 *
 * Important: a fresh empty “viewed” row must never hide an older completed one
 * (that was the “3 of 5 empty” progress bug).
 */
export function latestAttemptForTask(
  attempts: TaskAttempt[],
  taskId: string,
  contentVersion?: number,
): TaskAttempt | null {
  let best: TaskAttempt | null = null;
  for (const a of attempts) {
    if (isArchivedAttempt(a)) continue;
    if (a.taskId !== taskId) continue;
    if (contentVersion != null && a.contentVersion !== contentVersion) continue;
    if (!best) {
      best = a;
      continue;
    }
    const rb = attemptRank(a);
    const ra = attemptRank(best);
    if (rb > ra) best = a;
    else if (rb === ra && a.startedAt > best.startedAt) best = a;
  }
  return best;
}

export function isTaskCompletedCurrent(
  attempts: TaskAttempt[],
  task: Task,
): boolean {
  return attempts.some(
    (a) =>
      !isArchivedAttempt(a) &&
      a.taskId === task.id &&
      a.contentVersion === task.contentVersion &&
      a.status === 'completed',
  );
}

export function hasProgressForTask(
  attempts: TaskAttempt[],
  task: Task,
): boolean {
  return attempts.some(
    (a) =>
      !isArchivedAttempt(a) &&
      a.taskId === task.id &&
      a.contentVersion === task.contentVersion,
  );
}

export function markAttempted(attempt: TaskAttempt, enteredAnswer?: string | null): TaskAttempt {
  const nextStatus: TaskAttemptStatus =
    attempt.status === 'completed' ? 'completed' : 'attempted';
  return {
    ...attempt,
    status: nextStatus,
    enteredAnswer:
      enteredAnswer !== undefined ? enteredAnswer : attempt.enteredAnswer,
  };
}

export function completeAttempt(
  attempt: TaskAttempt,
  selfAssessment: SelfAssessment | null = null,
): TaskAttempt {
  return {
    ...attempt,
    status: 'completed',
    completedAt: new Date().toISOString(),
    selfAssessment,
  };
}

/** First not-yet-completed task in a list (e.g. word-reading pack order). */
export function firstIncompleteTaskId(
  taskIds: string[],
  attempts: TaskAttempt[],
  tasksById?: Map<string, Task>,
): string | null {
  if (taskIds.length === 0) return null;
  return (
    taskIds.find((id) => {
      const task = tasksById?.get(id);
      if (task) return !isTaskCompletedCurrent(attempts, task);
      return !attempts.some(
        (a) =>
          !isArchivedAttempt(a) &&
          a.taskId === id &&
          a.status === 'completed',
      );
    }) ?? null
  );
}

export function countCompletedInSet(
  taskIds: string[],
  attempts: TaskAttempt[],
  tasksById?: Map<string, Task>,
): number {
  return taskIds.filter((id) => {
    const task = tasksById?.get(id);
    if (task) return isTaskCompletedCurrent(attempts, task);
    return attempts.some(
      (a) =>
        !isArchivedAttempt(a) && a.taskId === id && a.status === 'completed',
    );
  }).length;
}

/** Best status across matching-version attempts for a task. */
export function bestStatusForTask(
  attempts: TaskAttempt[],
  taskId: string,
  contentVersion?: number,
): TaskAttemptStatus | null {
  const forTask = attempts.filter(
    (a) =>
      !isArchivedAttempt(a) &&
      a.taskId === taskId &&
      (contentVersion == null || a.contentVersion === contentVersion),
  );
  if (forTask.length === 0) return null;
  if (forTask.some((a) => a.status === 'completed')) return 'completed';
  if (forTask.some((a) => a.status === 'attempted')) return 'attempted';
  return 'viewed';
}

export function uniqueTrainingDays(attempts: TaskAttempt[]): number {
  const days = new Set(
    currentAttempts(attempts).map((a) => a.startedAt.slice(0, 10)),
  );
  return days.size;
}

export function completedTaskIds(attempts: TaskAttempt[]): Set<string> {
  return new Set(
    currentAttempts(attempts)
      .filter((a) => a.status === 'completed')
      .map((a) => a.taskId),
  );
}

/** Completed for the current content version of each task. */
export function completedCurrentTaskIds(
  tasks: Task[],
  attempts: TaskAttempt[],
): Set<string> {
  return new Set(
    tasks.filter((t) => isTaskCompletedCurrent(attempts, t)).map((t) => t.id),
  );
}

function assessmentIsDifficult(a: SelfAssessment | null | undefined): boolean {
  return a === 'difficult' || a === 'with_help';
}

/** Tasks where the latest completed attempt was "difficult" or "with_help". */
export function difficultTaskIds(attempts: TaskAttempt[]): string[] {
  const latestByTask = new Map<string, TaskAttempt>();
  for (const a of attempts) {
    if (isArchivedAttempt(a) || a.status !== 'completed') continue;
    const prev = latestByTask.get(a.taskId);
    if (!prev || a.completedAt! > prev.completedAt!) {
      latestByTask.set(a.taskId, a);
    }
  }
  return [...latestByTask.entries()]
    .filter(([, a]) => {
      if (a.reading?.questions?.length) {
        return a.reading.questions.some((q) =>
          assessmentIsDifficult(q.selfAssessment),
        );
      }
      return assessmentIsDifficult(a.selfAssessment);
    })
    .map(([id]) => id);
}

export { assessmentIsDifficult };

export const SELF_ASSESSMENT_LABELS: Record<SelfAssessment, string> = {
  independent: 'Izdevās pašam',
  with_help: 'Ar palīdzību',
  difficult: 'Bija grūti',
  skipped: 'Izlaists',
};

export const SELF_ASSESSMENT_SYMBOLS: Record<SelfAssessment, string> = {
  independent: '✓',
  with_help: '~',
  difficult: '✗',
  skipped: '→',
};

export const STATUS_LABELS: Record<TaskAttemptStatus, string> = {
  viewed: 'Apskatīts',
  attempted: 'Mēģināts',
  completed: 'Pabeigts',
};
