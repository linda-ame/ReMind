import { getMemoryTasks } from '../data/loadMemory';
import type { MemoryMode, MemoryRecallTask } from '../types/memory';
import type { DifficultyLevel } from '../types/task';
import {
  ALL_DIFFICULTY_LEVELS,
  isDifficultyLevel,
  normalizeDifficultyLevels,
} from './difficulty';

const PREFIX = 'remind.difficultyLevels.memory_';

function storageKey(mode: MemoryMode): string {
  return `${PREFIX}${mode}`;
}

export function loadMemoryDifficulty(mode: MemoryMode): DifficultyLevel[] {
  try {
    const raw = localStorage.getItem(storageKey(mode));
    if (!raw) return [...ALL_DIFFICULTY_LEVELS];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...ALL_DIFFICULTY_LEVELS];
    const levels = parsed.filter(
      (n): n is DifficultyLevel =>
        typeof n === 'number' && isDifficultyLevel(n),
    );
    return normalizeDifficultyLevels(levels);
  } catch {
    return [...ALL_DIFFICULTY_LEVELS];
  }
}

export function saveMemoryDifficulty(
  mode: MemoryMode,
  levels: readonly DifficultyLevel[],
): void {
  try {
    localStorage.setItem(
      storageKey(mode),
      JSON.stringify(normalizeDifficultyLevels(levels)),
    );
  } catch {
    /* ignore */
  }
}

export function filterMemoryByDifficulty(
  tasks: MemoryRecallTask[],
  levels: readonly DifficultyLevel[],
): MemoryRecallTask[] {
  const allowed = new Set(normalizeDifficultyLevels(levels));
  if (allowed.size === ALL_DIFFICULTY_LEVELS.length) return tasks;
  return tasks.filter((task) => allowed.has(task.difficulty));
}

export function memoryPool(mode: MemoryMode): MemoryRecallTask[] {
  return filterMemoryByDifficulty(getMemoryTasks(), loadMemoryDifficulty(mode));
}

export function countMemoryByDifficulty(): Record<DifficultyLevel, number> {
  const counts: Record<DifficultyLevel, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  for (const task of getMemoryTasks()) counts[task.difficulty] += 1;
  return counts;
}
