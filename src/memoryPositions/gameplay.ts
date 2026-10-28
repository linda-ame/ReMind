import { generateMemoryPositions, type GenerateOptions } from './generate';
import {
  GRID_SPEC,
  MEMORY_POSITIONS_GENERATOR_VERSION,
  MEMORY_POSITIONS_TYPE,
  readingOrderIds,
  type MemoryPositionsGame,
  type MemoryPositionsSettings,
  type MemoryPositionsSymbol,
  type SymbolPlacement,
} from './types';

export interface PositionScore {
  correct: number;
  total: number;
  exact: boolean;
}

export type CellBadge = 'correct' | 'wrong';

export interface PositionCellModel {
  index: number;
  row: number;
  column: number;
  label: string;
  /** Figure the player put here. On a correct cell this is also the right figure. */
  symbol: MemoryPositionsSymbol | null;
  /** Right figure when the cell is split. Null means that cell should stay empty. */
  expected: MemoryPositionsSymbol | null;
  badge: CellBadge | null;
  /** Wrong figure where a different figure belongs: top is the player's, bottom is the right one. */
  split: boolean;
  /** The player left this cell empty. `symbol` is the figure that belongs here. */
  answer: boolean;
  interactive: boolean;
}

export { readingOrderIds };

export function createMemoryPositionsGame(
  settings: MemoryPositionsSettings,
  deal: {
    category: MemoryPositionsGame['category'];
    symbols: MemoryPositionsSymbol[];
    solution: SymbolPlacement[];
    trayOrder: string[];
  },
  now = new Date().toISOString(),
): MemoryPositionsGame {
  const spec = GRID_SPEC[settings.grid];
  return {
    id: crypto.randomUUID(),
    type: MEMORY_POSITIONS_TYPE,
    generatorVersion: MEMORY_POSITIONS_GENERATOR_VERSION,
    grid: settings.grid,
    rows: spec.rows,
    cols: spec.cols,
    difficulty: settings.difficulty,
    categorySetting: settings.category,
    category: deal.category,
    symbols: deal.symbols.map((symbol) => ({ ...symbol })),
    solution: deal.solution.map((item) => ({ ...item })),
    trayOrder: [...deal.trayOrder],
    placements: [],
    selectedSymbolId: null,
    phase: 'memorize',
    status: 'in_progress',
    startedAt: now,
    completedAt: null,
    correctCount: null,
    totalCount: deal.solution.length,
    exact: null,
    usedHelp: false,
  };
}

export function createGameFromSettings(
  settings: MemoryPositionsSettings,
  options: Omit<GenerateOptions, 'grid' | 'difficulty' | 'category'> & { now?: string } = {},
): MemoryPositionsGame {
  const deal = generateMemoryPositions({
    grid: settings.grid,
    difficulty: settings.difficulty,
    category: settings.category,
    recentKeys: options.recentKeys,
    lastCategory: options.lastCategory,
    random: options.random,
  });
  return createMemoryPositionsGame(settings, deal, options.now);
}

export function scorePlacements(game: MemoryPositionsGame): PositionScore {
  const solution = new Map(game.solution.map((item) => [item.symbolId, item.cell]));
  let correct = 0;
  const seen = new Set<string>();
  for (const placed of game.placements) {
    if (seen.has(placed.symbolId)) continue;
    seen.add(placed.symbolId);
    if (solution.get(placed.symbolId) === placed.cell) correct += 1;
  }
  const total = game.solution.length;
  return {
    correct,
    total,
    exact: total > 0 && correct === total && seen.size === total,
  };
}

export function allPlaced(game: MemoryPositionsGame): boolean {
  if (game.placements.length !== game.symbols.length || game.symbols.length === 0) return false;
  const symbols = new Set(game.placements.map((item) => item.symbolId));
  const cells = new Set(game.placements.map((item) => item.cell));
  return symbols.size === game.symbols.length && cells.size === game.symbols.length;
}

export function remainingCount(game: MemoryPositionsGame): number {
  const placed = new Set(game.placements.map((item) => item.symbolId));
  return game.symbols.filter((symbol) => !placed.has(symbol.id)).length;
}

function canEdit(game: MemoryPositionsGame): boolean {
  return game.phase === 'recall' && game.status === 'in_progress';
}

function validCell(game: MemoryPositionsGame, cell: number): boolean {
  return Number.isInteger(cell) && cell >= 0 && cell < game.rows * game.cols;
}

export function beginRecall(game: MemoryPositionsGame): MemoryPositionsGame {
  if (game.phase !== 'memorize' || game.status !== 'in_progress') return game;
  return { ...game, phase: 'recall', placements: [], selectedSymbolId: null };
}

export function selectSymbol(
  game: MemoryPositionsGame,
  symbolId: string,
): MemoryPositionsGame {
  if (!canEdit(game)) return game;
  if (!game.symbols.some((symbol) => symbol.id === symbolId)) return game;
  if (game.placements.some((item) => item.symbolId === symbolId)) return game;
  return {
    ...game,
    selectedSymbolId: game.selectedSymbolId === symbolId ? null : symbolId,
  };
}

/** Places into an empty cell. An occupied cell is left untouched. */
export function placeSymbol(
  game: MemoryPositionsGame,
  symbolId: string,
  cell: number,
): MemoryPositionsGame {
  if (!canEdit(game) || !validCell(game, cell)) return game;
  if (!game.symbols.some((symbol) => symbol.id === symbolId)) return game;
  const occupant = game.placements.find((item) => item.cell === cell);
  if (occupant && occupant.symbolId !== symbolId) return game;
  const placements = game.placements.filter(
    (item) => item.symbolId !== symbolId && item.cell !== cell,
  );
  placements.push({ symbolId, cell });
  return { ...game, placements, selectedSymbolId: null };
}

/** Puts the chosen figure in the cell and returns the previous one to the tray. */
export function swapSymbols(
  game: MemoryPositionsGame,
  symbolId: string,
  cell: number,
): MemoryPositionsGame {
  if (!canEdit(game) || !validCell(game, cell)) return game;
  const occupant = game.placements.find((item) => item.cell === cell);
  if (!occupant || occupant.symbolId === symbolId) return placeSymbol(game, symbolId, cell);
  if (!game.symbols.some((symbol) => symbol.id === symbolId)) return game;
  const placements = game.placements.filter(
    (item) => item.symbolId !== symbolId && item.symbolId !== occupant.symbolId,
  );
  placements.push({ symbolId, cell });
  return { ...game, placements, selectedSymbolId: null };
}

export function removeAtCell(game: MemoryPositionsGame, cell: number): MemoryPositionsGame {
  if (!canEdit(game)) return game;
  const placements = game.placements.filter((item) => item.cell !== cell);
  if (placements.length === game.placements.length) return game;
  return { ...game, placements };
}

export function tapCell(
  game: MemoryPositionsGame,
  cell: number,
): { game: MemoryPositionsGame; occupied: boolean } {
  const selected = game.selectedSymbolId;
  const occupant = game.placements.find((item) => item.cell === cell) ?? null;
  if (!selected) {
    if (!occupant) return { game, occupied: false };
    return { game: removeAtCell(game, cell), occupied: false };
  }
  if (occupant && occupant.symbolId !== selected) return { game, occupied: true };
  return { game: placeSymbol(game, selected, cell), occupied: false };
}

export function submitAnswer(
  game: MemoryPositionsGame,
  now = new Date().toISOString(),
): MemoryPositionsGame {
  if (!canEdit(game) || !allPlaced(game) || game.usedHelp) return game;
  const score = scorePlacements(game);
  return {
    ...game,
    phase: 'result',
    status: 'completed',
    completedAt: now,
    correctCount: score.correct,
    totalCount: score.total,
    exact: score.exact,
    usedHelp: false,
    selectedSymbolId: null,
  };
}

export function finishWithHelp(
  game: MemoryPositionsGame,
  now = new Date().toISOString(),
): MemoryPositionsGame {
  if (game.phase !== 'recall' || game.status !== 'in_progress') return game;
  const score = scorePlacements(game);
  return {
    ...game,
    phase: 'result',
    status: 'completed',
    completedAt: now,
    correctCount: score.correct,
    totalCount: score.total,
    exact: false,
    usedHelp: true,
    selectedSymbolId: null,
  };
}

export function abandonGame(
  game: MemoryPositionsGame,
  now = new Date().toISOString(),
): MemoryPositionsGame {
  if (game.status !== 'in_progress') return game;
  return { ...game, status: 'abandoned', completedAt: now, selectedSymbolId: null };
}

export function settingsStartLabel(configured: boolean): string {
  return configured ? 'Saglabāt un sākt jaunu spēli' : 'Sākt spēli';
}

function symbolById(
  game: MemoryPositionsGame,
  symbolId: string | null,
): MemoryPositionsSymbol | null {
  if (!symbolId) return null;
  return game.symbols.find((symbol) => symbol.id === symbolId) ?? null;
}

function solutionAt(game: MemoryPositionsGame, cell: number): MemoryPositionsSymbol | null {
  const placed = game.solution.find((item) => item.cell === cell);
  return symbolById(game, placed?.symbolId ?? null);
}

function placedAt(game: MemoryPositionsGame, cell: number): MemoryPositionsSymbol | null {
  const placed = game.placements.find((item) => item.cell === cell);
  return symbolById(game, placed?.symbolId ?? null);
}

function plainCell(
  index: number,
  row: number,
  column: number,
  label: string,
  symbol: MemoryPositionsSymbol | null,
  interactive: boolean,
): PositionCellModel {
  return {
    index,
    row,
    column,
    label,
    symbol,
    expected: null,
    badge: null,
    split: false,
    answer: false,
    interactive,
  };
}

/** Recall labels never say whether a cell is right or wrong. */
export function gridCells(game: MemoryPositionsGame): PositionCellModel[] {
  const cells: PositionCellModel[] = [];
  for (let index = 0; index < game.rows * game.cols; index += 1) {
    const row = Math.floor(index / game.cols) + 1;
    const column = (index % game.cols) + 1;
    const place = `${row}. rinda, ${column}. kolonna`;
    if (game.phase === 'memorize') {
      const symbol = solutionAt(game, index);
      cells.push(
        plainCell(
          index,
          row,
          column,
          symbol ? `${place}, ${symbol.label}` : `${place}, tukša`,
          symbol,
          false,
        ),
      );
      continue;
    }
    if (game.phase === 'recall') {
      const symbol = placedAt(game, index);
      cells.push(
        plainCell(
          index,
          row,
          column,
          symbol ? `${place}, ${symbol.label}` : `${place}, tukša`,
          symbol,
          true,
        ),
      );
      continue;
    }
    const placed = placedAt(game, index);
    const expected = solutionAt(game, index);
    if (placed?.id === expected?.id) {
      cells.push({
        index,
        row,
        column,
        label: placed ? `${place}, ${placed.label}, pareizi` : `${place}, tukša`,
        symbol: placed,
        expected: null,
        badge: placed ? 'correct' : null,
        split: false,
        answer: false,
        interactive: false,
      });
      continue;
    }
    if (placed && expected) {
      cells.push({
        index,
        row,
        column,
        label: `${place}, tu novietoji ${placed.label}, jābūt ${expected.label}`,
        symbol: placed,
        expected,
        badge: 'wrong',
        split: true,
        answer: false,
        interactive: false,
      });
      continue;
    }
    if (placed) {
      cells.push({
        index,
        row,
        column,
        label: `${place}, tu novietoji ${placed.label}, jābūt tukšai`,
        symbol: placed,
        expected: null,
        badge: 'wrong',
        split: false,
        answer: false,
        interactive: false,
      });
      continue;
    }
    cells.push({
      index,
      row,
      column,
      label: `${place}, tu atstāji tukšu, jābūt ${expected?.label ?? 'figūrai'}`,
      symbol: expected,
      expected: null,
      badge: null,
      split: false,
      answer: true,
      interactive: false,
    });
  }
  return cells;
}
