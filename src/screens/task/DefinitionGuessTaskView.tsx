import { useRef, useState } from 'react';
import { AnswerField } from '../../components/AnswerField';
import { HintAnswers } from '../../components/HintAnswers';
import { ListenButton } from '../../components/ListenButton';
import { buildAttemptUpdate } from '../../utils/buildAttemptUpdate';
import type { DefinitionGuessTask } from '../../types/task';
import type { TaskAttempt } from '../../types/progress';

interface Props {
  task: DefinitionGuessTask;
  attempt: TaskAttempt;
  onUpdate: (attempt: TaskAttempt) => void;
  readOnly?: boolean;
}

/**
 * Short description → guess the word.
 * Optional typed answer; reveal answers via HintAnswers (no hints).
 * Self-assessment in TaskScreen (no auto correct/incorrect scoring).
 */
export function DefinitionGuessTaskView({
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
      <p className="focus-sentence definition-description" lang="lv">
        {task.description}
      </p>

      <div className="listen-row">
        <ListenButton
          text={task.description}
          ariaLabel="Klausīties aprakstu"
        />
      </div>

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
