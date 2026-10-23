import type { Task, TaskPack } from '../types/task';
import raw from './tasks.json';

const pack = raw as TaskPack;

/** Easier → harder (used for home menu and “Sākt visus”). */
export const TASK_TYPE_ORDER: Task['type'][] = [
  'word_reading',
  'image_word',
  'word_choice',
  'sentence_completion',
];

export const TASK_TYPE_LABELS: Record<Task['type'], string> = {
  word_reading: 'Vārdu lasīšana',
  image_word: 'Vārdu atpazīšana',
  word_choice: 'Vārdu izvēle',
  sentence_completion: 'Teikumu papildināšana',
};

function typeRank(type: Task['type']): number {
  const i = TASK_TYPE_ORDER.indexOf(type);
  return i === -1 ? 999 : i;
}

export function getTaskPack(): TaskPack {
  return pack;
}

export function getAllTasks(): Task[] {
  return [...pack.tasks].sort((a, b) => typeRank(a.type) - typeRank(b.type));
}

export function getTaskById(id: string): Task | undefined {
  return pack.tasks.find((t) => t.id === id);
}

export function getTasksByType(type: Task['type']): Task[] {
  // Preserve JSON order within a type (important for word-reading pack sequence).
  return pack.tasks.filter((t) => t.type === type);
}
