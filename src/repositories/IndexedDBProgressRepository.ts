import type { MemoryMode, MemorySession } from '../types/memory';
import type { ProgressRepository } from './ProgressRepository';
import {
  PROGRESS_SCHEMA_VERSION,
  normalizeUiSettings,
  type ProgressSnapshot,
  type TaskAttempt,
  type UiSettings,
} from '../types/progress';

const DB_NAME = 'remind-progress';
const DB_VERSION = 5;
const ATTEMPTS_STORE = 'attempts';
const SETTINGS_STORE = 'settings';
const MEMORY_STORE = 'memorySessions';
/** Pattern-memory games. Separate from task attempts and memory sessions. */
export const MEMORY_PATTERN_GAMES_STORE = 'memoryPatternGames';
/** Chosen grid, difficulty, and recent pattern keys. */
export const MEMORY_PATTERN_STATE_STORE = 'memoryPatternState';
const SETTINGS_KEY = 'ui';

/** Reuse one connection — open/close per write races under rapid lesson navigation. */
let dbPromise: Promise<IDBDatabase> | null = null;

export function openProgressDb(): Promise<IDBDatabase> {
  return openDb();
}

/** Test helper. Closes the shared connection so the database can be deleted. */
export async function resetProgressDbConnection(): Promise<void> {
  if (!dbPromise) return;
  try {
    const db = await dbPromise;
    db.close();
  } catch {
    // The connection may already be closing.
  }
  dbPromise = null;
}

function patternStoresReady(db: IDBDatabase): boolean {
  return (
    db.objectStoreNames.contains(MEMORY_PATTERN_GAMES_STORE) &&
    db.objectStoreNames.contains(MEMORY_PATTERN_STATE_STORE)
  );
}

function ensureStores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(ATTEMPTS_STORE)) {
    const store = db.createObjectStore(ATTEMPTS_STORE, { keyPath: 'id' });
    store.createIndex('taskId', 'taskId', { unique: false });
    store.createIndex('completedAt', 'completedAt', { unique: false });
  }
  if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
    db.createObjectStore(SETTINGS_STORE);
  }
  if (!db.objectStoreNames.contains(MEMORY_STORE)) {
    const memory = db.createObjectStore(MEMORY_STORE, {
      keyPath: 'sessionId',
    });
    memory.createIndex('mode', 'mode', { unique: false });
    memory.createIndex('taskId', 'taskId', { unique: false });
  }
  if (!db.objectStoreNames.contains(MEMORY_PATTERN_GAMES_STORE)) {
    db.createObjectStore(MEMORY_PATTERN_GAMES_STORE, { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains(MEMORY_PATTERN_STATE_STORE)) {
    db.createObjectStore(MEMORY_PATTERN_STATE_STORE, { keyPath: 'id' });
  }
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = connect(DB_VERSION, true);
  return dbPromise;
}

/**
 * A database already at this version can still lack the pattern stores if an
 * earlier open committed the version before those stores existed. One higher
 * version runs the upgrade again and creates only what is missing.
 */
function connect(version: number, heal: boolean): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, version);

    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error('IndexedDB open failed'));
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onclose = () => {
        dbPromise = null;
      };
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      if (!heal || patternStoresReady(db)) {
        resolve(db);
        return;
      }
      const nextVersion = db.version + 1;
      db.close();
      const healed = connect(nextVersion, false);
      dbPromise = healed;
      healed.then(resolve, reject);
    };

    request.onupgradeneeded = () => {
      ensureStores(request.result);
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
    const tx = db.transaction(SETTINGS_STORE, 'readonly');
    const stored = await idbRequest<UiSettings | undefined>(
      tx.objectStore(SETTINGS_STORE).get(SETTINGS_KEY),
    );
    await txDone(tx);
    return normalizeUiSettings(stored);
  }

  async saveSettings(settings: UiSettings): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    tx.objectStore(SETTINGS_STORE).put(normalizeUiSettings(settings), SETTINGS_KEY);
    await txDone(tx);
  }

  async getAllAttempts(): Promise<TaskAttempt[]> {
    const db = await openDb();
    const tx = db.transaction(ATTEMPTS_STORE, 'readonly');
    const attempts = await idbRequest<TaskAttempt[]>(
      tx.objectStore(ATTEMPTS_STORE).getAll(),
    );
    await txDone(tx);
    return attempts;
  }

  async getAttemptsForTask(taskId: string): Promise<TaskAttempt[]> {
    const db = await openDb();
    const tx = db.transaction(ATTEMPTS_STORE, 'readonly');
    const index = tx.objectStore(ATTEMPTS_STORE).index('taskId');
    const attempts = await idbRequest<TaskAttempt[]>(index.getAll(taskId));
    await txDone(tx);
    return attempts;
  }

  async saveAttempt(attempt: TaskAttempt): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(ATTEMPTS_STORE, 'readwrite');
    const store = tx.objectStore(ATTEMPTS_STORE);
    const existing = await idbRequest<TaskAttempt | undefined>(
      store.get(attempt.id),
    );
    // A reset can land while an older write is still in flight.
    if (existing?.archivedAt) {
      await txDone(tx);
      return;
    }
    store.put({
      ...attempt,
      activeMs: Math.max(existing?.activeMs ?? 0, attempt.activeMs ?? 0),
    });
    await txDone(tx);
  }

  async replaceAttemptsForTaskVersion(attempt: TaskAttempt): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(ATTEMPTS_STORE, 'readwrite');
    const store = tx.objectStore(ATTEMPTS_STORE);
    const index = store.index('taskId');
    const existing = await idbRequest<TaskAttempt[]>(
      index.getAll(attempt.taskId),
    );
    for (const row of existing) {
      if (
        !row.archivedAt &&
        row.contentVersion === attempt.contentVersion &&
        row.id !== attempt.id
      ) {
        store.delete(row.id);
      }
    }
    const current = existing.find((row) => row.id === attempt.id);
    if (!current?.archivedAt) {
      store.put({
        ...attempt,
        activeMs: Math.max(current?.activeMs ?? 0, attempt.activeMs ?? 0),
      });
    }
    await txDone(tx);
  }

  async archiveAttemptsForTasks(
    taskIds: string[],
    archivedAt: string,
  ): Promise<void> {
    if (taskIds.length === 0) return;
    const idSet = new Set(taskIds);
    const db = await openDb();
    const tx = db.transaction(ATTEMPTS_STORE, 'readwrite');
    const store = tx.objectStore(ATTEMPTS_STORE);
    const all = await idbRequest<TaskAttempt[]>(store.getAll());
    for (const attempt of all) {
      if (idSet.has(attempt.taskId) && !attempt.archivedAt) {
        store.put({ ...attempt, archivedAt });
      }
    }
    await txDone(tx);
  }

  async deleteAttemptsForTasks(taskIds: string[]): Promise<void> {
    if (taskIds.length === 0) return;
    const idSet = new Set(taskIds);
    const db = await openDb();
    const tx = db.transaction(ATTEMPTS_STORE, 'readwrite');
    const store = tx.objectStore(ATTEMPTS_STORE);
    const all = await idbRequest<TaskAttempt[]>(store.getAll());
    for (const attempt of all) {
      if (idSet.has(attempt.taskId)) {
        store.delete(attempt.id);
      }
    }
    await txDone(tx);
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
      memorySessions: await getAllMemorySessions(),
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
    if (snapshot.memorySessions) {
      await importMemorySessions(snapshot.memorySessions, mode);
    }
  }

  async clearAll(): Promise<void> {
    const db = await openDb();
    const tx = db.transaction([ATTEMPTS_STORE, SETTINGS_STORE], 'readwrite');
    tx.objectStore(ATTEMPTS_STORE).clear();
    tx.objectStore(SETTINGS_STORE).clear();
    await txDone(tx);
  }
}

export async function getAllMemorySessions(): Promise<MemorySession[]> {
  const db = await openDb();
  if (!db.objectStoreNames.contains(MEMORY_STORE)) return [];
  const tx = db.transaction(MEMORY_STORE, 'readonly');
  const sessions = await idbRequest<MemorySession[]>(
    tx.objectStore(MEMORY_STORE).getAll(),
  );
  await txDone(tx);
  return sessions;
}

export async function saveMemorySession(session: MemorySession): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(MEMORY_STORE, 'readwrite');
  tx.objectStore(MEMORY_STORE).put(session);
  await txDone(tx);
}

export async function deleteMemorySession(sessionId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(MEMORY_STORE, 'readwrite');
  tx.objectStore(MEMORY_STORE).delete(sessionId);
  await txDone(tx);
}

export async function deleteMemorySessionsForMode(
  mode: MemoryMode,
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(MEMORY_STORE, 'readwrite');
  const store = tx.objectStore(MEMORY_STORE);
  const all = await idbRequest<MemorySession[]>(store.getAll());
  for (const session of all) {
    if (session.mode === mode) store.delete(session.sessionId);
  }
  await txDone(tx);
}

/** Missing list leaves existing sessions untouched (older exports). */
export async function importMemorySessions(
  sessions: MemorySession[] | undefined,
  mode: 'merge' | 'replace',
): Promise<void> {
  if (!sessions) return;
  const db = await openDb();
  const tx = db.transaction(MEMORY_STORE, 'readwrite');
  const store = tx.objectStore(MEMORY_STORE);
  if (mode === 'replace') store.clear();
  for (const session of sessions) store.put(session);
  await txDone(tx);
}

/** Local guest store — always available; cloud sync uses Supabase when signed in. */
export const indexedDBProgressRepository: ProgressRepository =
  new IndexedDBProgressRepository();

/** @deprecated Use indexedDBProgressRepository */
export const progressRepository = indexedDBProgressRepository;
