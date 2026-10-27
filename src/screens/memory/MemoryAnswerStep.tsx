import { AnswerField } from '../../components/AnswerField';
import { Button } from '../../components/Button';
import type { MemoryDraft, MemoryRecallTask } from '../../types/memory';
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
}

export function MemoryAnswerStep({
  task,
  draft,
  allowReveal,
  recallCue = false,
  onDraft,
  onSubmit,
}: Props) {
  const openRecognition = () => {
    onDraft((current) =>
      current.recognitionOpen ? current : { ...current, recognitionOpen: true },
    );
  };

  const confirm = () => {
    if (task.answer.kind === 'facts') {
      const last = task.answer.fields.length - 1;
      if (draft.factIndex < last) {
        onDraft((current) => ({
          ...current,
          factIndex: current.factIndex + 1,
        }));
        return;
      }
    }
    onSubmit('submit');
  };

  const reveal = () => {
    onDraft((current) => {
      if (task.answer.kind !== 'facts') {
        return current.answerVisible ? current : { ...current, answerVisible: true };
      }
      const field = task.answer.fields[current.factIndex];
      if (!field) return current;
      const keys = current.revealedFactKeys ?? [];
      if (keys.includes(field.key)) return current;
      return { ...current, revealedFactKeys: [...keys, field.key] };
    });
  };

  const revealed = answerIsVisible(task, draft);

  return (
    <div className="memory-flow">
      {recallCue ? (
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
        <FactFields
          task={task}
          draft={draft}
          revealed={revealed}
          onDraft={onDraft}
          onConfirm={confirm}
        />
      ) : null}

      {draft.recognitionOpen ? (
        <RecognitionPanel
          task={task}
          draft={draft}
          revealed={revealed}
          onDraft={onDraft}
        />
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
  revealed,
  onDraft,
  onConfirm,
}: {
  task: MemoryRecallTask;
  draft: MemoryDraft;
  revealed: boolean;
  onDraft: (recipe: (draft: MemoryDraft) => MemoryDraft) => void;
  onConfirm: () => void;
}) {
  if (task.answer.kind !== 'facts') return null;
  const fields = task.answer.fields;
  const index = Math.min(draft.factIndex, fields.length - 1);
  const field = fields[index];
  if (!field) return null;
  const value = draft.facts[field.key] ?? '';

  return (
    <div className="memory-entry">
      <p className="memory-note">
        {index + 1} no {fields.length}
      </p>
      <AnswerField
        key={field.key}
        id={`memory-fact-${field.key}`}
        label={field.prompt}
        value={value}
        placeholder="Ierakstiet vai ierunājiet atbildi…"
        autoFocus
        readOnly={revealed}
        onChange={(next) =>
          onDraft((current) => ({
            ...current,
            facts: { ...current.facts, [field.key]: next },
          }))
        }
        onSubmit={onConfirm}
      />
      {index > 0 ? (
        <Button
          variant="secondary"
          onClick={() =>
            onDraft((current) => ({
              ...current,
              factIndex: Math.max(0, current.factIndex - 1),
            }))
          }
        >
          Iepriekšējais
        </Button>
      ) : null}
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
    const fields = task.answer.fields;
    const index = Math.min(draft.factIndex, fields.length - 1);
    const field = fields[index];
    if (!field) return null;
    const picked = draft.factIndices[field.key];
    return (
      <RecognitionChoices
        options={field.recognition.options}
        selected={picked == null ? [] : [picked]}
        correct={[field.recognition.correctIndex]}
        multiple={false}
        revealed={revealed}
        onToggle={(optionIndex) => {
          if (revealed) return;
          onDraft((current) => ({
            ...current,
            recognitionOpen: true,
            factIndices: { ...current.factIndices, [field.key]: optionIndex },
          }));
        }}
      />
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
  return (
    <div
      className="memory-choices"
      role={multiple ? 'group' : 'radiogroup'}
      aria-label="Atbilžu varianti"
    >
      {options.map((option, index) => {
        const on = selected.includes(index);
        const showCorrect = revealed && correctSet.has(index);
        const className = [
          'memory-choice',
          on ? 'memory-choice-on' : '',
          showCorrect ? 'memory-choice-correct' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={`${option}-${index}`}
            type="button"
            className={className}
            aria-pressed={on}
            disabled={revealed}
            onClick={() => onToggle(index)}
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
      return 'Atceries dienu, laiku un vietu.';
  }
}

function answerIsVisible(task: MemoryRecallTask, draft: MemoryDraft): boolean {
  if (task.answer.kind !== 'facts') return draft.answerVisible === true;
  const field = task.answer.fields[draft.factIndex];
  if (!field) return false;
  return (draft.revealedFactKeys ?? []).includes(field.key);
}

function correctLine(task: MemoryRecallTask, draft: MemoryDraft): string {
  if (task.answer.kind === 'ordered_digits') {
    return task.answer.correctTokens.join('  ·  ');
  }
  if (task.answer.kind === 'unordered_list') {
    return task.answer.correctTokens.join(', ');
  }
  const field = task.answer.fields[draft.factIndex];
  return field?.acceptedAnswers[0] ?? '';
}
