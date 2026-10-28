import {
  MEMORY_PATTERN_GRIDS,
  type MemoryPatternDifficulty,
  type MemoryPatternGame,
  type MemoryPatternGrid,
} from './types';

export interface PatternStatFilter {
  grid: MemoryPatternGrid | 'all';
  difficulty: MemoryPatternDifficulty | 'all';
}

export interface PatternStatGroup {
  grid: MemoryPatternGrid;
  difficulty: MemoryPatternDifficulty;
  completed: number;
  exact: number;
  correctCells: number;
  extraCells: number;
  missedCells: number;
}

/** Cell totals stay inside one grid and one level. Game counts may be added up. */
export function summarizeMemoryPatternGames(
  games: readonly MemoryPatternGame[],
  filter: PatternStatFilter,
): PatternStatGroup[] {
  const groups = new Map<string, PatternStatGroup>();
  for (const game of games) {
    if (game.status !== 'completed') continue;
    if (filter.grid !== 'all' && game.grid !== filter.grid) continue;
    if (filter.difficulty !== 'all' && game.difficulty !== filter.difficulty) continue;
    const key = `${game.grid}-${game.difficulty}`;
    const group = groups.get(key) ?? {
      grid: game.grid,
      difficulty: game.difficulty,
      completed: 0,
      exact: 0,
      correctCells: 0,
      extraCells: 0,
      missedCells: 0,
    };
    group.completed += 1;
    if (game.exact) group.exact += 1;
    group.correctCells += game.correctCount ?? 0;
    group.extraCells += game.extraCount ?? 0;
    group.missedCells += game.missedCount ?? 0;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => {
    const byGrid =
      MEMORY_PATTERN_GRIDS.indexOf(a.grid) - MEMORY_PATTERN_GRIDS.indexOf(b.grid);
    if (byGrid !== 0) return byGrid;
    return a.difficulty - b.difficulty;
  });
}
