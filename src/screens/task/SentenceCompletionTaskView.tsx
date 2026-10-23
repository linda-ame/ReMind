import { useState } from 'react';
import { HintAnswers } from '../../components/HintAnswers';
import type { SentenceCompletionTask } from '../../types/task';
import type { TaskAttempt } from '../../types/progress';

interface Props {
  task: SentenceCompletionTask;
  attempt: TaskAttempt;
  onUpdate: (attempt: TaskAttempt) => void;
  readOnly?: boolean;
}

/** Sentence + answer field + show possible answers only. No hints. */
export function SentenceCompletionTaskView({
  task,
  attempt,
  onUpdate,
  readOnly = false,
}: Props) {
  const [local, setLocal] = useState(attempt);
  const [answer, setAnswer] = useState(attempt.enteredAnswer ?? '');

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

  return (
    <div className="task-view">
      <p className="instruction">{task.instruction}</p>
      <p className="focus-sentence" lang="lv">
        {task.sentence}
      </p>

      <label className="field-label" htmlFor="answer-input">
        Atbilde
      </label>
      <input
        id="answer-input"
        className="text-input text-input-answer"
        type="text"
        value={answer}
        placeholder="Ierakstiet atbildi…"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        readOnly={readOnly}
        aria-readonly={readOnly || undefined}
        onChange={(e) => {
          if (readOnly) return;
          const value = e.target.value;
          setAnswer(value);
          patch({ enteredAnswer: value, status: 'attempted' });
        }}
      />

      <HintAnswers
        answers={task.answers}
        readOnly={readOnly}
        initiallyShowAnswers={attempt.viewedAnswers}
        onViewedAnswers={() => patch({ viewedAnswers: true })}
      />
    </div>
  );
}
