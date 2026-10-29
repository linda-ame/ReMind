import { generatePattern } from './generate';
import {
  GRID_SPEC,
  MEMORY_PATTERN_GENERATOR_VERSION,
  MEMORY_PATTERN_TYPE,
  type MemoryPatternGame,
  type MemoryPatternSettings,
} from './types';

export interface PatternScore {
  correct: number;
  missed: number;
  extra: number;
  exact: boolean;
  patternCount: number;
}

export function scorePattern(
  pattern: readonly number[],
  selected: readonly number[],
  cellCount: number,
): PatternScore {
  const filled = new Set(pattern);
  const marked = new Set(selected);
  let correct = 0;
  let extra = 0;
  for (let index = 0; index < cellCount; index += 1) {
    const wasFilled = filled.has(index);
    const wasMarked = marked.has(index);
    if (wasFilled && wasMarked) correct += 1;
    else if (!wasFilled && wasMarked) extra += 1;
  }
  const missed = filled.size - correct;
  return {
    correct,
    missed,
    extra,
    exact: missed === 0 && extra === 0 && filled.size > 0,
    patternCount: filled.size,
  };
}

export function createMemoryPatternGame(
  settings: MemoryPatternSettings,
  pattern: readonly number[],
  now = new Date().toISOString(),
): MemoryPatternGame {
  const spec = GRID_SPEC[settings.grid];
  return {
    id: crypto.randomUUID(),
    type: MEMORY_PATTERN_TYPE,
    generatorVersion: MEMORY_PATTERN_GENERATOR_VERSION,
    grid: settings.grid,
    rows: spec.rows,
    cols: spec.cols,
    difficulty: settings.difficulty,
    pattern: [...pattern].sort((a, b) => a - b),
    selected: [],
    phase: 'memorize',
    correctCount: null,
    missedCount: null,
    extraCount: null,
    exact: null,
    startedAt: now,
    studiedAt: null,
    completedAt: null,
    status: 'in_progress',
  };
}

export function createGameFromSettings(
  settings: MemoryPatternSettings,
  recentKeys: readonly string[] = [],
  random?: () => number,
): MemoryPatternGame {
  const pattern = generatePattern({
    grid: settings.grid,
    difficulty: settings.difficulty,
    recentKeys,
    random,
  });
  return createMemoryPatternGame(settings, pattern);
}

/** The study pattern stays fixed. Cells cannot be edited in this phase. */
export function toggleCell(game: MemoryPatternGame, index: number): MemoryPatternGame {
  if (game.phase !== 'recall' || game.status !== 'in_progress') return game;
  const cellCount = game.rows * game.cols;
  if (!Number.isInteger(index) || index < 0 || index >= cellCount) return game;
  const selected = new Set(game.selected);
  if (selected.has(index)) selected.delete(index);
  else selected.add(index);
  return {
    ...game,
    selected: [...selected].sort((a, b) => a - b),
  };
}

export function beginRecall(
  game: MemoryPatternGame,
  now = new Date().toISOString(),
): MemoryPatternGame {
  if (game.phase !== 'memorize' || game.status !== 'in_progress') return game;
  return {
    ...game,
    phase: 'recall',
    selected: [],
    studiedAt: game.studiedAt ?? now,
  };
}

export function submitAnswer(
  game: MemoryPatternGame,
  now = new Date().toISOString(),
): MemoryPatternGame {
  if (game.phase !== 'recall' || game.status !== 'in_progress') return game;
  const score = scorePattern(game.pattern, game.selected, game.rows * game.cols);
  return {
    ...game,
    phase: 'result',
    status: 'completed',
    completedAt: now,
    correctCount: score.correct,
    missedCount: score.missed,
    extraCount: score.extra,
    exact: score.exact,
  };
}

export function abandonGame(
  game: MemoryPatternGame,
  now = new Date().toISOString(),
): MemoryPatternGame {
  if (game.status !== 'in_progress') return game;
  return { ...game, status: 'abandoned', completedAt: now };
}

export type PatternCellMark = 'dot' | 'correct' | 'missed' | 'extra';

export interface PatternCellModel {
  index: number;
  row: number;
  column: number;
  label: string;
  filled: boolean;
  mark: PatternCellMark | null;
  interactive: boolean;
}

/** What one cell shows. Recall never reads the hidden pattern. */
export function patternCells(game: MemoryPatternGame): PatternCellModel[] {
  const selected = new Set(game.selected);
  const pattern = new Set(game.pattern);
  const cells: PatternCellModel[] = [];
  for (let index = 0; index < game.rows * game.cols; index += 1) {
    const row = Math.floor(index / game.cols) + 1;
    const column = (index % game.cols) + 1;
    const place = `${row}. rinda, ${column}. kolonna`;
    if (game.phase === 'memorize') {
      const filled = pattern.has(index);
      cells.push({
        index,
        row,
        column,
        label: `${place}, ${filled ? 'iekrāsota' : 'tukša'}`,
        filled,
        mark: filled ? 'dot' : null,
        interactive: false,
      });
      continue;
    }
    if (game.phase === 'recall') {
      const filled = selected.has(index);
      cells.push({
        index,
        row,
        column,
        label: `${place}, ${filled ? 'atzīmēta' : 'nav atzīmēta'}`,
        filled,
        mark: filled ? 'dot' : null,
        interactive: true,
      });
      continue;
    }
    const wasFilled = pattern.has(index);
    const wasMarked = selected.has(index);
    const mark: PatternCellMark | null =
      wasFilled && wasMarked ? 'correct' : wasFilled ? 'missed' : wasMarked ? 'extra' : null;
    const state =
      mark === 'correct'
        ? 'zaļa, pareizi'
        : mark === 'missed'
          ? 'tumši zila, šeit bija jābūt'
          : mark === 'extra'
            ? 'sarkana, nepareizi novietota'
            : 'tukša';
    cells.push({
      index,
      row,
      column,
      label: `${place}, ${state}`,
      filled: wasFilled,
      mark,
      interactive: false,
    });
  }
  return cells;
}

export function settingsStartLabel(configured: boolean): string {
  return configured ? 'Saglabāt un sākt jaunu spēli' : 'Sākt spēli';
}
