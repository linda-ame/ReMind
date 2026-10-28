import {
  MEMORY_PATTERN_GAMES_STORE,
  MEMORY_PATTERN_STATE_STORE,
  openProgressDb,
} from '../repositories/IndexedDBProgressRepository';
import { abandonGame, createGameFromSettings } from './gameplay';
import {
  DEFAULT_MEMORY_PATTERN_SETTINGS,
  GRID_SPEC,
  MEMORY_PATTERN_TYPE,
  isMemoryPatternDifficulty,
  isMemoryPatternGrid,
  patternKey,
  type MemoryPatternDifficulty,
  type MemoryPatternGame,
  type MemoryPatternGrid,
  type MemoryPatternPhase,
  type MemoryPatternSettings,
  type MemoryPatternStatus,
} from './types';

const STATE_ID = 'state';
const RECENT_LIMIT = 12;

interface StoredState {
  id: typeof STATE_ID;
  grid: MemoryPatternGrid;
  difficulty: MemoryPatternDifficulty;
  configured: boolean;
  recentPatternKeys: string[];
  /** The color key is shown on the first result only. */
  resultHintSeen: boolean;
}

export interface MemoryPatternSession {
  showSettings: boolean;
  settings: MemoryPatternSettings;
  game: MemoryPatternGame | null;
  resultHintSeen: boolean;
}

let mutation: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = mutation.then(task, task);
  mutation = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function openMemoryPatternSession(): Promise<MemoryPatternSession> {
  return enqueue(loadMemoryPatternSession);
}

export function beginMemoryPatternGame(
  settings: MemoryPatternSettings,
): Promise<MemoryPatternGame> {
  return enqueue(() => writeNewGame(settings));
}

export function saveMemoryPatternGame(game: MemoryPatternGame): Promise<void> {
  return enqueue(async () => {
    const db = await openProgressDb();
    const tx = db.transaction(MEMORY_PATTERN_GAMES_STORE, 'readwrite');
    tx.objectStore(MEMORY_PATTERN_GAMES_STORE).put(game);
    await txDone(tx);
  });
}

export function listMemoryPatternGames(): Promise<MemoryPatternGame[]> {
  return enqueue(async () => {
    const db = await openProgressDb();
    const tx = db.transaction(MEMORY_PATTERN_GAMES_STORE, 'readonly');
    const rows = await idbRequest<unknown[]>(
      tx.objectStore(MEMORY_PATTERN_GAMES_STORE).getAll(),
    );
    await txDone(tx);
    return rows.flatMap((row) => {
      const game = parseGame(row);
      return game ? [game] : [];
    });
  });
}

async function loadMemoryPatternSession(): Promise<MemoryPatternSession> {
  const db = await openProgressDb();
  const snapshot = await readPatternSnapshot(db);
  const state = snapshot.state;

  const settings: MemoryPatternSettings = state
    ? { grid: state.grid, difficulty: state.difficulty }
    : DEFAULT_MEMORY_PATTERN_SETTINGS;

  if (!state?.configured) {
    return { showSettings: true, settings, game: null, resultHintSeen: false };
  }

  const active = snapshot.games
    .filter((game) => game.status === 'in_progress')
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0];

  if (active) {
    return {
      showSettings: false,
      settings,
      game: active,
      resultHintSeen: state.resultHintSeen,
    };
  }

  const game = await writeNewGame(settings);
  return {
    showSettings: false,
    settings,
    game,
    resultHintSeen: state.resultHintSeen,
  };
}

async function writeNewGame(settings: MemoryPatternSettings): Promise<MemoryPatternGame> {
  const db = await openProgressDb();
  const snapshot = await readPatternSnapshot(db);
  const now = new Date().toISOString();
  const recent = snapshot.state?.recentPatternKeys ?? [];
  const game = createGameFromSettings(settings, recent);
  const tx = db.transaction(
    [MEMORY_PATTERN_GAMES_STORE, MEMORY_PATTERN_STATE_STORE],
    'readwrite',
  );
  const done = txDone(tx);
  const games = tx.objectStore(MEMORY_PATTERN_GAMES_STORE);
  for (const existing of snapshot.games) {
    if (existing.status === 'in_progress') {
      games.put(abandonGame(existing, now));
    }
  }
  games.put(game);
  const nextState: StoredState = {
    id: STATE_ID,
    grid: settings.grid,
    difficulty: settings.difficulty,
    configured: true,
    recentPatternKeys: remember(recent, game.pattern),
    resultHintSeen: snapshot.state?.resultHintSeen === true,
  };
  tx.objectStore(MEMORY_PATTERN_STATE_STORE).put(nextState);
  await done;
  return game;
}

async function readPatternSnapshot(db: IDBDatabase): Promise<{
  state: StoredState | null;
  games: MemoryPatternGame[];
}> {
  const tx = db.transaction(
    [MEMORY_PATTERN_GAMES_STORE, MEMORY_PATTERN_STATE_STORE],
    'readonly',
  );
  const done = txDone(tx);
  const stateRequest = idbRequest(
    tx.objectStore(MEMORY_PATTERN_STATE_STORE).get(STATE_ID),
  );
  const rowsRequest = idbRequest<unknown[]>(
    tx.objectStore(MEMORY_PATTERN_GAMES_STORE).getAll(),
  );
  const state = parseState(await stateRequest);
  const rows = await rowsRequest;
  await done;
  return {
    state,
    games: rows.flatMap((row) => {
      const game = parseGame(row);
      return game ? [game] : [];
    }),
  };
}

function remember(keys: readonly string[], pattern: readonly number[]): string[] {
  const key = patternKey(pattern);
  return [key, ...keys.filter((item) => item !== key)].slice(0, RECENT_LIMIT);
}

function parseState(value: unknown): StoredState | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as StoredState;
  if (!isMemoryPatternGrid(state.grid)) return null;
  if (!isMemoryPatternDifficulty(state.difficulty)) return null;
  const recent = Array.isArray(state.recentPatternKeys)
    ? state.recentPatternKeys.filter((item) => typeof item === 'string')
    : [];
  return {
    id: STATE_ID,
    grid: state.grid,
    difficulty: state.difficulty,
    configured: state.configured === true,
    recentPatternKeys: recent,
    resultHintSeen: state.resultHintSeen === true,
  };
}

export function markPatternResultHintSeen(): Promise<void> {
  return enqueue(async () => {
    const db = await openProgressDb();
    const tx = db.transaction(MEMORY_PATTERN_STATE_STORE, 'readwrite');
    const store = tx.objectStore(MEMORY_PATTERN_STATE_STORE);
    const current = parseState(await idbRequest(store.get(STATE_ID)));
    if (!current || current.resultHintSeen) {
      await txDone(tx);
      return;
    }
    store.put({ ...current, resultHintSeen: true });
    await txDone(tx);
  });
}

function parseGame(value: unknown): MemoryPatternGame | null {
  if (!value || typeof value !== 'object') return null;
  const game = value as MemoryPatternGame;
  if (game.type !== MEMORY_PATTERN_TYPE) return null;
  if (!isMemoryPatternGrid(game.grid) || !isMemoryPatternDifficulty(game.difficulty)) {
    return null;
  }
  const spec = GRID_SPEC[game.grid];
  if (game.rows !== spec.rows || game.cols !== spec.cols) return null;
  if (typeof game.id !== 'string' || typeof game.startedAt !== 'string') return null;
  if (!isPhase(game.phase) || !isStatus(game.status)) return null;
  const pattern = indexList(game.pattern, spec.cells);
  const selected = indexList(game.selected, spec.cells);
  if (!pattern || pattern.length === 0 || pattern.length >= spec.cells) return null;
  if (!selected) return null;
  return {
    ...game,
    pattern,
    selected,
    correctCount: nullableCount(game.correctCount),
    missedCount: nullableCount(game.missedCount),
    extraCount: nullableCount(game.extraCount),
    exact: typeof game.exact === 'boolean' ? game.exact : null,
    completedAt: typeof game.completedAt === 'string' ? game.completedAt : null,
    generatorVersion:
      typeof game.generatorVersion === 'number' ? game.generatorVersion : 1,
  };
}

function indexList(value: unknown, cells: number): number[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<number>();
  for (const item of value) {
    if (!Number.isInteger(item) || item < 0 || item >= cells || seen.has(item)) {
      return null;
    }
    seen.add(item);
  }
  return [...seen].sort((a, b) => a - b);
}

function nullableCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isPhase(value: unknown): value is MemoryPatternPhase {
  return value === 'memorize' || value === 'recall' || value === 'result';
}

function isStatus(value: unknown): value is MemoryPatternStatus {
  return value === 'in_progress' || value === 'completed' || value === 'abandoned';
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
