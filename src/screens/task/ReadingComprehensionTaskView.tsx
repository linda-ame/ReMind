import { useEffect, useId, useRef, useState } from 'react';
import { AnswerField } from '../../components/AnswerField';
import { Button } from '../../components/Button';
import { ListenButton } from '../../components/ListenButton';
import {
  SELF_ASSESSMENT_LABELS,
  SELF_ASSESSMENT_SYMBOLS,
} from '../../utils/attempts';
import type { ReadingComprehensionTask } from '../../types/task';
import type {
  ReadingComprehensionProgress,
  ReadingQuestionProgress,
  SelfAssessment,
  TaskAttempt,
} from '../../types/progress';

interface Props {
  task: ReadingComprehensionTask;
  attempt: TaskAttempt;
  /** May return a Promise — finish waits so the last answer is on disk. */
  onUpdate: (attempt: TaskAttempt) => void | Promise<void>;
  onFinished: () => void;
  readOnly?: boolean;
}

function ensureReading(
  attempt: TaskAttempt,
  task: ReadingComprehensionTask,
): ReadingComprehensionProgress {
  if (
    attempt.reading &&
    attempt.reading.questions.length === task.questions.length
  ) {
    return attempt.reading;
  }
  return {
    phase: 'passage',
    questionIndex: 0,
    questions: task.questions.map((q) => {
      const existing = attempt.reading?.questions.find(
        (x) => x.questionId === q.id,
      );
      return (
        existing ?? {
          questionId: q.id,
          enteredAnswer: null,
          viewedAnswers: false,
          rereadCount: 0,
          selfAssessment: null,
          status: 'viewed' as const,
          completedAt: null,
        }
      );
    }),
  };
}

/**
 * Passage → one question at a time → fullscreen reread → self-assessment.
 * Assessment is optional; if chosen, it is saved immediately.
 */
export function ReadingComprehensionTaskView({
  task,
  attempt,
  onUpdate,
  onFinished,
  readOnly = false,
}: Props) {
  const saved = ensureReading(attempt, task);
  const [uiPhase, setUiPhase] = useState<'passage' | 'questions'>(
    readOnly ? 'passage' : saved.phase,
  );
  const [uiQIndex, setUiQIndex] = useState(
    readOnly ? 0 : saved.questionIndex,
  );
  const [showPassageOverlay, setShowPassageOverlay] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const answerInputRef = useRef<HTMLInputElement>(null);
  const overlayCloseRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const overlayTitleId = useId();

  const phase = readOnly ? uiPhase : saved.phase;
  const qIndex = Math.min(
    Math.max(0, readOnly ? uiQIndex : saved.questionIndex),
    Math.max(0, task.questions.length - 1),
  );
  const question = task.questions[qIndex];
  const qProgress: ReadingQuestionProgress | undefined =
    saved.questions[qIndex];

  useEffect(() => {
    if (phase !== 'questions' || !qProgress) return;
    setShowAnswer(readOnly || qProgress.viewedAnswers);
  }, [phase, qIndex, qProgress, readOnly]);

  useEffect(() => {
    if (!showPassageOverlay) return;
    overlayCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOverlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPassageOverlay]);

  const persist = (next: TaskAttempt): void | Promise<void> => {
    if (readOnly) return;
    return onUpdate(next);
  };

  const patchReading = (
    partial: Partial<ReadingComprehensionProgress>,
    status: TaskAttempt['status'] = 'attempted',
  ) => {
    const nextReading = { ...ensureReading(attempt, task), ...partial };
    persist({
      ...attempt,
      status: attempt.status === 'completed' ? 'completed' : status,
      reading: nextReading,
    });
  };

  const patchQuestion = (
    index: number,
    partial: Partial<ReadingQuestionProgress>,
  ) => {
    const current = ensureReading(attempt, task);
    const questions = current.questions.map((q, i) =>
      i === index
        ? {
            ...q,
            ...partial,
            status:
              partial.status ??
              (partial.selfAssessment || partial.enteredAnswer
                ? 'attempted'
                : q.status),
          }
        : q,
    );
    persist({
      ...attempt,
      status: attempt.status === 'completed' ? 'completed' : 'attempted',
      reading: { ...current, questions },
    });
  };

  const startQuestions = () => {
    if (readOnly) {
      setUiPhase('questions');
      setUiQIndex(0);
      return;
    }
    patchReading({ phase: 'questions', questionIndex: 0 });
    queueMicrotask(() => answerInputRef.current?.focus());
  };

  const openOverlay = (fromEl?: HTMLElement | null) => {
    returnFocusRef.current = fromEl ?? (document.activeElement as HTMLElement);
    if (!readOnly && phase === 'questions') {
      patchQuestion(qIndex, {
        rereadCount: (qProgress?.rereadCount ?? 0) + 1,
      });
    }
    setShowPassageOverlay(true);
  };

  const closeOverlay = () => {
    setShowPassageOverlay(false);
    queueMicrotask(() => {
      const el = returnFocusRef.current;
      if (el && typeof el.focus === 'function') el.focus();
      else answerInputRef.current?.focus();
    });
  };

  const goPrevQuestion = () => {
    if (qIndex <= 0) {
      if (readOnly) {
        setUiPhase('passage');
        setUiQIndex(0);
        return;
      }
      patchReading({ phase: 'passage', questionIndex: 0 }, attempt.status);
      return;
    }
    if (readOnly) {
      setUiQIndex(qIndex - 1);
      return;
    }
    patchReading({
      phase: 'questions',
      questionIndex: qIndex - 1,
    });
  };

  const finishQuestionAndAdvance = async (
    assessment: SelfAssessment | null,
  ) => {
    if (readOnly) {
      if (qIndex >= task.questions.length - 1) {
        onFinished();
        return;
      }
      setUiQIndex(qIndex + 1);
      return;
    }

    const now = new Date().toISOString();
    const current = ensureReading(attempt, task);
    const questions = current.questions.map((q, i) =>
      i === qIndex
        ? {
            ...q,
            selfAssessment: assessment ?? q.selfAssessment,
            status: 'completed' as const,
            completedAt: now,
          }
        : q,
    );

    if (qIndex >= task.questions.length - 1) {
      await Promise.resolve(
        persist({
          ...attempt,
          status: 'completed',
          completedAt: now,
          selfAssessment: assessment,
          reading: {
            phase: 'questions',
            questionIndex: qIndex,
            questions,
          },
        }),
      );
      onFinished();
      return;
    }

    await Promise.resolve(
      persist({
        ...attempt,
        status: 'attempted',
        reading: {
          phase: 'questions',
          questionIndex: qIndex + 1,
          questions,
        },
      }),
    );
    queueMicrotask(() => answerInputRef.current?.focus());
  };

  const selectAssessment = (value: SelfAssessment) => {
    if (readOnly) return;
    patchQuestion(qIndex, {
      selfAssessment: value,
      status: 'attempted',
    });
  };

  if (phase === 'passage') {
    return (
      <div className="task-view rc-view">
        <p className="instruction">{task.instruction}</p>
        <div className="rc-passage" lang="lv">
          {task.passage}
        </div>
        <div className="listen-row">
          <ListenButton
            text={task.passage}
            label="Klausīties tekstu"
            ariaLabel="Klausīties tekstu"
            className="btn-rc-primary"
          />
        </div>
        <div className="rc-actions">
          <Button
            variant="primary"
            className="btn-rc-primary"
            onClick={startQuestions}
          >
            Sākt jautājumus
          </Button>
        </div>
      </div>
    );
  }

  if (!question || !qProgress) {
    return (
      <div className="task-view">
        <p className="lead">Jautājums nav atrasts.</p>
      </div>
    );
  }

  const alreadyAssessed = qProgress.selfAssessment != null;

  return (
    <div className="task-view rc-view">
      <p className="progress-label rc-q-progress">
        Jautājums {qIndex + 1}. no {task.questions.length}
      </p>

      <p className="focus-sentence rc-question" lang="lv">
        {question.question}
      </p>

      <div className="listen-row">
        <ListenButton
          text={question.question}
          label="Klausīties jautājumu"
          ariaLabel="Klausīties jautājumu"
        />
      </div>

      <AnswerField
        id="rc-answer-input"
        label="Atbilde (nav obligāti)"
        value={qProgress.enteredAnswer ?? ''}
        placeholder="Ierakstiet vai ierunājiet atbildi…"
        readOnly={readOnly}
        inputRef={answerInputRef}
        onChange={(value) => {
          if (readOnly) return;
          patchQuestion(qIndex, {
            enteredAnswer: value,
            status: 'attempted',
          });
        }}
      />

      <div className="rc-actions rc-actions-stack">
        <Button
          variant="secondary"
          className="btn-rc-primary"
          onClick={(e) => openOverlay(e.currentTarget)}
        >
          Pārlasīt tekstu
        </Button>

        {!readOnly && !showAnswer ? (
          <Button
            variant="secondary"
            className="btn-reveal-answer btn-rc-primary"
            onClick={() => {
              setShowAnswer(true);
              patchQuestion(qIndex, { viewedAnswers: true });
            }}
          >
            Parādīt atbildi
          </Button>
        ) : null}

        {(showAnswer || readOnly) && question.answers.length > 0 ? (
          <div className="answers-box" role="status">
            <p className="answers-box-label">Pareizā atbilde</p>
            <ul className="answers-list">
              {question.answers.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {!readOnly ? (
        <div className="rc-assess-block">
          <p className="assessment-intro">Novērtē, kā veicas</p>
          {alreadyAssessed && qProgress.selfAssessment ? (
            <p className="assessment-saved-label" role="status">
              Pašvērtējums:{' '}
              <strong>
                {SELF_ASSESSMENT_LABELS[qProgress.selfAssessment]}
              </strong>
            </p>
          ) : null}
          <div
            className="assessment-row rc-assessment-row"
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
              const selected = qProgress.selfAssessment === value;
              return (
                <button
                  key={value}
                  type="button"
                  className={`btn btn-assess btn-assess-${tone} btn-assess-rc${
                    selected ? ' btn-assess-selected' : ''
                  }`}
                  aria-label={label}
                  aria-pressed={selected}
                  onClick={() => selectAssessment(value)}
                >
                  <span className="assess-symbol" aria-hidden="true">
                    {symbol}
                  </span>
                  <span className="assess-label-text">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : alreadyAssessed && qProgress.selfAssessment ? (
        <div
          className={`assessment-saved assessment-saved-${qProgress.selfAssessment}`}
          role="status"
        >
          <span className="assess-symbol" aria-hidden="true">
            {SELF_ASSESSMENT_SYMBOLS[qProgress.selfAssessment]}
          </span>
          <span>{SELF_ASSESSMENT_LABELS[qProgress.selfAssessment]}</span>
        </div>
      ) : null}

      <div className="footer-actions rc-nav-actions">
        <Button variant="secondary" fullWidth={false} onClick={goPrevQuestion}>
          Atpakaļ
        </Button>
        <Button
          variant="primary"
          fullWidth={false}
          onClick={() =>
            void finishQuestionAndAdvance(
              readOnly ? null : qProgress.selfAssessment,
            )
          }
        >
          {qIndex >= task.questions.length - 1
            ? readOnly
              ? 'Aizvērt'
              : 'Pabeigt'
            : 'Nākamais'}
        </Button>
      </div>

      {showPassageOverlay ? (
        <div
          className="rc-passage-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={overlayTitleId}
        >
          <div className="rc-passage-overlay-bar">
            <h2 id={overlayTitleId} className="rc-passage-overlay-title">
              Teksts
            </h2>
            <button
              type="button"
              className="rc-passage-overlay-x"
              aria-label="Aizvērt tekstu"
              onClick={closeOverlay}
            >
              ×
            </button>
          </div>
          <div className="rc-passage-overlay-body" lang="lv">
            {task.passage}
          </div>
          <div className="rc-passage-overlay-footer">
            <ListenButton
              text={task.passage}
              label="Klausīties tekstu"
              ariaLabel="Klausīties tekstu"
              className="btn-rc-primary"
            />
            <Button
              ref={overlayCloseRef}
              variant="primary"
              className="btn-rc-primary"
              onClick={closeOverlay}
            >
              Aizvērt tekstu
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
