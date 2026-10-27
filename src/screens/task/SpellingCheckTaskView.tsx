import { useRef, useState } from 'react';
import { AnswerField } from '../../components/AnswerField';
import { Button } from '../../components/Button';
import { ListenButton } from '../../components/ListenButton';
import {
  parseSpellingAnswer,
  spellingWordsMatch,
  type SpellingChoice,
} from '../../utils/answers';
import { playCorrectChime, playWrongBuzz } from '../../utils/answerFeedback';
import { buildAttemptUpdate } from '../../utils/buildAttemptUpdate';
import type { TaskAttempt } from '../../types/progress';
import type { SpellingCheckTask } from '../../types/task';

interface Props {
  task: SpellingCheckTask;
  attempt: TaskAttempt;
  onUpdate: (attempt: TaskAttempt) => void;
  readOnly?: boolean;
}

function serialize(choice: SpellingChoice | null, correction: string): string {
  return JSON.stringify({ choice, correction });
}

/**
 * Pareizi / Nepareizi is judged immediately (color + sound).
 * A correction field appears only when the shown word is actually wrong.
 * Enter or a finished dictation checks that spelling — there is no
 * separate Pārbaudīt button.
 */
export function SpellingCheckTaskView({
  task,
  attempt,
  onUpdate,
  readOnly = false,
}: Props) {
  const stored = parseSpellingAnswer(attempt.enteredAnswer);
  const [choice, setChoice] = useState<SpellingChoice | null>(stored.choice);
  const [correction, setCorrection] = useState(stored.correction);
  const [correctionChecked, setCorrectionChecked] = useState(
    !task.isCorrect && (readOnly || attempt.viewedAnswers),
  );
  const choiceRef = useRef(choice);
  const correctionRef = useRef(correction);
  choiceRef.current = choice;
  correctionRef.current = correction;

  const correctChoice: SpellingChoice = task.isCorrect ? 'pareizi' : 'nepareizi';
  const judged = choice != null;
  const judgmentOk = judged && choice === correctChoice;

  const patch = (partial: Partial<TaskAttempt>) => {
    if (readOnly) return;
    onUpdate(
      buildAttemptUpdate(
        attempt,
        partial,
        serialize(choiceRef.current, correctionRef.current),
      ),
    );
  };

  const choose = (next: SpellingChoice) => {
    if (readOnly || judged) return;
    choiceRef.current = next;
    setChoice(next);
    const ok = (next === 'pareizi') === task.isCorrect;
    if (ok) playCorrectChime();
    else playWrongBuzz();
    patch({
      viewedAnswers: task.isCorrect,
      status: 'attempted',
    });
  };

  const submitCorrection = (value: string) => {
    if (readOnly || correctionChecked) return;
    if (!value.trim()) return;
    correctionRef.current = value;
    setCorrection(value);
    setCorrectionChecked(true);
    if (spellingWordsMatch(value, task.correctWord)) playCorrectChime();
    else playWrongBuzz();
    patch({ viewedAnswers: true, status: 'attempted' });
  };

  const variantFor = (which: SpellingChoice) => {
    if (!judged) return 'secondary' as const;
    if (which === correctChoice) return 'success' as const;
    if (choice === which) return 'danger' as const;
    return 'secondary' as const;
  };

  const correctionOk = correctionChecked
    ? spellingWordsMatch(correction, task.correctWord)
    : null;

  return (
    <div className="task-view">
      <p className="instruction">{task.instruction}</p>
      <p
        className={[
          'spelling-word',
          judged ? (task.isCorrect ? 'spelling-word-ok' : 'spelling-word-miss') : '',
        ]
          .filter(Boolean)
          .join(' ')}
        lang="lv"
      >
        {task.shownWord}
      </p>
      <ListenButton
        text={task.shownWord}
        ariaLabel={`Klausīties: ${task.shownWord}`}
        label="Klausīties"
      />

      <div
        className="stack spelling-choice-stack"
        role="group"
        aria-label="Vai vārds ir pareizs?"
      >
        {(['pareizi', 'nepareizi'] as const).map((which) => {
          const label = which === 'pareizi' ? 'Pareizi' : 'Nepareizi';
          const showCheck = judged && which === correctChoice;
          const showWrong = judged && choice === which && which !== correctChoice;
          return (
            <Button
              key={which}
              variant={variantFor(which)}
              className={
                showCheck || showWrong ? 'choice-option-with-mark' : undefined
              }
              aria-pressed={choice === which}
              aria-disabled={readOnly || judged || undefined}
              onClick={() => choose(which)}
            >
              {showCheck ? (
                <span className="choice-feedback-mark" aria-hidden="true">
                  ✓
                </span>
              ) : null}
              {showWrong ? (
                <span className="choice-feedback-mark" aria-hidden="true">
                  ✗
                </span>
              ) : null}
              <span className="choice-option-label">{label}</span>
            </Button>
          );
        })}
      </div>

      {judged ? (
        <p className="spelling-live" role="status">
          {judgmentOk ? 'Vērtējums ir pareizs.' : 'Vērtējums nav pareizs.'}
        </p>
      ) : null}

      {judged && !task.isCorrect ? (
        <>
          <AnswerField
            id="spelling-correction"
            label="Uzraksti pareizi"
            ariaLabel="Uzraksti pareizi"
            value={correction}
            readOnly={readOnly || correctionChecked}
            autoFocus={!readOnly && !correctionChecked}
            placeholder="Pareizais vārds"
            feedback={
              correctionOk == null ? null : correctionOk ? 'correct' : 'incorrect'
            }
            onChange={(value) => {
              if (readOnly || correctionChecked) return;
              correctionRef.current = value;
              setCorrection(value);
              patch({ status: 'attempted' });
            }}
            onSubmit={submitCorrection}
          />
          {correctionChecked && correctionOk === false ? (
            <p className="task-feedback task-feedback-miss" role="status" lang="lv">
              Pareizi: {task.correctWord}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
