/**
 * Visual memory game. Its own IndexedDB, separate from task attempts
 * and the other memory sections.
 */

export const MEMORY_PAIRS_SCHEMA = 2;

export type MemoryPairsGrid = '2x3' | '2x4' | '3x4' | '4x4';

export type MemoryPairsDifficulty = 1 | 2 | 3 | 4 | 5;

/** What the person chose. `mixed` picks one real category per new game. */
export type MemoryPairsCategorySetting =
  | 'colored'
  | 'black'
  | 'letters'
  | 'digits'
  | 'mixed';

export type MemoryPairsCategory = Exclude<MemoryPairsCategorySetting, 'mixed'>;

export type ShapeId =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'diamond'
  | 'star'
  | 'pentagon'
  | 'hexagon'
  | 'cross'
  | 'heart'
  | 'arrow'
  | 'moon';

const SHAPE_IDS = new Set<ShapeId>([
  'circle',
  'square',
  'triangle',
  'diamond',
  'star',
  'pentagon',
  'hexagon',
  'cross',
  'heart',
  'arrow',
  'moon',
]);

export function isShapeId(value: string): value is ShapeId {
  return SHAPE_IDS.has(value as ShapeId);
}

export interface MemoryPairsSymbol {
  id: string;
  category: MemoryPairsCategory;
  label: string;
  kind: 'shape' | 'letter' | 'digit';
  shape?: ShapeId;
  /** Fill color. Colored shapes only; black shapes use a fixed ink. */
  color?: string;
  text?: string;
}

/** What the person chooses. Difficulty is calculated later, per dealt game. */
export interface MemoryPairsSettings {
  grid: MemoryPairsGrid;
  category: MemoryPairsCategorySetting;
}

export const DEFAULT_MEMORY_PAIRS_SETTINGS: MemoryPairsSettings = {
  grid: '2x3',
  category: 'colored',
};

export interface MemoryPairsDealtCard {
  instanceId: string;
  /** Snapshot of the symbol, so a later catalog change cannot reshuffle a saved board. */
  symbol: MemoryPairsSymbol;
}

export interface MemoryPairsGame {
  schemaVersion: number;
  id: string;
  createdAt: string;
  grid: MemoryPairsGrid;
  difficulty: MemoryPairsDifficulty;
  categorySetting: MemoryPairsCategorySetting;
  /** Category actually dealt. Equals the setting unless the setting is mixed. */
  category: MemoryPairsCategory;
  cards: MemoryPairsDealtCard[];
  matchedInstanceIds: string[];
  /** Unmatched face-up cards, in the order they were opened. At most two. */
  openInstanceIds: string[];
  /** How many times a second card was turned. */
  attempts: number;
  mismatches: number;
  status: 'in_progress' | 'complete';
  completedAt: string | null;
}

/**
 * One played board, kept for filtering. Compared mainly by grid and category.
 * `difficulty` is whatever was stored when the game was dealt.
 * `classifiedDifficulty` is the table value and is never written over `difficulty`.
 */
export interface MemoryPairsResult {
  id: string;
  grid: MemoryPairsGrid;
  /** Category actually dealt. */
  category: MemoryPairsCategory;
  categorySetting: MemoryPairsCategorySetting;
  difficulty: MemoryPairsDifficulty;
  classifiedDifficulty: MemoryPairsDifficulty;
  pairsFound: number;
  attempts: number;
  status: 'in_progress' | 'complete';
  completedAt: string | null;
  createdAt: string;
}

/** Last deal, so the next game can differ. Not a score history. */
export interface MemoryPairsMemory {
  lastSymbolSet: string | null;
  lastLayoutKey: string | null;
  lastCategory: MemoryPairsCategory | null;
}

export const EMPTY_MEMORY_PAIRS_MEMORY: MemoryPairsMemory = {
  lastSymbolSet: null,
  lastLayoutKey: null,
  lastCategory: null,
};

export const MEMORY_PAIRS_CATEGORY_LABEL: Record<
  MemoryPairsCategorySetting,
  string
> = {
  colored: 'Krāsainas figūras',
  black: 'Melnas figūras',
  letters: 'Burti',
  digits: 'Cipari',
  mixed: 'Jaukts',
};

export function gridPairs(grid: MemoryPairsGrid): number {
  switch (grid) {
    case '2x3':
      return 3;
    case '2x4':
      return 4;
    case '3x4':
      return 6;
    case '4x4':
      return 8;
  }
}

export function gridLabel(grid: MemoryPairsGrid): string {
  switch (grid) {
    case '2x3':
      return '2×3';
    case '2x4':
      return '2×4';
    case '3x4':
      return '3×4';
    case '4x4':
      return '4×4';
  }
}

/** Columns follow the tablet orientation so symbols stay large. */
export function gridColumns(grid: MemoryPairsGrid, landscape: boolean): number {
  if (grid === '4x4') return 4;
  if (grid === '2x3') return landscape ? 3 : 2;
  if (grid === '2x4') return landscape ? 4 : 2;
  return landscape ? 4 : 3;
}

export function memoryPairsStatusLine(game: MemoryPairsGame): string {
  return `${gridLabel(game.grid)} · ${MEMORY_PAIRS_CATEGORY_LABEL[game.categorySetting]}`;
}

export function isMemoryPairsGrid(value: unknown): value is MemoryPairsGrid {
  return value === '2x3' || value === '2x4' || value === '3x4' || value === '4x4';
}

export function isMemoryPairsDifficulty(
  value: unknown,
): value is MemoryPairsDifficulty {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

export function isMemoryPairsCategorySetting(
  value: unknown,
): value is MemoryPairsCategorySetting {
  return (
    value === 'colored' ||
    value === 'black' ||
    value === 'letters' ||
    value === 'digits' ||
    value === 'mixed'
  );
}

export function isMemoryPairsCategory(
  value: unknown,
): value is MemoryPairsCategory {
  return (
    value === 'colored' ||
    value === 'black' ||
    value === 'letters' ||
    value === 'digits'
  );
}
