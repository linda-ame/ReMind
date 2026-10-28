import {
  GRID_SPEC,
  type MemoryPositionsDifficulty,
  type MemoryPositionsGrid,
} from './types';

/**
 * How many figures to place, and how spread out they are.
 * This is a starting task configuration, not a clinical memory score.
 * A small grid at level 5 is the hardest deal for that grid, not the same
 * load as level 5 on a larger grid.
 */
export const FIGURE_COUNTS: Record<
  MemoryPositionsGrid,
  Record<MemoryPositionsDifficulty, number>
> = {
  '2x3': { 1: 2, 2: 2, 3: 3, 4: 3, 5: 4 },
  '2x4': { 1: 2, 2: 3, 3: 3, 4: 4, 5: 5 },
  '3x3': { 1: 3, 2: 3, 3: 4, 4: 5, 5: 6 },
  '3x4': { 1: 3, 2: 4, 3: 5, 4: 6, 5: 7 },
  '4x4': { 1: 4, 2: 5, 3: 6, 4: 7, 5: 8 },
};

export function figureCount(
  grid: MemoryPositionsGrid,
  difficulty: MemoryPositionsDifficulty,
): number {
  return FIGURE_COUNTS[grid][difficulty];
}

function groupsOf(cells: readonly number[], cols: number): number[][] {
  const set = new Set(cells);
  const seen = new Set<number>();
  const groups: number[][] = [];
  for (const start of cells) {
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
        [row, col - 1],
        [row, col + 1],
        [row - 1, col],
        [row + 1, col],
      ];
      for (const [nextRow, nextCol] of neighbors) {
        if (nextRow < 0 || nextCol < 0 || nextCol >= cols) continue;
        const index = nextRow * cols + nextCol;
        if (!set.has(index) || seen.has(index)) continue;
        seen.add(index);
        stack.push(index);
      }
    }
    groups.push(group);
  }
  return groups;
}

function boundingSlack(cells: readonly number[], cols: number): number {
  let minRow = Infinity;
  let maxRow = -1;
  let minCol = Infinity;
  let maxCol = -1;
  for (const index of cells) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
  }
  return (maxRow - minRow + 1) * (maxCol - minCol + 1) - cells.length;
}

function isStraightLine(cells: readonly number[], cols: number): boolean {
  const rows = new Set(cells.map((index) => Math.floor(index / cols)));
  const colsUsed = new Set(cells.map((index) => index % cols));
  return rows.size === 1 || colsUsed.size === 1;
}

function isSolidRectangle(cells: readonly number[], cols: number): boolean {
  return cells.length >= 4 && boundingSlack(cells, cols) === 0 && !isStraightLine(cells, cols);
}

/** Groups stay apart even at the corners. */
function separatedByGap(groups: readonly number[][], cols: number): boolean {
  if (groups.length < 2) return false;
  for (let left = 0; left < groups.length; left += 1) {
    for (let right = left + 1; right < groups.length; right += 1) {
      let nearest = Infinity;
      for (const a of groups[left]!) {
        for (const b of groups[right]!) {
          const rowGap = Math.abs(Math.floor(a / cols) - Math.floor(b / cols));
          const colGap = Math.abs((a % cols) - (b % cols));
          nearest = Math.min(nearest, Math.max(rowGap, colGap));
        }
      }
      if (nearest < 2) return false;
    }
  }
  return true;
}

/**
 * Level 1–2: one compact cluster.
 * Level 3: not a straight line or a solid block.
 * Level 4–5: more than one cluster. Level 5 keeps a gap between clusters.
 */
export function acceptsLayout(
  cells: readonly number[],
  grid: MemoryPositionsGrid,
  difficulty: MemoryPositionsDifficulty,
): boolean {
  const spec = GRID_SPEC[grid];
  const count = figureCount(grid, difficulty);
  if (cells.length !== count || new Set(cells).size !== count) return false;
  for (const cell of cells) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= spec.cells) return false;
  }
  const groups = groupsOf(cells, spec.cols);
  const slack = boundingSlack(cells, spec.cols);
  const line = isStraightLine(cells, spec.cols);
  if (difficulty === 1) return groups.length === 1 && slack <= 1;
  if (difficulty === 2) return groups.length === 1 && slack <= 2;
  if (difficulty === 3) {
    if (count >= 3 && line) return false;
    if (isSolidRectangle(cells, spec.cols)) return false;
    return true;
  }
  if (line || groups.length < 2) return false;
  if (difficulty === 5) return separatedByGap(groups, spec.cols);
  return true;
}

/** Known-good layouts if a random search is unlucky. */
export const KNOWN_LAYOUTS: Record<string, number[][]> = {
  '2x3-1': [
    [0, 1],
    [1, 2],
    [3, 4],
    [0, 3],
  ],
  '2x3-2': [
    [0, 1],
    [4, 5],
    [1, 4],
    [2, 5],
  ],
  '2x3-3': [
    [0, 1, 3],
    [1, 2, 5],
    [0, 1, 4],
    [3, 4, 2],
  ],
  '2x3-4': [
    [0, 1, 5],
    [0, 3, 2],
    [3, 4, 2],
  ],
  '2x3-5': [[0, 3, 2, 5]],
  '2x4-1': [
    [0, 1],
    [2, 3],
    [4, 5],
    [1, 5],
  ],
  '2x4-2': [
    [0, 1, 2],
    [0, 1, 4],
    [4, 5, 6],
    [1, 2, 5],
  ],
  '2x4-3': [
    [0, 1, 4],
    [1, 2, 5],
    [2, 3, 6],
    [4, 5, 1],
  ],
  '2x4-4': [
    [0, 1, 6, 7],
    [0, 4, 3, 7],
    [0, 1, 3, 6],
  ],
  '2x4-5': [
    [0, 1, 4, 5, 7],
    [0, 4, 2, 3, 6],
  ],
  '3x3-1': [
    [0, 1, 3],
    [1, 2, 5],
    [3, 4, 6],
    [4, 5, 7],
  ],
  '3x3-2': [
    [0, 1, 3],
    [0, 1, 2],
    [4, 5, 8],
    [0, 3, 4],
  ],
  '3x3-3': [
    [0, 1, 2, 4],
    [0, 1, 2, 5],
    [2, 4, 5, 8],
    [0, 3, 4, 7],
  ],
  '3x3-4': [
    [0, 1, 2, 7, 8],
    [0, 3, 6, 5, 8],
    [0, 1, 6, 7, 8],
  ],
  '3x3-5': [
    [0, 3, 6, 2, 5, 8],
    [0, 1, 2, 6, 7, 8],
  ],
  '3x4-1': [
    [0, 1, 4],
    [1, 2, 5],
    [4, 5, 8],
    [8, 9, 5],
  ],
  '3x4-2': [
    [0, 1, 4, 5],
    [1, 2, 5, 6],
    [4, 5, 8, 9],
    [0, 1, 2, 4],
  ],
  '3x4-3': [
    [0, 1, 2, 4, 8],
    [0, 1, 4, 5, 9],
    [1, 2, 5, 6, 10],
    [4, 5, 6, 9, 2],
  ],
  '3x4-4': [
    [0, 1, 4, 5, 10, 11],
    [0, 1, 2, 9, 10, 11],
    [0, 4, 8, 3, 7, 6],
  ],
  '3x4-5': [
    [0, 1, 4, 5, 8, 9, 11],
    [0, 1, 4, 5, 8, 9, 3],
  ],
  '4x4-1': [
    [0, 1, 4, 5],
    [2, 3, 6, 7],
    [8, 9, 12, 13],
    [5, 6, 9, 10],
  ],
  '4x4-2': [
    [0, 1, 2, 4, 5],
    [0, 1, 4, 5, 8],
    [5, 6, 7, 9, 10],
    [1, 2, 5, 6, 9],
  ],
  '4x4-3': [
    [0, 1, 2, 4, 5, 8],
    [1, 2, 3, 6, 7, 11],
    [4, 5, 6, 9, 10, 14],
    [0, 1, 4, 8, 9, 13],
  ],
  '4x4-4': [
    [0, 1, 4, 5, 10, 11, 14],
    [0, 1, 2, 11, 13, 14, 15],
    [0, 4, 8, 7, 11, 14, 15],
  ],
  '4x4-5': [
    [0, 4, 8, 12, 3, 7, 11, 15],
    [0, 1, 2, 3, 12, 13, 14, 15],
  ],
};
