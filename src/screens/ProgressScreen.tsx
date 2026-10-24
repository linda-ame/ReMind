import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { useApp } from '../context/AppContext';
import {
  getAllTasks,
  getTasksByType,
  TASK_TYPE_LABELS,
  TASK_TYPE_ORDER,
} from '../data/loadTasks';
import {
  completedCurrentTaskIds,
  difficultTaskIds,
  uniqueTrainingDays,
} from '../utils/attempts';
import {
  RATING_CHIP_LABELS,
  sectionProgressStats,
} from '../utils/progressStats';
import type { Screen } from '../navigation/types';

interface ProgressScreenProps {
  onNavigate: (screen: Screen) => void;
  onHome: () => void;
}

export function ProgressScreen({
  onNavigate,
  onHome,
}: ProgressScreenProps) {
  const { attempts, exportProgress, importProgress, clearProgressForTasks } =
    useApp();
  const tasks = getAllTasks();
  const completed = completedCurrentTaskIds(tasks, attempts);
  const days = uniqueTrainingDays(attempts);
  const allHardIds = difficultTaskIds(attempts);

  const startHardRedo = async (ids: string[], label: string) => {
    if (ids.length === 0) return;
    const ok = window.confirm(
      `Atkārtot ${label} (${ids.length})?\n\nUzdevumi būs tukši — iepriekšējās atbildes šiem uzdevumiem tiks dzēstas.`,
    );
    if (!ok) return;
    await clearProgressForTasks(ids);
    onNavigate({
      name: 'task',
      taskId: ids[0]!,
      queue: ids,
      mode: 'practice',
      fresh: true,
    });
  };

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
    <Layout onHome={onHome}>
      <div className="stats progress-overview-stats">
        <p className="stat-line">
          Pabeigti: <strong>{completed.size}</strong> no {tasks.length}
        </p>
        <p className="stat-line">
          Treniņu dienas: <strong>{days}</strong>
        </p>
      </div>

      <p className="lead progress-sections-lead">Pa sadaļām</p>
      <div className="stack progress-section-list">
        {TASK_TYPE_ORDER.map((type) => {
          const ofType = getTasksByType(type);
          if (ofType.length === 0) return null;
          const stats = sectionProgressStats(ofType, attempts);
          return (
            <button
              key={type}
              type="button"
              className={`progress-section-card home-type-${type}`}
              onClick={() =>
                onNavigate({ name: 'progress_detail', type })
              }
            >
              <span className="progress-section-title">
                {TASK_TYPE_LABELS[type]}
              </span>
              <span className="progress-section-done">
                {stats.completed} / {stats.total} pabeigti
              </span>
              {stats.ratings ? (
                <span className="progress-chips" aria-label="Novērtējumi">
                  <span className="progress-chip progress-chip-ok">
                    ✓ {stats.ratings.independent}
                  </span>
                  <span className="progress-chip progress-chip-help">
                    ~ {stats.ratings.with_help}
                  </span>
                  <span className="progress-chip progress-chip-hard">
                    ✗ {stats.ratings.difficult}
                  </span>
                  <span className="progress-chip progress-chip-none">
                    ? {stats.ratings.unrated}
                  </span>
                </span>
              ) : null}
              {stats.correctness ? (
                <span className="progress-chips" aria-label="Atbildes">
                  <span className="progress-chip progress-chip-correct">
                    Pareizi {stats.correctness.correct}
                  </span>
                  <span className="progress-chip progress-chip-wrong">
                    Nepareizi {stats.correctness.incorrect}
                  </span>
                  {stats.correctness.unanswered > 0 ? (
                    <span className="progress-chip progress-chip-none">
                      Bez atbildes {stats.correctness.unanswered}
                    </span>
                  ) : null}
                </span>
              ) : null}
              {stats.hardIds.length > 0 ? (
                <span className="progress-section-hard-hint">
                  Grūtie: {stats.hardIds.length} — atver, lai atkārtotu
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="stack progress-global-actions">
        {allHardIds.length > 0 ? (
          <Button
            variant="help"
            onClick={() =>
              void startHardRedo(allHardIds, 'visus grūtos uzdevumus')
            }
          >
            Atkārtot visus grūtos ({allHardIds.length})
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

      <p className="muted progress-legend">
        {RATING_CHIP_LABELS.independent}: ✓ · {RATING_CHIP_LABELS.with_help}: ~
        · {RATING_CHIP_LABELS.difficult}: ✗ · {RATING_CHIP_LABELS.unrated}: ?
      </p>
    </Layout>
  );
}
