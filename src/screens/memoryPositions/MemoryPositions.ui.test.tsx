import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  beginRecall,
  createMemoryPositionsGame,
  gridCells,
  selectSymbol,
  tapCell,
} from '../../memoryPositions/gameplay';
import type { MemoryPositionsGame } from '../../memoryPositions/types';
import { MemoryPositionsGrid } from './MemoryPositionsGrid';
import { MemoryPositionsSettingsForm } from './MemoryPositionsSettings';
import { MemoryPositionsSymbolPicker } from './MemoryPositionsSymbolPicker';

const game = createMemoryPositionsGame(
  { grid: '2x3', difficulty: 1, category: 'letters' },
  {
    category: 'letters',
    symbols: [
      { id: 'letter:A', category: 'letters', label: 'Burts A', kind: 'letter', text: 'A' },
      { id: 'letter:K', category: 'letters', label: 'Burts K', kind: 'letter', text: 'K' },
    ],
    solution: [
      { symbolId: 'letter:A', cell: 1 },
      { symbolId: 'letter:K', cell: 3 },
    ],
    trayOrder: ['letter:K', 'letter:A'],
  },
);

function RecallHarness({ initial }: { initial: MemoryPositionsGame }) {
  const [current, setCurrent] = useState(initial);
  const [swap, setSwap] = useState(false);
  return (
    <div>
      <MemoryPositionsGrid
        cells={gridCells(current)}
        columns={current.cols}
        cellSize={88}
        onCell={(index) => {
          const result = tapCell(current, index);
          setSwap(result.occupied);
          if (!result.occupied) setCurrent(result.game);
        }}
      />
      <MemoryPositionsSymbolPicker
        game={current}
        symbolSize={88}
        onSelect={(symbolId) => setCurrent((value) => selectSymbol(value, symbolId))}
      />
      {swap ? <p>Šeit jau ir figūra.</p> : null}
    </div>
  );
}

afterEach(() => {
  cleanup();
});

describe('figure position screen', () => {
  it('shows the study figures and then an empty shared grid', () => {
    const { rerender } = render(
      <MemoryPositionsGrid cells={gridCells(game)} columns={3} cellSize={88} />,
    );
    expect(screen.getByRole('img', { name: '1. rinda, 2. kolonna, Burts A' })).toBeTruthy();
    expect(screen.getByRole('img', { name: '2. rinda, 1. kolonna, Burts K' })).toBeTruthy();
    expect(screen.getByRole('img', { name: '1. rinda, 1. kolonna, tukša' })).toBeTruthy();

    rerender(
      <MemoryPositionsGrid
        cells={gridCells(beginRecall(game))}
        columns={3}
        cellSize={88}
        onCell={() => undefined}
      />,
    );
    expect(screen.queryByRole('img', { name: /Burts/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /tukša/ })).toHaveLength(6);
    expect(screen.queryByRole('button', { name: /pareizi|nepareiza/ })).toBeNull();
  });

  it('places, removes, and refuses to erase an occupied cell', () => {
    render(<RecallHarness initial={beginRecall(game)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Burts K' }));
    expect(screen.getByRole('button', { name: 'Burts K' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: '1. rinda, 1. kolonna, tukša' }));
    expect(screen.getByRole('button', { name: '1. rinda, 1. kolonna, Burts K' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Burts K, novietota' })).toBeTruthy();
    expect(screen.queryByText(/pareizi|nepareiza/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '1. rinda, 1. kolonna, Burts K' }));
    expect(screen.getByRole('button', { name: 'Burts K' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Burts A' }));
    fireEvent.click(screen.getByRole('button', { name: '2. rinda, 1. kolonna, tukša' }));
    fireEvent.click(screen.getByRole('button', { name: 'Burts K' }));
    fireEvent.click(screen.getByRole('button', { name: '2. rinda, 1. kolonna, Burts A' }));
    expect(screen.getByText('Šeit jau ir figūra.')).toBeTruthy();
    expect(screen.getByRole('button', { name: '2. rinda, 1. kolonna, Burts A' })).toBeTruthy();
  });

  it('opens the saved choices and asks before replacing a game', () => {
    const onStart = vi.fn();
    const onContinue = vi.fn();
    render(
      <MemoryPositionsSettingsForm
        initial={{ grid: '2x3', difficulty: 1, category: 'colored' }}
        configured={false}
        unfinished={false}
        onStart={onStart}
        onContinue={onContinue}
      />,
    );
    expect(screen.getByRole('button', { name: 'Sākt spēli' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2×3' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '1. līmenis' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(
      screen.getByRole('button', { name: 'Krāsainas figūras' }).getAttribute('aria-pressed'),
    ).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: '4×4' }));
    fireEvent.click(screen.getByRole('button', { name: '5. līmenis' }));
    fireEvent.click(screen.getByRole('button', { name: 'Burti' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sākt spēli' }));
    expect(onStart).toHaveBeenCalledWith({ grid: '4x4', difficulty: 5, category: 'letters' });

    cleanup();
    render(
      <MemoryPositionsSettingsForm
        initial={{ grid: '3x3', difficulty: 2, category: 'digits' }}
        configured
        unfinished
        onStart={onStart}
        onContinue={onContinue}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Saglabāt un sākt jaunu spēli' }));
    expect(screen.getByRole('button', { name: 'Turpināt esošo spēli' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Turpināt esošo spēli' }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
