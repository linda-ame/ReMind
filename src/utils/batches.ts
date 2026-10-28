import type { TaskAttempt } from '../types/progress';
import type { Task } from '../types/task';
import { hasProgressForTask, isTaskCompletedCurrent } from './attempts';

/** Words / tasks per lesson (nodarbība) by type. */
export const BATCH_SIZE_BY_TYPE: Record<Task['type'], number> = {
  word_reading: 15,
  image_word: 5,
  word_choice: 5,
  sentence_completion: 5,
  sentence_completion_multi: 5,
  /** Each text is its own unit (not grouped into lessons). */
  reading_comprehension: 1,
  sentence_order: 5,
  odd_one_out: 5,
  antonym: 5,
  definition_guess: 5,
  sentence_image_match: 5,
  sentence_creation: 5,
  spelling_check: 5,
  brand_association: 5,
  word_grid: 5,
};

/** @deprecated Prefer batchSizeForType — kept for older call sites. */
export const WORD_READING_BATCH_SIZE = BATCH_SIZE_BY_TYPE.word_reading;

export function batchSizeForType(type: Task['type']): number {
  return BATCH_SIZE_BY_TYPE[type];
}

export interface TaskBatch {
  index: number;
  /** 1-based lesson number for display. */
  lessonNumber: number;
  taskIds: string[];
  /** Inclusive 1-based range in the full list. */
  from: number;
  to: number;
}

export function buildBatches(
  taskIds: string[],
  batchSize: number = WORD_READING_BATCH_SIZE,
): TaskBatch[] {
  const batches: TaskBatch[] = [];
  for (let i = 0; i < taskIds.length; i += batchSize) {
    const slice = taskIds.slice(i, i + batchSize);
    const index = batches.length;
    batches.push({
      index,
      lessonNumber: index + 1,
      taskIds: slice,
      from: i + 1,
      to: i + slice.length,
    });
  }
  return batches;
}

export function buildBatchesForType(
  taskIds: string[],
  type: Task['type'],
): TaskBatch[] {
  return buildBatches(taskIds, batchSizeForType(type));
}

export function batchProgress(
  batch: TaskBatch,
  attempts: TaskAttempt[],
  tasksById?: Map<string, Task>,
): {
  done: number;
  total: number;
  complete: boolean;
  /** Started but not finished (yellow state). */
  partial: boolean;
} {
  const total = batch.taskIds.length;
  let done = 0;
  let anyProgress = false;

  for (const id of batch.taskIds) {
    const task = tasksById?.get(id);
    if (task ? isTaskCompletedCurrent(attempts, task) : false) {
      done += 1;
      anyProgress = true;
      continue;
    }
    if (task ? hasProgressForTask(attempts, task) : false) {
      anyProgress = true;
    } else if (!tasksById) {
      // Fallback without task metadata (legacy call sites).
      const completed = attempts.some(
        (a) =>
          !a.archivedAt && a.taskId === id && a.status === 'completed',
      );
      if (completed) {
        done += 1;
        anyProgress = true;
      } else if (attempts.some((a) => !a.archivedAt && a.taskId === id)) {
        anyProgress = true;
      }
    }
  }

  const complete = done === total && total > 0;
  return {
    done,
    total,
    complete,
    partial: !complete && anyProgress,
  };
}

/** First lesson that still has unfinished tasks; null if all done. */
export function firstIncompleteBatch(
  batches: TaskBatch[],
  attempts: TaskAttempt[],
  tasksById?: Map<string, Task>,
): TaskBatch | null {
  for (const batch of batches) {
    const { complete } = batchProgress(batch, attempts, tasksById);
    if (!complete) return batch;
  }
  return null;
}
