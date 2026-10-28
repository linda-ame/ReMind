import { classifyMemoryPairsDifficulty } from './difficulty';
import { dealMemoryPairsGame, layoutKeyFromCards, symbolSetKeyFromCards } from './generate';
import {
  EMPTY_MEMORY_PAIRS_MEMORY,
  MEMORY_PAIRS_SCHEMA,
  gridPairs,
  isMemoryPairsCategory,
  isMemoryPairsCategorySetting,
  isMemoryPairsDifficulty,
  isMemoryPairsGrid,
  type MemoryPairsDealtCard,
  type MemoryPairsGame,
  type MemoryPairsMemory,
  type MemoryPairsResult,
  type MemoryPairsSettings,
  type MemoryPairsSymbol,
} from './types';

const LEGACY_STORAGE_KEY = 'remind-memory-pairs';
const DB_NAME = 'remind-memory-pairs';
const DB_VERSION = 1;
const STATE_STORE = 'state';
const STATE_KEY = 'current';
const RESULTS_STORE = 'results';

/**
 * Settings, the open board, and one row per game.
 * This database is not the task-progress store. Opening it does not
 * clear attempts or the other memory sections.
 * Unknown future fields on a row are copied through on update.
 */
interface MemoryPairsStored extends MemoryPairsMemory {
  schemaVersion: number;
  settings: MemoryPairsSettings | null;
  activeGame: MemoryPairsGame | null;
}

let dbPromise: Promise<IDBDatabase> | null = null;
let sessionPromise: Promise<MemoryPairsStored> | null = null;

function emptyStored(): MemoryPairsStored {
  return {
    schemaVersion: MEMORY_PAIRS_SCHEMA,
    settings: null,
    activeGame: null,
    ...EMPTY_MEMORY_PAIRS_MEMORY,
  };
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
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
      resolve(db);
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STATE_STORE)) {
        db.createObjectStore(STATE_STORE);
      }
      if (!db.objectStoreNames.contains(RESULTS_STORE)) {
        const results = db.createObjectStore(RESULTS_STORE, { keyPath: 'id' });
        results.createIndex('grid', 'grid', { unique: false });
        results.createIndex('category', 'category', { unique: false });
        results.createIndex('gridCategory', ['grid', 'category'], { unique: false });
        results.createIndex('completedAt', 'completedAt', { unique: false });
      }
    };
  });
  return dbPromise;
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

function isSymbol(value: unknown): value is MemoryPairsSymbol {
  if (!value || typeof value !== 'object') return false;
  const symbol = value as MemoryPairsSymbol;
  if (typeof symbol.id !== 'string' || symbol.id.length === 0) return false;
  if (typeof symbol.label !== 'string' || symbol.label.length === 0) return false;
  if (!isMemoryPairsCategory(symbol.category)) return false;
  if (symbol.kind === 'letter' || symbol.kind === 'digit') {
    return typeof symbol.text === 'string' && symbol.text.length > 0;
  }
  return symbol.kind === 'shape' && typeof symbol.shape === 'string';
}

function isCard(value: unknown): value is MemoryPairsDealtCard {
  if (!value || typeof value !== 'object') return false;
  const card = value as MemoryPairsDealtCard;
  return typeof card.instanceId === 'string' && isSymbol(card.symbol);
}

function isActiveGame(value: unknown): value is MemoryPairsGame {
  if (!value || typeof value !== 'object') return false;
  const game = value as MemoryPairsGame;
  if (game.status !== 'in_progress') return false;
  if (!isMemoryPairsGrid(game.grid)) return false;
  if (!isMemoryPairsDifficulty(game.difficulty)) return false;
  if (!isMemoryPairsCategorySetting(game.categorySetting)) return false;
  if (!isMemoryPairsCategory(game.category)) return false;
  if (!Array.isArray(game.cards) || !game.cards.every(isCard)) return false;
  if (game.cards.length !== gridPairs(game.grid) * 2) return false;

  const instanceIds = new Set<string>();
  const symbolCounts = new Map<string, number>();
  for (const card of game.cards) {
    if (instanceIds.has(card.instanceId)) return false;
    instanceIds.add(card.instanceId);
    symbolCounts.set(card.symbol.id, (symbolCounts.get(card.symbol.id) ?? 0) + 1);
  }
  if (symbolCounts.size !== gridPairs(game.grid)) return false;
  for (const count of symbolCounts.values()) {
    if (count !== 2) return false;
  }

  const known = (id: unknown) => typeof id === 'string' && instanceIds.has(id);
  if (!Array.isArray(game.matchedInstanceIds) || !game.matchedInstanceIds.every(known)) {
    return false;
  }
  if (!Array.isArray(game.openInstanceIds) || game.openInstanceIds.length > 2) {
    return false;
  }
  if (!game.openInstanceIds.every(known)) return false;
  if (typeof game.attempts !== 'number' || typeof game.mismatches !== 'number') {
    return false;
  }
  return typeof game.id === 'string' && typeof game.createdAt === 'string';
}

/** Grid and card type only. An older saved level is ignored for new games. */
function parseSettings(value: unknown): MemoryPairsSettings | null {
  if (!value || typeof value !== 'object') return null;
  const settings = value as { grid?: unknown; category?: unknown };
  if (!isMemoryPairsGrid(settings.grid)) return null;
  if (!isMemoryPairsCategorySetting(settings.category)) return null;
  return { grid: settings.grid, category: settings.category };
}

function parseStored(value: unknown): MemoryPairsStored {
  if (!value || typeof value !== 'object') return emptyStored();
  const raw = value as Record<string, unknown>;
  return {
    schemaVersion: MEMORY_PAIRS_SCHEMA,
    settings: parseSettings(raw.settings),
    activeGame: isActiveGame(raw.activeGame) ? raw.activeGame : null,
    lastSymbolSet: typeof raw.lastSymbolSet === 'string' ? raw.lastSymbolSet : null,
    lastLayoutKey: typeof raw.lastLayoutKey === 'string' ? raw.lastLayoutKey : null,
    lastCategory: isMemoryPairsCategory(raw.lastCategory) ? raw.lastCategory : null,
  };
}

function readLegacy(): {
  raw: Record<string, unknown> | null;
  stored: MemoryPairsStored;
  results: unknown[];
} {
  try {
    const text = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!text) return { raw: null, stored: emptyStored(), results: [] };
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { raw: null, stored: emptyStored(), results: [] };
    }
    const raw = parsed as Record<string, unknown>;
    return {
      raw,
      stored: parseStored(raw),
      results: Array.isArray(raw.results) ? raw.results : [],
    };
  } catch {
    return { raw: null, stored: emptyStored(), results: [] };
  }
}

function resultFromGame(game: MemoryPairsGame): MemoryPairsResult {
  const classified = classifyMemoryPairsDifficulty(game.grid, game.category);
  return {
    id: game.id,
    grid: game.grid,
    category: game.category,
    categorySetting: game.categorySetting,
    difficulty: game.difficulty,
    classifiedDifficulty: classified,
    pairsFound: Math.floor(game.matchedInstanceIds.length / 2),
    attempts: game.attempts,
    status: game.status,
    completedAt: game.completedAt,
    createdAt: game.createdAt,
  };
}

/**
 * Keep the difficulty that was already stored.
 * Fill the table classification only when that separate field is missing.
 */
function mergeResult(existing: unknown, game: MemoryPairsGame): MemoryPairsResult {
  const fresh = resultFromGame(game);
  if (!existing || typeof existing !== 'object') return fresh;
  const previous = existing as Partial<MemoryPairsResult>;
  return {
    ...previous,
    ...fresh,
    difficulty: isMemoryPairsDifficulty(previous.difficulty)
      ? previous.difficulty
      : fresh.difficulty,
    classifiedDifficulty: isMemoryPairsDifficulty(previous.classifiedDifficulty)
      ? previous.classifiedDifficulty
      : fresh.classifiedDifficulty,
  };
}

function parseImportedResult(value: unknown): MemoryPairsResult | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<MemoryPairsResult>;
  if (typeof row.id !== 'string' || !isMemoryPairsGrid(row.grid)) return null;
  if (!isMemoryPairsCategory(row.category)) return null;
  if (!isMemoryPairsCategorySetting(row.categorySetting)) return null;
  if (!isMemoryPairsDifficulty(row.difficulty)) return null;
  if (typeof row.pairsFound !== 'number' || typeof row.attempts !== 'number') return null;
  if (row.status !== 'in_progress' && row.status !== 'complete') return null;
  if (typeof row.createdAt !== 'string') return null;
  const classified = isMemoryPairsDifficulty(row.classifiedDifficulty)
    ? row.classifiedDifficulty
    : classifyMemoryPairsDifficulty(row.grid, row.category);
  return {
    id: row.id,
    grid: row.grid,
    category: row.category,
    categorySetting: row.categorySetting,
    difficulty: row.difficulty,
    classifiedDifficulty: classified,
    pairsFound: row.pairsFound,
    attempts: row.attempts,
    status: row.status,
    completedAt: typeof row.completedAt === 'string' ? row.completedAt : null,
    createdAt: row.createdAt,
  };
}

async function readRawState(): Promise<Record<string, unknown> | undefined> {
  const db = await openDb();
  const tx = db.transaction(STATE_STORE, 'readonly');
  const stored = await idbRequest<unknown>(tx.objectStore(STATE_STORE).get(STATE_KEY));
  await txDone(tx);
  if (!stored || typeof stored !== 'object') return undefined;
  return stored as Record<string, unknown>;
}

async function writeRawState(state: Record<string, unknown>): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STATE_STORE, 'readwrite');
  tx.objectStore(STATE_STORE).put({ ...state, schemaVersion: MEMORY_PAIRS_SCHEMA }, STATE_KEY);
  await txDone(tx);
}

/** Copy a previous local save once. The old key is left in place. */
async function migrateLegacy(): Promise<MemoryPairsStored> {
  const legacy = readLegacy();
  const db = await openDb();
  const tx = db.transaction([STATE_STORE, RESULTS_STORE], 'readwrite');
  const results = tx.objectStore(RESULTS_STORE);
  for (const item of legacy.results) {
    const parsed = parseImportedResult(item);
    if (!parsed) continue;
    const already = await idbRequest<unknown>(results.get(parsed.id));
    if (already == null) results.put(parsed);
  }
  if (legacy.stored.activeGame) {
    const game = legacy.stored.activeGame;
    const already = await idbRequest<unknown>(results.get(game.id));
    if (already == null) results.put(resultFromGame(game));
  }
  const rest: Record<string, unknown> = {};
  if (legacy.raw) {
    for (const [key, value] of Object.entries(legacy.raw)) {
      if (key !== 'results') rest[key] = value;
    }
  }
  tx.objectStore(STATE_STORE).put(
    { ...rest, ...legacy.stored, schemaVersion: MEMORY_PAIRS_SCHEMA },
    STATE_KEY,
  );
  await txDone(tx);
  return legacy.stored;
}

export async function loadMemoryPairs(): Promise<MemoryPairsStored> {
  const existing = await readRawState();
  if (existing) return parseStored(existing);
  return migrateLegacy();
}

/**
 * First visit shows settings. Later visits resume the open board,
 * or deal a new one with the saved grid and card type.
 */
export function openMemoryPairs(): Promise<MemoryPairsStored> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const stored = await loadMemoryPairs();
      if (!stored.settings || stored.activeGame) return stored;
      const game = dealMemoryPairsGame(stored.settings, stored);
      await persistNewGame(game);
      return loadMemoryPairs();
    })().finally(() => {
      sessionPromise = null;
    });
  }
  return sessionPromise;
}

export async function saveMemoryPairsSettings(settings: MemoryPairsSettings): Promise<void> {
  const raw = (await readRawState()) ?? {};
  const current = parseStored(raw);
  await writeRawState({
    ...raw,
    ...current,
    settings: { grid: settings.grid, category: settings.category },
  });
}

async function writeGame(game: MemoryPairsGame, rememberDeal: boolean): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([STATE_STORE, RESULTS_STORE], 'readwrite');
  const stateStore = tx.objectStore(STATE_STORE);
  const raw = await idbRequest<unknown>(stateStore.get(STATE_KEY));
  const base =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const current = parseStored(base);
  const next: Record<string, unknown> = {
    ...base,
    ...current,
    schemaVersion: MEMORY_PAIRS_SCHEMA,
    activeGame: game.status === 'in_progress' ? game : null,
  };
  if (rememberDeal) {
    next.lastSymbolSet = symbolSetKeyFromCards(game.cards);
    next.lastLayoutKey = layoutKeyFromCards(game.cards);
    next.lastCategory = game.category;
  }
  stateStore.put(next, STATE_KEY);
  const results = tx.objectStore(RESULTS_STORE);
  const existing = await idbRequest<unknown>(results.get(game.id));
  results.put(mergeResult(existing, game));
  await txDone(tx);
}

export async function persistNewGame(game: MemoryPairsGame): Promise<void> {
  await writeGame(game, true);
}

export async function persistActiveGame(game: MemoryPairsGame): Promise<void> {
  await writeGame(game, false);
}

export async function listMemoryPairsResults(filter?: {
  grid?: MemoryPairsGame['grid'];
  category?: MemoryPairsGame['category'];
}): Promise<MemoryPairsResult[]> {
  const db = await openDb();
  const tx = db.transaction(RESULTS_STORE, 'readonly');
  const store = tx.objectStore(RESULTS_STORE);
  let rows: MemoryPairsResult[];
  if (filter?.grid && filter.category) {
    rows = await idbRequest(
      store.index('gridCategory').getAll([filter.grid, filter.category]),
    );
  } else if (filter?.grid) {
    rows = await idbRequest(store.index('grid').getAll(filter.grid));
  } else if (filter?.category) {
    rows = await idbRequest(store.index('category').getAll(filter.category));
  } else {
    rows = await idbRequest(store.getAll());
  }
  await txDone(tx);
  return rows;
}

/** Drops the cached connection so tests can reopen a fresh database. */
export function resetMemoryPairsStoreForTests(): void {
  dbPromise = null;
  sessionPromise = null;
}
