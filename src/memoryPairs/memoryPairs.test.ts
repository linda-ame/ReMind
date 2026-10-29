/**
 * @vitest-environment jsdom
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { MEMORY_PAIRS_DIFFICULTY_TABLE, classifyMemoryPairsDifficulty } from './difficulty';
import { dealMemoryPairsGame } from './generate';
import {
  listMemoryPairsResults,
  loadMemoryPairs,
  openMemoryPairs,
  persistActiveGame,
  persistNewGame,
  resetMemoryPairsStoreForTests,
  saveMemoryPairsSettings,
} from './repository';
import { symbolVariants } from './symbols';
import {
  EMPTY_MEMORY_PAIRS_MEMORY,
  gridPairs,
  type MemoryPairsCategory,
  type MemoryPairsGrid,
  type MemoryPairsResult,
  type MemoryPairsSymbol,
} from './types';

const GRIDS: MemoryPairsGrid[] = ['2x3', '2x4', '3x4', '4x4'];
const CATEGORIES: MemoryPairsCategory[] = ['colored', 'black', 'letters', 'digits'];
const DISTINCT_SHAPES = new Set([
  'circle',
  'square',
  'triangle',
  'star',
  'heart',
  'cross',
  'arrow',
  'moon',
]);
const DISTINCT_LETTERS = new Set(['A', 'E', 'H', 'K', 'L', 'O', 'S', 'T', 'X', 'Z', 'U', 'Y']);
const DISTINCT_DIGITS = new Set(['1', '2', '3', '4', '5', '7', '8', '0']);
const LEGACY_KEY = 'remind-memory-pairs';

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  resetMemoryPairsStoreForTests();
  localStorage.clear();
  await deleteDb('remind-memory-pairs');
  await deleteDb('remind-progress');
});

function assertDistinct(symbols: readonly MemoryPairsSymbol[]): void {
  const ids = symbols.map((symbol) => symbol.id);
  expect(new Set(ids).size).toBe(symbols.length);
  if (symbols[0]?.kind === 'shape') {
    const shapes = symbols.map((symbol) => symbol.shape);
    expect(new Set(shapes).size).toBe(symbols.length);
    for (const shape of shapes) expect(DISTINCT_SHAPES.has(shape ?? '')).toBe(true);
  }
  if (symbols[0]?.category === 'colored') {
    const colors = symbols.map((symbol) => symbol.color);
    expect(new Set(colors).size).toBe(symbols.length);
  }
  if (symbols[0]?.kind === 'letter') {
    for (const symbol of symbols) expect(DISTINCT_LETTERS.has(symbol.text ?? '')).toBe(true);
  }
  if (symbols[0]?.kind === 'digit') {
    for (const symbol of symbols) expect(DISTINCT_DIGITS.has(symbol.text ?? '')).toBe(true);
  }
}

describe('memory pairs difficulty', () => {
  it('uses the published table and ignores the old chosen level', () => {
    for (const grid of GRIDS) {
      for (const category of CATEGORIES) {
        expect(classifyMemoryPairsDifficulty(grid, category)).toBe(
          MEMORY_PAIRS_DIFFICULTY_TABLE[grid][category],
        );
        const game = dealMemoryPairsGame(
          { grid, category },
          EMPTY_MEMORY_PAIRS_MEMORY,
        );
        expect(game.difficulty).toBe(MEMORY_PAIRS_DIFFICULTY_TABLE[grid][category]);
        expect(game.category).toBe(category);
        expect(game.cards).toHaveLength(gridPairs(grid) * 2);
      }
    }
  });

  it('classifies a mixed game by the category that was actually dealt', () => {
    for (const grid of GRIDS) {
      for (let index = 0; index < 12; index += 1) {
        const game = dealMemoryPairsGame(
          { grid, category: 'mixed' },
          EMPTY_MEMORY_PAIRS_MEMORY,
        );
        expect(CATEGORIES).toContain(game.category);
        expect(game.categorySetting).toBe('mixed');
        expect(game.difficulty).toBe(
          MEMORY_PAIRS_DIFFICULTY_TABLE[grid][game.category],
        );
      }
    }
  });

  it('deals only clearly distinct symbols', () => {
    for (const category of CATEGORIES) {
      for (const count of [3, 4, 6, 8]) {
        const variants = symbolVariants(category, count);
        expect(variants.length).toBeGreaterThan(0);
        for (const variant of variants) {
          expect(variant).toHaveLength(count);
          assertDistinct(variant);
        }
      }
    }
  });
});

describe('memory pairs storage', () => {
  it('keeps an unfinished board and the old level, and stores the new class beside it', async () => {
    const dealt = dealMemoryPairsGame(
      { grid: '2x3', category: 'colored' },
      EMPTY_MEMORY_PAIRS_MEMORY,
    );
    const unfinished = { ...dealt, difficulty: 5 as const, attempts: 2 };
    const historical = {
      id: 'old-finished',
      grid: '4x4',
      category: 'letters',
      categorySetting: 'letters',
      difficulty: 1,
      pairsFound: 8,
      attempts: 9,
      status: 'complete',
      completedAt: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-02T00:00:00.000Z',
    };
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({
        schemaVersion: 1,
        settings: { grid: '2x3', difficulty: 5, category: 'colored' },
        activeGame: unfinished,
        lastSymbolSet: 'kept',
        results: [historical],
        futureField: 'leave-this',
      }),
    );

    const opened = await openMemoryPairs();
    expect(localStorage.getItem(LEGACY_KEY)).toContain('futureField');
    expect(opened.settings).toEqual({ grid: '2x3', category: 'colored' });
    expect(opened.activeGame?.id).toBe(unfinished.id);
    expect(opened.activeGame?.difficulty).toBe(5);
    expect(opened.activeGame?.cards.map((card) => card.instanceId)).toEqual(
      unfinished.cards.map((card) => card.instanceId),
    );

    const rows = await listMemoryPairsResults();
    const current = rows.find((row) => row.id === unfinished.id);
    const old = rows.find((row) => row.id === 'old-finished');
    expect(current).toMatchObject({
      difficulty: 5,
      classifiedDifficulty: 1,
      grid: '2x3',
      category: 'colored',
      attempts: 2,
      status: 'in_progress',
    });
    expect(old).toMatchObject({ difficulty: 1, classifiedDifficulty: 5, pairsFound: 8 });

    await persistActiveGame({ ...unfinished, attempts: 4, difficulty: 2 });
    const after = (await listMemoryPairsResults()).find((row) => row.id === unfinished.id);
    expect(after).toMatchObject({
      difficulty: 5,
      classifiedDifficulty: 1,
      attempts: 4,
    });
  });

  it('saves a new game with the calculated difficulty and does not touch other progress', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('remind-progress', 3);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('settings', 'readwrite');
        tx.objectStore('settings').put({ marker: 'keep-me' }, 'ui');
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });

    await saveMemoryPairsSettings({ grid: '4x4', category: 'digits' });
    const first = await openMemoryPairs();
    expect(first.settings).toEqual({ grid: '4x4', category: 'digits' });
    expect(first.activeGame?.grid).toBe('4x4');
    expect(first.activeGame?.category).toBe('digits');
    expect(first.activeGame?.difficulty).toBe(5);

    const game = first.activeGame!;
    await persistActiveGame({
      ...game,
      status: 'complete',
      completedAt: '2026-10-28T09:00:00.000Z',
      matchedInstanceIds: game.cards.map((card) => card.instanceId),
      attempts: 8,
    });
    resetMemoryPairsStoreForTests();
    const second = await openMemoryPairs();
    expect(second.settings).toEqual({ grid: '4x4', category: 'digits' });
    expect(second.activeGame?.id).not.toBe(game.id);
    expect(second.activeGame?.difficulty).toBe(5);

    const same = await listMemoryPairsResults({ grid: '4x4', category: 'digits' });
    expect(same.map((row) => row.id)).toEqual(
      expect.arrayContaining([game.id, second.activeGame?.id]),
    );
    expect(same.find((row) => row.id === game.id)).toMatchObject({
      difficulty: 5,
      classifiedDifficulty: 5,
      pairsFound: 8,
      attempts: 8,
      status: 'complete',
      completedAt: '2026-10-28T09:00:00.000Z',
    });

    const marker = await new Promise<string>((resolve, reject) => {
      const request = indexedDB.open('remind-progress', 3);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('settings', 'readonly');
        const get = tx.objectStore('settings').get('ui');
        get.onsuccess = () => {
          db.close();
          resolve((get.result as { marker: string }).marker);
        };
        get.onerror = () => reject(get.error);
      };
    });
    expect(marker).toBe('keep-me');
  });

  it('does not replace a stored result when the same legacy file is still present', async () => {
    const historical: MemoryPairsResult = {
      id: 'kept',
      grid: '3x4',
      category: 'black',
      categorySetting: 'black',
      difficulty: 2,
      classifiedDifficulty: 2,
      pairsFound: 6,
      attempts: 7,
      mismatches: null,
      status: 'complete',
      completedAt: '2026-03-01T00:00:00.000Z',
      createdAt: '2026-03-01T00:00:00.000Z',
    };
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({
        settings: { grid: '3x4', difficulty: 2, category: 'black' },
        activeGame: null,
        results: [historical],
      }),
    );
    await loadMemoryPairs();
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({
        settings: { grid: '2x3', category: 'letters' },
        activeGame: null,
        results: [{ ...historical, difficulty: 5, pairsFound: 0 }],
      }),
    );
    resetMemoryPairsStoreForTests();
    const stored = await loadMemoryPairs();
    expect(stored.settings).toEqual({ grid: '3x4', category: 'black' });
    const row = (await listMemoryPairsResults()).find((item) => item.id === 'kept');
    expect(row).toMatchObject({ difficulty: 2, classifiedDifficulty: 2, pairsFound: 6 });
  });

  it('records a new deal through persistNewGame', async () => {
    const game = dealMemoryPairsGame(
      { grid: '2x4', category: 'letters' },
      EMPTY_MEMORY_PAIRS_MEMORY,
    );
    await persistNewGame(game);
    const row = (await listMemoryPairsResults({ grid: '2x4', category: 'letters' }))[0];
    expect(row).toMatchObject({
      id: game.id,
      difficulty: 3,
      classifiedDifficulty: 3,
      pairsFound: 0,
      status: 'in_progress',
      completedAt: null,
    });
  });
});
