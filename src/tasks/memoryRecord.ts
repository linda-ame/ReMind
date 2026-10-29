import { getMemoryTaskById } from '../data/loadMemory';
import type { MemoryAnswer, MemoryRecallTask, MemorySession } from '../types/memory';

export interface MemoryRecallRecord {
  freeResponse: string | string[] | Record<string, string> | null;
  exact: boolean | null;
  correctAnswer: string | string[] | Record<string, string[]>;
  usedOptions: boolean;
  optionExact: boolean | null;
  optionMisses: number;
}

export interface MemorySessionRecord {
  stimulus: string;
  studyMs: number | null;
  totalMs: number | null;
  listenCount: number;
  pictureViews: number;
  immediate: MemoryRecallRecord | null;
  delayed: MemoryRecallRecord | null;
  /** Milliseconds between finishing the first recall and opening the second. */
  gapMs: number | null;
}

function elapsed(from: string | undefined, to: string | undefined): number | null {
  if (!from || !to) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms);
}

function correctAnswer(
  task: MemoryRecallTask | undefined,
): string | string[] | Record<string, string[]> {
  if (!task) return [];
  if (task.answer.kind === 'facts') {
    const fields: Record<string, string[]> = {};
    for (const field of task.answer.fields) {
      fields[field.key] = field.acceptedAnswers;
    }
    return fields;
  }
  return task.answer.correctTokens;
}

function recallRecord(
  answer: MemoryAnswer | undefined,
  task: MemoryRecallTask | undefined,
): MemoryRecallRecord | null {
  if (!answer) return null;
  const free = answer.freeResponseRaw;
  const hasFree =
    typeof free === 'string'
      ? free.trim() !== ''
      : Array.isArray(free)
        ? free.some((item) => item.trim() !== '')
        : free != null && Object.values(free).some((item) => item.trim() !== '');
  return {
    freeResponse: hasFree ? free ?? null : null,
    exact: hasFree ? (answer.freeScore?.exact ?? null) : null,
    correctAnswer: correctAnswer(task),
    usedOptions: answer.recognitionOpened,
    optionExact: answer.recognitionOpened
      ? (answer.recognitionScore?.exact ?? null)
      : null,
    optionMisses: answer.recognitionMisses ?? 0,
  };
}

/** Derived record stored beside the session in the cloud. */
export function buildMemoryRecord(session: MemorySession): MemorySessionRecord {
  const task = getMemoryTaskById(session.taskId);
  return {
    stimulus: task?.stimulus.visualText ?? '',
    studyMs: elapsed(session.startedAt, session.stimulusHiddenAt),
    totalMs: elapsed(session.startedAt, session.completedAt),
    listenCount: session.ttsPlayCount,
    pictureViews: session.visualHelpViews,
    immediate: recallRecord(session.immediate, task),
    delayed: recallRecord(session.delayed, task),
    gapMs: elapsed(session.immediate?.answeredAt, session.delayedStartedAt),
  };
}
