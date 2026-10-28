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
    if (readOnly || !text.trim()) return;
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
