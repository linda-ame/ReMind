import type { DifficultyLevel, Task } from '../types/task';

/** All content difficulty levels (1 = easiest … 5 = hardest). */
export const ALL_DIFFICULTY_LEVELS: readonly DifficultyLevel[] = [
  1, 2, 3, 4, 5,
];

export function isDifficultyLevel(n: number): n is DifficultyLevel {
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5;
}

/** Sorted unique copy; invalid entries dropped. Empty → treat as all. */
export function normalizeDifficultyLevels(
  levels: readonly number[] | null | undefined,
): DifficultyLevel[] {
  if (!levels || levels.length === 0) {
    return [...ALL_DIFFICULTY_LEVELS];
  }
  const set = new Set<DifficultyLevel>();
  for (const n of levels) {
    if (isDifficultyLevel(n)) set.add(n);
  }
  if (set.size === 0) return [...ALL_DIFFICULTY_LEVELS];
  return ALL_DIFFICULTY_LEVELS.filter((l) => set.has(l));
}

export function isAllDifficultyLevels(
  levels: readonly DifficultyLevel[],
): boolean {
  const n = normalizeDifficultyLevels(levels);
  return n.length === ALL_DIFFICULTY_LEVELS.length;
}

export function taskMatchesDifficultyLevels(
  task: Task,
  levels: readonly DifficultyLevel[],
): boolean {
  const allowed = new Set(normalizeDifficultyLevels(levels));
  if (allowed.size === ALL_DIFFICULTY_LEVELS.length) return true;
  const d = task.difficulty;
  if (d == null) return false;
  return allowed.has(d);
}

export function filterTasksByDifficulty(
  tasks: Task[],
  levels: readonly DifficultyLevel[],
): Task[] {
  return tasks.filter((t) => taskMatchesDifficultyLevels(t, levels));
}

/** Count tasks per difficulty level (missing difficulty ignored). */
export function countTasksByDifficultyLevel(
  tasks: Task[],
): Record<DifficultyLevel, number> {
  const counts: Record<DifficultyLevel, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  for (const t of tasks) {
    const d = t.difficulty;
    if (d != null && isDifficultyLevel(d)) counts[d] += 1;
  }
  return counts;
}

/** Human-readable selection, e.g. «1.–2. līmenis», «1., 3., 5. līmenis», «Visi». */
export function formatDifficultyLevelsLabel(
  levels: readonly DifficultyLevel[],
): string {
  const n = normalizeDifficultyLevels(levels);
  if (isAllDifficultyLevels(n)) return 'Visi';
  if (n.length === 1) return `${n[0]}. līmenis`;

  let consecutive = true;
  for (let i = 1; i < n.length; i++) {
    if (n[i]! !== n[i - 1]! + 1) {
      consecutive = false;
      break;
    }
  }
  if (consecutive) {
    return `${n[0]}.–${n[n.length - 1]}. līmenis`;
  }
  return `${n.join('., ')}. līmenis`;
}

const STORAGE_PREFIX = 'remind.difficultyLevels.';
const LEGACY_PRESET_PREFIX = 'remind.difficultyPreset.';

/** Multi-blank completion shares the Teikumu papildināšana filter. */
function sectionStorageType(type: Task['type']): Task['type'] {
  return type === 'sentence_completion_multi' ? 'sentence_completion' : type;
}

function storageKey(type: Task['type']): string {
  return `${STORAGE_PREFIX}${sectionStorageType(type)}`;
}

function legacyPresetKey(type: Task['type']): string {
  return `${LEGACY_PRESET_PREFIX}${sectionStorageType(type)}`;
}

function levelsFromLegacyPreset(raw: string): DifficultyLevel[] | null {
  switch (raw) {
    case 'easier':
      return [1, 2];
    case 'medium':
      return [3];
    case 'harder':
      return [4, 5];
    case 'all':
      return [...ALL_DIFFICULTY_LEVELS];
    default:
      return null;
  }
}

export function loadDifficultyLevels(type: Task['type']): DifficultyLevel[] {
  try {
    const raw = localStorage.getItem(storageKey(type));
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return normalizeDifficultyLevels(parsed as number[]);
      }
    }
    const legacy = localStorage.getItem(legacyPresetKey(type));
    if (legacy) {
      const migrated = levelsFromLegacyPreset(legacy);
      if (migrated) {
        saveDifficultyLevels(type, migrated);
        try {
          localStorage.removeItem(legacyPresetKey(type));
        } catch {
          /* ignore */
        }
        return migrated;
      }
    }
  } catch {
    /* ignore */
  }
  return [...ALL_DIFFICULTY_LEVELS];
}

export function saveDifficultyLevels(
  type: Task['type'],
  levels: readonly DifficultyLevel[],
): void {
  const normalized = normalizeDifficultyLevels(levels);
  try {
    localStorage.setItem(storageKey(type), JSON.stringify(normalized));
  } catch {
    /* ignore */
  }
}

/**
 * Toggle one level on/off. Returns null if the result would be empty
 * (caller should keep previous selection).
 */
export function toggleDifficultyLevel(
  current: readonly DifficultyLevel[],
  level: DifficultyLevel,
): DifficultyLevel[] | null {
  const set = new Set(normalizeDifficultyLevels(current));
  if (set.has(level)) {
    if (set.size <= 1) return null;
    set.delete(level);
  } else {
    set.add(level);
  }
  return ALL_DIFFICULTY_LEVELS.filter((l) => set.has(l));
}
