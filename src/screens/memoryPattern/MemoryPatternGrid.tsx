import { useRef } from 'react';
import type { PatternCellModel } from '../../memoryPattern/gameplay';

const MARK: Record<NonNullable<PatternCellModel['mark']>, string> = {
  dot: '●',
  correct: '✓',
  missed: '●',
  extra: '✕',
};

interface MemoryPatternGridProps {
  cells: PatternCellModel[];
  columns: number;
  cellSize: number;
  onToggle?: (index: number) => void;
}

export function MemoryPatternGrid({
  cells,
  columns,
  cellSize,
  onToggle,
}: MemoryPatternGridProps) {
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
      className="pattern-grid"
      role="group"
      aria-label="Rūtiņu režģis"
      style={{
        gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${rowCount}, ${cellSize}px)`,
      }}
    >
      {cells.map((cell) => {
        const className = [
          'pattern-cell',
          cell.filled ? 'pattern-cell-filled' : 'pattern-cell-empty',
          cell.mark ? `pattern-cell-${cell.mark}` : '',
        ]
          .filter(Boolean)
          .join(' ');
        const mark = cell.mark ? MARK[cell.mark] : null;
        if (!cell.interactive) {
          return (
            <div
              key={cell.index}
              className={className}
              role="img"
              aria-label={cell.label}
            >
              {mark ? (
                <span className="pattern-mark" aria-hidden="true">
                  {mark}
                </span>
              ) : null}
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
            aria-pressed={cell.filled}
            aria-label={cell.label}
            onClick={() => onToggle?.(cell.index)}
            onKeyDown={(event) => {
              if (!event.key.startsWith('Arrow')) return;
              event.preventDefault();
              move(cell.index, event.key);
            }}
          >
            {mark ? (
              <span className="pattern-mark" aria-hidden="true">
                {mark}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
