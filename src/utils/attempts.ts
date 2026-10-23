import type { SelfAssessment, TaskAttempt, TaskAttemptStatus } from '../types/progress';
import type { Task } from '../types/task';

export function createAttempt(task: Task): TaskAttempt {
  return {
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
  };
}

/** Most recent attempt for a task (by startedAt). */
export function latestAttemptForTask(
  attempts: TaskAttempt[],
  taskId: string,
): TaskAttempt | null {
  let best: TaskAttempt | null = null;
  for (const a of attempts) {
    if (a.taskId !== taskId) continue;
    if (!best || a.startedAt > best.startedAt) best = a;
  }
  return best;
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
): string | null {
  if (taskIds.length === 0) return null;
  const done = completedTaskIds(attempts);
  return taskIds.find((id) => !done.has(id)) ?? null;
}

export function countCompletedInSet(
  taskIds: string[],
  attempts: TaskAttempt[],
): number {
  const done = completedTaskIds(attempts);
  return taskIds.filter((id) => done.has(id)).length;
}

/** Best status across all attempts for a task. */
export function bestStatusForTask(
  attempts: TaskAttempt[],
  taskId: string,
): TaskAttemptStatus | null {
  const forTask = attempts.filter((a) => a.taskId === taskId);
  if (forTask.length === 0) return null;
  if (forTask.some((a) => a.status === 'completed')) return 'completed';
  if (forTask.some((a) => a.status === 'attempted')) return 'attempted';
  return 'viewed';
}

export function uniqueTrainingDays(attempts: TaskAttempt[]): number {
  const days = new Set(
    attempts.map((a) => a.startedAt.slice(0, 10)),
  );
  return days.size;
}

export function completedTaskIds(attempts: TaskAttempt[]): Set<string> {
  return new Set(
    attempts.filter((a) => a.status === 'completed').map((a) => a.taskId),
  );
}

/** Tasks where the latest completed attempt was "difficult" or "with_help". */
export function difficultTaskIds(attempts: TaskAttempt[]): string[] {
  const latestByTask = new Map<string, TaskAttempt>();
  for (const a of attempts) {
    if (a.status !== 'completed') continue;
    const prev = latestByTask.get(a.taskId);
    if (!prev || a.completedAt! > prev.completedAt!) {
      latestByTask.set(a.taskId, a);
    }
  }
  return [...latestByTask.entries()]
    .filter(
      ([, a]) =>
        a.selfAssessment === 'difficult' || a.selfAssessment === 'with_help',
    )
    .map(([id]) => id);
}

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
