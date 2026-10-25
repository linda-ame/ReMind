import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { getAllTasks } from '../data/loadTasks';
import { useApp } from '../context/AppContext';
import { bestStatusForTask, STATUS_LABELS } from '../utils/attempts';
import { hardPracticeTaskIds } from '../utils/progressStats';
import type { Screen } from '../navigation/types';
import type { Task } from '../types/task';

interface TaskListScreenProps {
  filter: 'all' | 'difficult';
  type?: Task['type'];
  onNavigate: (screen: Screen) => void;
  onHome: () => void;
}

export function TaskListScreen({
  filter,
  type,
  onNavigate,
  onHome,
}: TaskListScreenProps) {
  const { attempts, clearProgressForTasks } = useApp();
  const all = getAllTasks();
  const hardIds = new Set(hardPracticeTaskIds(all, attempts));

  let list = all;
  if (type) list = list.filter((t) => t.type === type);
  if (filter === 'difficult') list = list.filter((t) => hardIds.has(t.id));

  const queue = list.map((t) => t.id);

  const openPractice = async (taskId: string) => {
    if (filter === 'difficult') {
      // Empty redo for the whole hard queue (same as Progress).
      await clearProgressForTasks(queue);
      onNavigate({
        name: 'task',
        taskId: queue[0] ?? taskId,
        queue,
        mode: 'practice',
        fresh: true,
      });
      return;
    }
    onNavigate({ name: 'task', taskId, queue });
  };

  return (
    <Layout onHome={onHome}>
      {list.length === 0 ? (
        <p className="lead">Nav uzdevumu šajā sarakstā.</p>
      ) : filter === 'difficult' ? (
        <div className="stack">
          <p className="muted">
            Grūtie un ar palīdzību atzīmētie. Atkārtošana sākas no tukšiem
            uzdevumiem.
          </p>
          <Button
            variant="help"
            onClick={() => void openPractice(queue[0]!)}
          >
            Sākt atkārtošanu ({queue.length})
          </Button>
        </div>
      ) : (
        <div className="stack">
          {list.map((task, index) => {
            const status = bestStatusForTask(
              attempts,
              task.id,
              task.contentVersion,
            );
            return (
              <Button
                key={task.id}
                variant="secondary"
                onClick={() => void openPractice(task.id)}
              >
                {index + 1}. {taskShortLabel(task)}
                {status ? ` — ${STATUS_LABELS[status]}` : ''}
              </Button>
            );
          })}
        </div>
      )}
    </Layout>
  );
}

function taskShortLabel(task: Task): string {
  switch (task.type) {
    case 'word_reading':
    case 'antonym':
      return task.word;
    case 'sentence_completion':
    case 'sentence_completion_multi':
    case 'image_word':
      return task.sentence;
    case 'word_choice':
      return task.prompt;
    case 'reading_comprehension': {
      const label = task.title?.trim() || task.passage;
      return label.length > 48 ? `${label.slice(0, 48)}…` : label;
    }
    case 'sentence_order':
      return task.modelSentence;
    case 'odd_one_out':
      return task.options.join(', ');
    case 'definition_guess':
      return task.description.length > 48
        ? `${task.description.slice(0, 48)}…`
        : task.description;
    case 'sentence_image_match':
      return task.prompt.length > 48
        ? `${task.prompt.slice(0, 48)}…`
        : task.prompt;
  }
}
