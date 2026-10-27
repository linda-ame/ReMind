import type { ProgressSnapshot, TaskAttempt, UiSettings } from '../types/progress';

/**
 * Abstract progress store. IndexedDB for guests;
 * SupabaseProgressRepository when signed in.
 */
export interface ProgressRepository {
  getSettings(): Promise<UiSettings>;
  saveSettings(settings: UiSettings): Promise<void>;

  getAllAttempts(): Promise<TaskAttempt[]>;
  getAttemptsForTask(taskId: string): Promise<TaskAttempt[]>;
  saveAttempt(attempt: TaskAttempt): Promise<void>;
  /**
   * Keep only this current attempt for its taskId+contentVersion.
   * Drops empty ghost rows. Archived history is left in place.
   */
  replaceAttemptsForTaskVersion(attempt: TaskAttempt): Promise<void>;
  /**
   * Hide current attempts for these tasks and keep them as history.
   * The learner starts again with empty tasks.
   */
  archiveAttemptsForTasks(taskIds: string[], archivedAt: string): Promise<void>;
  /** Permanently remove attempts for the given task IDs. */
  deleteAttemptsForTasks(taskIds: string[]): Promise<void>;

  exportProgress(): Promise<ProgressSnapshot>;
  importProgress(snapshot: ProgressSnapshot, mode: 'merge' | 'replace'): Promise<void>;

  clearAll(): Promise<void>;
}
