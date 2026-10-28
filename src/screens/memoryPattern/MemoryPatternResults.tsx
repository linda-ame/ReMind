import type { Ref } from 'react';
import { patternCells } from '../../memoryPattern/gameplay';
import type { MemoryPatternGame } from '../../memoryPattern/types';
import { MemoryPatternGrid } from './MemoryPatternGrid';

interface MemoryPatternResultsProps {
  game: MemoryPatternGame;
  cellSize: number;
  showHint?: boolean;
  wrapRef?: Ref<HTMLDivElement>;
}

export function MemoryPatternResults({
  game,
  cellSize,
  showHint = false,
  wrapRef,
}: MemoryPatternResultsProps) {
  return (
    <div className="pattern-results">
      {showHint ? (
        <ul className="pattern-legend">
          <li>
            <span className="pattern-swatch pattern-swatch-correct" aria-hidden="true" />
            Zaļa — pareizi
          </li>
          <li>
            <span className="pattern-swatch pattern-swatch-extra" aria-hidden="true" />
            Sarkana — nepareizi novietota
          </li>
        </ul>
      ) : null}
      <div className="pattern-grid-wrap" ref={wrapRef}>
        <MemoryPatternGrid
          cells={patternCells(game)}
          columns={game.cols}
          cellSize={cellSize}
        />
      </div>
    </div>
  );
}
