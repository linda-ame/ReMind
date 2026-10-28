import { Button } from '../../components/Button';

interface MemoryPairsResultsProps {
  pairs: number;
  attempts: number;
  onNext: () => void;
}

function pairsText(pairs: number): string {
  return pairs === 1 ? '1 pāris' : `${pairs} pāri`;
}

function attemptsText(attempts: number): string {
  return attempts === 1 ? '1 mēģinājums' : `${attempts} mēģinājumi`;
}

export function MemoryPairsResults({
  pairs,
  attempts,
  onNext,
}: MemoryPairsResultsProps) {
  return (
    <div className="pairs-results" role="status">
      <h2 className="pairs-results-title">Visi pāri atrasti!</h2>
      <p>{pairsText(pairs)}</p>
      <p>{attemptsText(attempts)}</p>
      <Button variant="primary" onClick={onNext}>
        Nākamā spēle
      </Button>
    </div>
  );
}
