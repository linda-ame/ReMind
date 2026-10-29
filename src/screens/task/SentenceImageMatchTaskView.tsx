import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { ListenButton } from '../../components/ListenButton';
import { buildAttemptUpdate } from '../../utils/buildAttemptUpdate';
import {
  playCorrectChime,
  playWrongBuzz,
} from '../../utils/answerFeedback';
import type { SentenceImageMatchTask } from '../../types/task';
import type { TaskAttempt } from '../../types/progress';

interface Props {
  task: SentenceImageMatchTask;
  attempt: TaskAttempt;
  onUpdate: (attempt: TaskAttempt) => void;
  readOnly?: boolean;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

function parseSelectedIndex(
  entered: string | null,
  optionCount: number,
): number | null {
  if (entered == null || entered === '') return null;
  try {
    const parsed: unknown = JSON.parse(entered);
    if (
      typeof parsed === 'number' &&
      Number.isInteger(parsed) &&
      parsed >= 0 &&
      parsed < optionCount
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Read a sentence (with listen), tap an image — instant green ✓ / red ✗.
 * Wrong picks stay marked; keep choosing until the correct image is found.
 * Each image can be opened enlarged (large Aizvērt to dismiss).
 */
export function SentenceImageMatchTaskView({
  task,
  attempt,
  onUpdate,
  readOnly = false,
}: Props) {
  const titleId = useId();
  const enlargeCloseRef = useRef<HTMLButtonElement>(null);
  const initialPick = parseSelectedIndex(
    attempt.enteredAnswer,
    task.options.length,
  );
  const startedSolved =
    readOnly ||
    attempt.viewedAnswers ||
    (initialPick !== null && initialPick === task.correctIndex);

  const [wrongIndices, setWrongIndices] = useState<Set<number>>(() => {
    if (startedSolved) return new Set();
    if (initialPick !== null && initialPick !== task.correctIndex) {
      return new Set([initialPick]);
    }
    return new Set();
  });
  const [selected, setSelected] = useState<number | null>(() =>
    startedSolved ? (initialPick ?? task.correctIndex) : null,
  );
  const selectedRef = useRef(selected);
  const [solved, setSolved] = useState(startedSolved);
  const wrongTriesRef = useRef(attempt.wrongTries ?? 0);
  const [enlargeIndex, setEnlargeIndex] = useState<number | null>(null);

  useEffect(() => {
    if (enlargeIndex == null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    enlargeCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEnlargeIndex(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [enlargeIndex]);

  const patch = (partial: Partial<TaskAttempt>) => {
    if (readOnly) return;
    const entered =
      selectedRef.current == null
        ? null
        : JSON.stringify(selectedRef.current);
    onUpdate(buildAttemptUpdate(attempt, partial, entered));
  };

  const selectOption = (index: number) => {
    if (readOnly || solved) return;
    if (wrongIndices.has(index)) return;

    if (index === task.correctIndex) {
      selectedRef.current = index;
      setSelected(index);
      setSolved(true);
      patch({
        enteredAnswer: JSON.stringify(index),
        viewedAnswers: true,
        status: 'attempted',
        wrongTries: wrongTriesRef.current,
      });
      playCorrectChime();
      return;
    }

    const nextWrong = new Set(wrongIndices);
    nextWrong.add(index);
    setWrongIndices(nextWrong);
    selectedRef.current = index;
    setSelected(index);
    wrongTriesRef.current += 1;
    patch({
      enteredAnswer: JSON.stringify(index),
      status: 'attempted',
      wrongTries: wrongTriesRef.current,
    });
    playWrongBuzz();
  };

  const optionState = (index: number) => {
    if (solved && index === task.correctIndex) return 'correct' as const;
    if (wrongIndices.has(index)) return 'wrong' as const;
    return 'idle' as const;
  };

  const enlarged = enlargeIndex != null ? task.options[enlargeIndex] : null;

  return (
    <div className="task-view sentence-image-match">
      <p className="instruction">{task.instruction}</p>
      <p className="focus-sentence sim-prompt" lang="lv">
        {task.prompt}
      </p>

      <div className="listen-row">
        <ListenButton
          text={task.prompt}
          ariaLabel="Klausīties teikumu"
        />
      </div>

      <div
        className="sim-grid"
        role="listbox"
        aria-label="Attēla varianti"
        aria-activedescendant={
          selected != null ? `sim-opt-${task.id}-${selected}` : undefined
        }
      >
        {task.options.map((option, index) => {
          const state = optionState(index);
          const letter = OPTION_LETTERS[index] ?? String(index + 1);
          const isWrong = wrongIndices.has(index);
          const isCorrectPick = solved && index === task.correctIndex;
          const locked = readOnly || solved || isWrong;

          return (
            <div
              key={`${task.id}-${index}`}
              className={`sim-option sim-option-${state}`}
            >
              <button
                type="button"
                id={`sim-opt-${task.id}-${index}`}
                role="option"
                aria-selected={isCorrectPick || selected === index}
                aria-disabled={locked || undefined}
                className={[
                  'sim-option-select',
                  isCorrectPick || isWrong ? 'sim-option-with-mark' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => selectOption(index)}
              >
                <span className="sim-option-letter" aria-hidden="true">
                  {letter}
                </span>
                <img
                  className="sim-option-image"
                  src={option.imageSrc}
                  alt={option.imageAlt}
                  draggable={false}
                />
                {isCorrectPick ? (
                  <span className="sim-feedback-mark sim-feedback-ok" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
                {isWrong ? (
                  <span className="sim-feedback-mark sim-feedback-no" aria-hidden="true">
                    ✗
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                className="sim-enlarge-btn"
                onClick={() => setEnlargeIndex(index)}
                aria-label={`Palielināt ${letter}. attēla variantu`}
              >
                Palielināt
              </button>
            </div>
          );
        })}
      </div>

      {solved ? (
        <div className="answers-box sim-result" role="status">
          <p className="answers-box-label">Pareizais attēls</p>
          <p className="sim-result-letter" lang="lv">
            {(OPTION_LETTERS[task.correctIndex] ?? String(task.correctIndex + 1))
            }. variants
          </p>
          <p className="sim-explanation">{task.explanation}</p>
        </div>
      ) : null}

      {enlarged && enlargeIndex != null ? (
        <div
          className="sim-lightbox"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="sim-lightbox-panel">
            <p id={titleId} className="sim-lightbox-title">
              {(OPTION_LETTERS[enlargeIndex] ?? String(enlargeIndex + 1))
              }. attēla variants
            </p>
            <img
              className="sim-lightbox-image"
              src={enlarged.imageSrc}
              alt={enlarged.imageAlt}
            />
            <Button
              ref={enlargeCloseRef}
              variant="primary"
              className="sim-lightbox-close"
              onClick={() => setEnlargeIndex(null)}
            >
              Aizvērt
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
