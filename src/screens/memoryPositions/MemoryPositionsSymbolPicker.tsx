import { useRef } from 'react';
import type { MemoryPositionsGame } from '../../memoryPositions/types';
import { SymbolFace } from './SymbolFace';

interface MemoryPositionsSymbolPickerProps {
  game: MemoryPositionsGame;
  symbolSize: number;
  onSelect: (symbolId: string) => void;
}

export function MemoryPositionsSymbolPicker({
  game,
  symbolSize,
  onSelect,
}: MemoryPositionsSymbolPickerProps) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const placed = new Set(game.placements.map((item) => item.symbolId));
  const symbols = game.trayOrder
    .map((id) => game.symbols.find((symbol) => symbol.id === id))
    .filter((symbol) => symbol != null);

  const move = (index: number, key: string) => {
    let next = index;
    if (key === 'ArrowRight') next = index + 1;
    else if (key === 'ArrowLeft') next = index - 1;
    if (next < 0 || next >= symbols.length || next === index) return;
    buttons.current[next]?.focus();
  };

  return (
    <div className="positions-tray" role="group" aria-label="Figūras">
      {symbols.map((symbol, index) => {
        const isPlaced = placed.has(symbol.id);
        const selected = game.selectedSymbolId === symbol.id;
        return (
          <button
            key={symbol.id}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            className={[
              'positions-symbol',
              selected ? 'positions-symbol-selected' : '',
              isPlaced ? 'positions-symbol-placed' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ width: symbolSize, height: symbolSize }}
            aria-pressed={selected}
            aria-disabled={isPlaced}
            disabled={isPlaced}
            aria-label={isPlaced ? `${symbol.label}, novietota` : symbol.label}
            onClick={() => onSelect(symbol.id)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
              event.preventDefault();
              move(index, event.key);
            }}
          >
            <SymbolFace symbol={symbol} />
            {selected ? (
              <span className="positions-symbol-flag" aria-hidden="true">
                Izvēlēta
              </span>
            ) : null}
            {isPlaced ? (
              <span className="positions-symbol-flag" aria-hidden="true">
                Novietota
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
