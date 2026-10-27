import type {
  ReadingQuestionProgress,
  TaskAttempt,
} from '../types/progress';
import type { Task } from '../types/task';

const TYPED_ANSWER_TYPES: ReadonlySet<Task['type']> = new Set([
  'sentence_completion',
  'sentence_completion_multi',
  'antonym',
  'definition_guess',
  'image_word',
]);

/**
 * Whether the user has engaged enough to show Tālāk (arrow / swipe).
 * Word reading has no answer — always ready.
 * Reading comprehension is handled per phase in its own view.
 * Typed answers unlock only after Enter / finished dictation (viewedAnswers),
 * not on every keystroke.
 */
export function taskHasAdvanceReady(
  task: Task,
  attempt: TaskAttempt,
): boolean {
  if (task.type === 'word_reading') return true;
  if (task.type === 'sentence_creation') return true;
  if (task.type === 'brand_association') return true;
  if (task.type === 'reading_comprehension') return false;
  if (task.type === 'spelling_check') {
    return attempt.viewedAnswers || attempt.status === 'completed';
  }

  if (attempt.status === 'completed') return true;
  if (attempt.viewedAnswers) return true;

  // Typing alone must not unlock → — wait for submit (Enter / Ierunāt).
  if (TYPED_ANSWER_TYPES.has(task.type)) return false;

  const raw = attempt.enteredAnswer;
  if (raw == null) return false;
  const s = String(raw).trim();
  if (!s) return false;

  // Word choice: only when every correct option is selected (wrong tries
  // must not unlock — viewedAnswers is set only on full success).
  if (task.type === 'word_choice') {
    const correct = new Set(
      task.correctIndices
        .map((i) => task.options[i])
        .filter((x): x is string => typeof x === 'string'),
    );
    let selected: string[] = [];
    try {
      const parsed: unknown = JSON.parse(s);
      if (Array.isArray(parsed)) {
        selected = parsed.filter((x): x is string => typeof x === 'string');
      } else {
        selected = [s];
      }
    } catch {
      selected = [s];
    }
    if (selected.length === 0 || selected.length !== correct.size) return false;
    return selected.every((opt) => correct.has(opt));
  }

  // Sentence order: unlock only when every word is placed (or model shown).
  if (task.type === 'sentence_order') {
    try {
      const parsed: unknown = JSON.parse(s);
      if (!Array.isArray(parsed)) return false;
      return parsed.length >= task.words.length;
    } catch {
      return false;
    }
  }

  // Odd one out: only the correct index unlocks (wrong picks stay searchable).
  if (task.type === 'odd_one_out') {
    try {
      const idx = Number(JSON.parse(s));
      return Number.isInteger(idx) && idx === task.correctIndex;
    } catch {
      const i = task.options.indexOf(s);
      return i >= 0 && i === task.correctIndex;
    }
  }

  // Sentence–image match: only the correct image unlocks (wrong picks stay searchable).
  if (task.type === 'sentence_image_match') {
    try {
      const idx = Number(JSON.parse(s));
      return Number.isInteger(idx) && idx === task.correctIndex;
    } catch {
      return false;
    }
  }

  return true;
}

/** RC question: Enter / dictation finished, or answer key revealed — not mere typing. */
export function readingQuestionAdvanceReady(
  q: ReadingQuestionProgress | undefined,
): boolean {
  if (!q) return false;
  if (q.viewedAnswers) return true;
  if (q.status === 'completed') return true;
  return false;
}
