import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import {
  getTasksByType,
  TASK_TYPE_LABELS,
} from '../data/loadTasks';
import { useApp } from '../context/AppContext';
import {
  filterTasksByDifficulty,
  formatDifficultyLevelsLabel,
  loadDifficultyLevels,
} from '../utils/difficulty';
import {
  buildRandomPracticeQueue,
  countSkippedTodayIncomplete,
} from '../utils/randomQueue';
import type { Screen } from '../navigation/types';
import type { DifficultyLevel, Task } from '../types/task';

interface Props {
  type: Task['type'];
  difficultyLevels?: DifficultyLevel[];
  onNavigate: (screen: Screen) => void;
  onHome: () => void;
}

export function SectionCompleteScreen({
  type,
  difficultyLevels: levelsProp,
  onNavigate,
  onHome,
}: Props) {
  const { clearProgressForTasks, attempts, taskSkips } = useApp();
  const label = TASK_TYPE_LABELS[type];
  const levels = levelsProp ?? loadDifficultyLevels(type);
  const ofType = getTasksByType(type);
  const pool = filterTasksByDifficulty(ofType, levels);
  const total = pool.length;
  const levelLabel = formatDifficultyLevelsLabel(levels);

  const startOver = async () => {
    const ids = pool.map((t) => t.id);
    await clearProgressForTasks(ids);
    const queue = buildRandomPracticeQueue(pool, [], []);
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

  const remaining = buildRandomPracticeQueue(pool, attempts, taskSkips);
  const skippedToday = buildRandomPracticeQueue(
    pool,
    attempts,
    taskSkips,
    'skipped_today',
  );
  const skippedCount = countSkippedTodayIncomplete(pool, attempts, taskSkips);

  const changeLevel = () => {
    onNavigate({ name: 'customize_content', focusType: type });
  };

  return (
    <Layout onHome={onHome} sectionType={type} onNavigate={onNavigate}>
      <div className="section-complete">
        {remaining.length > 0 ? (
          <>
            <h1 className="section-complete-title">
              Vēl ir pieejami uzdevumi
            </h1>
            <p className="section-complete-sub">
              «{label}» · {levelLabel} — {remaining.length} no {total} vēl nav
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
              <Button variant="secondary" onClick={changeLevel}>
                Pielāgot saturu
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
              «{label}» · {levelLabel}. Šodien izlaisti {skippedCount} — tie
              rīt atkal būs pieejami. Varat arī izpildīt tos tagad.
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
                Vai dzēst progresu šajā filtrā un sākt no jauna?
              </p>
              <Button variant="secondary" onClick={() => void startOver()}>
                Atkārtot
              </Button>
              <Button variant="secondary" onClick={changeLevel}>
                Pielāgot saturu
              </Button>
              <Button variant="neutral" onClick={onHome}>
                Uz sākumu
              </Button>
            </div>
          </>
        ) : total === 0 ? (
          <>
            <h1 className="section-complete-title">
              Šajā filtrā uzdevumu nav
            </h1>
            <p className="section-complete-sub">
              «{label}» · {levelLabel} — izvēlētajos līmeņos nav uzdevumu.
            </p>
            <div className="stack section-complete-actions">
              <Button variant="primary" onClick={changeLevel}>
                Pielāgot saturu
              </Button>
              <Button variant="neutral" onClick={onHome}>
                Uz sākumu
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="section-complete-title">
              Šajā filtrā jaunu uzdevumu nav
            </h1>
            <p className="section-complete-sub">
              «{label}» · {levelLabel} — visi {total} uzdevumi izpildīti.
            </p>
            <div className="stack section-complete-actions">
              <Button variant="primary" onClick={() => void startOver()}>
                Atkārtot
              </Button>
              <Button variant="secondary" onClick={changeLevel}>
                Pielāgot saturu
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
