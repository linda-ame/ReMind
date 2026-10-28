import { ShapeIcon } from '../../memoryPairs/ShapeIcon';
import { isShapeId } from '../../memoryPairs/types';
import type { MemoryPositionsSymbol } from '../../memoryPositions/types';

export function SymbolFace({ symbol }: { symbol: MemoryPositionsSymbol }) {
  if ((symbol.kind === 'letter' || symbol.kind === 'digit') && symbol.text) {
    return <span className="positions-glyph">{symbol.text}</span>;
  }
  if (symbol.shape && isShapeId(symbol.shape)) {
    return (
      <span className="positions-face">
        <ShapeIcon
          shape={symbol.shape}
          color={symbol.color ?? '#161616'}
          outlined={symbol.category === 'colored'}
        />
      </span>
    );
  }
  return <span className="positions-glyph">{symbol.label}</span>;
}
