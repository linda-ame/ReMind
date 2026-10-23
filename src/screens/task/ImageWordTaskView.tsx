import { useRef, useState } from 'react';
import { AnswerField } from '../../components/AnswerField';
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

  const patch = (partial: Partial<TaskAttempt>) => {
    if (readOnly) return;
    onUpdate(buildAttemptUpdate(attempt, partial, answerRef.current));
  };

  const setAnswerAndPersist = (value: string) => {
    if (readOnly) return;
    answerRef.current = value;
    setAnswer(value);
    patch({ enteredAnswer: value, status: 'attempted' });
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

      <AnswerField
        id="answer-input"
        label="Atbilde"
        value={answer}
        placeholder="Ierakstiet vai ierunājiet atbildi…"
        readOnly={readOnly}
        autoFocus={!readOnly}
        onChange={setAnswerAndPersist}
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
