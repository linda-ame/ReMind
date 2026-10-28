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
import type { DefinitionGuessTask } from '../../types/task';
import type { TaskAttempt } from '../../types/progress';

interface Props {
  task: DefinitionGuessTask;
  attempt: TaskAttempt;
  onUpdate: (attempt: TaskAttempt) => void;
  readOnly?: boolean;
}

/**
 * Short description (or separate clues) → guess the word.
 * Optional typed answer; reveal answers via HintAnswers.
 */
export function DefinitionGuessTaskView({
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

  const useClues =
    task.mode === 'clues' && Array.isArray(task.clues) && task.clues.length > 0;
  const useKeywordClues = useClues && task.clueStyle === 'keywords';
  const listenText = useClues
    ? useKeywordClues
      ? (task.clues ?? []).join(', ')
      : (task.clues ?? []).join(' ')
    : task.description;

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
      {useKeywordClues ? (
        <p className="focus-sentence definition-keywords" lang="lv">
          {(task.clues ?? []).map((clue, i) => (
            <span key={`kw-${i}`}>
              {i > 0 ? (
                <span className="definition-keyword-sep" aria-hidden="true">
                  ,{' '}
                </span>
              ) : null}
              <span className="definition-keyword">{clue}</span>
            </span>
          ))}
        </p>
      ) : useClues ? (
        <ol className="definition-clues" lang="lv">
          {(task.clues ?? []).map((clue, i) => (
            <li key={`clue-${i}`} className="definition-clue">
              {clue}
            </li>
          ))}
        </ol>
      ) : (
        <p className="focus-sentence definition-description" lang="lv">
          {task.description}
        </p>
      )}

      <div className="listen-row">
        <ListenButton
          text={listenText}
          ariaLabel={useClues ? 'Klausīties pazīmes' : 'Klausīties aprakstu'}
        />
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
