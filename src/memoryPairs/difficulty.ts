import type {
  MemoryPairsCategory,
  MemoryPairsDifficulty,
  MemoryPairsGrid,
} from './types';

/**
 * Provisional content classification for later analysis.
 * Not a clinical score, and not used to choose the symbols.
 * Edit this table to retune the saved difficulty.
 */
export const MEMORY_PAIRS_DIFFICULTY_TABLE: Record<
  MemoryPairsGrid,
  Record<MemoryPairsCategory, MemoryPairsDifficulty>
> = {
  '2x3': { colored: 1, black: 2, letters: 2, digits: 2 },
  '2x4': { colored: 2, black: 3, letters: 3, digits: 3 },
  '3x4': { colored: 3, black: 4, letters: 4, digits: 4 },
  '4x4': { colored: 4, black: 5, letters: 5, digits: 5 },
};

/** Difficulty of one dealt category. `mixed` is resolved before this is called. */
export function classifyMemoryPairsDifficulty(
  grid: MemoryPairsGrid,
  category: MemoryPairsCategory,
): MemoryPairsDifficulty {
  return MEMORY_PAIRS_DIFFICULTY_TABLE[grid][category];
}
