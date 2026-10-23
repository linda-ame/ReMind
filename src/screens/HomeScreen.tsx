import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import {
  getTasksByType,
  TASK_TYPE_LABELS,
  TASK_TYPE_ORDER,
} from '../data/loadTasks';
import { useApp } from '../context/AppContext';
import { completedTaskIds } from '../utils/attempts';
import type { Screen } from '../navigation/types';
import type { Task } from '../types/task';

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void;
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const { attempts } = useApp();
  const completed = completedTaskIds(attempts);

  const openType = (type: Task['type']) => {
    const ofType = getTasksByType(type);
    if (ofType.length === 0) return;
    onNavigate({ name: 'batch_list', type });
  };

  return (
    <Layout>
      <div className="stack">
        {TASK_TYPE_ORDER.map((type) => {
          const ofType = getTasksByType(type);
          if (ofType.length === 0) return null;
          const done = ofType.filter((t) => completed.has(t.id)).length;
          return (
            <Button
              key={type}
              variant="secondary"
              onClick={() => openType(type)}
            >
              {TASK_TYPE_LABELS[type]} ({done}/{ofType.length})
            </Button>
          );
        })}

        <Button variant="neutral" onClick={() => onNavigate({ name: 'progress' })}>
          Progress
        </Button>

        <Button variant="neutral" onClick={() => onNavigate({ name: 'settings' })}>
          Iestatījumi
        </Button>
      </div>
    </Layout>
  );
}
