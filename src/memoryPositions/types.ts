import type { ShapeId } from '../memoryPairs/types';

/** Remember where each figure was. Separate from pattern memory and pairs. */

export const MEMORY_POSITIONS_GENERATOR_VERSION = 1;
export const MEMORY_POSITIONS_TYPE = 'memory_positions' as const;

export const MEMORY_POSITIONS_GRIDS = ['2x3', '2x4', '3x3', '3x4', '4x4'] as const;
export type MemoryPositionsGrid = (typeof MEMORY_POSITIONS_GRIDS)[number];

export type MemoryPositionsDifficulty = 1 | 2 | 3 | 4 | 5;
export const MEMORY_POSITIONS_LEVELS: MemoryPositionsDifficulty[] = [1, 2, 3, 4, 5];

/** What the person chose. `mixed` picks one real category for the whole game. */
export type MemoryPositionsCategorySetting =
  | 'colored'
  | 'black'
  | 'letters'
  | 'digits'
  | 'mixed';

export type MemoryPositionsCategory = Exclude<MemoryPositionsCategorySetting, 'mixed'>;

export const MEMORY_POSITIONS_CATEGORIES: MemoryPositionsCategory[] = [
  'colored',
  'black',
  'letters',
  'digits',
];

export type MemoryPositionsPhase = 'memorize' | 'recall' | 'result';
export type MemoryPositionsStatus = 'in_progress' | 'completed' | 'abandoned';

export interface GridSpec {
  rows: number;
  cols: number;
  cells: number;
  label: string;
}

export const GRID_SPEC: Record<MemoryPositionsGrid, GridSpec> = {
  '2x3': { rows: 2, cols: 3, cells: 6, label: '2×3' },
  '2x4': { rows: 2, cols: 4, cells: 8, label: '2×4' },
  '3x3': { rows: 3, cols: 3, cells: 9, label: '3×3' },
  '3x4': { rows: 3, cols: 4, cells: 12, label: '3×4' },
  '4x4': { rows: 4, cols: 4, cells: 16, label: '4×4' },
};

export interface MemoryPositionsSymbol {
  id: string;
  category: MemoryPositionsCategory;
  label: string;
  kind: 'shape' | 'letter' | 'digit';
  shape?: ShapeId;
  color?: string;
  text?: string;
}

export interface SymbolPlacement {
  symbolId: string;
  cell: number;
}

export interface MemoryPositionsSettings {
  grid: MemoryPositionsGrid;
  difficulty: MemoryPositionsDifficulty;
  category: MemoryPositionsCategorySetting;
}

export const DEFAULT_MEMORY_POSITIONS_SETTINGS: MemoryPositionsSettings = {
  grid: '2x3',
  difficulty: 1,
  category: 'colored',
};

export interface MemoryPositionsGame {
  id: string;
  type: typeof MEMORY_POSITIONS_TYPE;
  generatorVersion: number;
  grid: MemoryPositionsGrid;
  rows: number;
  cols: number;
  difficulty: MemoryPositionsDifficulty;
  categorySetting: MemoryPositionsCategorySetting;
  /** Category actually dealt. Equals the setting unless the setting is mixed. */
  category: MemoryPositionsCategory;
  symbols: MemoryPositionsSymbol[];
  /** One cell per symbol. The cells are the places to remember. */
  solution: SymbolPlacement[];
  /** Stable picker order. Not the left-to-right order of the study grid. */
  trayOrder: string[];
  placements: SymbolPlacement[];
  selectedSymbolId: string | null;
  phase: MemoryPositionsPhase;
  status: MemoryPositionsStatus;
  startedAt: string;
  completedAt: string | null;
  correctCount: number | null;
  totalCount: number;
  exact: boolean | null;
  usedHelp: boolean;
}

export const CATEGORY_LABEL: Record<MemoryPositionsCategorySetting, string> = {
  colored: 'Krāsainas figūras',
  black: 'Melnas figūras',
  letters: 'Burti',
  digits: 'Cipari',
  mixed: 'Jaukts — automātiski',
};

export const CATEGORY_SHORT: Record<MemoryPositionsCategory, string> = {
  colored: 'Krāsainas',
  black: 'Melnas',
  letters: 'Burti',
  digits: 'Cipari',
};

export function isMemoryPositionsGrid(value: unknown): value is MemoryPositionsGrid {
  return (
    typeof value === 'string' &&
    (MEMORY_POSITIONS_GRIDS as readonly string[]).includes(value)
  );
}

export function isMemoryPositionsDifficulty(
  value: unknown,
): value is MemoryPositionsDifficulty {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

export function isMemoryPositionsCategorySetting(
  value: unknown,
): value is MemoryPositionsCategorySetting {
  return (
    value === 'colored' ||
    value === 'black' ||
    value === 'letters' ||
    value === 'digits' ||
    value === 'mixed'
  );
}

export function isMemoryPositionsCategory(
  value: unknown,
): value is MemoryPositionsCategory {
  return (
    value === 'colored' ||
    value === 'black' ||
    value === 'letters' ||
    value === 'digits'
  );
}

export function gridLabel(grid: MemoryPositionsGrid): string {
  return GRID_SPEC[grid].label;
}

export function positionsStatusLine(game: {
  grid: MemoryPositionsGrid;
  difficulty: MemoryPositionsDifficulty;
  category: MemoryPositionsCategory;
}): string {
  return `${gridLabel(game.grid)} · ${game.difficulty}. līmenis · ${CATEGORY_SHORT[game.category]}`;
}

/** Left-to-right, top-to-bottom. The tray must not copy this order. */
export function readingOrderIds(solution: readonly SymbolPlacement[]): string[] {
  return [...solution]
    .sort((a, b) => a.cell - b.cell)
    .map((item) => item.symbolId);
}

/** Cell and symbol together, so the next game can avoid the same deal. */
export function dealKey(solution: readonly SymbolPlacement[]): string {
  return [...solution]
    .sort((a, b) => a.cell - b.cell || a.symbolId.localeCompare(b.symbolId))
    .map((item) => `${item.cell}:${item.symbolId}`)
    .join(',');
}
