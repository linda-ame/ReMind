import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import {
  getTaskById,
  TASK_TYPE_LABELS,
  unitTitle,
} from '../data/loadTasks';
import { useApp } from '../context/AppContext';
import {
  completeAttempt,
  createAttempt,
  latestAttemptForTask,
  SELF_ASSESSMENT_LABELS,
  SELF_ASSESSMENT_SYMBOLS,
} from '../utils/attempts';
import type { Screen, TaskSessionMode } from '../navigation/types';
import type { SelfAssessment, TaskAttempt } from '../types/progress';
import type { Task } from '../types/task';
import { WordReadingTaskView } from './task/WordReadingTaskView';
import { SentenceCompletionTaskView } from './task/SentenceCompletionTaskView';
import { ImageWordTaskView } from './task/ImageWordTaskView';
import { WordChoiceTaskView } from './task/WordChoiceTaskView';
import { ReadingComprehensionTaskView } from './task/ReadingComprehensionTaskView';
import { SentenceOrderTaskView } from './task/SentenceOrderTaskView';
import { OddOneOutTaskView } from './task/OddOneOutTaskView';
import { AntonymTaskView } from './task/AntonymTaskView';
import { DefinitionGuessTaskView } from './task/DefinitionGuessTaskView';

interface TaskScreenProps {
  taskId: string;
  queue: string[];
  batchIndex?: number;
  batchType?: Task['type'];
  mode?: TaskSessionMode;
  /** Ignore stored progress and start empty (after “atkārtot grūtos”). */
  fresh?: boolean;
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  onHome: () => void;
}

export function TaskScreen({
  taskId,
  queue,
  batchIndex,
  batchType,
  mode = 'practice',
  fresh = false,
  onNavigate,
  onBack,
  onHome,
}: TaskScreenProps) {
  const { attempts, saveAttempt } = useApp();
  const task = getTaskById(taskId);
  const [attempt, setAttempt] = useState<TaskAttempt | null>(null);
  const isView = mode === 'view';

  useEffect(() => {
    if (!task) return;

    // Forced empty start (progress was cleared for redo).
    if (fresh && !isView) {
      const a = createAttempt(task);
      setAttempt(a);
      void saveAttempt(a);
      return;
    }

    const previous = latestAttemptForTask(
      attempts,
      task.id,
      task.contentVersion,
    );
    if (previous) {
      setAttempt(previous);
      return;
    }
    if (isView) {
      setAttempt(createAttempt(task));
      return;
    }
    const a = createAttempt(task);
    setAttempt(a);
    void saveAttempt(a);
    // Only re-init when the task changes; attempts is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [taskId, task, saveAttempt, isView, fresh]);

  const taskNav = (nextTaskId: string): Screen => ({
    name: 'task',
    taskId: nextTaskId,
    queue,
    batchIndex,
    batchType,
    mode,
    // Keep fresh for the whole redo queue so each item starts empty.
    fresh: fresh || undefined,
  });

  if (!task) {
    return (
      <Layout onHome={onHome} onBack={onBack} subtitle="Kļūda">
        <p className="lead">Uzdevums nav atrasts.</p>
      </Layout>
    );
  }

  if (!attempt) {
    return (
      <Layout
        onHome={onHome}
        onBack={onBack}
        subtitle={TASK_TYPE_LABELS[task.type]}
      >
        <p className="lead">Ielādē…</p>
      </Layout>
    );
  }

  const idx = queue.indexOf(taskId);
  const isLast = idx >= 0 && idx === queue.length - 1;
  const isWordReading = task.type === 'word_reading';
  const isWordChoice = task.type === 'word_choice';
  const isOddOneOut = task.type === 'odd_one_out';
  const isReading = task.type === 'reading_comprehension';
  const isSentenceOrder = task.type === 'sentence_order';
  /** Same as existing choice / reading sections — no footer self-assessment. */
  const skipSelfAssessment =
    isWordReading || isWordChoice || isOddOneOut || isReading;
  const inBatch = batchIndex !== undefined && batchType !== undefined;
  const alreadyAssessed =
    attempt.status === 'completed' && attempt.selfAssessment != null;
  /** First task of first lesson — show self-assessment intro once per section. */
  const showAssessmentIntro =
    !skipSelfAssessment &&
    !isView &&
    !alreadyAssessed &&
    batchIndex === 0 &&
    idx === 0;

  const onUpdate = (next: TaskAttempt) => {
    if (isView) return;
    setAttempt(next);
    void saveAttempt(next);
  };

  const goNextTask = () => {
    const nextId = idx >= 0 && idx < queue.length - 1 ? queue[idx + 1] : null;
    if (nextId) {
      onNavigate(taskNav(nextId));
      return;
    }
    if (isView) {
      onBack();
      return;
    }
    // End of practice queue (nodarbība or “atkārtot grūtos”) → done screen.
    if (queue.length > 0) {
      onNavigate({
        name: 'lesson_done',
        queue,
        batchIndex,
        batchType,
      });
      return;
    }
    onBack();
  };

  const finishWithoutAssessment = async () => {
    if (isView) {
      goNextTask();
      return;
    }
    const done = completeAttempt(attempt, null);
    setAttempt(done);
    await saveAttempt(done);
    goNextTask();
  };

  const finishWith = async (assessment: SelfAssessment) => {
    if (isView) return;
    const done = completeAttempt(attempt, assessment);
    setAttempt(done);
    await saveAttempt(done);
    goNextTask();
  };

  const goPrev = () => {
    if (idx > 0) {
      onNavigate(taskNav(queue[idx - 1]));
    } else {
      onBack();
    }
  };

  const nextLabel = isView
    ? isLast
      ? 'Aizvērt'
      : 'Tālāk'
    : isLast
      ? 'Pabeigt'
      : 'Tālāk';

  const queueProgressLabel =
    queue.length > 0 && idx >= 0 && !isReading
      ? `${idx + 1}. no ${queue.length}`
      : null;

  /** Sentence order: no type heading (progress stays in the footer like others). */
  const subtitle = isSentenceOrder
    ? undefined
    : inBatch
      ? `${TASK_TYPE_LABELS[task.type]} · ${unitTitle(
          task.type,
          batchIndex! + 1,
        )}${isView ? ' · skatīt' : ''}`
      : TASK_TYPE_LABELS[task.type];

  const assessmentSavedBanner =
    alreadyAssessed && attempt.selfAssessment ? (
      <div
        className={`assessment-saved assessment-saved-${attempt.selfAssessment}`}
        role="status"
      >
        <span className="assess-symbol" aria-hidden="true">
          {SELF_ASSESSMENT_SYMBOLS[attempt.selfAssessment]}
        </span>
        <span>{SELF_ASSESSMENT_LABELS[attempt.selfAssessment]}</span>
      </div>
    ) : null;

  if (isReading) {
    return (
      <Layout onHome={onHome} onBack={onBack} subtitle={subtitle}>
        <ReadingComprehensionTaskView
          key={`${task.id}-${mode}`}
          task={task}
          attempt={attempt}
          onUpdate={(next) => {
            setAttempt(next);
            if (!isView) void saveAttempt(next);
          }}
          onFinished={() => {
            if (isView) {
              onBack();
              return;
            }
            onNavigate({
              name: 'lesson_done',
              queue,
              batchIndex,
              batchType,
            });
          }}
          readOnly={isView}
        />
      </Layout>
    );
  }

  if (isWordReading) {
    return (
      <Layout
        onHome={onHome}
        onBack={onBack}
        subtitle={subtitle}
        footer={
          <div className="footer-nav footer-nav-word-reading">
            {queueProgressLabel ? (
              <p className="progress-label">{queueProgressLabel}</p>
            ) : null}
            <Button
              variant="primary"
              className="btn-talak-large"
              onClick={() => void finishWithoutAssessment()}
            >
              {nextLabel}
            </Button>
          </div>
        }
      >
        <WordReadingTaskView task={task} />
      </Layout>
    );
  }

  if (isWordChoice || isOddOneOut) {
    return (
      <Layout
        onHome={onHome}
        onBack={onBack}
        subtitle={subtitle}
        footer={
          <div className="footer-nav">
            {queueProgressLabel ? (
              <p className="progress-label">{queueProgressLabel}</p>
            ) : null}
            <div className="footer-actions">
              <Button variant="secondary" fullWidth={false} onClick={goPrev}>
                Atpakaļ
              </Button>
              <Button
                variant="primary"
                fullWidth={false}
                onClick={() => void finishWithoutAssessment()}
              >
                {nextLabel}
              </Button>
            </div>
          </div>
        }
      >
        {isWordChoice ? (
          <WordChoiceTaskView
            key={task.id}
            task={task}
            attempt={attempt}
            onUpdate={onUpdate}
            readOnly={isView}
          />
        ) : (
          <OddOneOutTaskView
            key={task.id}
            task={task}
            attempt={attempt}
            onUpdate={onUpdate}
            readOnly={isView}
          />
        )}
      </Layout>
    );
  }

  return (
    <Layout
      onHome={onHome}
      onBack={onBack}
      subtitle={subtitle}
      footer={
        <div className="footer-nav">
          {queueProgressLabel ? (
            <p className="progress-label">{queueProgressLabel}</p>
          ) : null}

          {isView ? (
            assessmentSavedBanner
          ) : (
            <>
              {showAssessmentIntro ? (
                <p className="assessment-intro">Novērtē, kā veicas</p>
              ) : null}

              {alreadyAssessed && attempt.selfAssessment ? (
                <p className="assessment-saved-label" role="status">
                  Pašvērtējums:{' '}
                  <strong>
                    {SELF_ASSESSMENT_LABELS[attempt.selfAssessment]}
                  </strong>
                </p>
              ) : null}

              <div
                className="assessment-row"
                role="group"
                aria-label="Pašvērtējums"
              >
                {(
                  [
                    ['independent', 'ok', 'Izdevās pašam', '✓'],
                    ['with_help', 'help', 'Ar palīdzību', '~'],
                    ['difficult', 'hard', 'Bija grūti', '✗'],
                  ] as const
                ).map(([value, tone, label, symbol]) => {
                  const selected = attempt.selfAssessment === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      className={`btn btn-assess btn-assess-${tone}${
                        selected ? ' btn-assess-selected' : ''
                      }`}
                      aria-label={label}
                      aria-pressed={selected}
                      onClick={() => void finishWith(value)}
                    >
                      <span className="assess-symbol" aria-hidden="true">
                        {symbol}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="footer-actions">
            <Button variant="secondary" fullWidth={false} onClick={goPrev}>
              Atpakaļ
            </Button>
            {isView || alreadyAssessed ? (
              <Button
                variant="primary"
                fullWidth={false}
                onClick={goNextTask}
              >
                {nextLabel}
              </Button>
            ) : (
              <Button
                variant="neutral"
                fullWidth={false}
                onClick={() => void finishWith('skipped')}
              >
                Tālāk
              </Button>
            )}
          </div>
        </div>
      }
    >
      {task.type === 'sentence_completion' && (
        <SentenceCompletionTaskView
          key={task.id}
          task={task}
          attempt={attempt}
          onUpdate={onUpdate}
          readOnly={isView}
        />
      )}
      {task.type === 'image_word' && (
        <ImageWordTaskView
          key={task.id}
          task={task}
          attempt={attempt}
          onUpdate={onUpdate}
          readOnly={isView}
        />
      )}
      {task.type === 'sentence_order' && (
        <SentenceOrderTaskView
          key={task.id}
          task={task}
          attempt={attempt}
          onUpdate={onUpdate}
          readOnly={isView}
        />
      )}
      {task.type === 'antonym' && (
        <AntonymTaskView
          key={task.id}
          task={task}
          attempt={attempt}
          onUpdate={onUpdate}
          readOnly={isView}
        />
      )}
      {task.type === 'definition_guess' && (
        <DefinitionGuessTaskView
          key={task.id}
          task={task}
          attempt={attempt}
          onUpdate={onUpdate}
          readOnly={isView}
        />
      )}
    </Layout>
  );
}
