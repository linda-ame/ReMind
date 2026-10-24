import { useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { buildAttemptUpdate } from '../../utils/buildAttemptUpdate';
import {
  playCorrectChime,
  playWrongBuzz,
} from '../../utils/answerFeedback';
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

function isFullyCorrect(
  selected: Set<string>,
  correctOptions: Set<string>,
): boolean {
  if (selected.size !== correctOptions.size) return false;
  for (const option of selected) {
    if (!correctOptions.has(option)) return false;
  }
  return true;
}

/**
 * Choose option(s): wrong picks stay red; keep searching until all correct
 * are found. Tālāk unlocks only when fully correct (viewedAnswers).
 */
export function WordChoiceTaskView({
  task,
  attempt,
  onUpdate,
  readOnly = false,
}: Props) {
  const correctOptions = new Set(
    task.correctIndices.map((i) => task.options[i]),
  );
  const prior = parseSelected(attempt.enteredAnswer, task.options);
  const startedSolved =
    readOnly ||
    attempt.viewedAnswers ||
    isFullyCorrect(prior, correctOptions);

  /** Confirmed correct picks (green). */
  const [confirmedCorrect, setConfirmedCorrect] = useState<Set<string>>(
    () => {
      if (startedSolved) return new Set(correctOptions);
      return new Set([...prior].filter((o) => correctOptions.has(o)));
    },
  );
  /** Wrong picks stay visible in red while the user keeps looking. */
  const [wrongPicked, setWrongPicked] = useState<Set<string>>(() => {
    if (startedSolved) return new Set();
    return new Set([...prior].filter((o) => !correctOptions.has(o)));
  });
  const [solved, setSolved] = useState(startedSolved);
  const confirmedRef = useRef(confirmedCorrect);

  /** One correct answer → exclusive single-select; two+ → multi-select. */
  const singleSelect = correctOptions.size === 1;

  const patch = (partial: Partial<TaskAttempt>, nextConfirmed: Set<string>) => {
    if (readOnly) return;
    onUpdate(
      buildAttemptUpdate(
        attempt,
        partial,
        serializeSelected(nextConfirmed),
      ),
    );
  };

  const toggleOption = (option: string) => {
    if (readOnly || solved) return;
    if (wrongPicked.has(option)) return;
    if (confirmedCorrect.has(option)) return;

    if (!correctOptions.has(option)) {
      const nextWrong = new Set(wrongPicked);
      nextWrong.add(option);
      setWrongPicked(nextWrong);
      playWrongBuzz();
      // Do not change enteredAnswer / viewedAnswers — keep searching.
      return;
    }

    const nextConfirmed = new Set(confirmedCorrect);
    nextConfirmed.add(option);
    confirmedRef.current = nextConfirmed;
    setConfirmedCorrect(nextConfirmed);

    if (singleSelect || isFullyCorrect(nextConfirmed, correctOptions)) {
      setSolved(true);
      patch(
        {
          enteredAnswer: serializeSelected(nextConfirmed),
          viewedAnswers: true,
          status: 'attempted',
        },
        nextConfirmed,
      );
      playCorrectChime();
      return;
    }

    patch(
      {
        enteredAnswer: serializeSelected(nextConfirmed),
        status: 'attempted',
      },
      nextConfirmed,
    );
  };

  const optionVariant = (option: string) => {
    if (confirmedCorrect.has(option)) return 'success' as const;
    if (wrongPicked.has(option)) return 'danger' as const;
    return 'secondary' as const;
  };

  return (
    <div className="task-view">
      <p className="instruction">{task.instruction}</p>
      <p className="focus-sentence" lang="lv">
        {task.prompt}
      </p>

      <div className="stack choice-stack">
        {task.options.map((option) => {
          const isWrong = wrongPicked.has(option);
          const isConfirmed = confirmedCorrect.has(option);
          const showWrongMark = isWrong;
          const showCheck = isConfirmed;

          return (
            <Button
              key={option}
              variant={optionVariant(option)}
              className={
                showWrongMark || showCheck
                  ? 'choice-option-with-mark'
                  : undefined
              }
              aria-disabled={
                readOnly || solved || isWrong || isConfirmed || undefined
              }
              onClick={() => toggleOption(option)}
              aria-pressed={isWrong || isConfirmed}
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
          );
        })}
      </div>
    </div>
  );
}
