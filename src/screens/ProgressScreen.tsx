import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { useApp } from '../context/AppContext';
import { getAllTasks } from '../data/loadTasks';
import {
  bestStatusForTask,
  completedCurrentTaskIds,
  difficultTaskIds,
  uniqueTrainingDays,
} from '../utils/attempts';
import type { Screen } from '../navigation/types';

interface ProgressScreenProps {
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  onHome: () => void;
}

export function ProgressScreen({ onNavigate, onBack, onHome }: ProgressScreenProps) {
  const { attempts, exportProgress, importProgress } = useApp();
  const tasks = getAllTasks();
  const completed = completedCurrentTaskIds(tasks, attempts);
  const days = uniqueTrainingDays(attempts);
  const hardIds = difficultTaskIds(attempts);

  let viewed = 0;
  let attempted = 0;
  let done = 0;
  for (const t of tasks) {
    const s = bestStatusForTask(attempts, t.id, t.contentVersion);
    if (s === 'completed') done += 1;
    else if (s === 'attempted') attempted += 1;
    else if (s === 'viewed') viewed += 1;
  }

  const handleExport = async () => {
    const snapshot = await exportProgress();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `remind-progress-${snapshot.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const snapshot = JSON.parse(text);
        const merge = window.confirm(
          'Vai apvienot ar esošo progresu?\n\nLabi = apvienot\nAtcelt = aizstāt visu',
        );
        await importProgress(snapshot, merge ? 'merge' : 'replace');
        window.alert('Progress importēts.');
      } catch (e) {
        window.alert(
          e instanceof Error ? e.message : 'Neizdevās importēt failu.',
        );
      }
    };
    input.click();
  };

  return (
    <Layout subtitle="Progress" onHome={onHome} onBack={onBack}>
      <div className="stats">
        <p className="stat-line">
          Pabeigti uzdevumi: <strong>{completed.size}</strong> no {tasks.length}
        </p>
        <p className="stat-line">
          Treniņu dienas: <strong>{days}</strong>
        </p>
        <p className="stat-line">Apskatīti: {viewed}</p>
        <p className="stat-line">Mēģināti: {attempted}</p>
        <p className="stat-line">Pabeigti: {done}</p>
      </div>

      <div className="stack">
        {hardIds.length > 0 ? (
          <Button
            variant="help"
            onClick={() =>
              onNavigate({ name: 'task_list', filter: 'difficult' })
            }
          >
            Atkārtot grūtākos ({hardIds.length})
          </Button>
        ) : (
          <p className="muted">Vēl nav uzdevumu, kas atzīmēti kā grūti.</p>
        )}

        <Button variant="secondary" onClick={() => void handleExport()}>
          Eksportēt progresu
        </Button>
        <Button variant="secondary" onClick={handleImport}>
          Importēt progresu
        </Button>
      </div>
    </Layout>
  );
}
