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
  }
}

/** Expected / correct answers as display strings. */
export function expectedAnswerLabels(task: Task): string[] {
  switch (task.type) {
    case 'word_reading':
      return [];
    case 'sentence_completion':
    case 'image_word':
      return [...task.answers];
    case 'word_choice':
      return task.correctIndices
        .map((i) => task.options[i])
        .filter((x): x is string => typeof x === 'string');
    case 'reading_comprehension':
      return task.questions.flatMap((q) => q.answers);
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

  return [raw];
}

export function formatAnswerList(labels: string[]): string {
  if (labels.length === 0) return '—';
  return labels.join(', ');
}
