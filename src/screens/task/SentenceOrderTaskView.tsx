import { useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { ListenButton } from '../../components/ListenButton';
import { isAnswerCorrect } from '../../utils/answers';
import { buildAttemptUpdate } from '../../utils/buildAttemptUpdate';
import type { SentenceOrderTask } from '../../types/task';
import type { TaskAttempt } from '../../types/progress';

interface Props {
  task: SentenceOrderTask;
  attempt: TaskAttempt;
  onUpdate: (attempt: TaskAttempt) => void;
  readOnly?: boolean;
}

/** Restore selected word indices from stored answer. */
function parseOrder(entered: string | null, wordCount: number): number[] {
  if (!entered) return [];
  try {
    const parsed: unknown = JSON.parse(entered);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (x): x is number =>
          typeof x === 'number' &&
          Number.isInteger(x) &&
          x >= 0 &&
          x < wordCount,
      );
    }
  } catch {
    /* ignore */
  }
  return [];
}

function serializeOrder(order: number[]): string | null {
  if (order.length === 0) return null;
  return JSON.stringify(order);
}

/** Display-only: capitalize first word and add period when the sequence is complete. */
function formatBuiltSentence(
  words: string[],
  order: number[],
  totalWords: number,
): string {
  const parts = order.map((i) => words[i]).filter(Boolean);
  if (parts.length === 0) return '';
  const joined = parts.join(' ');
  if (order.length < totalWords) return joined;
  const capitalized =
    joined.charAt(0).toLocaleUpperCase('lv') + joined.slice(1);
  return /[.!?…]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

/**
 * Tap words to build a sentence; tap again to remove (no separate undo).
 * Listen plays the built sentence. Pārbaudīt (model) appears when all words
 * are placed. Tālāk unlocks only then (see taskHasAdvanceReady).
 */
export function SentenceOrderTaskView({
  task,
  attempt,
  onUpdate,
  readOnly = false,
}: Props) {
  const [order, setOrder] = useState<number[]>(() =>
    parseOrder(attempt.enteredAnswer, task.words.length),
  );
  const orderRef = useRef(order);
  const [showModel, setShowModel] = useState(
    readOnly || attempt.viewedAnswers,
  );

  /** Map word index → 1-based pick position. */
  const positionByIndex = new Map<number, number>();
  order.forEach((wordIndex, pickPos) => {
    positionByIndex.set(wordIndex, pickPos + 1);
  });

  const allPlaced = order.length >= task.words.length;

  const patch = (partial: Partial<TaskAttempt>) => {
    if (readOnly) return;
    onUpdate(
      buildAttemptUpdate(
        attempt,
        partial,
        serializeOrder(orderRef.current),
      ),
    );
  };

  const setOrderAndSave = (nextOrder: number[]) => {
    orderRef.current = nextOrder;
    setOrder(nextOrder);
    patch({
      enteredAnswer: serializeOrder(nextOrder),
      status: 'attempted',
    });
  };

  const toggleWord = (index: number) => {
    if (readOnly) return;
    if (positionByIndex.has(index)) {
      setOrderAndSave(order.filter((i) => i !== index));
      return;
    }
    setOrderAndSave([...order, index]);
  };

  const builtSentence = formatBuiltSentence(
    task.words,
    order,
    task.words.length,
  );

  const orderFeedback = showModel
    ? isAnswerCorrect(task, {
        ...attempt,
        enteredAnswer: serializeOrder(order),
      }) === true
      ? 'correct'
      : 'incorrect'
    : null;

  return (
    <div className="task-view task-view-sentence-order">
      <div
        className={[
          'sentence-build-area',
          orderFeedback ? `sentence-build-area-${orderFeedback}` : '',
        ]
          .filter(Boolean)
          .join(' ')}
        lang="lv"
        role="status"
        aria-live="polite"
        aria-label="Teikuma veidošanas lauks"
      >
        {builtSentence ? (
          <p className="sentence-build-text">{builtSentence}</p>
        ) : (
          <p className="sentence-build-placeholder">Izvēlieties vārdus…</p>
        )}
      </div>

      {builtSentence ? (
        <div className="listen-row">
          <ListenButton
            text={builtSentence}
            ariaLabel="Klausīties izveidoto teikumu"
          />
        </div>
      ) : null}

      <div className="stack choice-stack sentence-order-words">
        {task.words.map((word, index) => {
          const position = positionByIndex.get(index);
          const isUsed = position != null;
          return (
            <Button
              key={`${index}-${word}`}
              variant={isUsed ? 'selected' : 'secondary'}
              className={isUsed ? 'sentence-order-word-used' : undefined}
              aria-pressed={isUsed}
              aria-label={
                isUsed
                  ? `${word}, ${position}. vietā — piespiediet, lai noņemtu`
                  : word
              }
              onClick={() => toggleWord(index)}
            >
              <span className="sentence-order-word-label">{word}</span>
              {isUsed ? (
                <span className="sentence-order-badge" aria-hidden="true">
                  {position}
                </span>
              ) : null}
            </Button>
          );
        })}
      </div>

      {!readOnly && allPlaced && !showModel ? (
        <div className="btn-row sentence-order-actions">
          <Button
            variant="secondary"
            className="btn-reveal-answer"
            onClick={() => {
              setShowModel(true);
              patch({
                viewedAnswers: true,
                enteredAnswer: serializeOrder(orderRef.current),
              });
            }}
          >
            Pārbaudīt
          </Button>
        </div>
      ) : null}

      {showModel ? (
        <div className="hint-answers">
          <div className="answers-box" role="status">
            <p className="answers-box-label">Parauga teikums</p>
            <p className="focus-sentence" lang="lv">
              {task.modelSentence}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
