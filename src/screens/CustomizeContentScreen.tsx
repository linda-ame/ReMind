import { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import {
  getTasksByType,
  TASK_TYPE_LABELS,
  TASK_TYPE_ORDER,
} from '../data/loadTasks';
import {
  ALL_DIFFICULTY_LEVELS,
  countTasksByDifficultyLevel,
  filterTasksByDifficulty,
  formatDifficultyLevelsLabel,
  loadDifficultyLevels,
  saveDifficultyLevels,
  toggleDifficultyLevel,
} from '../utils/difficulty';
import type { Screen } from '../navigation/types';
import type { DifficultyLevel, Task } from '../types/task';

interface Props {
  onNavigate: (screen: Screen) => void;
  onHome: () => void;
  /** Optional: scroll/focus this section first. */
  focusType?: Task['type'];
}

type LevelsByType = Record<Task['type'], DifficultyLevel[]>;

function loadAllLevels(): LevelsByType {
  const out = {} as LevelsByType;
  for (const type of TASK_TYPE_ORDER) {
    out[type] = loadDifficultyLevels(type);
  }
  return out;
}

export function CustomizeContentScreen({
  onHome,
  focusType,
}: Props) {
  const [byType, setByType] = useState<LevelsByType>(loadAllLevels);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!focusType) return;
    const el = document.getElementById(`customize-${focusType}`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusType]);

  const sections = useMemo(
    () =>
      TASK_TYPE_ORDER.flatMap((type) => {
        const ofType = getTasksByType(type);
        return ofType.length > 0 ? [{ type, ofType }] : [];
      }),
    [],
  );

  const setLevels = (type: Task['type'], next: DifficultyLevel[]) => {
    saveDifficultyLevels(type, next);
    setByType((prev) => ({ ...prev, [type]: next }));
    setHint(null);
  };

  const onToggle = (type: Task['type'], level: DifficultyLevel) => {
    const current = byType[type] ?? loadDifficultyLevels(type);
    const next = toggleDifficultyLevel(current, level);
    if (!next) {
      setHint('Izvēlieties vismaz vienu līmeni');
      return;
    }
    setLevels(type, next);
  };

  return (
    <Layout onHome={onHome}>
      <div className="customize-content">
        <h1 className="customize-content-title">Pielāgot saturu</h1>
        <p className="customize-content-sub">
          Izvēlieties grūtības līmeņus katrai sadaļai. Izmaiņas saglabājas
          uzreiz.
        </p>
        {hint ? (
          <p className="customize-content-hint" role="status">
            {hint}
          </p>
        ) : null}

        <div className="customize-content-sections">
          {sections.map(({ type, ofType }) => {
            const levels = byType[type] ?? ALL_DIFFICULTY_LEVELS;
            const selected = new Set(levels);
            const byLevel = countTasksByDifficultyLevel(ofType);
            const filtered = filterTasksByDifficulty(ofType, levels);
            const label = TASK_TYPE_LABELS[type];
            const highlight = focusType === type;

            return (
              <section
                key={type}
                className={
                  highlight
                    ? 'customize-section customize-section-focus'
                    : 'customize-section'
                }
                aria-labelledby={`customize-${type}`}
              >
                <h2
                  id={`customize-${type}`}
                  className="customize-section-title"
                >
                  {label}
                </h2>
                <p className="customize-section-meta">
                  {formatDifficultyLevelsLabel(levels)} · {filtered.length} no{' '}
                  {ofType.length}
                </p>
                <div
                  className="customize-level-row"
                  role="group"
                  aria-label={`${label}: grūtības līmeņi`}
                >
                  {ALL_DIFFICULTY_LEVELS.map((level) => {
                    const on = selected.has(level);
                    const count = byLevel[level];
                    return (
                      <button
                        key={level}
                        type="button"
                        className={
                          on
                            ? 'customize-level-btn customize-level-btn-on'
                            : 'customize-level-btn'
                        }
                        aria-pressed={on}
                        onClick={() => onToggle(type, level)}
                      >
                        <span className="customize-level-num">{level}</span>
                        <span className="customize-level-count">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <div className="customize-content-footer">
          <Button variant="neutral" onClick={onHome}>
            Uz sākumu
          </Button>
        </div>
      </div>
    </Layout>
  );
}
