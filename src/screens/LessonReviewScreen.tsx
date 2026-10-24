import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import {
  getTasksByType,
  unitTitle,
} from '../data/loadTasks';
import { useApp } from '../context/AppContext';
import { buildBatchesForType } from '../utils/batches';
import type { Screen } from '../navigation/types';
import type { Task } from '../types/task';

interface Props {
  type: Task['type'];
  batchIndex: number;
  onNavigate: (screen: Screen) => void;
  onHome: () => void;
}

/**
 * Actions for a completed lesson / single RC task (not used for word_reading).
 * Kopsavilkums · Skatīt · Pildīt vēlreiz
 */
export function LessonReviewScreen({
  type,
  batchIndex,
  onNavigate,
  onHome,
}: Props) {
  const { clearProgressForTasks } = useApp();
  const tasks = getTasksByType(type);
  const batches = buildBatchesForType(
    tasks.map((t) => t.id),
    type,
  );
  const batch = batches[batchIndex];
  const title = batch ? unitTitle(type, batch.lessonNumber) : null;

  if (!batch || !title) {
    return (
      <Layout onHome={onHome}>
        <p className="lead">Nav atrasts.</p>
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
      `Pildīt ${title} no jauna?\n\nIepriekšējās atbildes un pašvērtējums tiks dzēsti.`,
    );
    if (!ok) return;
    await clearProgressForTasks(batch.taskIds);
    onNavigate({
      name: 'task',
      taskId: batch.taskIds[0]!,
      queue: batch.taskIds,
      batchIndex: batch.index,
      batchType: type,
      mode: 'practice',
      fresh: true,
    });
  };

  return (
    <Layout onHome={onHome}>
      <p className="lead">
        {title} ·{' '}
        {type === 'reading_comprehension' ? 'pabeigts' : 'pabeigta'}
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
