import { useState } from 'react';
import { Button } from '../../components/Button';
import { Layout } from '../../components/Layout';
import type { Screen } from '../../navigation/types';
import { settingsStartLabel } from '../../memoryPattern/gameplay';
import {
  GRID_SPEC,
  MEMORY_PATTERN_GRIDS,
  MEMORY_PATTERN_LEVELS,
  gridLabel,
  type MemoryPatternDifficulty,
  type MemoryPatternGrid,
  type MemoryPatternSettings as Settings,
} from '../../memoryPattern/types';

interface MemoryPatternSettingsProps {
  initial: Settings;
  configured: boolean;
  unfinished: boolean;
  onHome: () => void;
  onNavigate: (screen: Screen) => void;
  onStart: (settings: Settings) => void;
  onContinue: () => void;
}

export function MemoryPatternSettings({
  onHome,
  onNavigate,
  ...form
}: MemoryPatternSettingsProps) {
  return (
    <Layout onHome={onHome} onNavigate={onNavigate} sectionType="memory_pattern">
      <MemoryPatternSettingsForm {...form} />
    </Layout>
  );
}

export function MemoryPatternSettingsForm({
  initial,
  configured,
  unfinished,
  onStart,
  onContinue,
}: Omit<MemoryPatternSettingsProps, 'onHome' | 'onNavigate'>) {
  const [draft, setDraft] = useState<Settings>(initial);
  const [confirming, setConfirming] = useState(false);

  const chooseGrid = (grid: MemoryPatternGrid) => {
    setConfirming(false);
    setDraft((current) => ({ ...current, grid }));
  };

  const chooseLevel = (difficulty: MemoryPatternDifficulty) => {
    setConfirming(false);
    setDraft((current) => ({ ...current, difficulty }));
  };

  const actions = confirming ? (
    <div className="pattern-choice" role="group" aria-label="Nepabeigta spēle">
      <p className="pattern-note">Ko darīt ar nepabeigto spēli?</p>
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
    <div className="pattern-screen pattern-setup">
      <div className="pattern-setup-scroll">
      {unfinished ? (
        <p className="pattern-note">Ir nepabeigta spēle.</p>
      ) : null}

      <div className="pattern-field" role="group" aria-labelledby="pattern-grid-label">
        <h2 id="pattern-grid-label" className="pattern-field-title">
          Režģa izmērs
        </h2>
        {MEMORY_PATTERN_GRIDS.map((grid) => {
          const selected = draft.grid === grid;
          return (
            <Button
              key={grid}
              variant={selected ? 'selected' : 'secondary'}
              aria-pressed={selected}
              onClick={() => chooseGrid(grid)}
            >
              {selected ? <span aria-hidden="true">✓ </span> : null}
              {gridLabel(grid)} — {GRID_SPEC[grid].cells} rūtiņas
            </Button>
          );
        })}
      </div>

      <div className="pattern-field" role="group" aria-labelledby="pattern-level-label">
        <h2 id="pattern-level-label" className="pattern-field-title">
          Grūtības pakāpe
        </h2>
        <div className="pattern-level-row">
          {MEMORY_PATTERN_LEVELS.map((level) => {
            const selected = draft.difficulty === level;
            return (
              <Button
                key={level}
                fullWidth={false}
                className="pattern-level-btn"
                variant={selected ? 'selected' : 'secondary'}
                aria-pressed={selected}
                aria-label={`${level}. līmenis`}
                onClick={() => chooseLevel(level)}
              >
                {selected ? <span aria-hidden="true">✓ </span> : null}
                {level}
              </Button>
            );
          })}
        </div>
      </div>
      </div>
      <div className="pattern-setup-actions">{actions}</div>
    </div>
  );
}
