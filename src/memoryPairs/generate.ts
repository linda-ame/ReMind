import { classifyMemoryPairsDifficulty } from './difficulty';
import { symbolVariants } from './symbols';
import {
  MEMORY_PAIRS_SCHEMA,
  gridPairs,
  type MemoryPairsCategory,
  type MemoryPairsCategorySetting,
  type MemoryPairsDealtCard,
  type MemoryPairsGame,
  type MemoryPairsMemory,
  type MemoryPairsSettings,
  type MemoryPairsSymbol,
} from './types';

export function symbolSetKey(symbols: readonly { id: string }[]): string {
  return symbols
    .map((symbol) => symbol.id)
    .slice()
    .sort()
    .join('|');
}

export function symbolSetKeyFromCards(cards: readonly MemoryPairsDealtCard[]): string {
  return [...new Set(cards.map((card) => card.symbol.id))].sort().join('|');
}

export function layoutKeyFromSymbols(symbols: readonly { id: string }[]): string {
  return symbols.map((symbol) => symbol.id).join('|');
}

export function layoutKeyFromCards(cards: readonly MemoryPairsDealtCard[]): string {
  return cards.map((card) => card.symbol.id).join('|');
}

function shuffle<T>(items: readonly T[]): T[] {
  const next = items.slice();
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = next[index]!;
    next[index] = next[swap]!;
    next[swap] = current;
  }
  return next;
}

function uniqueVariants(variants: MemoryPairsSymbol[][]): MemoryPairsSymbol[][] {
  const seen = new Set<string>();
  const unique: MemoryPairsSymbol[][] = [];
  for (const variant of variants) {
    const key = symbolSetKey(variant);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(variant);
  }
  return unique;
}

function pickVariant(
  variants: MemoryPairsSymbol[][],
  avoid: string | null,
): MemoryPairsSymbol[] {
  const unique = uniqueVariants(variants);
  const fresh = avoid
    ? unique.filter((variant) => symbolSetKey(variant) !== avoid)
    : unique;
  const pool = fresh.length > 0 ? fresh : unique;
  return pool[Math.floor(Math.random() * pool.length)]!.map((symbol) => ({
    ...symbol,
  }));
}

function resolveCategory(
  setting: MemoryPairsCategorySetting,
  avoid: MemoryPairsCategory | null,
): MemoryPairsCategory {
  if (setting !== 'mixed') return setting;
  const all: MemoryPairsCategory[] = ['colored', 'black', 'letters', 'digits'];
  const pool = avoid ? all.filter((category) => category !== avoid) : all;
  const choices = pool.length > 0 ? pool : all;
  return choices[Math.floor(Math.random() * choices.length)]!;
}

function placePairs(
  symbols: readonly MemoryPairsSymbol[],
  avoidLayout: string | null,
): MemoryPairsSymbol[] {
  const copies = symbols.flatMap((symbol) => [symbol, { ...symbol }]);
  let layout = shuffle(copies);
  for (let attempt = 0; attempt < 12 && layoutKeyFromSymbols(layout) === avoidLayout; attempt += 1) {
    layout = shuffle(copies);
  }
  return layout;
}

/**
 * Build a new board. Each chosen symbol is placed exactly twice.
 * Difficulty is the table value for this grid and the category actually dealt.
 * It is not used to pick the symbols.
 */
export function dealMemoryPairsGame(
  settings: MemoryPairsSettings,
  previous: MemoryPairsMemory,
): MemoryPairsGame {
  const category = resolveCategory(settings.category, previous.lastCategory);
  const pairs = gridPairs(settings.grid);
  const chosen = pickVariant(symbolVariants(category, pairs), previous.lastSymbolSet);
  const layout = placePairs(chosen, previous.lastLayoutKey);
  const id = crypto.randomUUID();
  return {
    schemaVersion: MEMORY_PAIRS_SCHEMA,
    id,
    createdAt: new Date().toISOString(),
    grid: settings.grid,
    difficulty: classifyMemoryPairsDifficulty(settings.grid, category),
    categorySetting: settings.category,
    category,
    cards: layout.map((symbol, index) => ({
      instanceId: `${id}-${index}`,
      symbol,
    })),
    matchedInstanceIds: [],
    openInstanceIds: [],
    attempts: 0,
    mismatches: 0,
    status: 'in_progress',
    completedAt: null,
  };
}
