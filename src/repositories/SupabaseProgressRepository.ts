import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase';
import type { ProgressRepository } from './ProgressRepository';
import {
  DEFAULT_UI_SETTINGS,
  PROGRESS_SCHEMA_VERSION,
  normalizeUiSettings,
  type ProgressSnapshot,
  type ReadingComprehensionProgress,
  type SelfAssessment,
  type TaskAttempt,
  type TaskAttemptStatus,
  type TextAlign,
  type TextPosition,
  type UiSettings,
} from '../types/progress';

interface AttemptRow {
  id: string;
  user_id: string;
  task_id: string;
  content_version: number;
  started_at: string;
  completed_at: string | null;
  status: TaskAttemptStatus;
  entered_answer: string | null;
  used_hint: boolean;
  viewed_answers: boolean;
  self_assessment: SelfAssessment | null;
  archived_at: string | null;
  active_ms: number | null;
  reading: ReadingComprehensionProgress | null;
}

interface SettingsRow {
  user_id: string;
  content_scale: number;
  text_align: TextAlign;
  text_position: TextPosition;
  high_contrast: boolean;
}

function rowToAttempt(row: AttemptRow): TaskAttempt {
  const attempt: TaskAttempt = {
    id: row.id,
    taskId: row.task_id,
    contentVersion: row.content_version,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
    enteredAnswer: row.entered_answer,
    usedHint: row.used_hint,
    viewedAnswers: row.viewed_answers,
    selfAssessment: row.self_assessment,
    activeMs: row.active_ms ?? 0,
  };
  if (row.archived_at) {
    attempt.archivedAt = row.archived_at;
  }
  if (row.reading) {
    attempt.reading = row.reading;
  }
  return attempt;
}

function attemptToRow(userId: string, attempt: TaskAttempt): AttemptRow {
  return {
    id: attempt.id,
    user_id: userId,
    task_id: attempt.taskId,
    content_version: attempt.contentVersion,
    started_at: attempt.startedAt,
    completed_at: attempt.completedAt,
    status: attempt.status,
    entered_answer: attempt.enteredAnswer,
    used_hint: attempt.usedHint,
    viewed_answers: attempt.viewedAnswers,
    self_assessment: attempt.selfAssessment,
    archived_at: attempt.archivedAt ?? null,
    active_ms: Math.max(0, Math.round(attempt.activeMs ?? 0)),
    reading: attempt.reading ?? null,
  };
}

function throwIfError(error: { message: string } | null, fallback: string): void {
  if (error) {
    throw new Error(error.message || fallback);
  }
}

export class SupabaseProgressRepository implements ProgressRepository {
  private readonly client: SupabaseClient;
  private readonly userId: string;

  constructor(userId: string, client: SupabaseClient = getSupabase()) {
    this.userId = userId;
    this.client = client;
  }

  async getSettings(): Promise<UiSettings> {
    const { data, error } = await this.client
      .from('user_settings')
      .select(
        'user_id, content_scale, text_align, text_position, high_contrast',
      )
      .eq('user_id', this.userId)
      .maybeSingle();

    throwIfError(error, 'Neizdevās ielādēt iestatījumus');
    if (!data) return DEFAULT_UI_SETTINGS;

    const row = data as SettingsRow;
    return normalizeUiSettings({
      contentScale: Number(row.content_scale),
      textAlign: row.text_align,
      textPosition: row.text_position,
      highContrast: row.high_contrast,
    });
  }

  async saveSettings(settings: UiSettings): Promise<void> {
    const normalized = normalizeUiSettings(settings);
    const { error } = await this.client.from('user_settings').upsert({
      user_id: this.userId,
      content_scale: normalized.contentScale,
      text_align: normalized.textAlign,
      text_position: normalized.textPosition,
      high_contrast: normalized.highContrast,
      updated_at: new Date().toISOString(),
    });
    throwIfError(error, 'Neizdevās saglabāt iestatījumus');
  }

  async getAllAttempts(): Promise<TaskAttempt[]> {
    const { data, error } = await this.client
      .from('task_attempts')
      .select('*')
      .eq('user_id', this.userId);

    throwIfError(error, 'Neizdevās ielādēt progresu');
    return ((data as AttemptRow[] | null) ?? []).map(rowToAttempt);
  }

  async getAttemptsForTask(taskId: string): Promise<TaskAttempt[]> {
    const { data, error } = await this.client
      .from('task_attempts')
      .select('*')
      .eq('user_id', this.userId)
      .eq('task_id', taskId);

    throwIfError(error, 'Neizdevās ielādēt uzdevuma progresu');
    return ((data as AttemptRow[] | null) ?? []).map(rowToAttempt);
  }

  async saveAttempt(attempt: TaskAttempt): Promise<void> {
    const { error } = await this.client
      .from('task_attempts')
      .upsert({
        ...attemptToRow(this.userId, attempt),
        updated_at: new Date().toISOString(),
      });
    throwIfError(error, 'Neizdevās saglabāt mēģinājumu');
  }

  async replaceAttemptsForTaskVersion(attempt: TaskAttempt): Promise<void> {
    const existing = await this.getAttemptsForTask(attempt.taskId);
    const toDelete = existing
      .filter(
        (row) =>
          !row.archivedAt &&
          row.contentVersion === attempt.contentVersion &&
          row.id !== attempt.id,
      )
      .map((row) => row.id);

    if (toDelete.length > 0) {
      const { error: delError } = await this.client
        .from('task_attempts')
        .delete()
        .eq('user_id', this.userId)
        .in('id', toDelete);
      throwIfError(delError, 'Neizdevās notīrīt vecos mēģinājumus');
    }

    await this.saveAttempt(attempt);
  }

  async archiveAttemptsForTasks(
    taskIds: string[],
    archivedAt: string,
  ): Promise<void> {
    if (taskIds.length === 0) return;
    const { error } = await this.client
      .from('task_attempts')
      .update({ archived_at: archivedAt, updated_at: archivedAt })
      .eq('user_id', this.userId)
      .in('task_id', taskIds)
      .is('archived_at', null);
    throwIfError(error, 'Neizdevās arhivēt progresu');
  }

  async deleteAttemptsForTasks(taskIds: string[]): Promise<void> {
    if (taskIds.length === 0) return;
    const { error } = await this.client
      .from('task_attempts')
      .delete()
      .eq('user_id', this.userId)
      .in('task_id', taskIds);
    throwIfError(error, 'Neizdevās dzēst progresu');
  }

  async exportProgress(): Promise<ProgressSnapshot> {
    const [attempts, settings] = await Promise.all([
      this.getAllAttempts(),
      this.getSettings(),
    ]);
    return {
      schemaVersion: PROGRESS_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      attempts,
      settings,
    };
  }

  async importProgress(
    snapshot: ProgressSnapshot,
    mode: 'merge' | 'replace',
  ): Promise<void> {
    if (snapshot.schemaVersion !== PROGRESS_SCHEMA_VERSION) {
      throw new Error(
        `Neatbalstīta progresa shēmas versija: ${snapshot.schemaVersion}. Gaidīta: ${PROGRESS_SCHEMA_VERSION}.`,
      );
    }

    if (mode === 'replace') {
      const { error } = await this.client
        .from('task_attempts')
        .delete()
        .eq('user_id', this.userId);
      throwIfError(error, 'Neizdevās aizstāt progresu');
    }

    if (snapshot.attempts.length > 0) {
      const rows = snapshot.attempts.map((a) => ({
        ...attemptToRow(this.userId, a),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await this.client.from('task_attempts').upsert(rows);
      throwIfError(error, 'Neizdevās importēt mēģinājumus');
    }

    if (snapshot.settings) {
      await this.saveSettings(snapshot.settings);
    }
  }

  async clearAll(): Promise<void> {
    const { error: attemptsError } = await this.client
      .from('task_attempts')
      .delete()
      .eq('user_id', this.userId);
    throwIfError(attemptsError, 'Neizdevās notīrīt mēģinājumus');
    await this.saveSettings(DEFAULT_UI_SETTINGS);
  }

  /** Upsert a batch of attempts (used by guest → cloud merge). */
  async upsertAttempts(attempts: TaskAttempt[]): Promise<void> {
    if (attempts.length === 0) return;
    const rows = attempts.map((a) => ({
      ...attemptToRow(this.userId, a),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await this.client.from('task_attempts').upsert(rows);
    throwIfError(error, 'Neizdevās sinhronizēt progresu');
  }
}
