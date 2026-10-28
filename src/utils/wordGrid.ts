import type { DifficultyLevel } from '../types/task';

/**
 * Progress for one word-grid try, stored in `enteredAnswer`.
 * IndexedDB / cloud already persist that string — no separate store.
 *
 * `status` stays the app's viewed / attempted / completed.
 * A skip for today stays in the existing skip list, not on the attempt.
 */
export interface WordGridAttemptData {
  path: number[];
  word: string;
  undoCount: number;
  resetCount: number;
  /** How many times the path reached the full word length. */
  attemptCount: number;
  solutionViewed: boolean;
  difficultyAtAttempt: DifficultyLevel | null;
}

/** Orthogonal neighbour: one step horizontally or vertically, never diagonally. */
export function isAdjacent(a: number, b: number, gridSize: number): boolean {
  return (
    Math.abs(Math.floor(a / gridSize) - Math.floor(b / gridSize)) +
      Math.abs((a % gridSize) - (b % gridSize)) ===
    1
  );
}

/** Join selected letters and NFC-normalize. Diacritics stay significant. */
export function lettersToWord(
  letters: readonly string[],
  path: readonly number[],
): string {
  return path
    .map((index) => letters[index] ?? '')
    .join('')
    .normalize('NFC');
}

export function wordsMatch(built: string, target: string): boolean {
  return built.normalize('NFC') === target.normalize('NFC');
}

export function serializeWordGrid(data: WordGridAttemptData): string {
  return JSON.stringify(data);
}

function finiteCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function asDifficulty(value: unknown): DifficultyLevel | null {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) {
    return value;
  }
  return null;
}

export function parseWordGridAnswer(
  raw: string | null | undefined,
): WordGridAttemptData | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (!Array.isArray(record.path)) return null;
    const path = record.path.filter(
      (item): item is number => typeof item === 'number' && Number.isInteger(item),
    );
    if (path.length !== record.path.length) return null;
    return {
      path,
      word: typeof record.word === 'string' ? record.word.normalize('NFC') : '',
      undoCount: finiteCount(record.undoCount),
      resetCount: finiteCount(record.resetCount),
      attemptCount: finiteCount(record.attemptCount),
      solutionViewed: record.solutionViewed === true,
      difficultyAtAttempt: asDifficulty(record.difficultyAtAttempt),
    };
  } catch {
    return null;
  }
}

/** True when every step stays on the board, is unique, and is orthogonal. */
export function pathIsPlayable(
  path: readonly number[],
  gridSize: number,
  startIndex: number,
  cellCount: number,
): boolean {
  if (path.length === 0 || path[0] !== startIndex) return false;
  const seen = new Set<number>();
  for (let i = 0; i < path.length; i++) {
    const index = path[i]!;
    if (index < 0 || index >= cellCount || seen.has(index)) return false;
    seen.add(index);
    if (i > 0 && !isAdjacent(path[i - 1]!, index, gridSize)) return false;
  }
  return true;
}
