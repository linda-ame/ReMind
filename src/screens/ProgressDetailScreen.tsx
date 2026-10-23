import { useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { getTasksByType, TASK_TYPE_LABELS } from '../data/loadTasks';
import { useApp } from '../context/AppContext';
import {
  latestAttemptForTask,
  SELF_ASSESSMENT_LABELS,
  SELF_ASSESSMENT_SYMBOLS,
} from '../utils/attempts';
import {
  enteredAnswerLabels,
  expectedAnswerLabels,
  formatAnswerList,
  isAnswerCorrect,
  isReadingQuestionCorrect,
  taskHasObjectiveAnswer,
  taskHasSelfAssessment,
  taskPromptText,
} from '../utils/answers';
import {
  type ProgressCriterion,
  type ProgressScope,
  sectionProgressStats,
  taskMatchesProgressSelection,
} from '../utils/progressStats';
import type { Screen } from '../navigation/types';
import type { Task } from '../types/task';

interface Props {
  type: Task['type'];
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  onHome: () => void;
}

const CRITERION_ORDER: ProgressCriterion[] = [
  'correct',
  'incorrect',
  'independent',
  'with_help',
  'difficult',
  'unrated',
];

export function ProgressDetailScreen({
  type,
  onNavigate,
  onBack,
  onHome,
}: Props) {
  const { attempts, clearProgressForTasks } = useApp();
  const tasks = getTasksByType(type);
  const stats = sectionProgressStats(tasks, attempts);
  const usesRatings = tasks.some(taskHasSelfAssessment);
  const usesCorrectness = tasks.some(taskHasObjectiveAnswer);

  const [scope, setScope] = useState<ProgressScope>('completed');
  const [criteria, setCriteria] = useState<ProgressCriterion[]>([]);

  const filtered = useMemo(
    () =>
      tasks.filter((t) =>
        taskMatchesProgressSelection(t, attempts, scope, criteria),
      ),
    [tasks, attempts, scope, criteria],
  );

  const toggleCriterion = (id: ProgressCriterion) => {
    setCriteria((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  /** Open a single task in view mode (queue = only that task). */
  const openOne = (taskId: string) => {
    onNavigate({
      name: 'task',
      taskId,
      queue: [taskId],
      mode: 'view',
    });
  };

  /** Walk through the current filtered list in view mode. */
  const openFilteredView = () => {
    if (filtered.length === 0) return;
    onNavigate({
      name: 'task',
      taskId: filtered[0]!.id,
      queue: filtered.map((t) => t.id),
      mode: 'view',
    });
  };

  /** Clear answers and practice only the filtered selection, one by one. */
  const startSelectedRedo = async () => {
    const ids = filtered.map((t) => t.id);
    if (ids.length === 0) return;
    const ok = window.confirm(
      `Atkārtot izvēlētos (${ids.length})?\n\nUzdevumi būs tukši — iepriekšējās atbildes šiem uzdevumiem tiks dzēstas. Tie ies viens pēc otra.`,
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

  const criterionButtons: {
    id: ProgressCriterion;
    label: string;
    show: boolean;
  }[] = [
    {
      id: 'correct',
      label: `Pareizi (${stats.correctness?.correct ?? 0})`,
      show: usesCorrectness,
    },
    {
      id: 'incorrect',
      label: `Nepareizi (${stats.correctness?.incorrect ?? 0})`,
      show: usesCorrectness,
    },
    {
      id: 'independent',
      label: `✓ Pašam (${stats.ratings?.independent ?? 0})`,
      show: usesRatings,
    },
    {
      id: 'with_help',
      label: `~ Ar palīdzību (${stats.ratings?.with_help ?? 0})`,
      show: usesRatings,
    },
    {
      id: 'difficult',
      label: `✗ Grūti (${stats.ratings?.difficult ?? 0})`,
      show: usesRatings,
    },
    {
      id: 'unrated',
      label: `? Nav novērtēts (${stats.ratings?.unrated ?? 0})`,
      show: usesRatings,
    },
  ];

  const selectionSummary =
    criteria.length === 0
      ? scope === 'completed'
        ? 'Pabeigtie'
        : 'Visi'
      : `${scope === 'completed' ? 'Pabeigtie' : 'Visi'} · ${criteria
          .slice()
          .sort(
            (a, b) => CRITERION_ORDER.indexOf(a) - CRITERION_ORDER.indexOf(b),
          )
          .map(criterionShortLabel)
          .join(' + ')}`;

  return (
    <Layout subtitle={TASK_TYPE_LABELS[type]} onHome={onHome} onBack={onBack}>
      <div className="stats">
        <p className="stat-line">
          Pabeigti: <strong>{stats.completed}</strong> no {stats.total}
        </p>
        {stats.ratings ? (
          <p className="stat-line progress-detail-ratings">
            <span className="progress-chip progress-chip-ok">
              ✓ {stats.ratings.independent}
            </span>{' '}
            <span className="progress-chip progress-chip-help">
              ~ {stats.ratings.with_help}
            </span>{' '}
            <span className="progress-chip progress-chip-hard">
              ✗ {stats.ratings.difficult}
            </span>{' '}
            <span className="progress-chip progress-chip-none">
              ? {stats.ratings.unrated}
            </span>
          </p>
        ) : null}
        {stats.correctness ? (
          <p className="stat-line">
            Pareizi: <strong>{stats.correctness.correct}</strong>
            {' · '}
            Nepareizi: <strong>{stats.correctness.incorrect}</strong>
          </p>
        ) : null}
      </div>

      <p className="muted progress-filter-hint">
        Filtrus var ieslēgt vairākus vienlaikus (OR). Pareizi/nepareizi un
        pašnovērtējums ir atsevišķi.
      </p>

      <div
        className="progress-filter-row"
        role="toolbar"
        aria-label="Saraksta apjoms"
      >
        <button
          type="button"
          className={`progress-filter-btn${scope === 'completed' ? ' is-active' : ''}`}
          aria-pressed={scope === 'completed'}
          onClick={() => setScope('completed')}
        >
          Pabeigtie
        </button>
        <button
          type="button"
          className={`progress-filter-btn${scope === 'all' ? ' is-active' : ''}`}
          aria-pressed={scope === 'all'}
          onClick={() => setScope('all')}
        >
          Visi
        </button>
      </div>

      {(usesCorrectness || usesRatings) && (
        <div
          className="progress-filter-row"
          role="toolbar"
          aria-label="Filtri (vairāki)"
        >
          {criterionButtons
            .filter((b) => b.show)
            .map((b) => {
              const on = criteria.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  className={`progress-filter-btn${on ? ' is-active' : ''}`}
                  aria-pressed={on}
                  onClick={() => toggleCriterion(b.id)}
                >
                  {b.label}
                </button>
              );
            })}
        </div>
      )}

      <div className="stack progress-detail-actions">
        {criteria.length > 0 && filtered.length > 0 ? (
          <Button variant="help" onClick={() => void startSelectedRedo()}>
            Atkārtot izvēlētos ({filtered.length})
          </Button>
        ) : null}
        {filtered.length > 0 ? (
          <Button variant="secondary" onClick={openFilteredView}>
            Skatīt filtrētos pēc kārtas ({filtered.length})
          </Button>
        ) : null}
      </div>

      <p className="lead">
        {selectionSummary} · {filtered.length}
      </p>

      {filtered.length === 0 ? (
        <p className="muted">Šajā filtrā nav uzdevumu.</p>
      ) : (
        <div className="summary-list" role="list">
          {filtered.map((task) => {
            const originalIndex = tasks.findIndex((t) => t.id === task.id);
            const i = originalIndex >= 0 ? originalIndex : 0;
            const attempt = latestAttemptForTask(
              attempts,
              task.id,
              task.contentVersion,
            );

            if (task.type === 'reading_comprehension') {
              return (
                <article
                  key={task.id}
                  className="summary-card summary-card-clickable"
                  role="listitem"
                >
                  <button
                    type="button"
                    className="summary-card-hit"
                    onClick={() => openOne(task.id)}
                  >
                    <header className="summary-card-head">
                      <span className="summary-index">{i + 1}.</span>
                    </header>
                    <p className="summary-prompt rc-summary-passage" lang="lv">
                      {task.passage}
                    </p>
                    <div className="rc-summary-questions">
                      {task.questions.map((q, qi) => {
                        const qp = attempt?.reading?.questions.find(
                          (x) => x.questionId === q.id,
                        );
                        const assessment = qp?.selfAssessment ?? null;
                        const correct = isReadingQuestionCorrect(
                          q.answers,
                          qp?.enteredAnswer,
                        );
                        return (
                          <div key={q.id} className="rc-summary-q">
                            <p className="summary-prompt" lang="lv">
                              {qi + 1}. {q.question}
                            </p>
                            <div className="summary-card-head">
                              {assessment ? (
                                <span
                                  className={`summary-assess summary-assess-${assessment}`}
                                >
                                  <span aria-hidden="true">
                                    {SELF_ASSESSMENT_SYMBOLS[assessment]}
                                  </span>
                                  <span className="summary-assess-label">
                                    {SELF_ASSESSMENT_LABELS[assessment]}
                                  </span>
                                </span>
                              ) : (
                                <span className="summary-assess summary-assess-skipped">
                                  Nav novērtēts
                                </span>
                              )}
                              {correct != null ? (
                                <span
                                  className={
                                    correct
                                      ? 'progress-chip progress-chip-correct'
                                      : 'progress-chip progress-chip-wrong'
                                  }
                                >
                                  {correct ? 'Pareizi' : 'Nepareizi'}
                                </span>
                              ) : null}
                            </div>
                            <dl className="summary-dl">
                              <div>
                                <dt>Tava atbilde</dt>
                                <dd>
                                  {formatAnswerList(
                                    qp?.enteredAnswer?.trim()
                                      ? [qp.enteredAnswer]
                                      : [],
                                  )}
                                </dd>
                              </div>
                              <div>
                                <dt>Pareizā atbilde</dt>
                                <dd>{formatAnswerList(q.answers)}</dd>
                              </div>
                            </dl>
                          </div>
                        );
                      })}
                    </div>
                    <span className="summary-open-hint">
                      Skatīt šo uzdevumu →
                    </span>
                  </button>
                </article>
              );
            }

            const assessment = attempt?.selfAssessment ?? null;
            const showRating = taskHasSelfAssessment(task);
            const correct = taskHasObjectiveAnswer(task)
              ? isAnswerCorrect(task, attempt)
              : null;

            return (
              <article
                key={task.id}
                className="summary-card summary-card-clickable"
                role="listitem"
              >
                <button
                  type="button"
                  className="summary-card-hit"
                  onClick={() => openOne(task.id)}
                >
                  <header className="summary-card-head">
                    <span className="summary-index">{i + 1}.</span>
                    {showRating ? (
                      assessment ? (
                        <span
                          className={`summary-assess summary-assess-${assessment}`}
                        >
                          <span aria-hidden="true">
                            {SELF_ASSESSMENT_SYMBOLS[assessment]}
                          </span>
                          <span className="summary-assess-label">
                            {SELF_ASSESSMENT_LABELS[assessment]}
                          </span>
                        </span>
                      ) : (
                        <span className="summary-assess summary-assess-skipped">
                          Nav novērtēts
                        </span>
                      )
                    ) : null}
                    {correct != null ? (
                      <span
                        className={
                          correct
                            ? 'progress-chip progress-chip-correct'
                            : 'progress-chip progress-chip-wrong'
                        }
                      >
                        {correct ? 'Pareizi' : 'Nepareizi'}
                      </span>
                    ) : null}
                  </header>

                  <p className="summary-prompt" lang="lv">
                    {taskPromptText(task)}
                  </p>

                  {task.type !== 'word_reading' ? (
                    <dl className="summary-dl">
                      <div>
                        <dt>Tava atbilde</dt>
                        <dd>
                          {formatAnswerList(
                            enteredAnswerLabels(task, attempt),
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Pareizā atbilde</dt>
                        <dd>
                          {formatAnswerList(expectedAnswerLabels(task))}
                        </dd>
                      </div>
                    </dl>
                  ) : null}

                  <span className="summary-open-hint">
                    Skatīt šo jautājumu →
                  </span>
                </button>
              </article>
            );
          })}
        </div>
      )}
    </Layout>
  );
}

function criterionShortLabel(c: ProgressCriterion): string {
  switch (c) {
    case 'correct':
      return 'Pareizi';
    case 'incorrect':
      return 'Nepareizi';
    case 'independent':
      return '✓';
    case 'with_help':
      return '~';
    case 'difficult':
      return '✗';
    case 'unrated':
      return '?';
  }
}
