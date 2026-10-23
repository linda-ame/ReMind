import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { getTasksByType, TASK_TYPE_LABELS } from '../data/loadTasks';
import { useApp } from '../context/AppContext';
import { buildBatchesForType } from '../utils/batches';
import type { Screen } from '../navigation/types';
import type { Task } from '../types/task';

interface Props {
  type: Task['type'];
  batchIndex: number;
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  onHome: () => void;
}

/**
 * Actions for a completed lesson (not used for word_reading).
 * Kopsavilkums · Skatīt · Pildīt vēlreiz
 */
export function LessonReviewScreen({
  type,
  batchIndex,
  onNavigate,
  onBack,
  onHome,
}: Props) {
  const { clearProgressForTasks } = useApp();
  const tasks = getTasksByType(type);
  const batches = buildBatchesForType(
    tasks.map((t) => t.id),
    type,
  );
  const batch = batches[batchIndex];

  if (!batch) {
    return (
      <Layout
        subtitle={TASK_TYPE_LABELS[type]}
        onHome={onHome}
        onBack={onBack}
      >
        <p className="lead">Nodarbība nav atrasta.</p>
      </Layout>
    );
  }

  const openQueue = (mode?: 'view' | 'practice') => {
    onNavigate({
      name: 'task',
      taskId: batch.taskIds[0]!,
      queue: batch.taskIds,
      batchIndex: batch.index,
      batchType: type,
      mode,
    });
  };

  const retake = async () => {
    const ok = window.confirm(
      `Pildīt ${batch.lessonNumber}. nodarbību no jauna?\n\nIepriekšējās atbildes un pašvērtējums tiks dzēsti.`,
    );
    if (!ok) return;
    await clearProgressForTasks(batch.taskIds);
    openQueue('practice');
  };

  return (
    <Layout
      subtitle={TASK_TYPE_LABELS[type]}
      onHome={onHome}
      onBack={onBack}
    >
      <p className="lead">
        {batch.lessonNumber}. nodarbība · pabeigta
      </p>
      <div className="stack">
        <Button
          variant="primary"
          onClick={() =>
            onNavigate({
              name: 'lesson_summary',
              type,
              batchIndex: batch.index,
            })
          }
        >
          Kopsavilkums
        </Button>
        <Button variant="secondary" onClick={() => openQueue('view')}>
          Skatīt
        </Button>
        <Button variant="neutral" onClick={() => void retake()}>
          Pildīt vēlreiz
        </Button>
      </div>
    </Layout>
  );
}
