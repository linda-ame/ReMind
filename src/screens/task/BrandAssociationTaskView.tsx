import { useRef, useState } from 'react';
import { AnswerField } from '../../components/AnswerField';
import { Button } from '../../components/Button';
import { ListenButton } from '../../components/ListenButton';
import { answersBoxLabel } from '../../utils/answers';
import { buildAttemptUpdate } from '../../utils/buildAttemptUpdate';
import type { TaskAttempt } from '../../types/progress';
import type { BrandAssociationTask } from '../../types/task';

interface Props {
  task: BrandAssociationTask;
  attempt: TaskAttempt;
  onUpdate: (attempt: TaskAttempt) => void;
  readOnly?: boolean;
}

/**
 * One brand, one association. Enter or the end of dictation reveals the
 * examples and unlocks Tālāk. Until an answer is confirmed, the task offers
 * Izlaist. The examples are illustrations, not a grade.
 */
export function BrandAssociationTaskView({
  task,
  attempt,
  onUpdate,
  readOnly = false,
}: Props) {
  const examples = task.exampleAssociations.filter((item) => item.trim());
  const [answer, setAnswer] = useState(attempt.enteredAnswer ?? '');
  const [shown, setShown] = useState(
    readOnly || attempt.viewedAnswers || attempt.usedHint,
  );
  const answerRef = useRef(answer);
  answerRef.current = answer;

  const patch = (partial: Partial<TaskAttempt>, text = answerRef.current) => {
    if (readOnly) return;
    onUpdate(buildAttemptUpdate(attempt, partial, text || null));
  };

  const setAnswerAndPersist = (value: string) => {
    if (readOnly) return;
    answerRef.current = value;
    setAnswer(value);
    patch({ status: 'attempted' }, value);
  };

  const showExamples = () => {
    setShown(true);
    patch({ usedHint: true, status: 'attempted' });
  };

  const reveal = (text: string) => {
    if (readOnly) {
      setShown(true);
      return;
    }
    answerRef.current = text;
    setAnswer(text);
    if (!text.trim()) return;
    setShown(true);
    patch(
      { viewedAnswers: true, usedHint: true, status: 'attempted' },
      text,
    );
  };

  return (
    <div className="task-view">
      <p className="instruction brand-instruction">{task.instruction}</p>
      <p className="brand-name" lang="lv">
        {task.brand}
      </p>
      <ListenButton
        text={task.brand}
        ariaLabel={`Klausīties: ${task.brand}`}
        label="Klausīties"
      />

      <AnswerField
        id={`brand-answer-${task.id}`}
        value={answer}
        placeholder="Ierakstiet vai ierunājiet…"
        ariaLabel="Asociācija"
        readOnly={readOnly}
        onChange={setAnswerAndPersist}
        onSubmit={reveal}
      />

      {shown && examples.length > 0 ? (
        <div className="answers-box" role="status">
          <p className="answers-box-label">
            {answersBoxLabel(task.type, examples.length)}
          </p>
          <ul className="brand-example-list">
            {examples.map((item) => (
              <li key={item} lang="lv">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <Button variant="secondary" onClick={showExamples}>
          Parādīt piemēru
        </Button>
      )}
    </div>
  );
}
