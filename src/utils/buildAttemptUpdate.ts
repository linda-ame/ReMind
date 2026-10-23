import type { TaskAttempt } from '../types/progress';

/**
 * Merge a child patch onto the parent attempt without dropping
 * selfAssessment / completed status (used by every interactive task view).
 */
export function buildAttemptUpdate(
  attempt: TaskAttempt,
  partial: Partial<TaskAttempt>,
  currentEnteredAnswer?: string | null,
): TaskAttempt {
  return {
    ...attempt,
    enteredAnswer:
      currentEnteredAnswer !== undefined
        ? currentEnteredAnswer
        : attempt.enteredAnswer,
    ...partial,
    status:
      attempt.status === 'completed'
        ? 'completed'
        : (partial.status ?? 'attempted'),
    selfAssessment:
      partial.selfAssessment !== undefined
        ? partial.selfAssessment
        : attempt.selfAssessment,
  };
}
