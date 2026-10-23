import type { SelfAssessment, TaskAttempt } from '../types/progress';
import type { Task } from '../types/task';
import {
  isAnswerCorrect,
  isReadingQuestionCorrect,
  taskHasObjectiveAnswer,
  taskHasSelfAssessment,
} from './answers';
import {
  assessmentIsDifficult,
  isTaskCompletedCurrent,
  latestAttemptForTask,
} from './attempts';

export interface RatingCounts {
  independent: number;
  with_help: number;
  difficult: number;
  unrated: number;
}

export interface CorrectnessCounts {
  correct: number;
  incorrect: number;
  unanswered: number;
}

export interface SectionProgressStats {
  type: Task['type'];
  total: number;
  completed: number;
  /** null when the section has no self-assessment. */
  ratings: RatingCounts | null;
  /** null when the section has no objective answer key (e.g. word reading). */
  correctness: CorrectnessCounts | null;
  hardIds: string[];
}

function emptyRatings(): RatingCounts {
  return { independent: 0, with_help: 0, difficult: 0, unrated: 0 };
}

function emptyCorrectness(): CorrectnessCounts {
  return { correct: 0, incorrect: 0, unanswered: 0 };
}

function bucketAssessment(a: SelfAssessment | null | undefined): keyof RatingCounts {
  if (a === 'independent') return 'independent';
  if (a === 'with_help') return 'with_help';
  if (a === 'difficult') return 'difficult';
  return 'unrated';
}

function addCorrectness(
  counts: CorrectnessCounts,
  result: boolean | null,
): void {
  if (result === true) counts.correct += 1;
  else if (result === false) counts.incorrect += 1;
  else counts.unanswered += 1;
}

/** Stats for one task-type section. */
export function sectionProgressStats(
  tasks: Task[],
  attempts: TaskAttempt[],
): SectionProgressStats {
  if (tasks.length === 0) {
    return {
      type: 'word_reading',
      total: 0,
      completed: 0,
      ratings: null,
      correctness: null,
      hardIds: [],
    };
  }

  const type = tasks[0]!.type;
  const usesRatings = tasks.some(taskHasSelfAssessment);
  const usesCorrectness = tasks.some(taskHasObjectiveAnswer);
  const ratings = usesRatings ? emptyRatings() : null;
  const correctness = usesCorrectness ? emptyCorrectness() : null;

  let completed = 0;
  const hardIds: string[] = [];

  for (const task of tasks) {
    if (isTaskCompletedCurrent(attempts, task)) completed += 1;

    const attempt = latestAttemptForTask(
      attempts,
      task.id,
      task.contentVersion,
    );

    if (isHardPracticeTask(task, attempt)) {
      hardIds.push(task.id);
    }

    // Only score completed work — unfinished tasks must not inflate
    // “unrated” / “bez atbildes” and look like nothing was saved.
    const done = attempt?.status === 'completed';

    if (task.type === 'reading_comprehension' && ratings) {
      for (const q of task.questions) {
        const qp = attempt?.reading?.questions.find(
          (x) => x.questionId === q.id,
        );
        if (!qp || qp.status !== 'completed') continue;
        ratings[bucketAssessment(qp.selfAssessment)] += 1;
      }
    } else if (ratings && taskHasSelfAssessment(task) && done) {
      ratings[bucketAssessment(attempt?.selfAssessment)] += 1;
    }

    if (task.type === 'reading_comprehension' && correctness) {
      for (const q of task.questions) {
        const qp = attempt?.reading?.questions.find(
          (x) => x.questionId === q.id,
        );
        if (!qp || qp.status !== 'completed') continue;
        addCorrectness(
          correctness,
          isReadingQuestionCorrect(q.answers, qp.enteredAnswer),
        );
      }
    } else if (correctness && taskHasObjectiveAnswer(task) && done) {
      addCorrectness(correctness, isAnswerCorrect(task, attempt));
    }
  }

  return {
    type,
    total: tasks.length,
    completed,
    ratings,
    correctness,
    hardIds,
  };
}

export const RATING_CHIP_LABELS: Record<keyof RatingCounts, string> = {
  independent: 'Pašam',
  with_help: 'Ar palīdzību',
  difficult: 'Grūti',
  unrated: 'Nav novērtēts',
};

/**
 * Hard-to-practice: self-rated difficult/with_help, or objectively incorrect.
 * (MCQ sections have no self-rating — incorrect answers count as hard.)
 */
export function isHardPracticeTask(
  task: Task,
  attempt: TaskAttempt | null,
): boolean {
  if (!attempt || attempt.status !== 'completed') return false;

  if (task.type === 'reading_comprehension') {
    const qs = attempt.reading?.questions ?? [];
    if (
      qs.some((q) => assessmentIsDifficult(q.selfAssessment))
    ) {
      return true;
    }
    return task.questions.some((q) => {
      const qp = qs.find((x) => x.questionId === q.id);
      return isReadingQuestionCorrect(q.answers, qp?.enteredAnswer) === false;
    });
  }

  if (assessmentIsDifficult(attempt.selfAssessment)) return true;
  if (taskHasObjectiveAnswer(task) && isAnswerCorrect(task, attempt) === false) {
    return true;
  }
  return false;
}

/** Hard task IDs across the given task list (section or all). */
export function hardPracticeTaskIds(
  tasks: Task[],
  attempts: TaskAttempt[],
): string[] {
  const ids: string[] = [];
  for (const task of tasks) {
    const attempt = latestAttemptForTask(
      attempts,
      task.id,
      task.contentVersion,
    );
    if (isHardPracticeTask(task, attempt)) ids.push(task.id);
  }
  return ids;
}

/** Scope of the list (exclusive). */
export type ProgressScope = 'completed' | 'all';

/**
 * Attribute filters — multi-select, combined with OR.
 * Objective (pareizi/nepareizi) and self-assessment are separate dimensions.
 */
export type ProgressCriterion =
  | 'correct'
  | 'incorrect'
  | 'independent'
  | 'with_help'
  | 'difficult'
  | 'unrated';

/** @deprecated Use ProgressScope + ProgressCriterion multi-select. */
export type ProgressListFilter =
  | ProgressScope
  | ProgressCriterion
  | 'hard';

export function taskMatchesCriterion(
  task: Task,
  attempts: TaskAttempt[],
  criterion: ProgressCriterion,
): boolean {
  const attempt = latestAttemptForTask(
    attempts,
    task.id,
    task.contentVersion,
  );

  switch (criterion) {
    case 'correct':
      if (task.type === 'reading_comprehension') {
        const qs = attempt?.reading?.questions ?? [];
        return task.questions.some((q) => {
          const qp = qs.find((x) => x.questionId === q.id);
          return (
            isReadingQuestionCorrect(q.answers, qp?.enteredAnswer) === true
          );
        });
      }
      return isAnswerCorrect(task, attempt) === true;
    case 'incorrect':
      if (task.type === 'reading_comprehension') {
        const qs = attempt?.reading?.questions ?? [];
        return task.questions.some((q) => {
          const qp = qs.find((x) => x.questionId === q.id);
          return (
            isReadingQuestionCorrect(q.answers, qp?.enteredAnswer) === false
          );
        });
      }
      return isAnswerCorrect(task, attempt) === false;
    case 'independent':
    case 'with_help':
    case 'difficult':
    case 'unrated': {
      if (task.type === 'reading_comprehension') {
        const qs = attempt?.reading?.questions ?? [];
        return task.questions.some((q) => {
          const qp = qs.find((x) => x.questionId === q.id);
          const a = qp?.selfAssessment ?? null;
          if (criterion === 'unrated') return a == null || a === 'skipped';
          return a === criterion;
        });
      }
      const a = attempt?.selfAssessment ?? null;
      if (criterion === 'unrated') return a == null || a === 'skipped';
      return a === criterion;
    }
  }
}

/**
 * Scope (completed/all) + optional criteria (OR).
 * No criteria → everything in scope.
 * With criteria → in scope AND matches at least one criterion.
 */
export function taskMatchesProgressSelection(
  task: Task,
  attempts: TaskAttempt[],
  scope: ProgressScope,
  criteria: readonly ProgressCriterion[],
): boolean {
  const done = isTaskCompletedCurrent(attempts, task);
  if (scope === 'completed' && !done) return false;
  if (criteria.length === 0) return true;
  return criteria.some((c) => taskMatchesCriterion(task, attempts, c));
}

export function taskMatchesProgressFilter(
  task: Task,
  attempts: TaskAttempt[],
  filter: ProgressListFilter,
): boolean {
  const attempt = latestAttemptForTask(
    attempts,
    task.id,
    task.contentVersion,
  );
  const done = isTaskCompletedCurrent(attempts, task);

  switch (filter) {
    case 'all':
      return true;
    case 'completed':
      return done;
    case 'hard':
      return isHardPracticeTask(task, attempt);
    case 'correct':
    case 'incorrect':
    case 'independent':
    case 'with_help':
    case 'difficult':
    case 'unrated':
      return taskMatchesCriterion(task, attempts, filter);
  }
}
