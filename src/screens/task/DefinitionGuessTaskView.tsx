import { useRef, useState } from 'react';
import { HintAnswers } from '../../components/HintAnswers';
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

  return (
    <div className="task-view">
      <p className="focus-sentence definition-description" lang="lv">
        {task.description}
      </p>

      <input
        id="answer-input"
        className="text-input text-input-answer"
        type="text"
        value={answer}
        placeholder="Varat ierakstīt vai pateikt skaļi…"
        aria-label="Atbilde"
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
