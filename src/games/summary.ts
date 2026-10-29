import type { MemoryPairsGame, MemoryPairsResult } from '../memoryPairs/types';
import type { MemoryPatternGame } from '../memoryPattern/types';
import type { MemoryPositionsGame } from '../memoryPositions/types';

export type GameKind = 'memory_pairs' | 'memory_pattern' | 'memory_positions';

/** Finished-game measures kept for later comparison. No board and no symbols. */
export interface GameSummary {
  id: string;
  game: GameKind;
  grid: string;
  difficulty: number;
  category: string | null;
  startedAt: string;
  studiedAt: string | null;
  completedAt: string;
  summary: PairsMeasures | PatternMeasures | PositionsMeasures;
}

export interface PairsMeasures {
  attempts: number;
  mismatches: number | null;
  pairsFound: number;
}

export interface PatternMeasures {
  correctCount: number;
  missedCount: number;
  extraCount: number;
  exact: boolean;
}

export interface PositionsMeasures {
  correctCount: number;
  totalCount: number;
  exact: boolean;
  usedHelp: boolean;
  placementChanges: number;
}

export function pairsGameSummary(game: MemoryPairsGame): GameSummary | null {
  if (game.status !== 'complete' || !game.completedAt) return null;
  return {
    id: game.id,
    game: 'memory_pairs',
    grid: game.grid,
    difficulty: game.difficulty,
    category: game.category,
    startedAt: game.createdAt,
    studiedAt: null,
    completedAt: game.completedAt,
    summary: {
      attempts: game.attempts,
      mismatches: game.mismatches,
      pairsFound: Math.floor(game.matchedInstanceIds.length / 2),
    },
  };
}

export function pairsResultSummary(result: MemoryPairsResult): GameSummary | null {
  if (result.status !== 'complete' || !result.completedAt) return null;
  return {
    id: result.id,
    game: 'memory_pairs',
    grid: result.grid,
    difficulty: result.difficulty,
    category: result.category,
    startedAt: result.createdAt,
    studiedAt: null,
    completedAt: result.completedAt,
    summary: {
      attempts: result.attempts,
      mismatches: result.mismatches,
      pairsFound: result.pairsFound,
    },
  };
}

export function patternSummary(game: MemoryPatternGame): GameSummary | null {
  if (game.status !== 'completed' || !game.completedAt) return null;
  if (
    game.correctCount == null ||
    game.missedCount == null ||
    game.extraCount == null ||
    game.exact == null
  ) {
    return null;
  }
  return {
    id: game.id,
    game: 'memory_pattern',
    grid: game.grid,
    difficulty: game.difficulty,
    category: null,
    startedAt: game.startedAt,
    studiedAt: game.studiedAt,
    completedAt: game.completedAt,
    summary: {
      correctCount: game.correctCount,
      missedCount: game.missedCount,
      extraCount: game.extraCount,
      exact: game.exact,
    },
  };
}

export function positionsSummary(game: MemoryPositionsGame): GameSummary | null {
  if (game.status !== 'completed' || !game.completedAt) return null;
  if (game.correctCount == null || game.exact == null) return null;
  return {
    id: game.id,
    game: 'memory_positions',
    grid: game.grid,
    difficulty: game.difficulty,
    category: game.category,
    startedAt: game.startedAt,
    studiedAt: game.studiedAt,
    completedAt: game.completedAt,
    summary: {
      correctCount: game.correctCount,
      totalCount: game.totalCount,
      exact: game.exact,
      usedHelp: game.usedHelp,
      placementChanges: game.placementChanges ?? 0,
    },
  };
}
