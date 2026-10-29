/** Visual pattern memory. A separate section from task packs and “Atrodi pārus”. */

export const MEMORY_PATTERN_GENERATOR_VERSION = 1;
export const MEMORY_PATTERN_TYPE = 'memory_pattern' as const;

export const MEMORY_PATTERN_GRIDS = ['2x3', '2x4', '3x3', '3x4', '4x4'] as const;
export type MemoryPatternGrid = (typeof MEMORY_PATTERN_GRIDS)[number];

export type MemoryPatternDifficulty = 1 | 2 | 3 | 4 | 5;
export const MEMORY_PATTERN_LEVELS: MemoryPatternDifficulty[] = [1, 2, 3, 4, 5];

export type MemoryPatternPhase = 'memorize' | 'recall' | 'result';
export type MemoryPatternStatus = 'in_progress' | 'completed' | 'abandoned';

export interface GridSpec {
  rows: number;
  cols: number;
  cells: number;
  label: string;
}

export const GRID_SPEC: Record<MemoryPatternGrid, GridSpec> = {
  '2x3': { rows: 2, cols: 3, cells: 6, label: '2×3' },
  '2x4': { rows: 2, cols: 4, cells: 8, label: '2×4' },
  '3x3': { rows: 3, cols: 3, cells: 9, label: '3×3' },
  '3x4': { rows: 3, cols: 4, cells: 12, label: '3×4' },
  '4x4': { rows: 4, cols: 4, cells: 16, label: '4×4' },
};

export interface MemoryPatternSettings {
  grid: MemoryPatternGrid;
  difficulty: MemoryPatternDifficulty;
}

export const DEFAULT_MEMORY_PATTERN_SETTINGS: MemoryPatternSettings = {
  grid: '2x3',
  difficulty: 1,
};

export interface MemoryPatternGame {
  id: string;
  type: typeof MEMORY_PATTERN_TYPE;
  generatorVersion: number;
  grid: MemoryPatternGrid;
  rows: number;
  cols: number;
  difficulty: MemoryPatternDifficulty;
  /** Filled cell indexes, row by row from 0. */
  pattern: number[];
  /** Cells the person marked while recalling. */
  selected: number[];
  phase: MemoryPatternPhase;
  correctCount: number | null;
  missedCount: number | null;
  extraCount: number | null;
  exact: boolean | null;
  startedAt: string;
  /** When the study picture was closed. Null until „Esmu iegaumējis”. */
  studiedAt: string | null;
  completedAt: string | null;
  status: MemoryPatternStatus;
}

export function isMemoryPatternGrid(value: unknown): value is MemoryPatternGrid {
  return (
    typeof value === 'string' &&
    (MEMORY_PATTERN_GRIDS as readonly string[]).includes(value)
  );
}

export function isMemoryPatternDifficulty(
  value: unknown,
): value is MemoryPatternDifficulty {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

export function gridLabel(grid: MemoryPatternGrid): string {
  return GRID_SPEC[grid].label;
}

export function patternStatusLine(
  grid: MemoryPatternGrid,
  difficulty: MemoryPatternDifficulty,
): string {
  return `${gridLabel(grid)} · ${difficulty}. līmenis`;
}

export function patternKey(indices: readonly number[]): string {
  return [...indices].sort((a, b) => a - b).join(',');
}
