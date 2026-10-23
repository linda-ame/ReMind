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

export function normalizeAnswerText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function textMatchesAccepted(
  entered: string,
  accepted: string[],
): boolean {
  const n = normalizeAnswerText(entered);
  if (!n) return false;
  return accepted.some((a) => normalizeAnswerText(a) === n);
}

/** Types where the app can judge correct vs incorrect from the answer key. */
export function taskHasObjectiveAnswer(task: Task): boolean {
  return task.type !== 'word_reading';
}

/**
 * Whether this task type uses the green / yellow / red self-assessment footer.
 * (Matches TaskScreen skipSelfAssessment — inverted.)
 */
export function taskHasSelfAssessment(task: Task): boolean {
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
      if (!textMatchesAccepted(entered, q.answers)) allOk = false;
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
      return textMatchesAccepted(raw, task.answers);

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
  return textMatchesAccepted(t, answers);
}
