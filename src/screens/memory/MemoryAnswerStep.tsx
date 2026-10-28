import { useEffect, useRef, useState } from 'react';
import { AnswerField } from '../../components/AnswerField';
import { Button } from '../../components/Button';
import type { MemoryDraft, MemoryRecallTask } from '../../types/memory';
import type { AnswerInputFeedback } from '../../utils/answers';
import { playCorrectChime, playWrongBuzz } from '../../utils/answerFeedback';
import { fieldMatches, scoreMemoryDraft } from '../../utils/memoryScore';

interface Props {
  task: MemoryRecallTask;
  draft: MemoryDraft;
  /** Hidden on the first answer of a delayed task, so the later recall stays fair. */
  allowReveal: boolean;
  /** After the pause, say what to recall without showing the list. */
  recallCue?: boolean;
  onDraft: (recipe: (draft: MemoryDraft) => MemoryDraft) => void;
  /** Records a finished recall step. Returns false when the answer is still empty. */
  onRecord: (draft: MemoryDraft) => boolean;
  onAdvance: () => void;
  onSkip: () => void;
}

export function MemoryAnswerStep({
  task,
  draft,
  allowReveal,
  recallCue = false,
  onDraft,
  onRecord,
  onAdvance,
  onSkip,
}: Props) {
  const openRecognition = () => {
    onDraft((current) =>
      current.recognitionOpen ? current : { ...current, recognitionOpen: true },
    );
  };

  const [checked, setChecked] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const record = (nextDraft: MemoryDraft) => {
    const accepted = onRecord(nextDraft);
    if (accepted && allowReveal) setShowKey(true);
    return accepted;
  };

  const confirm = () => {
    if (!record(draft)) return;
    if (allowReveal && !showKey) {
      setShowKey(true);
      return;
    }
    onAdvance();
  };

  const checkAnswer = (nextDraft: MemoryDraft) => {
    if (!record(nextDraft)) return;
    setChecked(true);
    const scored = scoreMemoryDraft(task, nextDraft, 'submit');
    if (!scored.freeScore) return;
    if (scored.freeScore.exact) playCorrectChime();
    else playWrongBuzz();
  };

  const reveal = () => {
    const next: MemoryDraft =
      task.answer.kind !== 'facts'
        ? draft.answerVisible
          ? draft
          : { ...draft, answerVisible: true }
        : (() => {
            const keys = task.answer.fields.map((field) => field.key);
            const already = draft.revealedFactKeys ?? [];
            if (keys.every((key) => already.includes(key))) return draft;
            return { ...draft, revealedFactKeys: keys };
          })();
    if (next !== draft) onDraft(() => next);
    record(next);
  };

  const revealed = answerIsVisible(task, draft);
  const showCue = recallCue || task.category === 'appointment';

  return (
    <div className="memory-flow memory-flow-screen">
      {showCue ? (
        <p className="memory-instruction">{delayedPrompt(task)}</p>
      ) : null}
      {task.answer.kind === 'ordered_digits' ||
      task.answer.kind === 'unordered_list' ? (
        <RecallField
          task={task}
          draft={draft}
          readOnly={revealed || showKey}
          checked={checked}
          onDraft={onDraft}
          onCheck={checkAnswer}
        />
      ) : null}

      {task.answer.kind === 'facts' ? (
        <FactFields
          task={task}
          draft={draft}
          checked={checked}
          readOnly={showKey}
          onDraft={onDraft}
          onCheck={checkAnswer}
        />
      ) : null}

      {showKey ? (
        <p className="answers-inline" role="status">
          {formatMemoryAnswers(task)}
        </p>
      ) : null}

      {draft.recognitionOpen ? (
        <RecognitionPanel
          task={task}
          draft={draft}
          revealed={revealed || showKey}
          onDraft={onDraft}
          onRecord={record}
        />
      ) : task.answer.kind === 'facts' ? (
        <div className="memory-actions">
          <Button variant="primary" onClick={confirm}>
            Tālāk
          </Button>
          <Button variant="secondary" onClick={openRecognition}>
            Parādīt variantus
          </Button>
        </div>
      ) : (
        <div className="memory-actions">
          {checked ? (
            <Button variant="primary" onClick={confirm}>
              Tālāk
            </Button>
          ) : null}
          <Button variant="secondary" onClick={openRecognition}>
            Parādīt variantus
          </Button>
        </div>
      )}

      {draft.recognitionOpen ? (
        <div className="memory-actions">
          {allowReveal && !revealed ? (
            <Button variant="secondary" onClick={reveal}>
              Parādīt atbildi
            </Button>
          ) : null}
          <Button variant="primary" onClick={confirm}>
            Tālāk
          </Button>
        </div>
      ) : null}
      <Button variant="neutral" className="task-skip-btn memory-skip" onClick={onSkip}>
        Izlaist
      </Button>
    </div>
  );
}

function recallTone(
  task: MemoryRecallTask,
  draft: MemoryDraft,
  checked: boolean,
): AnswerInputFeedback | null {
  if (!checked) return null;
  const scored = scoreMemoryDraft(task, draft, 'submit');
  if (!scored.freeScore) return 'unevaluable';
  return scored.freeScore.exact ? 'correct' : 'incorrect';
}

function RecallField({
  task,
  draft,
  readOnly,
  checked,
  onDraft,
  onCheck,
}: {
  task: MemoryRecallTask;
  draft: MemoryDraft;
  readOnly: boolean;
  checked: boolean;
  onDraft: (recipe: (draft: MemoryDraft) => MemoryDraft) => void;
  onCheck: (draft: MemoryDraft) => void;
}) {
  return (
    <AnswerField
      id="memory-recall"
      ariaLabel="Atbilde"
      value={draft.pendingItem}
      placeholder="Ierakstiet vai ierunājiet atbildi…"
      autoFocus
      readOnly={readOnly}
      feedback={recallTone(task, draft, checked)}
      onChange={(value) =>
        onDraft((current) => ({ ...current, pendingItem: value }))
      }
      onSubmit={(text) => onCheck({ ...draft, pendingItem: text })}
    />
  );
}

function factTone(
  task: MemoryRecallTask,
  draft: MemoryDraft,
  key: string,
  checked: boolean,
): AnswerInputFeedback | null {
  if (!checked || task.answer.kind !== 'facts') return null;
  const field = task.answer.fields.find((item) => item.key === key);
  const raw = draft.facts[key] ?? '';
  if (!field || !raw.trim()) return 'unevaluable';
  return fieldMatches(field, raw) ? 'correct' : 'incorrect';
}

function FactFields({
  task,
  draft,
  checked,
  readOnly,
  onDraft,
  onCheck,
}: {
  task: MemoryRecallTask;
  draft: MemoryDraft;
  checked: boolean;
  readOnly: boolean;
  onDraft: (recipe: (draft: MemoryDraft) => MemoryDraft) => void;
  onCheck: (draft: MemoryDraft) => void;
}) {
  if (task.answer.kind !== 'facts') return null;
  const fields = task.answer.fields;
  const revealedKeys = new Set(draft.revealedFactKeys ?? []);

  return (
    <div className="memory-entry">
      {fields.map((field) => (
        <AnswerField
          key={field.key}
          id={`memory-fact-${field.key}`}
          label={field.prompt}
          value={draft.facts[field.key] ?? ''}
          placeholder="Ierakstiet vai ierunājiet atbildi…"
          readOnly={readOnly || revealedKeys.has(field.key)}
          feedback={factTone(task, draft, field.key, checked)}
          onChange={(next) =>
            onDraft((current) => ({
              ...current,
              facts: { ...current.facts, [field.key]: next },
            }))
          }
          onSubmit={(text) => {
            const facts = { ...draft.facts, [field.key]: text };
            const nextDraft: MemoryDraft = { ...draft, facts };
            onDraft(() => nextDraft);
            const filled = fields.every(
              (item) => (facts[item.key] ?? '').trim() !== '',
            );
            if (filled) onCheck(nextDraft);
          }}
        />
      ))}
    </div>
  );
}

function RecognitionPanel({
  task,
  draft,
  revealed,
  onDraft,
  onRecord,
}: {
  task: MemoryRecallTask;
  draft: MemoryDraft;
  revealed: boolean;
  onDraft: (recipe: (draft: MemoryDraft) => MemoryDraft) => void;
  onRecord: (draft: MemoryDraft) => boolean;
}) {
  if (task.answer.kind === 'facts') {
    const fields = task.answer.fields;
    const revealedKeys = new Set(draft.revealedFactKeys ?? []);
    return (
      <div className="memory-entry">
        {fields.map((field) => {
          const picked = draft.factIndices[field.key];
          const fieldRevealed = revealedKeys.has(field.key);
          return (
            <div key={field.key} className="memory-entry">
              <p className="memory-note">{field.prompt}</p>
              <RecognitionChoices
                options={field.recognition.options}
                selected={picked == null ? [] : [picked]}
                correct={[field.recognition.correctIndex]}
                multiple={false}
                revealed={fieldRevealed}
                onToggle={(optionIndex) => {
                  if (fieldRevealed) return;
                  const factIndices = {
                    ...draft.factIndices,
                    [field.key]: optionIndex,
                  };
                  const next = { ...draft, recognitionOpen: true, factIndices };
                  onDraft(() => next);
                  const all = fields.every(
                    (item) =>
                      factIndices[item.key] === item.recognition.correctIndex,
                  );
                  if (all) onRecord(next);
                }}
              />
            </div>
          );
        })}
      </div>
    );
  }

  if (task.answer.kind === 'ordered_digits') {
    return (
      <RecognitionChoices
        options={task.answer.recognition.options}
        selected={draft.singleIndex == null ? [] : [draft.singleIndex]}
        correct={[task.answer.recognition.correctIndex]}
        multiple={false}
        revealed={revealed}
        onToggle={(index) => {
          if (revealed) return;
          onDraft((current) => ({
            ...current,
            recognitionOpen: true,
            singleIndex: index,
          }));
        }}
        onSolved={(selected) => {
          onRecord({
            ...draft,
            recognitionOpen: true,
            singleIndex: selected[0] ?? null,
          });
        }}
      />
    );
  }

  return (
    <RecognitionChoices
      options={task.answer.recognition.options}
      selected={draft.multiIndices}
      correct={task.answer.recognition.correctIndices}
      multiple
      revealed={revealed}
      onToggle={(index) => {
        if (revealed) return;
        onDraft((current) => {
          const has = current.multiIndices.includes(index);
          const multiIndices = has
            ? current.multiIndices.filter((item) => item !== index)
            : [...current.multiIndices, index];
          return { ...current, recognitionOpen: true, multiIndices };
        });
      }}
      onSolved={(selected) => {
        onRecord({ ...draft, recognitionOpen: true, multiIndices: selected });
      }}
    />
  );
}

function RecognitionChoices({
  options,
  selected,
  correct,
  multiple,
  revealed,
  onToggle,
  onSolved,
}: {
  options: string[];
  selected: number[];
  correct: number[];
  multiple: boolean;
  revealed: boolean;
  onToggle: (index: number) => void;
  onSolved?: (selected: number[]) => void;
}) {
  const correctSet = new Set(correct);
  const [wrong, setWrong] = useState<number[]>([]);
  const [solved, setSolved] = useState(false);
  const chimed = useRef(false);
  const optionKey = options.join('\n');
  const correctKey = correct.join(',');
  useEffect(() => {
    setWrong([]);
    setSolved(false);
    chimed.current = false;
  }, [optionKey, correctKey]);
  const wrongSet = new Set(wrong);

  const pick = (index: number) => {
    if (revealed || solved || wrongSet.has(index)) return;
    if (correctSet.has(index) && selected.includes(index)) return;

    if (!correctSet.has(index)) {
      setWrong((current) =>
        current.includes(index) ? current : [...current, index],
      );
      playWrongBuzz();
      return;
    }

    if (!selected.includes(index)) onToggle(index);
    const next = new Set(selected);
    next.add(index);
    const complete = [...correctSet].every((item) => next.has(item));
    if (complete && !chimed.current) {
      chimed.current = true;
      setSolved(true);
      playCorrectChime();
      onSolved?.([...next]);
    }
  };

  return (
    <div
      className="memory-choices"
      role={multiple ? 'group' : 'radiogroup'}
      aria-label="Atbilžu varianti"
    >
      {options.map((option, index) => {
        const on = selected.includes(index);
        const isWrong = wrongSet.has(index) || (on && !correctSet.has(index));
        const isCorrect =
          (on && correctSet.has(index)) || (revealed && correctSet.has(index));
        const className = [
          'memory-choice',
          on && !isWrong && !isCorrect ? 'memory-choice-on' : '',
          isCorrect ? 'memory-choice-correct' : '',
          isWrong ? 'memory-choice-wrong' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={`${option}-${index}`}
            type="button"
            className={className}
            aria-pressed={on || isWrong}
            disabled={revealed || solved || isWrong || (isCorrect && on)}
            onClick={() => pick(index)}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function delayedPrompt(task: MemoryRecallTask): string {
  switch (task.category) {
    case 'digits':
      return 'Atceries ciparus. Secība ir svarīga.';
    case 'numbers':
      return 'Atceries skaitļus. Secība nav svarīga.';
    case 'words':
      return 'Atceries vārdus. Secība nav svarīga.';
    case 'shopping':
      return 'Atceries iepirkumus. Secība nav svarīga.';
    case 'appointment':
      return 'Atkārto: kad, cikos un kur.';
  }
}

function answerIsVisible(task: MemoryRecallTask, draft: MemoryDraft): boolean {
  if (task.answer.kind !== 'facts') return draft.answerVisible === true;
  const keys = draft.revealedFactKeys ?? [];
  return task.answer.fields.every((field) => keys.includes(field.key));
}

function formatMemoryAnswers(task: MemoryRecallTask): string {
  if (task.answer.kind === 'ordered_digits') {
    return `Atbilde: ${task.answer.correctTokens.join(' · ')}`;
  }
  if (task.answer.kind === 'unordered_list') {
    const quoted = task.answer.correctTokens.map((item) => `"${item}"`).join(', ');
    return task.answer.correctTokens.length <= 1
      ? `Atbilde: ${quoted}`
      : `Atbildes: ${quoted}`;
  }
  const parts = task.answer.fields
    .map((field) => {
      const value = field.acceptedAnswers[0] ?? '';
      const label = field.prompt.replace(/\?$/, '');
      return value ? `${label}: "${value}"` : '';
    })
    .filter(Boolean);
  return parts.length <= 1 ? `Atbilde: ${parts[0] ?? ''}` : `Atbildes: ${parts.join(', ')}`;
}
