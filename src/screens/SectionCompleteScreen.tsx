import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import {
  getTasksByType,
  TASK_TYPE_LABELS,
} from '../data/loadTasks';
import { useApp } from '../context/AppContext';
import {
  buildRandomPracticeQueue,
  countSkippedTodayIncomplete,
} from '../utils/randomQueue';
import type { Screen } from '../navigation/types';
import type { Task } from '../types/task';

interface Props {
  type: Task['type'];
  onNavigate: (screen: Screen) => void;
  onHome: () => void;
}

export function SectionCompleteScreen({
  type,
  onNavigate,
  onHome,
}: Props) {
  const { clearProgressForTasks, attempts, taskSkips } = useApp();
  const label = TASK_TYPE_LABELS[type];
  const ofType = getTasksByType(type);
  const total = ofType.length;

  const startOver = async () => {
    const ids = ofType.map((t) => t.id);
    await clearProgressForTasks(ids);
    // After clear, attempts/skips refresh — build queue from empty progress.
    const queue = buildRandomPracticeQueue(ofType, [], []);
    if (queue.length === 0) {
      onNavigate({ name: 'home' });
      return;
    }
    onNavigate({
      name: 'task',
      taskId: queue[0]!,
      queue,
      batchType: type,
    });
  };

  const remaining = buildRandomPracticeQueue(ofType, attempts, taskSkips);
  const skippedToday = buildRandomPracticeQueue(
    ofType,
    attempts,
    taskSkips,
    'skipped_today',
  );
  const skippedCount = countSkippedTodayIncomplete(ofType, attempts, taskSkips);

  return (
    <Layout onHome={onHome}>
      <div className="section-complete">
        {remaining.length > 0 ? (
          <>
            <h1 className="section-complete-title">
              Vēl ir pieejami uzdevumi
            </h1>
            <p className="section-complete-sub">
              Sadaļā «{label}» — {remaining.length} no {total} vēl nav
              izpildīti.
            </p>
            <div className="stack section-complete-actions">
              <Button
                variant="primary"
                onClick={() =>
                  onNavigate({
                    name: 'task',
                    taskId: remaining[0]!,
                    queue: remaining,
                    batchType: type,
                  })
                }
              >
                Turpināt ({remaining.length} atlikuši)
              </Button>
              <Button variant="neutral" onClick={onHome}>
                Uz sākumu
              </Button>
            </div>
          </>
        ) : skippedCount > 0 ? (
          <>
            <h1 className="section-complete-title">
              Jūs esat izpildījuši visus pieejamos uzdevumus
            </h1>
            <p className="section-complete-sub">
              Šodien izlaisti {skippedCount} — tie rīt atkal būs pieejami
              nejaušā secībā. Varat arī izpildīt tos tagad.
            </p>
            <div className="stack section-complete-actions">
              <Button
                variant="primary"
                onClick={() =>
                  onNavigate({
                    name: 'task',
                    taskId: skippedToday[0]!,
                    queue: skippedToday,
                    batchType: type,
                  })
                }
              >
                Pildīt šodien izlaistos ({skippedCount})
              </Button>
              <p className="section-complete-prompt">
                Vai dzēst progresu un sākt no jauna?
              </p>
              <Button variant="secondary" onClick={() => void startOver()}>
                Sākt no jauna
              </Button>
              <Button variant="neutral" onClick={onHome}>
                Uz sākumu
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="section-complete-title">
              Jūs esat izpildījuši visus uzdevumus
            </h1>
            <p className="section-complete-sub">
              Sadaļā «{label}» — visi {total} uzdevumi.
            </p>
            <div className="stack section-complete-actions">
              <p className="section-complete-prompt">
                Vai dzēst progresu un sākt no jauna?
              </p>
              <Button variant="primary" onClick={() => void startOver()}>
                Sākt no jauna
              </Button>
              <Button variant="neutral" onClick={onHome}>
                Uz sākumu
              </Button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
