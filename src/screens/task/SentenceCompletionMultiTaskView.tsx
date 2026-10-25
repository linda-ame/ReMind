import { useRef, useState } from 'react';
import { AnswerField } from '../../components/AnswerField';
import { ListenButton } from '../../components/ListenButton';
import { playCorrectChime } from '../../utils/answerFeedback';
import {
  answerInputFeedback,
  textMatchesAccepted,
} from '../../utils/answers';
import { buildAttemptUpdate } from '../../utils/buildAttemptUpdate';
import type { SentenceCompletionMultiTask } from '../../types/task';
import type { TaskAttempt } from '../../types/progress';

interface Props {
  task: SentenceCompletionMultiTask;
  attempt: TaskAttempt;
  onUpdate: (attempt: TaskAttempt) => void;
  readOnly?: boolean;
}

/** Restore per-blank answers from JSON string[]. */
function parseBlanks(entered: string | null, blankCount: number): string[] {
  const empty = Array.from({ length: blankCount }, () => '');
  if (!entered) return empty;
  try {
    const parsed: unknown = JSON.parse(entered);
    if (Array.isArray(parsed)) {
      return empty.map((_, i) =>
        typeof parsed[i] === 'string' ? parsed[i]! : '',
      );
    }
  } catch {
    /* ignore */
  }
  return empty;
}

function serializeBlanks(blanks: string[]): string | null {
  if (blanks.every((b) => !b.trim())) return null;
  return JSON.stringify(blanks);
}

/** Split sentence on `___` for display with numbered blank markers. */
function sentenceParts(sentence: string): string[] {
  return sentence.split('___');
}

/**
 * Multi-blank sentence completion (2–3 blanks).
 * Each blank has its own field; one self-assessment for the whole task.
 * Soft matching only — other phrasings may also be fine.
 */
export function SentenceCompletionMultiTaskView({
  task,
  attempt,
  onUpdate,
  readOnly = false,
}: Props) {
  const blankCount = task.answersByBlank.length;
  const [blanks, setBlanks] = useState(() =>
    parseBlanks(attempt.enteredAnswer, blankCount),
  );
  const blanksRef = useRef(blanks);
  const [answerChecked, setAnswerChecked] = useState(
    () => attempt.viewedAnswers,
  );
  const [submittedBlank, setSubmittedBlank] = useState<Set<number>>(
    () =>
      attempt.viewedAnswers
        ? new Set(Array.from({ length: blankCount }, (_, i) => i))
        : new Set(),
  );
  const chimedRef = useRef(false);

  const parts = sentenceParts(task.sentence);

  const patch = (partial: Partial<TaskAttempt>) => {
    if (readOnly) return;
    onUpdate(
      buildAttemptUpdate(
        attempt,
        partial,
        serializeBlanks(blanksRef.current),
      ),
    );
  };

  const setBlankAndPersist = (index: number, value: string) => {
    if (readOnly) return;
    const next = blanksRef.current.map((b, i) => (i === index ? value : b));
    blanksRef.current = next;
    setBlanks(next);
    patch({
      enteredAnswer: serializeBlanks(next),
      status: 'attempted',
    });
  };

  const allFilled = blanks.every((b) => b.trim() !== '');

  const onSubmitBlank = (index: number, text: string) => {
    if (readOnly) return;
    const next = blanksRef.current.map((b, i) => (i === index ? text : b));
    blanksRef.current = next;
    setBlanks(next);

    const nextSubmitted = new Set(submittedBlank);
    nextSubmitted.add(index);
    setSubmittedBlank(nextSubmitted);

    const filled = next.every((b) => b.trim() !== '');
    // Unlock Tālāk once every blank has content and at least one submit.
    const unlock = filled;
    if (unlock) {
      setAnswerChecked(true);
    }

    patch({
      viewedAnswers: unlock || attempt.viewedAnswers,
      enteredAnswer: serializeBlanks(next),
      status: 'attempted',
    });

    if (
      unlock &&
      !chimedRef.current &&
      task.answersByBlank.every((accepted, i) =>
        textMatchesAccepted(next[i] ?? '', accepted, task.type),
      )
    ) {
      chimedRef.current = true;
      playCorrectChime();
    }
  };

  const showAnswers = answerChecked || readOnly;

  return (
    <div className="task-view scm-view">
      <p className="instruction">{task.instruction}</p>

      <p className="focus-sentence scm-sentence" lang="lv">
        {parts.map((part, i) => (
          <span key={`part-${i}`}>
            {part}
            {i < blankCount ? (
              <span className="scm-blank-mark" aria-label={`${i + 1}. tukšums`}>
                ({i + 1})
              </span>
            ) : null}
          </span>
        ))}
      </p>

      <div className="listen-row">
        <ListenButton
          text={task.sentence.replace(/___/g, '…')}
          ariaLabel="Klausīties teikumu"
        />
      </div>

      <div className="scm-blanks">
        {task.answersByBlank.map((accepted, index) => (
          <AnswerField
            key={`blank-${index}`}
            id={`scm-answer-${index}`}
            label={`${index + 1}. tukšums`}
            value={blanks[index] ?? ''}
            placeholder="Ierakstiet vai ierunājiet atbildi…"
            readOnly={readOnly}
            onChange={(value) => setBlankAndPersist(index, value)}
            onSubmit={(text) => onSubmitBlank(index, text)}
            feedback={answerInputFeedback(
              showAnswers || submittedBlank.has(index),
              blanks[index] ?? '',
              accepted,
              task.type,
            )}
          />
        ))}
      </div>

      {showAnswers ? (
        <div className="answers-box scm-answers" role="status">
          <p className="answers-box-label">Iespējamās atbildes</p>
          <ol className="scm-answer-list">
            {task.answersByBlank.map((accepted, index) => (
              <li key={`ans-${index}`} className="scm-answer-item" lang="lv">
                <span className="scm-answer-index">{index + 1}.</span>{' '}
                {accepted.map((a) => `"${a}"`).join(', ')}
              </li>
            ))}
          </ol>
          <p className="scm-model-label">Parauga teikums</p>
          <p className="focus-sentence scm-model-text" lang="lv">
            {task.modelText}
          </p>
        </div>
      ) : allFilled ? (
        <p className="scm-submit-hint">
          Nospiediet Enter kādā no laukiem, lai pārbaudītu.
        </p>
      ) : null}
    </div>
  );
}
