import { useEffect, useRef, useState } from 'react';
import { HintAnswers } from '../../components/HintAnswers';
import { buildAttemptUpdate } from '../../utils/buildAttemptUpdate';
import type { ImageWordTask } from '../../types/task';
import type { TaskAttempt } from '../../types/progress';

interface Props {
  task: ImageWordTask;
  attempt: TaskAttempt;
  onUpdate: (attempt: TaskAttempt) => void;
  readOnly?: boolean;
}

/**
 * Image + sentence + answer field + show correct word(s).
 * No instruction text, no hints.
 */
export function ImageWordTaskView({
  task,
  attempt,
  onUpdate,
  readOnly = false,
}: Props) {
  const [answer, setAnswer] = useState(attempt.enteredAnswer ?? '');
  const answerRef = useRef(answer);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!readOnly) inputRef.current?.focus();
  }, [task.id, readOnly]);

  const patch = (partial: Partial<TaskAttempt>) => {
    if (readOnly) return;
    onUpdate(buildAttemptUpdate(attempt, partial, answerRef.current));
  };

  return (
    <div className="task-view">
      <img
        className="task-image"
        src={task.imageSrc}
        alt={task.imageAlt}
        width={280}
        height={280}
      />

      <p className="focus-sentence" lang="lv">
        {task.sentence}
      </p>

      <label className="field-label" htmlFor="answer-input">
        Atbilde
      </label>
      <input
        ref={inputRef}
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
          answerRef.current = value;
          setAnswer(value);
          patch({ enteredAnswer: value, status: 'attempted' });
        }}
      />

      <HintAnswers
        answers={task.answers}
        readOnly={readOnly}
        initiallyShowAnswers={attempt.viewedAnswers}
        onViewedAnswers={() =>
          patch({
            viewedAnswers: true,
            enteredAnswer: answerRef.current || null,
          })
        }
      />
    </div>
  );
}
