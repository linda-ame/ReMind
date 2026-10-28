import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Layout } from '../components/Layout';
import { TaskAdvanceChrome } from '../components/TaskAdvanceChrome';
import {
  getTaskById,
  getTasksByType,
} from '../data/loadTasks';
import { useApp } from '../context/AppContext';
import { useTaskActiveTime } from '../hooks/useTaskActiveTime';
import {
  completeAttempt,
  countCompletedInSet,
  createAttempt,
  isTaskCompletedCurrent,
  latestAttemptForTask,
  SELF_ASSESSMENT_LABELS,
  SELF_ASSESSMENT_SYMBOLS,
} from '../utils/attempts';
import { taskHasAdvanceReady } from '../utils/taskAdvance';
import {
  filterSectionTasks,
  loadDifficultyLevels,
} from '../utils/difficulty';
import { SELF_ASSESSMENT_ENABLED } from '../config/features';
import type { Screen, TaskSessionMode } from '../navigation/types';
import type { SelfAssessment, TaskAttempt } from '../types/progress';
import type { Task } from '../types/task';
import { WordReadingTaskView } from './task/WordReadingTaskView';
import { SentenceCompletionTaskView } from './task/SentenceCompletionTaskView';
import { SentenceCompletionMultiTaskView } from './task/SentenceCompletionMultiTaskView';
import { ImageWordTaskView } from './task/ImageWordTaskView';
import { WordChoiceTaskView } from './task/WordChoiceTaskView';
import { ReadingComprehensionTaskView } from './task/ReadingComprehensionTaskView';
import { SentenceOrderTaskView } from './task/SentenceOrderTaskView';
import { OddOneOutTaskView } from './task/OddOneOutTaskView';
import { AntonymTaskView } from './task/AntonymTaskView';
import { DefinitionGuessTaskView } from './task/DefinitionGuessTaskView';
import { SentenceImageMatchTaskView } from './task/SentenceImageMatchTaskView';
import { SentenceCreationTaskView } from './task/SentenceCreationTaskView';
import { SpellingCheckTaskView } from './task/SpellingCheckTaskView';
import { BrandAssociationTaskView } from './task/BrandAssociationTaskView';
import { WordGridTaskView } from './task/WordGridTaskView';

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
  const { attempts, saveAttempt, skipTaskToday, getAttemptsForTask } = useApp();
  const task = getTaskById(taskId);
  const [attempt, setAttempt] = useState<TaskAttempt | null>(null);
  const attemptRef = useRef<TaskAttempt | null>(null);
  /** Blocks late child patches while complete+navigate is in flight. */
  const finishingRef = useRef(false);
  const isView = mode === 'view';

  const flushActiveTime = (id: string, activeMs: number) => {
    const current = attemptRef.current;
    if (isView || !current || current.id !== id) return;
    if ((current.activeMs ?? 0) === activeMs) return;
    const next = { ...current, activeMs };
    attemptRef.current = next;
    // Time on an unfinished task is not stored.
    if (next.status !== 'completed') return;
    void saveAttempt(next);
  };

  const stampActiveTime = useTaskActiveTime(
    attempt?.id ?? null,
    attempt?.activeMs ?? 0,
    !isView && attempt != null,
    flushActiveTime,
  );

  const setAttemptBoth = (next: TaskAttempt) => {
    attemptRef.current = next;
    setAttempt(next);
  };

  useEffect(() => {
    if (!task) return;
    finishingRef.current = false;
    let cancelled = false;

    // Forced empty start (progress was cleared for redo).
    if (fresh && !isView) {
      const a = createAttempt(task);
      setAttemptBoth(a);
      // Not persisted until the user answers / advances.
      return;
    }

    (async () => {
      // Active store, not only React state — it can lag one navigation behind.
      // Archived rows stay stored but are not resumed.
      const fromStore = await getAttemptsForTask(task.id);
      if (cancelled) return;
      const pool = fromStore.length > 0 ? fromStore : attempts;
      const previous = latestAttemptForTask(
        pool,
        task.id,
        task.contentVersion,
      );
      // A check saves a completed row. Unfinished tasks open empty,
      // except Atrodi vārdu, where a started grid (and its hint) is restored.
      const resumeWordGrid =
        previous != null &&
        task.type === 'word_grid' &&
        previous.status === 'attempted' &&
        previous.enteredAnswer != null;
      if (previous && (previous.status === 'completed' || resumeWordGrid)) {
        setAttemptBoth(previous);
        return;
      }
      setAttemptBoth(createAttempt(task));
    })();

    return () => {
      cancelled = true;
    };
    // Only re-init when the task changes; attempts is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [taskId, task, saveAttempt, isView, fresh, getAttemptsForTask]);

  const sectionLayout =
    batchType != null && batchIndex == null
      ? { sectionType: batchType, onNavigate }
      : {};

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
      <Layout onHome={onHome} {...sectionLayout}>
        <p className="lead">Uzdevums nav atrasts.</p>
      </Layout>
    );
  }

  if (!attempt) {
    return (
      <Layout onHome={onHome} {...sectionLayout}>
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
  const isSentenceCreation = task.type === 'sentence_creation';
  const isSpellingCheck = task.type === 'spelling_check';
  const isBrandAssociation = task.type === 'brand_association';
  const isWordGrid = task.type === 'word_grid';
  /** Same as existing choice / reading sections — no footer self-assessment. */
  const skipSelfAssessment =
    !SELF_ASSESSMENT_ENABLED ||
    isWordReading ||
    isWordChoice ||
    isOddOneOut ||
    isReading ||
    isSentenceCreation ||
    isSpellingCheck ||
    isBrandAssociation ||
    isWordGrid;
  const ratedAssessment =
    SELF_ASSESSMENT_ENABLED &&
    attempt.selfAssessment != null &&
    attempt.selfAssessment !== 'skipped'
      ? attempt.selfAssessment
      : null;
  /** Completed this visit (with or without a color rating). */
  const alreadyCompleted = attempt.status === 'completed';
  /** First task of first lesson — show self-assessment intro once per section. */
  const showAssessmentIntro =
    !skipSelfAssessment &&
    !isView &&
    !ratedAssessment &&
    !alreadyCompleted &&
    batchIndex === 0 &&
    idx === 0;

  const onUpdate = (next: TaskAttempt) => {
    if (isView || finishingRef.current) return;
    const base = attemptRef.current ?? attempt;
    // After advance completes the attempt, ignore late child patches
    // (they could wipe answers while save/navigation is in flight).
    if (base.status === 'completed') return;
    // Merge onto the latest parent snapshot so a stale child copy cannot
    // wipe rating / answer.
    let merged: TaskAttempt = stampActiveTime({
      ...base,
      ...next,
      id: base.id,
      taskId: base.taskId,
      contentVersion: base.contentVersion,
      startedAt: base.startedAt,
      selfAssessment: next.selfAssessment ?? base.selfAssessment,
      enteredAnswer:
        next.enteredAnswer != null && String(next.enteredAnswer).trim() !== ''
          ? next.enteredAnswer
          : next.enteredAnswer === null
            ? null
            : (base.enteredAnswer ?? null),
      viewedAnswers: Boolean(next.viewedAnswers || base.viewedAnswers),
      usedHint: Boolean(next.usedHint || base.usedHint),
      status: next.status ?? base.status,
      reading: next.reading ?? base.reading,
    });
    // The answer check finishes the task. Word reading has no check —
    // Tālāk still completes it. Reading finishes on the last question.
    if (
      task.type !== 'word_reading' &&
      task.type !== 'reading_comprehension' &&
      merged.viewedAnswers &&
      merged.status !== 'completed'
    ) {
      merged = completeAttempt(merged, merged.selfAssessment);
    }
    // Re-check: finishAndGoNext may have completed mid-function.
    if (finishingRef.current || attemptRef.current?.status === 'completed') {
      return;
    }
    setAttemptBoth(merged);
    if (
      merged.status === 'completed' ||
      (task.type === 'word_grid' && merged.status === 'attempted')
    ) {
      void saveAttempt(merged);
    }
  };

  /** Home → section: random remaining tasks (no lesson batches). */
  const isSectionPractice =
    batchType != null && batchIndex === undefined && !fresh && !isView;

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
    // Section practice: finished all remaining → celebrate / offer reset.
    if (isSectionPractice && batchType) {
      onNavigate({
        name: 'section_complete',
        type: batchType,
        difficultyLevels: loadDifficultyLevels(batchType),
      });
      return;
    }
    // End of practice queue (legacy lesson or “atkārtot grūtos”) → done screen.
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
    if (finishingRef.current) return;
    finishingRef.current = true;
    const base = attemptRef.current ?? attempt;
    const done = completeAttempt(stampActiveTime(base), null);
    setAttemptBoth(done);
    try {
      await saveAttempt(done);
    } finally {
      goNextTask();
    }
  };

  /** Select rating only — stay on the task (same pattern as reading comprehension). */
  const selectAssessment = (assessment: SelfAssessment) => {
    if (isView || finishingRef.current) return;
    const base = attemptRef.current ?? attempt;
    if (base.status === 'completed') return;
    const next: TaskAttempt = stampActiveTime({
      ...base,
      selfAssessment: assessment,
      status: 'attempted',
    });
    setAttemptBoth(next);
    if (next.status === 'completed') void saveAttempt(next);
  };

  /** Complete with current (or given) rating, then advance. */
  const finishAndGoNext = async (assessment?: SelfAssessment | null) => {
    if (isView) {
      goNextTask();
      return;
    }
    if (finishingRef.current) return;
    finishingRef.current = true;
    const base = attemptRef.current ?? attempt;
    const finalAssessment =
      assessment !== undefined
        ? assessment
        : (base.selfAssessment ?? 'skipped');
    const done = completeAttempt(stampActiveTime(base), finalAssessment);
    setAttemptBoth(done);
    try {
      await saveAttempt(done);
    } finally {
      goNextTask();
    }
  };

  /** Skip for today — do not mark completed; go to next in queue. */
  const skipAndGoNext = () => {
    if (isView || finishingRef.current) return;
    finishingRef.current = true;
    skipTaskToday(task.id);
    goNextTask();
  };

  const handleAdvance = () => {
    if (isView || alreadyCompleted) {
      goNextTask();
      return;
    }
    if (skipSelfAssessment) {
      void finishWithoutAssessment();
      return;
    }
    void finishAndGoNext();
  };

  const nextLabel = isView
    ? isLast
      ? 'Aizvērt'
      : 'Tālāk'
    : isLast
      ? 'Pabeigt'
      : 'Tālāk';

  /** Selected difficulty pool (same filter as home), not the whole section. */
  const sectionTasks =
    isSectionPractice && batchType
      ? filterSectionTasks(
          getTasksByType(batchType),
          batchType,
          loadDifficultyLevels(batchType),
        )
      : null;
  const sectionTotal = sectionTasks?.length ?? 0;
  const sectionDone = sectionTasks
    ? countCompletedInSet(
        sectionTasks.map((t) => t.id),
        attempts,
        new Map(sectionTasks.map((t) => [t.id, t])),
      )
    : 0;
  const currentAlreadyInCount =
    sectionTasks?.some((t) => t.id === task.id) &&
    isTaskCompletedCurrent(attempts, task);
  /** This visit counts in the numerator before the store catches up. */
  const shownDone =
    alreadyCompleted && !currentAlreadyInCount
      ? Math.min(sectionDone + 1, sectionTotal)
      : alreadyCompleted
        ? sectionDone
        : Math.min(sectionDone + 1, sectionTotal);
  /** Progress within the chosen difficulty set (current counts once completed). */
  const queueProgressLabel =
    !isReading && sectionTasks && sectionTotal > 0
      ? `${shownDone} / ${sectionTotal}`
      : queue.length > 0 && idx >= 0 && !isReading
        ? `${idx + 1}. no ${queue.length}`
        : null;

  const assessmentBlock =
    skipSelfAssessment || isView ? null : (
      <>
        {showAssessmentIntro ? (
          <p className="assessment-intro">Novērtē, kā veicas</p>
        ) : null}

        {ratedAssessment ? (
          <p className="assessment-saved-label" role="status">
            Pašvērtējums:{' '}
            <strong>{SELF_ASSESSMENT_LABELS[ratedAssessment]}</strong>
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
                onClick={() => selectAssessment(value)}
              >
                <span className="assess-symbol" aria-hidden="true">
                  {symbol}
                </span>
              </button>
            );
          })}
        </div>
      </>
    );

  const canAdvance =
    isView ||
    alreadyCompleted ||
    taskHasAdvanceReady(task, attempt);

  const wrapTask = (body: ReactNode) => (
    <TaskAdvanceChrome
      canAdvance={canAdvance}
      onAdvance={handleAdvance}
      onSkip={isView ? undefined : skipAndGoNext}
      advanceLabel={nextLabel}
      progressLabel={queueProgressLabel}
    >
      <div className="task-screen">
        <div className="task-screen-body">
          {body}
          {assessmentBlock}
          {isView && ratedAssessment ? (
            <div
              className={`assessment-saved assessment-saved-${ratedAssessment}`}
              role="status"
            >
              <span className="assess-symbol" aria-hidden="true">
                {SELF_ASSESSMENT_SYMBOLS[ratedAssessment]}
              </span>
              <span>{SELF_ASSESSMENT_LABELS[ratedAssessment]}</span>
            </div>
          ) : null}
        </div>
      </div>
    </TaskAdvanceChrome>
  );

  if (isReading) {
    return (
      <Layout onHome={onHome} {...sectionLayout}>
        <ReadingComprehensionTaskView
          key={`${task.id}-${mode}`}
          task={task}
          attempt={attempt}
          onUpdate={(next) => {
            const alreadySaved = attemptRef.current?.status === 'completed';
            const stamped = isView ? next : stampActiveTime(next);
            setAttemptBoth(stamped);
            if (isView || alreadySaved || stamped.status !== 'completed') return;
            return saveAttempt(stamped);
          }}
          onFinished={() => {
            if (isView) {
              onBack();
              return;
            }
            goNextTask();
          }}
          onSkip={isView ? undefined : skipAndGoNext}
          readOnly={isView}
        />
      </Layout>
    );
  }

  if (isWordReading) {
    return (
      <Layout onHome={onHome} {...sectionLayout}>
        {wrapTask(<WordReadingTaskView task={task} />)}
      </Layout>
    );
  }

  if (isWordGrid && task.type === 'word_grid') {
    return (
      <Layout onHome={onHome} {...sectionLayout}>
        {wrapTask(
          <WordGridTaskView
            key={task.id}
            task={task}
            attempt={attempt}
            onUpdate={onUpdate}
            readOnly={isView}
          />,
        )}
      </Layout>
    );
  }

  if (isWordChoice || isOddOneOut) {
    return (
      <Layout onHome={onHome} {...sectionLayout}>
        {wrapTask(
          isWordChoice ? (
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
          ),
        )}
      </Layout>
    );
  }

  return (
    <Layout onHome={onHome} {...sectionLayout}>
      {wrapTask(
        <>
          {task.type === 'sentence_completion' && (
            <SentenceCompletionTaskView
              key={task.id}
              task={task}
              attempt={attempt}
              onUpdate={onUpdate}
              readOnly={isView}
            />
          )}
          {task.type === 'sentence_completion_multi' && (
            <SentenceCompletionMultiTaskView
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
          {task.type === 'sentence_image_match' && (
            <SentenceImageMatchTaskView
              key={task.id}
              task={task}
              attempt={attempt}
              onUpdate={onUpdate}
              readOnly={isView}
            />
          )}
          {task.type === 'sentence_creation' && (
            <SentenceCreationTaskView
              key={task.id}
              task={task}
              attempt={attempt}
              onUpdate={onUpdate}
              readOnly={isView}
            />
          )}
          {task.type === 'spelling_check' && (
            <SpellingCheckTaskView
              key={task.id}
              task={task}
              attempt={attempt}
              onUpdate={onUpdate}
              readOnly={isView}
            />
          )}
          {task.type === 'brand_association' && (
            <BrandAssociationTaskView
              key={task.id}
              task={task}
              attempt={attempt}
              onUpdate={onUpdate}
              readOnly={isView}
            />
          )}
        </>,
      )}
    </Layout>
  );
}
