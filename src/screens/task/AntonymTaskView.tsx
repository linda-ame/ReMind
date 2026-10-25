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

function parseBlanks(entered: string | null, blankCount: number): string[] {
  const empty = Array.from({ length: blankCount }, () => '');
  if (!entered) return empty;
  try {
    const parsed: unknown = JSON.parse(entered);
    if (Array.isArray(parsed)) {
      return empty.map((_, i) =>
        typeof parsed[i] === 'string' ? parsed[i]! : '',
      );
    }
  } catch {
    /* ignore */
  }
  return empty;
}

function serializeBlanks(blanks: string[]): string | null {
  if (blanks.every((b) => !b.trim())) return null;
  return JSON.stringify(blanks);
}

function sentenceParts(text: string): string[] {
  return text.split('___');
}

/**
 * Antonym: single word, one blank in a sentence, or several blanks in a passage.
 */
export function AntonymTaskView({
  task,
  attempt,
  onUpdate,
  readOnly = false,
}: Props) {
  const mode = task.mode ?? 'word';

  if (mode === 'context_passage') {
    return (
      <AntonymPassageView
        task={task}
        attempt={attempt}
        onUpdate={onUpdate}
        readOnly={readOnly}
      />
    );
  }

  if (mode === 'context_sentence') {
    return (
      <AntonymSentenceView
        task={task}
        attempt={attempt}
        onUpdate={onUpdate}
        readOnly={readOnly}
      />
    );
  }

  return (
    <AntonymWordView
      task={task}
      attempt={attempt}
      onUpdate={onUpdate}
      readOnly={readOnly}
    />
  );
}

function AntonymWordView({
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

function AntonymSentenceView({
  task,
  attempt,
  onUpdate,
  readOnly = false,
}: Props) {
  const sentence = task.sentence ?? '';
  const [answer, setAnswer] = useState(attempt.enteredAnswer ?? '');
  const [answerChecked, setAnswerChecked] = useState(
    () => attempt.viewedAnswers,
  );
  const answerRef = useRef(answer);
  const hintsRef = useRef<HintAnswersHandle>(null);
  const chimedRef = useRef(false);
  const parts = sentenceParts(sentence);

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

  if (!sentence || sentence.split('___').length !== 2) {
    return (
      <div className="task-view">
        <p className="instruction" role="alert">
          Šim pretstatu uzdevumam trūkst derīga teikuma ar vienu tukšumu.
        </p>
      </div>
    );
  }

  return (
    <div className="task-view">
      {task.instruction ? (
        <p className="instruction">{task.instruction}</p>
      ) : null}

      <p className="focus-sentence scm-sentence" lang="lv">
        {parts[0]}
        <span className="scm-blank-mark" aria-label="tukšums">
          ___
        </span>
        {parts[1]}
      </p>

      <div className="listen-row">
        <ListenButton
          text={sentence.replace(/___/g, '…')}
          ariaLabel="Klausīties teikumu"
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

function AntonymPassageView({
  task,
  attempt,
  onUpdate,
  readOnly = false,
}: Props) {
  const blanksMeta = task.blanks ?? [];
  const blankCount = blanksMeta.length;
  const passage = task.passage ?? '';
  const [blanks, setBlanks] = useState(() =>
    parseBlanks(attempt.enteredAnswer, blankCount),
  );
  const blanksRef = useRef(blanks);
  const [answerChecked, setAnswerChecked] = useState(
    () => attempt.viewedAnswers,
  );
  const [submittedBlank, setSubmittedBlank] = useState<Set<number>>(
    () =>
      attempt.viewedAnswers
        ? new Set(Array.from({ length: blankCount }, (_, i) => i))
        : new Set(),
  );
  const chimedRef = useRef(false);
  const parts = sentenceParts(passage);

  const patch = (partial: Partial<TaskAttempt>) => {
    if (readOnly) return;
    onUpdate(
      buildAttemptUpdate(
        attempt,
        partial,
        serializeBlanks(blanksRef.current),
      ),
    );
  };

  const setBlankAndPersist = (index: number, value: string) => {
    if (readOnly) return;
    const next = blanksRef.current.map((b, i) => (i === index ? value : b));
    blanksRef.current = next;
    setBlanks(next);
    patch({
      enteredAnswer: serializeBlanks(next),
      status: 'attempted',
    });
  };

  const allFilled = blanks.every((b) => b.trim() !== '');

  const onSubmitBlank = (index: number, text: string) => {
    if (readOnly) return;
    const next = blanksRef.current.map((b, i) => (i === index ? text : b));
    blanksRef.current = next;
    setBlanks(next);

    const nextSubmitted = new Set(submittedBlank);
    nextSubmitted.add(index);
    setSubmittedBlank(nextSubmitted);

    const filled = next.every((b) => b.trim() !== '');
    if (filled) {
      setAnswerChecked(true);
    }

    patch({
      viewedAnswers: filled || attempt.viewedAnswers,
      enteredAnswer: serializeBlanks(next),
      status: 'attempted',
    });

    if (
      filled &&
      !chimedRef.current &&
      blanksMeta.every((blank, i) =>
        textMatchesAccepted(next[i] ?? '', blank.answers, task.type),
      )
    ) {
      chimedRef.current = true;
      playCorrectChime();
    }
  };

  const showAnswers = answerChecked || readOnly;

  if (
    blankCount === 0 ||
    !passage ||
    passage.split('___').length - 1 !== blankCount
  ) {
    return (
      <div className="task-view">
        <p className="instruction" role="alert">
          Šim pretstatu uzdevumam trūkst derīga teksta ar tukšumiem.
        </p>
      </div>
    );
  }

  return (
    <div className="task-view scm-view">
      {task.instruction ? (
        <p className="instruction">{task.instruction}</p>
      ) : null}

      {task.title ? (
        <p className="rc-passage-title" lang="lv">
          {task.title}
        </p>
      ) : null}

      <p className="focus-sentence scm-sentence" lang="lv">
        {parts.map((part, i) => (
          <span key={`part-${i}`}>
            {part}
            {i < blankCount ? (
              <span className="scm-blank-mark" aria-label={`${i + 1}. tukšums`}>
                ({i + 1})
              </span>
            ) : null}
          </span>
        ))}
      </p>

      <div className="listen-row">
        <ListenButton
          text={passage.replace(/___/g, '…')}
          ariaLabel="Klausīties tekstu"
        />
      </div>

      <div className="scm-blanks">
        {blanksMeta.map((blank, index) => (
          <AnswerField
            key={`blank-${index}`}
            id={`antonym-blank-${index}`}
            label={`${index + 1}. tukšums (pretstats vārdam „${blank.sourceWord}”)`}
            value={blanks[index] ?? ''}
            placeholder="Ierakstiet vai ierunājiet atbildi…"
            readOnly={readOnly}
            onChange={(value) => setBlankAndPersist(index, value)}
            onSubmit={(text) => onSubmitBlank(index, text)}
            feedback={answerInputFeedback(
              showAnswers || submittedBlank.has(index),
              blanks[index] ?? '',
              blank.answers,
              task.type,
            )}
          />
        ))}
      </div>

      {showAnswers ? (
        <div className="answers-box scm-answers" role="status">
          <p className="answers-box-label">Iespējamās atbildes</p>
          <ol className="scm-answer-list">
            {blanksMeta.map((blank, index) => (
              <li key={`ans-${index}`} className="scm-answer-item" lang="lv">
                <span className="scm-answer-index">{index + 1}.</span>{' '}
                {blank.answers.map((a) => `"${a}"`).join(', ')}
              </li>
            ))}
          </ol>
        </div>
      ) : allFilled ? (
        <p className="scm-submit-hint">
          Nospiediet Enter kādā no laukiem, lai pārbaudītu.
        </p>
      ) : null}
    </div>
  );
}
