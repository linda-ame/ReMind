import { describe, expect, it } from 'vitest';
import { acceptsLayout, figureCount, KNOWN_LAYOUTS } from './difficulty';
import {
  allPlaced,
  beginRecall,
  createGameFromSettings,
  createMemoryPositionsGame,
  finishWithHelp,
  gridCells,
  placeSymbol,
  remainingCount,
  scorePlacements,
  selectSymbol,
  submitAnswer,
  swapSymbols,
  tapCell,
} from './gameplay';
import { generateMemoryPositions } from './generate';
import { summarizeMemoryPositionsGames } from './stats';
import {
  dealKey,
  MEMORY_POSITIONS_CATEGORIES,
  MEMORY_POSITIONS_GRIDS,
  MEMORY_POSITIONS_LEVELS,
  readingOrderIds,
  type MemoryPositionsCategorySetting,
  type MemoryPositionsDifficulty,
  type MemoryPositionsGame,
  type MemoryPositionsGrid,
} from './types';

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

const SETTINGS: MemoryPositionsCategorySetting[] = [
  'colored',
  'black',
  'letters',
  'digits',
  'mixed',
];

function deal(
  grid: MemoryPositionsGrid,
  difficulty: MemoryPositionsDifficulty,
  category: MemoryPositionsCategorySetting,
  seed: number,
) {
  return generateMemoryPositions({
    grid,
    difficulty,
    category,
    random: mulberry32(seed),
  });
}

describe('figure positions generation', () => {
  it('accepts every known layout', () => {
    for (const grid of MEMORY_POSITIONS_GRIDS) {
      for (const difficulty of MEMORY_POSITIONS_LEVELS) {
        const layouts = KNOWN_LAYOUTS[`${grid}-${difficulty}`] ?? [];
        expect(layouts.length).toBeGreaterThan(0);
        for (const layout of layouts) {
          expect(acceptsLayout(layout, grid, difficulty), `${grid} ${difficulty}`).toBe(true);
        }
      }
    }
  });

  it('builds every grid, level, and symbol kind', () => {
    for (const grid of MEMORY_POSITIONS_GRIDS) {
      for (const difficulty of MEMORY_POSITIONS_LEVELS) {
        for (const category of SETTINGS) {
          const game = createGameFromSettings(
            { grid, difficulty, category },
            { random: mulberry32(grid.length * 10 + difficulty) },
          );
          expect(game.symbols).toHaveLength(figureCount(grid, difficulty));
          expect(new Set(game.symbols.map((symbol) => symbol.id)).size).toBe(game.symbols.length);
          expect(new Set(game.solution.map((item) => item.cell)).size).toBe(game.symbols.length);
          expect(new Set(game.solution.map((item) => item.symbolId)).size).toBe(
            game.symbols.length,
          );
          const cells = game.solution.map((item) => item.cell);
          expect(acceptsLayout(cells, grid, difficulty)).toBe(true);
          const kinds = new Set(game.symbols.map((symbol) => symbol.category));
          expect(kinds.size).toBe(1);
          if (category !== 'mixed') expect(game.category).toBe(category);
          else expect(MEMORY_POSITIONS_CATEGORIES).toContain(game.category);
          expect(game.trayOrder).not.toEqual(readingOrderIds(game.solution));
          expect([...game.trayOrder].sort()).toEqual(game.symbols.map((symbol) => symbol.id).sort());
        }
      }
    }
  });

  it('keeps colored figures at level 5 when that kind is chosen', () => {
    const game = createGameFromSettings(
      { grid: '4x4', difficulty: 5, category: 'colored' },
      { random: mulberry32(4) },
    );
    expect(game.category).toBe('colored');
    expect(game.symbols.every((symbol) => symbol.category === 'colored')).toBe(true);
    expect(new Set(game.symbols.map((symbol) => symbol.shape)).size).toBe(game.symbols.length);
    expect(new Set(game.symbols.map((symbol) => symbol.color)).size).toBe(game.symbols.length);
  });

  it('changes the next deal when another one exists', () => {
    const first = createGameFromSettings(
      { grid: '3x3', difficulty: 2, category: 'black' },
      { random: mulberry32(2) },
    );
    const second = createGameFromSettings(
      { grid: '3x3', difficulty: 2, category: 'black' },
      { recentKeys: [dealKey(first.solution)], random: mulberry32(9) },
    );
    expect(dealKey(second.solution)).not.toBe(dealKey(first.solution));
  });

  it('uses one category for a mixed game', () => {
    const generated = deal('2x4', 3, 'mixed', 6);
    expect(new Set(generated.symbols.map((symbol) => symbol.category)).size).toBe(1);
  });
});

function study(): MemoryPositionsGame {
  const game = createGameFromSettings(
    { grid: '2x3', difficulty: 3, category: 'colored' },
    { random: mulberry32(1), now: '2026-01-01T00:00:00.000Z' },
  );
  return game;
}

describe('figure placement', () => {
  it('hides every figure after memorizing and does not mark answers', () => {
    const game = beginRecall(study());
    expect(game.phase).toBe('recall');
    expect(game.placements).toEqual([]);
    const cells = gridCells(game);
    expect(cells.every((cell) => cell.symbol == null && cell.badge == null)).toBe(true);
    expect(cells.some((cell) => cell.label.includes('pareizi'))).toBe(false);
  });

  it('places every figure on one grid and refuses a second copy', () => {
    let game = beginRecall(study());
    const [first, second] = game.trayOrder;
    game = selectSymbol(game, first!);
    game = placeSymbol(game, first!, 0);
    game = selectSymbol(game, first!);
    expect(game.selectedSymbolId).toBeNull();
    const again = placeSymbol(game, first!, 1);
    expect(again.placements.filter((item) => item.symbolId === first)).toHaveLength(1);
    expect(again.placements.find((item) => item.symbolId === first)?.cell).toBe(1);
    game = selectSymbol(again, second!);
    const blocked = placeSymbol(game, second!, 1);
    expect(blocked).toBe(game);
    expect(blocked.placements).toHaveLength(1);
  });

  it('removes a figure and can put it somewhere else', () => {
    let game = beginRecall(study());
    const symbolId = game.trayOrder[0]!;
    game = placeSymbol(selectSymbol(game, symbolId), symbolId, 0);
    const removed = tapCell(game, 0).game;
    expect(removed.placements).toEqual([]);
    const moved = placeSymbol(selectSymbol(removed, symbolId), symbolId, 4);
    expect(moved.placements).toEqual([{ symbolId, cell: 4 }]);
  });

  it('swaps into an occupied cell instead of erasing it quietly', () => {
    let game = beginRecall(study());
    const [first, second] = game.trayOrder;
    game = placeSymbol(selectSymbol(game, first!), first!, 0);
    game = selectSymbol(game, second!);
    const tapped = tapCell(game, 0);
    expect(tapped.occupied).toBe(true);
    expect(tapped.game.placements).toEqual(game.placements);
    const swapped = swapSymbols(game, second!, 0);
    expect(swapped.placements).toEqual([{ symbolId: second, cell: 0 }]);
    expect(swapped.placements.some((item) => item.symbolId === first)).toBe(false);
  });

  it('scores an exact layout and a partial one', () => {
    const game = beginRecall(study());
    const correct = game.solution.map((item) => ({ ...item }));
    const right = submitAnswer({ ...game, placements: correct });
    expect(right.exact).toBe(true);
    expect(right.correctCount).toBe(game.totalCount);
    expect(right.phase).toBe('result');

    const wrong = [...correct];
    const a = wrong[0]!;
    const b = wrong[1]!;
    wrong[0] = { symbolId: a.symbolId, cell: b.cell };
    wrong[1] = { symbolId: b.symbolId, cell: a.cell };
    const scored = scorePlacements({ ...game, placements: wrong });
    expect(scored.correct).toBe(game.totalCount - 2);
    expect(scored.exact).toBe(false);
    const submitted = submitAnswer({ ...game, placements: wrong });
    expect(submitted.exact).toBe(false);
    expect(submitted.correctCount).toBe(game.totalCount - 2);
    const compared = gridCells(submitted);
    const swappedCell = compared.find((cell) => cell.split && cell.symbol?.id === a.symbolId);
    expect(swappedCell?.expected?.id).toBe(b.symbolId);
    expect(swappedCell?.label).toContain('tu novietoji');
    expect(swappedCell?.label).toContain('jābūt');
    expect(compared.some((cell) => cell.label.includes('pareizi') && !cell.split)).toBe(true);
    expect(gridCells(game).some((cell) => cell.split || cell.label.includes('jābūt'))).toBe(
      false,
    );
  });

  it('marks a figure in an empty cell without splitting it', () => {
    const game = beginRecall(study());
    const [home] = game.solution;
    const empty = [0, 1, 2, 3, 4, 5].find(
      (cell) => !game.solution.some((item) => item.cell === cell),
    );
    const placements = game.solution.map((item) =>
      item.symbolId === home!.symbolId ? { symbolId: item.symbolId, cell: empty! } : { ...item },
    );
    const cells = gridCells(submitAnswer({ ...game, placements }));
    const occupied = cells[empty!];
    const missed = cells[home!.cell];
    expect(occupied?.split).toBe(false);
    expect(occupied?.badge).toBe('wrong');
    expect(occupied?.symbol?.id).toBe(home!.symbolId);
    expect(occupied?.expected).toBeNull();
    expect(occupied?.label).toContain('jābūt tukšai');
    expect(missed?.split).toBe(false);
    expect(missed?.answer).toBe(true);
    expect(missed?.badge).toBeNull();
    expect(missed?.symbol?.id).toBe(home!.symbolId);
    expect(missed?.label).toContain('tu atstāji tukšu');
  });

  it('marks help as finished, not as a correct solution', () => {
    const game = beginRecall(study());
    const helped = finishWithHelp({
      ...game,
      placements: game.solution.map((item) => ({ ...item })),
    });
    expect(helped.usedHelp).toBe(true);
    expect(helped.exact).toBe(false);
    expect(helped.status).toBe('completed');
    expect(helped.correctCount).toBe(game.totalCount);
    expect(allPlaced(game)).toBe(false);
    expect(remainingCount(game)).toBe(game.symbols.length);
  });

  it('needs every figure before a check is allowed', () => {
    const game = beginRecall(study());
    expect(submitAnswer(game)).toBe(game);
  });
});

describe('figure position stats', () => {
  it('keeps different grids in different groups', () => {
    const narrowSource = createGameFromSettings(
      { grid: '2x3', difficulty: 1, category: 'letters' },
      { random: mulberry32(3), now: '2026-02-01T00:00:00.000Z' },
    );
    const small = submitAnswer({
      ...beginRecall(narrowSource),
      placements: narrowSource.solution.map((item) => ({ ...item })),
    });
    const filled = createGameFromSettings(
      { grid: '4x4', difficulty: 5, category: 'digits' },
      { random: mulberry32(8), now: '2026-02-02T00:00:00.000Z' },
    );
    const large = submitAnswer({
      ...beginRecall(filled),
      placements: filled.solution.map((item) => ({ ...item })),
    });
    const middle = createGameFromSettings(
      { grid: '3x3', difficulty: 3, category: 'colored' },
      { random: mulberry32(5), now: '2026-02-03T00:00:00.000Z' },
    );
    const helped = finishWithHelp(beginRecall(middle));
    const groups = summarizeMemoryPositionsGames([small, large, helped], {
      grid: 'all',
      difficulty: 'all',
      category: 'all',
    });
    expect(groups.map((group) => group.grid)).toEqual(['2x3', '3x3', '4x4']);
    const wide = groups.find((group) => group.grid === '4x4');
    const narrow = groups.find((group) => group.grid === '2x3');
    expect(wide?.exact).toBe(1);
    expect(wide?.figureTotal).toBe(large.totalCount);
    expect(narrow?.figureTotal).not.toBe(wide?.figureTotal);
    expect(groups.find((group) => group.grid === '3x3')?.helped).toBe(1);
    expect(groups.find((group) => group.grid === '3x3')?.exact).toBe(0);
  });
});

describe('a recalled board', () => {
  it('shows the study figures and then an empty grid', () => {
    const source = createMemoryPositionsGame(
      { grid: '2x3', difficulty: 1, category: 'black' },
      {
        category: 'black',
        symbols: [
          {
            id: 'black:circle',
            category: 'black',
            label: 'Melns aplis',
            kind: 'shape',
            shape: 'circle',
            color: '#161616',
          },
          {
            id: 'black:star',
            category: 'black',
            label: 'Melna zvaigzne',
            kind: 'shape',
            shape: 'star',
            color: '#161616',
          },
        ],
        solution: [
          { symbolId: 'black:circle', cell: 1 },
          { symbolId: 'black:star', cell: 3 },
        ],
        trayOrder: ['black:star', 'black:circle'],
      },
    );
    const studyCells = gridCells(source);
    expect(studyCells.find((cell) => cell.index === 1)?.symbol?.label).toBe('Melns aplis');
    expect(studyCells.find((cell) => cell.index === 0)?.symbol).toBeNull();
    expect(gridCells(beginRecall(source)).every((cell) => cell.symbol == null)).toBe(true);
  });
});
