import type { TaskAttempt } from '../types/progress';
import type { Task } from '../types/task';
import { completedTaskIds } from './attempts';

/** Words / tasks per lesson (nodarbība) by type. */
export const BATCH_SIZE_BY_TYPE: Record<Task['type'], number> = {
  word_reading: 15,
  image_word: 5,
  word_choice: 5,
  sentence_completion: 5,
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
): { done: number; total: number; complete: boolean } {
  const completed = completedTaskIds(attempts);
  const done = batch.taskIds.filter((id) => completed.has(id)).length;
  return {
    done,
    total: batch.taskIds.length,
    complete: done === batch.taskIds.length,
  };
}

/** First lesson that still has unfinished tasks; null if all done. */
export function firstIncompleteBatch(
  batches: TaskBatch[],
  attempts: TaskAttempt[],
): TaskBatch | null {
  for (const batch of batches) {
    const { complete } = batchProgress(batch, attempts);
    if (!complete) return batch;
  }
  return null;
}
