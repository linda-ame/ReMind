import { useState } from 'react';
import { HintAnswers } from '../../components/HintAnswers';
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
      <p className="focus-word" lang="lv">
        {task.word}
      </p>
      <p className="prompt-line" lang="lv">
        Kāds ir pretstats?
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
