import { SELF_ASSESSMENT_ENABLED } from '../config/features';
import type { TaskAttempt } from '../types/progress';
import type { Task } from '../types/task';

/** Human-readable prompt / stem for a task (summary & review). */
export function taskPromptText(task: Task): string {
  switch (task.type) {
    case 'word_reading':
      return task.word;
    case 'sentence_completion':
      return task.sentence;
    case 'image_word':
      return task.sentence;
    case 'word_choice':
      return task.prompt;
    case 'reading_comprehension':
      return task.passage;
    case 'sentence_order':
      return task.modelSentence;
    case 'odd_one_out':
      return task.instruction;
    case 'antonym':
      return task.word;
    case 'definition_guess':
      return task.description;
  }
}

/** Expected / correct answers as display strings. */
export function expectedAnswerLabels(task: Task): string[] {
  switch (task.type) {
    case 'word_reading':
      return [];
    case 'sentence_completion':
    case 'image_word':
    case 'antonym':
    case 'definition_guess':
      return [...task.answers];
    case 'word_choice':
      return task.correctIndices
        .map((i) => task.options[i])
        .filter((x): x is string => typeof x === 'string');
    case 'reading_comprehension':
      return task.questions.flatMap((q) => q.answers);
    case 'sentence_order':
      return [task.modelSentence];
    case 'odd_one_out': {
      const odd = task.options[task.correctIndex];
      return odd ? [odd] : [];
    }
  }
}

/** Parse stored enteredAnswer into display strings. */
export function enteredAnswerLabels(
  task: Task,
  attempt: TaskAttempt | null,
): string[] {
  if (!attempt) return [];

  if (task.type === 'reading_comprehension' && attempt.reading) {
    return attempt.reading.questions
      .map((q) => q.enteredAnswer)
      .filter((x): x is string => typeof x === 'string' && x.trim() !== '');
  }

  if (!attempt.enteredAnswer) return [];
  const raw = attempt.enteredAnswer;

  if (task.type === 'word_choice') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === 'string');
      }
    } catch {
      /* legacy single string */
    }
    return [raw];
  }

  if (task.type === 'sentence_order') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const indices = parsed.filter(
          (x): x is number => typeof x === 'number',
        );
        return [
          indices
            .map((i) => task.words[i])
            .filter((w): w is string => typeof w === 'string')
            .join(' '),
        ].filter((s) => s.trim() !== '');
      }
    } catch {
      /* ignore */
    }
    return [raw];
  }

  if (task.type === 'odd_one_out') {
    try {
      const idx = Number(JSON.parse(raw));
      if (Number.isInteger(idx) && task.options[idx] != null) {
        return [task.options[idx]];
      }
    } catch {
      /* plain string option */
    }
    return [raw];
  }

  return [raw];
}

export function formatAnswerList(labels: string[]): string {
  if (labels.length === 0) return '—';
  return labels.join(', ');
}

/**
 * Fold Latvian length/soft marks (and other combining marks) so
 * "maja" ≈ "māja", "skola" ≈ "skolā" only differs by the ending letter, not ā.
 */
export function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

/**
 * Normalize for comparison: trim, lower case, collapse spaces, ignore diacritics.
 * Typo forgiveness (1 edit on long words) is applied separately in textMatchesAccepted.
 */
export function normalizeAnswerText(s: string): string {
  return stripDiacritics(s.trim().toLowerCase().replace(/\s+/g, ' '));
}

/** After normalize: only words this long may match with 1 edit (insert/delete/substitute). */
export const LONG_WORD_TYPO_MIN_LEN = 7;

function editDistanceAtMost(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  // Banded Levenshtein — early exit when distance > max
  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0]!;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j]! + 1,
        curr[j - 1]! + 1,
        prev[j - 1]! + cost,
      );
      if (curr[j]! < rowMin) rowMin = curr[j]!;
    }
    if (rowMin > max) return false;
    [prev, curr] = [curr, prev];
  }
  return prev[n]! <= max;
}

/** 1-letter typo OK only when both sides are long (image / definition guess). */
function matchesWithOptionalLongTypo(
  enteredNorm: string,
  acceptedNorm: string,
  allowLongTypo: boolean,
): boolean {
  if (!acceptedNorm) return false;
  if (enteredNorm === acceptedNorm) return true;
  if (!allowLongTypo) return false;
  if (
    enteredNorm.length < LONG_WORD_TYPO_MIN_LEN ||
    acceptedNorm.length < LONG_WORD_TYPO_MIN_LEN
  ) {
    return false;
  }
  return editDistanceAtMost(enteredNorm, acceptedNorm, 1);
}

function taskAllowsLongWordTypo(
  taskType: Task['type'] | 'reading_question' | undefined,
): boolean {
  return taskType === 'image_word' || taskType === 'definition_guess';
}

/**
 * Open free-text tasks: key is illustrative — other phrasings may also be fine.
 * Choice / order tasks keep a definite “Pareizā atbilde”.
 */
export function taskUsesPossibleAnswerLabel(
  type: Task['type'] | 'reading_question',
): boolean {
  return (
    type === 'image_word' ||
    type === 'sentence_completion' ||
    type === 'antonym' ||
    type === 'definition_guess' ||
    type === 'reading_comprehension' ||
    type === 'reading_question'
  );
}

/** Label above the answer key list (task UI + summaries). */
export function answersBoxLabel(
  type: Task['type'] | 'reading_question',
  answerCount = 1,
): string {
  if (taskUsesPossibleAnswerLabel(type)) {
    return answerCount <= 1 ? 'Iespējamā atbilde' : 'Iespējamās atbildes';
  }
  return answerCount <= 1 ? 'Pareizā atbilde' : 'Pareizās atbildes';
}

/**
 * Match entered text against the answer key.
 * Pass taskType so image_word / definition_guess allow 1 edit on words ≥ 7 chars.
 */
export function textMatchesAccepted(
  entered: string,
  accepted: string[],
  taskType?: Task['type'] | 'reading_question',
): boolean {
  const n = normalizeAnswerText(entered);
  if (!n) return false;
  const allowLongTypo = taskAllowsLongWordTypo(taskType);
  return accepted.some((a) =>
    matchesWithOptionalLongTypo(n, normalizeAnswerText(a), allowLongTypo),
  );
}

/** Types where the app can judge correct vs incorrect from the answer key. */
export function taskHasObjectiveAnswer(task: Task): boolean {
  return task.type !== 'word_reading';
}

/**
 * Whether this task type uses the green / yellow / red self-assessment footer.
 * (Matches TaskScreen skipSelfAssessment — inverted.)
 * Gated by SELF_ASSESSMENT_ENABLED — flip that flag to restore UI everywhere.
 */
export function taskHasSelfAssessment(task: Task): boolean {
  if (!SELF_ASSESSMENT_ENABLED) return false;
  return (
    task.type === 'sentence_completion' ||
    task.type === 'image_word' ||
    task.type === 'sentence_order' ||
    task.type === 'antonym' ||
    task.type === 'definition_guess' ||
    task.type === 'reading_comprehension'
  );
}

/**
 * Evaluate stored answer against the key.
 * `null` = no answer to judge (empty / missing).
 */
export function isAnswerCorrect(
  task: Task,
  attempt: TaskAttempt | null,
): boolean | null {
  if (!attempt || !taskHasObjectiveAnswer(task)) return null;

  if (task.type === 'reading_comprehension') {
    // Aggregate: all answered questions must be correct; null if none answered.
    const qs = attempt.reading?.questions ?? [];
    let any = false;
    let allOk = true;
    for (const q of task.questions) {
      const qp = qs.find((x) => x.questionId === q.id);
      const entered = qp?.enteredAnswer?.trim() ?? '';
      if (!entered) {
        allOk = false;
        continue;
      }
      any = true;
      if (!textMatchesAccepted(entered, q.answers, 'reading_question')) {
        allOk = false;
      }
    }
    if (!any) return null;
    return allOk;
  }

  const raw = attempt.enteredAnswer;
  if (raw == null || String(raw).trim() === '') return null;

  switch (task.type) {
    case 'sentence_completion':
    case 'image_word':
    case 'antonym':
    case 'definition_guess':
      return textMatchesAccepted(raw, task.answers, task.type);

    case 'word_choice': {
      const correct = new Set(
        task.correctIndices
          .map((i) => task.options[i])
          .filter((x): x is string => typeof x === 'string'),
      );
      let selected: string[] = [];
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          selected = parsed.filter((x): x is string => typeof x === 'string');
        } else {
          selected = [raw];
        }
      } catch {
        selected = [raw];
      }
      if (selected.length === 0) return null;
      if (selected.length !== correct.size) return false;
      return selected.every((s) => correct.has(s));
    }

    case 'odd_one_out': {
      try {
        const idx = Number(JSON.parse(raw));
        if (!Number.isInteger(idx)) return null;
        return idx === task.correctIndex;
      } catch {
        const i = task.options.indexOf(raw);
        if (i < 0) return false;
        return i === task.correctIndex;
      }
    }

    case 'sentence_order': {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;
        const indices = parsed.filter(
          (x): x is number => typeof x === 'number',
        );
        if (indices.length === 0) return null;
        return task.acceptedOrders.some(
          (order) =>
            order.length === indices.length &&
            order.every((v, i) => v === indices[i]),
        );
      } catch {
        return null;
      }
    }

    case 'word_reading':
      return null;
  }
}

/** Per-question correctness for reading comprehension (null = unanswered). */
export function isReadingQuestionCorrect(
  answers: string[],
  entered: string | null | undefined,
): boolean | null {
  const t = entered?.trim() ?? '';
  if (!t) return null;
  return textMatchesAccepted(t, answers, 'reading_question');
}
