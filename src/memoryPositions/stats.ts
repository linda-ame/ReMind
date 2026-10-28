import {
  MEMORY_POSITIONS_GRIDS,
  type MemoryPositionsCategory,
  type MemoryPositionsDifficulty,
  type MemoryPositionsGame,
  type MemoryPositionsGrid,
} from './types';

export interface PositionsStatFilter {
  grid: MemoryPositionsGrid | 'all';
  difficulty: MemoryPositionsDifficulty | 'all';
  category: MemoryPositionsCategory | 'all';
}

export interface PositionsStatGroup {
  grid: MemoryPositionsGrid;
  difficulty: MemoryPositionsDifficulty;
  category: MemoryPositionsCategory;
  completed: number;
  exact: number;
  helped: number;
  correctFigures: number;
  figureTotal: number;
}

/**
 * Figure totals stay inside one grid, one level, and one symbol kind.
 * A 2×3 game is not added into a 4×4 total.
 */
export function summarizeMemoryPositionsGames(
  games: readonly MemoryPositionsGame[],
  filter: PositionsStatFilter,
): PositionsStatGroup[] {
  const groups = new Map<string, PositionsStatGroup>();
  for (const game of games) {
    if (game.status !== 'completed') continue;
    if (filter.grid !== 'all' && game.grid !== filter.grid) continue;
    if (filter.difficulty !== 'all' && game.difficulty !== filter.difficulty) continue;
    if (filter.category !== 'all' && game.category !== filter.category) continue;
    const key = `${game.grid}-${game.difficulty}-${game.category}`;
    const group = groups.get(key) ?? {
      grid: game.grid,
      difficulty: game.difficulty,
      category: game.category,
      completed: 0,
      exact: 0,
      helped: 0,
      correctFigures: 0,
      figureTotal: 0,
    };
    group.completed += 1;
    if (game.exact && !game.usedHelp) group.exact += 1;
    if (game.usedHelp) group.helped += 1;
    group.correctFigures += game.correctCount ?? 0;
    group.figureTotal += game.totalCount;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => {
    const byGrid =
      MEMORY_POSITIONS_GRIDS.indexOf(a.grid) - MEMORY_POSITIONS_GRIDS.indexOf(b.grid);
    if (byGrid !== 0) return byGrid;
    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
    return a.category.localeCompare(b.category);
  });
}
