import type { Task } from '../types/task';

/** How the user opens a lesson task queue. */
export type TaskSessionMode = 'practice' | 'view';

export type Screen =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'progress' }
  | { name: 'progress_detail'; type: Task['type'] }
  | { name: 'task_list'; filter?: 'all' | 'difficult'; type?: Task['type'] }
  | { name: 'batch_list'; type: Task['type'] }
  | {
      name: 'lesson_review';
      type: Task['type'];
      batchIndex: number;
    }
  | {
      name: 'lesson_summary';
      type: Task['type'];
      batchIndex: number;
    }
  | {
      name: 'task';
      taskId: string;
      /** Ordered list of task IDs for next/prev within a session (e.g. one lesson). */
      queue: string[];
      /** When set, finishing the queue returns to this type’s batch list. */
      batchIndex?: number;
      batchType?: Task['type'];
      /** practice = normal fill; view = read-only review of answers. */
      mode?: TaskSessionMode;
      /**
       * Start a brand-new empty attempt (ignore any leftover progress).
       * Used after clearing tasks for “atkārtot grūtos”.
       */
      fresh?: boolean;
    }
  | {
      name: 'lesson_done';
      queue: string[];
      batchIndex?: number;
      batchType?: Task['type'];
    };
