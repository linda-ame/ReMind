import { useRef, useState } from 'react';
import { AnswerField } from '../../components/AnswerField';
import { HintAnswers } from '../../components/HintAnswers';
import { buildAttemptUpdate } from '../../utils/buildAttemptUpdate';
import type { AntonymTask } from '../../types/task';
import type { TaskAttempt } from '../../types/progress';

interface Props {
  task: AntonymTask;
  attempt: TaskAttempt;
  onUpdate: (attempt: TaskAttempt) => void;
  readOnly?: boolean;
}

/**
 * Show a word; optional typed answer; reveal accepted antonyms.
 * No instruction heading (prompt asks «Kāds ir pretstats?»); no hints.
 * Self-assessment in TaskScreen footer.
 */
export function AntonymTaskView({
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
      <p className="focus-word" lang="lv">
        {task.word}
      </p>
      <p className="prompt-line" lang="lv">
        Kāds ir pretstats?
      </p>

      <AnswerField
        id="answer-input"
        value={answer}
        placeholder="Ierakstiet vai ierunājiet…"
        ariaLabel="Atbilde"
        readOnly={readOnly}
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
