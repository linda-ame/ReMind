import { useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { buildAttemptUpdate } from '../../utils/buildAttemptUpdate';
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
 * Same interaction pattern as word_choice (single-select + reveal).
 * No instruction heading — section title already says «Atrodi lieko vārdu».
 * No self-assessment — Next is in TaskScreen.
 */
export function OddOneOutTaskView({
  task,
  attempt,
  onUpdate,
  readOnly = false,
}: Props) {
  const [selected, setSelected] = useState<number | null>(() =>
    parseSelectedIndex(attempt.enteredAnswer, task.options.length),
  );
  const selectedRef = useRef(selected);
  const [revealed, setRevealed] = useState(
    readOnly || attempt.viewedAnswers,
  );

  const patch = (partial: Partial<TaskAttempt>) => {
    if (readOnly) return;
    const entered =
      selectedRef.current == null
        ? null
        : JSON.stringify(selectedRef.current);
    onUpdate(buildAttemptUpdate(attempt, partial, entered));
  };

  const selectOption = (index: number) => {
    if (readOnly || revealed) return;
    const next = selected === index ? null : index;
    selectedRef.current = next;
    setSelected(next);
    patch({
      enteredAnswer: next == null ? null : JSON.stringify(next),
      status: 'attempted',
    });
  };

  const retry = () => {
    if (readOnly) return;
    setRevealed(false);
    selectedRef.current = null;
    setSelected(null);
    patch({
      enteredAnswer: null,
      viewedAnswers: false,
      status: 'attempted',
    });
  };

  const optionVariant = (index: number) => {
    const isSelected = selected === index;
    const isCorrect = index === task.correctIndex;

    if (revealed) {
      if (isCorrect) return 'success' as const;
      if (isSelected) return 'selected' as const;
      return 'secondary' as const;
    }

    return isSelected ? ('selected' as const) : ('secondary' as const);
  };

  return (
    <div className="task-view">
      <div className="stack choice-stack">
        {task.options.map((option, index) => (
          <Button
            key={`${index}-${option}`}
            variant={optionVariant(index)}
            aria-disabled={readOnly || revealed || undefined}
            onClick={() => selectOption(index)}
            aria-pressed={selected === index}
          >
            {option}
          </Button>
        ))}
      </div>

      {!revealed && !readOnly ? (
        <div className="hint-answers">
          <div className="btn-row">
            <Button
              variant="secondary"
              className="btn-reveal-answer"
              disabled={selected == null}
              onClick={() => {
                setRevealed(true);
                patch({
                  viewedAnswers: true,
                  enteredAnswer:
                    selectedRef.current == null
                      ? null
                      : JSON.stringify(selectedRef.current),
                  status: 'attempted',
                });
              }}
            >
              Parādīt atbildi
            </Button>
          </div>
        </div>
      ) : null}

      {revealed ? (
        <div className="answers-box odd-one-out-result" role="status">
          <p className="answers-box-label">Liekais vārds</p>
          <p className="focus-sentence" lang="lv">
            {task.options[task.correctIndex]}
          </p>
          <p className="odd-one-out-explanation">{task.explanation}</p>
          {!readOnly ? (
            <div className="btn-row">
              <Button variant="neutral" onClick={retry}>
                Mēģināt vēlreiz
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
