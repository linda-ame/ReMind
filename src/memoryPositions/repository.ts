import {
  MEMORY_POSITIONS_GAMES_STORE,
  MEMORY_POSITIONS_STATE_STORE,
  openProgressDb,
} from '../repositories/IndexedDBProgressRepository';
import { positionsSummary } from '../games/summary';
import { isShapeId } from '../memoryPairs/types';
import { uploadGameSummary } from '../repositories/gameSummaryCloud';
import { abandonGame, createGameFromSettings } from './gameplay';
import {
  dealKey,
  DEFAULT_MEMORY_POSITIONS_SETTINGS,
  GRID_SPEC,
  MEMORY_POSITIONS_TYPE,
  isMemoryPositionsCategory,
  isMemoryPositionsCategorySetting,
  isMemoryPositionsDifficulty,
  isMemoryPositionsGrid,
  type MemoryPositionsCategory,
  type MemoryPositionsDifficulty,
  type MemoryPositionsGame,
  type MemoryPositionsGrid,
  type MemoryPositionsPhase,
  type MemoryPositionsSettings,
  type MemoryPositionsStatus,
  type MemoryPositionsSymbol,
  type SymbolPlacement,
} from './types';

const STATE_ID = 'state';
const RECENT_LIMIT = 12;

interface StoredState {
  id: typeof STATE_ID;
  grid: MemoryPositionsGrid;
  difficulty: MemoryPositionsDifficulty;
  category: MemoryPositionsSettings['category'];
  configured: boolean;
  recentKeys: string[];
  lastCategory: MemoryPositionsCategory | null;
  /** The short instruction is shown on the first game only. */
  instructionSeen: boolean;
}

export interface MemoryPositionsSession {
  showSettings: boolean;
  settings: MemoryPositionsSettings;
  game: MemoryPositionsGame | null;
  showInstruction: boolean;
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

export function openMemoryPositionsSession(): Promise<MemoryPositionsSession> {
  return enqueue(loadMemoryPositionsSession);
}

export function beginMemoryPositionsGame(
  settings: MemoryPositionsSettings,
): Promise<MemoryPositionsGame> {
  return enqueue(() => writeNewGame(settings));
}

export function saveMemoryPositionsGame(game: MemoryPositionsGame): Promise<void> {
  return enqueue(async () => {
    const db = await openProgressDb();
    const tx = db.transaction(MEMORY_POSITIONS_GAMES_STORE, 'readwrite');
    tx.objectStore(MEMORY_POSITIONS_GAMES_STORE).put(game);
    await txDone(tx);
    uploadGameSummary(positionsSummary(game));
  });
}

export function listMemoryPositionsGames(): Promise<MemoryPositionsGame[]> {
  return enqueue(async () => {
    const db = await openProgressDb();
    const tx = db.transaction(MEMORY_POSITIONS_GAMES_STORE, 'readonly');
    const rows = await idbRequest<unknown[]>(
      tx.objectStore(MEMORY_POSITIONS_GAMES_STORE).getAll(),
    );
    await txDone(tx);
    return rows.flatMap((row) => {
      const game = parseGame(row);
      return game ? [game] : [];
    });
  });
}

export function markPositionsInstructionSeen(): Promise<void> {
  return enqueue(async () => {
    const db = await openProgressDb();
    const tx = db.transaction(MEMORY_POSITIONS_STATE_STORE, 'readwrite');
    const store = tx.objectStore(MEMORY_POSITIONS_STATE_STORE);
    const current = parseState(await idbRequest(store.get(STATE_ID)));
    if (!current || current.instructionSeen) {
      await txDone(tx);
      return;
    }
    store.put({ ...current, instructionSeen: true });
    await txDone(tx);
  });
}

async function loadMemoryPositionsSession(): Promise<MemoryPositionsSession> {
  const db = await openProgressDb();
  const snapshot = await readSnapshot(db);
  const state = snapshot.state;
  const settings: MemoryPositionsSettings = state
    ? { grid: state.grid, difficulty: state.difficulty, category: state.category }
    : DEFAULT_MEMORY_POSITIONS_SETTINGS;

  if (!state?.configured) {
    return { showSettings: true, settings, game: null, showInstruction: true };
  }

  const active = snapshot.games
    .filter((game) => game.status === 'in_progress')
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0];

  if (active) {
    return {
      showSettings: false,
      settings,
      game: active,
      showInstruction: !state.instructionSeen,
    };
  }

  const game = await writeNewGame(settings);
  const fresh = await readSnapshot(await openProgressDb());
  return {
    showSettings: false,
    settings,
    game,
    showInstruction: fresh.state?.instructionSeen !== true,
  };
}

async function writeNewGame(settings: MemoryPositionsSettings): Promise<MemoryPositionsGame> {
  const db = await openProgressDb();
  const snapshot = await readSnapshot(db);
  const now = new Date().toISOString();
  const recent = snapshot.state?.recentKeys ?? [];
  const game = createGameFromSettings(settings, {
    recentKeys: recent,
    lastCategory: snapshot.state?.lastCategory ?? null,
    now,
  });
  const tx = db.transaction(
    [MEMORY_POSITIONS_GAMES_STORE, MEMORY_POSITIONS_STATE_STORE],
    'readwrite',
  );
  const done = txDone(tx);
  const games = tx.objectStore(MEMORY_POSITIONS_GAMES_STORE);
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
    category: settings.category,
    configured: true,
    recentKeys: remember(recent, game),
    lastCategory: game.category,
    instructionSeen: snapshot.state?.instructionSeen === true,
  };
  tx.objectStore(MEMORY_POSITIONS_STATE_STORE).put(nextState);
  await done;
  return game;
}

async function readSnapshot(db: IDBDatabase): Promise<{
  state: StoredState | null;
  games: MemoryPositionsGame[];
}> {
  const tx = db.transaction(
    [MEMORY_POSITIONS_GAMES_STORE, MEMORY_POSITIONS_STATE_STORE],
    'readonly',
  );
  const done = txDone(tx);
  const stateRequest = idbRequest(tx.objectStore(MEMORY_POSITIONS_STATE_STORE).get(STATE_ID));
  const rowsRequest = idbRequest<unknown[]>(
    tx.objectStore(MEMORY_POSITIONS_GAMES_STORE).getAll(),
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

function remember(keys: readonly string[], game: MemoryPositionsGame): string[] {
  const key = dealKey(game.solution);
  return [key, ...keys.filter((item) => item !== key)].slice(0, RECENT_LIMIT);
}

function parseState(value: unknown): StoredState | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as StoredState;
  if (!isMemoryPositionsGrid(state.grid)) return null;
  if (!isMemoryPositionsDifficulty(state.difficulty)) return null;
  if (!isMemoryPositionsCategorySetting(state.category)) return null;
  const recent = Array.isArray(state.recentKeys)
    ? state.recentKeys.filter((item) => typeof item === 'string')
    : [];
  return {
    id: STATE_ID,
    grid: state.grid,
    difficulty: state.difficulty,
    category: state.category,
    configured: state.configured === true,
    recentKeys: recent,
    lastCategory: isMemoryPositionsCategory(state.lastCategory) ? state.lastCategory : null,
    instructionSeen: state.instructionSeen === true,
  };
}

function parseGame(value: unknown): MemoryPositionsGame | null {
  if (!value || typeof value !== 'object') return null;
  const game = value as MemoryPositionsGame;
  if (game.type !== MEMORY_POSITIONS_TYPE) return null;
  if (!isMemoryPositionsGrid(game.grid) || !isMemoryPositionsDifficulty(game.difficulty)) {
    return null;
  }
  if (!isMemoryPositionsCategorySetting(game.categorySetting)) return null;
  if (!isMemoryPositionsCategory(game.category)) return null;
  const spec = GRID_SPEC[game.grid];
  if (game.rows !== spec.rows || game.cols !== spec.cols) return null;
  if (typeof game.id !== 'string' || typeof game.startedAt !== 'string') return null;
  if (!isPhase(game.phase) || !isStatus(game.status)) return null;
  const symbols = parseSymbols(game.symbols, game.category);
  if (!symbols || symbols.length < 2) return null;
  const ids = new Set(symbols.map((symbol) => symbol.id));
  const solution = parsePlacements(game.solution, ids, spec.cells);
  const placements = parsePlacements(game.placements, ids, spec.cells);
  if (!solution || solution.length !== symbols.length) return null;
  if (!placements) return null;
  const trayOrder = parseTray(game.trayOrder, ids);
  if (!trayOrder) return null;
  const selected =
    typeof game.selectedSymbolId === 'string' &&
    ids.has(game.selectedSymbolId) &&
    !placements.some((item) => item.symbolId === game.selectedSymbolId)
      ? game.selectedSymbolId
      : null;
  return {
    ...game,
    symbols,
    solution,
    placements,
    trayOrder,
    selectedSymbolId: selected,
    correctCount: nullableCount(game.correctCount),
    totalCount: solution.length,
    exact: typeof game.exact === 'boolean' ? game.exact : null,
    usedHelp: game.usedHelp === true,
    studiedAt: typeof game.studiedAt === 'string' ? game.studiedAt : null,
    placementChanges:
      typeof game.placementChanges === 'number' && game.placementChanges >= 0
        ? Math.floor(game.placementChanges)
        : 0,
    completedAt: typeof game.completedAt === 'string' ? game.completedAt : null,
    generatorVersion:
      typeof game.generatorVersion === 'number' ? game.generatorVersion : 1,
  };
}

function parseSymbols(
  value: unknown,
  category: MemoryPositionsCategory,
): MemoryPositionsSymbol[] | null {
  if (!Array.isArray(value)) return null;
  const symbols: MemoryPositionsSymbol[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const symbol = item as MemoryPositionsSymbol;
    if (typeof symbol.id !== 'string' || seen.has(symbol.id)) return null;
    if (symbol.category !== category) return null;
    if (symbol.kind !== 'shape' && symbol.kind !== 'letter' && symbol.kind !== 'digit') {
      return null;
    }
    if (typeof symbol.label !== 'string' || symbol.label.length === 0) return null;
    seen.add(symbol.id);
    symbols.push({
      id: symbol.id,
      category: symbol.category,
      label: symbol.label,
      kind: symbol.kind,
      shape: typeof symbol.shape === 'string' && isShapeId(symbol.shape) ? symbol.shape : undefined,
      color: typeof symbol.color === 'string' ? symbol.color : undefined,
      text: typeof symbol.text === 'string' ? symbol.text : undefined,
    });
  }
  return symbols;
}

function parsePlacements(
  value: unknown,
  ids: ReadonlySet<string>,
  cells: number,
): SymbolPlacement[] | null {
  if (!Array.isArray(value)) return null;
  const placements: SymbolPlacement[] = [];
  const seenSymbols = new Set<string>();
  const seenCells = new Set<number>();
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const placement = item as SymbolPlacement;
    if (typeof placement.symbolId !== 'string' || !ids.has(placement.symbolId)) return null;
    if (!Number.isInteger(placement.cell) || placement.cell < 0 || placement.cell >= cells) {
      return null;
    }
    if (seenSymbols.has(placement.symbolId) || seenCells.has(placement.cell)) return null;
    seenSymbols.add(placement.symbolId);
    seenCells.add(placement.cell);
    placements.push({ symbolId: placement.symbolId, cell: placement.cell });
  }
  return placements;
}

function parseTray(value: unknown, ids: ReadonlySet<string>): string[] | null {
  if (!Array.isArray(value)) return null;
  const order = value.filter((item): item is string => typeof item === 'string' && ids.has(item));
  const seen = new Set<string>();
  const unique = order.filter((item) => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
  for (const id of ids) {
    if (!seen.has(id)) unique.push(id);
  }
  return unique.length === ids.size ? unique : null;
}

function nullableCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isPhase(value: unknown): value is MemoryPositionsPhase {
  return value === 'memorize' || value === 'recall' || value === 'result';
}

function isStatus(value: unknown): value is MemoryPositionsStatus {
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
