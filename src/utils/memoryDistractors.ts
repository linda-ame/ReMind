import { getAllTasks } from '../data/loadTasks';
import type { MemoryRecallTask } from '../types/memory';
import type { Task } from '../types/task';
import { shuffleIds } from './randomQueue';

const STOP = new Set([
  'pie',
  'un',
  'vai',
  'no',
  'uz',
  'ar',
  'par',
  'kad',
  'kas',
  'ir',
  'bija',
  'plkst',
  'pulksten',
]);

function memoryTokens(task: MemoryRecallTask): string[] {
  const tokens = new Set<string>();
  const add = (raw: string) => {
    const text = raw.trim().toLowerCase();
    if (!text) return;
    tokens.add(text);
    if (task.answer.kind === 'facts') {
      for (const word of text.split(/[^\p{L}\p{N}]+/u)) {
        if (word.length >= 4 && !STOP.has(word)) tokens.add(word);
      }
    }
  };
  if (task.answer.kind === 'facts') {
    for (const field of task.answer.fields) {
      for (const accepted of field.acceptedAnswers) add(accepted);
    }
  } else {
    for (const token of task.answer.correctTokens) add(token);
  }
  return [...tokens];
}

function visibleText(task: Task): string {
  const parts: string[] = [task.instruction];
  switch (task.type) {
    case 'odd_one_out':
      parts.push(...task.options, task.explanation, task.hint ?? '');
      break;
    case 'antonym':
      parts.push(
        task.word,
        ...task.answers,
        task.sentence ?? '',
        task.passage ?? '',
        ...(task.blanks ?? []).flatMap((blank) => [
          blank.sourceWord,
          ...blank.answers,
        ]),
      );
      break;
    case 'definition_guess':
      parts.push(
        task.description,
        ...task.answers,
        ...(task.clues ?? []),
        task.hint ?? '',
      );
      break;
    case 'sentence_completion':
      parts.push(task.sentence, ...task.answers, task.hint ?? '');
      break;
    default:
      break;
  }
  return parts.join('\n').toLowerCase();
}

function overlaps(text: string, tokens: string[]): boolean {
  return tokens.some((token) => {
    if (/^\d+$/.test(token)) {
      const re = new RegExp(`(^|[^\\d])${token}([^\\d]|$)`);
      return re.test(text);
    }
    return text.includes(token);
  });
}

function isShortDistractor(task: Task): boolean {
  if (task.difficulty != null && task.difficulty > 3) return false;
  if (task.type === 'odd_one_out') return true;
  if (task.type === 'antonym') {
    return task.mode == null || task.mode === 'word' || task.mode === 'context_sentence';
  }
  if (task.type === 'definition_guess') {
    const clues = (task.clues ?? []).join(' ');
    return task.description.length < 200 && clues.length < 200;
  }
  if (task.type === 'sentence_completion') {
    return task.sentence.length < 140 && !task.sentence.includes('___', task.sentence.indexOf('___') + 3);
  }
  return false;
}

function candidateTasks(): Task[] {
  return getAllTasks().filter((task) => {
    if (task.type === 'odd_one_out') return true;
    if (task.type === 'antonym') return task.mode !== 'context_passage';
    if (task.type === 'definition_guess') return true;
    return task.type === 'sentence_completion';
  });
}

/** Two or three short tasks that do not repeat the memorised items. */
export function pickDistractorIds(
  memory: MemoryRecallTask,
  count: number,
): string[] {
  const tokens = memoryTokens(memory);
  const clean = candidateTasks().filter(
    (task) => !overlaps(visibleText(task), tokens),
  );
  const short = clean.filter(isShortDistractor);
  const source = short.length >= count ? short : clean;
  return shuffleIds(source.map((task) => task.id)).slice(0, count);
}
