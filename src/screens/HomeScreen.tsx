import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import {
  getTasksByType,
  TASK_TYPE_LABELS,
  TASK_TYPE_ORDER,
} from '../data/loadTasks';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { MANS_PROGRESS_ENABLED } from '../config/features';
import { completedCurrentTaskIds } from '../utils/attempts';
import { filterSectionTasks } from '../utils/difficulty';
import { deleteMemorySessionsForMode } from '../repositories/IndexedDBProgressRepository';
import { menuSectionLabel, sectionPracticeScreen } from '../utils/sectionPractice';
import { memoryModeCounts } from '../utils/memoryQueue';
import type { Screen } from '../navigation/types';
import type { MemoryMode } from '../types/memory';
import type { Task } from '../types/task';

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void;
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const { attempts, taskSkips, syncError, clearProgressForTasks } = useApp();
  const { user } = useAuth();
  /** Which section is awaiting reset confirmation (inline, not a browser dialog). */
  const [resetConfirmType, setResetConfirmType] = useState<Task['type'] | null>(
    null,
  );
  const [resetMemory, setResetMemory] = useState<MemoryMode | null>(null);
  const [memoryCounts, setMemoryCounts] = useState<
    Record<MemoryMode, { done: number; total: number }>
  >({
    immediate: { done: 0, total: 0 },
    delayed: { done: 0, total: 0 },
  });

  const refreshMemory = () => {
    void Promise.all([
      memoryModeCounts('immediate'),
      memoryModeCounts('delayed'),
    ]).then(([immediate, delayed]) => {
      setMemoryCounts({ immediate, delayed });
    });
  };

  useEffect(() => {
    refreshMemory();
  }, []);

  const openType = (type: Task['type']) => {
    setResetConfirmType(null);
    onNavigate(sectionPracticeScreen(type, attempts, taskSkips));
  };

  const resetSection = async (type: Task['type']) => {
    const ids = getTasksByType(type).map((t) => t.id);
    await clearProgressForTasks(ids);
    setResetConfirmType(null);
  };

  const homeSections = TASK_TYPE_ORDER.flatMap((type) => {
    const ofType = getTasksByType(type);
    return ofType.length > 0 ? [{ type, ofType }] : [];
  });

  return (
    <Layout>
      <div className="home-menu">
        {syncError ? (
          <p className="auth-error home-sync-msg" role="alert">
            Sinhronizācija: {syncError}
          </p>
        ) : null}

        {!user ? (
          <div className="home-auth-banner">
            <Button
              variant="primary"
              className="home-auth-cta"
              onClick={() => onNavigate({ name: 'auth' })}
            >
              Ielogoties / reģistrēties
            </Button>
          </div>
        ) : null}

        <div className="stack home-tasks">
          {homeSections.map(({ type, ofType }, index) => {
            const pool = filterSectionTasks(ofType, type);
            const completedInPool = completedCurrentTaskIds(pool, attempts);
            const done = pool.filter((t) => completedInPool.has(t.id)).length;
            const sectionDone = completedCurrentTaskIds(ofType, attempts).size;
            const confirming = resetConfirmType === type;
            const canReset = sectionDone > 0;
            const label = `${index + 1}. ${TASK_TYPE_LABELS[type]}`;

            return (
              <div key={type} className="home-type-block">
                <div className="home-type-row">
                  <Button
                    variant="secondary"
                    className={`home-type-btn home-type-${type}`}
                    onClick={() => openType(type)}
                  >
                    {label} ({done}/{pool.length})
                  </Button>
                  <button
                    type="button"
                    className="home-reset-btn"
                    disabled={!canReset}
                    aria-label={`Sākt no jauna: ${label}`}
                    title="Sākt no jauna"
                    onClick={() =>
                      setResetConfirmType((prev) =>
                        prev === type ? null : type,
                      )
                    }
                  >
                    ↺
                  </button>
                </div>

                {confirming ? (
                  <div className="home-reset-confirm" role="region">
                    <p className="home-reset-confirm-title">
                      Sākt «{label}» no jauna?
                    </p>
                    <p className="muted home-reset-confirm-text">
                      Šī sadaļa sāksies no jauna ({sectionDone} no{' '}
                      {ofType.length} jau izpildīti). Uzdevumi būs tukši un
                      atkal tiks piedāvāti nejaušā secībā.
                    </p>
                    <div className="home-reset-confirm-actions">
                      <Button
                        variant="danger"
                        onClick={() => void resetSection(type)}
                      >
                        Jā, sākt no jauna
                      </Button>
                      <Button
                        variant="neutral"
                        onClick={() => setResetConfirmType(null)}
                      >
                        Atcelt
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {(
            [
              ['immediate', 'Atceries uzreiz'],
              ['delayed', 'Atceries pēc brīža'],
            ] as const
          ).map(([mode, name], offset) => {
            const counts = memoryCounts[mode];
            const label = `${homeSections.length + offset + 1}. ${name}`;
            const confirming = resetMemory === mode;
            const canReset = counts.done > 0;
            return (
              <div key={mode} className="home-type-block">
                <div className="home-type-row">
                  <Button
                    variant="secondary"
                    className={`home-type-btn home-type-memory_${mode}`}
                    onClick={() => {
                      setResetConfirmType(null);
                      setResetMemory(null);
                      onNavigate({ name: 'memory', mode });
                    }}
                  >
                    {label} ({counts.done}/{counts.total})
                  </Button>
                  <button
                    type="button"
                    className="home-reset-btn"
                    disabled={!canReset}
                    aria-label={`Sākt no jauna: ${label}`}
                    title="Sākt no jauna"
                    onClick={() =>
                      setResetMemory((prev) => (prev === mode ? null : mode))
                    }
                  >
                    ↺
                  </button>
                </div>
                {confirming ? (
                  <div className="home-reset-confirm" role="region">
                    <p className="home-reset-confirm-title">
                      Sākt «{label}» no jauna?
                    </p>
                    <p className="muted home-reset-confirm-text">
                      Tiks dzēsts šī režīma progress ({counts.done} no{' '}
                      {counts.total}).
                    </p>
                    <div className="home-reset-confirm-actions">
                      <Button
                        variant="danger"
                        onClick={() => {
                          void deleteMemorySessionsForMode(mode).then(() => {
                            setResetMemory(null);
                            refreshMemory();
                          });
                        }}
                      >
                        Jā, sākt no jauna
                      </Button>
                      <Button
                        variant="neutral"
                        onClick={() => setResetMemory(null)}
                      >
                        Atcelt
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          <div className="home-type-block">
            <Button
              variant="secondary"
              className="home-type-btn home-type-memory_pairs"
              onClick={() => {
                setResetConfirmType(null);
                setResetMemory(null);
                onNavigate({ name: 'memory_pairs' });
              }}
            >
              {menuSectionLabel('memory_pairs')}
            </Button>
          </div>

          <div className="home-type-block">
            <Button
              variant="secondary"
              className="home-type-btn home-type-memory_pattern"
              onClick={() => {
                setResetConfirmType(null);
                setResetMemory(null);
                onNavigate({ name: 'memory_pattern' });
              }}
            >
              {menuSectionLabel('memory_pattern')}
            </Button>
          </div>
        </div>

        <div className="home-tools" role="navigation" aria-label="Rīki">
          <Button
            variant="neutral"
            className="home-nav-btn home-nav-customize"
            onClick={() => onNavigate({ name: 'customize_content' })}
          >
            Pielāgot saturu
          </Button>

          {MANS_PROGRESS_ENABLED ? (
            <Button
              variant="neutral"
              className="home-nav-btn home-nav-progress"
              onClick={() => onNavigate({ name: 'progress' })}
            >
              Mans progress
            </Button>
          ) : null}

          <Button
            variant="neutral"
            className="home-nav-btn home-nav-settings"
            onClick={() => onNavigate({ name: 'settings' })}
          >
            Iestatījumi
          </Button>

          {user ? (
            <Button
              variant="neutral"
              className="home-nav-btn home-nav-account"
              onClick={() => onNavigate({ name: 'auth' })}
            >
              Konts
            </Button>
          ) : null}
        </div>
      </div>
    </Layout>
  );
}
