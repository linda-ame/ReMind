import { useState } from 'react';
import { Button } from '../../components/Button';
import type { WordChoiceTask } from '../../types/task';
import type { TaskAttempt } from '../../types/progress';

interface Props {
  task: WordChoiceTask;
  attempt: TaskAttempt;
  onUpdate: (attempt: TaskAttempt) => void;
  readOnly?: boolean;
}

/** Restore multi-select from stored answer (JSON array or legacy single string). */
function parseSelected(
  entered: string | null,
  options: string[],
): Set<string> {
  if (!entered) return new Set();
  try {
    const parsed: unknown = JSON.parse(entered);
    if (Array.isArray(parsed)) {
      return new Set(
        parsed.filter(
          (x): x is string => typeof x === 'string' && options.includes(x),
        ),
      );
    }
  } catch {
    /* legacy single option stored as plain string */
  }
  return options.includes(entered) ? new Set([entered]) : new Set();
}

function serializeSelected(selected: Set<string>): string | null {
  if (selected.size === 0) return null;
  return JSON.stringify([...selected]);
}

/**
 * Choose option(s), then reveal: correct → green; wrong selected stay yellow.
 * No hints, no self-assessment (Next is in TaskScreen).
 */
export function WordChoiceTaskView({
  task,
  attempt,
  onUpdate,
  readOnly = false,
}: Props) {
  const [local, setLocal] = useState(attempt);
  const [selected, setSelected] = useState<Set<string>>(() =>
    parseSelected(attempt.enteredAnswer, task.options),
  );
  const [revealed, setRevealed] = useState(
    readOnly || attempt.viewedAnswers,
  );

  const correctOptions = new Set(
    task.correctIndices.map((i) => task.options[i]),
  );
  /** One correct answer → exclusive single-select; two+ → multi-select. */
  const singleSelect = correctOptions.size === 1;

  const patch = (partial: Partial<TaskAttempt>) => {
    if (readOnly) return;
    const next: TaskAttempt = {
      ...local,
      ...partial,
      status: partial.status ?? 'attempted',
    };
    setLocal(next);
    onUpdate(next);
  };

  const toggleOption = (option: string) => {
    if (readOnly || revealed) return;
    let next: Set<string>;
    if (singleSelect) {
      next = selected.has(option) ? new Set() : new Set([option]);
    } else {
      next = new Set(selected);
      if (next.has(option)) next.delete(option);
      else next.add(option);
    }
    setSelected(next);
    patch({
      enteredAnswer: serializeSelected(next),
      status: 'attempted',
    });
  };

  const optionVariant = (option: string) => {
    const isSelected = selected.has(option);
    const isCorrect = correctOptions.has(option);

    if (revealed) {
      if (isCorrect) return 'success' as const;
      if (isSelected) return 'selected' as const;
      return 'secondary' as const;
    }

    return isSelected ? ('selected' as const) : ('secondary' as const);
  };

  return (
    <div className="task-view">
      <p className="instruction">{task.instruction}</p>
      <p className="focus-sentence" lang="lv">
        {task.prompt}
      </p>

      <div className="stack choice-stack">
        {task.options.map((option) => (
          <Button
            key={option}
            variant={optionVariant(option)}
            aria-disabled={readOnly || revealed || undefined}
            onClick={() => toggleOption(option)}
            aria-pressed={selected.has(option)}
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
              onClick={() => {
                setRevealed(true);
                patch({ viewedAnswers: true });
              }}
            >
              {correctOptions.size === 1 ? 'Parādīt atbildi' : 'Parādīt atbildes'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
