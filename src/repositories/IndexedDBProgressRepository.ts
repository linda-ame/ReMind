import type { ProgressRepository } from './ProgressRepository';
import {
  PROGRESS_SCHEMA_VERSION,
  normalizeUiSettings,
  type ProgressSnapshot,
  type TaskAttempt,
  type UiSettings,
} from '../types/progress';

const DB_NAME = 'remind-progress';
const DB_VERSION = 1;
const ATTEMPTS_STORE = 'attempts';
const SETTINGS_STORE = 'settings';
const SETTINGS_KEY = 'ui';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ATTEMPTS_STORE)) {
        const store = db.createObjectStore(ATTEMPTS_STORE, { keyPath: 'id' });
        store.createIndex('taskId', 'taskId', { unique: false });
        store.createIndex('completedAt', 'completedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE);
      }
    };
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export class IndexedDBProgressRepository implements ProgressRepository {
  async getSettings(): Promise<UiSettings> {
    const db = await openDb();
    try {
      const tx = db.transaction(SETTINGS_STORE, 'readonly');
      const stored = await idbRequest<UiSettings | undefined>(
        tx.objectStore(SETTINGS_STORE).get(SETTINGS_KEY),
      );
      await txDone(tx);
      return normalizeUiSettings(stored);
    } finally {
      db.close();
    }
  }

  async saveSettings(settings: UiSettings): Promise<void> {
    const db = await openDb();
    try {
      const tx = db.transaction(SETTINGS_STORE, 'readwrite');
      tx.objectStore(SETTINGS_STORE).put(normalizeUiSettings(settings), SETTINGS_KEY);
      await txDone(tx);
    } finally {
      db.close();
    }
  }

  async getAllAttempts(): Promise<TaskAttempt[]> {
    const db = await openDb();
    try {
      const tx = db.transaction(ATTEMPTS_STORE, 'readonly');
      const attempts = await idbRequest<TaskAttempt[]>(tx.objectStore(ATTEMPTS_STORE).getAll());
      await txDone(tx);
      return attempts;
    } finally {
      db.close();
    }
  }

  async getAttemptsForTask(taskId: string): Promise<TaskAttempt[]> {
    const db = await openDb();
    try {
      const tx = db.transaction(ATTEMPTS_STORE, 'readonly');
      const index = tx.objectStore(ATTEMPTS_STORE).index('taskId');
      const attempts = await idbRequest<TaskAttempt[]>(index.getAll(taskId));
      await txDone(tx);
      return attempts;
    } finally {
      db.close();
    }
  }

  async saveAttempt(attempt: TaskAttempt): Promise<void> {
    const db = await openDb();
    try {
      const tx = db.transaction(ATTEMPTS_STORE, 'readwrite');
      tx.objectStore(ATTEMPTS_STORE).put(attempt);
      await txDone(tx);
    } finally {
      db.close();
    }
  }

  async deleteAttemptsForTasks(taskIds: string[]): Promise<void> {
    if (taskIds.length === 0) return;
    const idSet = new Set(taskIds);
    const db = await openDb();
    try {
      const tx = db.transaction(ATTEMPTS_STORE, 'readwrite');
      const store = tx.objectStore(ATTEMPTS_STORE);
      const all = await idbRequest<TaskAttempt[]>(store.getAll());
      for (const attempt of all) {
        if (idSet.has(attempt.taskId)) {
          store.delete(attempt.id);
        }
      }
      await txDone(tx);
    } finally {
      db.close();
    }
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

    const db = await openDb();
    try {
      const tx = db.transaction([ATTEMPTS_STORE, SETTINGS_STORE], 'readwrite');
      const attemptsStore = tx.objectStore(ATTEMPTS_STORE);
      const settingsStore = tx.objectStore(SETTINGS_STORE);

      if (mode === 'replace') {
        attemptsStore.clear();
      }

      for (const attempt of snapshot.attempts) {
        attemptsStore.put(attempt);
      }

      if (snapshot.settings) {
        settingsStore.put(normalizeUiSettings(snapshot.settings), SETTINGS_KEY);
      }

      await txDone(tx);
    } finally {
      db.close();
    }
  }

  async clearAll(): Promise<void> {
    const db = await openDb();
    try {
      const tx = db.transaction([ATTEMPTS_STORE, SETTINGS_STORE], 'readwrite');
      tx.objectStore(ATTEMPTS_STORE).clear();
      tx.objectStore(SETTINGS_STORE).clear();
      await txDone(tx);
    } finally {
      db.close();
    }
  }
}

/** Singleton used by the app. Swap this for a Supabase implementation later. */
export const progressRepository: ProgressRepository = new IndexedDBProgressRepository();
