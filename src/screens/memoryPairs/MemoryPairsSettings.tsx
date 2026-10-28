import { useState } from 'react';
import { Button } from '../../components/Button';
import { Layout } from '../../components/Layout';
import type { Screen } from '../../navigation/types';
import {
  MEMORY_PAIRS_CATEGORY_LABEL,
  gridLabel,
  gridPairs,
  type MemoryPairsCategorySetting,
  type MemoryPairsGrid,
  type MemoryPairsSettings as Settings,
} from '../../memoryPairs/types';

const GRIDS: MemoryPairsGrid[] = ['2x3', '2x4', '3x4', '4x4'];
const CATEGORIES: MemoryPairsCategorySetting[] = [
  'colored',
  'black',
  'letters',
  'digits',
  'mixed',
];

interface MemoryPairsSettingsProps {
  initial: Settings;
  unfinished: boolean;
  onHome: () => void;
  onNavigate: (screen: Screen) => void;
  onStartNew: (settings: Settings) => void;
  onContinue: (settings: Settings) => void;
}

export function MemoryPairsSettings({
  initial,
  unfinished,
  onHome,
  onNavigate,
  onStartNew,
  onContinue,
}: MemoryPairsSettingsProps) {
  const [draft, setDraft] = useState<Settings>(initial);

  const actions = unfinished ? (
    <div className="pairs-settings-actions">
      <Button variant="primary" onClick={() => onContinue(draft)}>
        Turpināt esošo spēli
      </Button>
      <Button variant="secondary" onClick={() => onStartNew(draft)}>
        Sākt jaunu spēli
      </Button>
    </div>
  ) : (
    <Button variant="primary" onClick={() => onStartNew(draft)}>
      Sākt spēli
    </Button>
  );

  return (
    <Layout
      onHome={onHome}
      onNavigate={onNavigate}
      sectionType="memory_pairs"
    >
      <div className="pairs-screen">
        {unfinished ? (
          <p className="pairs-note">
            Ir nepabeigta spēle. Vari turpināt vai sākt jaunu.
          </p>
        ) : null}

        <div className="pairs-field" role="group" aria-labelledby="pairs-grid-label">
          <h2 id="pairs-grid-label" className="pairs-field-title">
            Režģa izmērs
          </h2>
          {GRIDS.map((grid) => {
            const selected = draft.grid === grid;
            return (
              <Button
                key={grid}
                variant={selected ? 'selected' : 'secondary'}
                aria-pressed={selected}
                onClick={() => setDraft((current) => ({ ...current, grid }))}
              >
                {selected ? <span aria-hidden="true">✓ </span> : null}
                {gridLabel(grid)} · {gridPairs(grid)} pāri
              </Button>
            );
          })}
        </div>

        <div className="pairs-field" role="group" aria-labelledby="pairs-kind-label">
          <h2 id="pairs-kind-label" className="pairs-field-title">
            Kartīšu veids
          </h2>
          {CATEGORIES.map((category) => {
            const selected = draft.category === category;
            return (
              <Button
                key={category}
                variant={selected ? 'selected' : 'secondary'}
                aria-pressed={selected}
                onClick={() => setDraft((current) => ({ ...current, category }))}
              >
                {selected ? <span aria-hidden="true">✓ </span> : null}
                {MEMORY_PAIRS_CATEGORY_LABEL[category]}
              </Button>
            );
          })}
        </div>

        {actions}
      </div>
    </Layout>
  );
}
