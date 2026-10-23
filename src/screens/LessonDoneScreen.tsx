import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { getTasksByType, TASK_TYPE_LABELS } from '../data/loadTasks';
import { useApp } from '../context/AppContext';
import {
  buildBatchesForType,
  firstIncompleteBatch,
} from '../utils/batches';
import { firstIncompleteTaskId } from '../utils/attempts';
import type { Screen } from '../navigation/types';
import type { Task } from '../types/task';

interface Props {
  queue: string[];
  batchIndex?: number;
  batchType?: Task['type'];
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  onHome: () => void;
}

export function LessonDoneScreen({
  queue,
  batchIndex,
  batchType,
  onNavigate,
  onBack,
  onHome,
}: Props) {
  const { attempts } = useApp();
  const inBatch = batchIndex !== undefined && batchType !== undefined;
  const lessonNumber = inBatch ? batchIndex + 1 : null;
  const typeLabel = batchType
    ? TASK_TYPE_LABELS[batchType]
    : 'Uzdevumi';

  const goToBatches = () => {
    if (batchType) {
      onNavigate({ name: 'batch_list', type: batchType });
    } else {
      onNavigate({ name: 'home' });
    }
  };

  const startNextLesson = () => {
    if (!batchType) {
      onNavigate({ name: 'home' });
      return;
    }
    const allIds = getTasksByType(batchType).map((t) => t.id);
    const batches = buildBatchesForType(allIds, batchType);
    const next = firstIncompleteBatch(batches, attempts);
    if (!next) {
      onNavigate({ name: 'batch_list', type: batchType });
      return;
    }
    const nextId =
      firstIncompleteTaskId(next.taskIds, attempts) ?? next.taskIds[0];
    onNavigate({
      name: 'task',
      taskId: nextId,
      queue: next.taskIds,
      batchIndex: next.index,
      batchType,
    });
  };

  const supportsReview = batchType !== 'word_reading';

  const repeatLesson = () => {
    if (queue.length === 0) {
      goToBatches();
      return;
    }
    onNavigate({
      name: 'task',
      taskId: queue[0],
      queue,
      batchIndex,
      batchType,
    });
  };

  const openSummary = () => {
    if (!inBatch || batchType == null || batchIndex == null) return;
    onNavigate({
      name: 'lesson_summary',
      type: batchType,
      batchIndex,
    });
  };

  const openReview = () => {
    if (!inBatch || batchType == null || batchIndex == null) return;
    onNavigate({
      name: 'lesson_review',
      type: batchType,
      batchIndex,
    });
  };

  return (
    <Layout subtitle={typeLabel} onHome={onHome} onBack={onBack}>
      <p className="lead">
        {inBatch
          ? `${lessonNumber}. nodarbība pabeigta.`
          : `Visi ${queue.length} uzdevumi pabeigti.`}
      </p>
      <div className="stack">
        {inBatch ? (
          <>
            <Button variant="primary" onClick={startNextLesson}>
              Nākamā nodarbība
            </Button>
            {supportsReview ? (
              <>
                <Button variant="secondary" onClick={openSummary}>
                  Kopsavilkums
                </Button>
                <Button variant="secondary" onClick={openReview}>
                  Skatīt / pildīt vēlreiz
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={repeatLesson}>
                Atkārtot šo nodarbību
              </Button>
            )}
            <Button variant="neutral" onClick={goToBatches}>
              Visas nodarbības
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" onClick={repeatLesson}>
              Darīt vēlreiz
            </Button>
            <Button
              variant="secondary"
              onClick={() => onNavigate({ name: 'home' })}
            >
              Uz sākumu
            </Button>
          </>
        )}
      </div>
    </Layout>
  );
}
