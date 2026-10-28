import { useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { ListenButton } from '../../components/ListenButton';
import { playCorrectChime } from '../../utils/answerFeedback';
import { buildAttemptUpdate } from '../../utils/buildAttemptUpdate';
import {
  isAdjacent,
  lettersToWord,
  parseWordGridAnswer,
  pathIsPlayable,
  serializeWordGrid,
  wordsMatch,
  type WordGridAttemptData,
} from '../../utils/wordGrid';
import type { TaskAttempt } from '../../types/progress';
import type { WordGridTask } from '../../types/task';

interface Props {
  task: WordGridTask;
  attempt: TaskAttempt;
  onUpdate: (attempt: TaskAttempt) => void;
  readOnly?: boolean;
}

const RULE =
  'Burti savienojas tikai pa labi, pa kreisi, uz augšu vai uz leju. Pieskaries izvēlētam burtam, lai atceltu no tā vietas.';

function freshState(task: WordGridTask): WordGridAttemptData {
  return {
    path: [task.startIndex],
    word: lettersToWord(task.letters, [task.startIndex]),
    undoCount: 0,
    resetCount: 0,
    attemptCount: 0,
    solutionViewed: false,
    difficultyAtAttempt: task.difficulty ?? null,
  };
}

function readInitial(task: WordGridTask, attempt: TaskAttempt): WordGridAttemptData {
  const parsed = parseWordGridAnswer(attempt.enteredAnswer);
  const cellCount = task.gridSize * task.gridSize;
  if (
    !parsed ||
    !pathIsPlayable(parsed.path, task.gridSize, task.startIndex, cellCount)
  ) {
    return freshState(task);
  }
  return {
    ...parsed,
    word: lettersToWord(task.letters, parsed.path),
    difficultyAtAttempt: parsed.difficultyAtAttempt ?? task.difficulty ?? null,
  };
}

function isSolved(task: WordGridTask, attempt: TaskAttempt, data: WordGridAttemptData): boolean {
  if (attempt.status === 'completed' || attempt.viewedAnswers) return true;
  return (
    data.path.length === task.wordLength &&
    wordsMatch(lettersToWord(task.letters, data.path), task.targetWord)
  );
}

/**
 * One letter grid. The start cell stays marked 1.
 * Success is the intended word only — other Latvian words are not called wrong.
 * No self-assessment: help is recorded when the hint or the intended word is opened.
 */
export function WordGridTaskView({
  task,
  attempt,
  onUpdate,
  readOnly = false,
}: Props) {
  const [grid, setGrid] = useState(() => readInitial(task, attempt));
  const gridRef = useRef(grid);
  const solvedAtStart = isSolved(task, attempt, grid);
  const [solved, setSolved] = useState(solvedAtStart);
  const solvedRef = useRef(solvedAtStart);
  const [hintOpen, setHintOpen] = useState(attempt.usedHint);
  const hintRef = useRef(attempt.usedHint);
  const [message, setMessage] = useState(() => {
    if (solvedAtStart) return 'Atrasts!';
    if (grid.path.length === task.wordLength) {
      return 'Pamēģini atrast iecerēto vārdu.';
    }
    return '';
  });

  const spoken = `${task.instruction} ${task.wordLength} burti. ${RULE}`;
  const word = lettersToWord(task.letters, grid.path);

  const persist = (next: WordGridAttemptData, extra: Partial<TaskAttempt> = {}) => {
    const withWord: WordGridAttemptData = {
      ...next,
      word: lettersToWord(task.letters, next.path),
    };
    gridRef.current = withWord;
    setGrid(withWord);
    if (readOnly) return;
    onUpdate(
      buildAttemptUpdate(
        attempt,
        { status: 'attempted', ...extra },
        serializeWordGrid(withWord),
      ),
    );
  };

  const pickCell = (index: number) => {
    if (readOnly || solvedRef.current) return;
    const current = gridRef.current;
    const pos = current.path.indexOf(index);
    if (pos !== -1) {
      const nextPath = pos === 0 ? [task.startIndex] : current.path.slice(0, pos);
      const changed = nextPath.length !== current.path.length;
      persist({
        ...current,
        path: nextPath,
        undoCount: current.undoCount + (changed ? 1 : 0),
      });
      setMessage('');
      return;
    }
    if (current.path.length >= task.wordLength) return;
    const last = current.path[current.path.length - 1]!;
    if (!isAdjacent(last, index, task.gridSize)) {
      setMessage('Izvēlies blakus rūtiņu');
      return;
    }
    const nextPath = [...current.path, index];
    const full = nextPath.length === task.wordLength;
    const next: WordGridAttemptData = {
      ...current,
      path: nextPath,
      attemptCount: current.attemptCount + (full ? 1 : 0),
    };
    const built = lettersToWord(task.letters, nextPath);
    if (full && wordsMatch(built, task.targetWord)) {
      solvedRef.current = true;
      setSolved(true);
      setMessage('Atrasts!');
      playCorrectChime();
      const helped = hintRef.current || next.solutionViewed;
      persist(next, {
        viewedAnswers: true,
        ...(hintRef.current ? { usedHint: true } : {}),
        selfAssessment: helped ? 'with_help' : 'independent',
      });
      return;
    }
    setMessage(full ? 'Pamēģini atrast iecerēto vārdu.' : '');
    persist(next);
  };

  const reset = () => {
    if (readOnly || solvedRef.current) return;
    const current = gridRef.current;
    if (current.path.length <= 1) return;
    persist({
      ...current,
      path: [task.startIndex],
      resetCount: current.resetCount + 1,
    });
    setMessage('');
  };

  const openHint = () => {
    if (hintRef.current) return;
    hintRef.current = true;
    setHintOpen(true);
    if (readOnly || solvedRef.current) return;
    persist(gridRef.current, { usedHint: true });
  };

  const openSolution = () => {
    if (gridRef.current.solutionViewed) return;
    const next = { ...gridRef.current, solutionViewed: true };
    if (readOnly || solvedRef.current) {
      gridRef.current = next;
      setGrid(next);
      return;
    }
    persist(next);
  };

  const locked = readOnly || solved;

  return (
    <div className="task-view task-view-word-grid">
      <div className="word-grid-head">
        <h2 className="word-grid-title">Atrodi vārdu</h2>
        <p className="word-grid-count">{task.wordLength} burti</p>
      </div>
      <div className="word-grid-rule-row">
        <ListenButton
          text={spoken}
          compact
          fullWidth={false}
          ariaLabel="Klausīties norādi"
        />
        <p className="instruction">{RULE}</p>
      </div>

      <div className="word-grid-scroll">
        <div
          className="word-grid"
          role="group"
          aria-label={`Burtu režģis, ${task.wordLength} burti`}
          style={{
            gridTemplateColumns: `repeat(${task.gridSize}, var(--word-grid-cell))`,
          }}
        >
          {task.letters.map((letter, index) => {
            const step = grid.path.indexOf(index);
            const selected = step !== -1;
            const isStart = index === task.startIndex;
            const className = [
              'word-grid-cell',
              selected ? 'word-grid-cell-selected' : '',
              isStart ? 'word-grid-cell-start' : '',
            ]
              .filter(Boolean)
              .join(' ');
            const state = selected
              ? `izvēlēts kā ${step + 1}`
              : 'nav izvēlēts';
            return (
              <button
                key={index}
                type="button"
                className={className}
                disabled={locked}
                aria-label={`Burts ${letter}${isStart ? ', sākums' : ''}, ${state}`}
                onClick={() => pickCell(index)}
              >
                {selected ? (
                  <span className="word-grid-num">{step + 1}</span>
                ) : null}
                <span className="word-grid-letter" lang="lv">
                  {letter}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="word-grid-built" lang="lv" aria-live="polite">
        <span className="sr-only">Izvēlētie burti: </span>
        {word || '—'}
      </p>
      <p
        className={
          solved ? 'word-grid-message word-grid-message-found' : 'word-grid-message'
        }
        role="status"
        aria-live="polite"
      >
        {message}
      </p>

      <div className="stack word-grid-actions">
        <Button
          variant="neutral"
          onClick={reset}
          disabled={locked}
        >
          Sākt no jauna
        </Button>
        <Button variant="help" onClick={openHint} disabled={hintOpen}>
          Mājiens
        </Button>
        <Button
          variant="secondary"
          onClick={openSolution}
          disabled={grid.solutionViewed}
        >
          Iecerētais vārds
        </Button>
      </div>

      {hintOpen ? (
        <p className="hint-box" role="status">
          Mājiens: {task.hint}
        </p>
      ) : null}
      {grid.solutionViewed ? (
        <p className="answers-inline" role="status" lang="lv">
          Iecerētais vārds: {task.targetWord}
        </p>
      ) : null}
    </div>
  );
}
