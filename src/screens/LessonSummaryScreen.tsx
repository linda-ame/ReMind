import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import {
  getTaskById,
  getTasksByType,
} from '../data/loadTasks';
import { useApp } from '../context/AppContext';
import { buildBatchesForType } from '../utils/batches';
import {
  latestAttemptForTask,
  SELF_ASSESSMENT_LABELS,
  SELF_ASSESSMENT_SYMBOLS,
} from '../utils/attempts';
import {
  answersBoxLabel,
  enteredAnswerLabels,
  expectedAnswerLabels,
  formatAnswerList,
  isAnswerCorrect,
  isReadingQuestionCorrect,
  taskHasObjectiveAnswer,
  taskHasSelfAssessment,
  taskPromptText,
} from '../utils/answers';
import type { Screen } from '../navigation/types';
import type { Task } from '../types/task';

interface Props {
  type: Task['type'];
  batchIndex: number;
  onNavigate: (screen: Screen) => void;
  onHome: () => void;
}

export function LessonSummaryScreen({
  type,
  batchIndex,
  onNavigate,
  onHome,
}: Props) {
  const { attempts } = useApp();
  const tasks = getTasksByType(type);
  const batches = buildBatchesForType(
    tasks.map((t) => t.id),
    type,
  );
  const batch = batches[batchIndex];

  if (!batch) {
    return (
      <Layout onHome={onHome}>
        <p className="lead">Nav atrasts.</p>
      </Layout>
    );
  }

  const openView = (taskId: string) => {
    onNavigate({
      name: 'task',
      taskId,
      queue: batch.taskIds,
      batchIndex: batch.index,
      batchType: type,
      mode: 'view',
    });
  };

  return (
    <Layout onHome={onHome}>
      <p className="lead">Kopsavilkums</p>

      <div className="summary-list" role="list">
        {batch.taskIds.map((taskId, i) => {
          const task = getTaskById(taskId);
          if (!task) return null;
          const attempt = latestAttemptForTask(
            attempts,
            taskId,
            task.contentVersion,
          );

          if (task.type === 'reading_comprehension') {
            return (
              <article
                key={taskId}
                className="summary-card"
                role="listitem"
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
                              title={SELF_ASSESSMENT_LABELS[assessment]}
                            >
                              <span aria-hidden="true">
                                {SELF_ASSESSMENT_SYMBOLS[assessment]}
                              </span>
                              <span className="summary-assess-label">
                                {SELF_ASSESSMENT_LABELS[assessment]}
                              </span>
                            </span>
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
                            <dt>
                              {answersBoxLabel(
                                'reading_question',
                                q.answers.length,
                              )}
                            </dt>
                            <dd>{formatAnswerList(q.answers)}</dd>
                          </div>
                        </dl>
                      </div>
                    );
                  })}
                </div>
                <Button
                  variant="secondary"
                  className="summary-open-btn"
                  onClick={() => openView(taskId)}
                >
                  Skatīt uzdevumu
                </Button>
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
              key={taskId}
              className="summary-card"
              role="listitem"
            >
              <header className="summary-card-head">
                <span className="summary-index">{i + 1}.</span>
                {showRating && assessment && assessment !== 'skipped' ? (
                  <span
                    className={`summary-assess summary-assess-${assessment}`}
                    title={SELF_ASSESSMENT_LABELS[assessment]}
                  >
                    <span aria-hidden="true">
                      {SELF_ASSESSMENT_SYMBOLS[assessment]}
                    </span>
                    <span className="summary-assess-label">
                      {SELF_ASSESSMENT_LABELS[assessment]}
                    </span>
                  </span>
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

              <dl className="summary-dl">
                <div>
                  <dt>Tava atbilde</dt>
                  <dd>{formatAnswerList(enteredAnswerLabels(task, attempt))}</dd>
                </div>
                <div>
                  <dt>
                    {answersBoxLabel(
                      task.type,
                      expectedAnswerLabels(task).length,
                    )}
                  </dt>
                  <dd>
                    {formatAnswerList(expectedAnswerLabels(task))}
                  </dd>
                </div>
              </dl>

              <Button
                variant="secondary"
                className="summary-open-btn"
                onClick={() => openView(taskId)}
              >
                Skatīt jautājumu
              </Button>
            </article>
          );
        })}
      </div>
    </Layout>
  );
}
