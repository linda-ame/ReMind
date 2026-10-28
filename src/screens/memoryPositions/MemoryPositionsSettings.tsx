import { useState } from 'react';
import { Button } from '../../components/Button';
import { Layout } from '../../components/Layout';
import { settingsStartLabel } from '../../memoryPositions/gameplay';
import {
  CATEGORY_LABEL,
  MEMORY_POSITIONS_GRIDS,
  MEMORY_POSITIONS_LEVELS,
  gridLabel,
  type MemoryPositionsCategorySetting,
  type MemoryPositionsDifficulty,
  type MemoryPositionsGrid,
  type MemoryPositionsSettings as Settings,
} from '../../memoryPositions/types';
import type { Screen } from '../../navigation/types';

const CATEGORIES: MemoryPositionsCategorySetting[] = [
  'colored',
  'black',
  'letters',
  'digits',
  'mixed',
];

interface MemoryPositionsSettingsProps {
  initial: Settings;
  configured: boolean;
  unfinished: boolean;
  onHome: () => void;
  onNavigate: (screen: Screen) => void;
  onStart: (settings: Settings) => void;
  onContinue: () => void;
}

export function MemoryPositionsSettings({
  onHome,
  onNavigate,
  ...form
}: MemoryPositionsSettingsProps) {
  return (
    <Layout onHome={onHome} onNavigate={onNavigate} sectionType="memory_positions">
      <MemoryPositionsSettingsForm {...form} />
    </Layout>
  );
}

export function MemoryPositionsSettingsForm({
  initial,
  configured,
  unfinished,
  onStart,
  onContinue,
}: Omit<MemoryPositionsSettingsProps, 'onHome' | 'onNavigate'>) {
  const [draft, setDraft] = useState<Settings>(initial);
  const [confirming, setConfirming] = useState(false);

  const choose = (patch: Partial<Settings>) => {
    setConfirming(false);
    setDraft((current) => ({ ...current, ...patch }));
  };

  const actions = confirming ? (
    <div className="positions-choice" role="group" aria-label="Nepabeigta spēle">
      <p className="positions-note">Ko darīt ar nepabeigto spēli?</p>
      <Button variant="primary" onClick={onContinue}>
        Turpināt esošo spēli
      </Button>
      <Button variant="secondary" onClick={() => onStart(draft)}>
        Sākt jaunu spēli
      </Button>
    </div>
  ) : (
    <Button
      variant="primary"
      onClick={() => {
        if (unfinished) {
          setConfirming(true);
          return;
        }
        onStart(draft);
      }}
    >
      {settingsStartLabel(configured)}
    </Button>
  );

  return (
    <div className="positions-screen positions-setup">
      <div className="positions-setup-scroll">
        {unfinished ? <p className="positions-note">Ir nepabeigta spēle.</p> : null}

        <div className="positions-field" role="group" aria-labelledby="positions-grid-label">
          <h2 id="positions-grid-label" className="positions-field-title">
            Režģa izmērs
          </h2>
          {MEMORY_POSITIONS_GRIDS.map((grid) => {
            const selected = draft.grid === grid;
            return (
              <Button
                key={grid}
                variant={selected ? 'selected' : 'secondary'}
                aria-pressed={selected}
                onClick={() => choose({ grid: grid as MemoryPositionsGrid })}
              >
                {selected ? <span aria-hidden="true">✓ </span> : null}
                {gridLabel(grid)}
              </Button>
            );
          })}
        </div>

        <div className="positions-field" role="group" aria-labelledby="positions-level-label">
          <h2 id="positions-level-label" className="positions-field-title">
            Grūtības pakāpe
          </h2>
          <div className="positions-level-row">
            {MEMORY_POSITIONS_LEVELS.map((level) => {
              const selected = draft.difficulty === level;
              return (
                <Button
                  key={level}
                  fullWidth={false}
                  className="positions-level-btn"
                  variant={selected ? 'selected' : 'secondary'}
                  aria-pressed={selected}
                  aria-label={`${level}. līmenis`}
                  onClick={() => choose({ difficulty: level as MemoryPositionsDifficulty })}
                >
                  {selected ? <span aria-hidden="true">✓ </span> : null}
                  {level}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="positions-field" role="group" aria-labelledby="positions-kind-label">
          <h2 id="positions-kind-label" className="positions-field-title">
            Figūru veids
          </h2>
          {CATEGORIES.map((category) => {
            const selected = draft.category === category;
            return (
              <Button
                key={category}
                variant={selected ? 'selected' : 'secondary'}
                aria-pressed={selected}
                onClick={() => choose({ category })}
              >
                {selected ? <span aria-hidden="true">✓ </span> : null}
                {CATEGORY_LABEL[category]}
              </Button>
            );
          })}
        </div>
      </div>
      <div className="positions-setup-actions">{actions}</div>
    </div>
  );
}
