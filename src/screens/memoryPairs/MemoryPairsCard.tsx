import type { KeyboardEvent } from 'react';
import { ShapeIcon } from '../../memoryPairs/ShapeIcon';
import { isShapeId, type MemoryPairsDealtCard } from '../../memoryPairs/types';

interface MemoryPairsCardProps {
  card: MemoryPairsDealtCard;
  faceUp: boolean;
  matched: boolean;
  row: number;
  column: number;
  onOpen: (instanceId: string) => void;
  onArrow: (key: string) => void;
  buttonRef: (element: HTMLButtonElement | null) => void;
}

function SymbolFace({ card }: { card: MemoryPairsDealtCard }) {
  const { symbol } = card;
  if ((symbol.kind === 'letter' || symbol.kind === 'digit') && symbol.text) {
    return <span className="pairs-glyph-text">{symbol.text}</span>;
  }
  if (symbol.shape && isShapeId(symbol.shape)) {
    return (
      <ShapeIcon
        shape={symbol.shape}
        color={symbol.color ?? '#161616'}
        outlined={symbol.category === 'colored'}
      />
    );
  }
  return <span className="pairs-glyph-text">{symbol.label}</span>;
}

export function MemoryPairsCard({
  card,
  faceUp,
  matched,
  row,
  column,
  onOpen,
  onArrow,
  buttonRef,
}: MemoryPairsCardProps) {
  const place = `Rinda ${row}, kolonna ${column}.`;
  const label = matched
    ? `Atrasts pāris: ${card.symbol.label}. ${place}`
    : faceUp
      ? `Atvērta kartīte: ${card.symbol.label}. ${place}`
      : `Aizklāta kartīte. ${place}`;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (
      event.key === 'ArrowRight' ||
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp'
    ) {
      event.preventDefault();
      onArrow(event.key);
    }
  };

  return (
    <button
      type="button"
      className={`pairs-card${faceUp ? ' pairs-card-up' : ''}${matched ? ' pairs-card-matched' : ''}`}
      aria-label={label}
      aria-pressed={faceUp}
      data-instance={card.instanceId}
      ref={buttonRef}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(card.instanceId);
      }}
      onKeyDown={onKeyDown}
    >
      {faceUp ? (
        <span className="pairs-symbol">
          <SymbolFace card={card} />
        </span>
      ) : (
        <svg className="pairs-back-mark" viewBox="0 0 100 100" aria-hidden="true">
          <rect
            x="22"
            y="22"
            width="56"
            height="56"
            rx="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
          />
        </svg>
      )}
      {matched ? (
        <span className="pairs-found" aria-hidden="true">
          ✓
        </span>
      ) : null}
    </button>
  );
}
