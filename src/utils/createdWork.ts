import { getTasksByType } from '../data/loadTasks';
import type { TaskAttempt } from '../types/progress';
import type { SentenceCreationTask } from '../types/task';
import { enteredAnswerLabels } from './answers';
import { latestAttemptForTask } from './attempts';

export interface CreatedSentence {
  taskId: string;
  sentence: string;
  /** Given words or the locked word, so the sentence has its prompt. */
  cue: string;
  at: string;
}

export interface CreatedAssociation {
  taskId: string;
  brand: string;
  association: string;
  at: string;
}

function attemptTime(attempt: TaskAttempt): string {
  return attempt.completedAt ?? attempt.startedAt;
}

/** Confirmed work counts, even if Tālāk has not marked the row completed. */
function isCreatedAttempt(attempt: TaskAttempt | null): attempt is TaskAttempt {
  if (!attempt) return false;
  return attempt.status === 'completed' || attempt.viewedAnswers;
}

function sentenceCue(task: SentenceCreationTask): string {
  if (task.mode === 'include_keywords') {
    const words = (task.keywords ?? []).map((word) => word.trim()).filter(Boolean);
    return words.length > 0 ? `Vārdi: ${words.join(', ')}` : '';
  }
  const word = task.fixedWord?.trim();
  return word ? `Dots vārds: ${word}` : '';
}

/** Confirmed sentences from the current run, newest first. */
export function createdSentences(attempts: TaskAttempt[]): CreatedSentence[] {
  const items: CreatedSentence[] = [];
  for (const task of getTasksByType('sentence_creation')) {
    if (task.type !== 'sentence_creation') continue;
    const attempt = latestAttemptForTask(
      attempts,
      task.id,
      task.contentVersion,
    );
    if (!isCreatedAttempt(attempt)) continue;
    const sentence = enteredAnswerLabels(task, attempt)[0]?.trim() ?? '';
    if (!sentence) continue;
    items.push({
      taskId: task.id,
      sentence,
      cue: sentenceCue(task),
      at: attemptTime(attempt),
    });
  }
  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return items;
}

/** Confirmed associations from the current run, newest first. */
export function createdAssociations(
  attempts: TaskAttempt[],
): CreatedAssociation[] {
  const items: CreatedAssociation[] = [];
  for (const task of getTasksByType('brand_association')) {
    if (task.type !== 'brand_association') continue;
    const attempt = latestAttemptForTask(
      attempts,
      task.id,
      task.contentVersion,
    );
    if (!isCreatedAttempt(attempt)) continue;
    const association = attempt.enteredAnswer?.trim() ?? '';
    if (!association) continue;
    items.push({
      taskId: task.id,
      brand: task.brand,
      association,
      at: attemptTime(attempt),
    });
  }
  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return items;
}

/**
 * Latvian count: 1 teikums, 2 teikumi, 10 teikumu.
 * Zero is “Vēl nav” — the fold is empty, not a zero tally.
 */
export function lvCountLabel(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  if (n === 0) return 'Vēl nav';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 9 && (mod100 < 11 || mod100 > 19)) {
    return `${n} ${few}`;
  }
  return `${n} ${many}`;
}
