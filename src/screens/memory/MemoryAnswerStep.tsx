import { useState } from 'react';
import { Button } from '../../components/Button';
import type { MemoryDraft, MemoryRecallTask } from '../../types/memory';
import type { MemorySubmitKind } from '../../utils/memoryScore';

interface Props {
  task: MemoryRecallTask;
  draft: MemoryDraft;
  onDraft: (recipe: (draft: MemoryDraft) => MemoryDraft) => void;
  onSubmit: (kind: MemorySubmitKind) => void;
}

export function MemoryAnswerStep({ task, draft, onDraft, onSubmit }: Props) {
  const [itemText, setItemText] = useState(draft.pendingItem);

  const openRecognition = () => {
    onDraft((current) =>
      current.recognitionOpen ? current : { ...current, recognitionOpen: true },
    );
  };

  return (
    <div className="memory-flow">
      <h1 className="memory-heading">Atceries</h1>
      <p className="memory-instruction">{task.instruction}</p>

      {task.answer.kind === 'ordered_digits' ? (
        <DigitPad
          digits={draft.digits}
          onAdd={(key) =>
            onDraft((current) => ({
              ...current,
              digits: [...current.digits, key],
            }))
          }
          onBackspace={() =>
            onDraft((current) => ({
              ...current,
              digits: current.digits.slice(0, -1),
            }))
          }
        />
      ) : null}

      {task.answer.kind === 'unordered_list' ? (
        <ItemList
          items={draft.items}
          numeric={task.answer.freeInput === 'numeric_list'}
          itemText={itemText}
          onItemText={(value) => {
            setItemText(value);
            onDraft((current) => ({ ...current, pendingItem: value }));
          }}
          onAdd={() => {
            const next = itemText.trim();
            if (!next) return;
            setItemText('');
            onDraft((current) => ({
              ...current,
              items: [...current.items, next],
              pendingItem: '',
            }));
          }}
          onRemove={(index) =>
            onDraft((current) => ({
              ...current,
              items: current.items.filter((_, i) => i !== index),
            }))
          }
        />
      ) : null}

      {task.answer.kind === 'facts' ? (
        <FactFields
          task={task}
          draft={draft}
          onDraft={onDraft}
        />
      ) : null}

      {draft.recognitionOpen ? (
        <RecognitionPanel task={task} draft={draft} onDraft={onDraft} />
      ) : null}

      <div className="memory-actions">
        <Button
          variant="primary"
          onClick={() => {
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
          }}
        >
          Tālāk
        </Button>
        <Button variant="secondary" onClick={() => onSubmit('forgot')}>
          Neatceros
        </Button>
        {!draft.recognitionOpen ? (
          <Button variant="secondary" onClick={openRecognition}>
            Izvēlēties no variantiem
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function DigitPad({
  digits,
  onAdd,
  onBackspace,
}: {
  digits: string[];
  onAdd: (key: string) => void;
  onBackspace: () => void;
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  return (
    <div className="memory-entry">
      <p className="memory-stimulus memory-stimulus-entry" aria-live="polite">
        {digits.length > 0 ? digits.join('  ·  ') : ' '}
      </p>
      <div className="memory-keypad">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            className="memory-key"
            onClick={() => onAdd(key)}
          >
            {key}
          </button>
        ))}
        <button
          type="button"
          className="memory-key memory-key-wide"
          onClick={onBackspace}
        >
          Dzēst
        </button>
      </div>
    </div>
  );
}

function ItemList({
  items,
  numeric,
  itemText,
  onItemText,
  onAdd,
  onRemove,
}: {
  items: string[];
  numeric: boolean;
  itemText: string;
  onItemText: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const add = () => onAdd();

  return (
    <div className="memory-entry">
      <p className="memory-note">Secība nav svarīga. Varat pierakstīt pa vienam.</p>
      <div className="memory-add-row">
        <input
          className="memory-input"
          value={itemText}
          inputMode={numeric ? 'numeric' : 'text'}
          autoComplete="off"
          aria-label={numeric ? 'Skaitlis' : 'Vārds'}
          onChange={(event) => onItemText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
        />
        <Button variant="secondary" onClick={add}>
          Ievadīt
        </Button>
      </div>
      <ul className="memory-items">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="memory-item">
            <span>{item}</span>
            <button
              type="button"
              className="memory-item-remove"
              aria-label={`Noņemt ${item}`}
              onClick={() => onRemove(index)}
            >
              Noņemt
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FactFields({
  task,
  draft,
  onDraft,
}: {
  task: MemoryRecallTask;
  draft: MemoryDraft;
  onDraft: (recipe: (draft: MemoryDraft) => MemoryDraft) => void;
}) {
  if (task.answer.kind !== 'facts') return null;
  const fields = task.answer.fields;
  const index = Math.min(draft.factIndex, fields.length - 1);
  const field = fields[index];
  if (!field) return null;
  const value = draft.facts[field.key] ?? '';

  const setValue = (next: string) => {
    onDraft((current) => ({
      ...current,
      facts: { ...current.facts, [field.key]: next },
    }));
  };

  return (
    <div className="memory-entry">
      <p className="memory-note">
        {index + 1} no {fields.length}
      </p>
      <label className="memory-fact-label" htmlFor={`memory-fact-${field.key}`}>
        {field.prompt}
      </label>
      <input
        id={`memory-fact-${field.key}`}
        className="memory-input"
        value={value}
        autoComplete="off"
        onChange={(event) => setValue(event.target.value)}
      />
      {draft.recognitionOpen ? (
        <RecognitionChoices
          label="Var izvēlēties vienu atbildi."
          options={field.recognition.options}
          selected={
            draft.factIndices[field.key] == null
              ? []
              : [draft.factIndices[field.key]!]
          }
          multiple={false}
          onToggle={(optionIndex) => {
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
      ) : null}
      <div className="memory-actions">
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
    </div>
  );
}

function RecognitionPanel({
  task,
  draft,
  onDraft,
}: {
  task: MemoryRecallTask;
  draft: MemoryDraft;
  onDraft: (recipe: (draft: MemoryDraft) => MemoryDraft) => void;
}) {
  if (task.answer.kind === 'facts') return null;
  if (task.answer.kind === 'ordered_digits') {
    return (
      <RecognitionChoices
        label="Izvēlieties vienu virkni."
        options={task.answer.recognition.options}
        selected={draft.singleIndex == null ? [] : [draft.singleIndex]}
        multiple={false}
        onToggle={(index) =>
          onDraft((current) => ({
            ...current,
            recognitionOpen: true,
            singleIndex: index,
          }))
        }
      />
    );
  }
  return (
    <RecognitionChoices
      label="Var atzīmēt vairākus."
      options={task.answer.recognition.options}
      selected={draft.multiIndices}
      multiple
      onToggle={(index) => {
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
  label,
  options,
  selected,
  multiple,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: number[];
  multiple: boolean;
  onToggle: (index: number) => void;
}) {
  return (
    <div className="memory-entry">
      <p className="memory-note">{label}</p>
      <div className="memory-choices" role={multiple ? 'group' : 'radiogroup'}>
        {options.map((option, index) => {
          const on = selected.includes(index);
          return (
            <button
              key={`${option}-${index}`}
              type="button"
              className={on ? 'memory-choice memory-choice-on' : 'memory-choice'}
              aria-pressed={on}
              onClick={() => onToggle(index)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
