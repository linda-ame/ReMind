import type { MemoryPositionsGame } from '../../memoryPositions/types';

interface MemoryPositionsResultsProps {
  game: MemoryPositionsGame;
  showKey: boolean;
}

export function MemoryPositionsResults({ game, showKey }: MemoryPositionsResultsProps) {
  const correct = game.correctCount ?? 0;
  const total = game.totalCount;
  return (
    <div className="positions-results">
      <p className="positions-score">
        Pareizi novietotas: {correct} no {total}
      </p>
      {game.usedHelp ? (
        <p className="positions-note">
          Izmantota palīdzība. Nav skaitīta kā pareizi atrisināta.
        </p>
      ) : null}
      {showKey ? (
        <p className="positions-note">
          ✓ pareizi. ✕ nepareizi. Sadalītajā rūtiņā apakšā ir pareizā figūra.
        </p>
      ) : null}
    </div>
  );
}
