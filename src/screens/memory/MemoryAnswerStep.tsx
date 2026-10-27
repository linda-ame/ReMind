import { useRef, useState } from 'react';
import { AnswerField } from '../../components/AnswerField';
import { Button } from '../../components/Button';
import type { MemoryDraft, MemoryRecallTask } from '../../types/memory';
import { playCorrectChime, playWrongBuzz } from '../../utils/answerFeedback';
import type { MemorySubmitKind } from '../../utils/memoryScore';

interface Props {
  task: MemoryRecallTask;
  draft: MemoryDraft;
  /** Hidden on the first answer of a delayed task, so the later recall stays fair. */
  allowReveal: boolean;
  /** After the pause, say what to recall without showing the list. */
  recallCue?: boolean;
  onDraft: (recipe: (draft: MemoryDraft) => MemoryDraft) => void;
  onSubmit: (kind: MemorySubmitKind) => void;
  onSkip: () => void;
}

export function MemoryAnswerStep({
  task,
  draft,
  allowReveal,
  recallCue = false,
  onDraft,
  onSubmit,
  onSkip,
}: Props) {
  const openRecognition = () => {
    onDraft((current) =>
      current.recognitionOpen ? current : { ...current, recognitionOpen: true },
    );
  };

  const confirm = () => {
    onSubmit('submit');
  };

  const reveal = () => {
    onDraft((current) => {
      if (task.answer.kind !== 'facts') {
        return current.answerVisible ? current : { ...current, answerVisible: true };
      }
      const keys = task.answer.fields.map((field) => field.key);
      const already = current.revealedFactKeys ?? [];
      if (keys.every((key) => already.includes(key))) return current;
      return { ...current, revealedFactKeys: keys };
    });
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
          draft={draft}
          readOnly={revealed}
          onDraft={onDraft}
          onConfirm={confirm}
        />
      ) : null}

      {task.answer.kind === 'facts' ? (
        <FactFields task={task} draft={draft} onDraft={onDraft} onConfirm={confirm} />
      ) : null}

      {draft.recognitionOpen ? (
        <RecognitionPanel
          task={task}
          draft={draft}
          revealed={revealed}
          onDraft={onDraft}
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
        <Button variant="secondary" onClick={openRecognition}>
          Parādīt variantus
        </Button>
      )}

      {draft.recognitionOpen && revealed ? (
        <p className="memory-stimulus" role="status">
          {correctLine(task, draft)}
        </p>
      ) : null}

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

function RecallField({
  draft,
  readOnly,
  onDraft,
  onConfirm,
}: {
  draft: MemoryDraft;
  readOnly: boolean;
  onDraft: (recipe: (draft: MemoryDraft) => MemoryDraft) => void;
  onConfirm: () => void;
}) {
  return (
    <AnswerField
      id="memory-recall"
      ariaLabel="Atbilde"
      value={draft.pendingItem}
      placeholder="Ierakstiet vai ierunājiet atbildi…"
      autoFocus
      readOnly={readOnly}
      onChange={(value) =>
        onDraft((current) => ({ ...current, pendingItem: value }))
      }
      onSubmit={onConfirm}
    />
  );
}

function FactFields({
  task,
  draft,
  onDraft,
  onConfirm,
}: {
  task: MemoryRecallTask;
  draft: MemoryDraft;
  onDraft: (recipe: (draft: MemoryDraft) => MemoryDraft) => void;
  onConfirm: () => void;
}) {
  if (task.answer.kind !== 'facts') return null;
  const fields = task.answer.fields;
  const revealedKeys = new Set(draft.revealedFactKeys ?? []);

  return (
    <div className="memory-entry">
      {fields.map((field, index) => (
        <AnswerField
          key={field.key}
          id={`memory-fact-${field.key}`}
          label={field.prompt}
          value={draft.facts[field.key] ?? ''}
          placeholder="Ierakstiet vai ierunājiet atbildi…"
          autoFocus={index === 0}
          readOnly={revealedKeys.has(field.key)}
          onChange={(next) =>
            onDraft((current) => ({
              ...current,
              facts: { ...current.facts, [field.key]: next },
            }))
          }
          onSubmit={() => {
            const next = fields[index + 1];
            if (!next) {
              onConfirm();
              return;
            }
            document.getElementById(`memory-fact-${next.key}`)?.focus();
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
}: {
  task: MemoryRecallTask;
  draft: MemoryDraft;
  revealed: boolean;
  onDraft: (recipe: (draft: MemoryDraft) => MemoryDraft) => void;
}) {
  if (task.answer.kind === 'facts') {
    const revealedKeys = new Set(draft.revealedFactKeys ?? []);
    return (
      <div className="memory-entry">
        {task.answer.fields.map((field) => {
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
                  onDraft((current) => ({
                    ...current,
                    recognitionOpen: true,
                    factIndices: {
                      ...current.factIndices,
                      [field.key]: optionIndex,
                    },
                  }));
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
}: {
  options: string[];
  selected: number[];
  correct: number[];
  multiple: boolean;
  revealed: boolean;
  onToggle: (index: number) => void;
}) {
  const correctSet = new Set(correct);
  const [wrong, setWrong] = useState<number[]>([]);
  const [solved, setSolved] = useState(false);
  const chimed = useRef(false);
  const wrongSet = new Set(wrong);

  const pick = (index: number) => {
    if (revealed || solved || wrongSet.has(index)) return;
    if (correctSet.has(index) && selected.includes(index)) return;

    if (!correctSet.has(index)) {
      setWrong((current) =>
        current.includes(index) ? current : [...current, index],
      );
      playWrongBuzz();
      if (!selected.includes(index)) onToggle(index);
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

function correctLine(task: MemoryRecallTask, _draft: MemoryDraft): string {
  if (task.answer.kind === 'ordered_digits') {
    return task.answer.correctTokens.join('  ·  ');
  }
  if (task.answer.kind === 'unordered_list') {
    return task.answer.correctTokens.join(', ');
  }
  return task.answer.fields
    .map((field) => field.acceptedAnswers[0] ?? '')
    .filter(Boolean)
    .join('\n');
}
