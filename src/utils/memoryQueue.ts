import { getMemoryTaskById } from '../data/loadMemory';
import { getAllMemorySessions } from '../repositories/IndexedDBProgressRepository';
import {
  emptyMemoryDraft,
  MEMORY_SESSION_SCHEMA,
  type MemoryMode,
  type MemoryRecallTask,
  type MemorySession,
} from '../types/memory';
import { memoryPool } from './memoryDifficulty';

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

function completedIds(mode: MemoryMode, history: MemorySession[]): Set<string> {
  const ids = new Set<string>();
  for (const session of history) {
    if (session.mode !== mode) continue;
    if (session.phase !== 'result' && session.phase !== 'complete') continue;
    const task = getMemoryTaskById(session.taskId);
    if (!task) continue;
    if (task.contentVersion !== session.taskContentVersion) continue;
    ids.add(session.taskId);
  }
  return ids;
}

/**
 * Prefer unfinished tasks in this mode. Avoid a third task of the same
 * category in a row. Repeats are allowed once everything in the pool is done.
 */
export function pickMemoryTask(
  mode: MemoryMode,
  history: MemorySession[],
): MemoryRecallTask | null {
  const pool = memoryPool(mode);
  if (pool.length === 0) return null;
  const done = completedIds(mode, history);
  const unfinished = pool.filter((task) => !done.has(task.id));
  const prefer = unfinished.length > 0 ? unfinished : pool;

  const recent = history
    .filter((session) => session.mode === mode)
    .slice()
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .slice(-2)
    .map((session) => session.category);
  let candidates = prefer;
  if (recent.length === 2 && recent[0] === recent[1]) {
    const other = prefer.filter((task) => task.category !== recent[0]);
    if (other.length > 0) candidates = other;
  }
  return shuffle(candidates)[0] ?? null;
}

export function createMemorySession(
  mode: MemoryMode,
  history: MemorySession[],
): MemorySession | null {
  const task = pickMemoryTask(mode, history);
  if (!task) return null;
  const now = new Date().toISOString();
  return {
    schemaVersion: MEMORY_SESSION_SCHEMA,
    sessionId: crypto.randomUUID(),
    taskId: task.id,
    taskContentVersion: task.contentVersion,
    category: task.category,
    mode,
    phase: 'study',
    startedAt: now,
    updatedAt: now,
    ttsPlayCount: 0,
    visualHelpShown: false,
    visualHelpViews: 0,
    visualOpen: false,
    firstResponseCued: false,
    distractorTaskIds: [],
    distractors: [],
    interrupted: false,
    draft: emptyMemoryDraft(),
  };
}

export const MEMORY_INTERRUPT_MS = 5 * 60 * 1000;
export const MEMORY_TARGET_DELAY_SECONDS = 120;

export function touchSession(session: MemorySession): MemorySession {
  return { ...session, updatedAt: new Date().toISOString() };
}

export async function memoryModeCounts(
  mode: MemoryMode,
): Promise<{ done: number; total: number }> {
  const pool = memoryPool(mode);
  const sessions = await getAllMemorySessions();
  const done = new Set<string>();
  for (const session of sessions) {
    if (session.mode !== mode) continue;
    if (session.phase !== 'result' && session.phase !== 'complete') continue;
    const inPool = pool.some(
      (task) =>
        task.id === session.taskId &&
        task.contentVersion === session.taskContentVersion,
    );
    if (inPool) done.add(session.taskId);
  }
  return { done: done.size, total: pool.length };
}
