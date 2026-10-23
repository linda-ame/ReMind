import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import {
  getTasksByType,
  TASK_TYPE_LABELS,
  TASK_TYPE_ORDER,
} from '../data/loadTasks';
import { useApp } from '../context/AppContext';
import { completedCurrentTaskIds } from '../utils/attempts';
import type { Screen } from '../navigation/types';
import type { Task } from '../types/task';

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void;
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const { attempts } = useApp();

  const openType = (type: Task['type']) => {
    const ofType = getTasksByType(type);
    if (ofType.length === 0) return;
    onNavigate({ name: 'batch_list', type });
  };

  return (
    <Layout>
      <div className="home-menu">
        <div className="stack home-tasks">
          {TASK_TYPE_ORDER.map((type) => {
            const ofType = getTasksByType(type);
            if (ofType.length === 0) return null;
            const completed = completedCurrentTaskIds(ofType, attempts);
            const done = ofType.filter((t) => completed.has(t.id)).length;
            return (
              <Button
                key={type}
                variant="secondary"
                className={`home-type-btn home-type-${type}`}
                onClick={() => openType(type)}
              >
                {TASK_TYPE_LABELS[type]} ({done}/{ofType.length})
              </Button>
            );
          })}
        </div>

        <div className="home-tools" role="navigation" aria-label="Rīki">
          <Button
            variant="neutral"
            className="home-nav-btn home-nav-progress"
            onClick={() => onNavigate({ name: 'progress' })}
          >
            Progress
          </Button>

          <Button
            variant="neutral"
            className="home-nav-btn home-nav-settings"
            onClick={() => onNavigate({ name: 'settings' })}
          >
            Iestatījumi
          </Button>
        </div>
      </div>
    </Layout>
  );
}
