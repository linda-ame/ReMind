import { describe, expect, it } from 'vitest';
import { acceptsPattern, patternShape } from './difficulty';
import { generatePattern } from './generate';
import {
  beginRecall,
  createMemoryPatternGame,
  patternCells,
  scorePattern,
  settingsStartLabel,
  submitAnswer,
  toggleCell,
} from './gameplay';
import { patternCellSize } from './layout';
import { summarizeMemoryPatternGames } from './stats';
import {
  GRID_SPEC,
  MEMORY_PATTERN_GRIDS,
  MEMORY_PATTERN_LEVELS,
  patternKey,
  type MemoryPatternDifficulty,
  type MemoryPatternGame,
  type MemoryPatternGrid,
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

function sample(
  grid: MemoryPatternGrid,
  difficulty: MemoryPatternDifficulty,
  seed: number,
): number[] {
  return generatePattern({
    grid,
    difficulty,
    recentKeys: [],
    random: mulberry32(seed),
  });
}

describe('pattern generation', () => {
  it('builds every grid size and every difficulty', () => {
    for (const grid of MEMORY_PATTERN_GRIDS) {
      for (const difficulty of MEMORY_PATTERN_LEVELS) {
        const pattern = sample(grid, difficulty, 7);
        expect(acceptsPattern(pattern, grid, difficulty)).toBe(true);
      }
    }
  });

  it('never builds an empty or completely filled grid', () => {
    for (const grid of MEMORY_PATTERN_GRIDS) {
      for (const difficulty of MEMORY_PATTERN_LEVELS) {
        for (let seed = 1; seed <= 12; seed += 1) {
          const pattern = sample(grid, difficulty, seed);
          expect(pattern.length).toBeGreaterThan(0);
          expect(pattern.length).toBeLessThan(GRID_SPEC[grid].cells);
        }
      }
    }
  });

  it('uses only real cell indexes', () => {
    for (const grid of MEMORY_PATTERN_GRIDS) {
      const pattern = sample(grid, 3, 4);
      const cells = GRID_SPEC[grid].cells;
      expect(new Set(pattern).size).toBe(pattern.length);
      for (const index of pattern) {
        expect(Number.isInteger(index)).toBe(true);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(cells);
      }
    }
  });

  it('keeps level 1 compact and level 5 irregular', () => {
    for (const grid of MEMORY_PATTERN_GRIDS) {
      const easy = patternShape(sample(grid, 1, 2), grid);
      expect(easy.groups).toBe(1);
      expect(easy.compact).toBe(true);

      const hard = patternShape(sample(grid, 5, 9), grid);
      expect(hard.groups).toBeGreaterThanOrEqual(2);
      expect(hard.separated).toBe(true);
      expect(hard.symmetric).toBe(false);
      expect(hard.straightLine).toBe(false);
      expect(hard.empty).toBeGreaterThanOrEqual(2);
    }
  });

  it('skips a pattern that was just used when another one exists', () => {
    const first = sample('4x4', 1, 3);
    const second = generatePattern({
      grid: '4x4',
      difficulty: 1,
      recentKeys: [patternKey(first)],
      random: mulberry32(3),
    });
    expect(patternKey(second)).not.toBe(patternKey(first));
  });
});

describe('play and scoring', () => {
  const pattern = [0, 1, 2, 3, 4];

  function recallGame(selected: number[]): MemoryPatternGame {
    return {
      ...createMemoryPatternGame({ grid: '3x4', difficulty: 3 }, pattern),
      phase: 'recall',
      selected,
    };
  }

  it('keeps the same pattern through a phase', () => {
    const game = createMemoryPatternGame({ grid: '2x3', difficulty: 1 }, [0, 3]);
    const recalled = beginRecall(game);
    const marked = toggleCell(recalled, 3);
    expect(recalled.pattern).toBe(game.pattern);
    expect(marked.pattern).toBe(game.pattern);
    expect(marked.pattern).toEqual([0, 3]);
  });

  it('does not let the person change the pattern while memorizing', () => {
    const game = createMemoryPatternGame({ grid: '2x3', difficulty: 1 }, [0, 1]);
    expect(toggleCell(game, 4)).toBe(game);
    expect(patternCells(game).every((cell) => !cell.interactive)).toBe(true);
  });

  it('hides the original pattern after memorizing', () => {
    const game = beginRecall(
      createMemoryPatternGame({ grid: '2x3', difficulty: 1 }, [0, 1]),
    );
    const cells = patternCells(game);
    expect(cells.every((cell) => !cell.filled)).toBe(true);
    expect(cells.every((cell) => !cell.label.includes('iekrāsota'))).toBe(true);
    expect(cells.every((cell) => !cell.label.includes('pareizi'))).toBe(true);
  });

  it('marks a cell and clears it on the next press', () => {
    const game = beginRecall(
      createMemoryPatternGame({ grid: '2x4', difficulty: 2 }, [0, 1, 2]),
    );
    const marked = toggleCell(game, 5);
    expect(marked.selected).toEqual([5]);
    expect(patternCells(marked)[5]?.filled).toBe(true);
    expect(patternCells(marked)[5]?.label).toContain('atzīmēta');
    const cleared = toggleCell(marked, 5);
    expect(cleared.selected).toEqual([]);
    expect(patternCells(cleared)[5]?.filled).toBe(false);
  });

  it('does not reveal the answer before checking', () => {
    const hidden = beginRecall(
      createMemoryPatternGame({ grid: '3x3', difficulty: 2 }, [0, 4, 8]),
    );
    const other = beginRecall(
      createMemoryPatternGame({ grid: '3x3', difficulty: 2 }, [1, 2, 3]),
    );
    const marked = toggleCell(hidden, 1);
    const otherMarked = toggleCell(other, 1);
    expect(patternCells(marked).map((cell) => cell.filled)).toEqual(
      patternCells(otherMarked).map((cell) => cell.filled),
    );
    expect(patternCells(marked).every((cell) => cell.mark !== 'correct')).toBe(true);
  });

  it('counts an exact pattern as correct', () => {
    const score = scorePattern(pattern, pattern, 12);
    expect(score).toMatchObject({ correct: 5, missed: 0, extra: 0, exact: true });
    expect(submitAnswer(recallGame(pattern)).exact).toBe(true);
  });

  it('counts missed cells, extra cells, and partial answers', () => {
    const selected = [0, 1, 2, 3, 5, 6];
    const score = scorePattern(pattern, selected, 12);
    expect(score).toMatchObject({ correct: 4, missed: 1, extra: 2, exact: false });
    const finished = submitAnswer(recallGame(selected));
    expect(finished.correctCount).toBe(4);
    expect(finished.missedCount).toBe(1);
    expect(finished.extraCount).toBe(2);
    expect(finished.exact).toBe(false);
    expect(finished.status).toBe('completed');
    const cells = patternCells(finished);
    expect(cells[4]?.mark).toBe('missed');
    expect(cells[5]?.mark).toBe('extra');
    expect(cells[0]?.mark).toBe('correct');
  });

  it('names the settings actions', () => {
    expect(settingsStartLabel(false)).toBe('Sākt spēli');
    expect(settingsStartLabel(true)).toBe('Saglabāt un sākt jaunu spēli');
  });
});

describe('cell size', () => {
  it('keeps 4×4 cells tappable in both tablet orientations', () => {
    const landscape = patternCellSize({
      columns: 4,
      rows: 4,
      availableWidth: 980,
      availableHeight: 520,
      contentScale: 1,
    });
    const portrait = patternCellSize({
      columns: 4,
      rows: 4,
      availableWidth: 700,
      availableHeight: 860,
      contentScale: 1,
    });
    const cramped = patternCellSize({
      columns: 4,
      rows: 4,
      availableWidth: 250,
      availableHeight: 220,
      contentScale: 1,
    });
    expect(landscape).toBeGreaterThanOrEqual(64);
    expect(portrait).toBeGreaterThanOrEqual(64);
    expect(cramped).toBe(64);
    expect(landscape).toBeLessThanOrEqual(168);
  });
});

describe('progress groups', () => {
  it('does not merge cell counts from different grids', () => {
    const small = submitAnswer({
      ...createMemoryPatternGame({ grid: '2x3', difficulty: 1 }, [0, 1]),
      phase: 'recall',
      selected: [0, 1],
    });
    const large = submitAnswer({
      ...createMemoryPatternGame({ grid: '4x4', difficulty: 5 }, [0, 3, 6, 9, 12, 15]),
      phase: 'recall',
      selected: [0, 3, 6],
    });
    const groups = summarizeMemoryPatternGames([small, large], {
      grid: 'all',
      difficulty: 'all',
    });
    expect(groups).toHaveLength(2);
    expect(groups[0]?.correctCells).toBe(2);
    expect(groups[1]?.correctCells).toBe(3);
    expect(groups[0]?.correctCells).not.toBe(groups[1]?.correctCells);
  });
});
