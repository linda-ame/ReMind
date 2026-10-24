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
   * Keep only this attempt for its taskId+contentVersion
   * (drops empty ghost rows that would otherwise look “newer”).
   */
  replaceAttemptsForTaskVersion(attempt: TaskAttempt): Promise<void>;
  /** Remove all attempts for the given task IDs (e.g. reset one lesson). */
  deleteAttemptsForTasks(taskIds: string[]): Promise<void>;

  exportProgress(): Promise<ProgressSnapshot>;
  importProgress(snapshot: ProgressSnapshot, mode: 'merge' | 'replace'): Promise<void>;

  clearAll(): Promise<void>;
}
