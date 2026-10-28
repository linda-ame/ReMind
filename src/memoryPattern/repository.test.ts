import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  indexedDBProgressRepository,
  resetProgressDbConnection,
} from '../repositories/IndexedDBProgressRepository';
import type { TaskAttempt } from '../types/progress';
import {
  beginMemoryPatternGame,
  listMemoryPatternGames,
  openMemoryPatternSession,
  saveMemoryPatternGame,
} from './repository';
import { beginRecall, submitAnswer, toggleCell } from './gameplay';

const attempt: TaskAttempt = {
  id: 'keep-me',
  taskId: 'word-1',
  contentVersion: 1,
  startedAt: '2026-01-01T00:00:00.000Z',
  completedAt: '2026-01-01T00:01:00.000Z',
  status: 'completed',
  enteredAnswer: 'saule',
  usedHint: false,
  viewedAnswers: false,
  selfAssessment: null,
};

async function deleteDatabase(): Promise<void> {
  await resetProgressDbConnection();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('remind-progress');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

afterEach(async () => {
  await deleteDatabase();
});

describe('pattern storage', () => {
  it('shows settings only before the first saved choice', async () => {
    const first = await openMemoryPatternSession();
    expect(first.showSettings).toBe(true);
    expect(first.game).toBeNull();
    expect(await listMemoryPatternGames()).toEqual([]);

    const started = await beginMemoryPatternGame({ grid: '3x4', difficulty: 4 });
    expect(started.grid).toBe('3x4');
    expect(started.difficulty).toBe(4);
    expect(started.phase).toBe('memorize');

    const again = await openMemoryPatternSession();
    expect(again.showSettings).toBe(false);
    expect(again.game?.id).toBe(started.id);
    expect(again.game?.pattern).toEqual(started.pattern);
  });

  it('restores an unfinished game with the same pattern and marks', async () => {
    const started = await beginMemoryPatternGame({ grid: '2x3', difficulty: 1 });
    const recalled = toggleCell(beginRecall(started), 1);
    await saveMemoryPatternGame(recalled);

    const restored = await openMemoryPatternSession();
    expect(restored.showSettings).toBe(false);
    expect(restored.game?.phase).toBe('recall');
    expect(restored.game?.pattern).toEqual(started.pattern);
    expect(restored.game?.selected).toEqual([1]);
  });

  it('starts the next game from the saved settings', async () => {
    const started = await beginMemoryPatternGame({ grid: '4x4', difficulty: 2 });
    await saveMemoryPatternGame(submitAnswer(beginRecall(started)));

    const next = await openMemoryPatternSession();
    expect(next.showSettings).toBe(false);
    expect(next.game?.grid).toBe('4x4');
    expect(next.game?.difficulty).toBe(2);
    expect(next.game?.id).not.toBe(started.id);
    expect(next.game?.phase).toBe('memorize');
  });

  it('keeps finished games when settings change', async () => {
    const started = await beginMemoryPatternGame({ grid: '2x3', difficulty: 1 });
    const finished = submitAnswer({
      ...beginRecall(started),
      selected: [...started.pattern],
    });
    await saveMemoryPatternGame(finished);

    const replacement = await beginMemoryPatternGame({ grid: '4x4', difficulty: 5 });
    const games = await listMemoryPatternGames();
    const kept = games.find((game) => game.id === finished.id);
    expect(kept?.status).toBe('completed');
    expect(kept?.grid).toBe('2x3');
    expect(kept?.difficulty).toBe(1);
    expect(kept?.exact).toBe(true);
    expect(games.find((game) => game.id === replacement.id)?.grid).toBe('4x4');
    expect(games.find((game) => game.id === started.id)?.status).not.toBe('in_progress');
  });

  it('marks a replaced unfinished game as abandoned', async () => {
    const started = await beginMemoryPatternGame({ grid: '3x3', difficulty: 2 });
    await beginMemoryPatternGame({ grid: '3x3', difficulty: 3 });
    const games = await listMemoryPatternGames();
    expect(games.find((game) => game.id === started.id)?.status).toBe('abandoned');
    expect(games.filter((game) => game.status === 'completed')).toHaveLength(0);
  });

  it('leaves other ReMind progress in place', async () => {
    await indexedDBProgressRepository.saveAttempt(attempt);
    await beginMemoryPatternGame({ grid: '2x4', difficulty: 1 });
    const attempts = await indexedDBProgressRepository.getAllAttempts();
    expect(attempts.map((item) => item.id)).toContain('keep-me');
    expect(attempts.find((item) => item.id === 'keep-me')?.enteredAnswer).toBe('saule');

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('remind-progress');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(db.objectStoreNames.contains('attempts')).toBe(true);
    expect(db.objectStoreNames.contains('memorySessions')).toBe(true);
    db.close();
  });

  it('keeps old task attempts when the pattern stores are added', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('remind-progress', 3);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.createObjectStore('attempts', { keyPath: 'id' });
        store.createIndex('taskId', 'taskId', { unique: false });
        store.createIndex('completedAt', 'completedAt', { unique: false });
        db.createObjectStore('settings');
        const memory = db.createObjectStore('memorySessions', { keyPath: 'sessionId' });
        memory.createIndex('mode', 'mode', { unique: false });
        memory.createIndex('taskId', 'taskId', { unique: false });
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('attempts', 'readwrite');
        tx.objectStore('attempts').put(attempt);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });

    const before = await indexedDBProgressRepository.getAllAttempts();
    expect(before.map((item) => item.id)).toContain('keep-me');
    await openMemoryPatternSession();
    const after = await indexedDBProgressRepository.getAllAttempts();
    expect(after.map((item) => item.id)).toContain('keep-me');
  });
});
