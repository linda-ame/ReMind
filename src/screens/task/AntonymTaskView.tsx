import { useRef, useState } from 'react';
import { AnswerField } from '../../components/AnswerField';
import {
  HintAnswers,
  type HintAnswersHandle,
} from '../../components/HintAnswers';
import { ListenButton } from '../../components/ListenButton';
import { playCorrectChime } from '../../utils/answerFeedback';
import {
  answerInputFeedback,
  textMatchesAccepted,
} from '../../utils/answers';
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
 */
export function AntonymTaskView({
  task,
  attempt,
  onUpdate,
  readOnly = false,
}: Props) {
  const [answer, setAnswer] = useState(attempt.enteredAnswer ?? '');
  const [answerChecked, setAnswerChecked] = useState(
    () => attempt.viewedAnswers,
  );
  const answerRef = useRef(answer);
  const hintsRef = useRef<HintAnswersHandle>(null);
  const chimedRef = useRef(false);

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

  const onSubmitAnswer = (text: string) => {
    if (readOnly) return;
    answerRef.current = text;
    setAnswer(text);
    setAnswerChecked(true);
    hintsRef.current?.reveal();
    // Unlock Tālāk (Enter / finished dictation) — not on each keystroke.
    patch({
      viewedAnswers: true,
      enteredAnswer: text || null,
      status: 'attempted',
    });
    if (
      !chimedRef.current &&
      textMatchesAccepted(text, task.answers, task.type)
    ) {
      chimedRef.current = true;
      playCorrectChime();
    }
  };

  return (
    <div className="task-view">
      <p className="focus-word" lang="lv">
        {task.word}
      </p>
      <p className="prompt-line" lang="lv">
        Kāds ir pretstats?
      </p>

      <div className="listen-row">
        <ListenButton text={task.word} ariaLabel="Klausīties vārdu" />
      </div>

      <AnswerField
        id="answer-input"
        value={answer}
        placeholder="Ierakstiet vai ierunājiet…"
        ariaLabel="Atbilde"
        readOnly={readOnly}
        onChange={setAnswerAndPersist}
        onSubmit={onSubmitAnswer}
        feedback={answerInputFeedback(
          answerChecked,
          answer,
          task.answers,
          task.type,
        )}
      />

      <HintAnswers
        ref={hintsRef}
        answers={task.answers}
        taskType={task.type}
        readOnly={readOnly}
        initiallyShowAnswers={attempt.viewedAnswers}
        showRevealButton={false}
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
