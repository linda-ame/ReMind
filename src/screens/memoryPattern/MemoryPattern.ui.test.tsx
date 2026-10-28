import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  beginRecall,
  createMemoryPatternGame,
  patternCells,
  toggleCell,
} from '../../memoryPattern/gameplay';
import type { MemoryPatternGame } from '../../memoryPattern/types';
import { MemoryPatternGrid } from './MemoryPatternGrid';
import { MemoryPatternSettingsForm } from './MemoryPatternSettings';

function RecallHarness({ initial }: { initial: MemoryPatternGame }) {
  const [game, setGame] = useState(initial);
  return (
    <MemoryPatternGrid
      cells={patternCells(game)}
      columns={game.cols}
      cellSize={80}
      onToggle={(index) => setGame((current) => toggleCell(current, index))}
    />
  );
}

afterEach(() => {
  cleanup();
});

function pressed(name: RegExp | string): string | null {
  return screen.getByRole('button', { name }).getAttribute('aria-pressed');
}

describe('pattern screen', () => {
  it('shows the study pattern and then an empty grid', () => {
    const study = createMemoryPatternGame({ grid: '2x3', difficulty: 1 }, [0, 1]);
    const { rerender } = render(
      <MemoryPatternGrid cells={patternCells(study)} columns={3} cellSize={80} />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(
      screen.getByRole('img', { name: '1. rinda, 1. kolonna, iekrāsota' }),
    ).toBeTruthy();

    rerender(
      <MemoryPatternGrid
        cells={patternCells(beginRecall(study))}
        columns={3}
        cellSize={80}
        onToggle={() => undefined}
      />,
    );
    expect(screen.queryByRole('img', { name: /iekrāsota/ })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(6);
    expect(
      screen.getByRole('button', { name: '1. rinda, 1. kolonna, nav atzīmēta' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /pareizi/ })).toBeNull();
  });

  it('marks and unmarks a cell without revealing the answer', () => {
    const study = beginRecall(
      createMemoryPatternGame({ grid: '2x3', difficulty: 1 }, [0, 4]),
    );
    render(<RecallHarness initial={study} />);
    const cell = screen.getByRole('button', {
      name: '2. rinda, 2. kolonna, nav atzīmēta',
    });
    fireEvent.click(cell);
    expect(
      screen.getByRole('button', { name: '2. rinda, 2. kolonna, atzīmēta' }).getAttribute(
        'aria-pressed',
      ),
    ).toBe('true');
    fireEvent.click(
      screen.getByRole('button', { name: '2. rinda, 2. kolonna, atzīmēta' }),
    );
    expect(
      screen
        .getByRole('button', { name: '2. rinda, 2. kolonna, nav atzīmēta' })
        .getAttribute('aria-pressed'),
    ).toBe('false');
    expect(screen.queryByRole('button', { name: /pareizi|iekrāsota/ })).toBeNull();
  });

  it('opens the saved choices and asks before replacing a game', () => {
    const onStart = vi.fn();
    const onContinue = vi.fn();
    render(
      <MemoryPatternSettingsForm
        initial={{ grid: '2x3', difficulty: 1 }}
        configured={false}
        unfinished={false}
        onStart={onStart}
        onContinue={onContinue}
      />,
    );
    expect(screen.getByRole('button', { name: 'Sākt spēli' })).toBeTruthy();
    expect(pressed(/2×3 — 6 rūtiņas/)).toBe('true');
    expect(pressed('1. līmenis')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: /4×4 — 16 rūtiņas/ }));
    fireEvent.click(screen.getByRole('button', { name: '5. līmenis' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sākt spēli' }));
    expect(onStart).toHaveBeenCalledWith({ grid: '4x4', difficulty: 5 });

    cleanup();
    render(
      <MemoryPatternSettingsForm
        initial={{ grid: '3x4', difficulty: 4 }}
        configured
        unfinished
        onStart={onStart}
        onContinue={onContinue}
      />,
    );
    expect(pressed(/3×4 — 12 rūtiņas/)).toBe('true');
    expect(pressed('4. līmenis')).toBe('true');
    fireEvent.click(
      screen.getByRole('button', { name: 'Saglabāt un sākt jaunu spēli' }),
    );
    expect(screen.getByRole('button', { name: 'Turpināt esošo spēli' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sākt jaunu spēli' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Turpināt esošo spēli' }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
