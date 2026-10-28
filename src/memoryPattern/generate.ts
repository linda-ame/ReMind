import { acceptsPattern } from './difficulty';
import {
  GRID_SPEC,
  MEMORY_PATTERN_GRIDS,
  patternKey,
  type GridSpec,
  type MemoryPatternDifficulty,
  type MemoryPatternGrid,
} from './types';

const RANDOM_ATTEMPTS = 80;
const RESERVE_ATTEMPTS = 500;

type Shape = ReadonlyArray<readonly [number, number]>;

/** Small, nameable clusters used for the easier levels. */
const SHAPES: Shape[] = [
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [1, 0]],
  [[0, 1], [0, 2], [1, 2]],
  [[0, 0], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [0, 3]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [0, 1], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 0]],
  [[0, 0], [0, 1], [0, 2], [1, 2]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 1], [1, 0], [1, 1], [1, 2]],
  [[0, 1], [0, 2], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 1], [1, 2]],
  [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0]],
];

/** Known-good layouts if random search is unlucky. Checked again before use. */
const RESERVES: Record<string, number[][]> = {
  '2x3-1': [[0, 1], [1, 2], [0, 3]],
  '2x3-2': [[0, 1, 3], [1, 2, 5]],
  '2x3-3': [[0, 1, 5], [1, 2, 3]],
  '2x3-4': [[0, 1, 5], [1, 2, 3]],
  '2x3-5': [[0, 3, 5], [2, 3, 4]],
  '2x4-1': [[0, 1], [0, 1, 2], [4, 5]],
  '2x4-2': [[0, 1, 4], [1, 2, 6]],
  '2x4-3': [[0, 1, 6, 7], [0, 4, 2, 3]],
  '2x4-4': [[0, 1, 3, 6], [0, 4, 3, 6]],
  '2x4-5': [[0, 1, 3, 7], [0, 4, 2, 7]],
  '3x3-1': [[0, 1], [0, 1, 2], [0, 3]],
  '3x3-2': [[0, 1, 3], [1, 2, 5]],
  '3x3-3': [[0, 1, 5, 8], [0, 3, 2, 7]],
  '3x3-4': [[0, 1, 5, 7], [0, 1, 6, 8]],
  '3x3-5': [[0, 1, 6, 8], [0, 2, 5, 7]],
  '3x4-1': [[0, 1, 2], [0, 4]],
  '3x4-2': [[0, 1, 4, 5], [1, 2, 6]],
  '3x4-5': [[0, 1, 6, 11], [0, 3, 5, 9, 10]],
  '4x4-1': [[0, 1, 2], [0, 1, 4, 5]],
  '4x4-5': [[0, 1, 6, 11, 14, 15], [0, 3, 5, 9, 12, 15]],
};

export interface GenerateOptions {
  grid: MemoryPatternGrid;
  difficulty: MemoryPatternDifficulty;
  recentKeys?: readonly string[];
  random?: () => number;
}

export function generatePattern(options: GenerateOptions): number[] {
  const random = options.random ?? Math.random;
  const recent = new Set(options.recentKeys ?? []);
  const spec = GRID_SPEC[options.grid];
  const limits = limitsOf(options.grid, options.difficulty);

  for (let attempt = 0; attempt < RANDOM_ATTEMPTS; attempt += 1) {
    const candidate = propose(spec, limits, random);
    if (!keep(candidate, options, recent)) continue;
    return candidate!;
  }

  const reserveRandom = mulberry32(reserveSeed(options.grid, options.difficulty));
  let repeated: number[] | null = null;
  for (let attempt = 0; attempt < RESERVE_ATTEMPTS; attempt += 1) {
    const candidate =
      attempt % 2 === 0
        ? propose(spec, limits, reserveRandom)
        : randomSubset(spec.cells, pickCount(limits, reserveRandom), reserveRandom);
    if (!candidate || !acceptsPattern(candidate, options.grid, options.difficulty)) {
      continue;
    }
    if (!recent.has(patternKey(candidate))) return candidate;
    repeated = candidate;
  }

  for (const candidate of RESERVES[`${options.grid}-${options.difficulty}`] ?? []) {
    if (!acceptsPattern(candidate, options.grid, options.difficulty)) continue;
    if (!recent.has(patternKey(candidate))) return [...candidate];
    repeated ??= [...candidate];
  }

  if (repeated) return repeated;
  const reserve = RESERVES[`${options.grid}-1`]?.[0] ?? RESERVES[`${options.grid}-5`]?.[0];
  if (reserve && reserve.length > 0 && reserve.length < spec.cells) return [...reserve];
  return [0, 1].filter((index) => index < spec.cells);
}

interface Limits {
  minFilled: number;
  maxFilled: number;
  minGroups: number;
  maxGroups: number;
  maxGroupSize: number;
  separated: boolean;
  compact: boolean;
}

function limitsOf(grid: MemoryPatternGrid, difficulty: MemoryPatternDifficulty): Limits {
  const separated = difficulty === 5;
  const compact = difficulty <= 2;
  const table: Record<MemoryPatternGrid, Record<MemoryPatternDifficulty, Limits>> = {
    '2x3': {
      1: lim(2, 2, 1, 1, 2, false, true),
      2: lim(3, 3, 1, 1, 3, false, true),
      3: lim(3, 3, 2, 2, 2, false, false),
      4: lim(3, 3, 2, 2, 2, false, false),
      5: lim(3, 3, 2, 2, 2, true, false),
    },
    '2x4': {
      1: lim(2, 3, 1, 1, 3, false, true),
      2: lim(3, 4, 1, 1, 4, false, true),
      3: lim(4, 4, 2, 2, 3, false, false),
      4: lim(4, 5, 2, 2, 3, false, false),
      5: lim(4, 5, 2, 3, 3, true, false),
    },
    '3x3': {
      1: lim(2, 3, 1, 1, 3, false, true),
      2: lim(3, 4, 1, 1, 4, false, true),
      3: lim(4, 5, 2, 2, 3, false, false),
      4: lim(4, 5, 2, 3, 3, false, false),
      5: lim(4, 5, 2, 3, 3, true, false),
    },
    '3x4': {
      1: lim(2, 4, 1, 1, 4, false, true),
      2: lim(4, 5, 1, 1, 5, false, true),
      3: lim(5, 6, 2, 2, 4, false, false),
      4: lim(5, 7, 2, 3, 4, false, false),
      5: lim(6, 7, 3, 4, 3, true, false),
    },
    '4x4': {
      1: lim(3, 4, 1, 1, 4, false, true),
      2: lim(4, 5, 1, 1, 5, false, true),
      3: lim(5, 7, 2, 2, 4, false, false),
      4: lim(6, 8, 2, 3, 4, false, false),
      5: lim(6, 8, 3, 4, 3, true, false),
    },
  };
  const chosen = table[grid][difficulty];
  return { ...chosen, separated, compact };
}

function lim(
  minFilled: number,
  maxFilled: number,
  minGroups: number,
  maxGroups: number,
  maxGroupSize: number,
  separated: boolean,
  compact: boolean,
): Limits {
  return {
    minFilled,
    maxFilled,
    minGroups,
    maxGroups,
    maxGroupSize,
    separated,
    compact,
  };
}

function keep(
  candidate: number[] | null,
  options: GenerateOptions,
  recent: Set<string>,
): candidate is number[] {
  if (!candidate) return false;
  if (!acceptsPattern(candidate, options.grid, options.difficulty)) return false;
  return !recent.has(patternKey(candidate));
}

function propose(spec: GridSpec, limits: Limits, random: () => number): number[] | null {
  const count = pickCount(limits, random);
  if (limits.compact) {
    if (random() < 0.85) {
      const shaped = placeTemplate(spec, count, random);
      if (shaped) return shaped;
    }
    return growConnected(spec, count, random);
  }
  const groups = randInt(random, limits.minGroups, limits.maxGroups);
  const sizes = splitSizes(count, groups, limits.maxGroupSize, random);
  if (!sizes) return randomSubset(spec.cells, count, random);
  return (
    placeGroups(spec, sizes, random, limits.separated ? 'all' : 'ortho') ??
    randomSubset(spec.cells, count, random)
  );
}

function pickCount(limits: Limits, random: () => number): number {
  return randInt(random, limits.minFilled, limits.maxFilled);
}

function placeTemplate(
  spec: GridSpec,
  count: number,
  random: () => number,
): number[] | null {
  const fitting = SHAPES.filter((shape) => shape.length === count);
  if (fitting.length === 0) return null;
  const order = shuffle(fitting, random);
  for (const shape of order) {
    const maxRowInShape = Math.max(...shape.map(([row]) => row));
    const maxColInShape = Math.max(...shape.map(([, col]) => col));
    const rowRoom = spec.rows - 1 - maxRowInShape;
    const colRoom = spec.cols - 1 - maxColInShape;
    if (rowRoom < 0 || colRoom < 0) continue;
    const origins: Array<readonly [number, number]> = [];
    for (let row = 0; row <= rowRoom; row += 1) {
      for (let col = 0; col <= colRoom; col += 1) origins.push([row, col]);
    }
    const [rowOffset, colOffset] = shuffle(origins, random)[0] ?? [0, 0];
    return shape
      .map(([row, col]) => (row + rowOffset) * spec.cols + (col + colOffset))
      .sort((a, b) => a - b);
  }
  return null;
}

function growConnected(
  spec: GridSpec,
  count: number,
  random: () => number,
): number[] | null {
  const start = Math.floor(random() * spec.cells);
  return growFrom(spec, start, count, new Set(), new Set(), random);
}

function placeGroups(
  spec: GridSpec,
  sizes: readonly number[],
  random: () => number,
  neighborhood: 'ortho' | 'all',
): number[] | null {
  const used = new Set<number>();
  const blocked = new Set<number>();
  for (const size of sizes) {
    const starts = shuffle(
      indexes(spec.cells).filter((index) => !used.has(index) && !blocked.has(index)),
      random,
    );
    let placed: number[] | null = null;
    for (const start of starts.slice(0, 10)) {
      const group = growFrom(spec, start, size, used, blocked, random);
      if (group && group.length === size) {
        placed = group;
        break;
      }
    }
    if (!placed) return null;
    for (const cell of placed) {
      used.add(cell);
      blockAround(cell, spec, blocked, neighborhood);
    }
  }
  return [...used].sort((a, b) => a - b);
}

function growFrom(
  spec: GridSpec,
  start: number,
  count: number,
  used: Set<number>,
  blocked: Set<number>,
  random: () => number,
): number[] | null {
  if (used.has(start) || blocked.has(start)) return null;
  const group = [start];
  const local = new Set([start]);
  while (group.length < count) {
    const frontier: number[] = [];
    for (const cell of group) {
      for (const next of ortho(cell, spec)) {
        if (local.has(next) || used.has(next) || blocked.has(next)) continue;
        frontier.push(next);
      }
    }
    if (frontier.length === 0) return null;
    const next = frontier[Math.floor(random() * frontier.length)]!;
    local.add(next);
    group.push(next);
  }
  return group;
}

function blockAround(
  index: number,
  spec: GridSpec,
  blocked: Set<number>,
  neighborhood: 'ortho' | 'all',
): void {
  const row = Math.floor(index / spec.cols);
  const col = index % spec.cols;
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (neighborhood === 'ortho' && rowOffset !== 0 && colOffset !== 0) continue;
      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;
      if (nextRow < 0 || nextCol < 0 || nextRow >= spec.rows || nextCol >= spec.cols) {
        continue;
      }
      blocked.add(nextRow * spec.cols + nextCol);
    }
  }
}

function splitSizes(
  total: number,
  groups: number,
  maxSize: number,
  random: () => number,
): number[] | null {
  if (groups < 1 || total < groups || total > groups * maxSize) return null;
  const sizes = Array.from({ length: groups }, () => 1);
  let left = total - groups;
  while (left > 0) {
    const room = sizes
      .map((size, index) => (size < maxSize ? index : -1))
      .filter((index) => index >= 0);
    if (room.length === 0) return null;
    const pick = room[Math.floor(random() * room.length)]!;
    sizes[pick] = (sizes[pick] ?? 1) + 1;
    left -= 1;
  }
  return sizes;
}

function randomSubset(cells: number, count: number, random: () => number): number[] {
  return shuffle(indexes(cells), random)
    .slice(0, count)
    .sort((a, b) => a - b);
}

function ortho(index: number, spec: GridSpec): number[] {
  const row = Math.floor(index / spec.cols);
  const col = index % spec.cols;
  const next: number[] = [];
  if (row > 0) next.push(index - spec.cols);
  if (row + 1 < spec.rows) next.push(index + spec.cols);
  if (col > 0) next.push(index - 1);
  if (col + 1 < spec.cols) next.push(index + 1);
  return next;
}

function indexes(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

function randInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = copy[index]!;
    copy[index] = copy[swap]!;
    copy[swap] = current;
  }
  return copy;
}

function reserveSeed(grid: MemoryPatternGrid, difficulty: number): number {
  return 4000 + MEMORY_PATTERN_GRIDS.indexOf(grid) * 80 + difficulty * 13;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
