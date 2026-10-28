import { useRef, useState } from 'react';
import { AnswerField } from '../../components/AnswerField';
import { Button } from '../../components/Button';
import { ListenButton } from '../../components/ListenButton';
import { buildAttemptUpdate } from '../../utils/buildAttemptUpdate';
import { keywordUsedInText } from '../../utils/lvInflection';
import type { TaskAttempt } from '../../types/progress';
import type { SentenceCreationTask } from '../../types/task';

interface Props {
  task: SentenceCreationTask;
  attempt: TaskAttempt;
  onUpdate: (attempt: TaskAttempt) => void;
  readOnly?: boolean;
}

const SLOT_COUNT = 4;

function parseSlots(
  entered: string | null,
  fixedPosition: number,
  fixedWord: string,
): string[] {
  const slots = Array.from({ length: SLOT_COUNT }, () => '');
  slots[fixedPosition] = fixedWord;
  if (!entered) return slots;
  try {
    const parsed: unknown = JSON.parse(entered);
    if (Array.isArray(parsed)) {
      for (let i = 0; i < SLOT_COUNT; i++) {
        if (i === fixedPosition) continue;
        const value = parsed[i];
        if (typeof value === 'string') slots[i] = value;
      }
    }
  } catch {
    /* keywords mode stores plain text */
  }
  return slots;
}

/**
 * Free sentence building. The example is optional and never replaces what
 * the learner typed. Tālāk appears after Enter or finished dictation, once
 * there is text. Until then the task offers Izlaist.
 */
export function SentenceCreationTaskView({
  task,
  attempt,
  onUpdate,
  readOnly = false,
}: Props) {
  const fixed =
    task.mode === 'fixed_word_position' &&
    typeof task.fixedWord === 'string' &&
    typeof task.fixedPosition === 'number';
  const fixedWord = task.fixedWord ?? '';
  const fixedPosition = task.fixedPosition ?? 0;

  const [slots, setSlots] = useState(() =>
    fixed ? parseSlots(attempt.enteredAnswer, fixedPosition, fixedWord) : [],
  );
  const [text, setText] = useState(() =>
    fixed ? '' : (attempt.enteredAnswer ?? ''),
  );
  const [exampleOpen, setExampleOpen] = useState(
    attempt.usedHint || attempt.viewedAnswers,
  );
  const [missingWords, setMissingWords] = useState(false);
  const slotsRef = useRef(slots);
  const textRef = useRef(text);
  slotsRef.current = slots;
  textRef.current = text;

  const enteredNow = () =>
    fixed ? JSON.stringify(slotsRef.current) : textRef.current;

  const patch = (partial: Partial<TaskAttempt>) => {
    if (readOnly) return;
    onUpdate(buildAttemptUpdate(attempt, partial, enteredNow()));
  };

  const showExample = () => {
    setExampleOpen(true);
    patch({ usedHint: true, status: 'attempted' });
  };

  const confirmAnswer = () => {
    if (readOnly) return;
    const hasText = fixed
      ? slotsRef.current.every(
          (word, index) => index === fixedPosition || word.trim().length > 0,
        )
      : textRef.current.trim().length > 0;
    if (!hasText) return;
    if (!fixed) {
      const missing = (task.keywords ?? []).some(
        (word) => !keywordUsedInText(word, textRef.current),
      );
      if (missing) {
        setMissingWords(true);
        return;
      }
    }
    setMissingWords(false);
    patch({ viewedAnswers: true, status: 'attempted' });
  };

  const listenText = fixed
    ? slots.filter((word) => word.trim()).join(' ') || fixedWord
    : text.trim() || (task.keywords ?? []).join(', ');

  return (
    <div className="task-view">
      <p className="instruction">{task.instruction}</p>

      {fixed ? (
        <div className="sentence-slots">
          {slots.map((value, index) => {
            const locked = index === fixedPosition;
            return (
              <div className="sentence-slot" key={index}>
                <span className="sentence-slot-index" aria-hidden="true">
                  {index + 1}
                </span>
                {locked ? (
                  <div
                    className="sentence-slot-locked"
                    aria-label={`${index + 1}. vārds, dots: ${fixedWord}`}
                  >
                    {fixedWord}
                  </div>
                ) : (
                  <AnswerField
                    id={`sentence-slot-${task.id}-${index}`}
                    className="sentence-slot-field"
                    value={value}
                    readOnly={readOnly}
                    ariaLabel={`${index + 1}. vārds`}
                    placeholder="Vārds"
                    onSubmit={confirmAnswer}
                    onChange={(nextValue) => {
                      if (readOnly) return;
                      const next = slotsRef.current.slice();
                      next[index] = nextValue;
                      slotsRef.current = next;
                      setSlots(next);
                      patch({ status: 'attempted' });
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="keyword-row" aria-label="Dotie vārdi">
            {(task.keywords ?? []).map((word) => {
              const used = keywordUsedInText(word, text);
              return (
                <span
                  className={used ? 'keyword-chip keyword-chip-used' : 'keyword-chip'}
                  lang="lv"
                  key={word}
                  aria-label={used ? `${word}, iesaistīts` : word}
                >
                  {word}
                </span>
              );
            })}
          </div>
          <AnswerField
            id={`sentence-free-${task.id}`}
            className="sentence-free-field"
            inputClassName="sentence-free-input"
            multiline
            rows={4}
            value={text}
            readOnly={readOnly}
            ariaLabel="Jūsu teikums"
            placeholder="Ierakstiet vai ierunājiet teikumu…"
            onSubmit={confirmAnswer}
            onChange={(nextValue) => {
              if (readOnly) return;
              textRef.current = nextValue;
              setText(nextValue);
              if (
                missingWords &&
                (task.keywords ?? []).every((word) =>
                  keywordUsedInText(word, nextValue),
                )
              ) {
                setMissingWords(false);
              }
              patch({ status: 'attempted' });
            }}
          />
          {missingWords ? (
            <p className="keyword-missing" role="status">
              Teikumā vēl jāiesaista visi vārdi.
            </p>
          ) : null}
        </>
      )}

      <ListenButton text={listenText} ariaLabel="Klausīties" label="Klausīties" />

      {exampleOpen ? (
        <p className="task-example" role="status" lang="lv">
          Piemērs: {task.modelSentence}
        </p>
      ) : (
        <Button variant="secondary" onClick={showExample}>
          Parādīt piemēru
        </Button>
      )}
    </div>
  );
}
