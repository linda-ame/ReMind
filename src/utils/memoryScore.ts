import type {
  MemoryAnswer,
  MemoryDraft,
  MemoryFactField,
  MemoryRecallTask,
  MemoryScore,
} from '../types/memory';

export type MemorySubmitKind = 'submit' | 'forgot';

function normText(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** `14.30`, `14:30`, `plkst. 9:05` → `14:30` / `09:05`. */
export function normalizeClock(raw: string): string | null {
  const stripped = raw
    .toLowerCase()
    .replace(/pulksten|plkst\.?/g, '')
    .replace(/\s+/g, '')
    .replace(/\./g, ':');
  const match = stripped.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

function fieldMatches(field: MemoryFactField, raw: string): boolean {
  const clock = normalizeClock(raw);
  const text = normText(raw);
  return field.acceptedAnswers.some((accepted) => {
    const acceptedClock = normalizeClock(accepted);
    if (clock && acceptedClock) return clock === acceptedClock;
    return normText(accepted) === text;
  });
}

function scorePositions(entered: string[], correct: string[]): MemoryScore {
  let hits = 0;
  for (let i = 0; i < correct.length; i++) {
    if (entered[i] === correct[i]) hits += 1;
  }
  const exact =
    entered.length === correct.length && hits === correct.length;
  return { correct: hits, total: correct.length, exact };
}

function scoreSet(entered: string[], correct: string[]): MemoryScore {
  const used = new Set<number>();
  let hits = 0;
  for (const token of correct) {
    const idx = entered.findIndex(
      (item, i) => !used.has(i) && item === token,
    );
    if (idx >= 0) {
      used.add(idx);
      hits += 1;
    }
  }
  const extras = entered.length - hits;
  return {
    correct: hits,
    total: correct.length,
    exact: hits === correct.length && extras === 0,
  };
}

function scoreMulti(
  selected: number[],
  correctIndices: number[],
): MemoryScore {
  const correct = new Set(correctIndices);
  let hits = 0;
  let extras = 0;
  const seen = new Set<number>();
  for (const index of selected) {
    if (seen.has(index)) continue;
    seen.add(index);
    if (correct.has(index)) hits += 1;
    else extras += 1;
  }
  return {
    correct: Math.max(0, hits - extras),
    total: correctIndices.length,
    exact: hits === correctIndices.length && extras === 0,
  };
}

function hasFreeContent(task: MemoryRecallTask, draft: MemoryDraft): boolean {
  if (task.answer.kind === 'ordered_digits') return draft.digits.length > 0;
  if (task.answer.kind === 'unordered_list') {
    return draft.items.some((item) => item.trim() !== '');
  }
  return task.answer.fields.some((field) =>
    (draft.facts[field.key] ?? '').trim() !== '',
  );
}

function recognitionUsed(draft: MemoryDraft): boolean {
  if (draft.singleIndex != null) return true;
  if (draft.multiIndices.length > 0) return true;
  return Object.values(draft.factIndices).some((index) => index != null);
}

/**
 * Score a finished response.
 * Free recall and recognition stay separate.
 * An empty Tālāk is spoken and not auto-scored.
 * Neatceros with an empty answer is 0.
 * Unmatched free-text facts are left unscored (not marked wrong).
 */
export function scoreMemoryDraft(
  task: MemoryRecallTask,
  draft: MemoryDraft,
  kind: MemorySubmitKind,
): MemoryAnswer {
  const answeredAt = new Date().toISOString();
  const recognitionOpened = draft.recognitionOpen || recognitionUsed(draft);
  const answer: MemoryAnswer = {
    recognitionOpened,
    answeredAt,
  };

  if (task.answer.kind === 'ordered_digits') {
    answer.freeResponseRaw = draft.digits.join('');
    if (draft.digits.length === 0 && kind === 'submit' && !recognitionUsed(draft)) {
      answer.freeScore = null;
      answer.notScorableReason = 'spoken_untranscribed';
    } else if (draft.digits.length === 0 && kind === 'forgot') {
      answer.freeScore = {
        correct: 0,
        total: task.answer.correctTokens.length,
        exact: false,
      };
    } else if (draft.digits.length > 0) {
      answer.freeScore = scorePositions(
        draft.digits,
        task.answer.correctTokens,
      );
    }
    if (draft.singleIndex != null) {
      const options = task.answer.recognition.options;
      const ok = draft.singleIndex === task.answer.recognition.correctIndex;
      answer.recognitionSelection = options[draft.singleIndex] ?? '';
      answer.recognitionScore = { correct: ok ? 1 : 0, total: 1, exact: ok };
    }
    return answer;
  }

  if (task.answer.kind === 'unordered_list') {
    const pending = draft.pendingItem.trim();
    const items = [...draft.items.map((item) => item.trim()), pending].filter(
      Boolean,
    );
    answer.freeResponseRaw = items;
    const numeric = task.answer.freeInput === 'numeric_list';
    const norm = (value: string) =>
      numeric ? value.replace(/\s+/g, '') : normText(value);
    if (items.length === 0 && kind === 'submit' && !recognitionUsed(draft)) {
      answer.freeScore = null;
      answer.notScorableReason = 'spoken_untranscribed';
    } else if (items.length === 0 && kind === 'forgot') {
      answer.freeScore = {
        correct: 0,
        total: task.answer.correctTokens.length,
        exact: false,
      };
    } else if (items.length > 0) {
      answer.freeScore = scoreSet(
        items.map(norm),
        task.answer.correctTokens.map(norm),
      );
    }
    if (draft.multiIndices.length > 0) {
      const options = task.answer.recognition.options;
      answer.recognitionSelection = draft.multiIndices
        .filter((index) => index >= 0 && index < options.length)
        .map((index) => options[index]!);
      answer.recognitionScore = scoreMulti(
        draft.multiIndices,
        task.answer.recognition.correctIndices,
      );
    }
    return answer;
  }

  const facts: Record<string, string> = {};
  let matched = 0;
  let empty = 0;
  let ambiguous = 0;
  for (const field of task.answer.fields) {
    const raw = (draft.facts[field.key] ?? '').trim();
    facts[field.key] = raw;
    if (!raw) {
      empty += 1;
      continue;
    }
    if (fieldMatches(field, raw)) matched += 1;
    else ambiguous += 1;
  }
  answer.freeResponseRaw = facts;

  const nothingTyped = !hasFreeContent(task, draft);
  if (nothingTyped && kind === 'submit' && !recognitionUsed(draft)) {
    answer.freeScore = null;
    answer.notScorableReason = 'spoken_untranscribed';
  } else if (nothingTyped && kind === 'forgot') {
    answer.freeScore = {
      correct: 0,
      total: task.answer.fields.length,
      exact: false,
    };
  } else if (!nothingTyped) {
    const scoredTotal = task.answer.fields.length - ambiguous;
    answer.freeScore = {
      correct: matched,
      total: Math.max(scoredTotal, matched),
      exact: ambiguous === 0 && empty === 0 && matched === task.answer.fields.length,
    };
    if (ambiguous > 0) answer.notScorableReason = 'ambiguous';
  }

  const selection: Record<string, string> = {};
  let recognitionHits = 0;
  let recognitionUsedCount = 0;
  for (const field of task.answer.fields) {
    const index = draft.factIndices[field.key];
    if (index == null) continue;
    recognitionUsedCount += 1;
    selection[field.key] = field.recognition.options[index] ?? '';
    if (index === field.recognition.correctIndex) recognitionHits += 1;
  }
  if (recognitionUsedCount > 0) {
    answer.recognitionSelection = selection;
    answer.recognitionScore = {
      correct: recognitionHits,
      total: task.answer.fields.length,
      exact:
        recognitionHits === task.answer.fields.length &&
        recognitionUsedCount === task.answer.fields.length,
    };
  }
  return answer;
}

export function formatScoreLine(prefix: string, score: MemoryScore): string {
  return `${prefix} ${score.correct} no ${score.total}`;
}

export function formatDelay(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  const minuteWord = minutes === 1 ? 'minūte' : 'minūtes';
  const secondWord = rest === 1 ? 'sekunde' : 'sekundes';
  if (minutes === 0) return `Pagāja ${rest} ${secondWord}`;
  return `Pagāja ${minutes} ${minuteWord} ${rest} ${secondWord}`;
}
