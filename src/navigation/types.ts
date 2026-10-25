import type { DifficultyLevel, Task } from '../types/task';

/** How the user opens a lesson task queue. */
export type TaskSessionMode = 'practice' | 'view';

export type Screen =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'auth' }
  | { name: 'progress' }
  | { name: 'progress_detail'; type: Task['type'] }
  | { name: 'task_list'; filter?: 'all' | 'difficult'; type?: Task['type'] }
  /** @deprecated Lesson lists removed — kept for legacy navigation. */
  | { name: 'batch_list'; type: Task['type'] }
  /** Per-section difficulty levels (1–5 multi-select). */
  | { name: 'customize_content'; focusType?: Task['type'] }
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
  /** Filtered (or all) tasks in a section completed — offer reset / other level. */
  | {
      name: 'section_complete';
      type: Task['type'];
      difficultyLevels?: DifficultyLevel[];
    }
  | {
      name: 'task';
      taskId: string;
      /** Ordered list of task IDs for next/prev within a session. */
      queue: string[];
      /** Legacy lesson index (optional). Section practice omits this. */
      batchIndex?: number;
      /**
       * Section type for home → random practice.
       * With no batchIndex: finishing the queue opens section_complete.
       */
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
