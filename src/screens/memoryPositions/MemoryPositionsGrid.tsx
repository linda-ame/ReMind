import { useRef } from 'react';
import type { PositionCellModel } from '../../memoryPositions/gameplay';
import { SymbolFace } from './SymbolFace';

const BADGE: Record<NonNullable<PositionCellModel['badge']>, string> = {
  correct: '✓',
  wrong: '✕',
};

interface MemoryPositionsGridProps {
  cells: PositionCellModel[];
  columns: number;
  cellSize: number;
  onCell?: (index: number) => void;
}

export function MemoryPositionsGrid({
  cells,
  columns,
  cellSize,
  onCell,
}: MemoryPositionsGridProps) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const rowCount = Math.max(1, Math.ceil(cells.length / columns));

  const move = (index: number, key: string) => {
    let next = index;
    if (key === 'ArrowRight') next = index + 1;
    else if (key === 'ArrowLeft') next = index - 1;
    else if (key === 'ArrowDown') next = index + columns;
    else if (key === 'ArrowUp') next = index - columns;
    if (next < 0 || next >= cells.length || next === index) return;
    buttons.current[next]?.focus();
  };

  return (
    <div
      className="positions-grid"
      role="group"
      aria-label="Figūru režģis"
      style={{
        gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${rowCount}, ${cellSize}px)`,
      }}
    >
      {cells.map((cell) => {
        const className = [
          'positions-cell',
          cell.split || cell.symbol ? 'positions-cell-filled' : 'positions-cell-empty',
          cell.split ? 'positions-cell-split' : '',
          cell.answer ? 'positions-cell-answer' : '',
          !cell.split && cell.badge ? `positions-cell-${cell.badge}` : '',
        ]
          .filter(Boolean)
          .join(' ');
        const badge = !cell.split && cell.badge ? BADGE[cell.badge] : null;
        const body = cell.split ? (
          <div className="positions-split">
            <div className="positions-split-band positions-split-yours">
              {cell.symbol ? <SymbolFace symbol={cell.symbol} /> : null}
              <span className="positions-badge" aria-hidden="true">
                ✕
              </span>
            </div>
            <div className="positions-split-band positions-split-expected">
              {cell.expected ? <SymbolFace symbol={cell.expected} /> : null}
            </div>
          </div>
        ) : (
          <>
            {cell.symbol ? <SymbolFace symbol={cell.symbol} /> : null}
            {badge ? (
              <span className="positions-badge" aria-hidden="true">
                {badge}
              </span>
            ) : null}
          </>
        );
        if (!cell.interactive) {
          return (
            <div key={cell.index} className={className} role="img" aria-label={cell.label}>
              {body}
            </div>
          );
        }
        return (
          <button
            key={cell.index}
            ref={(element) => {
              buttons.current[cell.index] = element;
            }}
            type="button"
            className={className}
            aria-label={cell.label}
            onClick={() => onCell?.(cell.index)}
            onKeyDown={(event) => {
              if (!event.key.startsWith('Arrow')) return;
              event.preventDefault();
              move(cell.index, event.key);
            }}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}
