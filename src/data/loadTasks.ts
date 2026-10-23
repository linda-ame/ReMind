import type { Task, TaskPack } from '../types/task';
import rawV1 from './tasks.json';
import rawRc from './reading_comprehension.json';
import rawP03 from './p03_visi_3_tipi.json';

const v1 = rawV1 as TaskPack;
const rc = rawRc as TaskPack;
const p03 = rawP03 as TaskPack;

/** Merged pack: v1 + reading_comprehension + P03 (SC/WC/IW). Keep old IDs intact. */
const pack: TaskPack = {
  schemaVersion: Math.max(v1.schemaVersion, rc.schemaVersion, p03.schemaVersion),
  title: v1.title,
  tasks: [...v1.tasks, ...rc.tasks, ...p03.tasks],
};

/** Easier → harder (used for home menu and “Sākt visus”). */
export const TASK_TYPE_ORDER: Task['type'][] = [
  'word_reading',
  'image_word',
  'word_choice',
  'sentence_completion',
  'reading_comprehension',
];

export const TASK_TYPE_LABELS: Record<Task['type'], string> = {
  word_reading: 'Vārdu lasīšana',
  image_word: 'Vārdu atpazīšana',
  word_choice: 'Vārdu izvēle',
  sentence_completion: 'Teikumu papildināšana',
  reading_comprehension: 'Izlasi un atbildi',
};

/** Lesson vs single-task unit label for list / done / review screens. */
export function unitNoun(type: Task['type']): 'nodarbība' | 'uzdevums' {
  return type === 'reading_comprehension' ? 'uzdevums' : 'nodarbība';
}

export function unitNounPlural(type: Task['type']): string {
  return type === 'reading_comprehension' ? 'uzdevumi' : 'nodarbības';
}

export function unitTitle(type: Task['type'], lessonNumber: number): string {
  return `${lessonNumber}. ${unitNoun(type)}`;
}

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
