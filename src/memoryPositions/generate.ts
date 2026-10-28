import { acceptsLayout, figureCount, KNOWN_LAYOUTS } from './difficulty';
import { symbolSetKey, symbolSets } from './symbols';
import {
  GRID_SPEC,
  MEMORY_POSITIONS_CATEGORIES,
  readingOrderIds,
  type MemoryPositionsCategory,
  type MemoryPositionsCategorySetting,
  type MemoryPositionsDifficulty,
  type MemoryPositionsGrid,
  type MemoryPositionsSymbol,
  type SymbolPlacement,
} from './types';

export interface GenerateOptions {
  grid: MemoryPositionsGrid;
  difficulty: MemoryPositionsDifficulty;
  category: MemoryPositionsCategorySetting;
  recentKeys?: readonly string[];
  lastCategory?: MemoryPositionsCategory | null;
  random?: () => number;
}

export interface GeneratedDeal {
  category: MemoryPositionsCategory;
  symbols: MemoryPositionsSymbol[];
  solution: SymbolPlacement[];
  trayOrder: string[];
}

const RANDOM_ATTEMPTS = 80;

export function generateMemoryPositions(options: GenerateOptions): GeneratedDeal {
  const random = options.random ?? Math.random;
  const recent = new Set(options.recentKeys ?? []);
  const category = pickCategory(options.category, options.lastCategory ?? null, random);
  const count = figureCount(options.grid, options.difficulty);
  const symbols = pickSymbols(category, count, recent, random);
  const cells = pickCells(options.grid, options.difficulty, recent, random);
  const ordered = shuffle(symbols, random);
  const solution = ordered.map((symbol, index) => ({
    symbolId: symbol.id,
    cell: cells[index]!,
  }));
  const reading = readingOrderIds(solution);
  let trayOrder = shuffle(reading, random);
  if (sameOrder(trayOrder, reading)) {
    trayOrder = reading.length < 2 ? [...reading] : [reading[1]!, reading[0]!, ...reading.slice(2)];
  }
  return { category, symbols: ordered, solution, trayOrder };
}

function pickCategory(
  setting: MemoryPositionsCategorySetting,
  lastCategory: MemoryPositionsCategory | null,
  random: () => number,
): MemoryPositionsCategory {
  if (setting !== 'mixed') return setting;
  const pool = MEMORY_POSITIONS_CATEGORIES.filter((item) => item !== lastCategory);
  const choices = pool.length > 0 ? pool : MEMORY_POSITIONS_CATEGORIES;
  return choices[Math.floor(random() * choices.length)]!;
}

function pickSymbols(
  category: MemoryPositionsCategory,
  count: number,
  recent: ReadonlySet<string>,
  random: () => number,
): MemoryPositionsSymbol[] {
  const sets = symbolSets(category, count);
  const fresh = sets.filter((set) => !mentionsSymbols(recent, symbolSetKey(set)));
  const pool = fresh.length > 0 ? fresh : sets;
  return pool[Math.floor(random() * pool.length)]!.map((symbol) => ({ ...symbol }));
}

function mentionsSymbols(recent: ReadonlySet<string>, key: string): boolean {
  if (recent.size === 0) return false;
  const ids = new Set(key.split('|'));
  for (const deal of recent) {
    const used = new Set(
      deal
        .split(',')
        .map((part) => part.split(':')[1])
        .filter((id): id is string => Boolean(id)),
    );
    if (used.size === ids.size && [...ids].every((id) => used.has(id))) return true;
  }
  return false;
}

function pickCells(
  grid: MemoryPositionsGrid,
  difficulty: MemoryPositionsDifficulty,
  recent: ReadonlySet<string>,
  random: () => number,
): number[] {
  const spec = GRID_SPEC[grid];
  const count = figureCount(grid, difficulty);
  let repeated: number[] | null = null;
  for (let attempt = 0; attempt < RANDOM_ATTEMPTS; attempt += 1) {
    const candidate = shuffle(indexList(spec.cells), random).slice(0, count);
    if (!acceptsLayout(candidate, grid, difficulty)) continue;
    if (!sameCellsAsRecent(candidate, recent)) return [...candidate].sort((a, b) => a - b);
    repeated = candidate;
  }
  const known = KNOWN_LAYOUTS[`${grid}-${difficulty}`] ?? [];
  const ordered = shuffle(known, random);
  for (const candidate of ordered) {
    if (!acceptsLayout(candidate, grid, difficulty)) continue;
    if (!sameCellsAsRecent(candidate, recent)) return [...candidate];
    repeated = candidate;
  }
  if (repeated && acceptsLayout(repeated, grid, difficulty)) return [...repeated];
  const reserve = known.find((candidate) => acceptsLayout(candidate, grid, difficulty));
  if (reserve) return [...reserve];
  return indexList(count);
}

function sameCellsAsRecent(cells: readonly number[], recent: ReadonlySet<string>): boolean {
  const key = [...cells].sort((a, b) => a - b).join(',');
  for (const deal of recent) {
    const used = deal
      .split(',')
      .map((part) => part.split(':')[0])
      .sort()
      .join(',');
    if (used === key) return true;
  }
  return false;
}

function indexList(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = copy[index]!;
    copy[index] = copy[swap]!;
    copy[swap] = current;
  }
  return copy;
}

function sameOrder(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}
