import type { DifficultyLevel } from '../types/task';
import type {
  MemoryCategory,
  MemoryRecallTask,
} from '../types/memory';
import raw from './memory_recall_P01_100.json';

const CATEGORIES = new Set<MemoryCategory>([
  'digits',
  'numbers',
  'words',
  'shopping',
  'appointment',
]);

function isDifficulty(n: number): n is DifficultyLevel {
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5;
}

function isMemoryTask(value: unknown): value is MemoryRecallTask {
  if (!value || typeof value !== 'object') return false;
  const t = value as MemoryRecallTask;
  if (t.type !== 'memory_recall') return false;
  if (typeof t.id !== 'string' || !t.id.startsWith('mr-')) return false;
  if (!isDifficulty(t.difficulty)) return false;
  if (!CATEGORIES.has(t.category)) return false;
  if (!t.stimulus || !Array.isArray(t.stimulus.ttsSegments)) return false;
  if (typeof t.stimulus.visualText !== 'string') return false;
  const kind = t.answer?.kind;
  return kind === 'ordered_digits' || kind === 'unordered_list' || kind === 'facts';
}

const parsed = (raw as { tasks?: unknown[] }).tasks ?? [];
const tasks: MemoryRecallTask[] = [];
const seen = new Set<string>();

for (const item of parsed) {
  if (!isMemoryTask(item) || seen.has(item.id)) continue;
  seen.add(item.id);
  tasks.push(item);
}

if (import.meta.env.DEV && tasks.length !== parsed.length) {
  console.warn(
    `[ReMind] Memory pack: kept ${tasks.length} of ${parsed.length} tasks.`,
  );
}

export function getMemoryTasks(): MemoryRecallTask[] {
  return tasks;
}

export function getMemoryTaskById(id: string): MemoryRecallTask | undefined {
  return tasks.find((t) => t.id === id);
}
