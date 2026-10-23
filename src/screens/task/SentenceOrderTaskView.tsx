import { useRef, useState } from 'react';
import { Button } from '../../components/Button';
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
 * Tap words (no drag-and-drop) to build a sentence.
 * Selected words show a 1, 2, 3… badge; words stay in scrambled button order.
 * Self-assessment lives in TaskScreen footer (same as sentence_completion).
 * No instruction heading — type title omitted; progress is in the footer.
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

  const pickWord = (index: number) => {
    if (readOnly || positionByIndex.has(index)) return;
    setOrderAndSave([...order, index]);
  };

  const undoLast = () => {
    if (readOnly || order.length === 0) return;
    setOrderAndSave(order.slice(0, -1));
  };

  const builtSentence = formatBuiltSentence(
    task.words,
    order,
    task.words.length,
  );

  return (
    <div className="task-view task-view-sentence-order">
      <div
        className="sentence-build-area"
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

      <div className="stack choice-stack sentence-order-words">
        {task.words.map((word, index) => {
          const position = positionByIndex.get(index);
          const isUsed = position != null;
          return (
            <Button
              key={`${index}-${word}`}
              variant={isUsed ? 'selected' : 'secondary'}
              className={isUsed ? 'sentence-order-word-used' : undefined}
              aria-disabled={readOnly || isUsed || undefined}
              aria-pressed={isUsed}
              aria-label={
                isUsed ? `${word}, ${position}. vietā` : word
              }
              onClick={() => pickWord(index)}
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

      {!readOnly ? (
        <div className="btn-row sentence-order-actions">
          <Button
            variant="neutral"
            fullWidth={false}
            disabled={order.length === 0}
            onClick={undoLast}
          >
            Atsaukt
          </Button>
          {!showModel ? (
            <Button
              variant="secondary"
              fullWidth={false}
              className="btn-reveal-answer"
              onClick={() => {
                setShowModel(true);
                patch({
                  viewedAnswers: true,
                  enteredAnswer: serializeOrder(orderRef.current),
                });
              }}
            >
              Parādīt teikumu
            </Button>
          ) : null}
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
