import { useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { ListenButton } from '../../components/ListenButton';
import { buildAttemptUpdate } from '../../utils/buildAttemptUpdate';
import {
  playCorrectChime,
  playWrongBuzz,
} from '../../utils/answerFeedback';
import type { OddOneOutTask } from '../../types/task';
import type { TaskAttempt } from '../../types/progress';

interface Props {
  task: OddOneOutTask;
  attempt: TaskAttempt;
  onUpdate: (attempt: TaskAttempt) => void;
  readOnly?: boolean;
}

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
    /* plain option text */
  }
  return null;
}

/**
 * Four large choice buttons; one odd word out.
 * Wrong picks stay red; keep choosing until the odd word is found.
 * Correct → green + explanation; Tālāk unlocks only then (viewedAnswers).
 */
export function OddOneOutTaskView({
  task,
  attempt,
  onUpdate,
  readOnly = false,
}: Props) {
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
      });
      playCorrectChime();
      return;
    }

    const nextWrong = new Set(wrongIndices);
    nextWrong.add(index);
    setWrongIndices(nextWrong);
    selectedRef.current = index;
    setSelected(index);
    // Persist last try; do not unlock Tālāk (viewedAnswers stays false).
    patch({
      enteredAnswer: JSON.stringify(index),
      status: 'attempted',
    });
    playWrongBuzz();
  };

  const optionVariant = (index: number) => {
    if (solved && index === task.correctIndex) return 'success' as const;
    if (wrongIndices.has(index)) return 'danger' as const;
    if (selected === index && !solved) return 'danger' as const;
    return 'secondary' as const;
  };

  return (
    <div className="task-view">
      <div className="stack choice-stack odd-one-choice-stack">
        {task.options.map((option, index) => {
          const isWrong = wrongIndices.has(index);
          const isCorrectPick = solved && index === task.correctIndex;
          const showWrongMark = isWrong;
          const showCheck = isCorrectPick;

          return (
            <div key={`${index}-${option}`} className="odd-one-option-row">
              <Button
                variant={optionVariant(index)}
                className={[
                  'odd-one-option-btn',
                  showWrongMark || showCheck ? 'choice-option-with-mark' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-disabled={
                  readOnly || solved || isWrong || undefined
                }
                onClick={() => selectOption(index)}
                aria-pressed={isWrong || isCorrectPick}
              >
                {showCheck ? (
                  <span className="choice-feedback-mark" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
                {showWrongMark ? (
                  <span className="choice-feedback-mark" aria-hidden="true">
                    ✗
                  </span>
                ) : null}
                <span className="choice-option-label">{option}</span>
              </Button>
              <ListenButton
                text={option}
                compact
                hideError={index > 0}
                fullWidth={false}
                ariaLabel={`Klausīties: ${option}`}
                className="odd-one-listen"
              />
            </div>
          );
        })}
      </div>

      {solved ? (
        <div className="answers-box odd-one-out-result" role="status">
          <p className="answers-box-label">Liekais vārds</p>
          <p className="focus-sentence" lang="lv">
            {task.options[task.correctIndex]}
          </p>
          <p className="odd-one-out-explanation">{task.explanation}</p>
        </div>
      ) : null}
    </div>
  );
}
