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
  loadWordGridOnly3x3,
  saveDifficultyLevels,
  saveWordGridOnly3x3,
  toggleDifficultyLevel,
} from '../utils/difficulty';
import { getMemoryTasks } from '../data/loadMemory';
import type { Screen } from '../navigation/types';
import type { MemoryMode } from '../types/memory';
import type { DifficultyLevel, Task } from '../types/task';
import {
  countMemoryByDifficulty,
  filterMemoryByDifficulty,
  loadMemoryDifficulty,
  saveMemoryDifficulty,
} from '../utils/memoryDifficulty';

interface Props {
  onNavigate: (screen: Screen) => void;
  onHome: () => void;
  /** Optional: scroll/focus this section first. */
  focusType?: Task['type'];
  focusMemory?: MemoryMode;
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
  focusMemory,
}: Props) {
  const [byType, setByType] = useState<LevelsByType>(loadAllLevels);
  const [memoryLevels, setMemoryLevels] = useState<
    Record<MemoryMode, DifficultyLevel[]>
  >({
    immediate: loadMemoryDifficulty('immediate'),
    delayed: loadMemoryDifficulty('delayed'),
  });
  const [hint, setHint] = useState<string | null>(null);
  const [wordGridOnly3x3, setWordGridOnly3x3] = useState(loadWordGridOnly3x3);
  const memoryTasks = getMemoryTasks();
  const memoryCounts = countMemoryByDifficulty();

  useEffect(() => {
    const id = focusMemory
      ? `customize-memory-${focusMemory}`
      : focusType
        ? `customize-${focusType}`
        : null;
    if (!id) return;
    const el = document.getElementById(id);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusType, focusMemory]);

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
            const sized =
              type === 'word_grid' && wordGridOnly3x3
                ? ofType.filter(
                    (task) => task.type === 'word_grid' && task.gridSize === 3,
                  )
                : ofType;
            const byLevel = countTasksByDifficultyLevel(sized);
            const filtered = filterTasksByDifficulty(sized, levels);
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
                {type === 'word_grid' ? (
                  <div className="word-grid-size-limit">
                    <Button
                      variant={wordGridOnly3x3 ? 'selected' : 'secondary'}
                      aria-pressed={wordGridOnly3x3}
                      onClick={() => {
                        const next = !wordGridOnly3x3;
                        saveWordGridOnly3x3(next);
                        setWordGridOnly3x3(next);
                        setHint(null);
                      }}
                    >
                      Tikai 3×3 režģi
                    </Button>
                    <p className="customize-section-meta">
                      {wordGridOnly3x3
                        ? '4×4 režģi šobrīd nav piedāvāti.'
                        : '3×3 un 4×4 ir kopā, pēc izvēlētā līmeņa.'}
                    </p>
                  </div>
                ) : null}
              </section>
            );
          })}

          {(
            [
              ['immediate', 'Atceries uzreiz'],
              ['delayed', 'Atceries pēc brīža'],
            ] as const
          ).map(([mode, label]) => {
            const levels = memoryLevels[mode];
            const selected = new Set(levels);
            const filtered = filterMemoryByDifficulty(memoryTasks, levels);
            return (
              <section
                key={mode}
                className="customize-section"
                aria-labelledby={`customize-memory-${mode}`}
              >
                <h2
                  id={`customize-memory-${mode}`}
                  className="customize-section-title"
                >
                  {label}
                </h2>
                <p className="customize-section-meta">
                  {formatDifficultyLevelsLabel(levels)} · {filtered.length} no{' '}
                  {memoryTasks.length}
                </p>
                <div
                  className="customize-level-row"
                  role="group"
                  aria-label={`${label}: grūtības līmeņi`}
                >
                  {ALL_DIFFICULTY_LEVELS.map((level) => {
                    const on = selected.has(level);
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
                        onClick={() => {
                          const next = toggleDifficultyLevel(levels, level);
                          if (!next) {
                            setHint('Izvēlieties vismaz vienu līmeni');
                            return;
                          }
                          saveMemoryDifficulty(mode, next);
                          setMemoryLevels((prev) => ({ ...prev, [mode]: next }));
                          setHint(null);
                        }}
                      >
                        <span className="customize-level-num">{level}</span>
                        <span className="customize-level-count">
                          {memoryCounts[level]}
                        </span>
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
