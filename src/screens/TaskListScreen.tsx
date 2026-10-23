import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { getAllTasks, TASK_TYPE_LABELS } from '../data/loadTasks';
import { useApp } from '../context/AppContext';
import {
  bestStatusForTask,
  difficultTaskIds,
  STATUS_LABELS,
} from '../utils/attempts';
import type { Screen } from '../navigation/types';
import type { Task } from '../types/task';

interface TaskListScreenProps {
  filter: 'all' | 'difficult';
  type?: Task['type'];
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  onHome: () => void;
}

export function TaskListScreen({
  filter,
  type,
  onNavigate,
  onBack,
  onHome,
}: TaskListScreenProps) {
  const { attempts } = useApp();
  const all = getAllTasks();
  const hardIds = new Set(difficultTaskIds(attempts));

  let list = all;
  if (type) list = list.filter((t) => t.type === type);
  if (filter === 'difficult') list = list.filter((t) => hardIds.has(t.id));

  const title =
    filter === 'difficult'
      ? 'Grūtākie uzdevumi'
      : type
        ? TASK_TYPE_LABELS[type]
        : 'Uzdevumi';

  const queue = list.map((t) => t.id);

  return (
    <Layout subtitle={title} onHome={onHome} onBack={onBack}>
      {list.length === 0 ? (
        <p className="lead">Nav uzdevumu šajā sarakstā.</p>
      ) : (
        <div className="stack">
          {list.map((task, index) => {
            const status = bestStatusForTask(attempts, task.id);
            return (
              <Button
                key={task.id}
                variant="secondary"
                onClick={() =>
                  onNavigate({ name: 'task', taskId: task.id, queue })
                }
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
      return task.word;
    case 'sentence_completion':
    case 'image_word':
      return task.sentence;
    case 'word_choice':
      return task.prompt;
  }
}
