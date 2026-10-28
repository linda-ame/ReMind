import {
  GRID_SPEC,
  type MemoryPatternDifficulty,
  type MemoryPatternGrid,
} from './types';

/**
 * How hard a pattern is to hold in mind for this grid.
 * This is a task configuration, not a clinical memory score.
 * A nearly full grid is rejected: remembering a few holes is a different, easier task.
 */
interface Profile {
  minFilled: number;
  maxFilled: number;
  minGroups: number;
  maxGroups: number;
  maxGroupSize: number;
  /** Groups must have a full cell of space between them, including corners. */
  separated: boolean;
  allowSymmetry: boolean;
  allowStraightLine: boolean;
  allowSolidRectangle: boolean;
  /** One connected shape must fit in a tight box. Null skips the check. */
  compactSlack: number | null;
}

const PROFILES: Record<
  MemoryPatternGrid,
  Record<MemoryPatternDifficulty, Profile>
> = {
  '2x3': {
    1: rule(2, 2, 1, 1, 2, false, true, true, true, 1),
    2: rule(3, 3, 1, 1, 3, false, true, false, false, 2),
    3: rule(3, 3, 2, 2, 2, false, true, false, false, null),
    4: rule(3, 3, 2, 2, 2, false, false, false, false, null),
    5: rule(3, 3, 2, 2, 2, true, false, false, false, null),
  },
  '2x4': {
    1: rule(2, 3, 1, 1, 3, false, true, true, true, 1),
    2: rule(3, 4, 1, 1, 4, false, true, false, false, 2),
    3: rule(4, 4, 2, 2, 3, false, true, false, false, null),
    4: rule(4, 5, 2, 2, 3, false, false, false, false, null),
    5: rule(4, 5, 2, 3, 3, true, false, false, false, null),
  },
  '3x3': {
    1: rule(2, 3, 1, 1, 3, false, true, true, true, 1),
    2: rule(3, 4, 1, 1, 4, false, true, false, false, 2),
    3: rule(4, 5, 2, 2, 3, false, true, false, false, null),
    4: rule(4, 5, 2, 3, 3, false, false, false, false, null),
    5: rule(4, 5, 2, 3, 3, true, false, false, false, null),
  },
  '3x4': {
    1: rule(2, 4, 1, 1, 4, false, true, true, true, 1),
    2: rule(4, 5, 1, 1, 5, false, true, false, false, 2),
    3: rule(5, 6, 2, 2, 4, false, true, false, false, null),
    4: rule(5, 7, 2, 3, 4, false, false, false, false, null),
    5: rule(6, 7, 3, 4, 3, true, false, false, false, null),
  },
  '4x4': {
    1: rule(3, 4, 1, 1, 4, false, true, true, true, 1),
    2: rule(4, 5, 1, 1, 5, false, true, false, false, 2),
    3: rule(5, 7, 2, 2, 4, false, true, false, false, null),
    4: rule(6, 8, 2, 3, 4, false, false, false, false, null),
    5: rule(6, 8, 3, 4, 3, true, false, false, false, null),
  },
};

function rule(
  minFilled: number,
  maxFilled: number,
  minGroups: number,
  maxGroups: number,
  maxGroupSize: number,
  separated: boolean,
  allowSymmetry: boolean,
  allowStraightLine: boolean,
  allowSolidRectangle: boolean,
  compactSlack: number | null,
): Profile {
  return {
    minFilled,
    maxFilled,
    minGroups,
    maxGroups,
    maxGroupSize,
    separated,
    allowSymmetry,
    allowStraightLine,
    allowSolidRectangle,
    compactSlack,
  };
}

export interface PatternShape {
  filled: number;
  empty: number;
  groups: number;
  largest: number;
  symmetric: boolean;
  straightLine: boolean;
  solidRectangle: boolean;
  compact: boolean;
  separated: boolean;
}

export function patternLimits(
  grid: MemoryPatternGrid,
  difficulty: MemoryPatternDifficulty,
): { minFilled: number; maxFilled: number; minGroups: number; maxGroups: number } {
  const profile = PROFILES[grid][difficulty];
  return {
    minFilled: profile.minFilled,
    maxFilled: profile.maxFilled,
    minGroups: profile.minGroups,
    maxGroups: profile.maxGroups,
  };
}

export function patternShape(
  indices: readonly number[],
  grid: MemoryPatternGrid,
): PatternShape {
  const spec = GRID_SPEC[grid];
  const unique = [...new Set(indices)];
  const groups = connectedGroups(unique, spec.cols, spec.rows);
  const largest = groups.reduce((max, group) => Math.max(max, group.length), 0);
  const area = boxArea(unique, spec.cols);
  return {
    filled: unique.length,
    empty: spec.cells - unique.length,
    groups: groups.length,
    largest,
    symmetric: isSymmetric(unique, spec.rows, spec.cols),
    straightLine: isStraightLine(unique, spec.cols),
    solidRectangle: unique.length > 0 && area === unique.length,
    compact: groups.length === 1 && area <= unique.length + 1,
    separated: groupsAreSeparated(groups, spec.cols),
  };
}

export function acceptsPattern(
  indices: readonly number[],
  grid: MemoryPatternGrid,
  difficulty: MemoryPatternDifficulty,
): boolean {
  const spec = GRID_SPEC[grid];
  if (indices.length === 0 || indices.length >= spec.cells) return false;
  if (new Set(indices).size !== indices.length) return false;
  for (const index of indices) {
    if (!Number.isInteger(index) || index < 0 || index >= spec.cells) return false;
  }

  const profile = PROFILES[grid][difficulty];
  const shape = patternShape(indices, grid);
  if (shape.filled < profile.minFilled || shape.filled > profile.maxFilled) return false;
  if (shape.groups < profile.minGroups || shape.groups > profile.maxGroups) return false;
  if (shape.largest > profile.maxGroupSize) return false;
  if (profile.separated && !shape.separated) return false;
  if (!profile.allowSymmetry && shape.symmetric) return false;
  if (!profile.allowStraightLine && shape.straightLine) return false;
  if (!profile.allowSolidRectangle && shape.solidRectangle) return false;
  if (profile.compactSlack != null) {
    const area = boxArea(indices, spec.cols);
    if (shape.groups !== 1 || area > shape.filled + profile.compactSlack) return false;
  }
  return true;
}

function connectedGroups(
  indices: readonly number[],
  cols: number,
  rows: number,
): number[][] {
  const filled = new Set(indices);
  const seen = new Set<number>();
  const groups: number[][] = [];
  for (const start of indices) {
    if (seen.has(start)) continue;
    const group: number[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length > 0) {
      const current = stack.pop()!;
      group.push(current);
      const row = Math.floor(current / cols);
      const col = current % cols;
      const neighbors = [
        row > 0 ? current - cols : -1,
        row + 1 < rows ? current + cols : -1,
        col > 0 ? current - 1 : -1,
        col + 1 < cols ? current + 1 : -1,
      ];
      for (const next of neighbors) {
        if (next < 0 || !filled.has(next) || seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
    groups.push(group);
  }
  return groups;
}

function groupsAreSeparated(groups: readonly number[][], cols: number): boolean {
  if (groups.length < 2) return false;
  for (let a = 0; a < groups.length; a += 1) {
    for (let b = a + 1; b < groups.length; b += 1) {
      for (const left of groups[a]!) {
        for (const right of groups[b]!) {
          const rowGap = Math.abs(Math.floor(left / cols) - Math.floor(right / cols));
          const colGap = Math.abs((left % cols) - (right % cols));
          if (Math.max(rowGap, colGap) <= 1) return false;
        }
      }
    }
  }
  return true;
}

function boxArea(indices: readonly number[], cols: number): number {
  if (indices.length === 0) return 0;
  let minRow = Infinity;
  let maxRow = -1;
  let minCol = Infinity;
  let maxCol = -1;
  for (const index of indices) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
  }
  return (maxRow - minRow + 1) * (maxCol - minCol + 1);
}

function isStraightLine(indices: readonly number[], cols: number): boolean {
  if (indices.length <= 1) return true;
  const rows = new Set(indices.map((index) => Math.floor(index / cols)));
  const columns = new Set(indices.map((index) => index % cols));
  if (rows.size !== 1 && columns.size !== 1) return false;
  if (rows.size === 1) {
    const sorted = indices.map((index) => index % cols).sort((a, b) => a - b);
    return sorted.every((col, index) => index === 0 || col === sorted[index - 1]! + 1);
  }
  const sorted = indices.map((index) => Math.floor(index / cols)).sort((a, b) => a - b);
  return sorted.every((row, index) => index === 0 || row === sorted[index - 1]! + 1);
}

function isSymmetric(
  indices: readonly number[],
  rows: number,
  cols: number,
): boolean {
  const filled = new Set(indices);
  const same = (mapped: number[]) =>
    mapped.length === filled.size && mapped.every((index) => filled.has(index));
  const horizontal = indices.map((index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    return (rows - 1 - row) * cols + col;
  });
  const vertical = indices.map((index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    return row * cols + (cols - 1 - col);
  });
  const turned = indices.map((index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    return (rows - 1 - row) * cols + (cols - 1 - col);
  });
  return same(horizontal) || same(vertical) || same(turned);
}
