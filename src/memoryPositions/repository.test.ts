import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  indexedDBProgressRepository,
  resetProgressDbConnection,
} from '../repositories/IndexedDBProgressRepository';
import type { TaskAttempt } from '../types/progress';
import { beginRecall, placeSymbol, selectSymbol, submitAnswer } from './gameplay';
import {
  beginMemoryPositionsGame,
  listMemoryPositionsGames,
  markPositionsInstructionSeen,
  openMemoryPositionsSession,
  saveMemoryPositionsGame,
} from './repository';

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

describe('figure position storage', () => {
  it('shows settings only before the first saved choice', async () => {
    const first = await openMemoryPositionsSession();
    expect(first.showSettings).toBe(true);
    expect(first.game).toBeNull();
    expect(first.showInstruction).toBe(true);

    const started = await beginMemoryPositionsGame({
      grid: '3x4',
      difficulty: 4,
      category: 'letters',
    });
    expect(started.grid).toBe('3x4');
    expect(started.difficulty).toBe(4);
    expect(started.category).toBe('letters');
    expect(started.phase).toBe('memorize');

    const again = await openMemoryPositionsSession();
    expect(again.showSettings).toBe(false);
    expect(again.game?.id).toBe(started.id);
    expect(again.game?.solution).toEqual(started.solution);
    expect(again.game?.trayOrder).toEqual(started.trayOrder);
    expect(again.showInstruction).toBe(true);
  });

  it('restores an unfinished game with the same figures', async () => {
    const started = await beginMemoryPositionsGame({
      grid: '2x3',
      difficulty: 1,
      category: 'colored',
    });
    const symbolId = started.trayOrder[0]!;
    const recalled = placeSymbol(
      selectSymbol(beginRecall(started), symbolId),
      symbolId,
      4,
    );
    await saveMemoryPositionsGame({ ...recalled, selectedSymbolId: started.trayOrder[1]! });

    const restored = await openMemoryPositionsSession();
    expect(restored.showSettings).toBe(false);
    expect(restored.game?.phase).toBe('recall');
    expect(restored.game?.solution).toEqual(started.solution);
    expect(restored.game?.placements).toEqual([{ symbolId, cell: 4 }]);
    expect(restored.game?.selectedSymbolId).toBe(started.trayOrder[1]);
    expect(restored.game?.trayOrder).toEqual(started.trayOrder);
  });

  it('starts the next game from the saved settings', async () => {
    const started = await beginMemoryPositionsGame({
      grid: '4x4',
      difficulty: 2,
      category: 'digits',
    });
    await saveMemoryPositionsGame(submitAnswer({
      ...beginRecall(started),
      placements: started.solution.map((item) => ({ ...item })),
    }));
    await markPositionsInstructionSeen();

    const next = await openMemoryPositionsSession();
    expect(next.showSettings).toBe(false);
    expect(next.showInstruction).toBe(false);
    expect(next.game?.grid).toBe('4x4');
    expect(next.game?.difficulty).toBe(2);
    expect(next.game?.categorySetting).toBe('digits');
    expect(next.game?.id).not.toBe(started.id);
    expect(next.game?.phase).toBe('memorize');
  });

  it('keeps finished games when a new one replaces an unfinished game', async () => {
    const started = await beginMemoryPositionsGame({
      grid: '2x3',
      difficulty: 1,
      category: 'black',
    });
    const finished = submitAnswer({
      ...beginRecall(started),
      placements: started.solution.map((item) => ({ ...item })),
    });
    await saveMemoryPositionsGame(finished);
    const replacement = await beginMemoryPositionsGame({
      grid: '4x4',
      difficulty: 5,
      category: 'colored',
    });
    const games = await listMemoryPositionsGames();
    expect(games.find((game) => game.id === finished.id)?.exact).toBe(true);
    expect(games.find((game) => game.id === finished.id)?.status).toBe('completed');
    expect(games.find((game) => game.id === replacement.id)?.grid).toBe('4x4');
    expect(games.find((game) => game.id === started.id)?.status).not.toBe('in_progress');
  });

  it('leaves other ReMind progress in place', async () => {
    await indexedDBProgressRepository.saveAttempt(attempt);
    await beginMemoryPositionsGame({ grid: '2x4', difficulty: 1, category: 'mixed' });
    const attempts = await indexedDBProgressRepository.getAllAttempts();
    expect(attempts.find((item) => item.id === 'keep-me')?.enteredAnswer).toBe('saule');

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('remind-progress');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(db.objectStoreNames.contains('attempts')).toBe(true);
    expect(db.objectStoreNames.contains('memorySessions')).toBe(true);
    expect(db.objectStoreNames.contains('memoryPatternGames')).toBe(true);
    expect(db.objectStoreNames.contains('memoryPositionsGames')).toBe(true);
    db.close();
  });

  it('keeps old task attempts when the position stores are added', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('remind-progress', 5);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('attempts')) {
          const store = db.createObjectStore('attempts', { keyPath: 'id' });
          store.createIndex('taskId', 'taskId', { unique: false });
          store.createIndex('completedAt', 'completedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
        if (!db.objectStoreNames.contains('memorySessions')) {
          const memory = db.createObjectStore('memorySessions', { keyPath: 'sessionId' });
          memory.createIndex('mode', 'mode', { unique: false });
          memory.createIndex('taskId', 'taskId', { unique: false });
        }
        if (!db.objectStoreNames.contains('memoryPatternGames')) {
          db.createObjectStore('memoryPatternGames', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('memoryPatternState')) {
          db.createObjectStore('memoryPatternState', { keyPath: 'id' });
        }
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
    await openMemoryPositionsSession();
    const after = await indexedDBProgressRepository.getAllAttempts();
    expect(after.find((item) => item.id === 'keep-me')?.enteredAnswer).toBe('saule');
  });
});
