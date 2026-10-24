import { useRef, useState } from 'react';
import { AnswerField } from '../../components/AnswerField';
import { HintAnswers } from '../../components/HintAnswers';
import { ListenButton } from '../../components/ListenButton';
import { buildAttemptUpdate } from '../../utils/buildAttemptUpdate';
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
      <p className="instruction">{task.instruction}</p>
      <p className="focus-sentence" lang="lv">
        {task.sentence}
      </p>

      <div className="listen-row">
        <ListenButton
          text={task.sentence}
          ariaLabel="Klausīties teikumu"
        />
      </div>

      <AnswerField
        id="answer-input"
        label="Atbilde"
        value={answer}
        placeholder="Ierakstiet vai ierunājiet atbildi…"
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
