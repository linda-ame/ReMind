import { useState } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { getTasksByType, TASK_TYPE_LABELS } from '../data/loadTasks';
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
  const allIds = tasks.map((t) => t.id);
  const batches = buildBatchesForType(allIds, type);
  const continueBatch = firstIncompleteBatch(batches, attempts);
  const anyWithProgress = batches.some(
    (b) => batchProgress(b, attempts).done > 0,
  );

  /** word_reading has no self-assessment / summary review flow. */
  const supportsReview = type !== 'word_reading';

  const startBatch = (batchIndex: number) => {
    const batch = batches[batchIndex];
    if (!batch) return;
    const { complete } = batchProgress(batch, attempts);
    if (complete && supportsReview) {
      onNavigate({
        name: 'lesson_review',
        type,
        batchIndex: batch.index,
      });
      return;
    }
    const nextId =
      firstIncompleteTaskId(batch.taskIds, attempts) ?? batch.taskIds[0];
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
    return batchProgress(b, attempts).done > 0;
  });

  const markUnfinished = async () => {
    if (selectedWithProgress.length === 0) {
      window.alert('Izvēlieties nodarbību, ko atzīmēt kā neizpildītu.');
      return;
    }
    const names = selectedWithProgress
      .map((b) => `${b.lessonNumber}. nodarbība`)
      .join(', ');
    const ok = window.confirm(
      `Atzīmēt kā neizpildītas: ${names}?\n\nŠīs nodarbības varēsiet izpildīt no jauna.`,
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
            Visas nodarbības pabeigtas.
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
                Atzīmēt izvēlētās kā neizpildītas
                {selectedWithProgress.length > 0
                  ? ` (${selectedWithProgress.length})`
                  : ''}
              </Button>
              <Button variant="secondary" onClick={exitSelectMode}>
                Atcelt
              </Button>
              <p className="muted settings-explain" role="status">
                Atzīmējiet ķeksītī nodarbības, ko vēlaties atzīmēt kā
                neizpildītas.
              </p>
            </>
          ) : (
            <Button
              variant="secondary"
              className="btn-clear-progress"
              onClick={() => setSelectMode(true)}
            >
              Atzīmēt kā neizpildītas…
            </Button>
          )
        ) : null}

        {batches.map((batch) => {
          const { done, total, complete } = batchProgress(batch, attempts);
          const isChecked = selected.has(batch.index);
          const checkId = `batch-check-${batch.index}`;
          const statusLabel = complete
            ? 'Pabeigta'
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
                    disabled={done === 0}
                    onChange={() => toggleSelect(batch.index)}
                    aria-label={`Izvēlēties ${batch.lessonNumber}. nodarbību`}
                  />
                </label>
              ) : null}

              <button
                type="button"
                className={`btn btn-full batch-lesson-btn${
                  complete ? ' batch-lesson-done' : ''
                }${done > 0 && !complete ? ' batch-lesson-partial' : ''}`}
                onClick={() => {
                  if (selectMode) {
                    if (done > 0) toggleSelect(batch.index);
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
                  {batch.lessonNumber}. nodarbība
                  {' · '}
                  {batch.from}–{batch.to}
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
