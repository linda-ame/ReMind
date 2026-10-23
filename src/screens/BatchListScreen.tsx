import { useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import {
  getTasksByType,
  TASK_TYPE_LABELS,
  unitNoun,
  unitNounPlural,
  unitTitle,
} from '../data/loadTasks';
import { useApp } from '../context/AppContext';
import {
  batchProgress,
  buildBatchesForType,
  firstIncompleteBatch,
} from '../utils/batches';
import { firstIncompleteTaskId } from '../utils/attempts';
import type { Screen } from '../navigation/types';
import type { Task } from '../types/task';

interface BatchListScreenProps {
  type: Task['type'];
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  onHome: () => void;
}

export function BatchListScreen({
  type,
  onNavigate,
  onBack,
  onHome,
}: BatchListScreenProps) {
  const { attempts, clearProgressForTasks } = useApp();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const tasks = getTasksByType(type);
  const tasksById = useMemo(
    () => new Map(tasks.map((t) => [t.id, t])),
    [tasks],
  );
  const allIds = tasks.map((t) => t.id);
  const batches = buildBatchesForType(allIds, type);
  const continueBatch = firstIncompleteBatch(batches, attempts, tasksById);
  const anyWithProgress = batches.some(
    (b) => batchProgress(b, attempts, tasksById).partial ||
      batchProgress(b, attempts, tasksById).done > 0,
  );
  const noun = unitNoun(type);
  const nounPlural = unitNounPlural(type);
  const singleUnit = type === 'reading_comprehension';

  /** word_reading has no self-assessment / summary review flow. */
  const supportsReview = type !== 'word_reading';

  const startBatch = (batchIndex: number) => {
    const batch = batches[batchIndex];
    if (!batch) return;
    const { complete } = batchProgress(batch, attempts, tasksById);
    if (complete && supportsReview) {
      onNavigate({
        name: 'lesson_review',
        type,
        batchIndex: batch.index,
      });
      return;
    }
    const nextId =
      firstIncompleteTaskId(batch.taskIds, attempts, tasksById) ??
      batch.taskIds[0];
    onNavigate({
      name: 'task',
      taskId: nextId,
      queue: batch.taskIds,
      batchIndex: batch.index,
      batchType: type,
    });
  };

  const toggleSelect = (batchIndex: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(batchIndex)) next.delete(batchIndex);
      else next.add(batchIndex);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const selectedWithProgress = batches.filter((b) => {
    if (!selected.has(b.index)) return false;
    const p = batchProgress(b, attempts, tasksById);
    return p.done > 0 || p.partial;
  });

  const markUnfinished = async () => {
    if (selectedWithProgress.length === 0) {
      window.alert(
        `Izvēlieties ${noun}, ko atzīmēt kā neizpildītu.`,
      );
      return;
    }
    const names = selectedWithProgress
      .map((b) => unitTitle(type, b.lessonNumber))
      .join(', ');
    const ok = window.confirm(
      `Atzīmēt kā neizpildītas: ${names}?\n\nŠos varēsiet izpildīt no jauna.`,
    );
    if (!ok) return;
    const taskIds = selectedWithProgress.flatMap((b) => b.taskIds);
    await clearProgressForTasks(taskIds);
    exitSelectMode();
  };

  return (
    <Layout
      subtitle={TASK_TYPE_LABELS[type]}
      onHome={onHome}
      onBack={onBack}
    >
      <div className="stack">
        {!selectMode && !continueBatch ? (
          <p className="muted settings-explain" role="status">
            Visi {nounPlural} pabeigti.
          </p>
        ) : null}

        {anyWithProgress ? (
          selectMode ? (
            <>
              <Button
                variant="secondary"
                className="btn-clear-progress"
                disabled={selectedWithProgress.length === 0}
                onClick={() => void markUnfinished()}
              >
                {singleUnit
                  ? 'Atzīmēt izvēlētos kā neizpildītus'
                  : 'Atzīmēt izvēlētās kā neizpildītas'}
                {selectedWithProgress.length > 0
                  ? ` (${selectedWithProgress.length})`
                  : ''}
              </Button>
              <Button variant="secondary" onClick={exitSelectMode}>
                Atcelt
              </Button>
              <p className="muted settings-explain" role="status">
                Atzīmējiet ķeksītī {nounPlural}, ko vēlaties atzīmēt kā
                {singleUnit ? ' neizpildītus' : ' neizpildītas'}.
              </p>
            </>
          ) : (
            <Button
              variant="secondary"
              className="btn-clear-progress"
              onClick={() => setSelectMode(true)}
            >
              {singleUnit
                ? 'Atzīmēt kā neizpildītus…'
                : 'Atzīmēt kā neizpildītas…'}
            </Button>
          )
        ) : null}

        {batches.map((batch) => {
          const { done, total, complete, partial } = batchProgress(
            batch,
            attempts,
            tasksById,
          );
          const isChecked = selected.has(batch.index);
          const checkId = `batch-check-${batch.index}`;
          const statusLabel = complete
            ? singleUnit
              ? 'Pabeigts'
              : 'Pabeigta'
            : singleUnit
              ? partial
                ? 'Iesākts'
                : 'Nesākts'
              : `${done} no ${total}`;

          return (
            <div key={batch.index} className="batch-row">
              {selectMode ? (
                <label className="batch-check-label" htmlFor={checkId}>
                  <input
                    id={checkId}
                    type="checkbox"
                    className="batch-check"
                    checked={isChecked}
                    disabled={done === 0 && !partial}
                    onChange={() => toggleSelect(batch.index)}
                    aria-label={`Izvēlēties ${unitTitle(type, batch.lessonNumber)}`}
                  />
                </label>
              ) : null}

              <button
                type="button"
                className={`btn btn-full batch-lesson-btn${
                  complete ? ' batch-lesson-done' : ''
                }${partial && !complete ? ' batch-lesson-partial' : ''}`}
                onClick={() => {
                  if (selectMode) {
                    if (done > 0 || partial) toggleSelect(batch.index);
                    return;
                  }
                  startBatch(batch.index);
                }}
              >
                {complete ? (
                  <span className="batch-done-mark" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
                <span>
                  {unitTitle(type, batch.lessonNumber)}
                  {singleUnit ? null : (
                    <>
                      {' · '}
                      {batch.from}–{batch.to}
                    </>
                  )}
                  {' · '}
                  {statusLabel}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
